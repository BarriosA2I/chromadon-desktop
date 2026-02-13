"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealingMemory = void 0;
const DEFAULT_CONFIG = {
    workingMemorySize: 7, // 7±2 cognitive limit
    episodicDecayMs: 24 * 60 * 60 * 1000, // 24 hours
    proceduralPromotionThreshold: 0.8,
};
/**
 * L1 Episodic Healing Memory.
 * Stores healing history with time-based decay.
 */
class HealingMemory {
    config;
    // L0: Working memory - current page, limited size
    workingMemory = new Map();
    // L1: Episodic memory - session history with decay
    episodicMemory = new Map();
    // L2: Semantic memory - domain patterns, persistent
    semanticMemory = new Map();
    // L3: Procedural memory - successful workflows
    proceduralMemory = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ==========================================================================
    // L0: WORKING MEMORY
    // ==========================================================================
    /**
     * Store a selector in working memory for current page.
     */
    setWorkingSelector(key, selector) {
        // Enforce size limit with LRU eviction
        if (this.workingMemory.size >= this.config.workingMemorySize) {
            const firstKey = this.workingMemory.keys().next().value;
            if (firstKey) {
                this.workingMemory.delete(firstKey);
            }
        }
        this.workingMemory.set(key, selector);
    }
    /**
     * Get a selector from working memory.
     */
    getWorkingSelector(key) {
        return this.workingMemory.get(key);
    }
    /**
     * Clear working memory (on page navigation).
     */
    clearWorkingMemory() {
        this.workingMemory.clear();
    }
    // ==========================================================================
    // L1: EPISODIC MEMORY
    // ==========================================================================
    /**
     * Record a successful healing for future reference.
     */
    recordHealing(brokenSelector, healedSelector, context, urlPattern) {
        const id = this.generateId();
        const record = {
            id,
            brokenSelector,
            healedSelector,
            context,
            timestamp: new Date(),
            reuseCount: 0,
            successRate: 1.0,
            urlPattern,
            elementDescription: this.describeElement(context),
        };
        this.episodicMemory.set(id, record);
        this.indexByDomain(record);
        return record;
    }
    /**
     * Find similar healings from history.
     */
    findSimilarHealings(brokenSelector, context, urlPattern) {
        this.pruneExpiredRecords();
        const candidates = [];
        for (const record of this.episodicMemory.values()) {
            const score = this.calculateSimilarity(record, brokenSelector, context, urlPattern);
            if (score > 0.5) {
                candidates.push({ record, score });
            }
        }
        // Sort by score * successRate
        return candidates
            .sort((a, b) => b.score * b.record.successRate - a.score * a.record.successRate)
            .map(c => c.record);
    }
    /**
     * Mark a healing record as reused.
     */
    markReused(recordId, success) {
        const record = this.episodicMemory.get(recordId);
        if (record) {
            record.reuseCount++;
            // Update success rate with exponential moving average
            const alpha = 0.3;
            record.successRate = alpha * (success ? 1 : 0) + (1 - alpha) * record.successRate;
            // Promote to procedural if successful enough
            if (record.reuseCount >= 3 &&
                record.successRate >= this.config.proceduralPromotionThreshold) {
                this.promoteToProceduralMemory(record);
            }
        }
    }
    // ==========================================================================
    // L2: SEMANTIC MEMORY (Domain Patterns)
    // ==========================================================================
    /**
     * Get domain-specific healing patterns.
     */
    getDomainPatterns(urlPattern) {
        return this.semanticMemory.get(this.extractDomain(urlPattern)) ?? [];
    }
    /**
     * Store a domain-specific pattern.
     */
    addDomainPattern(record) {
        const domain = this.extractDomain(record.urlPattern);
        const existing = this.semanticMemory.get(domain) ?? [];
        existing.push(record);
        this.semanticMemory.set(domain, existing);
    }
    // ==========================================================================
    // L3: PROCEDURAL MEMORY (Successful Workflows)
    // ==========================================================================
    /**
     * Get procedural memory record by element description.
     */
    getProceduralPattern(elementDescription) {
        return this.proceduralMemory.get(elementDescription);
    }
    /**
     * Promote a successful healing to procedural memory.
     */
    promoteToProceduralMemory(record) {
        this.proceduralMemory.set(record.elementDescription, record);
    }
    // ==========================================================================
    // SIMILARITY & MATCHING
    // ==========================================================================
    /**
     * Calculate similarity between a record and current context.
     */
    calculateSimilarity(record, brokenSelector, context, urlPattern) {
        let score = 0;
        let factors = 0;
        // Same broken selector pattern
        if (this.selectorPatternMatch(record.brokenSelector, brokenSelector)) {
            score += 0.3;
        }
        factors++;
        // Same action type
        if (record.context.action === context.action) {
            score += 0.2;
        }
        factors++;
        // Similar near text
        if (record.context.nearText && context.nearText) {
            const textSimilarity = this.textSimilarity(record.context.nearText, context.nearText);
            score += textSimilarity * 0.2;
        }
        factors++;
        // Same expected tag
        if (record.context.expectedTag === context.expectedTag) {
            score += 0.15;
        }
        factors++;
        // Same domain
        if (this.extractDomain(record.urlPattern) === this.extractDomain(urlPattern)) {
            score += 0.15;
        }
        factors++;
        return score;
    }
    /**
     * Check if two selector patterns match.
     */
    selectorPatternMatch(a, b) {
        // Extract pattern type (id, class, tag, etc.)
        const patternA = this.extractSelectorPattern(a);
        const patternB = this.extractSelectorPattern(b);
        return patternA === patternB;
    }
    /**
     * Extract general pattern from selector.
     */
    extractSelectorPattern(selector) {
        if (selector.startsWith('#'))
            return 'id';
        if (selector.startsWith('.'))
            return 'class';
        if (selector.startsWith('['))
            return 'attribute';
        if (selector.startsWith('//'))
            return 'xpath';
        if (selector.startsWith('text='))
            return 'text';
        return 'tag';
    }
    /**
     * Calculate text similarity (Jaccard).
     */
    textSimilarity(a, b) {
        const wordsA = new Set(a.toLowerCase().split(/\s+/));
        const wordsB = new Set(b.toLowerCase().split(/\s+/));
        const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
        const union = new Set([...wordsA, ...wordsB]);
        return intersection.size / union.size;
    }
    // ==========================================================================
    // UTILITIES
    // ==========================================================================
    /**
     * Prune expired episodic records.
     */
    pruneExpiredRecords() {
        const now = Date.now();
        const expiredIds = [];
        for (const [id, record] of this.episodicMemory) {
            const age = now - record.timestamp.getTime();
            if (age > this.config.episodicDecayMs) {
                expiredIds.push(id);
            }
        }
        for (const id of expiredIds) {
            this.episodicMemory.delete(id);
        }
    }
    /**
     * Index a record by domain for semantic lookup.
     */
    indexByDomain(record) {
        const domain = this.extractDomain(record.urlPattern);
        const existing = this.semanticMemory.get(domain) ?? [];
        // Keep only the best record per element description
        const existingIndex = existing.findIndex(r => r.elementDescription === record.elementDescription);
        if (existingIndex >= 0) {
            const existingRecord = existing[existingIndex];
            if (existingRecord && record.successRate > existingRecord.successRate) {
                existing[existingIndex] = record;
            }
        }
        else {
            existing.push(record);
        }
        this.semanticMemory.set(domain, existing);
    }
    /**
     * Extract domain from URL pattern.
     */
    extractDomain(urlPattern) {
        try {
            if (urlPattern.startsWith('http')) {
                return new URL(urlPattern).hostname;
            }
            return urlPattern.split('/')[0] ?? urlPattern;
        }
        catch {
            return urlPattern;
        }
    }
    /**
     * Describe element for matching.
     */
    describeElement(context) {
        const parts = [];
        if (context.expectedTag) {
            parts.push(context.expectedTag);
        }
        if (context.action) {
            parts.push(context.action);
        }
        if (context.nearText) {
            parts.push(`near:${context.nearText.slice(0, 30)}`);
        }
        return parts.join('|');
    }
    /**
     * Generate unique ID.
     */
    generateId() {
        return `heal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    // ==========================================================================
    // METRICS
    // ==========================================================================
    /**
     * Get memory statistics.
     */
    getStats() {
        const episodicRecords = Array.from(this.episodicMemory.values());
        const avgSuccessRate = episodicRecords.length > 0
            ? episodicRecords.reduce((sum, r) => sum + r.successRate, 0) /
                episodicRecords.length
            : 0;
        return {
            workingMemorySize: this.workingMemory.size,
            episodicMemorySize: this.episodicMemory.size,
            semanticDomainsCount: this.semanticMemory.size,
            proceduralPatternsCount: this.proceduralMemory.size,
            totalHealingRecords: this.episodicMemory.size +
                Array.from(this.semanticMemory.values()).reduce((sum, arr) => sum + arr.length, 0),
            averageSuccessRate: avgSuccessRate,
        };
    }
    /**
     * Export memory for persistence.
     */
    exportMemory() {
        return {
            episodic: Array.from(this.episodicMemory.values()),
            semantic: Object.fromEntries(this.semanticMemory),
            procedural: Array.from(this.proceduralMemory.values()),
        };
    }
    /**
     * Import memory from persistence.
     */
    importMemory(data) {
        if (data.episodic) {
            for (const record of data.episodic) {
                this.episodicMemory.set(record.id, record);
            }
        }
        if (data.semantic) {
            for (const [domain, records] of Object.entries(data.semantic)) {
                this.semanticMemory.set(domain, records);
            }
        }
        if (data.procedural) {
            for (const record of data.procedural) {
                this.proceduralMemory.set(record.elementDescription, record);
            }
        }
    }
}
exports.HealingMemory = HealingMemory;
//# sourceMappingURL=healing-memory.js.map