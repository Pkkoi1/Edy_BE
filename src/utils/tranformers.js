const { pipeline, env } = require('@xenova/transformers');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
const path = require('path');

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cấu hình cache directory cho models
env.cacheDir = path.join(process.cwd(), 'models_cache');
env.localModelPath = path.join(process.cwd(), 'models_cache/sentence-transformers/all-MiniLM-L6-v2');
env.allowRemoteModels = true; // Cho phép tải model từ xa nếu không có trong cache

// Cấu hình để sử dụng quantization cho model
env.quantized = true;

// Khởi tạo Gemini API với 2 models
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
}

// routing 2 model, primary cho tài liệu dài, fallback cho tìa liệu ngắn, tổng 1 tháng đc 2m token
const PRIMARY_MODEL = process.env.GEMINI_PRIMARY_MODEL;
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Chọn model phù hợp dựa trên độ dài document
 * @param {number} textLength - Độ dài text (chars)
 * @returns {string} - Model name
 */
function selectModel(textLength) {
    const threshold = 15000; // 15k chars
    // <=15k chars → dùng fallback
    // >15k chars → dùng primary
    return textLength < threshold ? FALLBACK_MODEL : PRIMARY_MODEL;
}

/**
 * Tải file từ Cloudinary URL
 * @param {string} url - Cloudinary URL của file
 * @returns {Promise<Buffer>} - Buffer của file
 */
async function downloadFile(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer'
    });
    return Buffer.from(response.data);
}

/**
 * Parse nội dung từ file PDF
 * @param {string} url - Cloudinary URL của file PDF
 * @returns {Promise<string>} - Nội dung text đã được parse
 */
async function parsePDF(url) {
    try {
        const parser = new PDFParse({ url });
        const result = await parser.getText();
        // Nếu result là object thì lấy text, nếu không thì trả thẳng
        const text = typeof result === 'string' ? result : result.text || '';

        return text;
    } catch (error) {
        throw new Error(`Lỗi khi parse PDF: ${error.message}`);
    }
}

/**
 * Parse nội dung từ file DOCX
 * @param {Buffer} buffer - Buffer của file DOCX
 * @returns {Promise<string>} - Nội dung text đã được parse
 */
async function parseDocx(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        throw new Error(`Lỗi khi parse DOCX: ${error.message}`);
    }
}

/**
 * Tạo embedding vector từ text sử dụng OpenAI API
 * @param {string} text - Text cần tạo embedding
 * @returns {Promise<number[]>} - Vector embedding
 */
async function createEmbedding(text) {
    try {
        // Giới hạn độ dài text để tránh quá tải
        const chunks = splitText(text, 200);

        const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
            quantized: true,
            revision: 'main'
        });

        let embeddings = [];

        for (const chunk of chunks) {
            const output = await embedder(chunk, {
                pooling: 'mean',
                normalize: true
            });

            embeddings.push(Array.from(output.data));
        }

        if (embeddings.length === 0) {
            throw new Error("Không nhận được embedding từ model");
        }

        // 🧮 Gộp trung bình tất cả embeddings thành 1 vector duy nhất
        const dims = embeddings[0].length;
        const avgEmbedding = new Array(dims).fill(0);

        for (const emb of embeddings) {
            for (let i = 0; i < dims; i++) {
                avgEmbedding[i] += emb[i];
            }
        }

        for (let i = 0; i < dims; i++) {
            avgEmbedding[i] /= embeddings.length;
        }

        return avgEmbedding;
    } catch (error) {
        console.error('Chi tiết lỗi:', error);
        throw new Error(`Lỗi khi tạo embedding: ${error.message}`);
    }
}

function splitText(text, chunkSize = 400) {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
}

async function createSummaryLongText(text) {
    const chunks = splitText(text, 400);
    const summarizer = await pipeline("summarization", "Xenova/distilbart-cnn-6-6", {
        quantized: true,
    });

    let summaries = [];
    for (const chunk of chunks) {
        const output = await summarizer(chunk, {
            max_length: 120,
            min_length: 30,
            do_sample: false
        });
        summaries.push(output[0].summary_text);
    }

    // Tóm tắt lại toàn bộ phần summary nhỏ
    const combinedSummary = summaries.join(" ");
    const final = await summarizer(combinedSummary, {
        max_length: 500,
        min_length: 50
    });

    return final[0].summary_text.trim();
}
/**
 * Xử lý file từ Cloudinary URL và tạo embedding
 * @param {string} url - Cloudinary URL của file
 * @param {string} fileType - Loại file ('PDF' hoặc 'WORD')
 * @returns {Promise<{text: string, embedding: number[]}>} - Nội dung text và vector embedding
 */
async function processDocumentAndCreateEmbedding(url, fileType) {
    try {
        const buffer = await downloadFile(url);
        let text;

        if (fileType === 'PDF') {
            text = await parsePDF(url);
        } else if (fileType === 'WORD') {
            text = await parseDocx(buffer);
        } else {
            throw new Error('Loại file không được hỗ trợ');
        }

        console.log(`File type: ${fileType} | >>> typeof text:`, typeof text, '| length:', text?.length);
        const embedding = await createEmbedding(text);

        return {
            text,
            embedding
        };
    } catch (error) {
        throw new Error(`Lỗi khi xử lý tài liệu: ${error.message}`);
    }
}

async function processDocumentAndCreateSummary(url, fileType) {
    try {
        const buffer = await downloadFile(url);
        let text;

        if (fileType === 'PDF') {
            text = await parsePDF(url);
        } else if (fileType === 'WORD') {
            text = await parseDocx(buffer);
        } else {
            throw new Error('Loại file không được hỗ trợ');
        }

        const summary = await createSummaryLongText(text);
        console.log("Done create summary")
        return {
            text,
            summary
        };
    } catch (error) {
        throw new Error(`Lỗi khi xử lý tài liệu: ${error.message}`);
    }
}

/**
 * Xử lý tài liệu với Gemini AI để tóm tắt và kiểm duyệt trong 1 lần gọi
 * @param {string} url - Cloudinary URL của file
 * @param {string} fileType - Loại file ('PDF' hoặc 'WORD')
 * @returns {Promise<{summary: string, aiCheck: {violation_level: string, action_suggest: string, reason: string}}>}
 */
async function processDocumentWithGeminiAI(url, fileType, documentMetadata) {
    try {
        const buffer = await downloadFile(url);
        let text;

        // Parse nội dung từ file
        if (fileType === 'PDF') {
            text = await parsePDF(url);
        } else if (fileType === 'WORD') {
            text = await parseDocx(buffer);
        } else {
            throw new Error('Loại file không được hỗ trợ');
        }

        const raw = (text || '').replace(/\s+/g, ' ');
        if (raw.length < 200){
            return {
                summary: 'Nội dung quá ngắn để thực hiện tóm tắt',
                aiCheck: {
                    violation_level: 'MEDIUM',
                    action_suggest: 'MANUAL_REVIEW',
                    reason: 'Nội dung quá ngắn để thực hiện tóm tắt và kiểm duyệt bằng AI'
                },
            }
        }

        const minLengthToBreak = 6000;
        const bufferZone = 1000; // Buffer 1000 chars
        const breakThreshold = minLengthToBreak + bufferZone; // 7000
        const maxLength = 30000;

        let textToProcess;

        if (text.length <= breakThreshold) {
            // <= 7k → Dùng toàn bộ
            textToProcess = text;
        } else {
            // > 7k → Break
            const startLength = Math.floor(maxLength * 0.4);
            const middleLength = Math.floor(maxLength * 0.2);
            const endLength = maxLength - startLength - middleLength;

            const startChunk = text.substring(0, startLength).trim();
            const middleStart = Math.floor((text.length - middleLength) / 2);
            const middleChunk = text.substring(middleStart, middleStart + middleLength).trim();
            const endChunk = text.substring(text.length - endLength).trim();

            textToProcess = `[PHẦN ĐẦU]\n${startChunk}\n\n[...]\n\n[PHẦN GIỮA]\n${middleChunk}\n\n[...]\n\n[PHẦN CUỐI]\n${endChunk}`;
        }

        const userTitle = documentMetadata.title || '';
        const userDescription = documentMetadata.summary_by_user || '';
        const userAuthor = documentMetadata.author || '';
        const userPublisher = documentMetadata.publisher || '';
        const userPublishedYear = documentMetadata.published_year || '';
        const userKeyword = documentMetadata.keyword || '';
        const userSubjectName = documentMetadata.subject_name || '';
        const metadataSection = userTitle || userDescription ? `
THÔNG TIN NGƯỜI DÙNG CUNG CẤP:
- Tiêu đề: ${userTitle}
- Mô tả/Tóm tắt: ${userDescription || 'Không có'}
- Tác giả: ${userAuthor || 'Không có'}
- Nhà xuất bản: ${userPublisher || 'Không có'}
- Năm xuất bản: ${userPublishedYear || 'Không có'}
- Từ khóa: ${userKeyword || 'Không có'}
- Môn học: ${userSubjectName || 'Không có'}
` : '';

        // Prompt cho Gemini - toàn diện
        const prompt = `Bạn là một hệ thống AI chuyên nghiệp hỗ trợ kiểm duyệt tài liệu giáo dục học thuật.

${metadataSection}
NHIỆM VỤ CỦA BẠN:
1. Tóm tắt nội dung tài liệu (khoảng 500 chữ, bằng tiếng Việt)
2. Kiểm tra vi phạm nội dung
3. Xác minh thông tin người dùng nhập có phù hợp với nội dung thực tế không
4. Đánh giá tính chuyên sâu của tài liệu

Hãy phân tích tài liệu và trả về JSON theo format SAU (chỉ JSON, không có text thừa):

{
  "summary": "Tóm tắt nội dung tài liệu (khoảng 500 chữ)",
  "violation_level": "LOW|MEDIUM|HIGH",
  "action_suggest": "AUTO_APPROVE|MANUAL_REVIEW|REJECT",
  "reason": "Lý do đánh giá tổng hợp",
  "is_intensive": true|false,
  "metadata_valid": true|false
}

QUY TẮC ĐÁNH GIÁ:

A. KIỂM TRA VI PHẠM NỘI DUNG:
- LOW: Tài liệu phù hợp, nội dung giáo dục bình thường → AUTO_APPROVE
- MEDIUM: Có nội dung đáng nghi, cần xem xét kỹ → MANUAL_REVIEW
- HIGH: Vi phạm nghiêm trọng (bạo lực, bất hợp pháp, phản giáo dục, spam) → REJECT

B. XÁC MINH METADATA (metadata_valid):
- true: Tiêu đề và mô tả phù hợp với nội dung
- false: Tiêu đề/mô tả không liên quan, sai lệch, hoặc nhập bậy (spam, clickbait, hoàn toàn sai)
  → Nếu false, đề xuất MANUAL_REVIEW hoặc REJECT tùy mức độ

C. ĐÁNH GIÁ CHUYÊN SÂU (is_intensive):
- true: Tài liệu có độ chuyên sâu cao, chất lượng xuất sắc
  • Nghiên cứu học thuật chuyên sâu, công trình khoa học
  • Nội dung phức tạp, yêu cầu kiến thức chuyên môn cao
  • Tài liệu tham khảo chất lượng, trích dẫn đầy đủ
  • Phân tích sâu, có đóng góp mới
- false: Tài liệu giáo dục thông thường, tài liệu học tập cơ bản

LƯU Ý:
- Reason phải giải thích rõ về vi phạm, metadata, và intensive
- Đối với tài liệu rỗng, nội dung linh tinh, xáo rỗng thì đánh dấu vi phạm MEDIUM
NỘI DUNG TÀI LIỆU:
${textToProcess}

Trả về JSON thuần, không markdown, không text thừa.`;

        // chọn model dựa thông tin text
        const selectedModelName = selectModel(text.length);
        let modelUsed = selectedModelName;
        let result;

        try {
            // Thử model được chọn trước
            const selectedModel = genAI.getGenerativeModel({ model: selectedModelName });
            result = await selectedModel.generateContent(prompt);
            console.log(`Đang dùng model: ${modelUsed}`);
        } catch (primaryError) {
            // Nếu model chính fail (hết quota/rate limit) → fallback sang model còn lại
            const isQuotaError = primaryError.message?.includes('quota') || 
                               primaryError.message?.includes('RESOURCE_EXHAUSTED') ||
                               primaryError.status === 429;
            
            if (isQuotaError) {
                const fallbackModelName = selectedModelName === PRIMARY_MODEL ? FALLBACK_MODEL : PRIMARY_MODEL;
                console.warn(`${selectedModelName} hết quota/rate limit, chuyển sang ${fallbackModelName}`);
                
                try {
                    modelUsed = fallbackModelName;
                    const fallbackModel = genAI.getGenerativeModel({ model: fallbackModelName });
                    result = await fallbackModel.generateContent(prompt);
                    console.log(`Fallback thành công sang: ${modelUsed}`);
                } catch (fallbackError) {
                    console.error(`Cả 2 models đều fail:`, fallbackError);
                    throw fallbackError;
                }
            } else {
                // Lỗi khác (không phải quota) → throw
                throw primaryError;
            }
        }

        const response = await result.response;
        const responseText = response.text();

        // Parse JSON từ response
        let aiResult;
        try {
            // Remove markdown code blocks nếu có
            let cleanText = responseText.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();

            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                let jsonString = jsonMatch[0];

                jsonString = jsonString
                    .replace(/\r\n/g, ' ')
                    .replace(/\n/g, ' ')
                    .replace(/\r/g, ' ')
                    .replace(/\t/g, ' ')
                    .replace(/\s+/g, ' ');

                aiResult = JSON.parse(jsonString);
            } else {
                throw new Error('Không tìm thấy JSON trong response');
            }
        } catch (parseError) {
            console.error('Lỗi parse JSON từ Gemini:', parseError);
            console.error('Response text:', responseText);
            // Fallback
            aiResult = {
                summary: responseText.substring(0, 500) || 'Không thể tạo tóm tắt',
                violation_level: 'MEDIUM',
                action_suggest: 'MANUAL_REVIEW',
                reason: 'Lỗi khi parse kết quả từ AI',
                is_intensive: false,
                metadata_valid: true
            };
        }

        // Validate và chuẩn hóa kết quả
        let violationLevel = aiResult.violation_level;

        // Nếu metadata không hợp lệ, tăng violation level
        if (aiResult.metadata_valid === false) {
            // Ít nhất phải MEDIUM nếu metadata sai
            if (violationLevel === 'LOW') {
                violationLevel = 'MEDIUM';
            }
        }

        if (violationLevel === 'NONE') {
            violationLevel = 'LOW';
        }

        if (!['LOW', 'MEDIUM', 'HIGH'].includes(violationLevel)) {
            violationLevel = 'MEDIUM';
        }

        let actionSuggest = aiResult.action_suggest;
        // Đảm bảo action_suggest phù hợp với violation_level
        if (violationLevel === 'LOW') {
            actionSuggest = ['AUTO_APPROVE', 'MANUAL_REVIEW'].includes(actionSuggest) ? actionSuggest : 'AUTO_APPROVE';
        } else if (violationLevel === 'MEDIUM') {
            actionSuggest = 'MANUAL_REVIEW';
        } else if (violationLevel === 'HIGH') {
            actionSuggest = 'REJECT';
        }

        return {
            summary: aiResult.summary || 'Không thể tạo tóm tắt',
            aiCheck: {
                violation_level: violationLevel,
                action_suggest: actionSuggest,
                reason: aiResult.reason || (violationLevel === 'LOW' ? 'Tài liệu phù hợp' : 'Cần kiểm tra')
            },
            is_intensive: aiResult.is_intensive === true, // Boolean
            metadata_valid: aiResult.metadata_valid !== false // Default true
        };
    } catch (error) {
        console.error('Lỗi khi xử lý với Gemini AI:', error);
        return {
            summary: 'Không thể tạo tóm tắt do lỗi xử lý',
            aiCheck: {
                violation_level: 'MEDIUM',
                action_suggest: 'MANUAL_REVIEW',
                reason: `Lỗi: ${error.message}`
            },
            is_intensive: false,
            metadata_valid: true
        };
    }
}

module.exports = {
    processDocumentAndCreateEmbedding,
    processDocumentAndCreateSummary,
    processDocumentWithGeminiAI
};