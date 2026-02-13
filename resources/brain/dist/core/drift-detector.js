"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDriftDetector = exports.DriftDetector = void 0;
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    recentWindowMs: 5 * 60 * 1000, // 5 minutes
    healthyThreshold: 0.9,
    degradingThreshold: 0.7,
    criticalThreshold: 0.5,
    consecutiveFailureThreshold: 3,
    driftScoreThreshold: 0.3,
    minUsagesForMetrics: 5,
    maxHistoryPerSelector: 100,
};
// =============================================================================
// DRIFT DETECTOR
// =============================================================================
/**
 * Drift Detector for monitoring selector stability.
 *
 * Proactively detects selector degradation and triggers healing
 * before complete failure occurs.
 */
class DriftDetector {
    config;
    usageHistory;
    healthCache;
    eventListeners;
    consecutiveFailures;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.usageHistory = new Map();
        this.healthCache = new Map();
        this.eventListeners = [];
        this.consecutiveFailures = new Map();
    }
    // ===========================================================================
    // USAGE TRACKING
    // ===========================================================================
    /**
     * Record a selector usage.
     *
     * @param usage - Usage record
     */
    recordUsage(usage) {
        const key = this.getSelectorKey(usage.selector, usage.strategy);
        const history = this.usageHistory.get(key) ?? [];
        // Add new usage
        history.push(usage);
        // Enforce max history
        if (history.length > this.config.maxHistoryPerSelector) {
            history.shift();
        }
        this.usageHistory.set(key, history);
        // Update consecutive failures
        if (usage.success) {
            this.consecutiveFailures.set(key, 0);
        }
        else {
            const current = this.consecutiveFailures.get(key) ?? 0;
            this.consecutiveFailures.set(key, current + 1);
        }
        // Recalculate health and check for drift
        const previousHealth = this.healthCache.get(key)?.health;
        const metrics = this.calculateHealth(usage.selector, usage.strategy);
        this.healthCache.set(key, metrics);
        // Emit drift event if health changed
        if (previousHealth && previousHealth !== metrics.health) {
            this.emitDriftEvent({
                type: this.getDriftEventType(previousHealth, metrics.health),
                selector: usage.selector,
                previousHealth,
                currentHealth: metrics.health,
                metrics,
                timestamp: new Date(),
            });
        }
    }
    /**
     * Record a successful selector usage.
     */
    recordSuccess(selector, strategy, duration, url) {
        this.recordUsage({
            selector,
            strategy,
            timestamp: new Date(),
            success: true,
            duration,
            url,
        });
    }
    /**
     * Record a failed selector usage.
     */
    recordFailure(selector, strategy, duration, url) {
        this.recordUsage({
            selector,
            strategy,
            timestamp: new Date(),
            success: false,
            duration,
            url,
        });
    }
    // ===========================================================================
    // HEALTH CALCULATION
    // ===========================================================================
    /**
     * Calculate health metrics for a selector.
     *
     * @param selector - Selector value
     * @param strategy - Selector strategy
     * @returns Health metrics
     */
    calculateHealth(selector, strategy) {
        const key = this.getSelectorKey(selector, strategy);
        const history = this.usageHistory.get(key) ?? [];
        if (history.length === 0) {
            return this.getDefaultMetrics(selector, strategy);
        }
        const now = Date.now();
        const recentCutoff = now - this.config.recentWindowMs;
        // Calculate overall metrics
        const totalUsages = history.length;
        const successes = history.filter(u => u.success).length;
        const successRate = successes / totalUsages;
        // Calculate recent metrics
        const recentHistory = history.filter(u => u.timestamp.getTime() > recentCutoff);
        const recentUsages = recentHistory.length;
        const recentSuccesses = recentHistory.filter(u => u.success).length;
        const recentSuccessRate = recentUsages > 0 ? recentSuccesses / recentUsages : successRate;
        // Calculate average duration (only for successes)
        const successfulUsages = history.filter(u => u.success);
        const averageDuration = successfulUsages.length > 0
            ? successfulUsages.reduce((sum, u) => sum + u.duration, 0) /
                successfulUsages.length
            : 0;
        // Calculate drift score (difference between overall and recent)
        const driftScore = Math.abs(successRate - recentSuccessRate);
        // Find last success and failure
        const sortedHistory = [...history].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const lastSuccess = sortedHistory.find(u => u.success)?.timestamp ?? null;
        const lastFailure = sortedHistory.find(u => !u.success)?.timestamp ?? null;
        // Get consecutive failures
        const consecutiveFailures = this.consecutiveFailures.get(key) ?? 0;
        // Determine health status
        const health = this.determineHealth(recentSuccessRate, consecutiveFailures, driftScore);
        // Determine if healing is needed
        const needsHealing = this.shouldTriggerHealing(health, consecutiveFailures, driftScore);
        return {
            selector,
            strategy,
            health,
            successRate,
            recentSuccessRate,
            totalUsages,
            recentUsages,
            averageDuration,
            driftScore,
            lastSuccess,
            lastFailure,
            consecutiveFailures,
            needsHealing,
        };
    }
    /**
     * Determine health status based on metrics.
     */
    determineHealth(recentSuccessRate, consecutiveFailures, driftScore) {
        // Immediate failure if too many consecutive failures
        if (consecutiveFailures >= this.config.consecutiveFailureThreshold) {
            return 'failed';
        }
        // Check recent success rate
        if (recentSuccessRate >= this.config.healthyThreshold) {
            return 'healthy';
        }
        else if (recentSuccessRate >= this.config.degradingThreshold) {
            return 'degrading';
        }
        else if (recentSuccessRate >= this.config.criticalThreshold) {
            return 'critical';
        }
        else {
            return 'failed';
        }
    }
    /**
     * Determine if healing should be triggered.
     */
    shouldTriggerHealing(health, consecutiveFailures, driftScore) {
        // Always heal if failed
        if (health === 'failed') {
            return true;
        }
        // Heal if critical
        if (health === 'critical') {
            return true;
        }
        // Proactive healing if drift is high
        if (driftScore >= this.config.driftScoreThreshold) {
            return true;
        }
        // Heal if consecutive failures approach threshold
        if (consecutiveFailures >= this.config.consecutiveFailureThreshold - 1) {
            return true;
        }
        return false;
    }
    /**
     * Get default metrics for unknown selector.
     */
    getDefaultMetrics(selector, strategy) {
        return {
            selector,
            strategy,
            health: 'healthy',
            successRate: 1,
            recentSuccessRate: 1,
            totalUsages: 0,
            recentUsages: 0,
            averageDuration: 0,
            driftScore: 0,
            lastSuccess: null,
            lastFailure: null,
            consecutiveFailures: 0,
            needsHealing: false,
        };
    }
    // ===========================================================================
    // EVENT HANDLING
    // ===========================================================================
    /**
     * Subscribe to drift events.
     */
    onDrift(callback) {
        this.eventListeners.push(callback);
    }
    /**
     * Emit a drift event.
     */
    emitDriftEvent(event) {
        for (const listener of this.eventListeners) {
            try {
                listener(event);
            }
            catch (error) {
                // Ignore listener errors
            }
        }
    }
    /**
     * Determine drift event type from health transition.
     */
    getDriftEventType(previous, current) {
        const healthOrder = [
            'failed',
            'critical',
            'degrading',
            'healthy',
        ];
        const prevIndex = healthOrder.indexOf(previous);
        const currIndex = healthOrder.indexOf(current);
        if (currIndex > prevIndex) {
            return 'recovered';
        }
        else if (current === 'failed') {
            return 'failed';
        }
        else if (current === 'critical') {
            return 'critical';
        }
        else {
            return 'degrading';
        }
    }
    // ===========================================================================
    // QUERIES
    // ===========================================================================
    /**
     * Get health metrics for a selector.
     */
    getHealth(selector, strategy) {
        const key = this.getSelectorKey(selector, strategy);
        const cached = this.healthCache.get(key);
        if (cached) {
            return cached;
        }
        return this.calculateHealth(selector, strategy);
    }
    /**
     * Get all selectors that need healing.
     */
    getSelectorsNeedingHealing() {
        const results = [];
        for (const [key, _history] of this.usageHistory) {
            const [selector, strategy] = this.parseSelectorKey(key);
            const metrics = this.calculateHealth(selector, strategy);
            if (metrics.needsHealing) {
                results.push(metrics);
            }
        }
        return results.sort((a, b) => {
            // Sort by health severity then by consecutive failures
            const healthOrder = [
                'failed',
                'critical',
                'degrading',
                'healthy',
            ];
            const aIndex = healthOrder.indexOf(a.health);
            const bIndex = healthOrder.indexOf(b.health);
            if (aIndex !== bIndex) {
                return aIndex - bIndex;
            }
            return b.consecutiveFailures - a.consecutiveFailures;
        });
    }
    /**
     * Get all tracked selectors with their health.
     */
    getAllHealth() {
        const results = [];
        for (const [key, _history] of this.usageHistory) {
            const [selector, strategy] = this.parseSelectorKey(key);
            const metrics = this.calculateHealth(selector, strategy);
            results.push(metrics);
        }
        return results;
    }
    /**
     * Check if a selector is stable (healthy with good history).
     */
    isStable(selector, strategy) {
        const metrics = this.getHealth(selector, strategy);
        return (metrics.health === 'healthy' &&
            metrics.totalUsages >= this.config.minUsagesForMetrics &&
            metrics.driftScore < this.config.driftScoreThreshold);
    }
    // ===========================================================================
    // UTILITIES
    // ===========================================================================
    /**
     * Get selector key for storage.
     */
    getSelectorKey(selector, strategy) {
        return `${strategy}:${selector}`;
    }
    /**
     * Parse selector key.
     */
    parseSelectorKey(key) {
        const colonIndex = key.indexOf(':');
        if (colonIndex === -1) {
            return [key, 'css'];
        }
        return [key.slice(colonIndex + 1), key.slice(0, colonIndex)];
    }
    /**
     * Clear all history for a selector.
     */
    clearHistory(selector, strategy) {
        const key = this.getSelectorKey(selector, strategy);
        this.usageHistory.delete(key);
        this.healthCache.delete(key);
        this.consecutiveFailures.delete(key);
    }
    /**
     * Clear all history.
     */
    clearAllHistory() {
        this.usageHistory.clear();
        this.healthCache.clear();
        this.consecutiveFailures.clear();
    }
    /**
     * Get configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration.
     */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get statistics.
     */
    getStats() {
        const allHealth = this.getAllHealth();
        return {
            totalSelectors: allHealth.length,
            healthyCount: allHealth.filter(h => h.health === 'healthy').length,
            degradingCount: allHealth.filter(h => h.health === 'degrading').length,
            criticalCount: allHealth.filter(h => h.health === 'critical').length,
            failedCount: allHealth.filter(h => h.health === 'failed').length,
            needsHealingCount: allHealth.filter(h => h.needsHealing).length,
        };
    }
}
exports.DriftDetector = DriftDetector;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a drift detector instance.
 *
 * @param config - Configuration options
 */
function createDriftDetector(config) {
    return new DriftDetector(config);
}
exports.createDriftDetector = createDriftDetector;
//# sourceMappingURL=drift-detector.js.map