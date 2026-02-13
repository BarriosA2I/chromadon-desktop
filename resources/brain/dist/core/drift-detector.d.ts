/**
 * Drift Detector
 *
 * Neural RAG Brain Pattern: Proactive Monitoring
 *
 * Monitors selector stability and triggers proactive healing:
 * - Tracks selector success/failure rates over time
 * - Detects drift patterns (gradual degradation)
 * - Triggers healing before complete failure
 * - Maintains selector health scores
 */
import type { SelectorStrategy } from '../interfaces';
/**
 * Selector health status.
 */
export type SelectorHealth = 'healthy' | 'degrading' | 'critical' | 'failed';
/**
 * Selector usage record.
 */
export interface SelectorUsage {
    selector: string;
    strategy: SelectorStrategy;
    timestamp: Date;
    success: boolean;
    duration: number;
    url: string;
}
/**
 * Selector health metrics.
 */
export interface SelectorHealthMetrics {
    selector: string;
    strategy: SelectorStrategy;
    health: SelectorHealth;
    successRate: number;
    recentSuccessRate: number;
    totalUsages: number;
    recentUsages: number;
    averageDuration: number;
    driftScore: number;
    lastSuccess: Date | null;
    lastFailure: Date | null;
    consecutiveFailures: number;
    needsHealing: boolean;
}
/**
 * Drift detection event.
 */
export interface DriftEvent {
    type: 'degrading' | 'critical' | 'failed' | 'recovered';
    selector: string;
    previousHealth: SelectorHealth;
    currentHealth: SelectorHealth;
    metrics: SelectorHealthMetrics;
    timestamp: Date;
}
/**
 * Drift detector configuration.
 */
export interface DriftDetectorConfig {
    /** Window size for recent metrics (ms) */
    recentWindowMs: number;
    /** Success rate threshold for healthy status */
    healthyThreshold: number;
    /** Success rate threshold for degrading status */
    degradingThreshold: number;
    /** Success rate threshold for critical status */
    criticalThreshold: number;
    /** Consecutive failures to trigger healing */
    consecutiveFailureThreshold: number;
    /** Drift score threshold for proactive healing */
    driftScoreThreshold: number;
    /** Minimum usages for reliable metrics */
    minUsagesForMetrics: number;
    /** Maximum history entries per selector */
    maxHistoryPerSelector: number;
}
/**
 * Drift Detector for monitoring selector stability.
 *
 * Proactively detects selector degradation and triggers healing
 * before complete failure occurs.
 */
export declare class DriftDetector {
    private config;
    private usageHistory;
    private healthCache;
    private eventListeners;
    private consecutiveFailures;
    constructor(config?: Partial<DriftDetectorConfig>);
    /**
     * Record a selector usage.
     *
     * @param usage - Usage record
     */
    recordUsage(usage: SelectorUsage): void;
    /**
     * Record a successful selector usage.
     */
    recordSuccess(selector: string, strategy: SelectorStrategy, duration: number, url: string): void;
    /**
     * Record a failed selector usage.
     */
    recordFailure(selector: string, strategy: SelectorStrategy, duration: number, url: string): void;
    /**
     * Calculate health metrics for a selector.
     *
     * @param selector - Selector value
     * @param strategy - Selector strategy
     * @returns Health metrics
     */
    calculateHealth(selector: string, strategy: SelectorStrategy): SelectorHealthMetrics;
    /**
     * Determine health status based on metrics.
     */
    private determineHealth;
    /**
     * Determine if healing should be triggered.
     */
    private shouldTriggerHealing;
    /**
     * Get default metrics for unknown selector.
     */
    private getDefaultMetrics;
    /**
     * Subscribe to drift events.
     */
    onDrift(callback: (event: DriftEvent) => void): void;
    /**
     * Emit a drift event.
     */
    private emitDriftEvent;
    /**
     * Determine drift event type from health transition.
     */
    private getDriftEventType;
    /**
     * Get health metrics for a selector.
     */
    getHealth(selector: string, strategy: SelectorStrategy): SelectorHealthMetrics;
    /**
     * Get all selectors that need healing.
     */
    getSelectorsNeedingHealing(): SelectorHealthMetrics[];
    /**
     * Get all tracked selectors with their health.
     */
    getAllHealth(): SelectorHealthMetrics[];
    /**
     * Check if a selector is stable (healthy with good history).
     */
    isStable(selector: string, strategy: SelectorStrategy): boolean;
    /**
     * Get selector key for storage.
     */
    private getSelectorKey;
    /**
     * Parse selector key.
     */
    private parseSelectorKey;
    /**
     * Clear all history for a selector.
     */
    clearHistory(selector: string, strategy: SelectorStrategy): void;
    /**
     * Clear all history.
     */
    clearAllHistory(): void;
    /**
     * Get configuration.
     */
    getConfig(): DriftDetectorConfig;
    /**
     * Update configuration.
     */
    configure(config: Partial<DriftDetectorConfig>): void;
    /**
     * Get statistics.
     */
    getStats(): {
        totalSelectors: number;
        healthyCount: number;
        degradingCount: number;
        criticalCount: number;
        failedCount: number;
        needsHealingCount: number;
    };
}
/**
 * Create a drift detector instance.
 *
 * @param config - Configuration options
 */
export declare function createDriftDetector(config?: Partial<DriftDetectorConfig>): DriftDetector;
//# sourceMappingURL=drift-detector.d.ts.map