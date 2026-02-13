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
import { Complexity } from '../interfaces/types';
import type { CachedCompilation, CacheStats, CompiledAction, CompileRoute } from '../interfaces/intent-compiler';
/**
 * Configuration for semantic cache.
 */
export interface SemanticCacheConfig {
    /** Maximum cache entries. Default: 1000 */
    maxEntries: number;
    /** TTL in milliseconds. Default: 3600000 (1 hour) */
    ttlMs: number;
    /** Similarity threshold for semantic matches (0-1). Default: 0.95 */
    similarityThreshold: number;
    /** Enable semantic similarity search. Default: true */
    enableSimilarity: boolean;
    /** Clean interval in ms. Default: 60000 (1 minute) */
    cleanIntervalMs: number;
}
/**
 * Semantic Cache for compiled intent caching.
 *
 * Provides both exact match and semantic similarity lookup
 * for previously compiled missions.
 */
export declare class SemanticCache {
    private config;
    private cache;
    private accessOrder;
    private stats;
    private cleanupTimer;
    constructor(config?: Partial<SemanticCacheConfig>);
    /**
     * Look up a mission in the cache.
     */
    lookup(mission: string): CachedCompilation | null;
    /**
     * Store a compiled mission in the cache.
     */
    store(mission: string, actions: CompiledAction[], route: CompileRoute, complexity: Complexity, embedding?: number[]): CachedCompilation;
    /**
     * Get cache statistics.
     */
    getStats(): CacheStats;
    /**
     * Clear all cache entries.
     */
    clear(): void;
    /**
     * Stop the cleanup timer.
     */
    destroy(): void;
    /**
     * Generate cache key from mission.
     */
    private generateKey;
    /**
     * Check if entry is expired.
     */
    private isExpired;
    /**
     * Find semantically similar entry.
     */
    private findSimilar;
    /**
     * Tokenize text for similarity comparison.
     */
    private tokenize;
    /**
     * Calculate Jaccard similarity between token sets.
     */
    private jaccardSimilarity;
    /**
     * Record a cache hit.
     */
    private recordHit;
    /**
     * Record a cache miss.
     */
    private recordMiss;
    /**
     * Update LRU access order.
     */
    private updateAccessOrder;
    /**
     * Evict least recently used entry.
     */
    private evictLRU;
    /**
     * Estimate memory size of an entry.
     */
    private estimateEntrySize;
    /**
     * Start cleanup timer for expired entries.
     */
    private startCleanupTimer;
    /**
     * Clean expired entries.
     */
    private cleanExpired;
    /**
     * Get all cached entries (for debugging).
     */
    getEntries(): CachedCompilation[];
    /**
     * Check if a mission is cached.
     */
    has(mission: string): boolean;
    /**
     * Invalidate a specific mission.
     */
    invalidate(mission: string): boolean;
    /**
     * Warm cache with pre-defined entries.
     */
    warmUp(entries: Array<{
        mission: string;
        actions: CompiledAction[];
        route: CompileRoute;
        complexity: Complexity;
    }>): void;
}
//# sourceMappingURL=semantic-cache.d.ts.map