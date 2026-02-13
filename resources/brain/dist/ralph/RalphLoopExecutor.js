"use strict";
// @ts-nocheck
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRalphExecutor = exports.RalphLoopExecutor = void 0;
const RalphPersistence_1 = require("./RalphPersistence");
const RalphProgress_1 = require("./RalphProgress");
const CostTracker_1 = require("./CostTracker");
const InterventionMonitor_1 = require("./InterventionMonitor");
const human_intervention_1 = require("./human-intervention");
const completion_signals_1 = require("./completion-signals");
const DEFAULT_CONFIG = {
    maxIterations: 50,
    costLimitUsd: 10.00,
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    checkpointInterval: 1, // Every iteration (user preference)
    sameActionThreshold: 3,
    progressThreshold: 0.05,
    persistenceDir: '.ralph',
    interventionTimeoutMs: 300000, // 5 minutes
};
class RalphLoopExecutor {
    config;
    persistence;
    progress;
    costTracker;
    interventionMonitor;
    state = null;
    iterations = [];
    startTime = 0;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize persistence with mission ID
        const missionId = this.config.missionId || `mission_${Date.now()}`;
        this.persistence = new RalphPersistence_1.RalphPersistence(this.config.persistenceDir, missionId);
        this.progress = new RalphProgress_1.RalphProgress(this.persistence.getBaseDir());
        this.costTracker = new CostTracker_1.CostTracker(this.persistence.getBaseDir(), this.config.costLimitUsd);
        this.interventionMonitor = new InterventionMonitor_1.InterventionMonitor(this.persistence, {
            timeoutMs: this.config.interventionTimeoutMs,
        });
    }
    /**
     * Execute operation with RALPH loop
     */
    async execute(operation, initialContext) {
        // Initialize persistence
        await this.persistence.initialize();
        await this.costTracker.initialize();
        // Check if resuming from previous run
        const existingState = await this.persistence.loadState();
        if (existingState && existingState.status !== 'completed') {
            await this.resumeFromState(existingState);
        }
        else {
            await this.initializeNewRun(initialContext);
        }
        this.startTime = Date.now();
        // Main RALPH loop
        while (this.state.iteration < this.config.maxIterations) {
            // Check signals (pause/abort)
            const signals = await this.interventionMonitor.checkSignals();
            if (signals.shouldAbort) {
                return this.createAbortResult(signals.abortReason);
            }
            if (signals.shouldPause) {
                await this.waitForResume();
            }
            // Check cost limit
            if (this.costTracker.isLimitReached()) {
                return await this.handleCostLimitReached();
            }
            // Check timeout
            if (Date.now() - this.startTime > this.config.timeoutMs) {
                return await this.handleTimeout();
            }
            // Increment iteration
            this.state.iteration++;
            this.state.lastUpdate = Date.now();
            await this.persistence.saveState(this.state);
            // Build context with adaptations
            const iterationContext = this.buildIterationContext(initialContext);
            // Callback
            this.config.onIterationStart?.(this.state.iteration);
            const iterationStart = Date.now();
            let iterationRecord;
            try {
                // Execute the operation
                const result = await operation(iterationContext);
                // Check for completion signal
                if ((0, completion_signals_1.hasCompletionSignal)(result)) {
                    iterationRecord = this.createIterationRecord(iterationStart, true, result);
                    this.iterations.push(iterationRecord);
                    await this.saveIteration(iterationRecord);
                    // Success!
                    return await this.handleSuccess(result);
                }
                // No completion signal - log and continue
                iterationRecord = this.createIterationRecord(iterationStart, true, result);
                iterationRecord.error = 'No completion signal detected';
                this.iterations.push(iterationRecord);
                await this.saveIteration(iterationRecord);
                // Update progress
                await this.updateProgress('Iteration complete, no completion signal - continuing');
            }
            catch (error) {
                // Handle error
                iterationRecord = this.createIterationRecord(iterationStart, false, undefined, error);
                this.iterations.push(iterationRecord);
                await this.saveIteration(iterationRecord);
                // Classify error
                const reason = (0, human_intervention_1.classifyError)(error);
                iterationRecord.errorClassification = reason || undefined;
                // Check if requires human intervention
                if ((0, human_intervention_1.requiresHumanIntervention)(reason)) {
                    return await this.handleInterventionRequired(reason, error);
                }
                // Apply recovery/adaptation strategy
                await this.applyRecoveryStrategy(error, reason);
                // Update progress
                await this.updateProgress(`Iteration failed: ${error.message} - adapting and retrying`);
            }
            // Callback
            this.config.onIterationEnd?.(this.state.iteration, iterationRecord);
            // Checkpoint if needed
            if (this.state.iteration % this.config.checkpointInterval === 0) {
                await this.saveCheckpoint();
            }
            // Detect stuck loops
            if (this.isStuckInLoop()) {
                await this.handleStuckLoop();
            }
        }
        // Max iterations reached
        return await this.handleMaxIterationsReached();
    }
    /**
     * Initialize new run
     */
    async initializeNewRun(context) {
        this.state = {
            missionId: this.persistence.getMissionId(),
            task: context.task,
            iteration: 0,
            status: 'running',
            startTime: Date.now(),
            lastUpdate: Date.now(),
            totalCostUsd: 0,
            checkpointIteration: 0,
            adaptations: [],
            errors: [],
        };
        this.iterations = [];
        await this.persistence.saveState(this.state);
        await this.updateProgress('RALPH loop initialized');
    }
    /**
     * Resume from existing state
     */
    async resumeFromState(existingState) {
        this.state = existingState;
        this.state.status = 'running';
        this.state.lastUpdate = Date.now();
        // Load previous iterations
        this.iterations = await this.persistence.loadAllIterations();
        await this.persistence.saveState(this.state);
        await this.updateProgress(`Resuming from iteration ${this.state.iteration}`);
    }
    /**
     * Build context for current iteration
     */
    buildIterationContext(initialContext) {
        return {
            ...initialContext,
            previousAttempts: this.iterations.slice(-10), // Last 10 attempts
            adaptations: this.state.adaptations.filter(a => a.applied),
        };
    }
    /**
     * Create iteration record
     */
    createIterationRecord(startTime, success, result, error) {
        return {
            iteration: this.state.iteration,
            startTime,
            endTime: Date.now(),
            success,
            result,
            error: error?.message,
            adaptationsApplied: this.state.adaptations
                .filter(a => a.applied && a.iteration === this.state.iteration)
                .map(a => a.type),
            costUsd: 0, // Will be updated by cost tracker
        };
    }
    /**
     * Save iteration record
     */
    async saveIteration(record) {
        await this.persistence.saveIteration(record);
    }
    /**
     * Save checkpoint
     */
    async saveCheckpoint() {
        const checkpoint = {
            iteration: this.state.iteration,
            timestamp: Date.now(),
            state: this.state,
        };
        await this.persistence.saveCheckpoint(checkpoint);
        this.state.checkpointIteration = this.state.iteration;
        await this.updateProgress('Checkpoint saved');
    }
    /**
     * Apply recovery strategy based on error
     */
    async applyRecoveryStrategy(error, reason) {
        const adaptation = {
            iteration: this.state.iteration,
            type: 'strategy_change',
            description: '',
            applied: true,
        };
        // Determine adaptation based on error type
        if ((0, human_intervention_1.canAutoRetry)(reason)) {
            adaptation.type = 'retry_increase';
            adaptation.description = `Auto-retry for ${reason}: adding exponential backoff`;
        }
        else if (error.message.includes('timeout')) {
            adaptation.type = 'timeout_increase';
            adaptation.description = 'Increasing timeout multiplier by 1.5x';
        }
        else if (error.message.includes('selector') || error.message.includes('element')) {
            adaptation.type = 'selector_heal';
            adaptation.description = 'Enabling aggressive selector healing';
        }
        else {
            adaptation.description = `Generic recovery for: ${error.message.substring(0, 50)}`;
        }
        this.state.adaptations.push(adaptation);
        this.state.errors.push({
            iteration: this.state.iteration,
            error: error.message,
            classification: reason,
            timestamp: Date.now(),
            recovered: false,
        });
        await this.persistence.saveState(this.state);
    }
    /**
     * Detect if stuck in a loop
     */
    isStuckInLoop() {
        const recent = this.iterations.slice(-this.config.sameActionThreshold);
        if (recent.length < this.config.sameActionThreshold)
            return false;
        // Check if all recent iterations failed with same error
        const errors = recent.map(r => r.error).filter(Boolean);
        if (errors.length === this.config.sameActionThreshold) {
            const uniqueErrors = new Set(errors);
            if (uniqueErrors.size === 1) {
                return true;
            }
        }
        return false;
    }
    /**
     * Handle stuck loop
     */
    async handleStuckLoop() {
        const adaptation = {
            iteration: this.state.iteration,
            type: 'strategy_change',
            description: 'Detected stuck loop - forcing major strategy change',
            applied: true,
        };
        this.state.adaptations.push(adaptation);
        await this.updateProgress('Stuck loop detected - changing strategy');
    }
    /**
     * Handle success
     */
    async handleSuccess(result) {
        this.state.status = 'completed';
        this.state.totalCostUsd = this.costTracker.getTotalCost();
        await this.persistence.saveState(this.state);
        await this.updateProgress('Mission completed successfully!');
        const finalResult = {
            success: true,
            result,
            completionSignal: (0, completion_signals_1.extractCompletionSignal)(result) || undefined,
            iterations: this.state.iteration,
            totalCostUsd: this.state.totalCostUsd,
            totalTimeMs: Date.now() - this.startTime,
            missionId: this.persistence.getMissionId(),
        };
        this.config.onComplete?.(finalResult);
        return finalResult;
    }
    /**
     * Handle intervention required
     */
    async handleInterventionRequired(reason, error) {
        this.state.status = 'intervention_required';
        await this.persistence.saveState(this.state);
        const request = await this.interventionMonitor.requestIntervention(reason, {
            missionId: this.persistence.getMissionId(),
            iteration: this.state.iteration,
            error,
        });
        this.config.onIntervention?.(request);
        await this.updateProgress(`Human intervention required: ${reason}`);
        // Wait for response
        const response = await this.interventionMonitor.waitForResponse();
        if (response?.action === 'continue' || response?.action === 'retry') {
            // Resume execution
            this.state.status = 'running';
            await this.persistence.saveState(this.state);
            // Will continue in next iteration
            return this.execute(async () => { throw new Error('Retry requested'); }, {
                task: this.state.task,
            });
        }
        // Abort or no response
        return {
            success: false,
            requiresHuman: true,
            interventionReason: reason,
            error: error.message,
            iterations: this.state.iteration,
            totalCostUsd: this.costTracker.getTotalCost(),
            totalTimeMs: Date.now() - this.startTime,
            missionId: this.persistence.getMissionId(),
        };
    }
    /**
     * Handle cost limit reached
     */
    async handleCostLimitReached() {
        return await this.handleInterventionRequired(human_intervention_1.InterventionReason.COST_LIMIT_REACHED, new Error(`Cost limit of $${this.config.costLimitUsd} reached`));
    }
    /**
     * Handle timeout
     */
    async handleTimeout() {
        return await this.handleInterventionRequired(human_intervention_1.InterventionReason.TIMEOUT_REACHED, new Error(`Timeout of ${this.config.timeoutMs}ms reached`));
    }
    /**
     * Handle max iterations reached
     */
    async handleMaxIterationsReached() {
        return await this.handleInterventionRequired(human_intervention_1.InterventionReason.MAX_ITERATIONS_REACHED, new Error(`Maximum iterations (${this.config.maxIterations}) reached`));
    }
    /**
     * Create abort result
     */
    createAbortResult(reason) {
        this.state.status = 'failed';
        this.persistence.saveState(this.state);
        return {
            success: false,
            error: reason || 'Aborted by user',
            iterations: this.state.iteration,
            totalCostUsd: this.costTracker.getTotalCost(),
            totalTimeMs: Date.now() - this.startTime,
            missionId: this.persistence.getMissionId(),
        };
    }
    /**
     * Wait for resume signal
     */
    async waitForResume() {
        this.state.status = 'paused';
        await this.persistence.saveState(this.state);
        await this.updateProgress('Paused - waiting for resume signal');
        while (true) {
            const signals = await this.interventionMonitor.checkSignals();
            if (!signals.shouldPause) {
                this.state.status = 'running';
                await this.persistence.saveState(this.state);
                await this.updateProgress('Resumed');
                break;
            }
            if (signals.shouldAbort) {
                break;
            }
            await this.sleep(1000);
        }
    }
    /**
     * Update progress
     */
    async updateProgress(message) {
        await this.progress.updateProgress(this.state, this.iterations, message);
        await this.progress.logEvent(message, {
            iteration: this.state.iteration,
            status: this.state.status,
        });
    }
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get current state (for external monitoring)
     */
    getState() {
        return this.state;
    }
    /**
     * Get progress metrics
     */
    getMetrics() {
        if (!this.state)
            return null;
        return this.progress.calculateMetrics(this.state, this.iterations);
    }
    /**
     * Get mission ID
     */
    getMissionId() {
        return this.persistence.getMissionId();
    }
    /**
     * Pause execution
     */
    async pause() {
        await this.interventionMonitor.pause();
    }
    /**
     * Resume execution
     */
    async resume() {
        await this.interventionMonitor.resume();
    }
    /**
     * Abort execution
     */
    async abort(reason) {
        await this.interventionMonitor.abort(reason);
    }
    /**
     * Respond to intervention
     */
    async respondToIntervention(response) {
        await this.interventionMonitor.respondToIntervention({
            ...response,
            timestamp: Date.now(),
        });
    }
    /**
     * Record cost for current operation
     */
    async recordCost(operation, model, inputTokens, outputTokens) {
        await this.costTracker.recordTokenUsage(this.state?.iteration || 0, operation, model, inputTokens, outputTokens);
    }
}
exports.RalphLoopExecutor = RalphLoopExecutor;
/**
 * Factory function to create RALPH executor with default CHROMADON config
 */
function createRalphExecutor(task, config = {}) {
    return new RalphLoopExecutor({
        maxIterations: 50,
        costLimitUsd: 10.00,
        checkpointInterval: 1,
        persistenceDir: '.ralph',
        missionId: `chromadon_${Date.now()}`,
        ...config,
    });
}
exports.createRalphExecutor = createRalphExecutor;
