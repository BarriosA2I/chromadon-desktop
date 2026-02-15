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
/**
 * Silent writer that captures orchestrator output without sending to user chat.
 * Same pattern as SocialMonitor's MonitorWriter.
 */
class CollectorWriter {
    chunks = [];
    closed = false;
    writeEvent(event, data) {
        if (event === 'text_delta' && data.text) {
            this.chunks.push(data.text);
        }
    }
    close() {
        this.closed = true;
    }
    isClosed() {
        return this.closed;
    }
    getText() {
        return this.chunks.join('');
    }
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
    constructor(orchestrator, contextFactory, desktopUrl, socialMonitor, config) {
        this.orchestrator = orchestrator;
        this.contextFactory = contextFactory;
        this.desktopUrl = desktopUrl;
        this.socialMonitor = socialMonitor;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.persistence = new scheduler_persistence_1.SchedulerPersistence();
        // Load persisted state or create fresh
        this.state = this.persistence.loadState() || (0, scheduler_types_1.createEmptyState)();
        console.log(`[TheScheduler] Initialized with ${this.state.tasks.length} persisted task(s)`);
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
        console.log(`[TheScheduler] Started (${this.config.tickIntervalMs / 1000}s tick interval)`);
    }
    stop() {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        console.log('[TheScheduler] Stopped');
    }
    destroy() {
        this.stop();
        this.destroyed = true;
        this.persist();
        console.log('[TheScheduler] Destroyed');
    }
    // ===========================================================================
    // ZERO-COST TICK LOOP
    // ===========================================================================
    /**
     * Called every 10s. Pure JS comparisons — ZERO LLM cost when idle.
     * Only starts spending credits when a task is actually due.
     */
    tick() {
        if (this.isExecuting || this.destroyed)
            return;
        const now = Date.now();
        const due = this.state.tasks.filter(t => (t.status === scheduler_types_1.TaskStatus.SCHEDULED || t.status === scheduler_types_1.TaskStatus.PENDING) &&
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
        console.log(`[TheScheduler] ${due.length} task(s) due — starting execution`);
        this.executeDueTasks(due).catch(err => console.error('[TheScheduler] Execution error:', err.message));
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
        console.log(`[TheScheduler] Executing task ${task.id}: ${task.instruction.slice(0, 80)}...`);
        try {
            // 1. Check Desktop health (HTTP only — zero LLM cost)
            const healthy = await this.checkDesktopHealth();
            if (!healthy) {
                this.failTask(task, 'Desktop not reachable');
                return;
            }
            // 2. Coordinate with SocialMonitor — wait if it's active
            await this.coordinateWithMonitor();
            // 3. Execute via orchestrator.chat() — THIS is where credits are spent
            const writer = new CollectorWriter();
            const { context, pageContext } = await this.contextFactory();
            await this.orchestrator.chat(undefined, // fresh session
            task.instruction, // the NL instruction the user gave
            writer, context, pageContext, { systemPromptOverride: undefined });
            // 4. Capture result
            task.resultSummary = writer.getText().slice(0, 500);
            task.status = scheduler_types_1.TaskStatus.COMPLETED;
            task.completedAt = new Date().toISOString();
            task.executionDurationMs = Date.now() - new Date(task.executedAt).getTime();
            this.state.stats.totalCompleted++;
            console.log(`[TheScheduler] Task ${task.id} completed in ${task.executionDurationMs}ms`);
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
        console.error(`[TheScheduler] Task ${task.id} failed (attempt ${task.retryCount}/${task.maxRetries}): ${error}`);
        if (task.retryCount >= task.maxRetries) {
            task.status = scheduler_types_1.TaskStatus.FAILED;
            task.completedAt = new Date().toISOString();
            this.state.stats.totalFailed++;
            console.error(`[TheScheduler] Task ${task.id} max retries exhausted — marking FAILED`);
        }
        else {
            // Reschedule retry 2 minutes from now
            task.status = scheduler_types_1.TaskStatus.SCHEDULED;
            task.scheduledTimeUtc = new Date(Date.now() + 2 * 60_000).toISOString();
            console.log(`[TheScheduler] Task ${task.id} retrying at ${task.scheduledTimeUtc}`);
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
            console.log(`[TheScheduler] Recurrence ended for task ${completedTask.id}`);
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
        console.log(`[TheScheduler] Generated next ${completedTask.recurrence} occurrence: ${newTask.id} at ${newTask.scheduledTimeUtc}`);
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
                console.warn('[TheScheduler] Monitor wait timeout — proceeding anyway');
                break;
            }
            console.log('[TheScheduler] Waiting for SocialMonitor to finish...');
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
            maxRetries: 2,
            createdAt: new Date().toISOString(),
            batchId: params.batchId,
            batchSequence: params.batchSequence,
        };
        this.state.tasks.push(task);
        this.state.stats.totalScheduled++;
        this.persist();
        console.log(`[TheScheduler] Task added: ${task.id} — "${task.instruction.slice(0, 60)}..." at ${task.scheduledTimeUtc}`);
        return task.id;
    }
    cancelTask(taskId) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return false;
        if (task.status === scheduler_types_1.TaskStatus.EXECUTING) {
            console.warn(`[TheScheduler] Cannot cancel executing task ${taskId}`);
            return false;
        }
        task.status = scheduler_types_1.TaskStatus.CANCELLED;
        this.persist();
        console.log(`[TheScheduler] Task cancelled: ${taskId}`);
        return true;
    }
    rescheduleTask(taskId, newTimeUtc) {
        const task = this.state.tasks.find(t => t.id === taskId);
        if (!task)
            return false;
        if (task.status !== scheduler_types_1.TaskStatus.SCHEDULED) {
            console.warn(`[TheScheduler] Cannot reschedule task in ${task.status} state`);
            return false;
        }
        task.scheduledTimeUtc = newTimeUtc;
        this.persist();
        console.log(`[TheScheduler] Task ${taskId} rescheduled to ${newTimeUtc}`);
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
    // PERSISTENCE
    // ===========================================================================
    persist() {
        this.persistence.saveState(this.state);
    }
}
exports.TheScheduler = TheScheduler;
//# sourceMappingURL=the-scheduler.js.map