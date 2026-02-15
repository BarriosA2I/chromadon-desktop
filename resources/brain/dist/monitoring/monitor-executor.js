"use strict";
/**
 * Social Media Monitoring - Tool Executor
 *
 * Routes social_monitor and monitoring_log tool calls to the SocialMonitor.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMonitoringExecutor = void 0;
function createMonitoringExecutor(monitor, db) {
    return async (toolName, input) => {
        switch (toolName) {
            case 'social_monitor': {
                const action = input.action;
                if (action === 'enable') {
                    monitor.start();
                    const status = monitor.getStatus();
                    return JSON.stringify({
                        success: true,
                        message: `Social media monitoring enabled. Checking ${status.config.platforms.join(', ')} every ${status.config.intervalMinutes} minutes.`,
                        status,
                    });
                }
                if (action === 'disable') {
                    monitor.stop();
                    return JSON.stringify({
                        success: true,
                        message: 'Social media monitoring disabled.',
                    });
                }
                if (action === 'status') {
                    const status = monitor.getStatus();
                    return JSON.stringify({
                        success: true,
                        ...status,
                        summary: status.enabled
                            ? `Monitoring ${status.config.platforms.join(', ')} every ${status.config.intervalMinutes}min. ${status.totalReplies} total replies across ${status.totalCycles} cycles.`
                            : 'Monitoring is currently disabled.',
                    });
                }
                if (action === 'configure') {
                    const updates = {};
                    if (input.interval_minutes)
                        updates.intervalMinutes = input.interval_minutes;
                    if (input.platforms)
                        updates.platforms = input.platforms;
                    if (input.max_replies_per_cycle)
                        updates.maxRepliesPerCycle = input.max_replies_per_cycle;
                    monitor.configure(updates);
                    const status = monitor.getStatus();
                    return JSON.stringify({
                        success: true,
                        message: 'Monitoring configuration updated.',
                        config: status.config,
                    });
                }
                return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
            }
            case 'monitoring_log': {
                const platform = input.platform;
                const limit = input.limit || 20;
                try {
                    const logs = db.getMonitoringLog?.(platform, limit) || [];
                    if (logs.length === 0) {
                        return JSON.stringify({
                            success: true,
                            message: platform
                                ? `No monitoring activity for ${platform} yet.`
                                : 'No monitoring activity yet. Enable monitoring with the social_monitor tool.',
                            entries: [],
                        });
                    }
                    return JSON.stringify({
                        success: true,
                        count: logs.length,
                        entries: logs,
                    });
                }
                catch {
                    return JSON.stringify({
                        success: true,
                        message: 'Monitoring log not available yet. Enable monitoring first.',
                        entries: [],
                    });
                }
            }
            default:
                return JSON.stringify({ success: false, error: `Unknown monitoring tool: ${toolName}` });
        }
    };
}
exports.createMonitoringExecutor = createMonitoringExecutor;
//# sourceMappingURL=monitor-executor.js.map