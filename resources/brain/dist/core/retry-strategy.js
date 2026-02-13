"use strict";
/**
 * Retry Strategy
 *
 * Neural RAG Brain Pattern: Graceful Degradation
 *
 * Implements retry logic with:
 * - Exponential backoff with configurable base/max
 * - Jitter to prevent thundering herd
 * - Retryable error classification
 * - Circuit breaker integration
 * - Timeout handling
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryPresets = exports.createRetryStrategy = exports.RetryExhaustedError = exports.RetryTimeoutError = exports.RetryStrategy = void 0;
// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    enableJitter: true,
    jitterFactor: 0.25,
    timeoutPerAttemptMs: 10000,
    totalTimeoutMs: 60000,
    retryableErrors: [
        'ETIMEDOUT',
        'ECONNRESET',
        'ECONNREFUSED',
        'EPIPE',
        'ENOTFOUND',
        'ENETUNREACH',
        'EAI_AGAIN',
        'TimeoutError',
        'NetworkError',
        'FetchError',
        'AbortError',
    ],
    nonRetryableErrors: [
        'ValidationError',
        'AuthenticationError',
        'AuthorizationError',
        'NotFoundError',
        'BadRequestError',
    ],
};
// =============================================================================
// RETRY STRATEGY IMPLEMENTATION
// =============================================================================
/**
 * Retry Strategy for fault-tolerant execution.
 *
 * Implements exponential backoff with jitter:
 * ```
 * delay = min(maxDelay, initialDelay * (multiplier ^ attempt))
 * jitter = delay * jitterFactor * random()
 * finalDelay = delay + jitter
 * ```
 */
class RetryStrategy {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // ===========================================================================
    // EXECUTION
    // ===========================================================================
    /**
     * Execute function with retry logic.
     *
     * @param fn - Function to execute
     * @param context - Optional context for error classification
     * @returns Retry result with all attempt details
     */
    async execute(fn, context) {
        const attempts = [];
        const startTime = Date.now();
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
            // Check total timeout
            const elapsed = Date.now() - startTime;
            if (elapsed >= this.config.totalTimeoutMs) {
                break;
            }
            // Calculate and apply delay (skip for first attempt)
            let delayBeforeMs = 0;
            if (attempt > 1) {
                const backoff = this.calculateBackoff(attempt - 1);
                delayBeforeMs = backoff.delayWithJitterMs;
                // Ensure we don't exceed total timeout
                const maxDelay = this.config.totalTimeoutMs - elapsed;
                delayBeforeMs = Math.min(delayBeforeMs, maxDelay);
                if (delayBeforeMs > 0) {
                    await this.delay(delayBeforeMs);
                }
            }
            const attemptStart = Date.now();
            try {
                // Execute with per-attempt timeout
                const result = await this.executeWithTimeout(fn, this.config.timeoutPerAttemptMs);
                const attemptResult = {
                    attempt,
                    success: true,
                    duration: Date.now() - attemptStart,
                    delayBeforeMs,
                };
                attempts.push(attemptResult);
                return {
                    success: true,
                    result,
                    attempts,
                    totalDuration: Date.now() - startTime,
                    finalAttempt: attempt,
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const attemptResult = {
                    attempt,
                    success: false,
                    duration: Date.now() - attemptStart,
                    error: lastError,
                    delayBeforeMs,
                };
                attempts.push(attemptResult);
                // Check if error is retryable
                if (!this.isRetryable(lastError)) {
                    break;
                }
                // Don't retry if we've exhausted attempts
                if (attempt >= this.config.maxAttempts) {
                    break;
                }
            }
        }
        return {
            success: false,
            error: lastError,
            attempts,
            totalDuration: Date.now() - startTime,
            finalAttempt: attempts.length,
        };
    }
    /**
     * Execute with timeout.
     */
    async executeWithTimeout(fn, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new RetryTimeoutError(`Attempt timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            fn()
                .then(result => {
                clearTimeout(timeoutId);
                resolve(result);
            })
                .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }
    // ===========================================================================
    // BACKOFF CALCULATION
    // ===========================================================================
    /**
     * Calculate backoff delay for an attempt.
     *
     * @param attempt - Attempt number (1-based)
     * @returns Backoff calculation result
     */
    calculateBackoff(attempt) {
        // Exponential backoff: delay = initialDelay * (multiplier ^ (attempt - 1))
        const exponentialDelay = this.config.initialDelayMs *
            Math.pow(this.config.backoffMultiplier, attempt - 1);
        // Cap at max delay
        const delayMs = Math.min(exponentialDelay, this.config.maxDelayMs);
        // Apply jitter
        let delayWithJitterMs = delayMs;
        if (this.config.enableJitter) {
            const jitter = this.calculateJitter(delayMs);
            delayWithJitterMs = delayMs + jitter;
        }
        return {
            delayMs,
            delayWithJitterMs,
            attempt,
        };
    }
    /**
     * Calculate jitter for a delay.
     *
     * Uses decorrelated jitter for better distribution:
     * jitter = [-jitterFactor, +jitterFactor] * delay * random
     */
    calculateJitter(delayMs) {
        const maxJitter = delayMs * this.config.jitterFactor;
        // Random value between -maxJitter and +maxJitter
        return (Math.random() * 2 - 1) * maxJitter;
    }
    /**
     * Get delay sequence for all attempts.
     */
    getDelaySequence() {
        const delays = [];
        for (let i = 1; i <= this.config.maxAttempts; i++) {
            const backoff = this.calculateBackoff(i);
            delays.push(backoff.delayWithJitterMs);
        }
        return delays;
    }
    // ===========================================================================
    // ERROR CLASSIFICATION
    // ===========================================================================
    /**
     * Check if error is retryable.
     *
     * @param error - Error to check
     * @returns Whether the error should be retried
     */
    isRetryable(error) {
        const errorName = error.name;
        const errorMessage = error.message;
        const errorCode = error.code;
        // Check non-retryable first
        for (const pattern of this.config.nonRetryableErrors) {
            if (this.matchesPattern(errorName, pattern) ||
                this.matchesPattern(errorMessage, pattern) ||
                this.matchesPattern(errorCode, pattern)) {
                return false;
            }
        }
        // Check retryable
        for (const pattern of this.config.retryableErrors) {
            if (this.matchesPattern(errorName, pattern) ||
                this.matchesPattern(errorMessage, pattern) ||
                this.matchesPattern(errorCode, pattern)) {
                return true;
            }
        }
        // Default: retry on unknown errors
        return true;
    }
    /**
     * Check if value matches pattern.
     */
    matchesPattern(value, pattern) {
        if (!value)
            return false;
        return value.includes(pattern);
    }
    // ===========================================================================
    // UTILITY
    // ===========================================================================
    /**
     * Delay for specified milliseconds.
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get configuration.
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
     * Get total maximum duration.
     */
    getMaxDuration() {
        let total = 0;
        for (let i = 1; i <= this.config.maxAttempts; i++) {
            total += this.config.timeoutPerAttemptMs;
            if (i < this.config.maxAttempts) {
                const backoff = this.calculateBackoff(i);
                total += backoff.delayMs;
            }
        }
        return Math.min(total, this.config.totalTimeoutMs);
    }
}
exports.RetryStrategy = RetryStrategy;
// =============================================================================
// RETRY TIMEOUT ERROR
// =============================================================================
/**
 * Error thrown when retry attempt times out.
 */
class RetryTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RetryTimeoutError';
    }
}
exports.RetryTimeoutError = RetryTimeoutError;
// =============================================================================
// RETRY EXHAUSTED ERROR
// =============================================================================
/**
 * Error thrown when all retries are exhausted.
 */
class RetryExhaustedError extends Error {
    attempts;
    lastError;
    constructor(message, attempts, lastError) {
        super(message);
        this.name = 'RetryExhaustedError';
        this.attempts = attempts;
        this.lastError = lastError;
    }
}
exports.RetryExhaustedError = RetryExhaustedError;
// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================
/**
 * Create a retry strategy instance.
 *
 * @param config - Retry configuration
 */
function createRetryStrategy(config) {
    return new RetryStrategy(config);
}
exports.createRetryStrategy = createRetryStrategy;
/**
 * Create a retry strategy with preset configurations.
 */
exports.RetryPresets = {
    /**
     * Conservative: Few retries, longer delays.
     */
    conservative() {
        return new RetryStrategy({
            maxAttempts: 2,
            initialDelayMs: 2000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            enableJitter: true,
            jitterFactor: 0.2,
        });
    },
    /**
     * Aggressive: Many retries, shorter delays.
     */
    aggressive() {
        return new RetryStrategy({
            maxAttempts: 5,
            initialDelayMs: 500,
            maxDelayMs: 10000,
            backoffMultiplier: 1.5,
            enableJitter: true,
            jitterFactor: 0.3,
        });
    },
    /**
     * Fast: Quick retries for transient failures.
     */
    fast() {
        return new RetryStrategy({
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 2000,
            backoffMultiplier: 2,
            enableJitter: true,
            jitterFactor: 0.1,
        });
    },
    /**
     * Network: Tuned for network failures.
     */
    network() {
        return new RetryStrategy({
            maxAttempts: 4,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
            backoffMultiplier: 2,
            enableJitter: true,
            jitterFactor: 0.25,
            retryableErrors: [
                'ETIMEDOUT',
                'ECONNRESET',
                'ECONNREFUSED',
                'EPIPE',
                'ENOTFOUND',
                'ENETUNREACH',
                'EAI_AGAIN',
                'NetworkError',
                'FetchError',
            ],
        });
    },
    /**
     * DOM: Tuned for DOM operation failures.
     */
    dom() {
        return new RetryStrategy({
            maxAttempts: 3,
            initialDelayMs: 500,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
            enableJitter: true,
            jitterFactor: 0.2,
            retryableErrors: [
                'ElementNotFoundError',
                'ElementNotVisibleError',
                'ElementNotInteractableError',
                'StaleElementError',
                'TimeoutError',
            ],
        });
    },
};
//# sourceMappingURL=retry-strategy.js.map