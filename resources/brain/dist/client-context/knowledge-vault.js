"use strict";
/**
 * Knowledge Vault — High-Level Document Management API
 *
 * Combines DocumentProcessor + DocumentChunker + VectorStore
 * into a clean API for uploading, searching, and managing
 * per-client document knowledge.
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
exports.KnowledgeVault = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const document_processor_1 = require("./document-processor");
const document_chunker_1 = require("./document-chunker");
const vector_store_1 = require("./vector-store");
// ============================================================================
// KNOWLEDGE VAULT
// ============================================================================
class KnowledgeVault {
    processor;
    chunker;
    storage;
    vectorStores = new Map();
    constructor(storage) {
        this.processor = new document_processor_1.DocumentProcessor();
        this.chunker = new document_chunker_1.DocumentChunker();
        this.storage = storage;
    }
    // =========================================================================
    // UPLOAD & INDEX
    // =========================================================================
    async uploadDocument(clientId, sourcePath, originalFilename, mimeType) {
        const startTime = Date.now();
        const docId = (0, uuid_1.v4)();
        const resolvedMime = mimeType || document_processor_1.DocumentProcessor.getMimeType(originalFilename);
        // Create document record
        const doc = {
            id: docId,
            clientId,
            filename: `${docId}${path.extname(originalFilename)}`,
            originalFilename,
            storedPath: '',
            mimeType: resolvedMime,
            fileSize: 0,
            textContent: '',
            chunkCount: 0,
            status: 'pending',
            uploadedAt: new Date().toISOString(),
        };
        // Copy file to client's document directory
        const destDir = this.storage.getDocumentStoragePath(clientId);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const destPath = path.join(destDir, doc.filename);
        fs.copyFileSync(sourcePath, destPath);
        doc.storedPath = destPath;
        doc.fileSize = fs.statSync(destPath).size;
        // Track document
        doc.status = 'processing';
        this.storage.addDocument(clientId, doc);
        try {
            // Extract text
            const textContent = await this.processor.extractText(destPath, resolvedMime);
            doc.textContent = textContent;
            // Chunk text
            const textChunks = this.chunker.chunk(textContent);
            // Build keyword vectors and store chunks
            const vectorStore = this.getVectorStore(clientId);
            const chunks = textChunks.map((tc, idx) => ({
                id: (0, uuid_1.v4)(),
                documentId: docId,
                clientId,
                content: tc.content,
                chunkIndex: idx,
                tokenCount: tc.estimatedTokens,
                keywordVector: JSON.stringify(vectorStore.buildKeywordVector(tc.content)),
                metadata: {
                    filename: originalFilename,
                    startChar: tc.startChar,
                    endChar: tc.endChar,
                },
                createdAt: new Date().toISOString(),
            }));
            if (chunks.length > 0) {
                vectorStore.insertChunks(chunks);
            }
            doc.chunkCount = chunks.length;
            doc.status = 'indexed';
            doc.processedAt = new Date().toISOString();
            this.storage.updateDocument(clientId, docId, doc);
            const processingTimeMs = Date.now() - startTime;
            console.log(`[KnowledgeVault] Indexed ${originalFilename}: ${chunks.length} chunks in ${processingTimeMs}ms`);
            return { document: doc, chunksCreated: chunks.length, processingTimeMs };
        }
        catch (error) {
            doc.status = 'failed';
            doc.errorMessage = error.message;
            this.storage.updateDocument(clientId, docId, doc);
            throw error;
        }
    }
    // =========================================================================
    // SEARCH
    // =========================================================================
    searchKnowledge(clientId, query, topK = 5) {
        const vectorStore = this.getVectorStore(clientId);
        return vectorStore.search(clientId, query, topK);
    }
    // =========================================================================
    // DOCUMENT MANAGEMENT
    // =========================================================================
    listDocuments(clientId) {
        return this.storage.getDocuments(clientId);
    }
    getDocument(clientId, documentId) {
        const docs = this.storage.getDocuments(clientId);
        return docs.find(d => d.id === documentId) || null;
    }
    deleteDocument(clientId, documentId) {
        const doc = this.getDocument(clientId, documentId);
        if (!doc)
            return false;
        // Remove chunks from vector store
        const vectorStore = this.getVectorStore(clientId);
        vectorStore.deleteByDocumentId(documentId);
        // Remove stored file
        if (doc.storedPath && fs.existsSync(doc.storedPath)) {
            fs.unlinkSync(doc.storedPath);
        }
        // Remove from document tracking
        this.storage.removeDocument(clientId, documentId);
        console.log(`[KnowledgeVault] Deleted document: ${doc.originalFilename} (${documentId})`);
        return true;
    }
    // =========================================================================
    // CLIENT CONTEXT SUMMARY (for agent prompt injection)
    // =========================================================================
    getClientContextSummary(clientId) {
        const client = this.storage.getClient(clientId);
        if (!client)
            return null;
        const profile = this.storage.getProfile(clientId);
        const voice = this.storage.getVoice(clientId);
        const personas = this.storage.getPersonas(clientId);
        const docs = this.storage.getDocuments(clientId);
        const parts = [];
        // Business overview
        if (profile) {
            parts.push(`ACTIVE CLIENT: ${profile.businessName || client.name}`);
            if (profile.industry)
                parts.push(`Industry: ${profile.industry}`);
            if (profile.missionStatement)
                parts.push(`Mission: ${profile.missionStatement}`);
            if (profile.products?.length)
                parts.push(`Products/Services: ${profile.products.join(', ')}`);
            if (profile.services?.length)
                parts.push(`Services: ${profile.services.join(', ')}`);
            if (profile.uniqueSellingPoints?.length)
                parts.push(`USPs: ${profile.uniqueSellingPoints.join(', ')}`);
            if (profile.goals?.length)
                parts.push(`Goals: ${profile.goals.join(', ')}`);
        }
        else {
            parts.push(`ACTIVE CLIENT: ${client.name}`);
        }
        // Brand voice
        if (voice) {
            const voiceParts = [];
            if (voice.tone?.length)
                voiceParts.push(`Tone: ${voice.tone.join(', ')}`);
            if (voice.personality?.length)
                voiceParts.push(`Personality: ${voice.personality.join(', ')}`);
            if (voice.formalityLevel)
                voiceParts.push(`Formality: ${voice.formalityLevel}`);
            if (voice.avoidWords?.length)
                voiceParts.push(`Avoid: ${voice.avoidWords.join(', ')}`);
            if (voiceParts.length)
                parts.push(`Brand Voice: ${voiceParts.join(' | ')}`);
        }
        // Audience
        if (personas.length > 0) {
            const audienceNames = personas.map(p => p.name).join(', ');
            parts.push(`Target Audiences: ${audienceNames}`);
        }
        // Document vault summary
        const indexedDocs = docs.filter(d => d.status === 'indexed');
        if (indexedDocs.length > 0) {
            parts.push(`Knowledge Vault: ${indexedDocs.length} indexed document(s) — ${indexedDocs.map(d => d.originalFilename).join(', ')}`);
        }
        if (parts.length <= 1)
            return null;
        return parts.join('\n');
    }
    // =========================================================================
    // VECTOR STORE MANAGEMENT
    // =========================================================================
    getVectorStore(clientId) {
        let store = this.vectorStores.get(clientId);
        if (!store) {
            const dbPath = this.storage.getChunksDbPath(clientId);
            store = new vector_store_1.VectorStore(dbPath);
            this.vectorStores.set(clientId, store);
        }
        return store;
    }
    closeAll() {
        for (const [, store] of this.vectorStores) {
            store.close();
        }
        this.vectorStores.clear();
    }
}
exports.KnowledgeVault = KnowledgeVault;
//# sourceMappingURL=knowledge-vault.js.map