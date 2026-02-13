/**
 * RALPH Progress Tracking
 *
 * Generates human-readable progress.txt and tracks progress metrics.
 */
import { RalphState, IterationRecord } from './RalphPersistence';
export interface ProgressMetrics {
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    successRate: number;
    totalCostUsd: number;
    avgCostPerIteration: number;
    totalTimeMs: number;
    avgTimePerIteration: number;
    currentStatus: string;
    lastError?: string;
    estimatedRemainingIterations?: number;
}
export declare class RalphProgress {
    private baseDir;
    private progressPath;
    constructor(baseDir: string);
    /**
     * Update progress.txt with current state
     */
    updateProgress(state: RalphState, iterations: IterationRecord[], message?: string): Promise<void>;
    /**
     * Calculate progress metrics
     */
    calculateMetrics(state: RalphState, iterations: IterationRecord[]): ProgressMetrics;
    /**
     * Generate human-readable progress content
     */
    private generateProgressContent;
    /**
     * Format duration in human-readable format
     */
    private formatDuration;
    /**
     * Log a progress event
     */
    logEvent(event: string, details?: Record<string, any>): Promise<void>;
    /**
     * Get current progress as string
     */
    getProgress(): Promise<string>;
}
