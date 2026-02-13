/**
 * Circuit Breaker
 *
 * Neural RAG Brain Pattern: Fault Isolation
 *
 * Implements circuit breaker pattern for failure isolation:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failing, reject requests immediately
 * - HALF_OPEN: Testing recovery, limited requests
 *
 * Protects against cascade failures in mission execution.
 */
import { CircuitState } from '../interfaces/types';
/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Time in ms before attempting recovery */
    recoveryTimeoutMs: number;
    /** Number of successful requests to close circuit */
    successThreshold: number;
    /** Maximum requests allowed in half-open state */
    halfOpenMaxAttempts: number;
    /** Time window for failure counting (ms) */
    failureWindowMs: number;
    /** Enable automatic state transition logging */
    enableLogging: boolean;
}
/**
 * Failure record for tracking.
 */
interface FailureRecord {
    timestamp: Date;
    actionId: string;
    error: Error;
}
/**
 * Circuit breaker metrics.
 */
export interface CircuitBreakerMetrics {
    state: CircuitState;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    rejectedRequests: number;
    lastFailure: Date | null;
    lastSuccess: Date | null;
    lastStateChange: Date | null;
    circuitTrips: number;
    recoveries: number;
}
/**
 * State change event.
 */
export interface CircuitStateChange {
    from: CircuitState;
    to: CircuitState;
    timestamp: Date;
    reason: string;
}
/**
 * Circuit Breaker for fault isolation.
 *
 * State Machine:
 * ```
 * CLOSED ──(failures >= threshold)──→ OPEN
 *    ↑                                   │
 *    │                                   │
 *    └──(successes >= threshold)── HALF_OPEN ←──(timeout)──┘
 *                                       │
 *                                       └──(failure)──→ OPEN
 * ```
 */
export declare class CircuitBreaker {
    private config;
    private state;
    private failures;
    private halfOpenAttempts;
    private halfOpenSuccesses;
    private openedAt;
    private lastStateChange;
    private totalRequests;
    private successfulRequests;
    private failedRequests;
    private rejectedRequests;
    private circuitTrips;
    private recoveries;
    private lastFailure;
    private lastSuccess;
    private onStateChangeCallbacks;
    constructor(config?: Partial<CircuitBreakerConfig>);
    /**
     * Get current circuit state.
     */
    getState(): CircuitState;
    /**
     * Check if circuit allows execution.
     */
    canExecute(): boolean;
    /**
     * Execute action through circuit breaker.
     *
     * @param fn - Function to execute
     * @param actionId - Action identifier for tracking
     * @returns Function result or throws if circuit is open
     */
    execute<T>(fn: () => Promise<T>, actionId?: string): Promise<T>;
    /**
     * Record action success.
     *
     * @param actionId - Action that succeeded
     */
    recordSuccess(actionId: string): void;
    /**
     * Record action failure.
     *
     * @param actionId - Action that failed
     * @param error - Error that occurred
     */
    recordFailure(actionId: string, error: Error): void;
    /**
     * Transition to a new state.
     */
    private transitionTo;
    /**
     * Open the circuit (stop accepting requests).
     */
    private open;
    /**
     * Close the circuit (resume normal operation).
     */
    private close;
    /**
     * Check if recovery should be attempted.
     */
    private shouldAttemptRecovery;
    /**
     * Get time until recovery attempt.
     */
    getTimeUntilRecovery(): number;
    /**
     * Get recent failure count within the window.
     */
    private getRecentFailureCount;
    /**
     * Remove failures outside the tracking window.
     */
    private pruneOldFailures;
    /**
     * Force circuit to closed state.
     */
    reset(): void;
    /**
     * Force circuit to open state.
     */
    trip(reason?: string): void;
    /**
     * Update configuration.
     */
    configure(config: Partial<CircuitBreakerConfig>): void;
    /**
     * Get circuit breaker metrics.
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Get recent failures.
     */
    getRecentFailures(): FailureRecord[];
    /**
     * Get failure rate (0-1).
     */
    getFailureRate(): number;
    /**
     * Get success rate (0-1).
     */
    getSuccessRate(): number;
    /**
     * Register state change callback.
     */
    onStateChange(callback: (change: CircuitStateChange) => void): void;
    /**
     * Emit state change event.
     */
    private emitStateChange;
    /**
     * Get configuration.
     */
    getConfig(): CircuitBreakerConfig;
    /**
     * Check if circuit is closed.
     */
    isClosed(): boolean;
    /**
     * Check if circuit is open.
     */
    isOpen(): boolean;
    /**
     * Check if circuit is half-open.
     */
    isHalfOpen(): boolean;
}
/**
 * Error thrown when circuit is open.
 */
export declare class CircuitOpenError extends Error {
    readonly retryAfterMs: number;
    constructor(message: string, retryAfterMs: number);
}
/**
 * Create a circuit breaker instance.
 *
 * @param config - Circuit breaker configuration
 */
export declare function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
export {};
