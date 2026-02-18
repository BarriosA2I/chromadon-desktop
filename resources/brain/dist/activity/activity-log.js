"use strict";
/**
 * ACTIVITY LOG — Append-only JSONL Activity Journal
 *
 * Crash-safe: each log() call is a single appendFileSync — no buffering.
 * One file per day at ~/.chromadon/activity/YYYY-MM-DD.jsonl
 * 30-day retention with auto-prune on startup.
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
exports.ActivityLog = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('activity');
const RETENTION_DAYS = 30;
const CONTEXT_GUARD_THRESHOLD = 50;
class ActivityLog {
    activityDir;
    constructor(dataDir) {
        const base = dataDir || process.env.CHROMADON_DATA_DIR || path.join(os.homedir(), '.chromadon');
        this.activityDir = path.join(base, 'activity');
        fs.mkdirSync(this.activityDir, { recursive: true });
    }
    // ===========================================================================
    // WRITE
    // ===========================================================================
    /**
     * Append a single activity entry to today's JSONL file.
     * Crash-safe: appendFileSync ensures each line is flushed to disk.
     */
    log(entry) {
        const full = {
            ...entry,
            timestamp: new Date().toISOString(),
        };
        const filePath = this.getFilePath(this.todayDateStr());
        fs.appendFileSync(filePath, JSON.stringify(full) + '\n', 'utf-8');
    }
    // ===========================================================================
    // READ
    // ===========================================================================
    /**
     * Get today's activity entries.
     */
    getToday() {
        return this.readFile(this.todayDateStr());
    }
    /**
     * Get today's entries with context guard (Fix #3).
     * If >50 entries, returns summary string instead of raw array.
     */
    getTodayGuarded() {
        const entries = this.getToday();
        if (entries.length === 0)
            return JSON.stringify({ entries: [], message: 'No activities logged today.' });
        if (entries.length > CONTEXT_GUARD_THRESHOLD) {
            return JSON.stringify(this.summarize(entries));
        }
        return JSON.stringify(entries);
    }
    /**
     * Get activity entries for a date range (inclusive).
     * Dates should be YYYY-MM-DD format.
     */
    getRange(startDate, endDate) {
        const entries = [];
        const start = new Date(startDate + 'T00:00:00Z');
        const end = new Date(endDate + 'T23:59:59Z');
        for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateStr = d.toISOString().slice(0, 10);
            entries.push(...this.readFile(dateStr));
        }
        return entries;
    }
    /**
     * Get range with context guard (Fix #3).
     */
    getRangeGuarded(startDate, endDate) {
        const entries = this.getRange(startDate, endDate);
        if (entries.length === 0)
            return JSON.stringify({ entries: [], message: 'No activities found in that range.' });
        if (entries.length > CONTEXT_GUARD_THRESHOLD) {
            return JSON.stringify(this.summarize(entries));
        }
        return JSON.stringify(entries);
    }
    /**
     * Filter entries by missionId (for proof of work).
     */
    getByMissionId(missionId, startDate) {
        const start = startDate || this.todayDateStr();
        const entries = this.getRange(start, this.todayDateStr());
        return entries.filter(e => e.missionId === missionId);
    }
    // ===========================================================================
    // SUMMARIZE
    // ===========================================================================
    /**
     * Create a compact summary of activity entries (for context guard).
     * Groups by action, counts by status, extracts platforms.
     */
    summarize(entries) {
        const actionCounts = new Map();
        const platforms = new Set();
        let successCount = 0;
        let warningCount = 0;
        let errorCount = 0;
        let infoCount = 0;
        for (const e of entries) {
            actionCounts.set(e.action, (actionCounts.get(e.action) || 0) + 1);
            if (e.platform)
                platforms.add(e.platform);
            switch (e.status) {
                case 'success':
                    successCount++;
                    break;
                case 'warning':
                    warningCount++;
                    break;
                case 'error':
                    errorCount++;
                    break;
                case 'info':
                    infoCount++;
                    break;
            }
        }
        const topActions = Array.from(actionCounts.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        return {
            date: entries[0]?.timestamp?.slice(0, 10) || this.todayDateStr(),
            totalEntries: entries.length,
            topActions,
            platforms: Array.from(platforms),
            successCount,
            warningCount,
            errorCount,
            infoCount,
            firstEntry: entries[0]?.timestamp || '',
            lastEntry: entries[entries.length - 1]?.timestamp || '',
        };
    }
    // ===========================================================================
    // RETENTION
    // ===========================================================================
    /**
     * Delete JSONL files older than 30 days. Called on startup.
     */
    pruneOldFiles() {
        try {
            const files = fs.readdirSync(this.activityDir).filter(f => f.endsWith('.jsonl'));
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
            const cutoffStr = cutoff.toISOString().slice(0, 10);
            let pruned = 0;
            for (const file of files) {
                const dateStr = file.replace('.jsonl', '');
                if (dateStr < cutoffStr) {
                    fs.unlinkSync(path.join(this.activityDir, file));
                    pruned++;
                }
            }
            if (pruned > 0) {
                log.info(`[ActivityLog] Pruned ${pruned} files older than ${RETENTION_DAYS} days`);
            }
        }
        catch (err) {
            log.error(`[ActivityLog] Prune error: ${err.message}`);
        }
    }
    // ===========================================================================
    // INTERNAL
    // ===========================================================================
    todayDateStr() {
        return new Date().toISOString().slice(0, 10);
    }
    getFilePath(dateStr) {
        return path.join(this.activityDir, `${dateStr}.jsonl`);
    }
    readFile(dateStr) {
        const filePath = this.getFilePath(dateStr);
        if (!fs.existsSync(filePath))
            return [];
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim());
            const entries = [];
            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line));
                }
                catch {
                    // Skip malformed lines
                }
            }
            return entries;
        }
        catch {
            return [];
        }
    }
}
exports.ActivityLog = ActivityLog;
//# sourceMappingURL=activity-log.js.map