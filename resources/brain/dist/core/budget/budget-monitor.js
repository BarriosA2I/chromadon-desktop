"use strict";
/**
 * LLM Budget Monitor — Per-client Cost Tracking
 *
 * Tracks token usage and costs across Gemini/Anthropic models.
 * SQLite-backed for persistence. Shares analytics.db path.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetMonitor = void 0;
// Lazy-load better-sqlite3
let Database = null;
function getDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    return Database;
}
/** Cost per 1K tokens (input/output) by model */
const MODEL_COSTS = {
    // Gemini models
    'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },
    'gemini-2.5-flash': { input: 0.00015, output: 0.0006 },
    'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
    // Anthropic fallback models
    'claude-haiku-4-5-20251001': { input: 0.00025, output: 0.00125 },
    'claude-haiku-4-5-20251001': { input: 0.0008, output: 0.004 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-sonnet-4-5-20250929': { input: 0.003, output: 0.015 },
};
class BudgetMonitor {
    db;
    taskLimitUsd;
    constructor(dbPath, taskLimitUsd = 10) {
        const Db = getDatabase();
        this.db = new Db(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.taskLimitUsd = taskLimitUsd;
        this.initSchema();
    }
    initSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_costs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id TEXT NOT NULL,
        mission_id TEXT,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        timestamp INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_costs_client ON llm_costs(client_id);
      CREATE INDEX IF NOT EXISTS idx_costs_mission ON llm_costs(mission_id);
      CREATE INDEX IF NOT EXISTS idx_costs_timestamp ON llm_costs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_costs_provider ON llm_costs(provider);
    `);
    }
    calculateCost(model, inputTokens, outputTokens) {
        const rates = MODEL_COSTS[model];
        if (!rates) {
            // Unknown model — estimate conservatively
            return ((inputTokens * 0.001) + (outputTokens * 0.004)) / 1000;
        }
        return ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1000;
    }
    recordUsage(entry) {
        const cost = entry.costUsd || this.calculateCost(entry.model, entry.inputTokens, entry.outputTokens);
        this.db.prepare(`
      INSERT INTO llm_costs (client_id, mission_id, model, provider, input_tokens, output_tokens, cost_usd, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.clientId, entry.missionId || null, entry.model, entry.provider, entry.inputTokens, entry.outputTokens, cost, Date.now());
        if (entry.missionId && this.isOverBudget(entry.missionId)) {
            console.log(`[BudgetMonitor] WARNING: Mission ${entry.missionId} exceeded $${this.taskLimitUsd} budget`);
        }
    }
    getMissionCost(missionId) {
        const row = this.db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM llm_costs WHERE mission_id = ?').get(missionId);
        return row.total;
    }
    getClientCost(clientId, sinceMs) {
        const since = sinceMs || (Date.now() - 24 * 60 * 60 * 1000); // 24h default
        const row = this.db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM llm_costs WHERE client_id = ? AND timestamp >= ?').get(clientId, since);
        return row.total;
    }
    isOverBudget(missionId) {
        return this.getMissionCost(missionId) >= this.taskLimitUsd;
    }
    getGlobalStats(sinceMs) {
        const since = sinceMs || (Date.now() - 24 * 60 * 60 * 1000);
        const totals = this.db.prepare(`
      SELECT COALESCE(SUM(cost_usd), 0) as totalCost,
             COALESCE(SUM(input_tokens + output_tokens), 0) as totalTokens,
             COUNT(*) as requestCount
      FROM llm_costs WHERE timestamp >= ?
    `).get(since);
        const byModel = this.db.prepare(`
      SELECT model, COALESCE(SUM(cost_usd), 0) as cost
      FROM llm_costs WHERE timestamp >= ? GROUP BY model
    `).all(since);
        const byClient = this.db.prepare(`
      SELECT client_id, COALESCE(SUM(cost_usd), 0) as cost
      FROM llm_costs WHERE timestamp >= ? GROUP BY client_id
    `).all(since);
        const costByModel = {};
        for (const r of byModel)
            costByModel[r.model] = r.cost;
        const costByClient = {};
        for (const r of byClient)
            costByClient[r.client_id] = r.cost;
        return {
            totalCost: totals.totalCost,
            totalTokens: totals.totalTokens,
            requestCount: totals.requestCount,
            costByModel,
            costByClient,
        };
    }
    getFallbackStats(sinceMs) {
        const since = sinceMs || (Date.now() - 24 * 60 * 60 * 1000);
        const stats = this.db.prepare(`
      SELECT provider,
             COUNT(*) as calls,
             COALESCE(SUM(cost_usd), 0) as cost
      FROM llm_costs WHERE timestamp >= ? GROUP BY provider
    `).all(since);
        let geminiCalls = 0, geminiCost = 0, anthropicCalls = 0, anthropicCost = 0;
        for (const s of stats) {
            if (s.provider === 'gemini') {
                geminiCalls = s.calls;
                geminiCost = s.cost;
            }
            if (s.provider === 'anthropic') {
                anthropicCalls = s.calls;
                anthropicCost = s.cost;
            }
        }
        const total = geminiCalls + anthropicCalls;
        return {
            geminiCalls,
            geminiCost,
            anthropicCalls,
            anthropicCost,
            fallbackRate: total > 0 ? anthropicCalls / total : 0,
        };
    }
    close() {
        this.db.close();
    }
}
exports.BudgetMonitor = BudgetMonitor;
//# sourceMappingURL=budget-monitor.js.map