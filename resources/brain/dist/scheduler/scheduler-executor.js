"use strict";
/**
 * THE_SCHEDULER — Tool Call Executor
 *
 * Routes AI tool calls to TheScheduler methods.
 * For schedule_post, constructs NL instruction from structured fields.
 * Uses chrono-node for natural language time parsing.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchedulerExecutor = void 0;
const fs = __importStar(require("fs"));
const chrono = __importStar(require("chrono-node"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('scheduler');
/**
 * Parse natural language or ISO 8601 time into UTC ISO string.
 * Uses chrono-node for NL ("3pm tomorrow", "next Monday at 9am", "in 2 hours").
 */
function parseTime(timeStr) {
    if (!timeStr) {
        // No time = 30 seconds from now (immediate-ish)
        return new Date(Date.now() + 30_000).toISOString();
    }
    // Try ISO 8601 first
    const iso = new Date(timeStr);
    if (!isNaN(iso.getTime()) && timeStr.includes('T')) {
        return iso.toISOString();
    }
    // Try chrono-node NL parsing
    const parsed = chrono.parseDate(timeStr, new Date(), { forwardDate: true });
    if (parsed) {
        return parsed.toISOString();
    }
    // Last resort: try as Date string
    const fallback = new Date(timeStr);
    if (!isNaN(fallback.getTime())) {
        return fallback.toISOString();
    }
    throw new Error(`Could not parse time: "${timeStr}". Use natural language like "3pm tomorrow" or ISO 8601 format.`);
}
function toEST(d) {
    const EST_OFFSET = -5;
    const est = new Date(d.getTime() + EST_OFFSET * 60 * 60 * 1000);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const h = est.getUTCHours();
    const m = est.getUTCMinutes();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    const time = m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
    return `${days[est.getUTCDay()]} ${months[est.getUTCMonth()]} ${est.getUTCDate()} at ${time} EST`;
}
function createSchedulerExecutor(scheduler, getAuthenticatedPlatforms, getClientMedia, trinityIntel) {
    return async (toolName, input) => {
        switch (toolName) {
            // ==================================================================
            // GENERAL-PURPOSE SCHEDULING
            // ==================================================================
            case 'schedule_task': {
                const scheduledTimeUtc = parseTime(input.scheduled_time);
                const taskId = scheduler.addTask({
                    instruction: input.instruction,
                    taskType: input.task_type || 'custom',
                    scheduledTimeUtc,
                    recurrence: input.recurrence || 'none',
                    recurrenceEndDate: input.recurrence_end_date,
                    platforms: input.platforms,
                    mediaUrls: input.media_urls,
                });
                const timeLabel = toEST(new Date(scheduledTimeUtc));
                const recLabel = input.recurrence && input.recurrence !== 'none' ? ` (${input.recurrence})` : '';
                return `Scheduled task ${taskId} for ${timeLabel}${recLabel}: "${input.instruction.slice(0, 100)}"`;
            }
            // ==================================================================
            // SOCIAL POST ALIAS (backward compat)
            // ==================================================================
            case 'schedule_post': {
                let { platforms, content, hashtags, scheduled_time, recurrence, topic } = input;
                const media_urls = input.media_urls;
                // Filter out unauthenticated platforms (AI may include platforms not in linked list)
                if (getAuthenticatedPlatforms && platforms?.length) {
                    try {
                        const authed = await getAuthenticatedPlatforms();
                        if (authed.length > 0) {
                            const filtered = platforms.filter((p) => authed.includes(p.toLowerCase()));
                            if (filtered.length > 0)
                                platforms = filtered;
                        }
                    }
                    catch { /* fallback to all platforms if check fails */ }
                }
                // CHROMADON auto-media: detect if this is a CHROMADON/Barrios post and auto-attach assets
                const CHROMADON_VIDEO = 'G:\\My Drive\\Logo\\Barrios a2i new website\\Chromadon\\Logo first video.mp4';
                const CHROMADON_IMAGE = 'G:\\My Drive\\Logo\\Barrios a2i new website\\Chromadon\\Chromadon Logo.jfif';
                const combinedText = `${content || ''} ${topic || ''}`.toLowerCase();
                const isChromadonPost = combinedText.includes('chromadon') || combinedText.includes('barrios') || combinedText.includes('a2i');
                function getMediaForPlatform(platform, userMedia) {
                    // Priority 1: User-provided media_urls
                    if (userMedia && userMedia.length > 0)
                        return userMedia;
                    // Priority 2: Client's brand assets (primary logo/video) — validate file exists
                    if (getClientMedia) {
                        const clientMedia = getClientMedia();
                        if (clientMedia) {
                            const p = platform.toLowerCase();
                            if ((p === 'tiktok' || p === 'youtube') && clientMedia.primaryVideo) {
                                if (fs.existsSync(clientMedia.primaryVideo))
                                    return [clientMedia.primaryVideo];
                                log.warn(`[Schedule] Client video not found: ${clientMedia.primaryVideo} — falling through`);
                            }
                            if (clientMedia.primaryLogo) {
                                if (fs.existsSync(clientMedia.primaryLogo))
                                    return [clientMedia.primaryLogo];
                                log.warn(`[Schedule] Client logo not found: ${clientMedia.primaryLogo} — falling through`);
                            }
                        }
                    }
                    // Priority 3: CHROMADON defaults (only for CHROMADON-related posts)
                    if (!isChromadonPost)
                        return [];
                    const p = platform.toLowerCase();
                    return (p === 'tiktok' || p === 'youtube') ? [CHROMADON_VIDEO] : [CHROMADON_IMAGE];
                }
                const platformList = (platforms || []).join(' and ');
                // If no content provided, build a generation instruction from topic
                if (!content && (topic || !content)) {
                    const topicStr = topic || 'the latest update';
                    let genInstruction = `Generate an engaging social media post about: ${topicStr}. Then post it to ${platformList}.`;
                    if (hashtags?.length)
                        genInstruction += ` Include hashtags: ${hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ')}`;
                    if (media_urls?.length)
                        genInstruction += ` Attach media: ${media_urls.join(', ')}`;
                    // Inject Trinity market intelligence if available
                    if (trinityIntel) {
                        try {
                            const trinityContext = await trinityIntel.getContentIntelligence((platforms[0] || 'linkedin'), topicStr);
                            if (trinityContext) {
                                genInstruction += `\n\nUse this market intelligence to make the content more relevant and competitive:\n${trinityContext}`;
                            }
                        }
                        catch (e) {
                            log.info({ err: e.message }, 'Trinity intelligence unavailable');
                        }
                    }
                    const scheduledTimeUtc = parseTime(scheduled_time);
                    const isImmediate = !scheduled_time || scheduled_time === 'null';
                    const batchId = platforms.length > 1
                        ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                        : undefined;
                    const results = [];
                    for (let i = 0; i < platforms.length; i++) {
                        const platform = platforms[i];
                        const platformMedia = getMediaForPlatform(platform, media_urls);
                        // Auto-include CHROMADON hashtags for CHROMADON-related posts
                        const autoHashtags = isChromadonPost && (!hashtags || hashtags.length === 0)
                            ? '#CHROMADON #BarriosA2I #AIAutomation #SocialMediaAI'
                            : '';
                        const hashtagStr = hashtags?.length
                            ? hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ')
                            : autoHashtags;
                        const mediaInstruction = platformMedia.length
                            ? ` MEDIA UPLOAD: Before typing any post content, you MUST upload media first. Click the platform's photo/media/image upload button, then call upload_file with filePath="${platformMedia[0]}". Then call wait with seconds=3 to let the upload preview render. Only AFTER the wait, type the post content.`
                            : '';
                        const platformGenInstruction = `Generate an engaging ${platform} post about: ${topicStr}. Then post it to ${platform}.${hashtagStr ? ' Include hashtags: ' + hashtagStr : ''}${isChromadonPost ? ' Include link: barriosa2i.com' : ''}${mediaInstruction}`;
                        const taskId = scheduler.addTask({
                            instruction: platformGenInstruction,
                            taskType: 'social_post',
                            scheduledTimeUtc,
                            recurrence: recurrence || 'none',
                            platforms: [platform],
                            mediaUrls: platformMedia.length > 0 ? platformMedia : undefined,
                            batchId,
                            batchSequence: i,
                        });
                        results.push({ platform, taskId });
                    }
                    const timeLabel = isImmediate ? 'now' : toEST(new Date(scheduledTimeUtc));
                    const hasMedia = isChromadonPost || (media_urls && media_urls.length > 0);
                    const mediaNote = hasMedia ? ' with CHROMADON media' : '';
                    const recLabel = recurrence && recurrence !== 'none' ? ` (${recurrence})` : '';
                    return `${isImmediate ? 'Queued' : 'Scheduled'} ${results.length} post(s) for ${timeLabel} on ${results.map(r => r.platform).join(', ')} about "${topicStr}"${mediaNote}${recLabel}. Content will be generated at execution time.`;
                }
                // Build NL instruction from structured fields (content IS provided)
                let instruction = `Post to ${platformList}: ${content}`;
                if (hashtags?.length)
                    instruction += ` ${hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ')}`;
                // Note: media upload instructions are added per-platform via mediaUploadNote below
                const scheduledTimeUtc = parseTime(scheduled_time);
                const isImmediate = !scheduled_time || scheduled_time === 'null';
                const batchId = platforms.length > 1
                    ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                    : undefined;
                // Create one task per platform for cross-posting
                const results = [];
                for (let i = 0; i < platforms.length; i++) {
                    const platform = platforms[i];
                    const platformMedia = getMediaForPlatform(platform, media_urls);
                    const mediaUploadNote = platformMedia.length
                        ? `. MEDIA UPLOAD: Before typing text, click the photo/media button, then call upload_file with filePath="${platformMedia[0]}". Wait for upload preview, then type content.`
                        : '';
                    const platformInstruction = platforms.length > 1
                        ? `Post to ${platform}: ${content}${hashtags?.length ? ' ' + hashtags.map((h) => h.startsWith('#') ? h : '#' + h).join(' ') : ''}${mediaUploadNote}`
                        : `${instruction}${mediaUploadNote}`;
                    const taskId = scheduler.addTask({
                        instruction: platformInstruction,
                        taskType: 'social_post',
                        scheduledTimeUtc,
                        recurrence: recurrence || 'none',
                        platforms: [platform],
                        content,
                        hashtags,
                        mediaUrls: platformMedia.length > 0 ? platformMedia : media_urls,
                        batchId,
                        batchSequence: i,
                    });
                    results.push({ platform, taskId });
                }
                const timeLabel = isImmediate ? 'now' : toEST(new Date(scheduledTimeUtc));
                const mediaNote = media_urls?.length ? ` with ${media_urls.length} media file(s)` : '';
                const recLabel = recurrence && recurrence !== 'none' ? ` (${recurrence})` : '';
                return `${isImmediate ? 'Queued' : 'Scheduled'} ${results.length} post(s) for ${timeLabel} on ${results.map(r => r.platform).join(', ')}${mediaNote}${recLabel}.`;
            }
            // ==================================================================
            // LIST TASKS
            // ==================================================================
            case 'get_scheduled_tasks': {
                const tasks = scheduler.getTasks({
                    status: input.status_filter,
                    taskType: input.task_type,
                });
                if (tasks.length === 0) {
                    return 'No scheduled tasks found.';
                }
                // Group by status
                const grouped = {};
                for (const t of tasks) {
                    if (!grouped[t.status])
                        grouped[t.status] = [];
                    grouped[t.status].push(t);
                }
                const lines = [`${tasks.length} task(s) total:`];
                for (const [status, group] of Object.entries(grouped)) {
                    lines.push(`\n${status.toUpperCase()} (${group.length}):`);
                    for (const t of group.slice(0, 10)) {
                        const timeLabel = toEST(new Date(t.scheduledTimeUtc));
                        const recLabel = t.recurrence !== 'none' ? ` [${t.recurrence}]` : '';
                        const typeLabel = t.taskType !== 'custom' ? ` (${t.taskType})` : '';
                        lines.push(`  - ${t.id}: "${t.instruction.slice(0, 60)}..." @ ${timeLabel}${recLabel}${typeLabel}`);
                    }
                    if (group.length > 10) {
                        lines.push(`  ... and ${group.length - 10} more`);
                    }
                }
                return lines.join('\n');
            }
            // ==================================================================
            // CANCEL
            // ==================================================================
            case 'cancel_scheduled_task': {
                const ok = scheduler.cancelTask(input.task_id);
                return ok
                    ? `Task ${input.task_id} cancelled.`
                    : `Could not cancel task ${input.task_id}. It may not exist or is currently executing.`;
            }
            // ==================================================================
            // CANCEL ALL
            // ==================================================================
            case 'cancel_all_scheduled_tasks': {
                const result = scheduler.cancelAllTasks(input.status_filter || 'scheduled');
                if (result.cancelled === 0 && result.failed.length === 0) {
                    return 'No scheduled tasks to cancel. Your schedule is already empty.';
                }
                let msg = `Cancelled ${result.cancelled} task(s).`;
                if (result.failed.length > 0) {
                    msg += ` ${result.failed.length} task(s) could not be cancelled because they are currently executing.`;
                }
                return msg;
            }
            // ==================================================================
            // TOGGLE (enable/disable)
            // ==================================================================
            case 'schedule_toggle': {
                const ok = scheduler.toggleTask(input.task_id, input.enabled);
                if (ok) {
                    return `Task ${input.task_id} ${input.enabled ? 'enabled' : 'disabled'}.`;
                }
                return `Could not toggle task ${input.task_id}. It may not exist.`;
            }
            // ==================================================================
            // RESCHEDULE
            // ==================================================================
            case 'reschedule_task': {
                const newTimeUtc = parseTime(input.new_time);
                const ok = scheduler.rescheduleTask(input.task_id, newTimeUtc);
                if (ok) {
                    const timeLabel = toEST(new Date(newTimeUtc));
                    return `Task ${input.task_id} rescheduled to ${timeLabel}.`;
                }
                return `Could not reschedule task ${input.task_id}. It may not exist or is not in "scheduled" status.`;
            }
            default:
                return `Unknown scheduler tool: ${toolName}`;
        }
    };
}
exports.createSchedulerExecutor = createSchedulerExecutor;
//# sourceMappingURL=scheduler-executor.js.map