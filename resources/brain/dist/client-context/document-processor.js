"use strict";
/**
 * Document Processor — Text Extraction from Multiple Formats
 *
 * Extracts text content from PDF, DOCX, CSV, TXT, and images.
 * Images use Claude Vision API for OCR/description.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const llm_helper_1 = require("./llm-helper");
// ============================================================================
// DOCUMENT PROCESSOR
// ============================================================================
class DocumentProcessor {
    constructor() { }
    async extractText(filePath, mimeType) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        const normalizedMime = mimeType.toLowerCase();
        if (normalizedMime === 'application/pdf') {
            return this.extractPdf(filePath);
        }
        if (normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return this.extractDocx(filePath);
        }
        if (normalizedMime === 'text/csv') {
            return this.extractCsv(filePath);
        }
        if (normalizedMime === 'text/plain') {
            return fs.readFileSync(filePath, 'utf-8');
        }
        if (normalizedMime.startsWith('image/')) {
            return this.extractImage(filePath, normalizedMime);
        }
        throw new Error(`Unsupported mime type: ${mimeType}`);
    }
    // =========================================================================
    // FORMAT-SPECIFIC EXTRACTORS
    // =========================================================================
    async extractPdf(filePath) {
        const pdfParse = (await import('pdf-parse')).default;
        const buffer = fs.readFileSync(filePath);
        const data = await pdfParse(buffer);
        return data.text || '';
    }
    async extractDocx(filePath) {
        const mammoth = await import('mammoth');
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
    }
    async extractCsv(filePath) {
        const Papa = (await import('papaparse')).default;
        const csvText = fs.readFileSync(filePath, 'utf-8');
        return new Promise((resolve) => {
            Papa.parse(csvText, {
                header: true,
                complete: (results) => {
                    // Convert CSV to readable text format
                    const rows = results.data;
                    if (rows.length === 0) {
                        resolve('');
                        return;
                    }
                    const headers = Object.keys(rows[0] || {});
                    const lines = [`Columns: ${headers.join(', ')}\n`];
                    for (const row of rows) {
                        const values = headers.map(h => `${h}: ${row[h] ?? ''}`).join(' | ');
                        lines.push(values);
                    }
                    resolve(lines.join('\n'));
                },
            });
        });
    }
    async extractImage(filePath, mimeType) {
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        return (0, llm_helper_1.callLLMVision)(base64, mimeType, 'Extract ALL text visible in this image (OCR). If there is no text, describe the image content in detail including any business-relevant information (logos, products, charts, diagrams). Return the extracted text or description as plain text.', 4000);
    }
    // =========================================================================
    // UTILITIES
    // =========================================================================
    static getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.csv': 'text/csv',
            '.txt': 'text/plain',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        };
        return mimeMap[ext] || 'application/octet-stream';
    }
    static isSupported(filename) {
        const mime = DocumentProcessor.getMimeType(filename);
        return mime !== 'application/octet-stream';
    }
}
exports.DocumentProcessor = DocumentProcessor;
//# sourceMappingURL=document-processor.js.map