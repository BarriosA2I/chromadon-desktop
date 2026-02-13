/**
 * RALPH Persistence Layer
 *
 * Manages filesystem state for crash recovery and cross-session persistence.
 * All state is stored in .ralph/ directory.
 */
/// <reference types="node" />
/// <reference types="node" />
export interface RalphState {
    missionId: string;
    task: string;
    iteration: number;
    status: 'running' | 'paused' | 'completed' | 'failed' | 'intervention_required';
    startTime: number;
    lastUpdate: number;
    totalCostUsd: number;
    checkpointIteration: number;
    adaptations: Adaptation[];
    errors: IterationError[];
}
export interface Adaptation {
    iteration: number;
    type: 'retry_increase' | 'timeout_increase' | 'selector_heal' | 'strategy_change';
    description: string;
    applied: boolean;
}
export interface IterationError {
    iteration: number;
    error: string;
    classification: string | null;
    timestamp: number;
    recovered: boolean;
}
export interface IterationRecord {
    iteration: number;
    startTime: number;
    endTime: number;
    success: boolean;
    result?: any;
    error?: string;
    errorClassification?: string;
    adaptationsApplied: string[];
    costUsd: number;
}
export interface Checkpoint {
    iteration: number;
    timestamp: number;
    state: RalphState;
    memorySnapshot?: {
        procedural?: any;
        healing?: any;
    };
}
export declare class RalphPersistence {
    private baseDir;
    private missionId;
    constructor(baseDir?: string, missionId?: string);
    /**
     * Initialize .ralph directory structure
     */
    initialize(): Promise<void>;
    /**
     * Save current state
     */
    saveState(state: RalphState): Promise<void>;
    /**
     * Load current state (returns null if not exists)
     */
    loadState(): Promise<RalphState | null>;
    /**
     * Save iteration record
     */
    saveIteration(record: IterationRecord): Promise<void>;
    /**
     * Load iteration record
     */
    loadIteration(iteration: number): Promise<IterationRecord | null>;
    /**
     * Get all iteration records
     */
    loadAllIterations(): Promise<IterationRecord[]>;
    /**
     * Save checkpoint
     */
    saveCheckpoint(checkpoint: Checkpoint): Promise<void>;
    /**
     * Load latest checkpoint
     */
    loadLatestCheckpoint(): Promise<Checkpoint | null>;
    /**
     * Save memory snapshot
     */
    saveMemory(type: 'procedural' | 'healing', data: any): Promise<void>;
    /**
     * Load memory snapshot
     */
    loadMemory(type: 'procedural' | 'healing'): Promise<any | null>;
    /**
     * Save intervention request
     */
    saveInterventionRequest(request: any): Promise<void>;
    /**
     * Load intervention response
     */
    loadInterventionResponse(): Promise<any | null>;
    /**
     * Clear intervention files
     */
    clearIntervention(): Promise<void>;
    /**
     * Check for pause/abort signals
     */
    checkSignals(): Promise<{
        pause: boolean;
        abort: boolean;
        reason?: string;
    }>;
    /**
     * Save screenshot artifact
     */
    saveScreenshot(iteration: number, data: Buffer | string): Promise<string>;
    /**
     * Get mission ID
     */
    getMissionId(): string;
    /**
     * Get base directory
     */
    getBaseDir(): string;
    /**
     * Check if mission exists (for resume)
     */
    static exists(baseDir: string, missionId: string): boolean;
    /**
     * List all missions
     */
    static listMissions(baseDir?: string): string[];
}
