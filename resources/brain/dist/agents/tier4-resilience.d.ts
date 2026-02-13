/**
 * CHROMADON Tier 4: Resilience Layer
 * ====================================
 * THE ERROR HANDLER - Error Classification & Response
 * THE RECOVERY EXPERT - Automated Recovery Strategies
 * THE LEARNING ENGINE - Pattern Learning & Optimization
 *
 * These agents provide fault tolerance, self-healing capabilities,
 * and continuous improvement through experience.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AgentName, AgentConfig, AgentError, RecoveryAction, ErrorClassification, LearningEvent, PatternMatch, ExecutionContext, Checkpoint } from './types';
import { AgentEventBus } from './event-bus';
export type ErrorCategory = 'network' | 'authentication' | 'element_not_found' | 'timeout' | 'validation' | 'rate_limit' | 'captcha' | 'permission' | 'state_mismatch' | 'data_format' | 'system' | 'unknown';
export interface ErrorPattern {
    id: string;
    category: ErrorCategory;
    messagePatterns: RegExp[];
    urlPatterns?: RegExp[];
    recoverable: boolean;
    suggestedRecovery: RecoveryAction[];
    cooldownMs?: number;
    maxRetries: number;
}
export interface RecoveryResult {
    success: boolean;
    action: RecoveryAction;
    stepsExecuted: string[];
    finalState?: ExecutionContext;
    error?: string;
    durationMs: number;
}
declare abstract class BaseResilienceAgent {
    readonly name: AgentName;
    protected config: AgentConfig;
    protected anthropic: Anthropic;
    protected eventBus: AgentEventBus;
    constructor(name: AgentName, config?: Partial<AgentConfig>);
    protected getModelId(): string;
    protected callLLM(systemPrompt: string, userMessage: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    protected publishEvent(type: string, payload: unknown, correlationId?: string): void;
    protected delay(ms: number): Promise<void>;
}
/**
 * THE ERROR HANDLER
 * -----------------
 * Classifies errors, determines recoverability, and routes to appropriate
 * recovery strategies. Maintains error history for pattern detection.
 */
export declare class TheErrorHandler extends BaseResilienceAgent {
    private errorPatterns;
    private errorHistory;
    private readonly maxHistorySize;
    constructor();
    private initializePatterns;
    classify(error: AgentError | Error | string): Promise<ErrorClassification>;
    suggestRecovery(classification: ErrorClassification, context: ExecutionContext): Promise<RecoveryAction[]>;
    shouldRetry(classification: ErrorClassification, attemptCount: number): boolean;
    getBackoffDelay(attemptCount: number, baseDelayMs?: number): number;
    private normalizeError;
    private matchPattern;
    private determineSeverity;
    private classifyWithLLM;
    private recordError;
    private findRecentSuccessfulRecovery;
    getErrorStats(): {
        total: number;
        byCategory: Record<ErrorCategory, number>;
        recoveryRate: number;
    };
    clearHistory(): void;
}
/**
 * THE RECOVERY EXPERT
 * -------------------
 * Executes recovery strategies, manages checkpoints, and coordinates
 * rollback operations. Works with THE_ERROR_HANDLER for intelligent recovery.
 */
export declare class TheRecoveryExpert extends BaseResilienceAgent {
    private recoveryStrategies;
    private recoveryHistory;
    constructor();
    private initializeStrategies;
    executeRecovery(action: RecoveryAction, context: ExecutionContext, params?: Record<string, unknown>): Promise<RecoveryResult>;
    executeRecoverySequence(actions: RecoveryAction[], context: ExecutionContext, params?: Record<string, unknown>): Promise<RecoveryResult>;
    createCheckpoint(context: ExecutionContext, label?: string): Checkpoint;
    rollback(context: ExecutionContext, checkpointId: string): Promise<{
        success: boolean;
        restoredContext?: ExecutionContext;
    }>;
    getSuccessRate(action?: RecoveryAction, category?: ErrorCategory): number;
    getBestRecoveryAction(category: ErrorCategory): RecoveryAction | null;
}
/**
 * THE LEARNING ENGINE
 * -------------------
 * Learns from execution patterns to improve future performance.
 * Identifies optimal strategies, timing, and element selectors.
 */
export declare class TheLearningEngine extends BaseResilienceAgent {
    private learningEvents;
    private patterns;
    private optimizations;
    private readonly maxEventsSize;
    constructor();
    recordEvent(event: LearningEvent): void;
    analyzePatterns(): Promise<PatternMatch[]>;
    getOptimization(taskType: string, context?: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    suggestSelector(element: string, platform: string, previousAttempts?: Array<{
        selector: string;
        success: boolean;
    }>): Promise<{
        selector: string;
        confidence: number;
        reasoning: string;
    }>;
    predictSuccess(taskType: string, platform: string, context?: Record<string, unknown>): Promise<{
        probability: number;
        factors: string[];
    }>;
    private calculateActionStats;
    private analyzeTimingPatterns;
    private analyzeErrorPatterns;
    private deriveOptimalParameters;
    private calculateHourlySuccessRate;
    getPatterns(): PatternMatch[];
    getStats(): {
        totalEvents: number;
        successRate: number;
        topActions: string[];
    };
    clearData(): void;
}
export declare function createResilienceAgents(): {
    errorHandler: TheErrorHandler;
    recoveryExpert: TheRecoveryExpert;
    learningEngine: TheLearningEngine;
};
export { TheErrorHandler, TheRecoveryExpert, TheLearningEngine, ErrorCategory, ErrorPattern, RecoveryResult, };
