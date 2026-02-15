"use strict";
// @ts-nocheck
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiCachedProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const server_1 = require("@google/generative-ai/server");
class GeminiCachedProvider {
    genAI;
    cacheManager;
    apiKey;
    // Active cache state
    activeCache = null;
    cachedSystemPrompt = null;
    cacheTTLSeconds = 3600; // 1 hour default
    constructor(apiKey) {
        if (!apiKey)
            throw new Error('Missing GEMINI_API_KEY');
        this.apiKey = apiKey;
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        this.cacheManager = new server_1.GoogleAICacheManager(apiKey);
    }
    /**
     * Initialize or refresh the context cache.
     * Call once at startup or when the system prompt changes.
     *
     * @param systemPrompt - The full system prompt to cache
     * @param modelName - Must be a cache-supported model (e.g. 'models/gemini-2.0-flash')
     * @returns Cache ID if successful, null if caching unavailable
     */
    async initializeCache(systemPrompt, modelName = 'models/gemini-2.0-flash') {
        console.log(`[GeminiCache] Initializing cache for model: ${modelName}`);
        console.log(`[GeminiCache] System prompt length: ${systemPrompt.length} chars`);
        try {
            this.activeCache = await this.cacheManager.create({
                model: modelName,
                displayName: 'chromadon_brain_system_prompt',
                systemInstruction: systemPrompt,
                ttlSeconds: this.cacheTTLSeconds,
            });
            this.cachedSystemPrompt = systemPrompt;
            console.log(`[GeminiCache] SUCCESS. Cache ID: ${this.activeCache.name}`);
            console.log(`[GeminiCache] Expiration: ${this.activeCache.expireTime}`);
            console.log(`[GeminiCache] Token count: ${this.activeCache.usageMetadata?.totalTokenCount || 'unknown'}`);
            return this.activeCache.name;
        }
        catch (error) {
            console.warn(`[GeminiCache] Cache creation failed: ${error.message}`);
            console.warn('[GeminiCache] Falling back to standard (non-cached) mode.');
            console.warn('[GeminiCache] Ensure you have a billing-enabled API key for context caching.');
            this.activeCache = null;
            return null;
        }
    }
    /**
     * Check if cache is still valid, refresh if expired.
     */
    async ensureCacheValid(systemPrompt, modelName) {
        if (!this.activeCache)
            return false;
        try {
            // Check if cache is still alive
            const cached = await this.cacheManager.get(this.activeCache.name);
            const expireTime = new Date(cached.expireTime);
            const now = new Date();
            if (expireTime <= now) {
                console.log('[GeminiCache] Cache expired, refreshing...');
                await this.initializeCache(systemPrompt, modelName);
                return !!this.activeCache;
            }
            // Check if system prompt changed
            if (systemPrompt !== this.cachedSystemPrompt) {
                console.log('[GeminiCache] System prompt changed, refreshing cache...');
                await this.initializeCache(systemPrompt, modelName);
                return !!this.activeCache;
            }
            return true;
        }
        catch {
            console.warn('[GeminiCache] Cache validation failed, will refresh on next call.');
            this.activeCache = null;
            return false;
        }
    }
    /**
     * Get a GenerativeModel using the cache, or a standard model as fallback.
     */
    getModel(modelName, systemPrompt) {
        // Cached path
        if (this.activeCache) {
            try {
                return this.genAI.getGenerativeModelFromCachedContent(this.activeCache);
            }
            catch (err) {
                console.warn('[GeminiCache] Failed to use cached model, falling back to standard.');
            }
        }
        // Standard path (no caching)
        return this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: systemPrompt
                ? { role: 'user', parts: [{ text: systemPrompt }] }
                : undefined,
            safetySettings: [
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
            ],
        });
    }
    /**
     * Get cache status for monitoring/diagnostics.
     */
    getCacheStatus() {
        return {
            active: !!this.activeCache,
            cacheId: this.activeCache?.name || null,
            expireTime: this.activeCache?.expireTime || null,
            model: this.activeCache?.model || null,
            tokenCount: this.activeCache?.usageMetadata?.totalTokenCount || null,
        };
    }
    /**
     * Destroy the active cache to stop storage billing.
     */
    async destroyCache() {
        if (this.activeCache?.name) {
            try {
                await this.cacheManager.delete(this.activeCache.name);
                console.log(`[GeminiCache] Cache ${this.activeCache.name} destroyed.`);
            }
            catch (err) {
                console.warn(`[GeminiCache] Failed to destroy cache: ${err.message}`);
            }
        }
        this.activeCache = null;
        this.cachedSystemPrompt = null;
    }
}
exports.GeminiCachedProvider = GeminiCachedProvider;
//# sourceMappingURL=gemini-cached-provider.js.map