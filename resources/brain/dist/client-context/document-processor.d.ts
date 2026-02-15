/**
 * Document Processor — Text Extraction from Multiple Formats
 *
 * Extracts text content from PDF, DOCX, CSV, TXT, and images.
 * Images use Claude Vision API for OCR/description.
 *
 * @author Barrios A2I
 */
export declare class DocumentProcessor {
    constructor();
    extractText(filePath: string, mimeType: string): Promise<string>;
    private extractPdf;
    private extractDocx;
    private extractCsv;
    private extractImage;
    static getMimeType(filename: string): string;
    static isSupported(filename: string): boolean;
}
//# sourceMappingURL=document-processor.d.ts.map