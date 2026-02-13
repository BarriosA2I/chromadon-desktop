/**
 * CHROMADON Event Bus
 * ===================
 * Central nervous system for agent communication
 * Enables pub/sub, request/response, and event streaming
 */
import { AgentEvent, EventType, EventSubscription, AgentName, TraceSpan, TraceLog } from './types';
export declare class AgentEventBus {
    private emitter;
    private subscriptions;
    private eventHistory;
    private maxHistorySize;
    private pendingRequests;
    constructor(options?: {
        maxHistorySize?: number;
    });
    /**
     * Publish an event to all subscribers
     */
    publish(event: Omit<AgentEvent, 'id' | 'timestamp'>): AgentEvent;
    /**
     * Subscribe to events of a specific type (or all events with '*')
     */
    subscribe(subscription: EventSubscription): string;
    /**
     * Subscribe to all events with a simple callback
     */
    subscribeAll(handler: (event: AgentEvent) => void): string;
    /**
     * Unsubscribe from events
     */
    unsubscribe(subscriptionId: string): boolean;
    /**
     * Send a request to a specific agent and wait for response
     */
    request<T>(targetAgent: AgentName, sourceAgent: AgentName, action: string, payload: unknown, options?: {
        timeoutMs?: number;
        correlationId?: string;
    }): Promise<T>;
    /**
     * Respond to a request
     */
    respond(correlationId: string, sourceAgent: AgentName, payload: unknown): void;
    /**
     * Respond with error
     */
    respondError(correlationId: string, sourceAgent: AgentName, error: Error): void;
    /**
     * Create an async iterator for events of a specific type
     */
    stream(eventType: EventType | '*', options?: {
        filter?: (event: AgentEvent) => boolean;
        bufferSize?: number;
    }): AsyncGenerator<AgentEvent, void, unknown>;
    /**
     * Get event history, optionally filtered
     */
    getHistory(options?: {
        eventType?: EventType;
        correlationId?: string;
        source?: AgentName;
        since?: number;
        limit?: number;
    }): AgentEvent[];
    /**
     * Replay events for debugging or recovery
     */
    replay(events: AgentEvent[], delayMs?: number): Promise<void>;
    /**
     * Wait for a specific event
     */
    waitFor(eventType: EventType, filter?: (event: AgentEvent) => boolean, timeoutMs?: number): Promise<AgentEvent>;
    /**
     * Clear all subscriptions
     */
    clear(): void;
    /**
     * Get metrics about event bus
     */
    getMetrics(): {
        subscriptionCount: number;
        pendingRequestCount: number;
        historySize: number;
        eventCountByType: Record<string, number>;
    };
}
export declare class DistributedTracer {
    private spans;
    private eventBus;
    constructor(eventBus: AgentEventBus);
    /**
     * Start a new trace span
     */
    startSpan(operationName: string, agent: AgentName, options?: {
        traceId?: string;
        parentSpanId?: string;
        tags?: Record<string, string | number | boolean>;
    }): TraceSpan;
    /**
     * End a trace span
     */
    endSpan(spanId: string, status?: 'ok' | 'error'): TraceSpan | undefined;
    /**
     * Add a log to a span
     */
    log(spanId: string, level: TraceLog['level'], message: string, fields?: Record<string, unknown>): void;
    /**
     * Add a tag to a span
     */
    setTag(spanId: string, key: string, value: string | number | boolean): void;
    /**
     * Get a span by ID
     */
    getSpan(spanId: string): TraceSpan | undefined;
    /**
     * Get all spans for a trace
     */
    getTrace(traceId: string): TraceSpan[];
    /**
     * Clear old spans (for memory management)
     */
    cleanup(maxAgeMs?: number): number;
}
export declare function getEventBus(): AgentEventBus;
export declare function getTracer(): DistributedTracer;
/**
 * Decorator to automatically trace agent methods
 */
export declare function traced(operationName?: string): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Decorator to publish events on method completion
 */
export declare function publishesEvent(eventType: EventType): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Simple Circuit Breaker for agent resilience
 */
export type CircuitState = 'closed' | 'open' | 'half-open';
export interface CircuitBreakerConfig {
    failureThreshold?: number;
    successThreshold?: number;
    timeoutMs?: number;
}
export declare class CircuitBreaker {
    private state;
    private failures;
    private successes;
    private lastFailure;
    private config;
    constructor(config?: CircuitBreakerConfig);
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    getState(): CircuitState;
    /**
     * Check if circuit breaker allows execution
     */
    canExecute(): boolean;
    /**
     * Record a successful operation
     */
    recordSuccess(): void;
    /**
     * Record a failed operation
     */
    recordFailure(): void;
    reset(): void;
}
/**
 * Exponential backoff utility
 */
export declare function exponentialBackoff<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
}): Promise<T>;
//# sourceMappingURL=event-bus.d.ts.map