"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCircuitBreaker = exports.CircuitOpenError = exports.CircuitBreaker = void 0;
const types_1 = require("../interfaces/types");
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    failureThreshold: 3,
    recoveryTimeoutMs: 30000, // 30 seconds
    successThreshold: 2,
    halfOpenMaxAttempts: 3,
    failureWindowMs: 60000, // 1 minute
    enableLogging: false,
};
// =============================================================================
// CIRCUIT BREAKER IMPLEMENTATION
// =============================================================================
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
class CircuitBreaker {
    config;
    state = types_1.CircuitState.CLOSED;
    failures = [];
    halfOpenAttempts = 0;
    halfOpenSuccesses = 0;
    openedAt = null;
    lastStateChange = null;
    // Metrics
    totalRequests = 0;
    successfulRequests = 0;
    failedRequests = 0;
    rejectedRequests = 0;
    circuitTrips = 0;
    recoveries = 0;
    lastFailure = null;
    lastSuccess = null;
    // Event callbacks
    onStateChangeCallbacks = [];
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ===========================================================================
    // STATE MANAGEMENT
    // ===========================================================================
    /**
     * Get current circuit state.
     */
    getState() {
        // Check if we should transition from OPEN to HALF_OPEN
        if (this.state === types_1.CircuitState.OPEN && this.shouldAttemptRecovery()) {
            this.transitionTo(types_1.CircuitState.HALF_OPEN, 'Recovery timeout elapsed');
        }
        return this.state;
    }
    /**
     * Check if circuit allows execution.
     */
    canExecute() {
        const state = this.getState();
        switch (state) {
            case types_1.CircuitState.CLOSED:
                return true;
            case types_1.CircuitState.OPEN:
                return false;
            case types_1.CircuitState.HALF_OPEN:
                // Allow limited requests in half-open state
                return this.halfOpenAttempts < this.config.halfOpenMaxAttempts;
            default:
                return false;
        }
    }
    /**
     * Execute action through circuit breaker.
     *
     * @param fn - Function to execute
     * @param actionId - Action identifier for tracking
     * @returns Function result or throws if circuit is open
     */
    async execute(fn, actionId = 'unknown') {
        this.totalRequests++;
        // Check if circuit allows execution
        if (!this.canExecute()) {
            this.rejectedRequests++;
            throw new CircuitOpenError(`Circuit is ${this.state}. Request rejected.`, this.getTimeUntilRecovery());
        }
        // Track half-open attempts
        if (this.state === types_1.CircuitState.HALF_OPEN) {
            this.halfOpenAttempts++;
        }
        try {
            const result = await fn();
            this.recordSuccess(actionId);
            return result;
        }
        catch (error) {
            this.recordFailure(actionId, error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    // ===========================================================================
    // SUCCESS/FAILURE RECORDING
    // ===========================================================================
    /**
     * Record action success.
     *
     * @param actionId - Action that succeeded
     */
    recordSuccess(actionId) {
        this.successfulRequests++;
        this.lastSuccess = new Date();
        if (this.config.enableLogging) {
            console.log(`[CircuitBreaker] Success: ${actionId} (state: ${this.state})`);
        }
        if (this.state === types_1.CircuitState.HALF_OPEN) {
            this.halfOpenSuccesses++;
            // Check if we should close the circuit
            if (this.halfOpenSuccesses >= this.config.successThreshold) {
                this.close();
            }
        }
    }
    /**
     * Record action failure.
     *
     * @param actionId - Action that failed
     * @param error - Error that occurred
     */
    recordFailure(actionId, error) {
        this.failedRequests++;
        this.lastFailure = new Date();
        if (this.config.enableLogging) {
            console.log(`[CircuitBreaker] Failure: ${actionId} - ${error.message} (state: ${this.state})`);
        }
        // Add to failures list
        this.failures.push({
            timestamp: new Date(),
            actionId,
            error,
        });
        // Remove old failures outside the window
        this.pruneOldFailures();
        if (this.state === types_1.CircuitState.HALF_OPEN) {
            // Any failure in half-open state opens the circuit
            this.open(`Failure during recovery test: ${error.message}`);
        }
        else if (this.state === types_1.CircuitState.CLOSED) {
            // Check if we should open the circuit
            if (this.getRecentFailureCount() >= this.config.failureThreshold) {
                this.open(`Failure threshold reached (${this.config.failureThreshold} failures)`);
            }
        }
    }
    // ===========================================================================
    // STATE TRANSITIONS
    // ===========================================================================
    /**
     * Transition to a new state.
     */
    transitionTo(newState, reason) {
        const oldState = this.state;
        if (oldState === newState) {
            return;
        }
        this.state = newState;
        this.lastStateChange = new Date();
        // Reset state-specific counters
        if (newState === types_1.CircuitState.HALF_OPEN) {
            this.halfOpenAttempts = 0;
            this.halfOpenSuccesses = 0;
        }
        if (this.config.enableLogging) {
            console.log(`[CircuitBreaker] State change: ${oldState} → ${newState} (${reason})`);
        }
        // Emit state change event
        this.emitStateChange({
            from: oldState,
            to: newState,
            timestamp: new Date(),
            reason,
        });
    }
    /**
     * Open the circuit (stop accepting requests).
     */
    open(reason) {
        this.transitionTo(types_1.CircuitState.OPEN, reason);
        this.openedAt = new Date();
        this.circuitTrips++;
    }
    /**
     * Close the circuit (resume normal operation).
     */
    close() {
        this.transitionTo(types_1.CircuitState.CLOSED, 'Recovery successful');
        this.openedAt = null;
        this.failures = [];
        this.recoveries++;
    }
    // ===========================================================================
    // RECOVERY
    // ===========================================================================
    /**
     * Check if recovery should be attempted.
     */
    shouldAttemptRecovery() {
        if (this.state !== types_1.CircuitState.OPEN || !this.openedAt) {
            return false;
        }
        const elapsed = Date.now() - this.openedAt.getTime();
        return elapsed >= this.config.recoveryTimeoutMs;
    }
    /**
     * Get time until recovery attempt.
     */
    getTimeUntilRecovery() {
        if (this.state !== types_1.CircuitState.OPEN || !this.openedAt) {
            return 0;
        }
        const elapsed = Date.now() - this.openedAt.getTime();
        const remaining = this.config.recoveryTimeoutMs - elapsed;
        return Math.max(0, remaining);
    }
    // ===========================================================================
    // FAILURE TRACKING
    // ===========================================================================
    /**
     * Get recent failure count within the window.
     */
    getRecentFailureCount() {
        const now = Date.now();
        return this.failures.filter(f => now - f.timestamp.getTime() < this.config.failureWindowMs).length;
    }
    /**
     * Remove failures outside the tracking window.
     */
    pruneOldFailures() {
        const cutoff = Date.now() - this.config.failureWindowMs;
        this.failures = this.failures.filter(f => f.timestamp.getTime() >= cutoff);
    }
    // ===========================================================================
    // MANUAL CONTROLS
    // ===========================================================================
    /**
     * Force circuit to closed state.
     */
    reset() {
        this.transitionTo(types_1.CircuitState.CLOSED, 'Manual reset');
        this.openedAt = null;
        this.failures = [];
        this.halfOpenAttempts = 0;
        this.halfOpenSuccesses = 0;
    }
    /**
     * Force circuit to open state.
     */
    trip(reason = 'Manual trip') {
        this.open(reason);
    }
    /**
     * Update configuration.
     */
    configure(config) {
        this.config = { ...this.config, ...config };
    }
    // ===========================================================================
    // METRICS & OBSERVABILITY
    // ===========================================================================
    /**
     * Get circuit breaker metrics.
     */
    getMetrics() {
        return {
            state: this.getState(),
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            rejectedRequests: this.rejectedRequests,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
            lastStateChange: this.lastStateChange,
            circuitTrips: this.circuitTrips,
            recoveries: this.recoveries,
        };
    }
    /**
     * Get recent failures.
     */
    getRecentFailures() {
        this.pruneOldFailures();
        return [...this.failures];
    }
    /**
     * Get failure rate (0-1).
     */
    getFailureRate() {
        if (this.totalRequests === 0) {
            return 0;
        }
        return this.failedRequests / this.totalRequests;
    }
    /**
     * Get success rate (0-1).
     */
    getSuccessRate() {
        return 1 - this.getFailureRate();
    }
    // ===========================================================================
    // EVENT CALLBACKS
    // ===========================================================================
    /**
     * Register state change callback.
     */
    onStateChange(callback) {
        this.onStateChangeCallbacks.push(callback);
    }
    /**
     * Emit state change event.
     */
    emitStateChange(change) {
        for (const callback of this.onStateChangeCallbacks) {
            try {
                callback(change);
            }
            catch (error) {
                console.error('State change callback error:', error);
            }
        }
    }
    // ===========================================================================
    // GETTERS
    // ===========================================================================
    /**
     * Get configuration.
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Check if circuit is closed.
     */
    isClosed() {
        return this.getState() === types_1.CircuitState.CLOSED;
    }
    /**
     * Check if circuit is open.
     */
    isOpen() {
        return this.getState() === types_1.CircuitState.OPEN;
    }
    /**
     * Check if circuit is half-open.
     */
    isHalfOpen() {
        return this.getState() === types_1.CircuitState.HALF_OPEN;
    }
}
exports.CircuitBreaker = CircuitBreaker;
// =============================================================================
// CIRCUIT OPEN ERROR
// =============================================================================
/**
 * Error thrown when circuit is open.
 */
class CircuitOpenError extends Error {
    retryAfterMs;
    constructor(message, retryAfterMs) {
        super(message);
        this.name = 'CircuitOpenError';
        this.retryAfterMs = retryAfterMs;
    }
}
exports.CircuitOpenError = CircuitOpenError;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a circuit breaker instance.
 *
 * @param config - Circuit breaker configuration
 */
function createCircuitBreaker(config) {
    return new CircuitBreaker(config);
}
exports.createCircuitBreaker = createCircuitBreaker;
