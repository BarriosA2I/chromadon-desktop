/**
 * Mission State Machine
 *
 * Neural RAG Brain Pattern: Event-Driven State Transitions
 *
 * Implements LangGraph-style state machine for mission orchestration:
 * - PENDING → COMPILING → EXECUTING → VERIFYING → COMPLETED
 * - Supports pause/resume/cancel operations
 * - Event-driven transitions with callbacks
 * - Progress tracking with ETA estimation
 */
import type { MissionStep, Action, Checkpoint } from '../interfaces/types';
/**
 * Mission execution states (LangGraph-style).
 */
export type MissionState = 'pending' | 'compiling' | 'executing' | 'verifying' | 'paused' | 'completed' | 'failed' | 'cancelled';
/**
 * State transition event.
 */
export interface StateTransition {
    from: MissionState;
    to: MissionState;
    timestamp: Date;
    reason?: string;
    stepIndex?: number;
}
/**
 * Mission progress snapshot.
 */
export interface ProgressSnapshot {
    missionId: string;
    state: MissionState;
    version: number;
    currentStepIndex: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    elapsedMs: number;
    estimatedRemainingMs: number;
    avgStepDurationMs: number;
}
/**
 * State machine configuration.
 */
export interface StateMachineConfig {
    /** Enable step timing for ETA estimation */
    trackTiming?: boolean;
    /** Maximum history entries to keep */
    maxHistorySize?: number;
    /** Auto-transition from verifying to executing */
    autoAdvance?: boolean;
}
/**
 * Mission State Machine for orchestrating execution flow.
 *
 * Implements event-driven state transitions with:
 * - Validation of allowed transitions
 * - Progress tracking with ETA
 * - Pause/resume/cancel support
 * - State history for debugging
 */
export declare class MissionStateMachine {
    private config;
    private missionId;
    private state;
    private steps;
    private currentStepIndex;
    private startTime;
    private pauseTime;
    private totalPausedMs;
    private stepTimings;
    private history;
    private checkpoints;
    private version;
    private onStateChangeCallbacks;
    private onStepCompleteCallbacks;
    private onProgressCallbacks;
    constructor(missionId: string, config?: StateMachineConfig);
    /**
     * Transition to a new state.
     *
     * @param newState - Target state
     * @param reason - Reason for transition
     * @returns Whether transition was successful
     */
    transition(newState: MissionState, reason?: string): boolean;
    /**
     * Handle special transition logic.
     */
    private handleTransition;
    /**
     * Initialize mission with compiled actions.
     *
     * @param actions - Compiled actions to execute
     */
    initialize(actions: Action[]): void;
    /**
     * Start mission compilation.
     */
    startCompiling(): boolean;
    /**
     * Start mission execution.
     */
    startExecuting(): boolean;
    /**
     * Enter verification state after action.
     */
    startVerifying(): boolean;
    /**
     * Complete the mission successfully.
     */
    complete(): boolean;
    /**
     * Fail the mission with error.
     *
     * @param error - Error that caused failure
     */
    fail(error: Error): boolean;
    /**
     * Pause mission execution.
     */
    pause(): boolean;
    /**
     * Resume mission execution.
     */
    resume(): boolean;
    /**
     * Cancel mission execution.
     *
     * @param reason - Cancellation reason
     */
    cancel(reason?: string): boolean;
    /**
     * Get current step to execute.
     */
    getCurrentStep(): MissionStep | null;
    /**
     * Replace a step with an immutable clone bearing new properties.
     */
    private updateStep;
    /**
     * Mark current step as executing.
     */
    markStepExecuting(): void;
    /**
     * Mark current step as completed and advance.
     *
     * @param result - Action result (optional)
     */
    markStepCompleted(result?: MissionStep['result']): void;
    /**
     * Mark current step as failed.
     *
     * @param error - Error that occurred
     */
    markStepFailed(error: Error): void;
    /**
     * Skip current step.
     *
     * @param reason - Skip reason
     */
    skipStep(reason?: string): void;
    /**
     * Check if all steps are complete.
     */
    isComplete(): boolean;
    /**
     * Check if mission has failed steps.
     */
    hasFailed(): boolean;
    /**
     * Create checkpoint at current step.
     *
     * @param checkpoint - Checkpoint data
     */
    createCheckpoint(checkpoint: Omit<Checkpoint, 'stepIndex' | 'timestamp'>): Checkpoint;
    /**
     * Get checkpoint at step index.
     */
    getCheckpoint(stepIndex: number): Checkpoint | undefined;
    /**
     * Get all checkpoints.
     */
    getAllCheckpoints(): Checkpoint[];
    /**
     * Rollback to checkpoint.
     *
     * @param stepIndex - Step index to rollback to
     */
    rollbackTo(stepIndex: number): boolean;
    /**
     * Get progress snapshot.
     */
    getProgress(): ProgressSnapshot;
    /**
     * Get ETA in milliseconds.
     */
    getETA(): number;
    /**
     * Register state change callback.
     */
    onStateChange(callback: (transition: StateTransition) => void): void;
    /**
     * Register step complete callback.
     */
    onStepComplete(callback: (step: MissionStep) => void): void;
    /**
     * Register progress callback.
     */
    onProgress(callback: (progress: ProgressSnapshot) => void): void;
    /**
     * Emit state change event.
     */
    private emitStateChange;
    /**
     * Emit step complete event.
     */
    private emitStepComplete;
    /**
     * Emit progress event.
     */
    private emitProgress;
    /**
     * Get current state.
     */
    getState(): MissionState;
    /**
     * Get all steps.
     */
    getSteps(): MissionStep[];
    /**
     * Get state history.
     */
    getHistory(): StateTransition[];
    /**
     * Get mission ID.
     */
    getMissionId(): string;
    /**
     * Check if mission is in terminal state.
     */
    isTerminal(): boolean;
    /**
     * Check if mission can be paused.
     */
    canPause(): boolean;
    /**
     * Check if mission can be resumed.
     */
    canResume(): boolean;
    /**
     * Check if mission can be cancelled.
     */
    canCancel(): boolean;
    /**
     * Get current state version (increments on every mutation).
     */
    getVersion(): number;
}
/**
 * Create a mission state machine.
 *
 * @param missionId - Optional mission ID (generates UUID if not provided)
 * @param config - State machine configuration
 */
export declare function createMissionStateMachine(missionId?: string, config?: StateMachineConfig): MissionStateMachine;
//# sourceMappingURL=mission-state-machine.d.ts.map