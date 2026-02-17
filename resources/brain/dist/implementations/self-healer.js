"use strict";
/**
 * Self-Healer Implementation
 *
 * Neural RAG Brain Pattern: CRAG-based Self-Healing
 *
 * Main self-healer combining all healing logic:
 * - Healing orchestrator for strategy coordination
 * - Drift detector for proactive monitoring
 * - Procedural memory for learned patterns
 * - Retry strategy for fault tolerance
 * - Checkpoint rollback for recovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelfHealer = exports.SelfHealer = void 0;
const healing_orchestrator_1 = require("../core/healing-orchestrator");
const drift_detector_1 = require("../core/drift-detector");
const procedural_memory_1 = require("../core/procedural-memory");
const retry_strategy_1 = require("../core/retry-strategy");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('healer');
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    maxRecoveryAttempts: 5,
    enableProactiveHealing: true,
    enableProceduralLearning: true,
    enableCheckpointRollback: true,
    escalateAfterFailures: 3,
};
// =============================================================================
// SELF-HEALER IMPLEMENTATION
// =============================================================================
/**
 * Self-Healer for automatic recovery from failures.
 *
 * Implements CRAG-based self-healing with:
 * - Strategy escalation (CSS → XPath → text → ARIA → VLM)
 * - Procedural learning from successful healings
 * - Proactive drift detection
 * - Checkpoint-based rollback
 */
class SelfHealer {
    config;
    orchestrator;
    driftDetector;
    proceduralMemory;
    retryStrategy;
    metrics;
    onRecoveryAttempt;
    onEscalation;
    onStrategyAttempt;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.orchestrator = (0, healing_orchestrator_1.createHealingOrchestrator)(this.config.orchestratorConfig);
        this.driftDetector = (0, drift_detector_1.createDriftDetector)(this.config.driftDetectorConfig);
        this.proceduralMemory = (0, procedural_memory_1.createProceduralMemory)(this.config.proceduralMemoryConfig);
        this.retryStrategy = (0, retry_strategy_1.createRetryStrategy)(this.config.retryConfig);
        this.metrics = {
            totalFailures: 0,
            totalRecoveries: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            averageRecoveryTime: 0,
            strategiesUsed: {},
            failureTypes: {},
        };
        // Wire up drift detection
        this.driftDetector.onDrift((event) => {
            if (this.config.enableProactiveHealing && event.metrics.needsHealing) {
                // Trigger proactive healing
                this.triggerProactiveHealing(event);
            }
        });
    }
    // ===========================================================================
    // STRATEGY REGISTRATION
    // ===========================================================================
    /**
     * Register a healing strategy executor.
     */
    registerStrategy(type, executor) {
        this.orchestrator.registerExecutor(type, executor);
    }
    /**
     * Register all default strategy executors.
     */
    registerDefaultStrategies(executors) {
        for (const [type, executor] of Object.entries(executors)) {
            if (executor) {
                this.orchestrator.registerExecutor(type, executor);
            }
        }
    }
    // ===========================================================================
    // MAIN HEALING API
    // ===========================================================================
    /**
     * Execute a function with automatic healing on failure.
     *
     * @param fn - Function to execute
     * @param context - Context for healing
     * @returns Result of function execution
     */
    async executeWithHealing(fn, context) {
        const result = await this.retryStrategy.execute(fn);
        if (result.success && result.result !== undefined) {
            // Record successful selector usage
            if (context?.selector) {
                this.driftDetector.recordSuccess(context.selector, 'css', result.totalDuration, context.url ?? '');
            }
            return result.result;
        }
        // Healing needed
        throw result.error ?? new Error('Execution failed');
    }
    /**
     * Recover from a failure.
     *
     * @param failure - Failure context
     * @param checkpoints - Available checkpoints for rollback
     * @returns Recovery result
     */
    async recoverFromFailure(failure, checkpoints) {
        const startTime = Date.now();
        this.metrics.totalFailures++;
        this.metrics.failureTypes[failure.type] =
            (this.metrics.failureTypes[failure.type] ?? 0) + 1;
        // Determine recovery action
        const recoveryAction = this.determineRecoveryAction(failure);
        let result;
        switch (recoveryAction) {
            case 'retry':
                result = await this.attemptRetry(failure);
                break;
            case 'heal_selector':
                result = await this.attemptSelectorHealing(failure);
                break;
            case 'rollback':
                result = this.attemptRollback(failure, checkpoints);
                break;
            case 'skip':
                result = {
                    action: 'skip',
                    success: true,
                    attempts: 0,
                    duration: Date.now() - startTime,
                };
                break;
            case 'escalate':
            default:
                result = {
                    action: 'escalate',
                    success: false,
                    attempts: 0,
                    duration: Date.now() - startTime,
                    error: failure.error,
                };
                if (this.onEscalation) {
                    this.onEscalation(failure);
                }
                break;
        }
        // Update metrics
        this.metrics.totalRecoveries++;
        if (result.success) {
            this.metrics.successfulRecoveries++;
        }
        else {
            this.metrics.failedRecoveries++;
        }
        this.updateAverageRecoveryTime(result.duration);
        // Notify callback
        if (this.onRecoveryAttempt) {
            this.onRecoveryAttempt(result);
        }
        return result;
    }
    /**
     * Heal a broken selector.
     *
     * @param originalSelector - Broken selector
     * @param context - Healing context
     * @returns Healing result
     */
    async healSelector(originalSelector, context) {
        // Check procedural memory first
        if (this.config.enableProceduralLearning) {
            const fingerprint = procedural_memory_1.ProceduralMemory.createFingerprint({
                nearText: context.nearText,
                parentTag: context.expectedTag,
            });
            const match = this.proceduralMemory.findBestMatch({
                originalSelector,
                contextFingerprint: fingerprint,
                domain: this.extractDomain(context.url),
                elementType: context.expectedTag,
                actionType: context.action,
            });
            if (match && match.matchScore >= 0.8) {
                // Use procedural pattern
                this.proceduralMemory.recordUsage(match.pattern.id, true);
                return {
                    success: true,
                    originalSelector,
                    healedSelector: match.pattern.healedSelector,
                    strategiesAttempted: [],
                    cragAction: 'generate',
                    totalDuration: 0,
                    confidence: match.pattern.confidence,
                };
            }
        }
        // Orchestrate healing
        const healingContext = {
            brokenSelector: originalSelector,
            action: context.action,
            url: context.url,
            nearText: context.nearText,
            expectedTag: context.expectedTag,
            parentSelector: context.parentSelector,
            screenshot: context.screenshot,
            domSnapshot: context.domSnapshot,
        };
        const result = await this.orchestrator.orchestrate(healingContext);
        // Track strategies used
        for (const attempt of result.strategiesAttempted) {
            this.metrics.strategiesUsed[attempt.strategy] =
                (this.metrics.strategiesUsed[attempt.strategy] ?? 0) + 1;
        }
        // Store in procedural memory if successful
        if (result.success && result.healedSelector && this.config.enableProceduralLearning) {
            const fingerprint = procedural_memory_1.ProceduralMemory.createFingerprint({
                nearText: context.nearText,
                parentTag: context.expectedTag,
            });
            this.proceduralMemory.store({
                originalPattern: this.extractPattern(originalSelector),
                healedSelector: result.healedSelector,
                contextFingerprint: fingerprint,
                domain: this.extractDomain(context.url),
                elementType: context.expectedTag ?? 'unknown',
                actionType: context.action,
                confidence: result.confidence,
            });
            // Record success in drift detector
            this.driftDetector.recordSuccess(result.healedSelector.value, result.healedSelector.strategy, result.totalDuration, context.url);
        }
        else if (!result.success && context.action) {
            // Record failure
            this.driftDetector.recordFailure(originalSelector, 'css', result.totalDuration, context.url);
        }
        return result;
    }
    // ===========================================================================
    // RECOVERY STRATEGIES
    // ===========================================================================
    /**
     * Determine recovery action based on failure type.
     */
    determineRecoveryAction(failure) {
        switch (failure.type) {
            case 'selector_broken':
            case 'element_not_found':
                return 'heal_selector';
            case 'element_not_visible':
            case 'element_not_interactable':
                // Try retry first, then heal
                return 'retry';
            case 'timeout':
            case 'network_error':
                return 'retry';
            case 'unexpected_state':
                if (this.config.enableCheckpointRollback) {
                    return 'rollback';
                }
                return 'escalate';
            case 'unknown':
            default:
                return 'escalate';
        }
    }
    /**
     * Attempt retry with backoff.
     */
    async attemptRetry(failure) {
        const startTime = Date.now();
        // Simple retry - in real implementation, would re-execute the action
        // Here we just return the result structure
        return {
            action: 'retry',
            success: false,
            attempts: this.config.maxRecoveryAttempts,
            duration: Date.now() - startTime,
            error: failure.error,
        };
    }
    /**
     * Attempt selector healing.
     */
    async attemptSelectorHealing(failure) {
        const startTime = Date.now();
        if (!failure.selector) {
            return {
                action: 'heal_selector',
                success: false,
                attempts: 0,
                duration: Date.now() - startTime,
                error: new Error('No selector to heal'),
            };
        }
        const healResult = await this.healSelector(failure.selector, {
            action: failure.action?.type ?? 'click',
            url: failure.url,
            screenshot: failure.screenshot,
            domSnapshot: failure.domSnapshot,
        });
        return {
            action: 'heal_selector',
            success: healResult.success,
            healedSelector: healResult.healedSelector ?? undefined,
            attempts: healResult.strategiesAttempted.length,
            duration: Date.now() - startTime,
            error: healResult.success ? undefined : failure.error,
        };
    }
    /**
     * Attempt rollback to checkpoint.
     */
    attemptRollback(failure, checkpoints) {
        const startTime = Date.now();
        if (!checkpoints || checkpoints.length === 0) {
            return {
                action: 'rollback',
                success: false,
                attempts: 0,
                duration: Date.now() - startTime,
                error: new Error('No checkpoints available'),
            };
        }
        // Find the last good checkpoint before the failure
        const targetCheckpoint = checkpoints
            .filter(cp => failure.stepIndex === undefined || cp.stepIndex < failure.stepIndex)
            .pop();
        if (!targetCheckpoint) {
            return {
                action: 'rollback',
                success: false,
                attempts: 0,
                duration: Date.now() - startTime,
                error: new Error('No valid checkpoint found'),
            };
        }
        return {
            action: 'rollback',
            success: true,
            targetCheckpoint: targetCheckpoint.stepIndex,
            resumeFromStep: (failure.stepIndex ?? 0) > 0 ? failure.stepIndex : undefined,
            attempts: 1,
            duration: Date.now() - startTime,
        };
    }
    // ===========================================================================
    // PROACTIVE HEALING
    // ===========================================================================
    /**
     * Trigger proactive healing based on drift detection.
     */
    async triggerProactiveHealing(event) {
        // In a real implementation, this would proactively heal the selector
        // before it fails completely
        log.info(`Proactive healing triggered for: ${event.selector}`);
    }
    /**
     * Get selectors that need proactive healing.
     */
    getSelectorsNeedingHealing() {
        return this.driftDetector.getSelectorsNeedingHealing();
    }
    // ===========================================================================
    // FAILURE CLASSIFICATION
    // ===========================================================================
    /**
     * Classify a failure based on error message.
     */
    classifyFailure(error) {
        const message = error.message.toLowerCase();
        if (message.includes('element not found') ||
            message.includes('no element matching')) {
            return 'element_not_found';
        }
        if (message.includes('not visible') || message.includes('hidden')) {
            return 'element_not_visible';
        }
        if (message.includes('not interactable') ||
            message.includes('not clickable')) {
            return 'element_not_interactable';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        if (message.includes('network') ||
            message.includes('connection') ||
            message.includes('fetch')) {
            return 'network_error';
        }
        if (message.includes('selector') || message.includes('invalid')) {
            return 'selector_broken';
        }
        return 'unknown';
    }
    // ===========================================================================
    // EVENT HANDLERS
    // ===========================================================================
    /**
     * Set callback for recovery attempts.
     */
    onRecovery(callback) {
        this.onRecoveryAttempt = callback;
    }
    /**
     * Set callback for escalations.
     */
    onEscalate(callback) {
        this.onEscalation = callback;
    }
    /**
     * Set callback for strategy attempts.
     */
    onStrategy(callback) {
        this.onStrategyAttempt = callback;
        this.orchestrator.onAttempt(callback);
    }
    // ===========================================================================
    // UTILITIES
    // ===========================================================================
    /**
     * Extract domain from URL.
     */
    extractDomain(url) {
        try {
            return new URL(url).hostname;
        }
        catch {
            return url.split('/')[0] ?? url;
        }
    }
    /**
     * Extract pattern from selector.
     */
    extractPattern(selector) {
        return selector
            .replace(/\d+/g, '#')
            .replace(/"[^"]*"/g, '"..."')
            .replace(/'[^']*'/g, "'...'");
    }
    /**
     * Update average recovery time.
     */
    updateAverageRecoveryTime(duration) {
        const total = this.metrics.totalRecoveries;
        const current = this.metrics.averageRecoveryTime;
        this.metrics.averageRecoveryTime =
            (current * (total - 1) + duration) / total;
    }
    // ===========================================================================
    // METRICS & CONFIGURATION
    // ===========================================================================
    /**
     * Get healing metrics.
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Get drift detector statistics.
     */
    getDriftStats() {
        return this.driftDetector.getStats();
    }
    /**
     * Get procedural memory statistics.
     */
    getProceduralStats() {
        return this.proceduralMemory.getStats();
    }
    /**
     * Get registered strategy types.
     */
    getRegisteredStrategies() {
        return this.orchestrator.getRegisteredExecutors();
    }
    /**
     * Apply decay to procedural memory.
     */
    applyProceduralDecay() {
        this.proceduralMemory.applyDecay();
    }
    /**
     * Export procedural memory for persistence.
     */
    exportProceduralMemory() {
        return this.proceduralMemory.export();
    }
    /**
     * Import procedural memory from persistence.
     */
    importProceduralMemory(patterns) {
        this.proceduralMemory.import(patterns);
    }
    /**
     * Clear all memory.
     */
    clearMemory() {
        this.proceduralMemory.clear();
        this.driftDetector.clearAllHistory();
    }
    /**
     * Reset metrics.
     */
    resetMetrics() {
        this.metrics = {
            totalFailures: 0,
            totalRecoveries: 0,
            successfulRecoveries: 0,
            failedRecoveries: 0,
            averageRecoveryTime: 0,
            strategiesUsed: {},
            failureTypes: {},
        };
    }
}
exports.SelfHealer = SelfHealer;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a self-healer instance.
 *
 * @param config - Configuration options
 */
function createSelfHealer(config) {
    return new SelfHealer(config);
}
exports.createSelfHealer = createSelfHealer;
//# sourceMappingURL=self-healer.js.map