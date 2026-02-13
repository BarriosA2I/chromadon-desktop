"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMissionStateMachine = exports.MissionStateMachine = void 0;
const uuid_1 = require("uuid");
/**
 * Valid state transitions.
 */
const STATE_TRANSITIONS = {
    pending: ['compiling', 'cancelled'],
    compiling: ['executing', 'failed', 'cancelled'],
    executing: ['verifying', 'paused', 'failed', 'cancelled'],
    verifying: ['executing', 'completed', 'failed', 'cancelled'],
    paused: ['executing', 'cancelled'],
    completed: [], // Terminal state
    failed: [], // Terminal state
    cancelled: [], // Terminal state
};
// =============================================================================
// MISSION STATE MACHINE
// =============================================================================
/**
 * Mission State Machine for orchestrating execution flow.
 *
 * Implements event-driven state transitions with:
 * - Validation of allowed transitions
 * - Progress tracking with ETA
 * - Pause/resume/cancel support
 * - State history for debugging
 */
class MissionStateMachine {
    config;
    missionId;
    state = 'pending';
    steps = [];
    currentStepIndex = 0;
    startTime = null;
    pauseTime = null;
    totalPausedMs = 0;
    stepTimings = [];
    history = [];
    checkpoints = new Map();
    version = 0;
    // Event callbacks
    onStateChangeCallbacks = [];
    onStepCompleteCallbacks = [];
    onProgressCallbacks = [];
    constructor(missionId, config = {}) {
        this.missionId = missionId;
        this.config = {
            trackTiming: config.trackTiming ?? true,
            maxHistorySize: config.maxHistorySize ?? 100,
            autoAdvance: config.autoAdvance ?? true,
        };
    }
    // ===========================================================================
    // STATE TRANSITIONS
    // ===========================================================================
    /**
     * Transition to a new state.
     *
     * @param newState - Target state
     * @param reason - Reason for transition
     * @returns Whether transition was successful
     */
    transition(newState, reason) {
        const allowed = STATE_TRANSITIONS[this.state];
        if (!allowed.includes(newState)) {
            console.warn(`Invalid state transition: ${this.state} → ${newState}. ` +
                `Allowed: ${allowed.join(', ')}`);
            return false;
        }
        const transition = {
            from: this.state,
            to: newState,
            timestamp: new Date(),
            reason,
            stepIndex: this.currentStepIndex,
        };
        // Update state (increment version on every transition)
        const previousState = this.state;
        this.state = newState;
        this.version++;
        // Record history
        this.history.push(transition);
        if (this.history.length > this.config.maxHistorySize) {
            this.history.shift();
        }
        // Handle special transitions
        this.handleTransition(previousState, newState);
        // Emit state change event
        this.emitStateChange(transition);
        return true;
    }
    /**
     * Handle special transition logic.
     */
    handleTransition(from, to) {
        // Start timing when entering compiling
        if (to === 'compiling' && !this.startTime) {
            this.startTime = new Date();
        }
        // Track pause time
        if (to === 'paused') {
            this.pauseTime = new Date();
        }
        // Calculate paused duration when resuming
        if (from === 'paused' && this.pauseTime) {
            this.totalPausedMs += Date.now() - this.pauseTime.getTime();
            this.pauseTime = null;
        }
    }
    // ===========================================================================
    // MISSION LIFECYCLE
    // ===========================================================================
    /**
     * Initialize mission with compiled actions.
     *
     * @param actions - Compiled actions to execute
     */
    initialize(actions) {
        this.steps = actions.map((action, index) => ({
            index,
            action,
            status: 'pending',
        }));
        this.currentStepIndex = 0;
    }
    /**
     * Start mission compilation.
     */
    startCompiling() {
        return this.transition('compiling', 'Starting mission compilation');
    }
    /**
     * Start mission execution.
     */
    startExecuting() {
        return this.transition('executing', 'Starting mission execution');
    }
    /**
     * Enter verification state after action.
     */
    startVerifying() {
        return this.transition('verifying', 'Verifying action result');
    }
    /**
     * Complete the mission successfully.
     */
    complete() {
        return this.transition('completed', 'Mission completed successfully');
    }
    /**
     * Fail the mission with error.
     *
     * @param error - Error that caused failure
     */
    fail(error) {
        return this.transition('failed', `Mission failed: ${error.message}`);
    }
    /**
     * Pause mission execution.
     */
    pause() {
        return this.transition('paused', 'Mission paused by user');
    }
    /**
     * Resume mission execution.
     */
    resume() {
        return this.transition('executing', 'Mission resumed');
    }
    /**
     * Cancel mission execution.
     *
     * @param reason - Cancellation reason
     */
    cancel(reason) {
        return this.transition('cancelled', reason || 'Mission cancelled by user');
    }
    // ===========================================================================
    // STEP MANAGEMENT
    // ===========================================================================
    /**
     * Get current step to execute.
     */
    getCurrentStep() {
        if (this.currentStepIndex >= this.steps.length) {
            return null;
        }
        return this.steps[this.currentStepIndex];
    }
    /**
     * Replace a step with an immutable clone bearing new properties.
     */
    updateStep(index, updates) {
        const updated = { ...this.steps[index], ...updates };
        this.steps[index] = updated;
        this.version++;
        return updated;
    }
    /**
     * Mark current step as executing.
     */
    markStepExecuting() {
        if (this.currentStepIndex < this.steps.length) {
            this.updateStep(this.currentStepIndex, { status: 'executing' });
        }
    }
    /**
     * Mark current step as completed and advance.
     *
     * @param result - Action result (optional)
     */
    markStepCompleted(result) {
        if (this.currentStepIndex < this.steps.length) {
            const updated = this.updateStep(this.currentStepIndex, { status: 'completed', result });
            // Record timing
            if (this.config.trackTiming && result) {
                this.stepTimings.push(result.duration);
            }
            // Emit step complete
            this.emitStepComplete(updated);
            // Advance to next step
            this.currentStepIndex++;
            // Emit progress
            this.emitProgress();
        }
    }
    /**
     * Mark current step as failed.
     *
     * @param error - Error that occurred
     */
    markStepFailed(error) {
        if (this.currentStepIndex < this.steps.length) {
            const step = this.steps[this.currentStepIndex];
            const updated = this.updateStep(this.currentStepIndex, {
                status: 'failed',
                result: {
                    success: false,
                    action: step.action,
                    duration: 0,
                    error,
                    reflection: {
                        shouldRetrieve: false,
                        isRelevant: 0,
                        isSupported: 0,
                        isUseful: 1,
                    },
                },
            });
            // Emit step complete (with failure)
            this.emitStepComplete(updated);
            // Emit progress
            this.emitProgress();
        }
    }
    /**
     * Skip current step.
     *
     * @param reason - Skip reason
     */
    skipStep(reason) {
        if (this.currentStepIndex < this.steps.length) {
            this.updateStep(this.currentStepIndex, { status: 'skipped' });
            this.currentStepIndex++;
            this.emitProgress();
        }
    }
    /**
     * Check if all steps are complete.
     */
    isComplete() {
        return this.currentStepIndex >= this.steps.length;
    }
    /**
     * Check if mission has failed steps.
     */
    hasFailed() {
        return this.steps.some(s => s.status === 'failed');
    }
    // ===========================================================================
    // CHECKPOINTS
    // ===========================================================================
    /**
     * Create checkpoint at current step.
     *
     * @param checkpoint - Checkpoint data
     */
    createCheckpoint(checkpoint) {
        const cp = {
            stepIndex: this.currentStepIndex,
            timestamp: new Date(),
            ...checkpoint,
        };
        this.checkpoints.set(this.currentStepIndex, cp);
        // Associate with step
        const step = this.getCurrentStep();
        if (step) {
            step.checkpoint = cp;
        }
        return cp;
    }
    /**
     * Get checkpoint at step index.
     */
    getCheckpoint(stepIndex) {
        return this.checkpoints.get(stepIndex);
    }
    /**
     * Get all checkpoints.
     */
    getAllCheckpoints() {
        return Array.from(this.checkpoints.values())
            .sort((a, b) => a.stepIndex - b.stepIndex);
    }
    /**
     * Rollback to checkpoint.
     *
     * @param stepIndex - Step index to rollback to
     */
    rollbackTo(stepIndex) {
        const checkpoint = this.checkpoints.get(stepIndex);
        if (!checkpoint) {
            return false;
        }
        // Reset steps after checkpoint (immutable clones)
        for (let i = stepIndex; i < this.steps.length; i++) {
            this.updateStep(i, { status: 'pending', result: undefined });
        }
        // Reset position
        this.currentStepIndex = stepIndex;
        // Update state to executing
        if (this.state !== 'executing') {
            this.transition('executing', `Rolled back to step ${stepIndex}`);
        }
        return true;
    }
    // ===========================================================================
    // PROGRESS & TIMING
    // ===========================================================================
    /**
     * Get progress snapshot.
     */
    getProgress() {
        const completedSteps = this.steps.filter(s => s.status === 'completed').length;
        const failedSteps = this.steps.filter(s => s.status === 'failed').length;
        const skippedSteps = this.steps.filter(s => s.status === 'skipped').length;
        // Calculate elapsed time (excluding paused time)
        let elapsedMs = 0;
        if (this.startTime) {
            elapsedMs = Date.now() - this.startTime.getTime() - this.totalPausedMs;
            if (this.pauseTime) {
                elapsedMs -= Date.now() - this.pauseTime.getTime();
            }
        }
        // Calculate average step duration
        const avgStepDurationMs = this.stepTimings.length > 0
            ? this.stepTimings.reduce((a, b) => a + b, 0) / this.stepTimings.length
            : 0;
        // Estimate remaining time
        const remainingSteps = this.steps.length - this.currentStepIndex;
        const estimatedRemainingMs = avgStepDurationMs * remainingSteps;
        return {
            missionId: this.missionId,
            state: this.state,
            version: this.version,
            currentStepIndex: this.currentStepIndex,
            totalSteps: this.steps.length,
            completedSteps,
            failedSteps,
            skippedSteps,
            elapsedMs,
            estimatedRemainingMs,
            avgStepDurationMs,
        };
    }
    /**
     * Get ETA in milliseconds.
     */
    getETA() {
        return this.getProgress().estimatedRemainingMs;
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
     * Register step complete callback.
     */
    onStepComplete(callback) {
        this.onStepCompleteCallbacks.push(callback);
    }
    /**
     * Register progress callback.
     */
    onProgress(callback) {
        this.onProgressCallbacks.push(callback);
    }
    /**
     * Emit state change event.
     */
    emitStateChange(transition) {
        for (const callback of this.onStateChangeCallbacks) {
            try {
                callback(transition);
            }
            catch (error) {
                console.error('State change callback error:', error);
            }
        }
    }
    /**
     * Emit step complete event.
     */
    emitStepComplete(step) {
        for (const callback of this.onStepCompleteCallbacks) {
            try {
                callback(step);
            }
            catch (error) {
                console.error('Step complete callback error:', error);
            }
        }
    }
    /**
     * Emit progress event.
     */
    emitProgress() {
        const progress = this.getProgress();
        for (const callback of this.onProgressCallbacks) {
            try {
                callback(progress);
            }
            catch (error) {
                console.error('Progress callback error:', error);
            }
        }
    }
    // ===========================================================================
    // GETTERS
    // ===========================================================================
    /**
     * Get current state.
     */
    getState() {
        return this.state;
    }
    /**
     * Get all steps.
     */
    getSteps() {
        return [...this.steps];
    }
    /**
     * Get state history.
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Get mission ID.
     */
    getMissionId() {
        return this.missionId;
    }
    /**
     * Check if mission is in terminal state.
     */
    isTerminal() {
        return ['completed', 'failed', 'cancelled'].includes(this.state);
    }
    /**
     * Check if mission can be paused.
     */
    canPause() {
        return this.state === 'executing';
    }
    /**
     * Check if mission can be resumed.
     */
    canResume() {
        return this.state === 'paused';
    }
    /**
     * Check if mission can be cancelled.
     */
    canCancel() {
        return !this.isTerminal();
    }
    /**
     * Get current state version (increments on every mutation).
     */
    getVersion() {
        return this.version;
    }
}
exports.MissionStateMachine = MissionStateMachine;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a mission state machine.
 *
 * @param missionId - Optional mission ID (generates UUID if not provided)
 * @param config - State machine configuration
 */
function createMissionStateMachine(missionId, config) {
    return new MissionStateMachine(missionId || (0, uuid_1.v4)(), config);
}
exports.createMissionStateMachine = createMissionStateMachine;
//# sourceMappingURL=mission-state-machine.js.map