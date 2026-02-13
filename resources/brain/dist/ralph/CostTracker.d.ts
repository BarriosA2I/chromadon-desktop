/**
 * RALPH Cost Tracking
 *
 * Monitors API costs and enforces limits to prevent runaway spending.
 */
export interface CostEntry {
    timestamp: number;
    iteration: number;
    operation: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd: number;
}
export interface CostSummary {
    totalCostUsd: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    entriesCount: number;
    costByOperation: Record<string, number>;
    costByModel: Record<string, number>;
    costByIteration: Record<number, number>;
    limitUsd: number;
    remainingUsd: number;
    percentUsed: number;
}
export declare class CostTracker {
    private baseDir;
    private costPath;
    private limitUsd;
    private entries;
    constructor(baseDir: string, limitUsd?: number);
    /**
     * Initialize cost tracking
     */
    initialize(): Promise<void>;
    /**
     * Record a cost entry
     */
    recordCost(entry: Omit<CostEntry, 'timestamp'>): Promise<void>;
    /**
     * Record cost from token usage
     */
    recordTokenUsage(iteration: number, operation: string, model: string, inputTokens: number, outputTokens: number): Promise<void>;
    /**
     * Get current cost summary
     */
    getSummary(): CostSummary;
    /**
     * Check if cost limit has been reached
     */
    isLimitReached(): boolean;
    /**
     * Check if approaching limit (80% threshold)
     */
    isApproachingLimit(): boolean;
    /**
     * Get remaining budget
     */
    getRemainingBudget(): number;
    /**
     * Get total cost
     */
    getTotalCost(): number;
    /**
     * Get cost for specific iteration
     */
    getIterationCost(iteration: number): number;
    /**
     * Set new cost limit
     */
    setLimit(limitUsd: number): void;
    /**
     * Get cost limit
     */
    getLimit(): number;
    /**
     * Save to filesystem
     */
    private save;
    /**
     * Estimate cost for an operation
     */
    static estimateCost(model: string, estimatedInputTokens: number, estimatedOutputTokens: number): number;
}
