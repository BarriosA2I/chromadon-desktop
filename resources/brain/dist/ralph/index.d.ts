/**
 * RALPH - Relentless Autonomous Loop with Persistent History
 *
 * "Never give up. Never surrender. (Unless human says so.)"
 *
 * This module provides persistent iterative loops for CHROMADON agents,
 * ensuring tasks are completed through relentless iteration and adaptation.
 */
export { RalphLoopExecutor, RalphConfig, RalphContext, RalphResult, createRalphExecutor, } from './RalphLoopExecutor';
export { RalphPersistence, RalphState, IterationRecord, Adaptation, Checkpoint, } from './RalphPersistence';
export { RalphProgress, ProgressMetrics, } from './RalphProgress';
export { CostTracker, CostEntry, CostSummary, } from './CostTracker';
export { InterventionMonitor, InterventionConfig, } from './InterventionMonitor';
export { COMPLETION_SIGNALS, CompletionSignal, COMPLETION_SIGNAL_PATTERN, hasCompletionSignal, extractCompletionSignal, addCompletionSignal, } from './completion-signals';
export { InterventionReason, InterventionRequest, InterventionResponse, HUMAN_INTERVENTION_TRIGGERS, AUTO_RETRY_TRIGGERS, ERROR_PATTERNS, classifyError, requiresHumanIntervention, canAutoRetry, getSuggestedActions, } from './human-intervention';
/**
 * Default RALPH configuration for CHROMADON
 * Based on user-approved settings:
 * - Cost limit: $10.00 per task
 * - Default mode: Always on for all operations
 * - Notifications: MCP tools only
 */
export declare const RALPH_DEFAULTS: {
    maxIterations: number;
    costLimitUsd: number;
    timeoutMs: number;
    checkpointInterval: number;
    sameActionThreshold: number;
    progressThreshold: number;
    persistenceDir: string;
    interventionTimeoutMs: number;
    notificationMethod: "mcp";
    completionSignalPattern: RegExp;
    enabledByDefault: boolean;
};
//# sourceMappingURL=index.d.ts.map