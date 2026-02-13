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
import type { IMissionController, ExecutionOptions, MissionProgress, RecoveryStrategy, MissionAnalysis } from '../interfaces/mission-controller';
import { type Action, type ActionResult, type Checkpoint, CircuitState, Complexity, CRAGAction, type Mission, type MissionResult, type MissionStep, type ReflectionResult } from '../interfaces/types';
/**
 * Mission Controller configuration.
 */
export interface MissionControllerConfig {
    /** Enable checkpoint creation */
    checkpointsEnabled: boolean;
    /** Checkpoint interval (every N steps) */
    checkpointInterval: number;
    /** Maximum retries per action */
    maxRetries: number;
    /** Default timeout per action (ms) */
    defaultActionTimeout: number;
    /** Total mission timeout (ms) */
    missionTimeout: number;
    /** Enable parallel action execution */
    enableParallel: boolean;
    /** Circuit breaker configuration */
    circuitBreaker: {
        failureThreshold: number;
        recoveryTimeoutMs: number;
        successThreshold: number;
    };
    /** Retry strategy configuration */
    retry: {
        maxAttempts: number;
        initialDelayMs: number;
        maxDelayMs: number;
    };
    /** Enable reflection for each step */
    enableReflection: boolean;
    /** Reflection confidence threshold */
    reflectionThreshold: number;
}
/**
 * Mission Controller for orchestrating browser automation.
 *
 * Implements Neural RAG Brain patterns:
 * - Dual-Process: Route simple vs complex missions
 * - Circuit Breaker: Isolate failures
 * - CRAG: Self-correct on failures
 * - Self-RAG: Reflect on progress
 */
export declare class MissionController implements IMissionController {
    private config;
    private circuitBreaker;
    private retryStrategy;
    private activeMissions;
    private missionResults;
    private missionCheckpoints;
    private metrics;
    private timingHistogram;
    constructor(config?: Partial<MissionControllerConfig>);
    /**
     * Execute a mission from start to finish.
     */
    execute(mission: Mission, options?: ExecutionOptions): Promise<MissionResult>;
    /**
     * Execute mission with real-time streaming.
     */
    executeStream(mission: Mission, options?: ExecutionOptions): AsyncGenerator<MissionProgress, MissionResult, unknown>;
    /**
     * Pause mission execution.
     */
    pause(missionId: string): Promise<void>;
    /**
     * Resume paused mission.
     */
    resume(missionId: string, fromCheckpoint?: string): Promise<MissionResult>;
    /**
     * Abort mission execution.
     */
    abort(missionId: string, cleanup?: boolean): Promise<void>;
    /**
     * Analyze mission complexity.
     */
    analyzeComplexity(mission: Mission): Promise<MissionAnalysis>;
    /**
     * Route mission to appropriate execution path.
     */
    routeMission(mission: Mission): Promise<{
        path: 'system1' | 'system2';
        reason: string;
        plan: MissionStep[];
    }>;
    /**
     * Execute action with complexity-appropriate handling.
     */
    executeAction(action: Action, complexity: Complexity): Promise<ActionResult>;
    getCircuitState(): CircuitState;
    recordSuccess(actionId: string): void;
    recordFailure(actionId: string, error: Error): void;
    canExecute(): boolean;
    resetCircuit(): void;
    configureCircuit(config: {
        failureThreshold?: number;
        recoveryTimeout?: number;
        halfOpenMaxAttempts?: number;
    }): void;
    createCheckpoint(missionId: string, stepIndex: number): Promise<Checkpoint>;
    getCheckpoint(checkpointId: string): Promise<Checkpoint | null>;
    listCheckpoints(missionId: string): Promise<Checkpoint[]>;
    rollbackToCheckpoint(checkpointId: string): Promise<void>;
    determineRecoveryStrategy(step: MissionStep, error: Error, context: {
        checkpoints: Checkpoint[];
        attemptsRemaining: number;
        circuitState: CircuitState;
    }): Promise<RecoveryStrategy>;
    applyCRAG(step: MissionStep, cragAction: CRAGAction): Promise<{
        correctedStep: MissionStep;
        confidence: number;
    }>;
    generateAlternatives(action: Action, error: Error): Promise<Array<{
        action: Action;
        confidence: number;
        reason: string;
    }>>;
    decomposeAction(action: Action): Promise<Action[]>;
    reflect(missionId: string, currentStep: number): Promise<ReflectionResult>;
    evaluateRelevance(result: ActionResult, mission: Mission): number;
    evaluateSupport(action: Action): Promise<number>;
    evaluateUsefulness(step: MissionStep, mission: Mission): number;
    shouldRetrieve(reflection: ReflectionResult): boolean;
    getStatus(missionId: string): Promise<MissionProgress | null>;
    getResult(missionId: string): Promise<MissionResult | null>;
    listActiveMissions(): Promise<Array<{
        id: string;
        description: string;
        status: 'executing' | 'paused' | 'waiting';
        progress: number;
    }>>;
    clearHistory(olderThan?: Date): Promise<number>;
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
    getTimingHistogram(): Map<string, number[]>;
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
    private executeStepWithRetry;
    private shouldCreateCheckpoint;
    private mapProgress;
    private analyzeDependencies;
    private generateReflection;
    private updateAverageDuration;
    private delay;
}
/**
 * Create a Mission Controller instance.
 */
export declare function createMissionController(config?: Partial<MissionControllerConfig>): MissionController;
//# sourceMappingURL=mission-controller.d.ts.map