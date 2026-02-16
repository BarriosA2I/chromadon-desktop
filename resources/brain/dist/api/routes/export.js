"use strict";
/**
 * Analytics Data Export — CSV Endpoints
 *
 * Streams missions, LLM costs, and posts as CSV downloads.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExportRouter = void 0;
const express_1 = require("express");
// Lazy-load better-sqlite3
let Database = null;
function getDatabase() {
    if (!Database)
        Database = require('better-sqlite3');
    return Database;
}
function toCsvRow(values) {
    return values.map(v => {
        if (v === null || v === undefined)
            return '';
        const str = String(v);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(',');
}
function createExportRouter(dbPath) {
    const router = (0, express_1.Router)();
    function openDb() {
        const Db = getDatabase();
        const db = new Db(dbPath, { readonly: true });
        db.pragma('journal_mode = WAL');
        return db;
    }
    // Export missions as CSV
    router.get('/missions/csv/:clientId', (req, res) => {
        try {
            const db = openDb();
            const rows = db.prepare('SELECT id, type, status, client_id, error, created_at, updated_at, completed_at FROM missions WHERE client_id = ? ORDER BY created_at DESC').all(req.params.clientId);
            db.close();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="missions-${req.params.clientId}.csv"`);
            res.write('id,type,status,client_id,error,created_at,updated_at,completed_at\n');
            for (const r of rows) {
                res.write(toCsvRow([r.id, r.type, r.status, r.client_id, r.error, r.created_at, r.updated_at, r.completed_at]) + '\n');
            }
            res.end();
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Export LLM costs as CSV
    router.get('/costs/csv/:clientId', (req, res) => {
        try {
            const db = openDb();
            const rows = db.prepare('SELECT id, client_id, mission_id, model, provider, input_tokens, output_tokens, cost_usd, timestamp FROM llm_costs WHERE client_id = ? ORDER BY timestamp DESC').all(req.params.clientId);
            db.close();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="costs-${req.params.clientId}.csv"`);
            res.write('id,client_id,mission_id,model,provider,input_tokens,output_tokens,cost_usd,timestamp\n');
            for (const r of rows) {
                res.write(toCsvRow([r.id, r.client_id, r.mission_id, r.model, r.provider, r.input_tokens, r.output_tokens, r.cost_usd, r.timestamp]) + '\n');
            }
            res.end();
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Export posts as CSV
    router.get('/posts/csv/:clientId', (req, res) => {
        try {
            const db = openDb();
            // posts table may not have client_id — export all posts
            const rows = db.prepare('SELECT id, platform, post_type, content, hashtags, media_urls, published_at, status FROM posts ORDER BY published_at DESC LIMIT 1000').all();
            db.close();
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="posts-export.csv"`);
            res.write('id,platform,post_type,content,hashtags,media_urls,published_at,status\n');
            for (const r of rows) {
                res.write(toCsvRow([r.id, r.platform, r.post_type, r.content, r.hashtags, r.media_urls, r.published_at, r.status]) + '\n');
            }
            res.end();
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
exports.createExportRouter = createExportRouter;
//# sourceMappingURL=export.js.map