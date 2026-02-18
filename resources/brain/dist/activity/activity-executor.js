"use strict";
/**
 * ACTIVITY LOG — Tool Executor
 *
 * Factory pattern matching existing CHROMADON tool executors.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityExecutor = void 0;
function createActivityExecutor(activityLog) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'activity_log': {
                    activityLog.log({
                        action: input.action,
                        details: input.details,
                        status: input.status || 'info',
                        toolName: input.tool_name,
                        missionId: input.mission_id,
                        platform: input.platform,
                        durationMs: input.duration_ms,
                    });
                    return JSON.stringify({ success: true, message: 'Activity logged.' });
                }
                case 'activity_get_today': {
                    return activityLog.getTodayGuarded();
                }
                case 'activity_get_range': {
                    const startDate = input.start_date;
                    const endDate = input.end_date;
                    if (!startDate || !endDate) {
                        return JSON.stringify({ error: 'start_date and end_date are required (YYYY-MM-DD format)' });
                    }
                    return activityLog.getRangeGuarded(startDate, endDate);
                }
                default:
                    return JSON.stringify({ error: `Unknown activity tool: ${toolName}` });
            }
        }
        catch (err) {
            return JSON.stringify({ error: err.message });
        }
    };
}
exports.createActivityExecutor = createActivityExecutor;
//# sourceMappingURL=activity-executor.js.map