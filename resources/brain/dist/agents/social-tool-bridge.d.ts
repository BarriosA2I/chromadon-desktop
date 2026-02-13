/**
 * SocialMediaToolBridge — Typed wrapper around SocialOverlord
 * ============================================================
 * Provides the CortexRouter with direct access to social media posting,
 * content generation, and platform interactions. Wraps the existing
 * SocialOverlord (which handles platform prompts + Claude tool-use loop).
 *
 * @author Barrios A2I
 */
import { SocialOverlord, type TaskResult } from '../core/social-overlord';
import type { SocialPlatform, SocialAction } from '../core/social-prompts';
import type { SSEWriter } from '../core/agentic-orchestrator';
export interface ParsedSocialTask {
    platform: SocialPlatform;
    action: SocialAction;
    content?: string;
    targetUrl?: string;
    hashtags?: string[];
    mentions?: string[];
    customInstructions?: string;
    generateContent?: boolean;
    contentTopic?: string;
    contentTone?: string;
}
/**
 * TrinityInsights — Stub interface for Trinity market intelligence.
 * When integrated, this will provide competitor analysis and trending topics
 * to inform content generation before posting.
 */
export interface TrinityInsights {
    getCompetitorContent(platform: SocialPlatform, topic: string): Promise<string[]>;
    getTrendingTopics(platform: SocialPlatform): Promise<string[]>;
    getOptimalPostingTime(platform: SocialPlatform): Promise<string>;
    getAudienceInsights(platform: SocialPlatform): Promise<Record<string, any>>;
}
/** No-op stub — returns empty results until Trinity is integrated */
export declare class TrinityStub implements TrinityInsights {
    getCompetitorContent(): Promise<string[]>;
    getTrendingTopics(): Promise<string[]>;
    getOptimalPostingTime(): Promise<string>;
    getAudienceInsights(): Promise<Record<string, any>>;
}
export declare class SocialMediaToolBridge {
    private socialOverlord;
    private trinity;
    constructor(socialOverlord: SocialOverlord, trinity?: TrinityInsights);
    /**
     * Execute a social media task with SSE streaming.
     * Builds a QueueTask from the parsed intent, delegates to SocialOverlord.
     */
    executeStreaming(task: ParsedSocialTask, writer: SSEWriter): Promise<TaskResult>;
    /**
     * Execute a social media task without streaming (returns result directly).
     */
    execute(task: ParsedSocialTask): Promise<TaskResult>;
    post(platform: SocialPlatform, content: string, writer: SSEWriter): Promise<TaskResult>;
    comment(platform: SocialPlatform, content: string, targetUrl: string, writer: SSEWriter): Promise<TaskResult>;
    like(platform: SocialPlatform, targetUrl: string, writer: SSEWriter): Promise<TaskResult>;
    follow(platform: SocialPlatform, targetUrl: string, writer: SSEWriter): Promise<TaskResult>;
    search(platform: SocialPlatform, query: string, writer: SSEWriter): Promise<TaskResult>;
    scrape(platform: SocialPlatform, targetUrl: string, writer: SSEWriter): Promise<TaskResult>;
}
//# sourceMappingURL=social-tool-bridge.d.ts.map