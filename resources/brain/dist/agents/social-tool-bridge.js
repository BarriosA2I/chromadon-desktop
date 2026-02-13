"use strict";
/**
 * SocialMediaToolBridge — Typed wrapper around SocialOverlord
 * ============================================================
 * Provides the CortexRouter with direct access to social media posting,
 * content generation, and platform interactions. Wraps the existing
 * SocialOverlord (which handles platform prompts + Claude tool-use loop).
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocialMediaToolBridge = exports.TrinityStub = void 0;
const event_bus_1 = require("./event-bus");
/** No-op stub — returns empty results until Trinity is integrated */
class TrinityStub {
    async getCompetitorContent() { return []; }
    async getTrendingTopics() { return []; }
    async getOptimalPostingTime() { return 'now'; }
    async getAudienceInsights() { return {}; }
}
exports.TrinityStub = TrinityStub;
// ============================================================================
// SOCIAL MEDIA TOOL BRIDGE
// ============================================================================
class SocialMediaToolBridge {
    socialOverlord;
    trinity;
    constructor(socialOverlord, trinity) {
        this.socialOverlord = socialOverlord;
        this.trinity = trinity || new TrinityStub();
    }
    /**
     * Execute a social media task with SSE streaming.
     * Builds a QueueTask from the parsed intent, delegates to SocialOverlord.
     */
    async executeStreaming(task, writer) {
        const eventBus = (0, event_bus_1.getEventBus)();
        const start = Date.now();
        const taskId = `social-${task.platform}-${task.action}-${start}`;
        eventBus.publish({
            type: 'ACTION_PERFORMED',
            source: 'THE_CORTEX',
            correlationId: taskId,
            payload: { action: 'social.bridge.execute', platform: task.platform, socialAction: task.action },
        });
        const queueTask = {
            id: taskId,
            platform: task.platform,
            action: task.action,
            content: task.content,
            targetUrl: task.targetUrl,
            priority: 5,
            status: 'queued',
            hashtags: task.hashtags,
            mentions: task.mentions,
            customInstructions: task.customInstructions,
        };
        try {
            const result = await this.socialOverlord.processTaskStreaming(queueTask, writer);
            eventBus.publish({
                type: 'STEP_COMPLETED',
                source: 'THE_CORTEX',
                correlationId: taskId,
                payload: {
                    action: 'social.bridge.execute',
                    platform: task.platform,
                    durationMs: Date.now() - start,
                    success: result.success,
                },
            });
            return result;
        }
        catch (error) {
            eventBus.publish({
                type: 'AGENT_ERROR',
                source: 'THE_CORTEX',
                correlationId: taskId,
                payload: {
                    action: 'social.bridge.execute',
                    platform: task.platform,
                    error: error.message,
                    durationMs: Date.now() - start,
                },
            });
            throw error;
        }
    }
    /**
     * Execute a social media task without streaming (returns result directly).
     */
    async execute(task) {
        const queueTask = {
            id: `social-${task.platform}-${task.action}-${Date.now()}`,
            platform: task.platform,
            action: task.action,
            content: task.content,
            targetUrl: task.targetUrl,
            priority: 5,
            status: 'queued',
            hashtags: task.hashtags,
            mentions: task.mentions,
            customInstructions: task.customInstructions,
        };
        return this.socialOverlord.processTask(queueTask);
    }
    // === Typed convenience methods ===
    async post(platform, content, writer) {
        return this.executeStreaming({ platform, action: 'post', content }, writer);
    }
    async comment(platform, content, targetUrl, writer) {
        return this.executeStreaming({ platform, action: 'comment', content, targetUrl }, writer);
    }
    async like(platform, targetUrl, writer) {
        return this.executeStreaming({ platform, action: 'like', targetUrl }, writer);
    }
    async follow(platform, targetUrl, writer) {
        return this.executeStreaming({ platform, action: 'follow', targetUrl }, writer);
    }
    async search(platform, query, writer) {
        return this.executeStreaming({ platform, action: 'search', content: query }, writer);
    }
    async scrape(platform, targetUrl, writer) {
        return this.executeStreaming({ platform, action: 'scrape', targetUrl }, writer);
    }
}
exports.SocialMediaToolBridge = SocialMediaToolBridge;
//# sourceMappingURL=social-tool-bridge.js.map