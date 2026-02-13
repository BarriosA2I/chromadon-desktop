"use strict";
// @ts-nocheck
/**
 * CHROMADON Event Bus
 * ===================
 * Central nervous system for agent communication
 * Enables pub/sub, request/response, and event streaming
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exponentialBackoff = exports.CircuitBreaker = exports.publishesEvent = exports.traced = exports.getTracer = exports.getEventBus = exports.DistributedTracer = exports.AgentEventBus = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
// =============================================================================
// EVENT BUS
// =============================================================================
class AgentEventBus {
    emitter;
    subscriptions;
    eventHistory;
    maxHistorySize;
    pendingRequests;
    constructor(options = {}) {
        this.emitter = new events_1.EventEmitter();
        this.emitter.setMaxListeners(100);
        this.subscriptions = new Map();
        this.eventHistory = [];
        this.maxHistorySize = options.maxHistorySize ?? 1000;
        this.pendingRequests = new Map();
    }
    // ---------------------------------------------------------------------------
    // Publish/Subscribe
    // ---------------------------------------------------------------------------
    /**
     * Publish an event to all subscribers
     */
    publish(event) {
        const fullEvent = {
            ...event,
            id: (0, uuid_1.v4)(),
            timestamp: Date.now(),
        };
        // Store in history
        this.eventHistory.push(fullEvent);
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }
        // Emit to type-specific listeners
        this.emitter.emit(event.type, fullEvent);
        // Emit to wildcard listeners
        this.emitter.emit('*', fullEvent);
        // Log for observability
        console.log(`[EventBus] ${event.type} from ${event.source}`, {
            correlationId: event.correlationId,
            target: event.target,
        });
        return fullEvent;
    }
    /**
     * Subscribe to events of a specific type (or all events with '*')
     */
    subscribe(subscription) {
        const subscriptionId = (0, uuid_1.v4)();
        this.subscriptions.set(subscriptionId, subscription);
        const wrappedHandler = (event) => {
            // Apply filter if provided
            if (subscription.filter && !subscription.filter(event)) {
                return;
            }
            subscription.handler(event);
        };
        this.emitter.on(subscription.eventType, wrappedHandler);
        return subscriptionId;
    }
    /**
     * Subscribe to all events with a simple callback
     */
    subscribeAll(handler) {
        return this.subscribe({
            eventType: '*',
            handler,
        });
    }
    /**
     * Unsubscribe from events
     */
    unsubscribe(subscriptionId) {
        const subscription = this.subscriptions.get(subscriptionId);
        if (!subscription)
            return false;
        this.emitter.removeListener(subscription.eventType, subscription.handler);
        this.subscriptions.delete(subscriptionId);
        return true;
    }
    // ---------------------------------------------------------------------------
    // Request/Response Pattern
    // ---------------------------------------------------------------------------
    /**
     * Send a request to a specific agent and wait for response
     */
    async request(targetAgent, sourceAgent, action, payload, options = {}) {
        const correlationId = options.correlationId ?? (0, uuid_1.v4)();
        const timeoutMs = options.timeoutMs ?? 30000;
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(correlationId);
                reject(new Error(`Request to ${targetAgent} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            // Store pending request
            this.pendingRequests.set(correlationId, { resolve: resolve, reject, timeout });
            // Publish request event
            this.publish({
                type: 'AGENT_REQUEST',
                source: sourceAgent,
                target: targetAgent,
                correlationId,
                payload: { action, data: payload },
            });
        });
    }
    /**
     * Respond to a request
     */
    respond(correlationId, sourceAgent, payload) {
        const pending = this.pendingRequests.get(correlationId);
        if (!pending) {
            console.warn(`[EventBus] No pending request for correlationId: ${correlationId}`);
            return;
        }
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(correlationId);
        pending.resolve(payload);
        // Also publish response event for observability
        this.publish({
            type: 'AGENT_RESPONSE',
            source: sourceAgent,
            correlationId,
            payload,
        });
    }
    /**
     * Respond with error
     */
    respondError(correlationId, sourceAgent, error) {
        const pending = this.pendingRequests.get(correlationId);
        if (!pending) {
            console.warn(`[EventBus] No pending request for correlationId: ${correlationId}`);
            return;
        }
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(correlationId);
        pending.reject(error);
        this.publish({
            type: 'AGENT_ERROR',
            source: sourceAgent,
            correlationId,
            payload: { error: error.message, stack: error.stack },
        });
    }
    // ---------------------------------------------------------------------------
    // Event Streaming
    // ---------------------------------------------------------------------------
    /**
     * Create an async iterator for events of a specific type
     */
    async *stream(eventType, options = {}) {
        const buffer = [];
        const bufferSize = options.bufferSize ?? 100;
        let resolveNext = null;
        const handler = (event) => {
            if (options.filter && !options.filter(event))
                return;
            if (resolveNext) {
                resolveNext(event);
                resolveNext = null;
            }
            else if (buffer.length < bufferSize) {
                buffer.push(event);
            }
        };
        this.emitter.on(eventType, handler);
        try {
            while (true) {
                if (buffer.length > 0) {
                    yield buffer.shift();
                }
                else {
                    yield await new Promise((resolve) => {
                        resolveNext = resolve;
                    });
                }
            }
        }
        finally {
            this.emitter.removeListener(eventType, handler);
        }
    }
    // ---------------------------------------------------------------------------
    // History & Replay
    // ---------------------------------------------------------------------------
    /**
     * Get event history, optionally filtered
     */
    getHistory(options = {}) {
        let events = [...this.eventHistory];
        if (options.eventType) {
            events = events.filter((e) => e.type === options.eventType);
        }
        if (options.correlationId) {
            events = events.filter((e) => e.correlationId === options.correlationId);
        }
        if (options.source) {
            events = events.filter((e) => e.source === options.source);
        }
        if (options.since) {
            events = events.filter((e) => e.timestamp >= options.since);
        }
        if (options.limit) {
            events = events.slice(-options.limit);
        }
        return events;
    }
    /**
     * Replay events for debugging or recovery
     */
    async replay(events, delayMs = 0) {
        for (const event of events) {
            this.emitter.emit(event.type, event);
            this.emitter.emit('*', event);
            if (delayMs > 0) {
                await new Promise((r) => setTimeout(r, delayMs));
            }
        }
    }
    // ---------------------------------------------------------------------------
    // Utilities
    // ---------------------------------------------------------------------------
    /**
     * Wait for a specific event
     */
    async waitFor(eventType, filter, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.emitter.removeListener(eventType, handler);
                reject(new Error(`Timeout waiting for event: ${eventType}`));
            }, timeoutMs);
            const handler = (event) => {
                if (filter && !filter(event))
                    return;
                clearTimeout(timeout);
                this.emitter.removeListener(eventType, handler);
                resolve(event);
            };
            this.emitter.on(eventType, handler);
        });
    }
    /**
     * Clear all subscriptions
     */
    clear() {
        this.emitter.removeAllListeners();
        this.subscriptions.clear();
        this.pendingRequests.forEach((p) => {
            clearTimeout(p.timeout);
            p.reject(new Error('Event bus cleared'));
        });
        this.pendingRequests.clear();
    }
    /**
     * Get metrics about event bus
     */
    getMetrics() {
        const eventCountByType = {};
        for (const event of this.eventHistory) {
            eventCountByType[event.type] = (eventCountByType[event.type] ?? 0) + 1;
        }
        return {
            subscriptionCount: this.subscriptions.size,
            pendingRequestCount: this.pendingRequests.size,
            historySize: this.eventHistory.length,
            eventCountByType,
        };
    }
}
exports.AgentEventBus = AgentEventBus;
// =============================================================================
// DISTRIBUTED TRACING
// =============================================================================
class DistributedTracer {
    spans;
    eventBus;
    constructor(eventBus) {
        this.spans = new Map();
        this.eventBus = eventBus;
    }
    /**
     * Start a new trace span
     */
    startSpan(operationName, agent, options = {}) {
        const span = {
            traceId: options.traceId ?? (0, uuid_1.v4)(),
            spanId: (0, uuid_1.v4)(),
            parentSpanId: options.parentSpanId,
            operationName,
            agent,
            startTime: Date.now(),
            status: 'ok',
            tags: options.tags ?? {},
            logs: [],
        };
        this.spans.set(span.spanId, span);
        return span;
    }
    /**
     * End a trace span
     */
    endSpan(spanId, status = 'ok') {
        const span = this.spans.get(spanId);
        if (!span)
            return undefined;
        span.endTime = Date.now();
        span.status = status;
        // Publish span completion event
        this.eventBus.publish({
            type: 'STEP_COMPLETED',
            source: span.agent,
            correlationId: span.traceId,
            payload: span,
        });
        return span;
    }
    /**
     * Add a log to a span
     */
    log(spanId, level, message, fields) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.logs.push({
            timestamp: Date.now(),
            level,
            message,
            fields,
        });
    }
    /**
     * Add a tag to a span
     */
    setTag(spanId, key, value) {
        const span = this.spans.get(spanId);
        if (!span)
            return;
        span.tags[key] = value;
    }
    /**
     * Get a span by ID
     */
    getSpan(spanId) {
        return this.spans.get(spanId);
    }
    /**
     * Get all spans for a trace
     */
    getTrace(traceId) {
        return Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
    }
    /**
     * Clear old spans (for memory management)
     */
    cleanup(maxAgeMs = 3600000) {
        const cutoff = Date.now() - maxAgeMs;
        let removed = 0;
        for (const [spanId, span] of this.spans) {
            if (span.endTime && span.endTime < cutoff) {
                this.spans.delete(spanId);
                removed++;
            }
        }
        return removed;
    }
}
exports.DistributedTracer = DistributedTracer;
// =============================================================================
// SINGLETON INSTANCE
// =============================================================================
let globalEventBus = null;
let globalTracer = null;
function getEventBus() {
    if (!globalEventBus) {
        globalEventBus = new AgentEventBus();
    }
    return globalEventBus;
}
exports.getEventBus = getEventBus;
function getTracer() {
    if (!globalTracer) {
        globalTracer = new DistributedTracer(getEventBus());
    }
    return globalTracer;
}
exports.getTracer = getTracer;
// =============================================================================
// DECORATORS
// =============================================================================
/**
 * Decorator to automatically trace agent methods
 */
function traced(operationName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const tracer = getTracer();
            const agentName = this.name || 'UNKNOWN';
            const opName = operationName || `${agentName}.${propertyKey}`;
            const span = tracer.startSpan(opName, agentName, {
                tags: { method: propertyKey },
            });
            try {
                const result = await originalMethod.apply(this, args);
                tracer.endSpan(span.spanId, 'ok');
                return result;
            }
            catch (error) {
                tracer.log(span.spanId, 'error', error.message);
                tracer.endSpan(span.spanId, 'error');
                throw error;
            }
        };
        return descriptor;
    };
}
exports.traced = traced;
/**
 * Decorator to publish events on method completion
 */
function publishesEvent(eventType) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const eventBus = getEventBus();
            const agentName = this.name || 'UNKNOWN';
            try {
                const result = await originalMethod.apply(this, args);
                eventBus.publish({
                    type: eventType,
                    source: agentName,
                    correlationId: (0, uuid_1.v4)(),
                    payload: { result, args },
                });
                return result;
            }
            catch (error) {
                eventBus.publish({
                    type: 'AGENT_ERROR',
                    source: agentName,
                    correlationId: (0, uuid_1.v4)(),
                    payload: { error: error.message, args },
                });
                throw error;
            }
        };
        return descriptor;
    };
}
exports.publishesEvent = publishesEvent;
class CircuitBreaker {
    state = 'closed';
    failures = 0;
    successes = 0;
    lastFailure = 0;
    config;
    constructor(config = {}) {
        this.config = {
            failureThreshold: config.failureThreshold ?? 5,
            successThreshold: config.successThreshold ?? 2,
            timeoutMs: config.timeoutMs ?? 30000,
        };
    }
    async execute(fn) {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.config.timeoutMs) {
                this.state = 'half-open';
            }
            else {
                throw new Error('Circuit breaker is open');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    onSuccess() {
        this.failures = 0;
        if (this.state === 'half-open') {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.state = 'closed';
                this.successes = 0;
            }
        }
    }
    onFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.config.failureThreshold) {
            this.state = 'open';
        }
    }
    getState() {
        return this.state;
    }
    /**
     * Check if circuit breaker allows execution
     */
    canExecute() {
        if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.config.timeoutMs) {
                this.state = 'half-open';
                return true;
            }
            return false;
        }
        return true;
    }
    /**
     * Record a successful operation
     */
    recordSuccess() {
        this.onSuccess();
    }
    /**
     * Record a failed operation
     */
    recordFailure() {
        this.onFailure();
    }
    reset() {
        this.state = 'closed';
        this.failures = 0;
        this.successes = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Exponential backoff utility
 */
async function exponentialBackoff(fn, options = {}) {
    const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 30000, backoffFactor = 2, } = options;
    let lastError;
    let delay = initialDelayMs;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay = Math.min(delay * backoffFactor, maxDelayMs);
            }
        }
    }
    throw lastError;
}
exports.exponentialBackoff = exponentialBackoff;
