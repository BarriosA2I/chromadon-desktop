"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProceduralMemory = exports.ProceduralMemory = void 0;
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    maxPatterns: 1000,
    dailyDecayRate: 0.05,
    minDecayFactor: 0.3,
    minSuccessRate: 0.7,
    minUsesForReliable: 3,
    matchScoreThreshold: 0.6,
};
// =============================================================================
// PROCEDURAL MEMORY
// =============================================================================
/**
 * Procedural Memory for storing learned healing patterns.
 *
 * Implements the L3 tier of the Neural RAG Brain hierarchical memory,
 * focusing on procedural knowledge (how to heal selectors).
 */
class ProceduralMemory {
    config;
    patterns;
    // Indexes for fast lookup
    byDomain;
    byElementType;
    byContextFingerprint;
    byOriginalPattern;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.patterns = new Map();
        this.byDomain = new Map();
        this.byElementType = new Map();
        this.byContextFingerprint = new Map();
        this.byOriginalPattern = new Map();
    }
    // ===========================================================================
    // PATTERN STORAGE
    // ===========================================================================
    /**
     * Store a new healing pattern.
     *
     * @param pattern - Pattern to store
     * @returns Stored pattern with ID
     */
    store(pattern) {
        // Check capacity
        if (this.patterns.size >= this.config.maxPatterns) {
            this.evictLowestValue();
        }
        const id = this.generateId();
        const fullPattern = {
            ...pattern,
            id,
            useCount: 1,
            successRate: 1.0,
            createdAt: new Date(),
            lastUsedAt: new Date(),
            decayFactor: 1.0,
        };
        this.patterns.set(id, fullPattern);
        this.indexPattern(fullPattern);
        return fullPattern;
    }
    /**
     * Index a pattern for fast lookup.
     */
    indexPattern(pattern) {
        // Index by domain
        const domainSet = this.byDomain.get(pattern.domain) ?? new Set();
        domainSet.add(pattern.id);
        this.byDomain.set(pattern.domain, domainSet);
        // Index by element type
        const elementSet = this.byElementType.get(pattern.elementType) ?? new Set();
        elementSet.add(pattern.id);
        this.byElementType.set(pattern.elementType, elementSet);
        // Index by context fingerprint
        const contextSet = this.byContextFingerprint.get(pattern.contextFingerprint) ?? new Set();
        contextSet.add(pattern.id);
        this.byContextFingerprint.set(pattern.contextFingerprint, contextSet);
        // Index by original pattern
        const originalSet = this.byOriginalPattern.get(pattern.originalPattern) ?? new Set();
        originalSet.add(pattern.id);
        this.byOriginalPattern.set(pattern.originalPattern, originalSet);
    }
    /**
     * Remove a pattern from indexes.
     */
    unindexPattern(pattern) {
        this.byDomain.get(pattern.domain)?.delete(pattern.id);
        this.byElementType.get(pattern.elementType)?.delete(pattern.id);
        this.byContextFingerprint.get(pattern.contextFingerprint)?.delete(pattern.id);
        this.byOriginalPattern.get(pattern.originalPattern)?.delete(pattern.id);
    }
    // ===========================================================================
    // PATTERN LOOKUP
    // ===========================================================================
    /**
     * Find matching patterns for a healing request.
     *
     * @param query - Query parameters
     * @returns Matching patterns sorted by score
     */
    findMatches(query) {
        const candidates = [];
        // First, check for exact original pattern match
        const exactMatches = this.byOriginalPattern.get(this.extractPattern(query.originalSelector));
        if (exactMatches) {
            for (const id of exactMatches) {
                const pattern = this.patterns.get(id);
                if (pattern) {
                    const score = this.calculateMatchScore(pattern, query, 'exact');
                    if (score >= this.config.matchScoreThreshold) {
                        candidates.push({ pattern, matchScore: score, matchType: 'exact' });
                    }
                }
            }
        }
        // Check context fingerprint matches
        if (query.contextFingerprint) {
            const contextMatches = this.byContextFingerprint.get(query.contextFingerprint);
            if (contextMatches) {
                for (const id of contextMatches) {
                    if (candidates.some(c => c.pattern.id === id))
                        continue;
                    const pattern = this.patterns.get(id);
                    if (pattern) {
                        const score = this.calculateMatchScore(pattern, query, 'contextual');
                        if (score >= this.config.matchScoreThreshold) {
                            candidates.push({ pattern, matchScore: score, matchType: 'contextual' });
                        }
                    }
                }
            }
        }
        // Check domain + element type matches
        if (query.domain && query.elementType) {
            const domainPatterns = this.byDomain.get(query.domain);
            const elementPatterns = this.byElementType.get(query.elementType);
            if (domainPatterns && elementPatterns) {
                const intersection = new Set([...domainPatterns].filter(id => elementPatterns.has(id)));
                for (const id of intersection) {
                    if (candidates.some(c => c.pattern.id === id))
                        continue;
                    const pattern = this.patterns.get(id);
                    if (pattern) {
                        const score = this.calculateMatchScore(pattern, query, 'similar');
                        if (score >= this.config.matchScoreThreshold) {
                            candidates.push({ pattern, matchScore: score, matchType: 'similar' });
                        }
                    }
                }
            }
        }
        // Sort by score * decay * success rate
        return candidates.sort((a, b) => {
            const aValue = a.matchScore * a.pattern.decayFactor * a.pattern.successRate;
            const bValue = b.matchScore * b.pattern.decayFactor * b.pattern.successRate;
            return bValue - aValue;
        });
    }
    /**
     * Get the best matching pattern.
     */
    findBestMatch(query) {
        const matches = this.findMatches(query);
        return matches.length > 0 ? matches[0] : null;
    }
    /**
     * Calculate match score between pattern and query.
     */
    calculateMatchScore(pattern, query, matchType) {
        let score = 0;
        let factors = 0;
        // Base score by match type
        switch (matchType) {
            case 'exact':
                score += 0.4;
                break;
            case 'contextual':
                score += 0.3;
                break;
            case 'similar':
                score += 0.2;
                break;
        }
        factors++;
        // Domain match
        if (query.domain && pattern.domain === query.domain) {
            score += 0.2;
        }
        factors++;
        // Element type match
        if (query.elementType && pattern.elementType === query.elementType) {
            score += 0.15;
        }
        factors++;
        // Action type match
        if (query.actionType && pattern.actionType === query.actionType) {
            score += 0.15;
        }
        factors++;
        // Boost for reliability (use count)
        if (pattern.useCount >= this.config.minUsesForReliable) {
            score += 0.1;
        }
        return Math.min(1, score);
    }
    // ===========================================================================
    // PATTERN USAGE
    // ===========================================================================
    /**
     * Record pattern usage (success or failure).
     *
     * @param patternId - Pattern ID
     * @param success - Whether the pattern worked
     */
    recordUsage(patternId, success) {
        const pattern = this.patterns.get(patternId);
        if (!pattern)
            return;
        pattern.useCount++;
        pattern.lastUsedAt = new Date();
        // Update success rate with exponential moving average
        const alpha = 0.3;
        pattern.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * pattern.successRate;
        // Reset decay on successful use
        if (success) {
            pattern.decayFactor = 1.0;
        }
        // Evict if success rate too low
        if (pattern.useCount >= this.config.minUsesForReliable &&
            pattern.successRate < this.config.minSuccessRate) {
            this.remove(patternId);
        }
    }
    /**
     * Apply time-based decay to all patterns.
     */
    applyDecay() {
        const now = Date.now();
        const idsToRemove = [];
        for (const [id, pattern] of this.patterns) {
            const daysSinceUse = (now - pattern.lastUsedAt.getTime()) / (24 * 60 * 60 * 1000);
            const decayAmount = daysSinceUse * this.config.dailyDecayRate;
            pattern.decayFactor = Math.max(0, pattern.decayFactor - decayAmount);
            // Mark for removal if too decayed
            if (pattern.decayFactor < this.config.minDecayFactor) {
                idsToRemove.push(id);
            }
        }
        // Remove decayed patterns
        for (const id of idsToRemove) {
            this.remove(id);
        }
    }
    // ===========================================================================
    // PATTERN MANAGEMENT
    // ===========================================================================
    /**
     * Remove a pattern.
     */
    remove(patternId) {
        const pattern = this.patterns.get(patternId);
        if (!pattern)
            return false;
        this.unindexPattern(pattern);
        this.patterns.delete(patternId);
        return true;
    }
    /**
     * Evict the lowest value pattern.
     */
    evictLowestValue() {
        let lowestValue = Infinity;
        let lowestId = null;
        for (const [id, pattern] of this.patterns) {
            const value = pattern.successRate * pattern.decayFactor * pattern.useCount;
            if (value < lowestValue) {
                lowestValue = value;
                lowestId = id;
            }
        }
        if (lowestId) {
            this.remove(lowestId);
        }
    }
    /**
     * Get a pattern by ID.
     */
    get(patternId) {
        return this.patterns.get(patternId);
    }
    /**
     * Get all patterns for a domain.
     */
    getByDomain(domain) {
        const ids = this.byDomain.get(domain);
        if (!ids)
            return [];
        return Array.from(ids)
            .map(id => this.patterns.get(id))
            .filter((p) => p !== undefined);
    }
    // ===========================================================================
    // UTILITIES
    // ===========================================================================
    /**
     * Extract pattern from selector.
     */
    extractPattern(selector) {
        // Remove specific values, keep structure
        return selector
            .replace(/\d+/g, '#') // Replace numbers with #
            .replace(/"[^"]*"/g, '"..."') // Replace quoted strings
            .replace(/'[^']*'/g, "'...'") // Replace single-quoted strings
            .replace(/\[[^\]]*=[^\]]*\]/g, '[attr=...]'); // Replace attribute values
    }
    /**
     * Generate unique ID.
     */
    generateId() {
        return `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    /**
     * Create context fingerprint.
     */
    static createFingerprint(context) {
        const parts = [];
        if (context.nearText) {
            // Use first 3 words
            const words = context.nearText.toLowerCase().split(/\s+/).slice(0, 3);
            parts.push(`text:${words.join('_')}`);
        }
        if (context.parentTag) {
            parts.push(`parent:${context.parentTag}`);
        }
        if (context.siblingTags && context.siblingTags.length > 0) {
            parts.push(`siblings:${context.siblingTags.slice(0, 3).join(',')}`);
        }
        if (context.attributes) {
            const attrKeys = Object.keys(context.attributes).slice(0, 3).sort();
            parts.push(`attrs:${attrKeys.join(',')}`);
        }
        return parts.join('|');
    }
    // ===========================================================================
    // STATISTICS
    // ===========================================================================
    /**
     * Get memory statistics.
     */
    getStats() {
        const patterns = Array.from(this.patterns.values());
        const patternsByDomain = {};
        for (const [domain, ids] of this.byDomain) {
            patternsByDomain[domain] = ids.size;
        }
        const avgSuccessRate = patterns.length > 0
            ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length
            : 0;
        const avgDecayFactor = patterns.length > 0
            ? patterns.reduce((sum, p) => sum + p.decayFactor, 0) / patterns.length
            : 0;
        const reliablePatterns = patterns.filter(p => p.useCount >= this.config.minUsesForReliable &&
            p.successRate >= this.config.minSuccessRate).length;
        return {
            totalPatterns: patterns.length,
            patternsByDomain,
            averageSuccessRate: avgSuccessRate,
            averageDecayFactor: avgDecayFactor,
            reliablePatterns,
        };
    }
    /**
     * Export memory for persistence.
     */
    export() {
        return Array.from(this.patterns.values());
    }
    /**
     * Import memory from persistence.
     */
    import(patterns) {
        for (const pattern of patterns) {
            this.patterns.set(pattern.id, pattern);
            this.indexPattern(pattern);
        }
    }
    /**
     * Clear all patterns.
     */
    clear() {
        this.patterns.clear();
        this.byDomain.clear();
        this.byElementType.clear();
        this.byContextFingerprint.clear();
        this.byOriginalPattern.clear();
    }
    /**
     * Get size.
     */
    get size() {
        return this.patterns.size;
    }
}
exports.ProceduralMemory = ProceduralMemory;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a procedural memory instance.
 *
 * @param config - Configuration options
 */
function createProceduralMemory(config) {
    return new ProceduralMemory(config);
}
exports.createProceduralMemory = createProceduralMemory;
//# sourceMappingURL=procedural-memory.js.map