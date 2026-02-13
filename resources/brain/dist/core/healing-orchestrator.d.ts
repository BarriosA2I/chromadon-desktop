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
/// <reference types="node" />
/// <reference types="node" />
import type { Selector, SelectorStrategy, CRAGAction } from '../interfaces';
/**
 * Healing strategy with metadata.
 */
export interface HealingStrategy {
    /** Strategy type */
    type: SelectorStrategy;
    /** Priority (1 = highest) */
    priority: number;
    /** Estimated latency in ms */
    estimatedLatencyMs: number;
    /** Whether this requires external API call */
    requiresExternalApi: boolean;
    /** Maximum attempts for this strategy */
    maxAttempts: number;
}
/**
 * Healing attempt result.
 */
export interface HealingAttempt {
    strategy: SelectorStrategy;
    selector: Selector | null;
    success: boolean;
    duration: number;
    error?: Error;
    confidence: number;
}
/**
 * Healing orchestration result.
 */
export interface HealingOrchestrationResult {
    success: boolean;
    originalSelector: string;
    healedSelector: Selector | null;
    strategiesAttempted: HealingAttempt[];
    cragAction: CRAGAction;
    totalDuration: number;
    confidence: number;
}
/**
 * Healing context for strategy selection.
 */
export interface HealingContext {
    /** Original broken selector */
    brokenSelector: string;
    /** Action being performed */
    action: string;
    /** URL of the page */
    url: string;
    /** Text near the element */
    nearText?: string;
    /** Expected tag name */
    expectedTag?: string;
    /** Parent element info */
    parentSelector?: string;
    /** Screenshot for VLM */
    screenshot?: Buffer;
    /** DOM snapshot */
    domSnapshot?: string;
}
/**
 * Strategy executor function type.
 */
export type StrategyExecutor = (context: HealingContext) => Promise<Selector | null>;
/**
 * Healing orchestrator configuration.
 */
export interface HealingOrchestratorConfig {
    /** Maximum strategies to try before giving up */
    maxStrategies: number;
    /** Overall timeout for healing in ms */
    healingTimeoutMs: number;
    /** Confidence threshold for early exit */
    earlyExitConfidence: number;
    /** Enable parallel strategy execution */
    enableParallelExecution: boolean;
    /** Strategy priority order */
    strategyOrder: SelectorStrategy[];
}
/**
 * Healing Orchestrator for coordinating selector healing strategies.
 *
 * Uses CRAG pattern for intelligent strategy selection:
 * - High confidence → Use best strategy (GENERATE)
 * - Medium confidence → Try multiple strategies (DECOMPOSE)
 * - Low confidence → Escalate to VLM (WEBSEARCH/visual)
 */
export declare class HealingOrchestrator {
    private config;
    private strategies;
    private executors;
    private onStrategyAttempt?;
    constructor(config?: Partial<HealingOrchestratorConfig>);
    /**
     * Register a strategy executor.
     *
     * @param type - Strategy type
     * @param executor - Function that attempts healing
     */
    registerExecutor(type: SelectorStrategy, executor: StrategyExecutor): void;
    /**
     * Set callback for strategy attempts.
     */
    onAttempt(callback: (attempt: HealingAttempt) => void): void;
    /**
     * Orchestrate healing with strategy escalation.
     *
     * @param context - Healing context
     * @returns Orchestration result
     */
    orchestrate(context: HealingContext): Promise<HealingOrchestrationResult>;
    /**
     * Execute a single strategy.
     */
    private executeStrategy;
    /**
     * Assess initial confidence based on context.
     */
    private assessInitialConfidence;
    /**
     * Determine CRAG action based on confidence.
     */
    private determineCRAGAction;
    /**
     * Get strategies ordered by CRAG action.
     */
    private getOrderedStrategies;
    /**
     * Execute multiple strategies in parallel.
     *
     * @param context - Healing context
     * @param strategies - Strategies to try
     * @returns Best result from parallel execution
     */
    executeParallel(context: HealingContext, strategies: SelectorStrategy[]): Promise<HealingAttempt[]>;
    /**
     * Get current configuration.
     */
    getConfig(): HealingOrchestratorConfig;
    /**
     * Update configuration.
     */
    configure(config: Partial<HealingOrchestratorConfig>): void;
    /**
     * Get all registered strategies.
     */
    getStrategies(): HealingStrategy[];
    /**
     * Get registered executor types.
     */
    getRegisteredExecutors(): SelectorStrategy[];
}
/**
 * Create a healing orchestrator instance.
 *
 * @param config - Configuration options
 */
export declare function createHealingOrchestrator(config?: Partial<HealingOrchestratorConfig>): HealingOrchestrator;
//# sourceMappingURL=healing-orchestrator.d.ts.map