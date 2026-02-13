/**
 * RALPH Loop Executor
 *
 * "Relentless Autonomous Loop with Persistent History"
 *
 * Wraps any operation in a persistent iterative loop that:
 * 1. Iterates until success (up to maxIterations)
 * 2. Persists state to .ralph/ directory (survives crashes)
 * 3. Learns from failures (adapts strategy each iteration)
 * 4. Only stops for human intervention when truly blocked
 * 5. Tracks costs and enforces limits
 */
import { RalphState, IterationRecord, Adaptation } from './RalphPersistence';
import { ProgressMetrics } from './RalphProgress';
import { InterventionReason, InterventionRequest } from './human-intervention';
import { CompletionSignal } from './completion-signals';
export interface RalphConfig {
    maxIterations: number;
    costLimitUsd: number;
    timeoutMs: number;
    checkpointInterval: number;
    sameActionThreshold: number;
    progressThreshold: number;
    persistenceDir: string;
    missionId?: string;
    interventionTimeoutMs: number;
    onIterationStart?: (iteration: number) => void;
    onIterationEnd?: (iteration: number, result: IterationRecord) => void;
    onIntervention?: (request: InterventionRequest) => void;
    onComplete?: (result: RalphResult<any>) => void;
}
export interface RalphContext {
    task: string;
    previousAttempts?: IterationRecord[];
    adaptations?: Adaptation[];
    metadata?: Record<string, any>;
}
export interface RalphResult<T> {
    success: boolean;
    result?: T;
    completionSignal?: CompletionSignal;
    iterations: number;
    totalCostUsd: number;
    totalTimeMs: number;
    requiresHuman?: boolean;
    interventionReason?: InterventionReason;
    error?: string;
    missionId: string;
}
export declare class RalphLoopExecutor {
    private config;
    private persistence;
    private progress;
    private costTracker;
    private interventionMonitor;
    private state;
    private iterations;
    private startTime;
    constructor(config?: Partial<RalphConfig>);
    /**
     * Execute operation with RALPH loop
     */
    execute<T>(operation: (context: RalphContext) => Promise<T>, initialContext: RalphContext): Promise<RalphResult<T>>;
    /**
     * Initialize new run
     */
    private initializeNewRun;
    /**
     * Resume from existing state
     */
    private resumeFromState;
    /**
     * Build context for current iteration
     */
    private buildIterationContext;
    /**
     * Create iteration record
     */
    private createIterationRecord;
    /**
     * Save iteration record
     */
    private saveIteration;
    /**
     * Save checkpoint
     */
    private saveCheckpoint;
    /**
     * Apply recovery strategy based on error
     */
    private applyRecoveryStrategy;
    /**
     * Detect if stuck in a loop
     */
    private isStuckInLoop;
    /**
     * Handle stuck loop
     */
    private handleStuckLoop;
    /**
     * Handle success
     */
    private handleSuccess;
    /**
     * Handle intervention required
     */
    private handleInterventionRequired;
    /**
     * Handle cost limit reached
     */
    private handleCostLimitReached;
    /**
     * Handle timeout
     */
    private handleTimeout;
    /**
     * Handle max iterations reached
     */
    private handleMaxIterationsReached;
    /**
     * Create abort result
     */
    private createAbortResult;
    /**
     * Wait for resume signal
     */
    private waitForResume;
    /**
     * Update progress
     */
    private updateProgress;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Get current state (for external monitoring)
     */
    getState(): RalphState | null;
    /**
     * Get progress metrics
     */
    getMetrics(): ProgressMetrics | null;
    /**
     * Get mission ID
     */
    getMissionId(): string;
    /**
     * Pause execution
     */
    pause(): Promise<void>;
    /**
     * Resume execution
     */
    resume(): Promise<void>;
    /**
     * Abort execution
     */
    abort(reason: string): Promise<void>;
    /**
     * Respond to intervention
     */
    respondToIntervention(response: {
        action: 'continue' | 'retry' | 'abort' | 'modify';
        data?: Record<string, any>;
    }): Promise<void>;
    /**
     * Record cost for current operation
     */
    recordCost(operation: string, model: string, inputTokens: number, outputTokens: number): Promise<void>;
}
/**
 * Factory function to create RALPH executor with default CHROMADON config
 */
export declare function createRalphExecutor(task: string, config?: Partial<RalphConfig>): RalphLoopExecutor;
