/**
 * Procedural Memory (L3 Tier)
 *
 * Neural RAG Brain Pattern: Procedural Learning
 *
 * Stores successful healing patterns for instant reuse:
 * - Learns from successful healings
 * - Indexes by multiple dimensions (element, context, domain)
 * - Provides instant lookup for known patterns
 * - Implements slow decay for rarely-used patterns
 */
import type { Selector } from '../interfaces';
/**
 * A procedural healing pattern.
 */
export interface HealingPattern {
    /** Unique pattern ID */
    id: string;
    /** Original broken selector pattern */
    originalPattern: string;
    /** Healed selector that works */
    healedSelector: Selector;
    /** Context fingerprint */
    contextFingerprint: string;
    /** Domain where this works */
    domain: string;
    /** Element type (tag name) */
    elementType: string;
    /** Action type this applies to */
    actionType: string;
    /** Number of times used */
    useCount: number;
    /** Success rate when applied */
    successRate: number;
    /** Confidence score */
    confidence: number;
    /** When first created */
    createdAt: Date;
    /** When last used */
    lastUsedAt: Date;
    /** Decay factor (0-1, lower = more decayed) */
    decayFactor: number;
}
/**
 * Pattern match result.
 */
export interface PatternMatch {
    pattern: HealingPattern;
    matchScore: number;
    matchType: 'exact' | 'similar' | 'contextual';
}
/**
 * Procedural memory configuration.
 */
export interface ProceduralMemoryConfig {
    /** Maximum patterns to store */
    maxPatterns: number;
    /** Decay rate per day (0-1) */
    dailyDecayRate: number;
    /** Minimum decay factor before eviction */
    minDecayFactor: number;
    /** Minimum success rate to keep pattern */
    minSuccessRate: number;
    /** Minimum uses to consider pattern reliable */
    minUsesForReliable: number;
    /** Score threshold for pattern matching */
    matchScoreThreshold: number;
}
/**
 * Procedural Memory for storing learned healing patterns.
 *
 * Implements the L3 tier of the Neural RAG Brain hierarchical memory,
 * focusing on procedural knowledge (how to heal selectors).
 */
export declare class ProceduralMemory {
    private config;
    private patterns;
    private byDomain;
    private byElementType;
    private byContextFingerprint;
    private byOriginalPattern;
    constructor(config?: Partial<ProceduralMemoryConfig>);
    /**
     * Store a new healing pattern.
     *
     * @param pattern - Pattern to store
     * @returns Stored pattern with ID
     */
    store(pattern: Omit<HealingPattern, 'id' | 'useCount' | 'successRate' | 'createdAt' | 'lastUsedAt' | 'decayFactor'>): HealingPattern;
    /**
     * Index a pattern for fast lookup.
     */
    private indexPattern;
    /**
     * Remove a pattern from indexes.
     */
    private unindexPattern;
    /**
     * Find matching patterns for a healing request.
     *
     * @param query - Query parameters
     * @returns Matching patterns sorted by score
     */
    findMatches(query: {
        originalSelector: string;
        contextFingerprint?: string;
        domain?: string;
        elementType?: string;
        actionType?: string;
    }): PatternMatch[];
    /**
     * Get the best matching pattern.
     */
    findBestMatch(query: {
        originalSelector: string;
        contextFingerprint?: string;
        domain?: string;
        elementType?: string;
        actionType?: string;
    }): PatternMatch | null;
    /**
     * Calculate match score between pattern and query.
     */
    private calculateMatchScore;
    /**
     * Record pattern usage (success or failure).
     *
     * @param patternId - Pattern ID
     * @param success - Whether the pattern worked
     */
    recordUsage(patternId: string, success: boolean): void;
    /**
     * Apply time-based decay to all patterns.
     */
    applyDecay(): void;
    /**
     * Remove a pattern.
     */
    remove(patternId: string): boolean;
    /**
     * Evict the lowest value pattern.
     */
    private evictLowestValue;
    /**
     * Get a pattern by ID.
     */
    get(patternId: string): HealingPattern | undefined;
    /**
     * Get all patterns for a domain.
     */
    getByDomain(domain: string): HealingPattern[];
    /**
     * Extract pattern from selector.
     */
    private extractPattern;
    /**
     * Generate unique ID.
     */
    private generateId;
    /**
     * Create context fingerprint.
     */
    static createFingerprint(context: {
        nearText?: string;
        parentTag?: string;
        siblingTags?: string[];
        attributes?: Record<string, string>;
    }): string;
    /**
     * Get memory statistics.
     */
    getStats(): {
        totalPatterns: number;
        patternsByDomain: Record<string, number>;
        averageSuccessRate: number;
        averageDecayFactor: number;
        reliablePatterns: number;
    };
    /**
     * Export memory for persistence.
     */
    export(): HealingPattern[];
    /**
     * Import memory from persistence.
     */
    import(patterns: HealingPattern[]): void;
    /**
     * Clear all patterns.
     */
    clear(): void;
    /**
     * Get size.
     */
    get size(): number;
}
/**
 * Create a procedural memory instance.
 *
 * @param config - Configuration options
 */
export declare function createProceduralMemory(config?: Partial<ProceduralMemoryConfig>): ProceduralMemory;
//# sourceMappingURL=procedural-memory.d.ts.map