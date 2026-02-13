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
/**
 * Retry strategy configuration.
 */
export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Initial delay in ms */
    initialDelayMs: number;
    /** Maximum delay in ms */
    maxDelayMs: number;
    /** Backoff multiplier (e.g., 2 for doubling) */
    backoffMultiplier: number;
    /** Enable jitter (randomization) */
    enableJitter: boolean;
    /** Jitter factor (0-1, percentage of delay) */
    jitterFactor: number;
    /** Timeout per attempt in ms */
    timeoutPerAttemptMs: number;
    /** Total timeout for all attempts in ms */
    totalTimeoutMs: number;
    /** Retryable error codes/patterns */
    retryableErrors: string[];
    /** Non-retryable error codes/patterns */
    nonRetryableErrors: string[];
}
/**
 * Retry attempt result.
 */
export interface RetryAttempt {
    attempt: number;
    success: boolean;
    duration: number;
    error?: Error;
    delayBeforeMs: number;
}
/**
 * Retry result.
 */
export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: RetryAttempt[];
    totalDuration: number;
    finalAttempt: number;
}
/**
 * Backoff calculation result.
 */
export interface BackoffResult {
    delayMs: number;
    delayWithJitterMs: number;
    attempt: number;
}
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
export declare class RetryStrategy {
    private config;
    constructor(config?: Partial<RetryConfig>);
    /**
     * Execute function with retry logic.
     *
     * @param fn - Function to execute
     * @param context - Optional context for error classification
     * @returns Retry result with all attempt details
     */
    execute<T>(fn: () => Promise<T>, context?: {
        actionId?: string;
    }): Promise<RetryResult<T>>;
    /**
     * Execute with timeout.
     */
    private executeWithTimeout;
    /**
     * Calculate backoff delay for an attempt.
     *
     * @param attempt - Attempt number (1-based)
     * @returns Backoff calculation result
     */
    calculateBackoff(attempt: number): BackoffResult;
    /**
     * Calculate jitter for a delay.
     *
     * Uses decorrelated jitter for better distribution:
     * jitter = [-jitterFactor, +jitterFactor] * delay * random
     */
    private calculateJitter;
    /**
     * Get delay sequence for all attempts.
     */
    getDelaySequence(): number[];
    /**
     * Check if error is retryable.
     *
     * @param error - Error to check
     * @returns Whether the error should be retried
     */
    isRetryable(error: Error): boolean;
    /**
     * Check if value matches pattern.
     */
    private matchesPattern;
    /**
     * Delay for specified milliseconds.
     */
    private delay;
    /**
     * Get configuration.
     */
    getConfig(): RetryConfig;
    /**
     * Update configuration.
     */
    configure(config: Partial<RetryConfig>): void;
    /**
     * Get total maximum duration.
     */
    getMaxDuration(): number;
}
/**
 * Error thrown when retry attempt times out.
 */
export declare class RetryTimeoutError extends Error {
    constructor(message: string);
}
/**
 * Error thrown when all retries are exhausted.
 */
export declare class RetryExhaustedError extends Error {
    readonly attempts: RetryAttempt[];
    readonly lastError?: Error;
    constructor(message: string, attempts: RetryAttempt[], lastError?: Error);
}
/**
 * Create a retry strategy instance.
 *
 * @param config - Retry configuration
 */
export declare function createRetryStrategy(config?: Partial<RetryConfig>): RetryStrategy;
/**
 * Create a retry strategy with preset configurations.
 */
export declare const RetryPresets: {
    /**
     * Conservative: Few retries, longer delays.
     */
    conservative(): RetryStrategy;
    /**
     * Aggressive: Many retries, shorter delays.
     */
    aggressive(): RetryStrategy;
    /**
     * Fast: Quick retries for transient failures.
     */
    fast(): RetryStrategy;
    /**
     * Network: Tuned for network failures.
     */
    network(): RetryStrategy;
    /**
     * DOM: Tuned for DOM operation failures.
     */
    dom(): RetryStrategy;
};
//# sourceMappingURL=retry-strategy.d.ts.map