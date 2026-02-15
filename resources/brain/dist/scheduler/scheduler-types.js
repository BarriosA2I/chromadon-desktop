"use strict";
/**
 * THE_SCHEDULER (Agent 0.2) — Type Definitions
 *
 * Tier 0 orchestration agent that replaces the Desktop's fragile 30-second
 * checkScheduledTasks() loop. Zero-cost when idle, general-purpose browser
 * automation scheduling.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmptyState = exports.TaskStatus = void 0;
var TaskStatus;
(function (TaskStatus) {
    TaskStatus["SCHEDULED"] = "scheduled";
    TaskStatus["PENDING"] = "pending";
    TaskStatus["EXECUTING"] = "executing";
    TaskStatus["COMPLETED"] = "completed";
    TaskStatus["FAILED"] = "failed";
    TaskStatus["CANCELLED"] = "cancelled";
})(TaskStatus || (exports.TaskStatus = TaskStatus = {}));
function createEmptyState() {
    return {
        version: 1,
        tasks: [],
        lastSavedAt: new Date().toISOString(),
        stats: { totalScheduled: 0, totalCompleted: 0, totalFailed: 0 },
    };
}
exports.createEmptyState = createEmptyState;
//# sourceMappingURL=scheduler-types.js.map