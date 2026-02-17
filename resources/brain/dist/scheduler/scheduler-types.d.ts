/**
 * THE_SCHEDULER (Agent 0.2) — Type Definitions
 *
 * Tier 0 orchestration agent that replaces the Desktop's fragile 30-second
 * checkScheduledTasks() loop. Zero-cost when idle, general-purpose browser
 * automation scheduling.
 *
 * @author Barrios A2I
 */
export declare enum TaskStatus {
    SCHEDULED = "scheduled",
    PENDING = "pending",
    EXECUTING = "executing",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled"
}
export type TaskType = 'social_post' | 'browser_automation' | 'scrape' | 'custom';
export interface ScheduledTask {
    id: string;
    /** Natural language instruction replayed via orchestrator.chat() at execution time */
    instruction: string;
    taskType: TaskType;
    /** Optional structured fields for social posts (backward compat with schedule_post) */
    platform?: string;
    platforms?: string[];
    content?: string;
    hashtags?: string[];
    mediaUrls?: string[];
    /** When to execute (ISO 8601 UTC) */
    scheduledTimeUtc: string;
    recurrence: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
    recurrenceEndDate?: string;
    /** ID of the parent task that spawned this recurrence instance */
    parentTaskId?: string;
    /** Current lifecycle state */
    status: TaskStatus;
    retryCount: number;
    maxRetries: number;
    lastError?: string;
    /** Tracking */
    createdAt: string;
    executedAt?: string;
    completedAt?: string;
    executionDurationMs?: number;
    /** First 500 chars of AI response */
    resultSummary?: string;
    /** Batch grouping for multi-platform posts */
    batchId?: string;
    batchSequence?: number;
    /** Whether this task is enabled (default true). Disabled tasks are skipped by the tick loop. */
    enabled?: boolean;
    /** Consecutive failure count for auto-disable logic (3 failures → auto-disable recurring tasks). */
    consecutiveFailures?: number;
    /** Template ID if created from a mission template. */
    templateId?: string;
}
export interface SchedulerState {
    version: 1;
    tasks: ScheduledTask[];
    lastSavedAt: string;
    stats: {
        totalScheduled: number;
        totalCompleted: number;
        totalFailed: number;
    };
}
export interface SchedulerStatus {
    running: boolean;
    taskCount: number;
    pendingCount: number;
    nextTaskAt: string | null;
    nextTaskDescription: string | null;
    stats: SchedulerState['stats'];
}
export declare function createEmptyState(): SchedulerState;
//# sourceMappingURL=scheduler-types.d.ts.map