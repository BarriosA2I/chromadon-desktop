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
const PLATFORM_POST_CONFIGS = {
    facebook: {
        url: 'https://www.facebook.com',
        domainMatch: ['facebook.com'],
        composeText: "What's on your mind",
        composerContainer: 'div[role="dialog"]',
        textboxSelector: "div[contenteditable='true'][role='textbox']",
        postText: 'Post',
        postFallbackSelector: 'div[aria-label="Post"]',
        mediaButtonText: 'Photo/video',
        mediaButtonSelector: '[aria-label*="Photo" i]',
        nextButtonText: 'Next',
    },
    linkedin: {
        url: 'https://www.linkedin.com',
        domainMatch: ['linkedin.com'],
        composeText: 'Start a post',
        composeFallbackSelector: 'button.share-box-feed-entry__trigger',
        composerContainer: 'div[role="dialog"]',
        textboxSelector: "div[contenteditable='true'][role='textbox']",
        postText: 'Post',
        postFallbackSelector: 'button.share-actions__primary-action',
        mediaButtonText: 'Add a photo',
        mediaButtonSelector: 'button[aria-label="Add media"]',
    },
    twitter: {
        url: 'https://x.com',
        domainMatch: ['twitter.com', 'x.com'],
        composeText: "What is happening",
        composeFallbackSelector: '[data-testid="tweetTextarea_0"]',
        composerContainer: 'div[data-testid="tweetTextarea_0"]',
        textboxSelector: "div[contenteditable='true'][role='textbox']",
        postText: 'Post',
        postFallbackSelector: '[data-testid="tweetButton"]',
        mediaButtonSelector: 'input[data-testid="fileInput"]',
    },
};
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
            // 3. Resolve content for social_post tasks
            let resolvedContent = null;
            if (task.taskType === 'social_post') {
                // Path 2: content was pre-provided by schedule_post — use directly (zero LLM cost)
                if (task.content && task.content.length > 10) {
                    resolvedContent = task.content;
                }
                // Path 1: generate content from topic via Gemini
                else {
                    try {
                        resolvedContent = await this.preGenerateContent(task);
                    }
                    catch (err) {
                        log.warn({ err: err.message }, '[TheScheduler] Content pre-generation failed');
                    }
                }
            }
            // 4. DIRECT POST — try zero-LLM execution via Desktop HTTP endpoints
            if (task.taskType === 'social_post' && resolvedContent && resolvedContent.length > 10) {
                const directSuccess = await this.executeDirectPost(task, resolvedContent);
                if (directSuccess) {
                    // Direct post succeeded — mark completed and return
                    task.resultSummary = `[DIRECT POST] ${resolvedContent.slice(0, 200)}`;
                    task.status = scheduler_types_1.TaskStatus.COMPLETED;
                    task.completedAt = new Date().toISOString();
                    task.executionDurationMs = Date.now() - new Date(task.executedAt).getTime();
                    task.consecutiveFailures = 0;
                    this.state.stats.totalCompleted++;
                    log.info(`[TheScheduler] Task ${task.id} completed via DIRECT POST in ${task.executionDurationMs}ms`);
                    if (task.recurrence !== 'none') {
                        this.generateNextOccurrence(task);
                    }
                    this.persist();
                    return;
                }
                // Direct post failed — fall through to LLM path
                log.warn(`[TheScheduler] Direct post failed for task ${task.id} — falling back to LLM`);
            }
            // 5. LLM FALLBACK — Build instruction and execute via orchestrator.chat()
            if (task.taskType === 'social_post' && resolvedContent && resolvedContent.length > 10 && !task.instruction.includes('Steps:\n')) {
                log.info(`[TheScheduler] Built browser instruction with ${resolvedContent.length} chars of content`);
                task.instruction = this.buildPostingInstruction(task, resolvedContent);
                log.debug({ instruction: task.instruction.slice(0, 500) }, '[TheScheduler] Final instruction');
            }
            else if (task.taskType === 'social_post' && !resolvedContent) {
                log.warn(`[TheScheduler] Task ${task.id} — no content available, proceeding with original instruction`);
            }
            // 6. Execute via orchestrator.chat() — with 5min timeout to prevent hanging
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
            // 7. Validate result — detect orchestrator failures before marking complete
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
            // 8. Handle recurrence
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
    // DIRECT POST — Zero-LLM browser automation via Desktop HTTP endpoints
    // All click/type calls scoped to composerContainer to avoid feed noise
    // ===========================================================================
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
    async fetchDesktop(path, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        try {
            const resp = await fetch(`${this.desktopUrl}${path}`, {
                method: body ? 'POST' : 'GET',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            return await resp.json();
        }
        catch (err) {
            clearTimeout(timeout);
            throw err;
        }
    }
    /**
     * Click by text with optional CSS fallback, scoped to container.
     * Retries once on failure (2s delay between attempts).
     */
    async directClick(tabId, text, fallbackSelector, container) {
        // Attempt 1: text-based click (scoped to container)
        try {
            const res = await this.fetchDesktop('/tabs/click', { id: tabId, text, container });
            if (res.success) {
                log.debug({ candidates: res.candidates, strategy: res.strategy }, `[DirectPost] Click "${text}" OK`);
                return true;
            }
        }
        catch { /* fall through */ }
        // If text click failed and we have a CSS fallback, try that
        if (fallbackSelector) {
            await this.delay(1000);
            try {
                const res = await this.fetchDesktop('/tabs/click', { id: tabId, selector: fallbackSelector, container });
                if (res.success)
                    return true;
            }
            catch { /* fall through */ }
        }
        // Retry text click once after 2s
        await this.delay(2000);
        try {
            const res = await this.fetchDesktop('/tabs/click', { id: tabId, text, container });
            return res.success === true;
        }
        catch {
            return false;
        }
    }
    /**
     * Type text into element, scoped to container.
     */
    async directType(tabId, selector, text, container) {
        try {
            const res = await this.fetchDesktop('/tabs/type', { id: tabId, selector, text, container });
            return res.success === true;
        }
        catch {
            return false;
        }
    }
    /**
     * Smart media button finder — searches ALL attributes (aria-label, title, data-tooltip,
     * textContent) of ALL interactive elements in the dialog for photo/video keywords.
     * Works with icon-only buttons that have no visible text.
     */
    async smartClickMediaButton(tabId, container) {
        try {
            const res = await this.fetchDesktop('/tabs/execute', {
                id: tabId,
                script: `(function() {
          var dialog = document.querySelector(${JSON.stringify(container)});
          if (!dialog) return 'no_dialog';
          var btns = dialog.querySelectorAll('[role="button"], button, [tabindex="0"], [tabindex="-1"]');
          for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var label = (b.getAttribute('aria-label') || '').toLowerCase();
            var title = (b.getAttribute('title') || '').toLowerCase();
            var text = (b.textContent || '').toLowerCase().substring(0, 100);
            var tooltip = (b.getAttribute('data-tooltip') || '').toLowerCase();
            var combined = label + '|' + title + '|' + text + '|' + tooltip;
            if (/photo|video/.test(combined) && !/profile|cover|avatar/.test(combined)) {
              b.scrollIntoView({block: 'center'});
              b.click();
              return 'clicked:' + (label || title || text).substring(0, 50);
            }
          }
          return 'not_found';
        })()`,
            });
            if (res.result && typeof res.result === 'string' && res.result.startsWith('clicked:')) {
                log.info(`[DirectPost] Smart JS media button: ${res.result}`);
                return true;
            }
            log.info(`[DirectPost] Smart JS media button: ${res.result || 'no result'}`);
            return false;
        }
        catch (err) {
            log.warn({ err: err.message }, '[DirectPost] Smart JS media button error');
            return false;
        }
    }
    /**
     * Upload file. Tries 4 strategies to click the media button, then calls /tabs/upload.
     * Strategy 0: Smart JS — multi-attribute regex search (aria-label, title, tooltip, text)
     * Strategy 1: Text-based click scoped to container (handles visible-text buttons)
     * Strategy 2: CSS selector click scoped to container (handles specific CSS selectors)
     * Strategy 3: Text-based click WITHOUT container scoping (last resort)
     */
    async directUpload(tabId, filePath, mediaButtonText, mediaButtonSelector, container) {
        let mediaButtonClicked = false;
        // Strategy 0: Smart JS — searches aria-label, title, data-tooltip, textContent with regex
        if (container && !mediaButtonClicked) {
            mediaButtonClicked = await this.smartClickMediaButton(tabId, container);
        }
        // Strategy 1: Text-based click (scoped to container)
        if (mediaButtonText && !mediaButtonClicked) {
            try {
                const clickRes = await this.fetchDesktop('/tabs/click', { id: tabId, container, text: mediaButtonText });
                mediaButtonClicked = clickRes.success === true;
                if (mediaButtonClicked)
                    log.info('[DirectPost] Media button click OK (text)');
            }
            catch { /* continue to next strategy */ }
        }
        // Strategy 2: CSS selector click (scoped to container) — handles aria-label buttons
        if (mediaButtonSelector && !mediaButtonClicked) {
            try {
                const clickRes = await this.fetchDesktop('/tabs/click', { id: tabId, container, selector: mediaButtonSelector });
                mediaButtonClicked = clickRes.success === true;
                if (mediaButtonClicked)
                    log.info('[DirectPost] Media button click OK (css selector)');
            }
            catch { /* continue to next strategy */ }
        }
        // Strategy 3: Text-based click WITHOUT container (in case button is outside dialog scope)
        if (mediaButtonText && !mediaButtonClicked) {
            try {
                const clickRes = await this.fetchDesktop('/tabs/click', { id: tabId, text: mediaButtonText });
                mediaButtonClicked = clickRes.success === true;
                if (mediaButtonClicked)
                    log.info('[DirectPost] Media button click OK (unscoped text)');
            }
            catch { /* all strategies exhausted */ }
        }
        if (mediaButtonClicked) {
            await this.delay(1500); // Wait for file input to appear in DOM
        }
        else if (mediaButtonText || mediaButtonSelector || container) {
            log.warn('[DirectPost] All media button click strategies failed (smartJS, text, css, unscoped)');
        }
        // Upload file via Desktop CDP
        try {
            const res = await this.fetchDesktop('/tabs/upload', { id: tabId, filePath });
            if (res.success !== true) {
                log.warn({ error: res.error, filePath }, '[DirectPost] Upload API returned failure');
            }
            return res.success === true;
        }
        catch (err) {
            log.warn({ err: err.message, filePath }, '[DirectPost] Upload API call failed');
            return false;
        }
    }
    /**
     * Poll for an element to appear in the DOM. Replaces fixed delays.
     * Returns true if found within maxWaitMs, false otherwise.
     */
    async waitForElement(tabId, selector, maxWaitMs = 5000) {
        const pollInterval = 500;
        const maxAttempts = Math.ceil(maxWaitMs / pollInterval);
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const res = await this.fetchDesktop('/tabs/execute', {
                    id: tabId,
                    script: `!!document.querySelector(${JSON.stringify(selector)})`,
                });
                if (res.result === true) {
                    log.debug(`[DirectPost] waitForElement("${selector}") found after ${(i + 1) * pollInterval}ms`);
                    return true;
                }
            }
            catch { /* ignore */ }
            await this.delay(pollInterval);
        }
        log.warn(`[DirectPost] waitForElement("${selector}") timed out after ${maxWaitMs}ms`);
        return false;
    }
    async findOrCreatePlatformTab(config) {
        try {
            // Check existing tabs for a match
            const tabsRes = await this.fetchDesktop('/tabs');
            if (tabsRes.tabs && Array.isArray(tabsRes.tabs)) {
                for (const tab of tabsRes.tabs) {
                    const tabUrl = (tab.url || '').toLowerCase();
                    for (const domain of config.domainMatch) {
                        if (tabUrl.includes(domain)) {
                            log.info(`[DirectPost] Found existing tab ${tab.id} for ${domain}`);
                            await this.fetchDesktop('/tabs/focus', { id: tab.id });
                            await this.fetchDesktop('/tabs/navigate', { id: tab.id, url: config.url });
                            return tab.id;
                        }
                    }
                }
            }
            // No existing tab — create with authenticated session partition
            const platformName = config.domainMatch[0].replace('.com', '');
            const createRes = await this.fetchDesktop('/tabs/platform', {
                url: config.url,
                platform: platformName,
            });
            if (createRes.id) {
                log.info(`[DirectPost] Created platform tab ${createRes.id} for ${platformName}`);
                return createRes.id;
            }
            return null;
        }
        catch (err) {
            log.error({ err: err.message }, '[DirectPost] Tab creation failed');
            return null;
        }
    }
    /**
     * Execute a social post by calling Desktop HTTP endpoints directly.
     * Zero LLM involvement — pure HTTP calls to Desktop control server.
     * All actions after compose click are scoped to the composer container.
     *
     * Returns true if the post was successfully executed, false otherwise.
     */
    async executeDirectPost(task, content) {
        const platform = (task.platforms?.[0] || '').toLowerCase();
        const config = PLATFORM_POST_CONFIGS[platform];
        if (!config) {
            log.warn(`[DirectPost] No config for platform "${platform}" — skipping direct path`);
            return false;
        }
        const startMs = Date.now();
        const ctr = config.composerContainer; // Container for scoped operations
        log.info(`[TheScheduler] Attempting DIRECT POST for task ${task.id} (${platform}, container=${ctr})`);
        let tabId = null;
        let composeClicked = false; // Track whether we opened a dialog (for cleanup on failure)
        try {
            // Step 1: Find or create platform tab
            tabId = await this.findOrCreatePlatformTab(config);
            if (tabId === null) {
                log.warn('[DirectPost] Could not get platform tab');
                return false;
            }
            log.info(`[DirectPost] Using tab ${tabId} for ${platform}`);
            // Step 2: Wait for page load (poll for body to be ready)
            await this.delay(3000);
            // Step 3: Click compose button (NOT scoped — compose button is in the feed)
            const composeOk = await this.directClick(tabId, config.composeText, config.composeFallbackSelector);
            if (!composeOk) {
                log.warn('[DirectPost] Compose click FAILED');
                return false;
            }
            composeClicked = true;
            log.info('[DirectPost] Compose click OK');
            // Step 4: Poll for composer container to appear (replaces fixed 1.5s delay)
            const containerFound = await this.waitForElement(tabId, ctr, 6000);
            if (!containerFound) {
                log.warn(`[DirectPost] Composer container "${ctr}" never appeared`);
                // Fall through to cleanup — dialog may be partially open
                throw new Error('composer_container_not_found');
            }
            log.info(`[DirectPost] Composer container found: ${ctr}`);
            // Step 4.5: Wait for dialog content to render (animation + React hydration)
            await this.delay(1000);
            // Step 5: Upload media FIRST (if present) — must be before text for Facebook
            // Uploading first ensures image + text stay in the same dialog.
            // Container scoping (v1.15.24+) prevents DOM changes from breaking textbox targeting.
            const mediaPath = task.mediaUrls?.[0];
            let uploadSucceeded = false;
            if (mediaPath) {
                uploadSucceeded = await this.directUpload(tabId, mediaPath, config.mediaButtonText, config.mediaButtonSelector, ctr);
                if (uploadSucceeded) {
                    log.info(`[DirectPost] Upload OK: ${mediaPath}`);
                    // Wait for upload preview to render
                    await this.delay(3000);
                }
                else {
                    log.warn(`[DirectPost] Upload FAILED: ${mediaPath}`);
                }
            }
            // Step 6: Type content (SCOPED to composer container) — retry once on failure
            let typeOk = await this.directType(tabId, config.textboxSelector, content, ctr);
            if (!typeOk) {
                log.warn('[DirectPost] Type attempt 1 failed — retrying after 1s');
                await this.delay(1000);
                typeOk = await this.directType(tabId, config.textboxSelector, content, ctr);
            }
            if (!typeOk) {
                log.warn('[DirectPost] Type FAILED after retry');
                throw new Error('type_failed');
            }
            log.info(`[DirectPost] Type OK (${content.length} chars)`);
            // Step 7: Wait for text to render in React
            await this.delay(1500);
            // Step 8: Handle "Next" button — ONLY if upload succeeded (Next appears only with images)
            if (config.nextButtonText && uploadSucceeded) {
                const nextOk = await this.directClick(tabId, config.nextButtonText, undefined, ctr);
                if (nextOk) {
                    log.info(`[DirectPost] Next button clicked — waiting for Post screen`);
                    await this.delay(2000);
                }
                else {
                    log.info(`[DirectPost] No Next button found — trying Post directly`);
                }
            }
            // Step 9: Click Post button (SCOPED to composer container)
            const postOk = await this.directClick(tabId, config.postText, config.postFallbackSelector, ctr);
            if (!postOk) {
                log.warn('[DirectPost] Post click FAILED');
                throw new Error('post_click_failed');
            }
            log.info('[DirectPost] Post click OK');
            // Step 10: Verify composer dismissed (post accepted)
            await this.delay(2000);
            const composerGone = await this.fetchDesktop('/tabs/execute', {
                id: tabId,
                script: `!document.querySelector(${JSON.stringify(ctr)})`,
            }).catch(() => ({ result: null }));
            if (composerGone.result === true) {
                log.info('[DirectPost] Composer dismissed — post accepted');
            }
            else {
                log.warn('[DirectPost] Composer still visible — post may not have submitted');
            }
            const elapsed = Date.now() - startMs;
            log.info(`[TheScheduler] Task ${task.id} DIRECT POST completed in ${elapsed}ms`);
            return true;
        }
        catch (err) {
            log.error({ err: err.message }, `[DirectPost] Unexpected error`);
        }
        // Cleanup: dismiss dialog if we opened it (prevents double-dialog on LLM fallback)
        if (composeClicked && tabId !== null) {
            try {
                await this.fetchDesktop('/tabs/execute', {
                    id: tabId,
                    script: `(function(){ var d = document.querySelector('div[role="dialog"]'); if(d){ var btn = d.querySelector('[aria-label="Close"]'); if(btn) btn.click(); else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true})); } })()`,
                });
                await this.delay(500);
                log.info('[DirectPost] Dismissed composer dialog before LLM fallback');
            }
            catch { /* best-effort cleanup */ }
        }
        return false;
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
        instruction += `2. Click the compose/create post button (e.g. "What's on your mind" on Facebook, "Start a post" on LinkedIn). Wait for the composer dialog to appear.\n`;
        if (mediaPath) {
            // Upload image FIRST, then type text. Image must be in the dialog before text to avoid
            // separate dialog/DOM issues. Container scoping (v1.15.24+) handles DOM changes.
            instruction += `3. Call upload_file with filePath="${mediaPath}" to attach the image. Do NOT click any upload button — upload_file handles it programmatically.\n`;
            instruction += `4. Call wait with seconds=3 to let the upload preview render.\n`;
            instruction += `5. Call type_text with selector="div[contenteditable='true'][role='textbox']" and text="${safeContent}".\n`;
            instruction += `6. Call wait with seconds=2 to let the text render.\n`;
            instruction += `7. If you see a "Next" button in the dialog, click it and wait 2 seconds. Then click the "Post" button.\n`;
            instruction += `8. If there is no "Next" button, click the Post/Share button directly to publish.\n`;
        }
        else {
            instruction += `3. Call type_text with selector="div[contenteditable='true'][role='textbox']" and text="${safeContent}".\n`;
            instruction += `4. Call wait with seconds=2 to let the text render.\n`;
            instruction += `5. Click the Post/Share button to publish.\n`;
        }
        instruction += `\nCRITICAL: The post content MUST appear in the text box. Do NOT skip the type_text call.`;
        instruction += `\nDo NOT click any photo/media/upload button or input[type="file"]. The upload_file tool handles file attachment programmatically.`;
        instruction += `\nIMPORTANT: After the composer dialog opens, ALL actions (type, click Post, click Next) must target elements INSIDE the dialog. Do NOT click any button in the news feed.`;
        instruction += `\nFACEBOOK: If you see TWO dialogs, close both and start over. After uploading an image, Facebook may show "Next" — click it before "Post".`;
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