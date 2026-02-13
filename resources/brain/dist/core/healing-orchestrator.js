"use strict";
/**
 * Healing Orchestrator
 *
 * Neural RAG Brain Pattern: CRAG-based Strategy Escalation
 *
 * Coordinates healing strategies in priority order:
 * 1. CSS fallback (same page, different selector)
 * 2. XPath fallback (structure-based)
 * 3. Text search (content-based)
 * 4. ARIA labels (accessibility-based)
 * 5. Visual locate (VLM-based, last resort)
 *
 * Applies CRAG pattern:
 * - GENERATE: High confidence (>0.7), use best strategy
 * - DECOMPOSE: Medium confidence (0.4-0.7), try multiple strategies
 * - WEBSEARCH: Low confidence (<0.4), escalate to VLM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealingOrchestrator = exports.HealingOrchestrator = void 0;
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_STRATEGIES = [
    {
        type: 'css',
        priority: 1,
        estimatedLatencyMs: 50,
        requiresExternalApi: false,
        maxAttempts: 3,
    },
    {
        type: 'xpath',
        priority: 2,
        estimatedLatencyMs: 75,
        requiresExternalApi: false,
        maxAttempts: 2,
    },
    {
        type: 'text',
        priority: 3,
        estimatedLatencyMs: 100,
        requiresExternalApi: false,
        maxAttempts: 2,
    },
    {
        type: 'aria',
        priority: 4,
        estimatedLatencyMs: 100,
        requiresExternalApi: false,
        maxAttempts: 2,
    },
    {
        type: 'testid',
        priority: 5,
        estimatedLatencyMs: 50,
        requiresExternalApi: false,
        maxAttempts: 1,
    },
    {
        type: 'visual',
        priority: 6,
        estimatedLatencyMs: 2000,
        requiresExternalApi: true,
        maxAttempts: 1,
    },
];
const DEFAULT_CONFIG = {
    maxStrategies: 5,
    healingTimeoutMs: 10000,
    earlyExitConfidence: 0.9,
    enableParallelExecution: false,
    strategyOrder: ['css', 'xpath', 'text', 'aria', 'testid', 'visual'],
};
// =============================================================================
// HEALING ORCHESTRATOR
// =============================================================================
/**
 * Healing Orchestrator for coordinating selector healing strategies.
 *
 * Uses CRAG pattern for intelligent strategy selection:
 * - High confidence → Use best strategy (GENERATE)
 * - Medium confidence → Try multiple strategies (DECOMPOSE)
 * - Low confidence → Escalate to VLM (WEBSEARCH/visual)
 */
class HealingOrchestrator {
    config;
    strategies;
    executors;
    onStrategyAttempt;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.strategies = new Map();
        this.executors = new Map();
        // Initialize default strategies
        for (const strategy of DEFAULT_STRATEGIES) {
            this.strategies.set(strategy.type, strategy);
        }
    }
    // ===========================================================================
    // STRATEGY REGISTRATION
    // ===========================================================================
    /**
     * Register a strategy executor.
     *
     * @param type - Strategy type
     * @param executor - Function that attempts healing
     */
    registerExecutor(type, executor) {
        this.executors.set(type, executor);
    }
    /**
     * Set callback for strategy attempts.
     */
    onAttempt(callback) {
        this.onStrategyAttempt = callback;
    }
    // ===========================================================================
    // ORCHESTRATION
    // ===========================================================================
    /**
     * Orchestrate healing with strategy escalation.
     *
     * @param context - Healing context
     * @returns Orchestration result
     */
    async orchestrate(context) {
        const startTime = Date.now();
        const attempts = [];
        let healedSelector = null;
        let bestConfidence = 0;
        // Determine CRAG action based on initial assessment
        const initialConfidence = this.assessInitialConfidence(context);
        const cragAction = this.determineCRAGAction(initialConfidence);
        // Get strategies in priority order
        const orderedStrategies = this.getOrderedStrategies(cragAction);
        for (const strategyType of orderedStrategies) {
            // Check timeout
            if (Date.now() - startTime > this.config.healingTimeoutMs) {
                break;
            }
            // Check if we have enough strategies
            if (attempts.length >= this.config.maxStrategies) {
                break;
            }
            const executor = this.executors.get(strategyType);
            if (!executor) {
                continue;
            }
            const attempt = await this.executeStrategy(strategyType, executor, context);
            attempts.push(attempt);
            // Notify callback
            if (this.onStrategyAttempt) {
                this.onStrategyAttempt(attempt);
            }
            if (attempt.success && attempt.selector) {
                if (attempt.confidence > bestConfidence) {
                    bestConfidence = attempt.confidence;
                    healedSelector = attempt.selector;
                }
                // Early exit if confidence is high enough
                if (attempt.confidence >= this.config.earlyExitConfidence) {
                    break;
                }
            }
        }
        return {
            success: healedSelector !== null,
            originalSelector: context.brokenSelector,
            healedSelector,
            strategiesAttempted: attempts,
            cragAction,
            totalDuration: Date.now() - startTime,
            confidence: bestConfidence,
        };
    }
    /**
     * Execute a single strategy.
     */
    async executeStrategy(type, executor, context) {
        const strategy = this.strategies.get(type);
        const startTime = Date.now();
        try {
            const selector = await executor(context);
            const duration = Date.now() - startTime;
            return {
                strategy: type,
                selector,
                success: selector !== null,
                duration,
                confidence: selector?.confidence ?? 0,
            };
        }
        catch (error) {
            return {
                strategy: type,
                selector: null,
                success: false,
                duration: Date.now() - startTime,
                error: error instanceof Error ? error : new Error(String(error)),
                confidence: 0,
            };
        }
    }
    // ===========================================================================
    // CRAG PATTERN
    // ===========================================================================
    /**
     * Assess initial confidence based on context.
     */
    assessInitialConfidence(context) {
        let confidence = 0.5; // Base confidence
        // Boost confidence if we have good context
        if (context.nearText) {
            confidence += 0.1;
        }
        if (context.expectedTag) {
            confidence += 0.1;
        }
        if (context.parentSelector) {
            confidence += 0.1;
        }
        if (context.domSnapshot) {
            confidence += 0.1;
        }
        // Reduce confidence for complex selectors
        if (context.brokenSelector.includes(':nth-child')) {
            confidence -= 0.1;
        }
        if (context.brokenSelector.includes('>>')) {
            confidence -= 0.1;
        }
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * Determine CRAG action based on confidence.
     */
    determineCRAGAction(confidence) {
        if (confidence > 0.7) {
            return 'generate';
        }
        else if (confidence > 0.4) {
            return 'decompose';
        }
        else {
            return 'websearch';
        }
    }
    /**
     * Get strategies ordered by CRAG action.
     */
    getOrderedStrategies(cragAction) {
        const allStrategies = [...this.config.strategyOrder];
        switch (cragAction) {
            case 'generate':
                // High confidence: Try fast strategies first
                return allStrategies.slice(0, 3);
            case 'decompose':
                // Medium confidence: Try all non-visual strategies
                return allStrategies.filter(s => s !== 'visual');
            case 'websearch':
                // Low confidence: Include visual as early option
                // Move visual up in priority
                const withVisual = allStrategies.filter(s => s !== 'visual');
                withVisual.splice(2, 0, 'visual');
                return withVisual;
            default:
                return allStrategies;
        }
    }
    // ===========================================================================
    // PARALLEL EXECUTION
    // ===========================================================================
    /**
     * Execute multiple strategies in parallel.
     *
     * @param context - Healing context
     * @param strategies - Strategies to try
     * @returns Best result from parallel execution
     */
    async executeParallel(context, strategies) {
        const promises = strategies.map(async (type) => {
            const executor = this.executors.get(type);
            if (!executor) {
                return null;
            }
            return this.executeStrategy(type, executor, context);
        });
        const results = await Promise.all(promises);
        return results.filter((r) => r !== null);
    }
    // ===========================================================================
    // CONFIGURATION
    // ===========================================================================
    /**
     * Get current configuration.
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
     * Get all registered strategies.
     */
    getStrategies() {
        return Array.from(this.strategies.values()).sort((a, b) => a.priority - b.priority);
    }
    /**
     * Get registered executor types.
     */
    getRegisteredExecutors() {
        return Array.from(this.executors.keys());
    }
}
exports.HealingOrchestrator = HealingOrchestrator;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a healing orchestrator instance.
 *
 * @param config - Configuration options
 */
function createHealingOrchestrator(config) {
    return new HealingOrchestrator(config);
}
exports.createHealingOrchestrator = createHealingOrchestrator;
//# sourceMappingURL=healing-orchestrator.js.map