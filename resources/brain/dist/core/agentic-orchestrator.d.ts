/**
 * CHROMADON Agentic Orchestrator
 * ==============================
 * Claude Code-like agentic loop for browser automation.
 * Uses Claude's native tool_use API with streaming SSE.
 *
 * Flow:
 *   User message -> Claude API (streaming) -> text + tool_use blocks
 *   -> Execute tools -> Send tool_result -> Claude continues
 *   -> Repeat until stop_reason === "end_turn"
 *
 * @author Barrios A2I
 */
import Anthropic from '@anthropic-ai/sdk';
import { type ToolExecutor, type ExecutionContext, type ToolDefinition } from './browser-tools';
import type { PageContext } from './ai-engine-v3';
export interface VideoTracker {
    allVideoIds: string[];
    processedIds: string[];
    skippedIds: string[];
    failedIds: string[];
    currentVideoId: string;
    claimsErased: number;
}
export interface OrchestratorSession {
    id: string;
    messages: Anthropic.MessageParam[];
    createdAt: number;
    lastActivityAt: number;
    videoTracker: VideoTracker;
}
export interface SSEWriter {
    writeEvent(event: string, data: any): void;
    close(): void;
    isClosed(): boolean;
}
export interface OrchestratorConfig {
    model?: string;
    maxTokens?: number;
    maxLoops?: number;
    maxSessionMessages?: number;
    sessionTimeoutMs?: number;
}
export type AdditionalToolExecutor = (toolName: string, input: Record<string, any>) => string | Promise<string>;
export declare class AgenticOrchestrator {
    private client;
    private geminiProvider;
    private useGemini;
    private sessions;
    private toolExecutor;
    private config;
    private pruneInterval;
    private additionalTools;
    private additionalExecutor;
    private additionalToolNames;
    private getSkillsForPrompt;
    private getClientKnowledge;
    constructor(apiKey: string, toolExecutor: ToolExecutor, config?: OrchestratorConfig, additionalTools?: ToolDefinition[], additionalExecutor?: AdditionalToolExecutor, getSkillsForPrompt?: () => string, getClientKnowledge?: () => string | null);
    /**
     * Main entry point - runs the full agentic loop with SSE streaming.
     */
    chat(sessionId: string | undefined, userMessage: string, writer: SSEWriter, context: ExecutionContext, pageContext?: PageContext): Promise<void>;
    getSession(sessionId: string): OrchestratorSession | undefined;
    clearSession(sessionId: string): boolean;
    getSessionCount(): number;
    /**
     * Sanitize conversation history to prevent tool_use/tool_result mismatches.
     * Every tool_result must reference a tool_use in the immediately preceding
     * assistant message, and vice versa. Orphaned blocks are stripped.
     */
    private sanitizeHistory;
    /**
     * Truncate history while preserving tool_use/tool_result pairs.
     * Removes oldest messages first but never breaks a pair.
     */
    private truncateHistory;
    private pruneSessionMessages;
    /**
     * Replace old screenshot image blocks with text placeholders to save context tokens.
     * Walks messages in reverse, keeps the last `keep` image blocks intact,
     * replaces older ones with "[screenshot pruned]".
     */
    private pruneOldScreenshots;
    /**
     * Check if the current page is blank/black via Desktop Control Server.
     */
    private isPageBlank;
    /**
     * Check if the current page is an error page (permission denied, YouTube error, rate limited).
     * These pages have content so isPageBlank() passes — this catches them.
     */
    private isPageErrored;
    /**
     * Silently ensure page is loaded after navigate/click.
     * Auto-refreshes blank pages up to 3 times with escalating waits.
     * Returns null if healthy, or a message if page is dead after all retries.
     */
    private ensurePageHealthy;
    private detectPlatformFromResult;
    private pruneExpiredSessions;
    destroy(): void;
}
//# sourceMappingURL=agentic-orchestrator.d.ts.map