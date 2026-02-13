/**
 * Knowledge Vault — High-Level Document Management API
 *
 * Combines DocumentProcessor + DocumentChunker + VectorStore
 * into a clean API for uploading, searching, and managing
 * per-client document knowledge.
 *
 * @author Barrios A2I
 */
import { ClientStorage } from './client-storage';
import type { KnowledgeDocument, SearchResult, DocumentUploadResult } from './types';
export declare class KnowledgeVault {
    private readonly processor;
    private readonly chunker;
    private readonly storage;
    private readonly vectorStores;
    constructor(storage: ClientStorage);
    uploadDocument(clientId: string, sourcePath: string, originalFilename: string, mimeType?: string): Promise<DocumentUploadResult>;
    searchKnowledge(clientId: string, query: string, topK?: number): SearchResult[];
    listDocuments(clientId: string): KnowledgeDocument[];
    getDocument(clientId: string, documentId: string): KnowledgeDocument | null;
    deleteDocument(clientId: string, documentId: string): boolean;
    getClientContextSummary(clientId: string): string | null;
    private getVectorStore;
    closeAll(): void;
}
//# sourceMappingURL=knowledge-vault.d.ts.map