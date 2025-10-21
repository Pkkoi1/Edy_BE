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
    // Thoát hoặc xử lý lỗi tùy theo yêu cầu của ứng dụng
    // process.exit(1); 
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

module.exports = {
    processDocumentAndCreateEmbedding,
    processDocumentAndCreateSummary
};