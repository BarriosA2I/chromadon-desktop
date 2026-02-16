"use strict";
// @ts-nocheck
/**
 * RALPH - Relentless Autonomous Loop with Persistent History
 *
 * "Never give up. Never surrender. (Unless human says so.)"
 *
 * This module provides persistent iterative loops for CHROMADON agents,
 * ensuring tasks are completed through relentless iteration and adaptation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RALPH_DEFAULTS = exports.getSuggestedActions = exports.canAutoRetry = exports.requiresHumanIntervention = exports.classifyError = exports.ERROR_PATTERNS = exports.AUTO_RETRY_TRIGGERS = exports.HUMAN_INTERVENTION_TRIGGERS = exports.InterventionReason = exports.addCompletionSignal = exports.extractCompletionSignal = exports.hasCompletionSignal = exports.COMPLETION_SIGNAL_PATTERN = exports.COMPLETION_SIGNALS = exports.InterventionMonitor = exports.CostTracker = exports.RalphProgress = exports.RalphPersistence = exports.createRalphExecutor = exports.RalphLoopExecutor = void 0;
// Core executor
var RalphLoopExecutor_1 = require("./RalphLoopExecutor");
Object.defineProperty(exports, "RalphLoopExecutor", { enumerable: true, get: function () { return RalphLoopExecutor_1.RalphLoopExecutor; } });
Object.defineProperty(exports, "createRalphExecutor", { enumerable: true, get: function () { return RalphLoopExecutor_1.createRalphExecutor; } });
// Persistence
var RalphPersistence_1 = require("./RalphPersistence");
Object.defineProperty(exports, "RalphPersistence", { enumerable: true, get: function () { return RalphPersistence_1.RalphPersistence; } });
// Progress tracking
var RalphProgress_1 = require("./RalphProgress");
Object.defineProperty(exports, "RalphProgress", { enumerable: true, get: function () { return RalphProgress_1.RalphProgress; } });
// Cost tracking
var CostTracker_1 = require("./CostTracker");
Object.defineProperty(exports, "CostTracker", { enumerable: true, get: function () { return CostTracker_1.CostTracker; } });
// Intervention monitoring
var InterventionMonitor_1 = require("./InterventionMonitor");
Object.defineProperty(exports, "InterventionMonitor", { enumerable: true, get: function () { return InterventionMonitor_1.InterventionMonitor; } });
// Completion signals
var completion_signals_1 = require("./completion-signals");
Object.defineProperty(exports, "COMPLETION_SIGNALS", { enumerable: true, get: function () { return completion_signals_1.COMPLETION_SIGNALS; } });
Object.defineProperty(exports, "COMPLETION_SIGNAL_PATTERN", { enumerable: true, get: function () { return completion_signals_1.COMPLETION_SIGNAL_PATTERN; } });
Object.defineProperty(exports, "hasCompletionSignal", { enumerable: true, get: function () { return completion_signals_1.hasCompletionSignal; } });
Object.defineProperty(exports, "extractCompletionSignal", { enumerable: true, get: function () { return completion_signals_1.extractCompletionSignal; } });
Object.defineProperty(exports, "addCompletionSignal", { enumerable: true, get: function () { return completion_signals_1.addCompletionSignal; } });
// Human intervention
var human_intervention_1 = require("./human-intervention");
Object.defineProperty(exports, "InterventionReason", { enumerable: true, get: function () { return human_intervention_1.InterventionReason; } });
Object.defineProperty(exports, "HUMAN_INTERVENTION_TRIGGERS", { enumerable: true, get: function () { return human_intervention_1.HUMAN_INTERVENTION_TRIGGERS; } });
Object.defineProperty(exports, "AUTO_RETRY_TRIGGERS", { enumerable: true, get: function () { return human_intervention_1.AUTO_RETRY_TRIGGERS; } });
Object.defineProperty(exports, "ERROR_PATTERNS", { enumerable: true, get: function () { return human_intervention_1.ERROR_PATTERNS; } });
Object.defineProperty(exports, "classifyError", { enumerable: true, get: function () { return human_intervention_1.classifyError; } });
Object.defineProperty(exports, "requiresHumanIntervention", { enumerable: true, get: function () { return human_intervention_1.requiresHumanIntervention; } });
Object.defineProperty(exports, "canAutoRetry", { enumerable: true, get: function () { return human_intervention_1.canAutoRetry; } });
Object.defineProperty(exports, "getSuggestedActions", { enumerable: true, get: function () { return human_intervention_1.getSuggestedActions; } });
/**
 * Default RALPH configuration for CHROMADON
 * Based on user-approved settings:
 * - Cost limit: $10.00 per task
 * - Default mode: Always on for all operations
 * - Notifications: MCP tools only
 */
exports.RALPH_DEFAULTS = {
    // Iteration limits
    maxIterations: 50,
    costLimitUsd: 10.00,
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    // Checkpointing (every step as per user preference)
    checkpointInterval: 1,
    // Loop detection
    sameActionThreshold: 3,
    progressThreshold: 0.05,
    // Persistence
    persistenceDir: '.ralph',
    // Intervention
    interventionTimeoutMs: 300000, // 5 minutes
    notificationMethod: 'mcp',
    // Completion detection
    completionSignalPattern: /<promise>.*COMPLETE.*<\/promise>/,
    // RALPH is always on
    enabledByDefault: true,
};
//# sourceMappingURL=index.js.map