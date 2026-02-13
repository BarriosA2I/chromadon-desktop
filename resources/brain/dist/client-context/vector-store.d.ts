/**
 * Vector Store — TF-IDF Keyword Search with SQLite
 *
 * Lightweight search using TF-IDF keyword vectors + cosine similarity
 * for initial filtering, stored in per-client SQLite databases.
 *
 * @author Barrios A2I
 */
import type { DocumentChunk, SearchResult } from './types';
export declare class VectorStore {
    private db;
    constructor(dbPath: string);
    private initSchema;
    insertChunk(chunk: DocumentChunk): void;
    insertChunks(chunks: DocumentChunk[]): void;
    deleteByDocumentId(documentId: string): number;
    deleteByClientId(clientId: string): number;
    search(clientId: string, query: string, topK?: number): SearchResult[];
    buildKeywordVector(text: string): Record<string, number>;
    getChunkCount(clientId: string): number;
    getDocumentChunkCount(documentId: string): number;
    close(): void;
    private tokenize;
    private cosineSimilarity;
    private rowToChunk;
    private extractFilename;
}
//# sourceMappingURL=vector-store.d.ts.map