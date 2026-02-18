/**
 * ACTIVITY LOG — Type Definitions
 *
 * Append-only JSONL activity journal for tracking what CHROMADON does.
 * One file per day at ~/.chromadon/activity/YYYY-MM-DD.jsonl
 *
 * @author Barrios A2I
 */
export interface ActivityEntry {
    /** ISO 8601 timestamp (auto-set by ActivityLog.log()) */
    timestamp: string;
    /** Action category: 'post_published', 'navigation', 'skill_learned', 'mission_completed', etc. */
    action: string;
    /** Human-readable description: "Posted to Instagram ✅" */
    details: string;
    /** Tool that triggered this activity (optional) */
    toolName?: string;
    /** Associated mission ID (optional) */
    missionId?: string;
    /** Social platform if applicable (optional) */
    platform?: string;
    /** Duration in milliseconds if timed (optional) */
    durationMs?: number;
    /** Outcome status */
    status: 'success' | 'warning' | 'error' | 'info';
}
export interface ActivitySummary {
    date: string;
    totalEntries: number;
    topActions: Array<{
        action: string;
        count: number;
    }>;
    platforms: string[];
    successCount: number;
    warningCount: number;
    errorCount: number;
    infoCount: number;
    firstEntry: string;
    lastEntry: string;
}
//# sourceMappingURL=activity-types.d.ts.map