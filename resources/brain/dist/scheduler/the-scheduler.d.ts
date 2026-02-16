/**
 * THE_SCHEDULER (Agent 0.2) — Tier 0 Orchestration
 *
 * Zero-cost when idle. The tick loop is pure Date.now() comparisons.
 * NO LLM calls, NO API calls, NO credits spent until a task is actually due.
 *
 * At execution time, feeds the stored NL instruction into orchestrator.chat()
 * with a CollectorWriter — the same pipeline the user's chat uses.
 * This means anything the AI can do interactively, it can do on schedule.
 *
 * @author Barrios A2I
 */
import { ScheduledTask, TaskType, SchedulerStatus } from './scheduler-types';
type AgenticOrchestrator = {
    chat(sessionId: string | undefined, userMessage: string, writer: SSEWriter, context: any, pageContext?: any, options?: {
        systemPromptOverride?: string;
    }): Promise<void>;
};
interface SSEWriter {
    writeEvent(event: string, data: any): void;
    close(): void;
    isClosed(): boolean;
}
interface SocialMonitor {
    getStatus(): {
        running: boolean;
    };
}
export interface SchedulerConfig {
    tickIntervalMs: number;
    maxConcurrent: number;
    desktopHealthTimeoutMs: number;
    monitorCoordinationWaitMs: number;
    maxMonitorWaitMs: number;
}
export declare class TheScheduler {
    private readonly orchestrator;
    private readonly contextFactory;
    private readonly desktopUrl;
    private readonly socialMonitor?;
    private readonly persistence;
    private readonly config;
    private state;
    private tickInterval;
    private isExecuting;
    private destroyed;
    constructor(orchestrator: AgenticOrchestrator, contextFactory: () => Promise<{
        context: any;
        pageContext?: any;
    }>, desktopUrl: string, socialMonitor?: SocialMonitor, config?: Partial<SchedulerConfig>);
    start(): void;
    stop(): void;
    destroy(): void;
    /**
     * Called every 10s. Pure JS comparisons — ZERO LLM cost when idle.
     * Only starts spending credits when a task is actually due.
     */
    private tick;
    private executeDueTasks;
    private executeTask;
    private failTask;
    private generateNextOccurrence;
    private checkDesktopHealth;
    private coordinateWithMonitor;
    addTask(params: {
        instruction: string;
        taskType?: TaskType;
        scheduledTimeUtc: string;
        recurrence?: string;
        recurrenceEndDate?: string;
        platforms?: string[];
        content?: string;
        hashtags?: string[];
        mediaUrls?: string[];
        batchId?: string;
        batchSequence?: number;
    }): string;
    cancelTask(taskId: string): boolean;
    cancelAllTasks(statusFilter?: string): {
        cancelled: number;
        failed: string[];
    };
    rescheduleTask(taskId: string, newTimeUtc: string): boolean;
    getTasks(filter?: {
        status?: string;
        taskType?: string;
    }): ScheduledTask[];
    getStatus(): SchedulerStatus;
    /**
     * Pre-generate post content via direct LLM call.
     * This runs BEFORE browser actions so the AI doesn't need to "think" about
     * content while also doing click/type/upload actions.
     */
    private preGenerateContent;
    /**
     * Build a browser-only instruction with pre-generated content.
     * The AI just needs to navigate, upload media, type the text, and post.
     */
    private buildPostingInstruction;
    private persist;
}
export {};
//# sourceMappingURL=the-scheduler.d.ts.map