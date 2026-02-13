"use strict";
/**
 * Social Media Overlord - Queue Execution Engine
 * ================================================
 * Bridges the Desktop Marketing Queue to the Agentic Orchestrator.
 * Converts queue tasks into platform-specific prompts, feeds them to
 * the orchestrator's Claude tool-use loop, and reports results.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialOverlord = void 0;
const social_collector_writer_1 = require("./social-collector-writer");
const social_prompts_1 = require("./social-prompts");
// ============================================================================
// SOCIAL OVERLORD
// ============================================================================
class SocialOverlord {
    orchestrator;
    contextFactory;
    constructor(orchestrator, contextFactory) {
        this.orchestrator = orchestrator;
        this.contextFactory = contextFactory;
    }
    /**
     * Process a single queue task (non-streaming, returns result).
     */
    async processTask(task) {
        const startMs = Date.now();
        try {
            // Generate the platform-specific prompt
            const prompt = (0, social_prompts_1.generateSocialPrompt)({
                platform: task.platform,
                action: task.action,
                content: task.content,
                targetUrl: task.targetUrl,
                hashtags: task.hashtags,
                mentions: task.mentions,
                customInstructions: task.customInstructions,
            });
            // Build fresh execution context
            const { context, pageContext } = await this.contextFactory();
            // Use a collector writer to capture the orchestrator's output
            const collector = new social_collector_writer_1.CollectorWriter();
            // Run the orchestrator with no sessionId (fresh session per task)
            await this.orchestrator.chat(undefined, prompt, collector, context, pageContext);
            const durationMs = Date.now() - startMs;
            // Check for errors in the collected events
            const errorEvents = collector.events.filter((e) => e.event === 'error');
            const hasError = errorEvents.length > 0;
            return {
                taskId: task.id,
                success: !hasError,
                summary: collector.getSummary(),
                toolCalls: collector.toolResults.length,
                durationMs,
                error: hasError ? errorEvents.map((e) => e.data.message).join('; ') : undefined,
            };
        }
        catch (error) {
            return {
                taskId: task.id,
                success: false,
                summary: '',
                toolCalls: 0,
                durationMs: Date.now() - startMs,
                error: error.message || 'Unknown error',
            };
        }
    }
    /**
     * Process a single task with full SSE streaming (same format as orchestrator).
     * Wraps the orchestrator's SSE writer and adds task-level events.
     */
    async processTaskStreaming(task, writer) {
        const startMs = Date.now();
        try {
            writer.writeEvent('task_start', {
                taskId: task.id,
                platform: task.platform,
                action: task.action,
            });
            const prompt = (0, social_prompts_1.generateSocialPrompt)({
                platform: task.platform,
                action: task.action,
                content: task.content,
                targetUrl: task.targetUrl,
                hashtags: task.hashtags,
                mentions: task.mentions,
                customInstructions: task.customInstructions,
            });
            const { context, pageContext } = await this.contextFactory();
            // Create a tracking wrapper that counts tool calls
            let toolCallCount = 0;
            let hasError = false;
            let errorMsg = '';
            let fullText = '';
            const trackingWriter = {
                writeEvent(event, data) {
                    if (event === 'tool_result')
                        toolCallCount++;
                    if (event === 'error') {
                        hasError = true;
                        errorMsg = data.message;
                    }
                    if (event === 'text_delta' && data.text)
                        fullText += data.text;
                    // Forward everything except session_id and done (we handle those)
                    if (event !== 'session_id' && event !== 'done') {
                        writer.writeEvent(event, data);
                    }
                },
                close() { writer.close(); },
                isClosed() { return writer.isClosed(); },
            };
            await this.orchestrator.chat(undefined, prompt, trackingWriter, context, pageContext);
            const durationMs = Date.now() - startMs;
            const result = {
                taskId: task.id,
                success: !hasError,
                summary: fullText || 'Task completed.',
                toolCalls: toolCallCount,
                durationMs,
                error: hasError ? errorMsg : undefined,
            };
            writer.writeEvent('task_complete', {
                taskId: task.id,
                success: result.success,
                summary: result.summary.slice(0, 500),
                toolCalls: result.toolCalls,
                durationMs: result.durationMs,
            });
            return result;
        }
        catch (error) {
            const durationMs = Date.now() - startMs;
            const result = {
                taskId: task.id,
                success: false,
                summary: '',
                toolCalls: 0,
                durationMs,
                error: error.message || 'Unknown error',
            };
            if (!writer.isClosed()) {
                writer.writeEvent('task_complete', {
                    taskId: task.id,
                    success: false,
                    error: result.error,
                    durationMs,
                });
            }
            return result;
        }
    }
    /**
     * Process all queued tasks sequentially with SSE progress reporting.
     * Tasks are sorted by priority (highest first).
     */
    async processQueue(tasks, writer, onProgress) {
        const startMs = Date.now();
        const results = [];
        // Sort by priority descending (highest priority first)
        const sorted = [...tasks].sort((a, b) => b.priority - a.priority);
        for (const task of sorted) {
            if (writer.isClosed())
                break;
            onProgress?.(task.id, 'processing', `Processing ${task.platform} ${task.action}`);
            writer.writeEvent('task_start', {
                taskId: task.id,
                platform: task.platform,
                action: task.action,
                index: results.length + 1,
                total: sorted.length,
            });
            const result = await this.processTask(task);
            results.push(result);
            const status = result.success ? 'completed' : 'failed';
            onProgress?.(task.id, status, result.summary);
            if (!writer.isClosed()) {
                writer.writeEvent('task_complete', {
                    taskId: task.id,
                    success: result.success,
                    summary: result.summary.slice(0, 500),
                    toolCalls: result.toolCalls,
                    durationMs: result.durationMs,
                    error: result.error,
                });
            }
        }
        const totalDurationMs = Date.now() - startMs;
        const succeeded = results.filter((r) => r.success).length;
        if (!writer.isClosed()) {
            writer.writeEvent('all_complete', {
                total: results.length,
                succeeded,
                failed: results.length - succeeded,
                totalDurationMs,
            });
        }
        return results;
    }
}
exports.SocialOverlord = SocialOverlord;
//# sourceMappingURL=social-overlord.js.map