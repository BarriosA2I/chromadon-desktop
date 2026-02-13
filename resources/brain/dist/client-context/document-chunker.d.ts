/**
 * Document Chunker — Sentence-Aware Text Splitting
 *
 * Splits text into ~500-token chunks with 50-token overlap
 * at sentence boundaries for optimal retrieval.
 *
 * @author Barrios A2I
 */
export interface ChunkOptions {
    maxTokens: number;
    overlapTokens: number;
}
export interface TextChunk {
    content: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
    estimatedTokens: number;
}
export declare class DocumentChunker {
    private readonly options;
    constructor(options?: Partial<ChunkOptions>);
    chunk(text: string): TextChunk[];
    private splitSentences;
    private splitLongSentence;
    private estimateTokens;
}
//# sourceMappingURL=document-chunker.d.ts.map