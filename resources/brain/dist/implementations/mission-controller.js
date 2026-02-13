"use strict";
/**
 * Mission Controller Implementation
 *
 * Neural RAG Brain Pattern: Orchestration + Circuit Breaker + Reflection
 *
 * Orchestrates end-to-end mission execution:
 * - Dual-process routing (System 1/System 2)
 * - Circuit breaker fault isolation
 * - Checkpoint-based recovery
 * - Reflection-driven adaptation
 * - Event-driven state transitions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMissionController = exports.MissionController = void 0;
const uuid_1 = require("uuid");
const types_1 = require("../interfaces/types");
const mission_state_machine_1 = require("../core/mission-state-machine");
const circuit_breaker_1 = require("../core/circuit-breaker");
const retry_strategy_1 = require("../core/retry-strategy");
const DEFAULT_CONFIG = {
    checkpointsEnabled: true,
    checkpointInterval: 1,
    maxRetries: 3,
    defaultActionTimeout: 30000,
    missionTimeout: 300000, // 5 minutes
    enableParallel: true,
    circuitBreaker: {
        failureThreshold: 3,
        recoveryTimeoutMs: 30000,
        successThreshold: 2,
    },
    retry: {
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
    },
    enableReflection: true,
    reflectionThreshold: 0.7,
};
// =============================================================================
// MISSION CONTROLLER IMPLEMENTATION
// =============================================================================
/**
 * Mission Controller for orchestrating browser automation.
 *
 * Implements Neural RAG Brain patterns:
 * - Dual-Process: Route simple vs complex missions
 * - Circuit Breaker: Isolate failures
 * - CRAG: Self-correct on failures
 * - Self-RAG: Reflect on progress
 */
class MissionController {
    config;
    circuitBreaker;
    retryStrategy;
    // Active missions
    activeMissions = new Map();
    missionResults = new Map();
    missionCheckpoints = new Map();
    // Metrics
    metrics = {
        totalMissions: 0,
        successfulMissions: 0,
        failedMissions: 0,
        averageDuration: 0,
        circuitBreakerTrips: 0,
        cragCorrections: 0,
        checkpointsCreated: 0,
        rollbacksPerformed: 0,
    };
    // Timing histogram
    timingHistogram = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize circuit breaker
        this.circuitBreaker = (0, circuit_breaker_1.createCircuitBreaker)(this.config.circuitBreaker);
        this.circuitBreaker.onStateChange(change => {
            if (change.to === 'open') {
                this.metrics.circuitBreakerTrips++;
            }
        });
        // Initialize retry strategy
        this.retryStrategy = (0, retry_strategy_1.createRetryStrategy)(this.config.retry);
    }
    // ===========================================================================
    // MISSION LIFECYCLE
    // ===========================================================================
    /**
     * Execute a mission from start to finish.
     */
    async execute(mission, options) {
        const missionId = mission.id || (0, uuid_1.v4)();
        const startTime = Date.now();
        this.metrics.totalMissions++;
        // Create state machine
        const stateMachine = (0, mission_state_machine_1.createMissionStateMachine)(missionId);
        this.activeMissions.set(missionId, stateMachine);
        this.missionCheckpoints.set(missionId, []);
        // Set up callbacks
        if (options?.onStepComplete) {
            stateMachine.onStepComplete(options.onStepComplete);
        }
        if (options?.onProgress) {
            stateMachine.onProgress(progress => {
                options.onProgress(this.mapProgress(missionId, progress));
            });
        }
        try {
            // Start compilation
            stateMachine.startCompiling();
            // Analyze complexity and route
            const analysis = await this.analyzeComplexity(mission);
            const route = await this.routeMission(mission);
            // Initialize state machine with actions
            stateMachine.initialize(mission.actions);
            // Start execution
            stateMachine.startExecuting();
            // Execute actions
            const steps = [];
            let currentUrl = '';
            while (!stateMachine.isComplete() && !stateMachine.isTerminal()) {
                const step = stateMachine.getCurrentStep();
                if (!step)
                    break;
                // Check circuit breaker
                if (!this.canExecute()) {
                    stateMachine.fail(new circuit_breaker_1.CircuitOpenError('Circuit breaker is open', this.circuitBreaker.getTimeUntilRecovery()));
                    break;
                }
                // Check timeout
                if (Date.now() - startTime >= (options?.timeout || this.config.missionTimeout)) {
                    stateMachine.fail(new Error('Mission timeout exceeded'));
                    break;
                }
                // Mark step as executing
                stateMachine.markStepExecuting();
                // Execute with retry
                const result = await this.executeStepWithRetry(step, mission, options);
                if (result.success) {
                    stateMachine.markStepCompleted(result);
                    this.recordSuccess(step.action.id);
                    // Create checkpoint if enabled
                    if (this.shouldCreateCheckpoint(step.index, options)) {
                        await this.createCheckpoint(missionId, step.index);
                    }
                }
                else {
                    // Determine recovery strategy
                    const checkpoints = this.missionCheckpoints.get(missionId) || [];
                    const recovery = await this.determineRecoveryStrategy(step, result.error || new Error('Unknown error'), {
                        checkpoints,
                        attemptsRemaining: (options?.maxRetries || this.config.maxRetries) - 1,
                        circuitState: this.getCircuitState(),
                    });
                    // Apply recovery
                    if (recovery.type === 'skip' && options?.continueOnError) {
                        stateMachine.skipStep(recovery.reason);
                    }
                    else if (recovery.type === 'rollback' && recovery.checkpointId) {
                        await this.rollbackToCheckpoint(recovery.checkpointId);
                        this.metrics.rollbacksPerformed++;
                    }
                    else {
                        stateMachine.markStepFailed(result.error || new Error('Unknown error'));
                        this.recordFailure(step.action.id, result.error || new Error('Unknown error'));
                        if (!options?.continueOnError) {
                            stateMachine.fail(result.error || new Error('Step execution failed'));
                            break;
                        }
                    }
                }
                steps.push(step);
            }
            // Complete mission
            if (stateMachine.isComplete()) {
                stateMachine.complete();
            }
            // Build result
            const totalDuration = Date.now() - startTime;
            const checkpoints = this.missionCheckpoints.get(missionId) || [];
            const missionResult = {
                success: stateMachine.getState() === 'completed',
                mission,
                steps: stateMachine.getSteps(),
                totalDuration,
                checkpoints,
                finalUrl: currentUrl,
            };
            // Update metrics
            if (missionResult.success) {
                this.metrics.successfulMissions++;
            }
            else {
                this.metrics.failedMissions++;
            }
            this.updateAverageDuration(totalDuration);
            // Store result
            this.missionResults.set(missionId, missionResult);
            this.activeMissions.delete(missionId);
            return missionResult;
        }
        catch (error) {
            const totalDuration = Date.now() - startTime;
            stateMachine.fail(error instanceof Error ? error : new Error(String(error)));
            this.metrics.failedMissions++;
            const missionResult = {
                success: false,
                mission,
                steps: stateMachine.getSteps(),
                totalDuration,
                checkpoints: this.missionCheckpoints.get(missionId) || [],
                finalUrl: '',
            };
            this.missionResults.set(missionId, missionResult);
            this.activeMissions.delete(missionId);
            return missionResult;
        }
    }
    /**
     * Execute mission with real-time streaming.
     */
    async *executeStream(mission, options) {
        const missionId = mission.id || (0, uuid_1.v4)();
        const startTime = Date.now();
        // Create state machine
        const stateMachine = (0, mission_state_machine_1.createMissionStateMachine)(missionId);
        this.activeMissions.set(missionId, stateMachine);
        this.missionCheckpoints.set(missionId, []);
        // Initialize
        stateMachine.startCompiling();
        stateMachine.initialize(mission.actions);
        stateMachine.startExecuting();
        // Yield initial progress
        yield this.mapProgress(missionId, stateMachine.getProgress());
        while (!stateMachine.isComplete() && !stateMachine.isTerminal()) {
            const step = stateMachine.getCurrentStep();
            if (!step)
                break;
            stateMachine.markStepExecuting();
            // Yield progress before execution
            yield this.mapProgress(missionId, stateMachine.getProgress());
            const result = await this.executeStepWithRetry(step, mission, options);
            if (result.success) {
                stateMachine.markStepCompleted(result);
                this.recordSuccess(step.action.id);
            }
            else {
                stateMachine.markStepFailed(result.error || new Error('Unknown error'));
                this.recordFailure(step.action.id, result.error || new Error('Unknown error'));
                if (!options?.continueOnError) {
                    stateMachine.fail(result.error || new Error('Step failed'));
                    break;
                }
            }
            // Yield progress after execution
            yield this.mapProgress(missionId, stateMachine.getProgress());
        }
        if (stateMachine.isComplete()) {
            stateMachine.complete();
        }
        // Build final result
        const missionResult = {
            success: stateMachine.getState() === 'completed',
            mission,
            steps: stateMachine.getSteps(),
            totalDuration: Date.now() - startTime,
            checkpoints: this.missionCheckpoints.get(missionId) || [],
            finalUrl: '',
        };
        this.missionResults.set(missionId, missionResult);
        this.activeMissions.delete(missionId);
        return missionResult;
    }
    /**
     * Pause mission execution.
     */
    async pause(missionId) {
        const stateMachine = this.activeMissions.get(missionId);
        if (stateMachine && stateMachine.canPause()) {
            stateMachine.pause();
        }
    }
    /**
     * Resume paused mission.
     */
    async resume(missionId, fromCheckpoint) {
        const stateMachine = this.activeMissions.get(missionId);
        if (!stateMachine) {
            throw new Error(`Mission ${missionId} not found`);
        }
        if (fromCheckpoint) {
            const checkpoints = this.missionCheckpoints.get(missionId) || [];
            const checkpoint = checkpoints.find(cp => String(cp.stepIndex) === fromCheckpoint);
            if (checkpoint) {
                stateMachine.rollbackTo(checkpoint.stepIndex);
            }
        }
        stateMachine.resume();
        // Continue execution (simplified - in practice would resume the execute loop)
        const result = this.missionResults.get(missionId);
        if (result) {
            return result;
        }
        throw new Error('Mission result not available');
    }
    /**
     * Abort mission execution.
     */
    async abort(missionId, cleanup) {
        const stateMachine = this.activeMissions.get(missionId);
        if (stateMachine && stateMachine.canCancel()) {
            stateMachine.cancel('User requested abort');
            this.activeMissions.delete(missionId);
        }
    }
    // ===========================================================================
    // DUAL-PROCESS ROUTING
    // ===========================================================================
    /**
     * Analyze mission complexity.
     */
    async analyzeComplexity(mission) {
        const actionCount = mission.actions.length;
        const hasConditionals = mission.actions.some(a => a.type === 'conditional');
        const hasNavigation = mission.actions.some(a => a.type === 'navigate');
        // Calculate complexity score
        let complexityScore = 0;
        complexityScore += Math.min(actionCount * 0.1, 0.3);
        if (hasConditionals)
            complexityScore += 0.3;
        if (hasNavigation)
            complexityScore += 0.2;
        // Determine complexity level
        let complexity;
        if (complexityScore < 0.33) {
            complexity = types_1.Complexity.SIMPLE;
        }
        else if (complexityScore < 0.66) {
            complexity = types_1.Complexity.MODERATE;
        }
        else {
            complexity = types_1.Complexity.COMPLEX;
        }
        // Estimate duration
        const avgActionTime = 2000; // 2 seconds per action
        const estimatedDuration = actionCount * avgActionTime;
        // Identify dependencies
        const dependencies = this.analyzeDependencies(mission.actions);
        // Determine strategy
        const strategy = this.config.enableParallel && dependencies.length === 0
            ? 'parallel'
            : 'sequential';
        return {
            complexity,
            estimatedDuration,
            risks: [],
            dependencies,
            strategy,
        };
    }
    /**
     * Route mission to appropriate execution path.
     */
    async routeMission(mission) {
        const analysis = await this.analyzeComplexity(mission);
        const path = analysis.complexity === types_1.Complexity.SIMPLE ? 'system1' : 'system2';
        const reason = analysis.complexity === types_1.Complexity.SIMPLE
            ? 'Simple mission, using fast path'
            : 'Complex mission, using deliberate planning';
        const plan = mission.actions.map((action, index) => ({
            index,
            action,
            status: 'pending',
        }));
        return { path, reason, plan };
    }
    /**
     * Execute action with complexity-appropriate handling.
     */
    async executeAction(action, complexity) {
        const startTime = Date.now();
        // Execute through circuit breaker
        const result = await this.circuitBreaker.execute(async () => {
            // Simulate action execution (in real implementation, would delegate to DOM Surgeon)
            await this.delay(100);
            return { success: true };
        }, action.id);
        const duration = Date.now() - startTime;
        // Generate reflection
        const reflection = this.generateReflection(action, result.success);
        return {
            success: result.success,
            action,
            duration,
            reflection,
        };
    }
    // ===========================================================================
    // CIRCUIT BREAKER
    // ===========================================================================
    getCircuitState() {
        return this.circuitBreaker.getState();
    }
    recordSuccess(actionId) {
        this.circuitBreaker.recordSuccess(actionId);
    }
    recordFailure(actionId, error) {
        this.circuitBreaker.recordFailure(actionId, error);
    }
    canExecute() {
        return this.circuitBreaker.canExecute();
    }
    resetCircuit() {
        this.circuitBreaker.reset();
    }
    configureCircuit(config) {
        this.circuitBreaker.configure({
            failureThreshold: config.failureThreshold,
            recoveryTimeoutMs: config.recoveryTimeout,
            halfOpenMaxAttempts: config.halfOpenMaxAttempts,
        });
    }
    // ===========================================================================
    // CHECKPOINT & RECOVERY
    // ===========================================================================
    async createCheckpoint(missionId, stepIndex) {
        const checkpoint = {
            stepIndex,
            timestamp: new Date(),
            url: '',
        };
        const checkpoints = this.missionCheckpoints.get(missionId) || [];
        checkpoints.push(checkpoint);
        this.missionCheckpoints.set(missionId, checkpoints);
        this.metrics.checkpointsCreated++;
        return checkpoint;
    }
    async getCheckpoint(checkpointId) {
        for (const checkpoints of this.missionCheckpoints.values()) {
            const found = checkpoints.find(cp => String(cp.stepIndex) === checkpointId);
            if (found)
                return found;
        }
        return null;
    }
    async listCheckpoints(missionId) {
        return this.missionCheckpoints.get(missionId) || [];
    }
    async rollbackToCheckpoint(checkpointId) {
        for (const [missionId, stateMachine] of this.activeMissions) {
            const checkpoints = this.missionCheckpoints.get(missionId) || [];
            const checkpoint = checkpoints.find(cp => String(cp.stepIndex) === checkpointId);
            if (checkpoint) {
                stateMachine.rollbackTo(checkpoint.stepIndex);
                return;
            }
        }
    }
    async determineRecoveryStrategy(step, error, context) {
        // If circuit is open, abort
        if (context.circuitState === types_1.CircuitState.OPEN) {
            return {
                type: 'abort',
                reason: 'Circuit breaker is open',
            };
        }
        // If we have retries remaining, retry
        if (context.attemptsRemaining > 0 && this.retryStrategy.isRetryable(error)) {
            return {
                type: 'retry',
                reason: `Retrying (${context.attemptsRemaining} attempts remaining)`,
            };
        }
        // If we have checkpoints, consider rollback
        if (context.checkpoints.length > 0) {
            const lastCheckpoint = context.checkpoints[context.checkpoints.length - 1];
            if (lastCheckpoint.stepIndex < step.index) {
                return {
                    type: 'rollback',
                    checkpointId: String(lastCheckpoint.stepIndex),
                    reason: `Rolling back to checkpoint at step ${lastCheckpoint.stepIndex}`,
                };
            }
        }
        // Default: skip or abort
        return {
            type: 'skip',
            reason: 'No recovery options available, skipping step',
        };
    }
    // ===========================================================================
    // CRAG SELF-CORRECTION
    // ===========================================================================
    async applyCRAG(step, cragAction) {
        this.metrics.cragCorrections++;
        switch (cragAction) {
            case types_1.CRAGAction.GENERATE:
                // Use current approach with minor adjustments
                return { correctedStep: step, confidence: 0.8 };
            case types_1.CRAGAction.DECOMPOSE:
                // Break down into smaller steps
                return { correctedStep: step, confidence: 0.6 };
            case types_1.CRAGAction.WEBSEARCH:
                // Fall back to visual identification
                return { correctedStep: step, confidence: 0.4 };
            default:
                return { correctedStep: step, confidence: 0.5 };
        }
    }
    async generateAlternatives(action, error) {
        // Generate alternative approaches based on error type
        return [
            {
                action: { ...action, timeout: (action.timeout || 30000) * 2 },
                confidence: 0.6,
                reason: 'Increased timeout',
            },
        ];
    }
    async decomposeAction(action) {
        // For now, return the action as-is (would decompose complex actions in real implementation)
        return [action];
    }
    // ===========================================================================
    // SELF-RAG REFLECTION
    // ===========================================================================
    async reflect(missionId, currentStep) {
        const stateMachine = this.activeMissions.get(missionId);
        if (!stateMachine) {
            return {
                shouldRetrieve: false,
                isRelevant: 0,
                isSupported: 0,
                isUseful: 1,
            };
        }
        const progress = stateMachine.getProgress();
        const completionRate = progress.completedSteps / progress.totalSteps;
        return {
            shouldRetrieve: completionRate < 0.5,
            isRelevant: completionRate,
            isSupported: progress.failedSteps === 0 ? 1 : 0.5,
            isUseful: Math.ceil(completionRate * 5),
        };
    }
    evaluateRelevance(result, mission) {
        return result.success ? 1 : 0;
    }
    async evaluateSupport(action) {
        return 1; // Would check page state in real implementation
    }
    evaluateUsefulness(step, mission) {
        if (step.status === 'completed')
            return 5;
        if (step.status === 'skipped')
            return 3;
        return 1;
    }
    shouldRetrieve(reflection) {
        return reflection.shouldRetrieve;
    }
    // ===========================================================================
    // MISSION MANAGEMENT
    // ===========================================================================
    async getStatus(missionId) {
        const stateMachine = this.activeMissions.get(missionId);
        if (!stateMachine) {
            return null;
        }
        return this.mapProgress(missionId, stateMachine.getProgress());
    }
    async getResult(missionId) {
        return this.missionResults.get(missionId) || null;
    }
    async listActiveMissions() {
        const missions = [];
        for (const [id, stateMachine] of this.activeMissions) {
            const progress = stateMachine.getProgress();
            const state = stateMachine.getState();
            let status = 'executing';
            if (state === 'paused')
                status = 'paused';
            else if (state === 'pending' || state === 'compiling')
                status = 'waiting';
            missions.push({
                id,
                description: `Mission ${id}`,
                status,
                progress: progress.totalSteps > 0
                    ? progress.completedSteps / progress.totalSteps
                    : 0,
            });
        }
        return missions;
    }
    async clearHistory(olderThan) {
        let cleared = 0;
        const cutoff = olderThan || new Date(0);
        for (const [id, result] of this.missionResults) {
            if (!olderThan || result.steps[0]?.checkpoint?.timestamp || new Date() < cutoff) {
                this.missionResults.delete(id);
                this.missionCheckpoints.delete(id);
                cleared++;
            }
        }
        return cleared;
    }
    // ===========================================================================
    // METRICS & OBSERVABILITY
    // ===========================================================================
    getMetrics() {
        return { ...this.metrics };
    }
    getTimingHistogram() {
        return new Map(this.timingHistogram);
    }
    async exportTrace(missionId) {
        const result = this.missionResults.get(missionId);
        const checkpoints = this.missionCheckpoints.get(missionId) || [];
        if (!result) {
            throw new Error(`Mission ${missionId} not found`);
        }
        return {
            mission: result.mission,
            steps: result.steps,
            checkpoints,
            reflections: result.steps
                .filter(s => s.reflection)
                .map(s => s.reflection),
            timeline: result.steps.map((step, i) => ({
                timestamp: new Date(),
                event: `Step ${i}: ${step.action.type}`,
                data: step.result,
            })),
        };
    }
    // ===========================================================================
    // PRIVATE HELPERS
    // ===========================================================================
    async executeStepWithRetry(step, mission, options) {
        const retryResult = await this.retryStrategy.execute(async () => {
            return await this.executeAction(step.action, mission.complexity);
        });
        if (retryResult.success && retryResult.result) {
            return retryResult.result;
        }
        return {
            success: false,
            action: step.action,
            duration: retryResult.totalDuration,
            error: retryResult.error,
            reflection: {
                shouldRetrieve: true,
                isRelevant: 0,
                isSupported: 0,
                isUseful: 1,
            },
        };
    }
    shouldCreateCheckpoint(stepIndex, options) {
        if (options?.checkpoints === false)
            return false;
        if (!this.config.checkpointsEnabled)
            return false;
        return (stepIndex + 1) % this.config.checkpointInterval === 0;
    }
    mapProgress(missionId, snapshot) {
        return {
            missionId,
            currentStep: snapshot.currentStepIndex,
            totalSteps: snapshot.totalSteps,
            completedSteps: snapshot.completedSteps,
            failedSteps: snapshot.failedSteps,
            skippedSteps: snapshot.skippedSteps,
            elapsedTime: snapshot.elapsedMs,
            estimatedRemaining: snapshot.estimatedRemainingMs,
            circuitState: this.getCircuitState(),
        };
    }
    analyzeDependencies(actions) {
        // Simple dependency analysis - in real implementation would be more sophisticated
        return [];
    }
    generateReflection(action, success) {
        return {
            shouldRetrieve: !success,
            isRelevant: success ? 1 : 0.5,
            isSupported: success ? 1 : 0.3,
            isUseful: success ? 5 : 2,
        };
    }
    updateAverageDuration(duration) {
        const totalDurations = this.metrics.totalMissions;
        const oldAverage = this.metrics.averageDuration;
        this.metrics.averageDuration =
            (oldAverage * (totalDurations - 1) + duration) / totalDurations;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.MissionController = MissionController;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create a Mission Controller instance.
 */
function createMissionController(config) {
    return new MissionController(config);
}
exports.createMissionController = createMissionController;
//# sourceMappingURL=mission-controller.js.map