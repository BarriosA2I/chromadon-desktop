/**
 * Semantic Vector Store — Gemini Embedding Search
 *
 * Uses Gemini text-embedding-004 for semantic similarity search.
 * Falls back gracefully if embedding API fails — returns empty results.
 * Stores embeddings as Float32Array BLOBs in SQLite.
 *
 * @author Barrios A2I
 */
import type { ChunkMetadata } from './types';
export interface SemanticSearchResult {
    id: string;
    documentId: string;
    clientId: string;
    content: string;
    metadata: ChunkMetadata;
    score: number;
}
export declare class SemanticVectorStore {
    private db;
    private apiKey;
    constructor(dbPath: string, geminiApiKey: string);
    private initSchema;
    batchEmbed(texts: string[]): Promise<Float32Array[]>;
    indexChunks(clientId: string, documentId: string, chunks: Array<{
        id: string;
        content: string;
        metadata: ChunkMetadata;
    }>): Promise<number>;
    search(clientId: string, query: string, topK?: number): Promise<SemanticSearchResult[]>;
    removeDocument(documentId: string): number;
    getChunkCount(clientId: string): number;
    close(): void;
}
//# sourceMappingURL=semantic-vector-store.d.ts.map