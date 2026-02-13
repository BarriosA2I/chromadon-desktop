/**
 * Healing Context Memory (L1 Episodic Tier)
 *
 * Neural RAG Brain Pattern: Hierarchical Memory
 *
 * Stores successful healing strategies for future use:
 * - L0 Working: Current page selectors (7±2 items)
 * - L1 Episodic: Session healing history (24h decay)
 * - L2 Semantic: Domain-specific patterns (no decay)
 * - L3 Procedural: Successful healing workflows
 */
import type { Selector } from '../interfaces';
/**
 * A healing record capturing what worked.
 */
export interface HealingRecord {
    /** Unique ID for this record */
    id: string;
    /** Original broken selector */
    brokenSelector: string;
    /** Healed selector that worked */
    healedSelector: Selector;
    /** Context that helped healing */
    context: HealingContext;
    /** When this healing occurred */
    timestamp: Date;
    /** How many times this pattern was reused */
    reuseCount: number;
    /** Success rate when reused */
    successRate: number;
    /** Domain/URL pattern where this worked */
    urlPattern: string;
    /** Element description for matching */
    elementDescription: string;
}
/**
 * Context that helped with healing.
 */
export interface HealingContext {
    /** Action being attempted */
    action: string;
    /** Text near the element */
    nearText?: string;
    /** Expected tag name */
    expectedTag?: string;
    /** Parent element info */
    parentInfo?: string;
    /** Sibling elements */
    siblings?: string[];
}
/**
 * Memory tier configuration.
 */
export interface MemoryTierConfig {
    /** Maximum items in working memory */
    workingMemorySize: number;
    /** Episodic memory decay time (ms) */
    episodicDecayMs: number;
    /** Minimum success rate to promote to procedural */
    proceduralPromotionThreshold: number;
}
/**
 * L1 Episodic Healing Memory.
 * Stores healing history with time-based decay.
 */
export declare class HealingMemory {
    private config;
    private workingMemory;
    private episodicMemory;
    private semanticMemory;
    private proceduralMemory;
    constructor(config?: Partial<MemoryTierConfig>);
    /**
     * Store a selector in working memory for current page.
     */
    setWorkingSelector(key: string, selector: Selector): void;
    /**
     * Get a selector from working memory.
     */
    getWorkingSelector(key: string): Selector | undefined;
    /**
     * Clear working memory (on page navigation).
     */
    clearWorkingMemory(): void;
    /**
     * Record a successful healing for future reference.
     */
    recordHealing(brokenSelector: string, healedSelector: Selector, context: HealingContext, urlPattern: string): HealingRecord;
    /**
     * Find similar healings from history.
     */
    findSimilarHealings(brokenSelector: string, context: HealingContext, urlPattern: string): HealingRecord[];
    /**
     * Mark a healing record as reused.
     */
    markReused(recordId: string, success: boolean): void;
    /**
     * Get domain-specific healing patterns.
     */
    getDomainPatterns(urlPattern: string): HealingRecord[];
    /**
     * Store a domain-specific pattern.
     */
    addDomainPattern(record: HealingRecord): void;
    /**
     * Get procedural memory record by element description.
     */
    getProceduralPattern(elementDescription: string): HealingRecord | undefined;
    /**
     * Promote a successful healing to procedural memory.
     */
    private promoteToProceduralMemory;
    /**
     * Calculate similarity between a record and current context.
     */
    private calculateSimilarity;
    /**
     * Check if two selector patterns match.
     */
    private selectorPatternMatch;
    /**
     * Extract general pattern from selector.
     */
    private extractSelectorPattern;
    /**
     * Calculate text similarity (Jaccard).
     */
    private textSimilarity;
    /**
     * Prune expired episodic records.
     */
    private pruneExpiredRecords;
    /**
     * Index a record by domain for semantic lookup.
     */
    private indexByDomain;
    /**
     * Extract domain from URL pattern.
     */
    private extractDomain;
    /**
     * Describe element for matching.
     */
    private describeElement;
    /**
     * Generate unique ID.
     */
    private generateId;
    /**
     * Get memory statistics.
     */
    getStats(): {
        workingMemorySize: number;
        episodicMemorySize: number;
        semanticDomainsCount: number;
        proceduralPatternsCount: number;
        totalHealingRecords: number;
        averageSuccessRate: number;
    };
    /**
     * Export memory for persistence.
     */
    exportMemory(): {
        episodic: HealingRecord[];
        semantic: Record<string, HealingRecord[]>;
        procedural: HealingRecord[];
    };
    /**
     * Import memory from persistence.
     */
    importMemory(data: {
        episodic?: HealingRecord[];
        semantic?: Record<string, HealingRecord[]>;
        procedural?: HealingRecord[];
    }): void;
}
//# sourceMappingURL=healing-memory.d.ts.map