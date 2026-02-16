"use strict";
/**
 * Semantic Vector Store — Gemini Embedding Search
 *
 * Uses Gemini text-embedding-004 for semantic similarity search.
 * Falls back gracefully if embedding API fails — returns empty results.
 * Stores embeddings as Float32Array BLOBs in SQLite.
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
exports.SemanticVectorStore = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Lazy-load better-sqlite3
let Database = null;
function getDatabase() {
    if (!Database)
        Database = require('better-sqlite3');
    return Database;
}
const EMBEDDING_MODEL = 'text-embedding-004';
const EMBEDDING_DIMS = 768;
const BATCH_SIZE = 100;
class SemanticVectorStore {
    db;
    apiKey;
    constructor(dbPath, geminiApiKey) {
        const Db = getDatabase();
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Db(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.apiKey = geminiApiKey;
        this.initSchema();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS semantic_chunks (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        metadata TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_semantic_client ON semantic_chunks(client_id);
      CREATE INDEX IF NOT EXISTS idx_semantic_document ON semantic_chunks(document_id);
    `);
    }
    async batchEmbed(texts) {
        const results = [];
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: batch.map(text => ({
                            model: `models/${EMBEDDING_MODEL}`,
                            content: { parts: [{ text }] },
                        })),
                    }),
                });
                if (!response.ok) {
                    console.log(`[SemanticVectorStore] Embedding API error: ${response.status}`);
                    // Return zero vectors on failure
                    for (let j = 0; j < batch.length; j++) {
                        results.push(new Float32Array(EMBEDDING_DIMS));
                    }
                    continue;
                }
                const data = await response.json();
                const embeddings = data.embeddings || [];
                for (let j = 0; j < batch.length; j++) {
                    if (embeddings[j]?.values) {
                        results.push(new Float32Array(embeddings[j].values));
                    }
                    else {
                        results.push(new Float32Array(EMBEDDING_DIMS));
                    }
                }
            }
            catch (err) {
                console.log(`[SemanticVectorStore] Embedding batch failed: ${err.message}`);
                for (let j = 0; j < batch.length; j++) {
                    results.push(new Float32Array(EMBEDDING_DIMS));
                }
            }
        }
        return results;
    }
    async indexChunks(clientId, documentId, chunks) {
        const texts = chunks.map(c => c.content);
        const embeddings = await this.batchEmbed(texts);
        const insert = this.db.prepare(`
      INSERT OR REPLACE INTO semantic_chunks (id, client_id, document_id, content, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        const now = Date.now();
        const transaction = this.db.transaction(() => {
            for (let i = 0; i < chunks.length; i++) {
                const buf = Buffer.from(embeddings[i].buffer);
                insert.run(chunks[i].id, clientId, documentId, chunks[i].content, buf, JSON.stringify(chunks[i].metadata), now);
            }
        });
        transaction();
        return chunks.length;
    }
    async search(clientId, query, topK = 5) {
        const [queryEmbedding] = await this.batchEmbed([query]);
        // Check if embedding is all zeros (API failure)
        const isZero = queryEmbedding.every(v => v === 0);
        if (isZero)
            return [];
        const rows = this.db.prepare('SELECT id, document_id, client_id, content, embedding, metadata FROM semantic_chunks WHERE client_id = ?').all(clientId);
        if (rows.length === 0)
            return [];
        const scored = [];
        for (const row of rows) {
            const chunkEmb = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
            const score = cosineSimilarity(queryEmbedding, chunkEmb);
            if (score > 0.1) {
                scored.push({ row, score });
            }
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK).map(({ row, score }) => ({
            id: row.id,
            documentId: row.document_id,
            clientId: row.client_id,
            content: row.content,
            metadata: JSON.parse(row.metadata),
            score,
        }));
    }
    removeDocument(documentId) {
        const result = this.db.prepare('DELETE FROM semantic_chunks WHERE document_id = ?').run(documentId);
        return result.changes;
    }
    getChunkCount(clientId) {
        const row = this.db.prepare('SELECT COUNT(*) as count FROM semantic_chunks WHERE client_id = ?').get(clientId);
        return row.count;
    }
    close() {
        this.db.close();
    }
}
exports.SemanticVectorStore = SemanticVectorStore;
function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const mag = Math.sqrt(magA) * Math.sqrt(magB);
    return mag === 0 ? 0 : dot / mag;
}
//# sourceMappingURL=semantic-vector-store.js.map