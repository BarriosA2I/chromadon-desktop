"use strict";
/**
 * Marketing Queue - Tool Executor
 *
 * Routes marketing tool calls to the Desktop's queue API
 * and returns formatted text results for Claude's consumption.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMarketingExecutor = void 0;
/**
 * Creates an executor function that calls the Desktop control server's
 * queue endpoints to schedule and query marketing tasks.
 */
function createMarketingExecutor(desktopUrl) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'schedule_post': {
                    const { platforms, content, action, scheduled_time, recurrence, priority, hashtags, target_url, media_urls, } = input;
                    const batchId = platforms.length > 1 ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : undefined;
                    const results = [];
                    for (const platform of platforms) {
                        const resp = await fetch(`${desktopUrl}/queue/add`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform,
                                action: action || 'post',
                                content,
                                targetUrl: target_url,
                                priority: priority ?? 5,
                                scheduledTime: scheduled_time && scheduled_time !== 'null' ? scheduled_time : undefined,
                                recurrence: recurrence && recurrence !== 'none' ? { type: recurrence } : undefined,
                                batchId,
                                hashtags,
                                mediaUrls: media_urls,
                            }),
                        });
                        const data = await resp.json();
                        results.push({
                            platform,
                            taskId: data.task?.id || 'unknown',
                            status: data.task?.status || 'unknown',
                        });
                    }
                    const lines = [];
                    const mediaNote = media_urls?.length ? ` with ${media_urls.length} media file(s)` : '';
                    if (scheduled_time && scheduled_time !== 'null') {
                        lines.push(`Scheduled ${results.length} post(s) for ${scheduled_time}${mediaNote}:`);
                    }
                    else {
                        lines.push(`Added ${results.length} task(s) to queue for immediate execution${mediaNote}:`);
                    }
                    for (const r of results) {
                        lines.push(`  - ${r.platform}: task ${r.taskId} (${r.status})`);
                    }
                    if (batchId) {
                        lines.push(`Cross-post batch: ${batchId}`);
                    }
                    return lines.join('\n');
                }
                case 'get_scheduled_posts': {
                    const { status_filter, platform_filter } = input;
                    const resp = await fetch(`${desktopUrl}/queue`);
                    const data = await resp.json();
                    let tasks = data.queue || [];
                    // Apply filters
                    if (status_filter && status_filter !== 'all') {
                        tasks = tasks.filter((t) => t.status === status_filter);
                    }
                    if (platform_filter) {
                        tasks = tasks.filter((t) => t.platform === platform_filter);
                    }
                    if (tasks.length === 0) {
                        const filterDesc = [status_filter && status_filter !== 'all' ? status_filter : '', platform_filter]
                            .filter(Boolean)
                            .join(' ');
                        return `No ${filterDesc} tasks in the marketing queue.`;
                    }
                    const stats = data.stats || {};
                    const lines = [
                        `Marketing Queue: ${tasks.length} task(s)`,
                        `Stats: ${stats.queued || 0} queued, ${stats.scheduled || 0} scheduled, ${stats.running || 0} running, ${stats.completed || 0} completed, ${stats.failed || 0} failed`,
                        '',
                    ];
                    for (const task of tasks) {
                        const scheduledInfo = task.scheduledTime
                            ? ` | Scheduled: ${task.scheduledTime}`
                            : '';
                        const batchInfo = task.batchId ? ` | Batch: ${task.batchId}` : '';
                        lines.push(`[${task.status.toUpperCase()}] ${task.platform} ${task.action} (ID: ${task.id})${scheduledInfo}${batchInfo}`);
                        if (task.content) {
                            lines.push(`  Content: ${task.content.slice(0, 100)}${task.content.length > 100 ? '...' : ''}`);
                        }
                        if (task.error) {
                            lines.push(`  Error: ${task.error}`);
                        }
                    }
                    return lines.join('\n');
                }
                default:
                    return `Unknown marketing tool: ${toolName}`;
            }
        }
        catch (error) {
            return `Marketing tool error: ${error.message}`;
        }
    };
}
exports.createMarketingExecutor = createMarketingExecutor;
//# sourceMappingURL=marketing-executor.js.map