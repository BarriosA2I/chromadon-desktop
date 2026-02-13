"use strict";
/**
 * Semantic Cache
 *
 * Neural RAG Brain Pattern: Semantic Caching
 *
 * Caches compiled intents for reuse:
 * - Exact match lookup (hash-based)
 * - Semantic similarity search (embedding-based)
 * - LRU eviction with configurable max size
 * - TTL-based expiration
 * - Hit/miss statistics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticCache = void 0;
const DEFAULT_CONFIG = {
    maxEntries: 1000,
    ttlMs: 3600000, // 1 hour
    similarityThreshold: 0.95,
    enableSimilarity: true,
    cleanIntervalMs: 60000,
};
// =============================================================================
// SEMANTIC CACHE CLASS
// =============================================================================
/**
 * Semantic Cache for compiled intent caching.
 *
 * Provides both exact match and semantic similarity lookup
 * for previously compiled missions.
 */
class SemanticCache {
    config;
    cache;
    accessOrder;
    stats;
    cleanupTimer = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cache = new Map();
        this.accessOrder = [];
        this.stats = {
            hits: 0,
            misses: 0,
            totalLookupTimeMs: 0,
            lookupCount: 0,
        };
        // Start cleanup timer
        if (this.config.cleanIntervalMs > 0) {
            this.startCleanupTimer();
        }
    }
    /**
     * Look up a mission in the cache.
     */
    lookup(mission) {
        const startTime = Date.now();
        try {
            // Try exact match first
            const key = this.generateKey(mission);
            const exactMatch = this.cache.get(key);
            if (exactMatch && !this.isExpired(exactMatch)) {
                this.recordHit(exactMatch.key, startTime);
                return exactMatch;
            }
            // Try semantic similarity if enabled
            if (this.config.enableSimilarity) {
                const similarMatch = this.findSimilar(mission);
                if (similarMatch) {
                    this.recordHit(similarMatch.key, startTime);
                    return similarMatch;
                }
            }
            this.recordMiss(startTime);
            return null;
        }
        catch {
            this.recordMiss(startTime);
            return null;
        }
    }
    /**
     * Store a compiled mission in the cache.
     */
    store(mission, actions, route, complexity, embedding) {
        // Evict if at capacity
        if (this.cache.size >= this.config.maxEntries) {
            this.evictLRU();
        }
        const key = this.generateKey(mission);
        const now = new Date();
        const entry = {
            key,
            mission,
            actions,
            route,
            complexity,
            cachedAt: now,
            hitCount: 0,
            lastUsed: now,
            embedding,
        };
        this.cache.set(key, entry);
        this.updateAccessOrder(key);
        return entry;
    }
    /**
     * Get cache statistics.
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
        const avgLookupTimeMs = this.stats.lookupCount > 0
            ? this.stats.totalLookupTimeMs / this.stats.lookupCount
            : 0;
        // Estimate memory usage
        let memoryBytes = 0;
        for (const entry of this.cache.values()) {
            memoryBytes += this.estimateEntrySize(entry);
        }
        return {
            size: this.cache.size,
            hitRate,
            hits: this.stats.hits,
            misses: this.stats.misses,
            avgLookupTimeMs,
            memoryBytes,
        };
    }
    /**
     * Clear all cache entries.
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
        this.stats = {
            hits: 0,
            misses: 0,
            totalLookupTimeMs: 0,
            lookupCount: 0,
        };
    }
    /**
     * Stop the cleanup timer.
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }
    /**
     * Generate cache key from mission.
     */
    generateKey(mission) {
        // Normalize mission text
        const normalized = mission
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s]/g, '');
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return `intent_${Math.abs(hash).toString(36)}`;
    }
    /**
     * Check if entry is expired.
     */
    isExpired(entry) {
        const age = Date.now() - entry.cachedAt.getTime();
        return age > this.config.ttlMs;
    }
    /**
     * Find semantically similar entry.
     */
    findSimilar(mission) {
        // Tokenize mission
        const tokens = this.tokenize(mission);
        let bestMatch = null;
        let bestScore = 0;
        for (const entry of this.cache.values()) {
            if (this.isExpired(entry))
                continue;
            // Calculate Jaccard similarity on tokens
            const entryTokens = this.tokenize(entry.mission);
            const similarity = this.jaccardSimilarity(tokens, entryTokens);
            if (similarity >= this.config.similarityThreshold && similarity > bestScore) {
                bestScore = similarity;
                bestMatch = entry;
            }
        }
        return bestMatch;
    }
    /**
     * Tokenize text for similarity comparison.
     */
    tokenize(text) {
        const words = text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 2); // Skip short words
        // Also create bigrams for better matching
        const bigrams = [];
        for (let i = 0; i < words.length - 1; i++) {
            bigrams.push(`${words[i]}_${words[i + 1]}`);
        }
        return new Set([...words, ...bigrams]);
    }
    /**
     * Calculate Jaccard similarity between token sets.
     */
    jaccardSimilarity(set1, set2) {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        if (union.size === 0)
            return 0;
        return intersection.size / union.size;
    }
    /**
     * Record a cache hit.
     */
    recordHit(key, startTime) {
        this.stats.hits++;
        this.stats.lookupCount++;
        this.stats.totalLookupTimeMs += Date.now() - startTime;
        // Update entry
        const entry = this.cache.get(key);
        if (entry) {
            entry.hitCount++;
            entry.lastUsed = new Date();
            this.updateAccessOrder(key);
        }
    }
    /**
     * Record a cache miss.
     */
    recordMiss(startTime) {
        this.stats.misses++;
        this.stats.lookupCount++;
        this.stats.totalLookupTimeMs += Date.now() - startTime;
    }
    /**
     * Update LRU access order.
     */
    updateAccessOrder(key) {
        // Remove existing position
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) {
            this.accessOrder.splice(idx, 1);
        }
        // Add to end (most recent)
        this.accessOrder.push(key);
    }
    /**
     * Evict least recently used entry.
     */
    evictLRU() {
        // Remove oldest entries until under limit
        while (this.cache.size >= this.config.maxEntries && this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }
    }
    /**
     * Estimate memory size of an entry.
     */
    estimateEntrySize(entry) {
        let size = 0;
        // Key and mission strings
        size += entry.key.length * 2;
        size += entry.mission.length * 2;
        // Actions (rough estimate)
        size += JSON.stringify(entry.actions).length * 2;
        // Embedding if present
        if (entry.embedding) {
            size += entry.embedding.length * 8; // Float64
        }
        // Other fields
        size += 100; // Dates, enums, etc.
        return size;
    }
    /**
     * Start cleanup timer for expired entries.
     */
    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanExpired();
        }, this.config.cleanIntervalMs);
        // Don't prevent process exit
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }
    /**
     * Clean expired entries.
     */
    cleanExpired() {
        const expiredKeys = [];
        for (const [key, entry] of this.cache) {
            if (this.isExpired(entry)) {
                expiredKeys.push(key);
            }
        }
        for (const key of expiredKeys) {
            this.cache.delete(key);
            const idx = this.accessOrder.indexOf(key);
            if (idx > -1) {
                this.accessOrder.splice(idx, 1);
            }
        }
    }
    /**
     * Get all cached entries (for debugging).
     */
    getEntries() {
        return Array.from(this.cache.values());
    }
    /**
     * Check if a mission is cached.
     */
    has(mission) {
        const key = this.generateKey(mission);
        const entry = this.cache.get(key);
        return entry !== undefined && !this.isExpired(entry);
    }
    /**
     * Invalidate a specific mission.
     */
    invalidate(mission) {
        const key = this.generateKey(mission);
        const existed = this.cache.has(key);
        this.cache.delete(key);
        const idx = this.accessOrder.indexOf(key);
        if (idx > -1) {
            this.accessOrder.splice(idx, 1);
        }
        return existed;
    }
    /**
     * Warm cache with pre-defined entries.
     */
    warmUp(entries) {
        for (const entry of entries) {
            this.store(entry.mission, entry.actions, entry.route, entry.complexity);
        }
    }
}
exports.SemanticCache = SemanticCache;
//# sourceMappingURL=semantic-cache.js.map