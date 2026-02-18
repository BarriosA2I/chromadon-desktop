/**
 * ACTIVITY LOG — Append-only JSONL Activity Journal
 *
 * Crash-safe: each log() call is a single appendFileSync — no buffering.
 * One file per day at ~/.chromadon/activity/YYYY-MM-DD.jsonl
 * 30-day retention with auto-prune on startup.
 *
 * @author Barrios A2I
 */
import { ActivityEntry, ActivitySummary } from './activity-types';
export declare class ActivityLog {
    private readonly activityDir;
    constructor(dataDir?: string);
    /**
     * Append a single activity entry to today's JSONL file.
     * Crash-safe: appendFileSync ensures each line is flushed to disk.
     */
    log(entry: Omit<ActivityEntry, 'timestamp'>): void;
    /**
     * Get today's activity entries.
     */
    getToday(): ActivityEntry[];
    /**
     * Get today's entries with context guard (Fix #3).
     * If >50 entries, returns summary string instead of raw array.
     */
    getTodayGuarded(): string;
    /**
     * Get activity entries for a date range (inclusive).
     * Dates should be YYYY-MM-DD format.
     */
    getRange(startDate: string, endDate: string): ActivityEntry[];
    /**
     * Get range with context guard (Fix #3).
     */
    getRangeGuarded(startDate: string, endDate: string): string;
    /**
     * Filter entries by missionId (for proof of work).
     */
    getByMissionId(missionId: string, startDate?: string): ActivityEntry[];
    /**
     * Create a compact summary of activity entries (for context guard).
     * Groups by action, counts by status, extracts platforms.
     */
    summarize(entries: ActivityEntry[]): ActivitySummary;
    /**
     * Delete JSONL files older than 30 days. Called on startup.
     */
    pruneOldFiles(): void;
    private todayDateStr;
    private getFilePath;
    private readFile;
}
//# sourceMappingURL=activity-log.d.ts.map