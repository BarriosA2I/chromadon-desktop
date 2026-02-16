/**
 * RALPH Intervention Monitor
 *
 * Detects when human intervention is needed and manages the request/response cycle.
 * Uses filesystem signals for pause/abort and MCP tools for notifications.
 */
import { InterventionReason, InterventionRequest, InterventionResponse } from './human-intervention';
import { RalphPersistence } from './RalphPersistence';
export interface InterventionConfig {
    timeoutMs: number;
    pollIntervalMs: number;
    screenshotOnIntervention: boolean;
    notifyMethod: 'mcp' | 'file';
}
export declare class InterventionMonitor {
    private config;
    private persistence;
    private currentRequest;
    constructor(persistence: RalphPersistence, config?: Partial<InterventionConfig>);
    /**
     * Check if error requires human intervention
     */
    checkError(error: Error | string): {
        requiresIntervention: boolean;
        reason: InterventionReason | null;
    };
    /**
     * Request human intervention
     */
    requestIntervention(reason: InterventionReason, context: {
        missionId: string;
        iteration: number;
        error?: Error | string;
        screenshotPath?: string;
        additionalContext?: Record<string, any>;
    }): Promise<InterventionRequest>;
    /**
     * Wait for human response
     */
    waitForResponse(): Promise<InterventionResponse | null>;
    /**
     * Check for pause/abort signals
     */
    checkSignals(): Promise<{
        shouldPause: boolean;
        shouldAbort: boolean;
        abortReason?: string;
    }>;
    /**
     * Create pause signal
     */
    pause(): Promise<void>;
    /**
     * Remove pause signal
     */
    resume(): Promise<void>;
    /**
     * Create abort signal
     */
    abort(reason: string): Promise<void>;
    /**
     * Get current intervention request (for MCP status)
     */
    getCurrentRequest(): InterventionRequest | null;
    /**
     * Respond to intervention (for MCP tools)
     */
    respondToIntervention(response: InterventionResponse): Promise<void>;
    /**
     * Get message for intervention reason
     */
    private getInterventionMessage;
    /**
     * Helper to sleep
     */
    private sleep;
}
//# sourceMappingURL=InterventionMonitor.d.ts.map