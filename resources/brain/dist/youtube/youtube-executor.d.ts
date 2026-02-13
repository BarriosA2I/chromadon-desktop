/**
 * YouTube Data API v3 Executor
 *
 * Async executor factory for YouTube tools. Each tool calls the YouTube
 * REST API via native fetch() and returns JSON-stringified results.
 *
 * Follows the createAnalyticsExecutor() pattern from analytics-executor.ts.
 *
 * @author Barrios A2I
 */
import { YouTubeTokenManager } from './youtube-token-manager';
/**
 * Create an async YouTube tool executor bound to a token manager.
 */
export declare function createYouTubeExecutor(tokenManager: YouTubeTokenManager): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=youtube-executor.d.ts.map