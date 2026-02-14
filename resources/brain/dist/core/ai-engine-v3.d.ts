/**
 * CHROMADON AI Engine v3.0 - Neural RAG Brain Edition
 * ====================================================
 * Production-grade AI command layer with:
 * - Circuit Breakers for Anthropic API resilience
 * - Dual-Process Router (System 1/2 cognitive routing)
 * - Self-Reflection Tokens [RET][REL][SUP][USE]
 * - Hierarchical Memory (4-tier)
 * - OpenTelemetry observability
 *
 * Battle-tested architecture from 230K+ automations.
 *
 * @author Barrios A2I
 * @version 3.0.0
 */
import Anthropic from '@anthropic-ai/sdk';
import { Registry } from 'prom-client';
export interface PageContext {
    url: string;
    title: string;
    visibleText?: string;
    interactiveElements?: InteractiveElement[];
}
export interface InteractiveElement {
    tag: string;
    text?: string;
    id?: string;
    className?: string;
    type?: string;
    placeholder?: string;
    ariaLabel?: string;
    href?: string;
}
export interface AIAction {
    type: AIActionType;
    params: Record<string, unknown>;
    description: string;
    reasoning?: string;
}
export type AIActionType = 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract' | 'press_key' | 'select' | 'hover' | 'drag';
export interface AIResponse {
    thinking: string;
    actions: AIAction[];
    needsMoreInfo: boolean;
    question?: string;
    confidence: number;
    cognitiveMode: 'system1' | 'system2' | 'hybrid';
    verificationScore?: number;
}
export interface QueryClassification {
    type: 'simple' | 'moderate' | 'complex';
    complexity: number;
    usePRM: boolean;
    model: string;
    thinkBudget: number;
    cognitiveMode: 'system1' | 'system2' | 'hybrid';
}
export interface ReflectionResult {
    shouldRetrieve: boolean;
    isRelevant: boolean;
    isSupported: boolean;
    isUseful: boolean;
    confidence: number;
    feedback?: string;
}
export interface MemoryTrace {
    id: string;
    content: string;
    timestamp: number;
    accessCount: number;
    importance: number;
    embedding?: number[];
}
export interface CircuitBreakerState {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    successes: number;
    lastFailure?: number;
    lastSuccess?: number;
    totalCalls: number;
    totalFailures: number;
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    recoveryTimeoutMs: number;
    monitorWindowMs: number;
}
declare const metricsRegistry: Registry<"text/plain; version=0.0.4; charset=utf-8">;
export { metricsRegistry };
export declare class CircuitBreaker {
    private state;
    private config;
    private tracer;
    private componentName;
    constructor(componentName: string, config?: Partial<CircuitBreakerConfig>);
    private updateMetric;
    call<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitBreakerState;
    reset(): void;
}
export declare class CircuitBreakerOpenError extends Error {
    readonly component: string;
    readonly retryAfterMs: number;
    constructor(component: string, retryAfterMs: number);
}
export declare class DualProcessRouter {
    private tracer;
    private readonly system1Patterns;
    private readonly system2Patterns;
    private readonly complexityIndicators;
    constructor();
    classify(command: string): QueryClassification;
    shouldEscalate(confidence: number, threshold?: number): boolean;
}
export declare class SelfReflection {
    private client;
    private circuitBreaker;
    private tracer;
    constructor(client: Anthropic);
    evaluateResponse(query: string, response: string, context: string): Promise<ReflectionResult>;
}
export declare class HierarchicalMemory {
    private tracer;
    private workingMemory;
    private readonly workingCapacity;
    private episodicMemory;
    private readonly episodicTau;
    private readonly episodicMaxSize;
    private semanticMemory;
    private readonly semanticMaxSize;
    private proceduralMemory;
    private readonly proceduralMaxSize;
    constructor();
    addToWorking(content: string, importance?: number): string;
    addToEpisodic(content: string, importance?: number): string;
    addToSemantic(key: string, content: string, importance?: number): void;
    addToProcedural(pattern: string, steps: string[], successRate?: number): void;
    private evictLeastImportant;
    private computeImportance;
    getRelevantContext(query: string): string[];
    accessMemory(id: string): MemoryTrace | undefined;
    consolidate(): void;
    getStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
    };
}
export declare class NeuralRAGAIEngine {
    private client;
    private router;
    private circuitBreaker;
    private reflection;
    private memory;
    private tracer;
    private conversationHistory;
    private readonly maxHistoryItems;
    constructor(apiKey?: string);
    processCommand(command: string, pageContext: PageContext): Promise<AIResponse>;
    private processCommandWithClassification;
    private regenerateWithGuidance;
    private buildSystemPrompt;
    private parseResponse;
    private parseTextResponse;
    private extractPatternKey;
    clearHistory(): void;
    getMemoryStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
    };
    getCircuitBreakerState(): CircuitBreakerState;
    resetCircuitBreaker(): void;
    consolidateMemory(): void;
}
export default NeuralRAGAIEngine;
//# sourceMappingURL=ai-engine-v3.d.ts.map