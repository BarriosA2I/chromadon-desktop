/**
 * IMissionController Interface
 *
 * Neural RAG Brain Pattern: Dual-Process Routing + Circuit Breaker
 *
 * Orchestrates mission execution with:
 * - System 1/System 2 complexity-based routing
 * - Circuit breaker fault isolation
 * - Checkpoint-based recovery
 * - Reflection-driven adaptation
 */
import type { Action, ActionResult, Checkpoint, CircuitState, Complexity, CRAGAction, Mission, MissionResult, MissionStep, ReflectionResult } from './types';
/**
 * Mission execution options.
 */
export interface ExecutionOptions {
    /** Enable checkpoint creation at each step */
    checkpoints?: boolean;
    /** Maximum retries per action */
    maxRetries?: number;
    /** Timeout for entire mission (ms) */
    timeout?: number;
    /** Enable parallel action execution where possible */
    parallel?: boolean;
    /** Continue on non-critical failures */
    continueOnError?: boolean;
    /** Callback for step completion */
    onStepComplete?: (step: MissionStep) => void;
    /** Callback for mission progress */
    onProgress?: (progress: MissionProgress) => void;
}
/**
 * Mission progress information.
 */
export interface MissionProgress {
    missionId: string;
    currentStep: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    elapsedTime: number;
    estimatedRemaining: number;
    circuitState: CircuitState;
}
/**
 * Recovery strategy for failed missions.
 */
export interface RecoveryStrategy {
    /** Type of recovery to attempt */
    type: 'retry' | 'rollback' | 'skip' | 'alternative' | 'abort';
    /** Checkpoint to rollback to (for rollback type) */
    checkpointId?: string;
    /** Alternative action to try (for alternative type) */
    alternativeAction?: Action;
    /** Reason for choosing this strategy */
    reason: string;
}
/**
 * Mission analysis result.
 */
export interface MissionAnalysis {
    /** Estimated complexity */
    complexity: Complexity;
    /** Estimated duration (ms) */
    estimatedDuration: number;
    /** Risk factors identified */
    risks: Array<{
        description: string;
        likelihood: number;
        impact: number;
        mitigation?: string;
    }>;
    /** Dependencies between actions */
    dependencies: Array<{
        actionId: string;
        dependsOn: string[];
    }>;
    /** Recommended execution strategy */
    strategy: 'sequential' | 'parallel' | 'hybrid';
}
/**
 * Mission Controller interface for orchestrating browser automation.
 *
 * Implements Neural RAG Brain patterns:
 * - Dual-Process: Route simple vs complex missions appropriately
 * - Circuit Breaker: Isolate failures, prevent cascade
 * - CRAG: Self-correct on failures
 * - Self-RAG: Reflect on progress, adapt strategy
 */
export interface IMissionController {
    /**
     * Execute a mission from start to finish.
     *
     * @param mission - Mission to execute
     * @param options - Execution options
     * @returns Mission result with all step details
     */
    execute(mission: Mission, options?: ExecutionOptions): Promise<MissionResult>;
    /**
     * Execute mission with real-time streaming.
     * Yields progress updates as mission executes.
     *
     * @param mission - Mission to execute
     * @param options - Execution options
     */
    executeStream(mission: Mission, options?: ExecutionOptions): AsyncGenerator<MissionProgress, MissionResult, unknown>;
    /**
     * Pause mission execution.
     * Mission can be resumed later.
     *
     * @param missionId - Mission to pause
     */
    pause(missionId: string): Promise<void>;
    /**
     * Resume paused mission.
     *
     * @param missionId - Mission to resume
     * @param fromCheckpoint - Resume from specific checkpoint
     */
    resume(missionId: string, fromCheckpoint?: string): Promise<MissionResult>;
    /**
     * Abort mission execution.
     *
     * @param missionId - Mission to abort
     * @param cleanup - Whether to cleanup (close dialogs, etc.)
     */
    abort(missionId: string, cleanup?: boolean): Promise<void>;
    /**
     * Analyze mission complexity for routing.
     * System 1: Simple missions, fast execution
     * System 2: Complex missions, careful planning
     *
     * @param mission - Mission to analyze
     * @returns Complexity analysis
     */
    analyzeComplexity(mission: Mission): Promise<MissionAnalysis>;
    /**
     * Route mission to appropriate execution path.
     *
     * @param mission - Mission to route
     * @returns Routed mission with execution plan
     */
    routeMission(mission: Mission): Promise<{
        path: 'system1' | 'system2';
        reason: string;
        plan: MissionStep[];
    }>;
    /**
     * Execute action with complexity-appropriate handling.
     *
     * @param action - Action to execute
     * @param complexity - Determined complexity level
     */
    executeAction(action: Action, complexity: Complexity): Promise<ActionResult>;
    /**
     * Get current circuit breaker state.
     */
    getCircuitState(): CircuitState;
    /**
     * Record action success (closes circuit if half-open).
     *
     * @param actionId - Action that succeeded
     */
    recordSuccess(actionId: string): void;
    /**
     * Record action failure (may open circuit).
     *
     * @param actionId - Action that failed
     * @param error - Error that occurred
     */
    recordFailure(actionId: string, error: Error): void;
    /**
     * Check if circuit allows execution.
     * Returns false if circuit is OPEN.
     */
    canExecute(): boolean;
    /**
     * Reset circuit breaker to CLOSED state.
     */
    resetCircuit(): void;
    /**
     * Configure circuit breaker thresholds.
     *
     * @param config - Circuit breaker configuration
     */
    configureCircuit(config: {
        failureThreshold?: number;
        recoveryTimeout?: number;
        halfOpenMaxAttempts?: number;
    }): void;
    /**
     * Create checkpoint at current state.
     *
     * @param missionId - Mission to checkpoint
     * @param stepIndex - Current step index
     */
    createCheckpoint(missionId: string, stepIndex: number): Promise<Checkpoint>;
    /**
     * Get checkpoint by ID.
     *
     * @param checkpointId - Checkpoint ID
     */
    getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    /**
     * List checkpoints for mission.
     *
     * @param missionId - Mission ID
     */
    listCheckpoints(missionId: string): Promise<Checkpoint[]>;
    /**
     * Rollback to checkpoint.
     * Restores browser state to checkpoint.
     *
     * @param checkpointId - Checkpoint to restore
     */
    rollbackToCheckpoint(checkpointId: string): Promise<void>;
    /**
     * Determine recovery strategy for failure.
     *
     * @param step - Failed step
     * @param error - Error that occurred
     * @param context - Execution context
     */
    determineRecoveryStrategy(step: MissionStep, error: Error, context: {
        checkpoints: Checkpoint[];
        attemptsRemaining: number;
        circuitState: CircuitState;
    }): Promise<RecoveryStrategy>;
    /**
     * Apply CRAG corrective action.
     *
     * @param step - Step that needs correction
     * @param cragAction - CRAG action to apply
     */
    applyCRAG(step: MissionStep, cragAction: CRAGAction): Promise<{
        correctedStep: MissionStep;
        confidence: number;
    }>;
    /**
     * Generate alternative approaches for failed action.
     *
     * @param action - Failed action
     * @param error - Error that occurred
     */
    generateAlternatives(action: Action, error: Error): Promise<Array<{
        action: Action;
        confidence: number;
        reason: string;
    }>>;
    /**
     * Decompose complex action into simpler steps.
     * CRAG DECOMPOSE pattern.
     *
     * @param action - Action to decompose
     */
    decomposeAction(action: Action): Promise<Action[]>;
    /**
     * Reflect on mission progress.
     * Generates [RET][REL][SUP][USE] tokens.
     *
     * @param missionId - Mission to reflect on
     * @param currentStep - Current step index
     */
    reflect(missionId: string, currentStep: number): Promise<ReflectionResult>;
    /**
     * Evaluate action result relevance to mission.
     * [REL] token generation.
     *
     * @param result - Action result
     * @param mission - Overall mission
     */
    evaluateRelevance(result: ActionResult, mission: Mission): number;
    /**
     * Evaluate if action is supported by page state.
     * [SUP] token generation.
     *
     * @param action - Action to evaluate
     */
    evaluateSupport(action: Action): Promise<number>;
    /**
     * Evaluate usefulness of completed step.
     * [USE] token generation (1-5 scale).
     *
     * @param step - Completed step
     * @param mission - Overall mission
     */
    evaluateUsefulness(step: MissionStep, mission: Mission): number;
    /**
     * Determine if more context retrieval is needed.
     * [RET] token evaluation.
     *
     * @param reflection - Current reflection
     */
    shouldRetrieve(reflection: ReflectionResult): boolean;
    /**
     * Get mission status.
     *
     * @param missionId - Mission ID
     */
    getStatus(missionId: string): Promise<MissionProgress | null>;
    /**
     * Get mission result.
     *
     * @param missionId - Mission ID
     */
    getResult(missionId: string): Promise<MissionResult | null>;
    /**
     * List active missions.
     */
    listActiveMissions(): Promise<Array<{
        id: string;
        description: string;
        status: 'executing' | 'paused' | 'waiting';
        progress: number;
    }>>;
    /**
     * Clear completed mission history.
     *
     * @param olderThan - Clear missions older than this date
     */
    clearHistory(olderThan?: Date): Promise<number>;
    /**
     * Get execution metrics.
     */
    getMetrics(): {
        totalMissions: number;
        successfulMissions: number;
        failedMissions: number;
        averageDuration: number;
        circuitBreakerTrips: number;
        cragCorrections: number;
        checkpointsCreated: number;
        rollbacksPerformed: number;
    };
    /**
     * Get action timing histogram.
     */
    getTimingHistogram(): Map<string, number[]>;
    /**
     * Export execution trace for debugging.
     *
     * @param missionId - Mission to export
     */
    exportTrace(missionId: string): Promise<{
        mission: Mission;
        steps: MissionStep[];
        checkpoints: Checkpoint[];
        reflections: ReflectionResult[];
        timeline: Array<{
            timestamp: Date;
            event: string;
            data?: unknown;
        }>;
    }>;
}
/**
 * Factory function type for creating Mission Controller instances.
 */
export type MissionControllerFactory = (dependencies: {
    browserController: unknown;
    domSurgeon: unknown;
    visualVerifier: unknown;
}) => IMissionController;
//# sourceMappingURL=mission-controller.d.ts.map