/**
 * CHROMADON Gemini Cached Provider
 * ================================
 * Uses Google's Context Caching API to cache the system prompt server-side.
 * The 40K token system prompt is uploaded once and referenced by cache ID
 * for subsequent calls, dropping input cost by ~90%.
 *
 * REQUIREMENTS:
 *   - Paid Google Cloud API key (billing enabled) — free tier does NOT support caching
 *   - Minimum 32,768 tokens in cached content (our full prompt exceeds this)
 *   - Model must support caching (gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-pro)
 *   - Cache storage costs $0.025/1M tokens/hour
 *
 * Cost Impact (on BALANCED tier with full prompt):
 *   Standard Input: $0.30 / 1M tokens
 *   Cached Input:   $0.075 / 1M tokens (~75% savings)
 *   Cache storage:  $0.025 / 1M tokens / hour
 *
 * USAGE:
 *   Set GEMINI_CACHE_ENABLED=true in .env to activate.
 *   Falls back to standard GeminiProvider if caching fails.
 *
 * @author Barrios A2I
 */
import { GenerativeModel } from '@google/generative-ai';
export interface CacheStatus {
    active: boolean;
    cacheId: string | null;
    expireTime: string | null;
    model: string | null;
    tokenCount: number | null;
}
export declare class GeminiCachedProvider {
    private genAI;
    private cacheManager;
    private apiKey;
    private activeCache;
    private cachedSystemPrompt;
    private cacheTTLSeconds;
    constructor(apiKey: string);
    /**
     * Initialize or refresh the context cache.
     * Call once at startup or when the system prompt changes.
     *
     * @param systemPrompt - The full system prompt to cache
     * @param modelName - Must be a cache-supported model (e.g. 'models/gemini-2.0-flash')
     * @returns Cache ID if successful, null if caching unavailable
     */
    initializeCache(systemPrompt: string, modelName?: string): Promise<string | null>;
    /**
     * Check if cache is still valid, refresh if expired.
     */
    ensureCacheValid(systemPrompt: string, modelName: string): Promise<boolean>;
    /**
     * Get a GenerativeModel using the cache, or a standard model as fallback.
     */
    getModel(modelName: string, systemPrompt?: string): GenerativeModel;
    /**
     * Get cache status for monitoring/diagnostics.
     */
    getCacheStatus(): CacheStatus;
    /**
     * Destroy the active cache to stop storage billing.
     */
    destroyCache(): Promise<void>;
}
//# sourceMappingURL=gemini-cached-provider.d.ts.map