/**
 * CHROMADON Integration Layer v3.0
 * ================================
 * Connects Neural RAG AI Engine v3 to the CDP Controller.
 *
 * Features:
 * - Seamless AI command processing
 * - Page context extraction
 * - Action execution with verification
 * - Error recovery with circuit breakers
 * - Full observability integration
 *
 * Author: Barrios A2I
 * Version: 3.0.0
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import { Registry } from 'prom-client';
/** Page context from CDP */
interface PageContext {
    url: string;
    title: string;
    visibleText: string;
    interactiveElements?: string;
    scrollPosition?: {
        x: number;
        y: number;
    };
    viewportSize?: {
        width: number;
        height: number;
    };
}
/** Action from AI Engine */
interface AIAction {
    type: 'click' | 'type' | 'scroll' | 'navigate' | 'wait' | 'screenshot' | 'extract' | 'hover';
    params: Record<string, unknown>;
    description: string;
    confidence?: number;
}
/** AI Engine response */
interface AIResponse {
    actions: AIAction[];
    reasoning?: string;
    confidence: number;
    cognitiveMode: 'system1' | 'system2' | 'hybrid';
    verificationScore?: number;
    memoryUpdated?: boolean;
}
/** Execution result */
interface ExecutionResult {
    success: boolean;
    action: AIAction;
    result?: unknown;
    error?: string;
    durationMs: number;
    screenshot?: string;
}
/** CDP Controller interface */
interface ICDPController {
    navigate(url: string): Promise<void>;
    click(selector: string): Promise<void>;
    type(selector: string, text: string): Promise<void>;
    scroll(direction: 'up' | 'down' | 'left' | 'right', amount?: number): Promise<void>;
    screenshot(): Promise<string>;
    extractText(selector?: string): Promise<string>;
    hover(selector: string): Promise<void>;
    waitForSelector(selector: string, timeout?: number): Promise<void>;
    getPageContext(): Promise<PageContext>;
    evaluate<T>(fn: string | Function, ...args: unknown[]): Promise<T>;
}
/** AI Engine interface */
interface IAIEngine {
    processCommand(command: string, pageContext: PageContext): Promise<AIResponse>;
    getMemoryStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
    };
    getCircuitBreakerState(): {
        state: string;
        failures: number;
    };
    resetCircuitBreaker(): void;
}
declare const metricsRegistry: Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare class ActionExecutor {
    private cdp;
    private retryConfig;
    constructor(cdp: ICDPController);
    /**
     * Execute a single AI action with retries and observability
     */
    execute(action: AIAction): Promise<ExecutionResult>;
    /**
     * Execute action based on type
     */
    private executeAction;
    private sleep;
}
interface OrchestratorConfig {
    /** Minimum confidence to execute actions */
    minConfidence: number;
    /** Maximum actions per command */
    maxActionsPerCommand: number;
    /** Whether to take screenshots before/after actions */
    screenshotOnAction: boolean;
    /** Whether to verify action results */
    verifyActions: boolean;
    /** Timeout for entire command processing (ms) */
    commandTimeoutMs: number;
}
interface CommandResult {
    success: boolean;
    command: string;
    response: AIResponse;
    executionResults: ExecutionResult[];
    totalDurationMs: number;
    confidence: number;
    cognitiveMode: string;
}
/**
 * CHROMADON Orchestrator v3.0
 *
 * Integrates Neural RAG AI Engine v3 with CDP Controller.
 * Handles the full command lifecycle:
 * 1. Extract page context
 * 2. Process command through AI Engine
 * 3. Execute actions with verification
 * 4. Update memory with results
 */
export declare class ChromadonOrchestrator extends EventEmitter {
    private aiEngine;
    private cdp;
    private executor;
    private config;
    private isProcessing;
    constructor(aiEngine: IAIEngine, cdp: ICDPController, config?: Partial<OrchestratorConfig>);
    /**
     * Process a user command end-to-end
     */
    processCommand(command: string): Promise<CommandResult>;
    /**
     * Extract comprehensive page context from CDP
     */
    private extractPageContext;
    /**
     * Execute a list of actions sequentially
     */
    private executeActions;
    /**
     * Verify action results by checking page state
     */
    private verifyResults;
    /**
     * Wrap a promise with a timeout
     */
    private withTimeout;
    private sleep;
    /**
     * Get orchestrator status
     */
    getStatus(): {
        isProcessing: boolean;
        aiEngineMemory: {
            working: number;
            episodic: number;
            semantic: number;
            procedural: number;
        };
        circuitBreaker: {
            state: string;
            failures: number;
        };
    };
    /**
     * Reset AI engine state
     */
    reset(): void;
    /**
     * Get Prometheus metrics
     */
    getMetrics(): Promise<string>;
}
/**
 * Create a fully configured CHROMADON Orchestrator
 */
export declare function createChromadonOrchestrator(aiEngine: IAIEngine, cdp: ICDPController, config?: Partial<OrchestratorConfig>): ChromadonOrchestrator;
export type { PageContext, AIAction, AIResponse, ExecutionResult, CommandResult, OrchestratorConfig, ICDPController, IAIEngine, };
export { metricsRegistry };
//# sourceMappingURL=chromadon-orchestrator-v3.d.ts.map