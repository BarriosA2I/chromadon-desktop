"use strict";
/**
 * MissionRegistry — SQLite-backed Mission Tracker
 *
 * Persists all agent missions (scheduled posts, RALPH loops, chat sessions,
 * warmups, onboarding, cortex plans). Survives Brain restarts via zombie cleanup.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionRegistry = void 0;
const uuid_1 = require("uuid");
// Lazy-load better-sqlite3 (same pattern as analytics/database.ts)
let Database = null;
function getDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    return Database;
}
class MissionRegistry {
    db; // better-sqlite3.Database
    constructor(dbPath) {
        const Db = getDatabase();
        this.db = new Db(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initSchema();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        client_id TEXT NOT NULL,
        context TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_missions_status_client ON missions(status, client_id);
      CREATE INDEX IF NOT EXISTS idx_missions_updated ON missions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_missions_type ON missions(type);
      CREATE INDEX IF NOT EXISTS idx_missions_client_created ON missions(client_id, created_at);
    `);
    }
    create(type, context) {
        const id = (0, uuid_1.v4)();
        const now = Date.now();
        this.db.prepare(`
      INSERT INTO missions (id, type, status, client_id, context, created_at, updated_at)
      VALUES (?, ?, 'QUEUED', ?, ?, ?, ?)
    `).run(id, type, context.clientId, JSON.stringify(context), now, now);
        console.log(`[MissionRegistry] Created ${type} mission ${id} for client ${context.clientId}`);
        return id;
    }
    updateStatus(id, status, error) {
        const now = Date.now();
        const isTerminal = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
        this.db.prepare(`
      UPDATE missions
      SET status = ?, error = ?, updated_at = ?, completed_at = CASE WHEN ? THEN ? ELSE completed_at END
      WHERE id = ?
    `).run(status, error || null, now, isTerminal ? 1 : 0, isTerminal ? now : null, id);
    }
    updateResult(id, result) {
        const now = Date.now();
        this.db.prepare(`
      UPDATE missions SET result = ?, updated_at = ? WHERE id = ?
    `).run(JSON.stringify(result), now, id);
    }
    get(id) {
        const row = this.db.prepare('SELECT * FROM missions WHERE id = ?').get(id);
        return row ? this.mapRow(row) : undefined;
    }
    listActive(clientId) {
        const rows = this.db.prepare(`
      SELECT * FROM missions
      WHERE client_id = ? AND status IN ('QUEUED', 'APPROVED', 'EXECUTING', 'CHECKPOINT')
      ORDER BY created_at DESC
    `).all(clientId);
        return rows.map((r) => this.mapRow(r));
    }
    listByClient(clientId, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM missions WHERE client_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(clientId, limit);
        return rows.map((r) => this.mapRow(r));
    }
    listByStatus(status, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM missions WHERE status = ? ORDER BY created_at DESC LIMIT ?
    `).all(status, limit);
        return rows.map((r) => this.mapRow(r));
    }
    listByType(type, limit = 50) {
        const rows = this.db.prepare(`
      SELECT * FROM missions WHERE type = ? ORDER BY created_at DESC LIMIT ?
    `).all(type, limit);
        return rows.map((r) => this.mapRow(r));
    }
    failZombies() {
        const now = Date.now();
        const info = this.db.prepare(`
      UPDATE missions
      SET status = 'FAILED', error = 'Brain restart — zombie cleanup', updated_at = ?, completed_at = ?
      WHERE status IN ('EXECUTING', 'CHECKPOINT')
    `).run(now, now);
        if (info.changes > 0) {
            console.log(`[MissionRegistry] Cleaned up ${info.changes} zombie mission(s)`);
        }
        return info.changes;
    }
    getStats() {
        const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('QUEUED','APPROVED','EXECUTING','CHECKPOINT') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
      FROM missions
    `).get();
        return {
            total: row.total || 0,
            active: row.active || 0,
            completed: row.completed || 0,
            failed: row.failed || 0,
            cancelled: row.cancelled || 0,
        };
    }
    getClientStats(clientId) {
        const row = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('QUEUED','APPROVED','EXECUTING','CHECKPOINT') THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled
      FROM missions WHERE client_id = ?
    `).get(clientId);
        return {
            total: row.total || 0,
            active: row.active || 0,
            completed: row.completed || 0,
            failed: row.failed || 0,
            cancelled: row.cancelled || 0,
        };
    }
    close() {
        this.db.close();
    }
    mapRow(row) {
        return {
            id: row.id,
            type: row.type,
            status: row.status,
            clientId: row.client_id,
            context: JSON.parse(row.context),
            result: row.result ? JSON.parse(row.result) : undefined,
            error: row.error || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            completedAt: row.completed_at || undefined,
        };
    }
}
exports.MissionRegistry = MissionRegistry;
//# sourceMappingURL=mission-registry.js.map