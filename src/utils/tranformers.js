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

// Khởi tạo Gemini Pro 2.5
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");

}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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
        // Giới hạn độ dài text để tránh quá tải memory
        const chunks = splitText(text, 500);

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
async function processDocumentWithGeminiAI(url, fileType) {
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

        // Giới hạn độ dài text để tránh quá tải (chỉ lấy 10000 ký tự đầu)
        const maxLength = 10000;
        const textToProcess = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

        // Prompt cho Gemini
        const prompt = `Bạn là một hệ thống AI hỗ trợ kiểm duyệt và tóm tắt tài liệu giáo dục.

Nhiệm vụ của bạn:
1. Tóm tắt nội dung tài liệu (khoảng 200-300 từ)
2. Kiểm tra vi phạm nội dung và đánh giá mức độ vi phạm

Hãy phân tích tài liệu sau và trả về kết quả theo định dạng JSON chính xác:

{
  "summary": "Tóm tắt nội dung tài liệu bằng tiếng Việt (200-300 từ)",
  "violation_level": "LOW|MEDIUM|HIGH",
  "action_suggest": "AUTO_APPROVE|MANUAL_REVIEW|REJECT",
  "reason": "Lý do đánh giá vi phạm"
}

Quy tắc đánh giá:
- LOW: Tài liệu phù hợp. Có thể có một số nội dung hay lỗi cần xem xét nhưng vẫn an toàn và phù hợp → AUTO_APPROVE
- MEDIUM: Có nội dung đáng nghi, cần xem xét kỹ → MANUAL_REVIEW
- HIGH: Có nội dung vi phạm nghiêm trọng (bạo lực, bất hợp pháp, phản giáo dục) → REJECT

Nội dung tài liệu:
${textToProcess}

Hãy trả về chỉ JSON, không có text thừa khác.`;

        // Gọi Gemini API
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();

        // Parse JSON từ response
        let aiResult;
        try {
            // Tìm JSON trong response (loại bỏ markdown code block nếu có)
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                aiResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Không tìm thấy JSON trong response');
            }
        } catch (parseError) {
            console.error('Lỗi parse JSON từ Gemini:', parseError);
            console.error('Response text:', responseText);
            // Fallback: trả về kết quả mặc định
            aiResult = {
                summary: responseText.substring(0, 500) || 'Không thể tạo tóm tắt',
                violation_level: 'MEDIUM',
                action_suggest: 'MANUAL_REVIEW',
                reason: 'Lỗi khi parse kết quả từ AI'
            };
        }

        // Validate và chuẩn hóa kết quả
        let violationLevel = aiResult.violation_level;
        
        // Nếu AI trả về NONE, chuyển thành LOW (vì sau khi AI check không bao giờ là NONE)
        if (violationLevel === 'NONE') {
            violationLevel = 'LOW';
        }
        
        // Validate violation_level
        if (!['LOW', 'MEDIUM', 'HIGH'].includes(violationLevel)) {
            violationLevel = 'MEDIUM';
        }

        let actionSuggest = aiResult.action_suggest;
        // Đảm bảo action_suggest phù hợp với violation_level
        if (violationLevel === 'LOW') {
            // LOW có thể AUTO_APPROVE hoặc MANUAL_REVIEW
            actionSuggest = ['AUTO_APPROVE', 'MANUAL_REVIEW'].includes(actionSuggest) ? actionSuggest : 'MANUAL_REVIEW';
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
                reason: aiResult.reason || (violationLevel === 'LOW' ? 'Phát hiện nội dung cần xem xét nhẹ' : 'Cần kiểm tra nội dung')
            }
        };
    } catch (error) {
        console.error('Lỗi khi xử lý với Gemini AI:', error);
        // Trả về kết quả mặc định nếu có lỗi
        return {
            summary: 'Không thể tạo tóm tắt do lỗi xử lý',
            aiCheck: {
                violation_level: 'MEDIUM',
                action_suggest: 'MANUAL_REVIEW',
                reason: `Lỗi: ${error.message}`
            }
        };
    }
}

module.exports = {
    processDocumentAndCreateEmbedding,
    processDocumentAndCreateSummary,
    processDocumentWithGeminiAI
};