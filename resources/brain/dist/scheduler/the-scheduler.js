"use strict";
/**
 * THE_SCHEDULER (Agent 0.2) — Tier 0 Orchestration
 *
 * Zero-cost when idle. The tick loop is pure Date.now() comparisons.
 * NO LLM calls, NO API calls, NO credits spent until a task is actually due.
 *
 * At execution time, feeds the stored NL instruction into orchestrator.chat()
 * with a CollectorWriter — the same pipeline the user's chat uses.
 * This means anything the AI can do interactively, it can do on schedule.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TheScheduler = void 0;
const scheduler_types_1 = require("./scheduler-types");
const scheduler_persistence_1 = require("./scheduler-persistence");
const llm_helper_1 = require("../client-context/llm-helper");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('scheduler');
/**
 * Silent writer that captures orchestrator output without sending to user chat.
 * Tracks text, errors, and tool results for post-execution validation.
 */
class CollectorWriter {
    chunks = [];
    closed = false;
    errors = [];
    toolResultCount = 0;
    lastToolSig = '';
    repeatCount = 0;
    stuckDetected = false;
    writeEvent(event, data) {
        if (event === 'text_delta' && data.text) {
            this.chunks.push(data.text);
        }
        else if (event === 'error' && data.message) {
            this.errors.push(data.message);
        }
        else if (event === 'tool_result') {
            this.toolResultCount++;
        }
        else if (event === 'tool_executing' && data.name) {
            // Stuck-loop detection: same tool+input 3+ times in a row
            const sig = `${data.name}:${JSON.stringify(data.input || {})}`;
            if (sig === this.lastToolSig) {
                this.repeatCount++;
                if (this.repeatCount >= 3) {
                    this.stuckDetected = true;
                    log.warn({ tool: data.name, repeats: this.repeatCount }, '[TheScheduler] STUCK: same tool call repeated 3+ times');
                }
            }
            else {
                this.lastToolSig = sig;
                this.repeatCount = 1;
            }
            log.info({ tool: data.name, input: JSON.stringify(data.input || {}).slice(0, 300) }, `[TheScheduler] Tool call: ${data.name}`);
        }
    }
    close() { this.closed = true; }
    isClosed() { return this.closed; }
    getText() { return this.chunks.join(''); }
    hasErrors() { return this.errors.length > 0; }
    getErrors() { return this.errors; }
    getToolResultCount() { return this.toolResultCount; }
}
const DEFAULT_CONFIG = {
    tickIntervalMs: 10_000,
    maxConcurrent: 1,
    desktopHealthTimeoutMs: 5_000,
    monitorCoordinationWaitMs: 2_000,
    maxMonitorWaitMs: 60_000,
};
class TheScheduler {
    orchestrator;
    contextFactory;
    desktopUrl;
    socialMonitor;
    persistence;
    config;
    state;
    tickInterval = null;
    isExecuting = false;
    destroyed = false;
    tickCount = 0;
    /** External busy-check callback — returns true if orchestrator is processing a user chat (Fix #1: Busy Lock) */
    isBusy;
    constructor(orchestrator, contextFactory, desktopUrl, socialMonitor, config, isBusy) {
        this.orchestrator = orchestrator;
        this.contextFactory = contextFactory;
        this.desktopUrl = desktopUrl;
        this.socialMonitor = socialMonitor;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.persistence = new scheduler_persistence_1.SchedulerPersistence();
        this.isBusy = isBusy;
        // Load persisted state or create fresh
        this.state = this.persistence.loadState() || (0, scheduler_types_1.createEmptyState)();
        // Missed-run detection: tasks >5min overdue with SCHEDULED status → mark PENDING for immediate execution
        const now = Date.now();
        const missedRuns = this.state.tasks.filter(t => t.status === scheduler_types_1.TaskStatus.SCHEDULED &&
            (t.enabled !== false) &&
            new Date(t.scheduledTimeUtc).getTime() < now - 5 * 60_000);
        if (missedRuns.length > 0) {
            log.info(`[TheScheduler] ${missedRuns.length} missed run(s) detected — marking PENDING for immediate execution`);
            for (const t of missedRuns)
                t.status = scheduler_types_1.TaskStatus.PENDING;
            this.persist();
        }
        // Zombie recovery: tasks stuck in 'executing' after crash/restart → reset to 'pending' for retry
        const zombies = this.state.tasks.filter(t => t.status === scheduler_types_1.TaskStatus.EXECUTING);
        if (zombies.length > 0) {
            log.warn(`[TheScheduler] ${zombies.length} zombie task(s) stuck in EXECUTING — resetting to PENDING`);
            for (const t of zombies) {
                t.status = scheduler_types_1.TaskStatus.PENDING;
                t.executedAt = undefined;
            }
            this.persist();
        }
        // Task pruning: keep active + last 50 terminal tasks, remove the rest
        const PRUNE_KEEP = 50;
        const activeTasks = this.state.tasks.filter(t => t.status === scheduler_types_1.TaskStatus.SCHEDULED ||
            t.status === scheduler_types_1.TaskStatus.PENDING ||
            t.status === scheduler_types_1.TaskStatus.EXECUTING);
        const terminalTasks = this.state.tasks
            .filter(t => t.status === scheduler_types_1.TaskStatus.COMPLETED ||
            t.status === scheduler_types_1.TaskStatus.FAILED ||
            t.status === scheduler_types_1.TaskStatus.CANCELLED)
            .sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt));
        const keepTerminal = terminalTasks.slice(0, PRUNE_KEEP);
        const pruned = this.state.tasks.length - activeTasks.length - keepTerminal.length;
        if (pruned > 0) {
            this.state.tasks = [...activeTasks, ...keepTerminal];
            log.info(`[TheScheduler] Pruned ${pruned} old terminal task(s) — ${this.state.tasks.length} remaining`);
            this.persist();
        }
        log.info(`[TheScheduler] Initialized with ${this.state.tasks.length} persisted task(s)`);
    }
    // ===========================================================================
    // LIFECYCLE
    // ===========================================================================
    start() {
        if (this.tickInterval)
            return;
        this.tickInterval = setInterval(() => {
            this.tick();
        }, this.config.tickIntervalMs);
        log.info(`[TheScheduler] Started (${this.config.tickIntervalMs / 1000}s tick interval)`);
    }
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        log.info('[TheScheduler] Stopped');
    }
    destroy() {
        this.stop();
        this.destroyed = true;
        this.persist();
        log.info('[TheScheduler] Destroyed');
    }
    // ===========================================================================
    // ZERO-COST TICK LOOP
    // ===========================================================================
    /**
     * Called every 10s. Pure JS comparisons — ZERO LLM cost when idle.
     * Only starts spending credits when a task is actually due.
     */
    tick() {
        this.tickCount++;
        // Heartbeat log every 60s when tasks are pending or executing (zero noise when idle)
        if (this.tickCount % 6 === 0) {
            const scheduled = this.state.tasks.filter(t => t.status === scheduler_types_1.TaskStatus.SCHEDULED || t.status === scheduler_types_1.TaskStatus.PENDING).length;
            if (scheduled > 0 || this.isExecuting) {
                log.info(`[TheScheduler] heartbeat — ${scheduled} pending, executing=${this.isExecuting}, busy=${!!this.isBusy?.()}`);
            }
        }
        if (this.isExecuting || this.destroyed)
            return;
        // Fix #1: Busy Lock — defer if user is chatting (browser collision prevention)
        if (this.isBusy?.())
            return;
        const now = Date.now();
        const due = this.state.tasks.filter(t => (t.status === scheduler_types_1.TaskStatus.SCHEDULED || t.status === scheduler_types_1.TaskStatus.PENDING) &&
            (t.enabled !== false) &&
            new Date(t.scheduledTimeUtc).getTime() <= now);
        if (due.length === 0)
            return; // ZERO COST — nothing to do
        // Mark all due tasks as PENDING and start execution
        for (const task of due) {
            if (task.status === scheduler_types_1.TaskStatus.SCHEDULED) {
                task.status = scheduler_types_1.TaskStatus.PENDING;
            }
        }
        this.persist();
        log.info(`[TheScheduler] ${due.length} task(s) due — starting execution`);
        this.executeDueTasks(due).catch(err => log.error('[TheScheduler] Execution error:', err.message));
    }
    // ===========================================================================
    // TASK EXECUTION — THE ONLY PART THAT COSTS CREDITS
    // ===========================================================================
    async executeDueTasks(tasks) {
        this.isExecuting = true;
        try {
            for (const task of tasks) {
                if (this.destroyed)
                    break;
                await this.executeTask(task);
            }
        }
        finally {
            this.isExecuting = false;
        }
    }
    async executeTask(task) {
        task.status = scheduler_types_1.TaskStatus.EXECUTING;
        task.executedAt = new Date().toISOString();
        this.persist();
        log.info(`[TheScheduler] Executing task ${task.id}: ${task.instruction.slice(0, 80)}...`);
        try {
            // 1. Check Desktop health (HTTP only — zero LLM cost)
            const healthy = await this.checkDesktopHealth();
            if (!healthy) {
                this.failTask(task, 'Desktop not reachable');
                return;
            }
            // 2. Coordinate with SocialMonitor — wait if it's active
            await this.coordinateWithMonitor();
            // 3. Ensure social posts have explicit step-by-step browser instructions
            // Handles BOTH paths: content pre-provided (use directly) or topic-only (generate via LLM)
            if (task.taskType === 'social_post' && !task.instruction.includes('Steps:\n')) {
                let postContent = null;
                // Path 2: content was pre-provided by schedule_post — use directly (zero LLM cost)
                if (task.content && task.content.length > 10) {
                    postContent = task.content;
                }
                // Path 1: generate content from topic via Gemini
                else {
                    try {
                        postContent = await this.preGenerateContent(task);
                    }
                    catch (err) {
                        log.warn({ err: err.message }, '[TheScheduler] Content pre-generation failed');
                    }
                }
                if (postContent && postContent.length > 10) {
                    log.info(`[TheScheduler] Built browser instruction with ${postContent.length} chars of content`);
                    task.instruction = this.buildPostingInstruction(task, postContent);
                    log.debug({ instruction: task.instruction.slice(0, 500) }, '[TheScheduler] Final instruction');
                }
                else {
                    log.warn(`[TheScheduler] Task ${task.id} — no content available, proceeding with original instruction`);
                }
            }
            // 4. Execute via orchestrator.chat() — with 5min timeout to prevent hanging
            const writer = new CollectorWriter();
            const { context, pageContext } = await this.contextFactory();
            const EXECUTION_TIMEOUT_MS = 5 * 60_000; // 5 minutes
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timeout (5 min)')), EXECUTION_TIMEOUT_MS));
            await Promise.race([
                this.orchestrator.chat(undefined, // fresh session
                task.instruction, // the NL instruction (now with pre-generated content)
                writer, context, pageContext, { systemPromptOverride: undefined }),
                timeoutPromise,
            ]);
            // 4. Validate result — detect orchestrator failures before marking complete
            const collectedText = writer.getText();
            if (writer.hasErrors()) {
                const errorSummary = writer.getErrors().join('; ');
                log.warn(`[TheScheduler] Task ${task.id} — orchestrator error: ${errorSummary}`);
                this.failTask(task, `Orchestrator error: ${errorSummary}`);
                return;
            }
            if (collectedText.trim().length === 0 && writer.getToolResultCount() === 0) {
                log.warn(`[TheScheduler] Task ${task.id} — empty result (0 text, 0 tools)`);
                this.failTask(task, 'Empty orchestrator response — no text or tool results');
                return;
            }
            // Success — capture result
            task.resultSummary = collectedText.slice(0, 500);
            task.status = scheduler_types_1.TaskStatus.COMPLETED;
            task.completedAt = new Date().toISOString();
            task.executionDurationMs = Date.now() - new Date(task.executedAt).getTime();
            task.consecutiveFailures = 0; // Reset on success
            this.state.stats.totalCompleted++;
            log.info(`[TheScheduler] Task ${task.id} completed in ${task.executionDurationMs}ms`);
            // 5. Handle recurrence
            if (task.recurrence !== 'none') {
                this.generateNextOccurrence(task);
            }
        }
        catch (err) {
            this.failTask(task, err.message);
        }
        this.persist();
    }
    failTask(task, error) {
        task.retryCount++;
        task.lastError = error;
        task.consecutiveFailures = (task.consecutiveFailures || 0) + 1;
        log.error(`[TheScheduler] Task ${task.id} failed (attempt ${task.retryCount}/${task.maxRetries}, consecutive: ${task.consecutiveFailures}): ${error}`);
        if (task.retryCount >= task.maxRetries) {
            task.status = scheduler_types_1.TaskStatus.FAILED;
            task.completedAt = new Date().toISOString();
            this.state.stats.totalFailed++;
            log.error(`[TheScheduler] Task ${task.id} max retries exhausted — marking FAILED`);
            // Auto-disable after 3 consecutive failures on recurring tasks
            if (task.consecutiveFailures >= 3 && task.recurrence !== 'none') {
                task.enabled = false;
                log.error(`[TheScheduler] Task ${task.id} auto-disabled after ${task.consecutiveFailures} consecutive failures`);
            }
        }
        else {
            // Reschedule retry 2 minutes from now
            task.status = scheduler_types_1.TaskStatus.SCHEDULED;
            task.scheduledTimeUtc = new Date(Date.now() + 2 * 60_000).toISOString();
            log.info(`[TheScheduler] Task ${task.id} retrying at ${task.scheduledTimeUtc}`);
        }
        this.persist();
    }
    // ===========================================================================
    // RECURRENCE
    // ===========================================================================
    generateNextOccurrence(completedTask) {
        const next = new Date(completedTask.scheduledTimeUtc);
        switch (completedTask.recurrence) {
            case 'daily':
                next.setUTCDate(next.getUTCDate() + 1);
                break;
            case 'weekly':
                next.setUTCDate(next.getUTCDate() + 7);
                break;
            case 'biweekly':
                next.setUTCDate(next.getUTCDate() + 14);
                break;
            case 'monthly':
                next.setUTCMonth(next.getUTCMonth() + 1);
                break;
            default: return;
        }
        // Check recurrence end date
        if (completedTask.recurrenceEndDate && next.toISOString() > completedTask.recurrenceEndDate) {
            log.info(`[TheScheduler] Recurrence ended for task ${completedTask.id}`);
            return;
        }
        const newTask = {
            id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            instruction: completedTask.instruction,
            taskType: completedTask.taskType,
            platform: completedTask.platform,
            platforms: completedTask.platforms,
            content: completedTask.content,
            hashtags: completedTask.hashtags,
            mediaUrls: completedTask.mediaUrls,
            scheduledTimeUtc: next.toISOString(),
            recurrence: completedTask.recurrence,
            recurrenceEndDate: completedTask.recurrenceEndDate,
            parentTaskId: completedTask.parentTaskId || completedTask.id,
            status: scheduler_types_1.TaskStatus.SCHEDULED,
            retryCount: 0,
            maxRetries: completedTask.maxRetries,
            createdAt: new Date().toISOString(),
            batchId: completedTask.batchId,
            batchSequence: completedTask.batchSequence,
        };
        this.state.tasks.push(newTask);
        this.state.stats.totalScheduled++;
        log.info(`[TheScheduler] Generated next ${completedTask.recurrence} occurrence: ${newTask.id} at ${newTask.scheduledTimeUtc}`);
    }
    // ===========================================================================
    // COORDINATION
    // ===========================================================================
    async checkDesktopHealth() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.config.desktopHealthTimeoutMs);
            const resp = await fetch(`${this.desktopUrl}/health`, { signal: controller.signal });
            clearTimeout(timeout);
            return resp.ok;
        }
        catch {
            return false;
        }
    }
    async coordinateWithMonitor() {
        if (!this.socialMonitor)
            return;
        const startWait = Date.now();
        while (this.socialMonitor.getStatus().running) {
            if (Date.now() - startWait > this.config.maxMonitorWaitMs) {
                log.warn('[TheScheduler] Monitor wait timeout — proceeding anyway');
                break;
            }
            log.info('[TheScheduler] Waiting for SocialMonitor to finish...');
            await new Promise(r => setTimeout(r, this.config.monitorCoordinationWaitMs));
        }
    }
    // ===========================================================================
    // PUBLIC API — Called by scheduler-executor.ts
    // ===========================================================================
    addTask(params) {
        const task = {
            id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            instruction: params.instruction,
            taskType: params.taskType || 'custom',
            platforms: params.platforms,
            content: params.content,
            hashtags: params.hashtags,
            mediaUrls: params.mediaUrls,
            scheduledTimeUtc: params.scheduledTimeUtc,
            recurrence: params.recurrence || 'none',
            recurrenceEndDate: params.recurrenceEndDate,
            status: scheduler_types_1.TaskStatus.SCHEDULED,
            retryCount: 0,
            maxRetries: 3,
            createdAt: new Date().toISOString(),
            batchId: params.batchId,
            batchSequence: params.batchSequence,
        };
        this.state.tasks.push(task);
        this.state.stats.totalScheduled++;
        this.persist();
        log.info(`[TheScheduler] Task added: ${task.id} — "${task.instruction.slice(0, 60)}..." at ${task.scheduledTimeUtc}`);
        return task.id;
    }
    cancelTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return false;
        if (task.status === scheduler_types_1.TaskStatus.EXECUTING) {
            log.warn(`[TheScheduler] Cannot cancel executing task ${taskId}`);
            return false;
        }
        task.status = scheduler_types_1.TaskStatus.CANCELLED;
        this.persist();
        log.info(`[TheScheduler] Task cancelled: ${taskId}`);
        return true;
    }
    cancelAllTasks(statusFilter) {
        const targets = this.state.tasks.filter(t => {
            if (t.status === scheduler_types_1.TaskStatus.CANCELLED || t.status === scheduler_types_1.TaskStatus.COMPLETED || t.status === scheduler_types_1.TaskStatus.FAILED)
                return false;
            if (statusFilter && statusFilter !== 'all' && t.status !== statusFilter)
                return false;
            return true;
        });
        let cancelled = 0;
        const failed = [];
        for (const task of targets) {
            if (task.status === scheduler_types_1.TaskStatus.EXECUTING) {
                failed.push(task.id);
                continue;
            }
            task.status = scheduler_types_1.TaskStatus.CANCELLED;
            cancelled++;
        }
        if (cancelled > 0)
            this.persist();
        log.info(`[TheScheduler] Bulk cancel: ${cancelled} cancelled, ${failed.length} failed (executing)`);
        return { cancelled, failed };
    }
    toggleTask(taskId, enabled) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return false;
        task.enabled = enabled;
        if (enabled) {
            // Reset consecutive failures when re-enabled
            task.consecutiveFailures = 0;
        }
        this.persist();
        log.info(`[TheScheduler] Task ${taskId} ${enabled ? 'enabled' : 'disabled'}`);
        return true;
    }
    rescheduleTask(taskId, newTimeUtc) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return false;
        if (task.status !== scheduler_types_1.TaskStatus.SCHEDULED) {
            log.warn(`[TheScheduler] Cannot reschedule task in ${task.status} state`);
            return false;
        }
        task.scheduledTimeUtc = newTimeUtc;
        this.persist();
        log.info(`[TheScheduler] Task ${taskId} rescheduled to ${newTimeUtc}`);
        return true;
    }
    getTasks(filter) {
        let tasks = this.state.tasks;
        if (filter?.status && filter.status !== 'all') {
            tasks = tasks.filter(t => t.status === filter.status);
        }
        if (filter?.taskType && filter.taskType !== 'all') {
            tasks = tasks.filter(t => t.taskType === filter.taskType);
        }
        // Return most recent first
        return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    getStatus() {
        const scheduled = this.state.tasks.filter(t => t.status === scheduler_types_1.TaskStatus.SCHEDULED);
        const nextTask = scheduled.sort((a, b) => a.scheduledTimeUtc.localeCompare(b.scheduledTimeUtc))[0];
        return {
            running: this.tickInterval !== null,
            taskCount: this.state.tasks.length,
            pendingCount: scheduled.length,
            nextTaskAt: nextTask?.scheduledTimeUtc || null,
            nextTaskDescription: nextTask ? nextTask.instruction.slice(0, 80) : null,
            stats: { ...this.state.stats },
        };
    }
    // ===========================================================================
    // CONTENT PRE-GENERATION (Scriptwriter Phase)
    // ===========================================================================
    /**
     * Pre-generate post content via direct LLM call.
     * This runs BEFORE browser actions so the AI doesn't need to "think" about
     * content while also doing click/type/upload actions.
     */
    async preGenerateContent(task) {
        // Extract topic from instruction: "Generate an engaging {platform} post about: {topic}. Then post..."
        const topicMatch = task.instruction.match(/post about:\s*(.+?)\.\s*Then post/i);
        const topic = topicMatch ? topicMatch[1].trim() : 'the latest update';
        const platform = task.platforms?.[0] || 'social media';
        const systemPrompt = `You are a professional social media content writer for CHROMADON by Barrios A2I (barriosa2i.com).
Write engaging, authentic social media posts. NO em dashes. NO corporate jargon. 1-3 emojis max.
Platform limits: Twitter 280 chars, LinkedIn 3000, Facebook 500, Instagram 2200.
NEVER use: "revolutionize", "game-changer", "boost productivity", "leverage", "synergy".
When writing about CHROMADON: be specific — "Your AI social media manager that never sleeps", "Post to all your socials with one sentence."
Always include relevant hashtags at the end.`;
        const userPrompt = `Write a ${platform} post about: ${topic}.
${task.hashtags?.length ? `Include these hashtags: ${task.hashtags.join(' ')}` : 'Add 3-5 relevant hashtags.'}
Include the link barriosa2i.com if relevant.
Reply with ONLY the post text. No explanations, no quotes, no formatting.`;
        const content = await (0, llm_helper_1.callLLM)(systemPrompt, userPrompt, 500);
        if (!content || content.length < 10)
            return null;
        return content.trim();
    }
    /**
     * Build a browser-only instruction with pre-generated content.
     * The AI just needs to navigate, upload media, type the text, and post.
     */
    buildPostingInstruction(task, content) {
        const platform = task.platforms?.[0] || 'LinkedIn';
        const mediaPath = task.mediaUrls?.[0];
        // Escape content for embedding inline in tool call instruction
        const safeContent = content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        let instruction = `Steps:\n`;
        instruction += `1. Call list_tabs to check for existing ${platform} tab. Switch to it if found, otherwise call navigate to go to ${platform}.\n`;
        instruction += `2. Click the compose/create post button.\n`;
        if (mediaPath) {
            // Type text FIRST into clean composer, THEN upload image.
            // Uploading first changes the DOM and causes text to go into a separate box.
            // upload_file finds input[type="file"] via CDP and sets files programmatically — no clicking needed.
            instruction += `3. Call type_text with selector="div[contenteditable='true'][role='textbox']" and text="${safeContent}".\n`;
            instruction += `4. Call wait with seconds=2 to let the text render.\n`;
            instruction += `5. Call upload_file with filePath="${mediaPath}" to attach the image. Do NOT click any upload button — upload_file handles it programmatically.\n`;
            instruction += `6. Call wait with seconds=3 to let the upload preview render.\n`;
            instruction += `7. Click the Post/Share button to publish.\n`;
        }
        else {
            instruction += `3. Call type_text with selector="div[contenteditable='true'][role='textbox']" and text="${safeContent}".\n`;
            instruction += `4. Call wait with seconds=2 to let the text render.\n`;
            instruction += `5. Click the Post/Share button to publish.\n`;
        }
        instruction += `\nCRITICAL: Step 3 MUST call the type_text tool. Do NOT skip it. The post content MUST appear in the text box before uploading media.\nDo NOT click any photo/media/upload button or input[type="file"]. The upload_file tool handles file attachment programmatically.`;
        return instruction;
    }
    // ===========================================================================
    // PERSISTENCE
    // ===========================================================================
    persist() {
        this.persistence.saveState(this.state);
    }
}
exports.TheScheduler = TheScheduler;
//# sourceMappingURL=the-scheduler.js.map