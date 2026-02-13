"use strict";
/**
 * Visual Memory System
 *
 * Neural RAG Brain Pattern: 4-Tier Memory Hierarchy
 *
 * Manages visual context across memory tiers:
 * - L0 Working: Current screenshots, 7±2 items
 * - L1 Episodic: Session screenshots, 24h decay
 * - L2 Semantic: Baseline patterns, no decay
 * - L3 Procedural: Successful verification patterns
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisualMemory = void 0;
const pino_1 = __importDefault(require("pino"));
const interfaces_1 = require("../interfaces");
const logger = (0, pino_1.default)({ name: 'visual-memory' });
const DEFAULT_CONFIG = {
    workingMemoryLimit: 7,
    episodicMemoryLimit: 100,
    episodicDecayHours: 24,
    autoPromote: true,
    promotionThreshold: 5,
};
/**
 * Visual Memory Manager for 4-tier memory hierarchy.
 */
class VisualMemory {
    config;
    // Memory tiers
    working = new Map();
    episodic = new Map();
    semantic = new Map();
    procedural = new Map();
    // Specialized storage
    checkpoints = new Map();
    baselines = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ==========================================================================
    // WORKING MEMORY (L0)
    // ==========================================================================
    /**
     * Store screenshot in working memory.
     * Evicts oldest if limit exceeded.
     */
    storeWorking(id, screenshot, url, metadata = {}) {
        // Evict oldest if at limit
        if (this.working.size >= this.config.workingMemoryLimit) {
            const oldest = this.findOldest(this.working);
            if (oldest) {
                // Promote to episodic before evicting
                this.promoteToEpisodic(oldest);
                this.working.delete(oldest);
            }
        }
        const entry = {
            id,
            screenshot,
            url,
            timestamp: new Date(),
            metadata,
            tier: interfaces_1.MemoryTier.WORKING,
            accessCount: 0,
            lastAccessed: new Date(),
        };
        this.working.set(id, entry);
        logger.debug({ id, tier: 'working' }, 'Stored visual memory');
    }
    /**
     * Get from working memory.
     */
    getWorking(id) {
        const entry = this.working.get(id);
        if (entry) {
            entry.accessCount++;
            entry.lastAccessed = new Date();
        }
        return entry ?? null;
    }
    /**
     * Get most recent working memory entry.
     */
    getMostRecent() {
        let mostRecent = null;
        for (const entry of this.working.values()) {
            if (!mostRecent || entry.timestamp > mostRecent.timestamp) {
                mostRecent = entry;
            }
        }
        return mostRecent;
    }
    // ==========================================================================
    // EPISODIC MEMORY (L1)
    // ==========================================================================
    /**
     * Promote entry from working to episodic.
     */
    promoteToEpisodic(id) {
        const entry = this.working.get(id);
        if (!entry)
            return;
        entry.tier = interfaces_1.MemoryTier.EPISODIC;
        this.episodic.set(id, entry);
        // Enforce episodic limit
        if (this.episodic.size > this.config.episodicMemoryLimit) {
            const oldest = this.findOldest(this.episodic);
            if (oldest) {
                this.episodic.delete(oldest);
            }
        }
        logger.debug({ id, tier: 'episodic' }, 'Promoted to episodic memory');
    }
    /**
     * Get from episodic memory with decay check.
     */
    getEpisodic(id) {
        const entry = this.episodic.get(id);
        if (!entry)
            return null;
        // Check decay
        const ageHours = (Date.now() - entry.timestamp.getTime()) / (1000 * 60 * 60);
        if (ageHours > this.config.episodicDecayHours) {
            this.episodic.delete(id);
            logger.debug({ id, ageHours }, 'Episodic memory decayed');
            return null;
        }
        entry.accessCount++;
        entry.lastAccessed = new Date();
        // Auto-promote to semantic if frequently accessed
        if (this.config.autoPromote && entry.accessCount >= this.config.promotionThreshold) {
            this.promoteToSemantic(id);
        }
        return entry;
    }
    /**
     * Run decay cleanup on episodic memory.
     */
    cleanupEpisodic() {
        const decayThreshold = Date.now() - this.config.episodicDecayHours * 60 * 60 * 1000;
        let cleaned = 0;
        for (const [id, entry] of this.episodic) {
            if (entry.timestamp.getTime() < decayThreshold) {
                this.episodic.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info({ cleaned }, 'Cleaned up decayed episodic memories');
        }
        return cleaned;
    }
    // ==========================================================================
    // SEMANTIC MEMORY (L2)
    // ==========================================================================
    /**
     * Promote from episodic to semantic (no decay).
     */
    promoteToSemantic(id) {
        const entry = this.episodic.get(id);
        if (!entry)
            return;
        entry.tier = interfaces_1.MemoryTier.SEMANTIC;
        this.semantic.set(id, entry);
        this.episodic.delete(id);
        logger.info({ id, accessCount: entry.accessCount }, 'Promoted to semantic memory');
    }
    /**
     * Store directly in semantic memory.
     */
    storeSemantic(id, screenshot, url, metadata = {}) {
        const entry = {
            id,
            screenshot,
            url,
            timestamp: new Date(),
            metadata,
            tier: interfaces_1.MemoryTier.SEMANTIC,
            accessCount: 0,
            lastAccessed: new Date(),
        };
        this.semantic.set(id, entry);
        logger.debug({ id, tier: 'semantic' }, 'Stored semantic memory');
    }
    /**
     * Get from semantic memory.
     */
    getSemantic(id) {
        const entry = this.semantic.get(id);
        if (entry) {
            entry.accessCount++;
            entry.lastAccessed = new Date();
        }
        return entry ?? null;
    }
    // ==========================================================================
    // PROCEDURAL MEMORY (L3)
    // ==========================================================================
    /**
     * Store successful verification pattern.
     */
    storeProcedural(id, screenshot, url, metadata = {}) {
        const entry = {
            id,
            screenshot,
            url,
            timestamp: new Date(),
            metadata,
            tier: interfaces_1.MemoryTier.PROCEDURAL,
            accessCount: 0,
            lastAccessed: new Date(),
        };
        this.procedural.set(id, entry);
        logger.debug({ id, tier: 'procedural' }, 'Stored procedural memory');
    }
    /**
     * Get procedural memory entry.
     */
    getProcedural(id) {
        return this.procedural.get(id) ?? null;
    }
    /**
     * Find similar procedural patterns by URL.
     */
    findSimilarPatterns(url) {
        const patterns = [];
        const urlBase = new URL(url).pathname;
        for (const entry of this.procedural.values()) {
            try {
                const entryBase = new URL(entry.url).pathname;
                if (entryBase === urlBase) {
                    patterns.push(entry);
                }
            }
            catch {
                // Invalid URL, skip
            }
        }
        return patterns.sort((a, b) => b.accessCount - a.accessCount);
    }
    // ==========================================================================
    // CHECKPOINT MANAGEMENT
    // ==========================================================================
    /**
     * Save checkpoint.
     */
    saveCheckpoint(checkpoint) {
        this.checkpoints.set(checkpoint.id, checkpoint);
        logger.info({ id: checkpoint.id, name: checkpoint.name }, 'Saved checkpoint');
    }
    /**
     * Get checkpoint by ID.
     */
    getCheckpoint(id) {
        return this.checkpoints.get(id) ?? null;
    }
    /**
     * Get checkpoint by name.
     */
    getCheckpointByName(name) {
        for (const checkpoint of this.checkpoints.values()) {
            if (checkpoint.name === name) {
                return checkpoint;
            }
        }
        return null;
    }
    /**
     * List all checkpoints.
     */
    listCheckpoints() {
        return Array.from(this.checkpoints.values()).map(cp => ({
            id: cp.id,
            name: cp.name,
            timestamp: cp.timestamp,
        }));
    }
    /**
     * Delete checkpoint.
     */
    deleteCheckpoint(id) {
        return this.checkpoints.delete(id);
    }
    // ==========================================================================
    // BASELINE MANAGEMENT
    // ==========================================================================
    /**
     * Save baseline screenshot.
     */
    saveBaseline(name, screenshot, metadata = {}) {
        this.baselines.set(name, {
            name,
            screenshot,
            createdAt: new Date(),
            metadata,
        });
        logger.info({ name }, 'Saved baseline');
    }
    /**
     * Get baseline by name.
     */
    getBaseline(name) {
        return this.baselines.get(name) ?? null;
    }
    /**
     * List all baselines.
     */
    listBaselines() {
        return Array.from(this.baselines.keys());
    }
    /**
     * Delete baseline.
     */
    deleteBaseline(name) {
        return this.baselines.delete(name);
    }
    // ==========================================================================
    // CROSS-TIER SEARCH
    // ==========================================================================
    /**
     * Search all tiers for entry by ID.
     * Returns from most recent tier first.
     */
    find(id) {
        return (this.getWorking(id) ??
            this.getEpisodic(id) ??
            this.getSemantic(id) ??
            this.getProcedural(id));
    }
    /**
     * Search all tiers by URL pattern.
     */
    findByUrl(urlPattern) {
        const results = [];
        const pattern = typeof urlPattern === 'string'
            ? new RegExp(urlPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            : urlPattern;
        const allEntries = [
            ...this.working.values(),
            ...this.episodic.values(),
            ...this.semantic.values(),
            ...this.procedural.values(),
        ];
        for (const entry of allEntries) {
            if (pattern.test(entry.url)) {
                results.push(entry);
            }
        }
        return results;
    }
    // ==========================================================================
    // UTILITIES
    // ==========================================================================
    /**
     * Find oldest entry in a memory tier.
     */
    findOldest(tier) {
        let oldestId = null;
        let oldestTime = Infinity;
        for (const [id, entry] of tier) {
            if (entry.lastAccessed.getTime() < oldestTime) {
                oldestTime = entry.lastAccessed.getTime();
                oldestId = id;
            }
        }
        return oldestId;
    }
    /**
     * Get memory statistics.
     */
    getStats() {
        return {
            working: this.working.size,
            episodic: this.episodic.size,
            semantic: this.semantic.size,
            procedural: this.procedural.size,
            checkpoints: this.checkpoints.size,
            baselines: this.baselines.size,
        };
    }
    /**
     * Clear all memory tiers.
     */
    clear() {
        this.working.clear();
        this.episodic.clear();
        this.semantic.clear();
        this.procedural.clear();
        this.checkpoints.clear();
        this.baselines.clear();
        logger.info('Cleared all visual memory');
    }
}
exports.VisualMemory = VisualMemory;
//# sourceMappingURL=visual-memory.js.map