/**
 * Social Media Overlord - Queue Execution Engine
 * ================================================
 * Bridges the Desktop Marketing Queue to the Agentic Orchestrator.
 * Converts queue tasks into platform-specific prompts, feeds them to
 * the orchestrator's Claude tool-use loop, and reports results.
 *
 * @author Barrios A2I
 */
import { AgenticOrchestrator, type SSEWriter } from './agentic-orchestrator';
import type { ExecutionContext } from './browser-tools';
import type { PageContext } from './ai-engine-v3';
export interface QueueTask {
    id: string;
    platform: string;
    action: string;
    content?: string;
    targetUrl?: string;
    priority: number;
    status: 'queued' | 'running' | 'completed' | 'failed';
    mediaUrls?: string[];
    scheduledTime?: string;
    hashtags?: string[];
    mentions?: string[];
    customInstructions?: string;
}
export interface TaskResult {
    taskId: string;
    success: boolean;
    summary: string;
    toolCalls: number;
    durationMs: number;
    error?: string;
}
export type TaskProgressCallback = (taskId: string, status: string, message?: string) => void;
export declare class SocialOverlord {
    private orchestrator;
    private contextFactory;
    constructor(orchestrator: AgenticOrchestrator, contextFactory: () => Promise<{
        context: ExecutionContext;
        pageContext?: PageContext;
    }>);
    /**
     * Process a single queue task (non-streaming, returns result).
     */
    processTask(task: QueueTask): Promise<TaskResult>;
    /**
     * Process a single task with full SSE streaming (same format as orchestrator).
     * Wraps the orchestrator's SSE writer and adds task-level events.
     */
    processTaskStreaming(task: QueueTask, writer: SSEWriter): Promise<TaskResult>;
    /**
     * Process all queued tasks sequentially with SSE progress reporting.
     * Tasks are sorted by priority (highest first).
     */
    processQueue(tasks: QueueTask[], writer: SSEWriter, onProgress?: TaskProgressCallback): Promise<TaskResult[]>;
}
//# sourceMappingURL=social-overlord.d.ts.map