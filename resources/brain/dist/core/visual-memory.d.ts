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
/// <reference types="node" />
/// <reference types="node" />
import { MemoryTier } from '../interfaces';
/**
 * Visual memory entry.
 */
export interface VisualMemoryEntry {
    id: string;
    screenshot: Buffer;
    url: string;
    timestamp: Date;
    metadata: Record<string, unknown>;
    tier: MemoryTier;
    accessCount: number;
    lastAccessed: Date;
}
/**
 * Checkpoint data stored in memory.
 */
export interface VisualCheckpoint {
    id: string;
    name: string;
    screenshot: Buffer;
    url: string;
    timestamp: Date;
    metadata: Record<string, unknown>;
}
/**
 * Baseline comparison data.
 */
export interface VisualBaseline {
    name: string;
    screenshot: Buffer;
    createdAt: Date;
    metadata: Record<string, unknown>;
}
/**
 * Configuration for visual memory.
 */
export interface VisualMemoryConfig {
    /** Max items in working memory. Default: 7 */
    workingMemoryLimit: number;
    /** Max items in episodic memory. Default: 100 */
    episodicMemoryLimit: number;
    /** Episodic decay time in hours. Default: 24 */
    episodicDecayHours: number;
    /** Enable automatic promotion to semantic. Default: true */
    autoPromote: boolean;
    /** Access threshold for promotion. Default: 5 */
    promotionThreshold: number;
}
/**
 * Visual Memory Manager for 4-tier memory hierarchy.
 */
export declare class VisualMemory {
    private config;
    private working;
    private episodic;
    private semantic;
    private procedural;
    private checkpoints;
    private baselines;
    constructor(config?: Partial<VisualMemoryConfig>);
    /**
     * Store screenshot in working memory.
     * Evicts oldest if limit exceeded.
     */
    storeWorking(id: string, screenshot: Buffer, url: string, metadata?: Record<string, unknown>): void;
    /**
     * Get from working memory.
     */
    getWorking(id: string): VisualMemoryEntry | null;
    /**
     * Get most recent working memory entry.
     */
    getMostRecent(): VisualMemoryEntry | null;
    /**
     * Promote entry from working to episodic.
     */
    private promoteToEpisodic;
    /**
     * Get from episodic memory with decay check.
     */
    getEpisodic(id: string): VisualMemoryEntry | null;
    /**
     * Run decay cleanup on episodic memory.
     */
    cleanupEpisodic(): number;
    /**
     * Promote from episodic to semantic (no decay).
     */
    private promoteToSemantic;
    /**
     * Store directly in semantic memory.
     */
    storeSemantic(id: string, screenshot: Buffer, url: string, metadata?: Record<string, unknown>): void;
    /**
     * Get from semantic memory.
     */
    getSemantic(id: string): VisualMemoryEntry | null;
    /**
     * Store successful verification pattern.
     */
    storeProcedural(id: string, screenshot: Buffer, url: string, metadata?: Record<string, unknown>): void;
    /**
     * Get procedural memory entry.
     */
    getProcedural(id: string): VisualMemoryEntry | null;
    /**
     * Find similar procedural patterns by URL.
     */
    findSimilarPatterns(url: string): VisualMemoryEntry[];
    /**
     * Save checkpoint.
     */
    saveCheckpoint(checkpoint: VisualCheckpoint): void;
    /**
     * Get checkpoint by ID.
     */
    getCheckpoint(id: string): VisualCheckpoint | null;
    /**
     * Get checkpoint by name.
     */
    getCheckpointByName(name: string): VisualCheckpoint | null;
    /**
     * List all checkpoints.
     */
    listCheckpoints(): Array<{
        id: string;
        name: string;
        timestamp: Date;
    }>;
    /**
     * Delete checkpoint.
     */
    deleteCheckpoint(id: string): boolean;
    /**
     * Save baseline screenshot.
     */
    saveBaseline(name: string, screenshot: Buffer, metadata?: Record<string, unknown>): void;
    /**
     * Get baseline by name.
     */
    getBaseline(name: string): VisualBaseline | null;
    /**
     * List all baselines.
     */
    listBaselines(): string[];
    /**
     * Delete baseline.
     */
    deleteBaseline(name: string): boolean;
    /**
     * Search all tiers for entry by ID.
     * Returns from most recent tier first.
     */
    find(id: string): VisualMemoryEntry | null;
    /**
     * Search all tiers by URL pattern.
     */
    findByUrl(urlPattern: string | RegExp): VisualMemoryEntry[];
    /**
     * Find oldest entry in a memory tier.
     */
    private findOldest;
    /**
     * Get memory statistics.
     */
    getStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
        checkpoints: number;
        baselines: number;
    };
    /**
     * Clear all memory tiers.
     */
    clear(): void;
}
//# sourceMappingURL=visual-memory.d.ts.map