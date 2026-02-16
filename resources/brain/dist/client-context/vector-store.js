"use strict";
/**
 * Vector Store — TF-IDF Keyword Search with SQLite
 *
 * Lightweight search using TF-IDF keyword vectors + cosine similarity
 * for initial filtering, stored in per-client SQLite databases.
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
exports.VectorStore = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const semantic_vector_store_1 = require("./semantic-vector-store");
// Lazy-load better-sqlite3 — see database.ts for rationale
let Database = null;
function getDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    return Database;
}
// ============================================================================
// VECTOR STORE
// ============================================================================
class VectorStore {
    db;
    semanticStore = null;
    constructor(dbPath) {
        const Db = getDatabase();
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Db(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.initSchema();
        // Initialize semantic search if Gemini API key available
        const geminiKey = process.env.GEMINI_API_KEY;
        if (geminiKey && process.env.USE_SEMANTIC_SEARCH !== 'false') {
            try {
                const semanticDbPath = dbPath.replace('.db', '-semantic.db');
                this.semanticStore = new semantic_vector_store_1.SemanticVectorStore(semanticDbPath, geminiKey);
                console.log('[VectorStore] Semantic search enabled (Gemini text-embedding-004)');
            }
            catch (err) {
                console.log(`[VectorStore] Semantic search init failed (TF-IDF only): ${err.message}`);
            }
        }
    }
    // =========================================================================
    // SCHEMA
    // =========================================================================
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        content TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        token_count INTEGER NOT NULL,
        keyword_vector TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_client_id ON chunks(client_id);
    `);
    }
    // =========================================================================
    // INSERT / DELETE
    // =========================================================================
    insertChunk(chunk) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, document_id, client_id, content, chunk_index, token_count, keyword_vector, metadata, created_at)
      VALUES (@id, @documentId, @clientId, @content, @chunkIndex, @tokenCount, @keywordVector, @metadata, @createdAt)
    `);
        stmt.run({
            id: chunk.id,
            documentId: chunk.documentId,
            clientId: chunk.clientId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
            keywordVector: chunk.keywordVector,
            metadata: JSON.stringify(chunk.metadata),
            createdAt: chunk.createdAt,
        });
    }
    insertChunks(chunks) {
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (id, document_id, client_id, content, chunk_index, token_count, keyword_vector, metadata, created_at)
      VALUES (@id, @documentId, @clientId, @content, @chunkIndex, @tokenCount, @keywordVector, @metadata, @createdAt)
    `);
        const transaction = this.db.transaction((items) => {
            for (const chunk of items) {
                insert.run({
                    id: chunk.id,
                    documentId: chunk.documentId,
                    clientId: chunk.clientId,
                    content: chunk.content,
                    chunkIndex: chunk.chunkIndex,
                    tokenCount: chunk.tokenCount,
                    keywordVector: chunk.keywordVector,
                    metadata: JSON.stringify(chunk.metadata),
                    createdAt: chunk.createdAt,
                });
            }
        });
        transaction(chunks);
        // Dual-index: also index in semantic store if available
        if (this.semanticStore && chunks.length > 0) {
            const clientId = chunks[0].clientId;
            const documentId = chunks[0].documentId;
            this.semanticStore.indexChunks(clientId, documentId, chunks.map(c => ({
                id: c.id,
                content: c.content,
                metadata: typeof c.metadata === 'string' ? JSON.parse(c.metadata) : c.metadata,
            }))).catch(err => {
                console.log(`[VectorStore] Semantic indexing failed (non-critical): ${err.message}`);
            });
        }
    }
    deleteByDocumentId(documentId) {
        const stmt = this.db.prepare('DELETE FROM chunks WHERE document_id = ?');
        const result = stmt.run(documentId);
        return result.changes;
    }
    deleteByClientId(clientId) {
        const stmt = this.db.prepare('DELETE FROM chunks WHERE client_id = ?');
        const result = stmt.run(clientId);
        return result.changes;
    }
    // =========================================================================
    // SEARCH
    // =========================================================================
    search(clientId, query, topK = 5) {
        // Try semantic search first if available
        if (this.semanticStore) {
            try {
                // DECISION: synchronous wrapper — semantic search is async but VectorStore.search() is sync.
                // We attempt semantic and fall through to TF-IDF. For async callers, use searchSemantic() directly.
            }
            catch { /* fall through to TF-IDF */ }
        }
        const queryVector = this.buildKeywordVector(query);
        if (Object.keys(queryVector).length === 0)
            return [];
        // Get all chunks for this client
        const stmt = this.db.prepare('SELECT * FROM chunks WHERE client_id = ?');
        const rows = stmt.all(clientId);
        if (rows.length === 0)
            return [];
        // Score each chunk using TF-IDF cosine similarity
        const scored = [];
        for (const row of rows) {
            let chunkVector;
            try {
                chunkVector = JSON.parse(row.keyword_vector);
            }
            catch {
                continue;
            }
            const score = this.cosineSimilarity(queryVector, chunkVector);
            if (score > 0) {
                scored.push({ row, score });
            }
        }
        // Sort by score descending, take top K
        scored.sort((a, b) => b.score - a.score);
        const topResults = scored.slice(0, topK);
        return topResults.map(({ row, score }) => ({
            chunk: this.rowToChunk(row),
            score,
            documentFilename: this.extractFilename(row.metadata),
        }));
    }
    /**
     * Async search with semantic fallback.
     * Tries Gemini embeddings first, falls back to TF-IDF if score < 0.3 or no results.
     */
    async searchSemantic(clientId, query, topK = 5) {
        if (this.semanticStore) {
            try {
                const semanticResults = await this.semanticStore.search(clientId, query, topK);
                if (semanticResults.length > 0 && semanticResults[0].score >= 0.3) {
                    return semanticResults.map(r => ({
                        chunk: {
                            id: r.id,
                            documentId: r.documentId,
                            clientId: r.clientId,
                            content: r.content,
                            chunkIndex: 0,
                            tokenCount: r.content.split(/\s+/).length,
                            keywordVector: '',
                            metadata: r.metadata,
                            createdAt: '',
                        },
                        score: r.score,
                        documentFilename: r.metadata.filename || 'unknown',
                    }));
                }
            }
            catch {
                // Fall through to TF-IDF
            }
        }
        return this.search(clientId, query, topK);
    }
    // =========================================================================
    // TF-IDF KEYWORD VECTOR
    // =========================================================================
    buildKeywordVector(text) {
        const words = this.tokenize(text);
        if (words.length === 0)
            return {};
        // Term frequency
        const tf = {};
        for (const word of words) {
            tf[word] = (tf[word] || 0) + 1;
        }
        // Normalize by document length
        const maxFreq = Math.max(...Object.values(tf));
        const vector = {};
        for (const [word, freq] of Object.entries(tf)) {
            vector[word] = 0.5 + 0.5 * (freq / maxFreq);
        }
        return vector;
    }
    // =========================================================================
    // STATS
    // =========================================================================
    getChunkCount(clientId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chunks WHERE client_id = ?');
        const row = stmt.get(clientId);
        return row.count;
    }
    getDocumentChunkCount(documentId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chunks WHERE document_id = ?');
        const row = stmt.get(documentId);
        return row.count;
    }
    close() {
        this.db.close();
    }
    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const key of allKeys) {
            const va = a[key] || 0;
            const vb = b[key] || 0;
            dotProduct += va * vb;
            magnitudeA += va * va;
            magnitudeB += vb * vb;
        }
        const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
        if (magnitude === 0)
            return 0;
        return dotProduct / magnitude;
    }
    rowToChunk(row) {
        let metadata;
        try {
            metadata = JSON.parse(row.metadata);
        }
        catch {
            metadata = { filename: '', startChar: 0, endChar: 0 };
        }
        return {
            id: row.id,
            documentId: row.document_id,
            clientId: row.client_id,
            content: row.content,
            chunkIndex: row.chunk_index,
            tokenCount: row.token_count,
            keywordVector: row.keyword_vector,
            metadata,
            createdAt: row.created_at,
        };
    }
    extractFilename(metadataJson) {
        try {
            const meta = JSON.parse(metadataJson);
            return meta.filename || 'unknown';
        }
        catch {
            return 'unknown';
        }
    }
}
exports.VectorStore = VectorStore;
// ============================================================================
// STOP WORDS
// ============================================================================
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'has', 'have', 'been', 'will', 'more', 'when',
    'who', 'oil', 'its', 'let', 'say', 'she', 'too', 'use', 'way', 'about',
    'many', 'then', 'them', 'same', 'how', 'its', 'may', 'with', 'also', 'from',
    'that', 'this', 'what', 'which', 'their', 'there', 'these', 'those', 'would',
    'could', 'should', 'into', 'than', 'other', 'some', 'very', 'just', 'because',
    'each', 'any', 'such', 'like', 'through', 'over', 'after', 'before', 'between',
]);
//# sourceMappingURL=vector-store.js.map