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
/// <reference types="node" />
/// <reference types="node" />
import type { Selector, SelectorStrategy, Checkpoint, Action } from '../interfaces';
import { type HealingOrchestratorConfig, type HealingOrchestrationResult, type HealingAttempt, type StrategyExecutor } from '../core/healing-orchestrator';
import { type DriftDetectorConfig, type SelectorHealthMetrics } from '../core/drift-detector';
import { type ProceduralMemoryConfig, type HealingPattern } from '../core/procedural-memory';
import { type RetryConfig } from '../core/retry-strategy';
/**
 * Failure type classification.
 */
export type FailureType = 'selector_broken' | 'element_not_found' | 'element_not_visible' | 'element_not_interactable' | 'timeout' | 'unexpected_state' | 'network_error' | 'unknown';
/**
 * Failure context.
 */
export interface FailureContext {
    type: FailureType;
    selector?: string;
    strategy?: SelectorStrategy;
    action?: Action;
    error: Error;
    url: string;
    screenshot?: Buffer;
    domSnapshot?: string;
    stepIndex?: number;
}
/**
 * Recovery action.
 */
export type RecoveryAction = 'retry' | 'heal_selector' | 'rollback' | 'skip' | 'escalate';
/**
 * Recovery result.
 */
export interface RecoveryResult {
    action: RecoveryAction;
    success: boolean;
    healedSelector?: Selector;
    targetCheckpoint?: number;
    resumeFromStep?: number;
    error?: Error;
    attempts: number;
    duration: number;
}
/**
 * Healing metrics.
 */
export interface HealingMetrics {
    totalFailures: number;
    totalRecoveries: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    strategiesUsed: Record<SelectorStrategy, number>;
    failureTypes: Record<FailureType, number>;
}
/**
 * Self-healer configuration.
 */
export interface SelfHealerConfig {
    /** Maximum recovery attempts */
    maxRecoveryAttempts: number;
    /** Enable proactive healing */
    enableProactiveHealing: boolean;
    /** Enable procedural learning */
    enableProceduralLearning: boolean;
    /** Checkpoint rollback enabled */
    enableCheckpointRollback: boolean;
    /** Escalation after N failures */
    escalateAfterFailures: number;
    /** Healing orchestrator config */
    orchestratorConfig?: Partial<HealingOrchestratorConfig>;
    /** Drift detector config */
    driftDetectorConfig?: Partial<DriftDetectorConfig>;
    /** Procedural memory config */
    proceduralMemoryConfig?: Partial<ProceduralMemoryConfig>;
    /** Retry config */
    retryConfig?: Partial<RetryConfig>;
}
/**
 * Self-Healer for automatic recovery from failures.
 *
 * Implements CRAG-based self-healing with:
 * - Strategy escalation (CSS → XPath → text → ARIA → VLM)
 * - Procedural learning from successful healings
 * - Proactive drift detection
 * - Checkpoint-based rollback
 */
export declare class SelfHealer {
    private config;
    private orchestrator;
    private driftDetector;
    private proceduralMemory;
    private retryStrategy;
    private metrics;
    private onRecoveryAttempt?;
    private onEscalation?;
    private onStrategyAttempt?;
    constructor(config?: Partial<SelfHealerConfig>);
    /**
     * Register a healing strategy executor.
     */
    registerStrategy(type: SelectorStrategy, executor: StrategyExecutor): void;
    /**
     * Register all default strategy executors.
     */
    registerDefaultStrategies(executors: {
        css?: StrategyExecutor;
        xpath?: StrategyExecutor;
        text?: StrategyExecutor;
        aria?: StrategyExecutor;
        testid?: StrategyExecutor;
        visual?: StrategyExecutor;
    }): void;
    /**
     * Execute a function with automatic healing on failure.
     *
     * @param fn - Function to execute
     * @param context - Context for healing
     * @returns Result of function execution
     */
    executeWithHealing<T>(fn: () => Promise<T>, context?: {
        selector?: string;
        action?: string;
        url?: string;
    }): Promise<T>;
    /**
     * Recover from a failure.
     *
     * @param failure - Failure context
     * @param checkpoints - Available checkpoints for rollback
     * @returns Recovery result
     */
    recoverFromFailure(failure: FailureContext, checkpoints?: Checkpoint[]): Promise<RecoveryResult>;
    /**
     * Heal a broken selector.
     *
     * @param originalSelector - Broken selector
     * @param context - Healing context
     * @returns Healing result
     */
    healSelector(originalSelector: string, context: {
        action: string;
        url: string;
        nearText?: string;
        expectedTag?: string;
        parentSelector?: string;
        screenshot?: Buffer;
        domSnapshot?: string;
    }): Promise<HealingOrchestrationResult>;
    /**
     * Determine recovery action based on failure type.
     */
    private determineRecoveryAction;
    /**
     * Attempt retry with backoff.
     */
    private attemptRetry;
    /**
     * Attempt selector healing.
     */
    private attemptSelectorHealing;
    /**
     * Attempt rollback to checkpoint.
     */
    private attemptRollback;
    /**
     * Trigger proactive healing based on drift detection.
     */
    private triggerProactiveHealing;
    /**
     * Get selectors that need proactive healing.
     */
    getSelectorsNeedingHealing(): SelectorHealthMetrics[];
    /**
     * Classify a failure based on error message.
     */
    classifyFailure(error: Error): FailureType;
    /**
     * Set callback for recovery attempts.
     */
    onRecovery(callback: (result: RecoveryResult) => void): void;
    /**
     * Set callback for escalations.
     */
    onEscalate(callback: (failure: FailureContext) => void): void;
    /**
     * Set callback for strategy attempts.
     */
    onStrategy(callback: (attempt: HealingAttempt) => void): void;
    /**
     * Extract domain from URL.
     */
    private extractDomain;
    /**
     * Extract pattern from selector.
     */
    private extractPattern;
    /**
     * Update average recovery time.
     */
    private updateAverageRecoveryTime;
    /**
     * Get healing metrics.
     */
    getMetrics(): HealingMetrics;
    /**
     * Get configuration.
     */
    getConfig(): SelfHealerConfig;
    /**
     * Get drift detector statistics.
     */
    getDriftStats(): {
        totalSelectors: number;
        healthyCount: number;
        degradingCount: number;
        criticalCount: number;
        failedCount: number;
        needsHealingCount: number;
    };
    /**
     * Get procedural memory statistics.
     */
    getProceduralStats(): {
        totalPatterns: number;
        patternsByDomain: Record<string, number>;
        averageSuccessRate: number;
        averageDecayFactor: number;
        reliablePatterns: number;
    };
    /**
     * Get registered strategy types.
     */
    getRegisteredStrategies(): SelectorStrategy[];
    /**
     * Apply decay to procedural memory.
     */
    applyProceduralDecay(): void;
    /**
     * Export procedural memory for persistence.
     */
    exportProceduralMemory(): HealingPattern[];
    /**
     * Import procedural memory from persistence.
     */
    importProceduralMemory(patterns: HealingPattern[]): void;
    /**
     * Clear all memory.
     */
    clearMemory(): void;
    /**
     * Reset metrics.
     */
    resetMetrics(): void;
}
/**
 * Create a self-healer instance.
 *
 * @param config - Configuration options
 */
export declare function createSelfHealer(config?: Partial<SelfHealerConfig>): SelfHealer;
//# sourceMappingURL=self-healer.d.ts.map