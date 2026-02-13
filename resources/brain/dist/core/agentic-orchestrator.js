"use strict";
// @ts-nocheck
/**
 * CHROMADON Agentic Orchestrator
 * ==============================
 * Claude Code-like agentic loop for browser automation.
 * Uses Claude's native tool_use API with streaming SSE.
 *
 * Flow:
 *   User message -> Claude API (streaming) -> text + tool_use blocks
 *   -> Execute tools -> Send tool_result -> Claude continues
 *   -> Repeat until stop_reason === "end_turn"
 *
 * @author Barrios A2I
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgenticOrchestrator = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const browser_tools_1 = require("./browser-tools");
const orchestrator_system_prompt_1 = require("./orchestrator-system-prompt");
const DEFAULT_CONFIG = {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    maxLoops: 50,
    maxSessionMessages: 15,
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
};
// ============================================================================
// NO-OP DETECTOR — detects when the Brain is stuck (same page state 3x)
// ============================================================================
class NoOpDetector {
    lastContextHash = '';
    noOpCount = 0;
    check(pageContext) {
        const hash = pageContext.slice(0, 500);
        if (hash === this.lastContextHash) {
            this.noOpCount++;
            return this.noOpCount >= 3;
        }
        this.noOpCount = 0;
        this.lastContextHash = hash;
        return false;
    }
    reset() {
        this.noOpCount = 0;
        this.lastContextHash = '';
    }
}
class AgenticOrchestrator {
    client;
    sessions = new Map();
    toolExecutor;
    config;
    pruneInterval = null;
    additionalTools;
    additionalExecutor;
    additionalToolNames;
    getSkillsForPrompt;
    constructor(apiKey, toolExecutor, config, additionalTools, additionalExecutor, getSkillsForPrompt) {
        this.client = new sdk_1.default({ apiKey, timeout: 120_000, maxRetries: 2 });
        this.toolExecutor = toolExecutor;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.additionalTools = additionalTools || [];
        this.additionalExecutor = additionalExecutor || null;
        this.additionalToolNames = new Set(this.additionalTools.map(t => t.name));
        this.getSkillsForPrompt = getSkillsForPrompt || null;
        // Prune expired sessions every 5 minutes
        this.pruneInterval = setInterval(() => this.pruneExpiredSessions(), 5 * 60 * 1000);
    }
    /**
     * Main entry point - runs the full agentic loop with SSE streaming.
     */
    async chat(sessionId, userMessage, writer, context, pageContext) {
        // 1. Session management
        let session;
        if (sessionId && this.sessions.has(sessionId)) {
            session = this.sessions.get(sessionId);
            session.lastActivityAt = Date.now();
        }
        else {
            session = {
                id: (0, uuid_1.v4)(),
                messages: [],
                createdAt: Date.now(),
                lastActivityAt: Date.now(),
                videoTracker: {
                    allVideoIds: [],
                    processedIds: [],
                    skippedIds: [],
                    failedIds: [],
                    currentVideoId: '',
                    claimsErased: 0,
                },
            };
            this.sessions.set(session.id, session);
        }
        writer.writeEvent('session_id', { sessionId: session.id });
        // 2. Add user message to session
        session.messages.push({ role: 'user', content: userMessage });
        // 3. Build system prompt with current page context + skill memory
        const skillsJson = this.getSkillsForPrompt ? this.getSkillsForPrompt() : '';
        const systemPrompt = (0, orchestrator_system_prompt_1.buildOrchestratorSystemPrompt)(pageContext, skillsJson);
        // Inject video tracking blacklist so AI knows what's already done
        let finalSystemPrompt = systemPrompt;
        if (session.videoTracker.allVideoIds.length > 0) {
            const t = session.videoTracker;
            const doneList = [...t.processedIds, ...t.skippedIds, ...t.failedIds];
            if (doneList.length > 0) {
                finalSystemPrompt += `\n\nVIDEO TRACKING (${t.processedIds.length} done, ${t.skippedIds.length} skipped, ${t.failedIds.length} failed of ${t.allVideoIds.length} total):\nDO NOT navigate to these videos: ${doneList.join(', ')}`;
            }
        }
        // 4. Agentic loop
        let loopCount = 0;
        let transientRetryCount = 0; // Independent counter for network/timeout retries (resets on success)
        let lastNavigatedUrl = ''; // Track last URL for blank page recovery
        const urlAttemptCounts = {}; // Track repeated URL navigations
        let sessionInputTokens = 0;
        let sessionOutputTokens = 0;
        const noOpDetector = new NoOpDetector();
        while (loopCount < this.config.maxLoops) {
            if (writer.isClosed())
                break;
            // Check abort signal before each loop iteration
            if (context.abortSignal?.aborted) {
                if (!writer.isClosed()) {
                    writer.writeEvent('text_delta', { text: '\n\nExecution stopped by user.' });
                    writer.writeEvent('done', {});
                }
                break;
            }
            loopCount++;
            try {
                // 5. Prune history before API call to limit context cost
                if (session.messages.length > this.config.maxSessionMessages) {
                    session.messages = this.truncateHistory(session.messages, this.config.maxSessionMessages);
                }
                // 5b. Prune old screenshots — keep only last 2 to prevent payload bloat
                this.pruneOldScreenshots(session.messages, 1);
                // 5c. Sanitize history — ensure all tool_use/tool_result pairs are intact
                const sanitizedMessages = this.sanitizeHistory(session.messages);
                // Guard: prevent 400 "at least one message is required"
                if (sanitizedMessages.length === 0) {
                    console.warn('[CHROMADON Orchestrator] sanitizeHistory produced empty messages — injecting recovery');
                    sanitizedMessages.push({ role: 'user', content: 'Continue with the current task. Resume where you left off.' });
                }
                // 6. Call Claude API with streaming (browser tools + any additional tools)
                const allTools = [...browser_tools_1.BROWSER_TOOLS, ...this.additionalTools];
                const stream = this.client.messages.stream({
                    model: this.config.model,
                    max_tokens: this.config.maxTokens,
                    temperature: 0,
                    system: finalSystemPrompt,
                    tools: allTools,
                    messages: sanitizedMessages,
                });
                // Wire abort signal to cancel the stream
                let abortHandler = null;
                if (context.abortSignal) {
                    abortHandler = () => { stream.abort(); };
                    context.abortSignal.addEventListener('abort', abortHandler, { once: true });
                }
                // 6. Process stream events and accumulate content blocks
                const contentBlocks = [];
                let currentBlockIndex = -1;
                let currentToolInput = '';
                let currentToolId = '';
                let currentToolName = '';
                let stopReason = '';
                const messageStream = stream.on('text', (text) => {
                    // Stream text deltas to client
                    if (!writer.isClosed()) {
                        writer.writeEvent('text_delta', { text });
                    }
                });
                // Process raw stream events for tool use handling
                stream.on('contentBlock', (block) => {
                    contentBlocks.push(block);
                });
                stream.on('error', (error) => {
                    // Ignore abort errors — they're expected when user stops
                    if (context.abortSignal?.aborted)
                        return;
                    console.error(`[CHROMADON Orchestrator] Stream error event:`, error.message || error);
                });
                // Wait for the full message (with safety timeout to prevent infinite hangs)
                let finalMessage;
                try {
                    finalMessage = await Promise.race([
                        stream.finalMessage(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Stream timed out after 3 minutes')), 180_000)),
                    ]);
                }
                catch (streamErr) {
                    // If aborted, break cleanly
                    if (context.abortSignal?.aborted) {
                        if (!writer.isClosed()) {
                            writer.writeEvent('text_delta', { text: '\n\nExecution stopped by user.' });
                            writer.writeEvent('done', {});
                        }
                        break;
                    }
                    throw streamErr;
                }
                finally {
                    // Clean up abort listener
                    if (abortHandler && context.abortSignal) {
                        context.abortSignal.removeEventListener('abort', abortHandler);
                    }
                }
                stopReason = finalMessage.stop_reason || '';
                // Cost tracking — log token usage per API call
                if (finalMessage.usage) {
                    sessionInputTokens += finalMessage.usage.input_tokens || 0;
                    sessionOutputTokens += finalMessage.usage.output_tokens || 0;
                    const callCost = ((finalMessage.usage.input_tokens || 0) / 1_000_000) * 1 +
                        ((finalMessage.usage.output_tokens || 0) / 1_000_000) * 5;
                    console.log(`[COST] Call ${loopCount}: ${finalMessage.usage.input_tokens}in/${finalMessage.usage.output_tokens}out ($${callCost.toFixed(4)}) | Session total: ${sessionInputTokens}in/${sessionOutputTokens}out ($${(sessionInputTokens / 1_000_000 * 1 + sessionOutputTokens / 1_000_000 * 5).toFixed(4)})`);
                }
                // 7. Push assistant message to session history
                session.messages.push({ role: 'assistant', content: finalMessage.content });
                // 8. Check if we need to execute tools
                if (stopReason === 'tool_use') {
                    const toolUseBlocks = finalMessage.content.filter((b) => b.type === 'tool_use');
                    const toolResults = [];
                    let prevToolName = '';
                    for (const toolBlock of toolUseBlocks) {
                        // Check abort signal before each tool
                        if (context.abortSignal?.aborted) {
                            if (!writer.isClosed()) {
                                writer.writeEvent('text_delta', { text: '\n\nExecution stopped by user.' });
                                writer.writeEvent('done', {});
                            }
                            break;
                        }
                        const toolName = toolBlock.name;
                        const toolInput = toolBlock.input;
                        const toolId = toolBlock.id;
                        // Notify client of tool execution
                        if (!writer.isClosed()) {
                            writer.writeEvent('tool_start', { id: toolId, name: toolName });
                            writer.writeEvent('tool_executing', {
                                id: toolId,
                                name: toolName,
                                input: toolInput,
                            });
                        }
                        // Execute the tool - route to additional executor if applicable
                        const startMs = Date.now();
                        let result;
                        if (this.additionalExecutor && this.additionalToolNames.has(toolName)) {
                            // Additional tools (analytics, YouTube, etc.) - may be sync or async
                            const text = await this.additionalExecutor(toolName, toolInput);
                            result = { success: true, result: text };
                        }
                        else {
                            result = await this.toolExecutor(toolName, toolInput, context);
                        }
                        const durationMs = Date.now() - startMs;
                        // Update context if tab was switched or created
                        if (toolName === 'switch_tab' && result.success && context.useDesktop) {
                            context.desktopTabId = toolInput.tabId;
                        }
                        else if (toolName === 'create_tab' && result.success && context.useDesktop) {
                            // Extract new tab ID from result if available
                            const match = result.result.match(/\[(\d+)\]/);
                            if (match) {
                                context.desktopTabId = parseInt(match[1], 10);
                            }
                        }
                        // --- Video Tracker: populate from tool results ---
                        const tracker = session.videoTracker;
                        if (toolName === 'get_video_ids' && result.success) {
                            const ids = (result.result.match(/([a-zA-Z0-9_-]{11})\s*→/g) || [])
                                .map((m) => m.replace(/\s*→/, ''));
                            if (ids.length > 0) {
                                tracker.allVideoIds = ids;
                                tracker.processedIds = [];
                                tracker.skippedIds = [];
                                tracker.failedIds = [];
                                tracker.currentVideoId = '';
                                tracker.claimsErased = 0;
                                console.log(`[VIDEO TRACKER] Loaded ${ids.length} video IDs`);
                            }
                        }
                        if (toolName === 'navigate' && result.success && tracker.allVideoIds.length > 0) {
                            const navUrl = toolInput.url;
                            const vidMatch = navUrl.match(/\/video\/([a-zA-Z0-9_-]{11})\/copyright/);
                            if (vidMatch) {
                                const videoId = vidMatch[1];
                                // REACTIVE: if AI navigates to a video already processed, warn it
                                if (tracker.processedIds.includes(videoId)) {
                                    result = { ...result, result: `ALREADY PROCESSED: Video ${videoId} was already handled. Do NOT re-process. Navigate to the next unprocessed video.` };
                                    console.log(`[VIDEO TRACKER] Blocked re-visit to ${videoId}`);
                                }
                                else if (tracker.skippedIds.includes(videoId)) {
                                    result = { ...result, result: `ALREADY SKIPPED (editing in progress): Video ${videoId}. Navigate to the next unprocessed video.` };
                                    console.log(`[VIDEO TRACKER] Blocked re-visit to skipped ${videoId}`);
                                }
                                else {
                                    // New video — mark previous as processed (it navigated AWAY, so it's done)
                                    if (tracker.currentVideoId && tracker.currentVideoId !== videoId &&
                                        !tracker.processedIds.includes(tracker.currentVideoId) &&
                                        !tracker.skippedIds.includes(tracker.currentVideoId) &&
                                        !tracker.failedIds.includes(tracker.currentVideoId)) {
                                        tracker.processedIds.push(tracker.currentVideoId);
                                        console.log(`[VIDEO TRACKER] Completed: ${tracker.currentVideoId} (${tracker.processedIds.length}/${tracker.allVideoIds.length})`);
                                    }
                                    tracker.currentVideoId = videoId;
                                }
                            }
                        }
                        if (result.success && /\[PAGE DEAD\]/i.test(result.result) && tracker.currentVideoId) {
                            if (!tracker.failedIds.includes(tracker.currentVideoId)) {
                                tracker.failedIds.push(tracker.currentVideoId);
                                console.log(`[VIDEO TRACKER] Failed (page dead): ${tracker.currentVideoId}`);
                            }
                        }
                        // URL retry counter — detect infinite loops on broken URLs
                        if (toolName === 'navigate' && result.success) {
                            const navUrlKey = toolInput.url;
                            urlAttemptCounts[navUrlKey] = (urlAttemptCounts[navUrlKey] || 0) + 1;
                            if (urlAttemptCounts[navUrlKey] >= 3) {
                                console.log(`[LOOP GUARD] URL attempted ${urlAttemptCounts[navUrlKey]} times: ${navUrlKey}`);
                                result = { ...result, result: `LOOP DETECTED: You have tried this URL ${urlAttemptCounts[navUrlKey]} times. It will NEVER work. Navigate to https://studio.youtube.com directly and go to Content > Live manually. DO NOT use filter URLs. Try a completely different approach.` };
                            }
                        }
                        // Silent page health guard — auto-refresh blank pages BEFORE AI sees them
                        if (['navigate', 'click', 'click_table_row'].includes(toolName) && result.success && context.useDesktop) {
                            if (toolName === 'navigate')
                                lastNavigatedUrl = toolInput.url;
                            const recoveryUrl = toolName === 'navigate' ? toolInput.url : lastNavigatedUrl;
                            if (recoveryUrl) {
                                const healthMsg = await this.ensurePageHealthy(context, recoveryUrl);
                                if (healthMsg) {
                                    result = { ...result, result: `${result.result}\n\n${healthMsg}` };
                                }
                            }
                            // Error page detection — permission denied, YouTube error, rate limited
                            const pageError = await this.isPageErrored(context);
                            if (pageError) {
                                console.log(`[PAGE HEALTH] Error page detected: ${pageError}`);
                                if (pageError === 'PERMISSION_DENIED') {
                                    result = { ...result, result: 'PERMISSION DENIED — this URL has the wrong channel ID or session expired. DO NOT retry this URL. Navigate to https://studio.youtube.com and go to Content > Live manually.' };
                                }
                                else if (pageError === 'YOUTUBE_ERROR') {
                                    result = { ...result, result: 'YouTube error page. DO NOT retry this URL. Navigate to https://studio.youtube.com directly.' };
                                }
                                else if (pageError === 'RATE_LIMITED') {
                                    result = { ...result, result: 'Rate limited by YouTube. Wait 30 seconds before trying again.' };
                                    await new Promise(r => setTimeout(r, 30000));
                                }
                                else if (pageError === 'NOT_FOUND') {
                                    result = { ...result, result: 'Page not found (404). DO NOT retry this URL. Navigate to https://studio.youtube.com directly.' };
                                }
                            }
                        }
                        // "Editing in progress" enforcement — auto-skip ONLY if no actionable buttons
                        if (toolName === 'navigate' && result.success && tracker.allVideoIds.length > 0) {
                            const navUrl = toolInput.url;
                            if (navUrl.includes('/copyright') && context.useDesktop && context.desktopTabId !== null) {
                                try {
                                    const desktopUrl = context.desktopUrl || 'http://127.0.0.1:3002';
                                    const editCheckResp = await fetch(`${desktopUrl}/tabs/execute`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            id: context.desktopTabId,
                                            script: `(function(){
                        var t = (document.body && document.body.innerText) || '';
                        var hasEditing = t.includes('editing is in progress');
                        var hasTakeAction = t.includes('Take action');
                        return { hasEditing: hasEditing, hasTakeAction: hasTakeAction };
                      })()`,
                                        }),
                                    });
                                    const editCheckData = await editCheckResp.json();
                                    const { hasEditing, hasTakeAction } = editCheckData.result || {};
                                    if (hasEditing && !hasTakeAction && tracker.currentVideoId) {
                                        // Editing in progress with NO actionable buttons → auto-defer
                                        if (!tracker.skippedIds.includes(tracker.currentVideoId)) {
                                            tracker.skippedIds.push(tracker.currentVideoId);
                                            console.log(`[VIDEO TRACKER] Auto-skipped (editing, no buttons): ${tracker.currentVideoId}`);
                                        }
                                        result = { ...result, result: 'EDITING IN PROGRESS with no actionable claims. Auto-deferred. Navigate to the next unprocessed video.' };
                                    }
                                    else if (hasEditing && hasTakeAction) {
                                        // Editing in progress BUT Take action buttons exist → tell AI to keep clicking
                                        console.log(`[VIDEO TRACKER] Editing in progress but ${tracker.currentVideoId} has Take action buttons — NOT skipping`);
                                        result = { ...result, result: result.result + '\n\n[NOTE] "Editing in progress" banner is visible but "Take action" buttons are still present. Process ALL remaining claims. Do NOT skip this video.' };
                                    }
                                }
                                catch { /* non-fatal */ }
                            }
                        }
                        // Tiered verification — screenshot + auto-context (ACT → VERIFY → DECIDE)
                        const LOW_STAKES = ['scroll', 'wait', 'list_tabs', 'switch_tab', 'get_video_ids', 'check_page_health', 'wait_for_result'];
                        const MEDIUM_STAKES = ['type_text', 'select_option', 'extract_text', 'hover', 'press_key'];
                        const HIGH_STAKES = ['click', 'navigate', 'create_tab', 'upload_file', 'hover_and_click', 'click_table_row'];
                        let verificationBase64 = null;
                        let verificationText = '';
                        const isDesktop = context.useDesktop && context.desktopTabId !== null;
                        const isLow = LOW_STAKES.includes(toolName);
                        const isMedium = MEDIUM_STAKES.includes(toolName);
                        const isHigh = HIGH_STAKES.includes(toolName);
                        // HIGH_STAKES: always screenshot + page context on success
                        // MEDIUM_STAKES: page context on success, screenshot on failure
                        // LOW_STAKES: no verification
                        const needsScreenshot = isDesktop && (isHigh && result.success);
                        if (needsScreenshot) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 500));
                                const storageUrl = context.desktopUrl || 'http://127.0.0.1:3002';
                                const screenshotResp = await fetch(`${storageUrl}/storage/screenshot`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        tabId: context.desktopTabId,
                                        sessionId: session.id,
                                        action: toolName,
                                        platform: this.detectPlatformFromResult(result.result),
                                    }),
                                });
                                const screenshotData = await screenshotResp.json();
                                if (screenshotData.success && screenshotData.base64) {
                                    verificationBase64 = screenshotData.base64;
                                }
                            }
                            catch {
                                // Non-fatal — fall back to text-only verification
                            }
                        }
                        // Auto-capture page context for state-changing tools on success
                        // Skip if previous tool was also a click (avoids redundant context in click sequences)
                        const skipAutoContext = (toolName === 'click' || toolName === 'click_table_row') &&
                            (prevToolName === 'click' || prevToolName === 'click_table_row');
                        if (isDesktop && result.success && (isHigh || isMedium) && !skipAutoContext) {
                            try {
                                const pageCtx = await this.toolExecutor('get_page_context', {}, context);
                                if (pageCtx.success) {
                                    verificationText = pageCtx.result;
                                }
                            }
                            catch { /* non-fatal */ }
                        }
                        // No-op detection: if page context unchanged for 3 tool rounds, inject recovery hint
                        if (verificationText && noOpDetector.check(verificationText)) {
                            verificationText += '\n\n[STUCK DETECTED] Page unchanged after 3 actions. Try a different approach.';
                            noOpDetector.reset();
                        }
                        // Notify client of tool result
                        if (!writer.isClosed()) {
                            writer.writeEvent('tool_result', {
                                id: toolId,
                                name: toolName,
                                success: result.success,
                                result: result.result.slice(0, 500),
                                error: result.error,
                                durationMs,
                                hasScreenshot: !!verificationBase64,
                            });
                        }
                        // Build tool_result for Claude — full results, no truncation
                        // CRITICAL: Anthropic API requires ALL content to be type "text" when is_error is true.
                        // Sending image blocks with is_error:true causes a 400 crash.
                        if (!result.success) {
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: toolId,
                                content: `Error: ${result.error || 'Unknown error'}`,
                                is_error: true,
                            });
                        }
                        else if (verificationBase64) {
                            // Success + screenshot (HIGH_STAKES) — AI sees the result
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: toolId,
                                content: [
                                    {
                                        type: 'text',
                                        text: `${result.result}${verificationText ? `\n\n[AUTO-CONTEXT]\n${verificationText}` : ''}`,
                                    },
                                    {
                                        type: 'image',
                                        source: { type: 'base64', media_type: 'image/jpeg', data: verificationBase64 },
                                    },
                                ],
                            });
                        }
                        else if (isLow) {
                            // LOW_STAKES — no screenshot, minimal result
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: toolId,
                                content: result.result,
                            });
                        }
                        else {
                            // MEDIUM_STAKES success — text + auto-context
                            toolResults.push({
                                type: 'tool_result',
                                tool_use_id: toolId,
                                content: `${result.result}${verificationText ? `\n\n[AUTO-CONTEXT]\n${verificationText}` : ''}`,
                            });
                        }
                        prevToolName = toolName;
                    }
                    // If aborted during tool execution, break out
                    if (context.abortSignal?.aborted)
                        break;
                    // Push tool results as user message
                    session.messages.push({ role: 'user', content: toolResults });
                    // Reset transient retry counter on successful tool execution
                    transientRetryCount = 0;
                    // Continue the loop - Claude will process tool results
                    continue;
                }
                // 9. stop_reason is "end_turn" or "max_tokens"
                transientRetryCount = 0; // Reset on success
                // Auto-continue logic — NEVER wait for user input mid-task
                const responseText = finalMessage.content
                    .filter((b) => b.type === 'text')
                    .map((b) => b.text)
                    .join('');
                const hasToolCall = finalMessage.content.some((b) => b.type === 'tool_use');
                // If the AI produced a tool call, the loop already `continue`d above via stop_reason === 'tool_use'.
                // If we're here, it's a text-only end_turn or max_tokens.
                // Final summary — truly done, stop the loop
                if (/processed \d+ video|erased \d+ song|all.*done|all.*complete|finished processing/i.test(responseText)) {
                    break;
                }
                // AI is asking what to do / saying it's ready — force continuation
                const isAskingForInput = /what.*next|what.*do|ready to continue|shall I|would you like|what's the next step|how.*proceed|let me know/i.test(responseText);
                if (isAskingForInput && !hasToolCall) {
                    session.messages.push({
                        role: 'user',
                        content: 'Continue. Do not ask what to do next. Process the next video. Never stop until all videos are processed.',
                    });
                    continue;
                }
                // max_tokens truncation — AI ran out of space, keep going
                if (stopReason === 'max_tokens') {
                    session.messages.push({ role: 'user', content: 'Continue.' });
                    continue;
                }
                // Default for end_turn with no tool call and no summary: auto-continue
                // (catches edge cases like "Okay." or empty responses)
                if (!hasToolCall && responseText.trim().length < 200) {
                    session.messages.push({ role: 'user', content: 'Continue.' });
                    continue;
                }
                break;
            }
            catch (error) {
                const errorMsg = error.message || 'Unknown error';
                console.error(`[CHROMADON Orchestrator] Error in loop ${loopCount}:`, errorMsg);
                // Recovery: if 400 with tool_use_id mismatch, purge tool messages and retry once
                if (error?.status === 400 && errorMsg.includes('tool_use_id')) {
                    console.warn('[CHROMADON Orchestrator] Tool history corruption detected — purging tool blocks and retrying');
                    // Strip tool_use and tool_result blocks, keep text AND image blocks
                    session.messages = session.messages.map(msg => {
                        if (Array.isArray(msg.content)) {
                            const keepBlocks = msg.content.filter((b) => b.type === 'text' || b.type === 'image');
                            if (keepBlocks.length === 0) {
                                // Convert to a placeholder so role alternation is preserved
                                return { role: msg.role, content: msg.role === 'user' ? '(continued)' : '(tool actions completed)' };
                            }
                            return { ...msg, content: keepBlocks.length === 1 && keepBlocks[0].type === 'text' ? keepBlocks[0].text : keepBlocks };
                        }
                        return msg;
                    });
                    session.messages = this.sanitizeHistory(session.messages);
                    // Don't break — let the loop retry with clean history
                    continue;
                }
                // Recovery: 400 "at least one message" — messages were empty/malformed
                if (error?.status === 400 && errorMsg.includes('at least one message')) {
                    console.warn('[CHROMADON Orchestrator] Empty messages detected — recovering');
                    session.messages.push({ role: 'user', content: 'Continue with the current task. Resume where you left off.' });
                    continue;
                }
                // Recovery: 429 rate limit — exponential backoff and retry
                if (error?.status === 429) {
                    const retryAfterHeader = error?.headers?.get?.('retry-after') || error?.headers?.['retry-after'];
                    const retryAfterMs = retryAfterHeader
                        ? Math.min(parseInt(String(retryAfterHeader), 10) * 1000, 30000)
                        : Math.min(1000 * Math.pow(2, loopCount), 30000);
                    console.warn(`[CHROMADON Orchestrator] Rate limited (429) — waiting ${retryAfterMs}ms before retry`);
                    if (!writer.isClosed()) {
                        writer.writeEvent('text_delta', { text: `\n\nBrief pause... resuming in ${Math.ceil(retryAfterMs / 1000)}s.\n` });
                    }
                    await new Promise(resolve => setTimeout(resolve, retryAfterMs));
                    continue;
                }
                // Recovery: 529 overloaded — longer backoff and retry
                if (error?.status === 529) {
                    const waitMs = Math.min(5000 * Math.pow(2, loopCount), 60000);
                    console.warn(`[CHROMADON Orchestrator] API overloaded (529) — waiting ${waitMs}ms before retry`);
                    if (!writer.isClosed()) {
                        writer.writeEvent('text_delta', { text: `\n\nAPI busy. Retrying in ${Math.ceil(waitMs / 1000)}s...\n` });
                    }
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                }
                // Recovery: transient errors (timeout, connection, network) — retry up to 3 times
                // Uses independent transientRetryCount so retries work mid-workflow (not tied to loopCount)
                const errorLower = errorMsg.toLowerCase();
                const isTransient = [
                    'connection error', 'econnrefused', 'enotfound', 'econnreset',
                    'socket hang up', 'fetch failed', 'network error', 'networkerror',
                    'ehostunreach', 'etimedout', 'cannot reach', 'timed out', 'timeout',
                    'econnaborted', 'epipe', 'eproto'
                ].some(pattern => errorLower.includes(pattern));
                if (isTransient && transientRetryCount < 3) {
                    transientRetryCount++;
                    const waitMs = Math.min(3000 * Math.pow(2, transientRetryCount - 1), 15000);
                    console.warn(`[CHROMADON Orchestrator] Transient error (attempt ${transientRetryCount}/3) — waiting ${waitMs}ms: ${errorMsg}`);
                    if (!writer.isClosed()) {
                        writer.writeEvent('text_delta', { text: `\n\nConnection issue. Retrying (${transientRetryCount}/3)...\n` });
                    }
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    continue;
                }
                // User-friendly error messages (raw error preserved in console.error above)
                console.error(`[CHROMADON Orchestrator] Unrecoverable error — status: ${error?.status}, message: ${errorMsg}, transientRetries: ${transientRetryCount}`);
                let userMsg;
                if (error?.status === 401) {
                    userMsg = 'Authentication failed. Please check your API key in settings.';
                }
                else if (error?.status === 413 || errorMsg.includes('request_too_large') || errorMsg.includes('Request too large')) {
                    userMsg = 'The conversation got too long. Starting a fresh chat session may help.';
                }
                else if (isTransient) {
                    userMsg = 'Lost connection to the AI service after 3 retries. Please check your internet and try again.';
                }
                else {
                    userMsg = `Something went wrong: ${errorMsg}`;
                }
                if (!writer.isClosed()) {
                    writer.writeEvent('error', { message: userMsg });
                }
                break;
            }
        }
        if (loopCount >= this.config.maxLoops && !writer.isClosed()) {
            writer.writeEvent('error', {
                message: `Reached maximum tool-use loops (${this.config.maxLoops}). Stopping.`,
            });
        }
        // 10. Done — include cost summary
        const totalCostUSD = (sessionInputTokens / 1_000_000) * 1 + (sessionOutputTokens / 1_000_000) * 5;
        console.log(`[COST] Session complete: ${loopCount} API calls, ${sessionInputTokens}in/${sessionOutputTokens}out, $${totalCostUSD.toFixed(4)}`);
        if (!writer.isClosed()) {
            writer.writeEvent('done', {
                apiCalls: loopCount,
                inputTokens: sessionInputTokens,
                outputTokens: sessionOutputTokens,
                costUSD: totalCostUSD,
            });
        }
        // 11. Prune session messages if needed
        this.pruneSessionMessages(session);
    }
    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    clearSession(sessionId) {
        return this.sessions.delete(sessionId);
    }
    getSessionCount() {
        return this.sessions.size;
    }
    /**
     * Sanitize conversation history to prevent tool_use/tool_result mismatches.
     * Every tool_result must reference a tool_use in the immediately preceding
     * assistant message, and vice versa. Orphaned blocks are stripped.
     */
    sanitizeHistory(messages) {
        if (!messages || messages.length === 0)
            return [];
        const sanitized = [];
        for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            // --- ASSISTANT messages with tool_use blocks ---
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
                const toolUseBlocks = msg.content.filter((b) => b.type === 'tool_use');
                const otherBlocks = msg.content.filter((b) => b.type !== 'tool_use');
                if (toolUseBlocks.length > 0) {
                    const nextMsg = messages[i + 1];
                    if (nextMsg && nextMsg.role === 'user' && Array.isArray(nextMsg.content)) {
                        // Get tool_result IDs from the next user message
                        const toolResultIds = new Set(nextMsg.content
                            .filter((b) => b.type === 'tool_result')
                            .map((b) => b.tool_use_id));
                        // Only keep tool_use blocks that have matching tool_results
                        const matched = toolUseBlocks.filter((b) => toolResultIds.has(b.id));
                        if (matched.length > 0 || otherBlocks.length > 0) {
                            sanitized.push({ role: 'assistant', content: [...otherBlocks, ...matched] });
                        }
                    }
                    else {
                        // No matching user message — drop tool_use blocks, keep text
                        if (otherBlocks.length > 0) {
                            sanitized.push({ role: 'assistant', content: otherBlocks });
                        }
                    }
                    continue;
                }
            }
            // --- USER messages with tool_result blocks ---
            if (msg.role === 'user' && Array.isArray(msg.content)) {
                const toolResultBlocks = msg.content.filter((b) => b.type === 'tool_result');
                const otherBlocks = msg.content.filter((b) => b.type !== 'tool_result');
                if (toolResultBlocks.length > 0) {
                    const prevMsg = sanitized[sanitized.length - 1];
                    if (prevMsg && prevMsg.role === 'assistant' && Array.isArray(prevMsg.content)) {
                        const toolUseIds = new Set(prevMsg.content
                            .filter((b) => b.type === 'tool_use')
                            .map((b) => b.id));
                        // Only keep tool_results that have matching tool_use blocks
                        const matched = toolResultBlocks.filter((b) => toolUseIds.has(b.tool_use_id));
                        if (matched.length > 0 || otherBlocks.length > 0) {
                            sanitized.push({ role: 'user', content: [...matched, ...otherBlocks] });
                        }
                    }
                    else {
                        // No matching assistant message — drop tool_results, keep text
                        if (otherBlocks.length > 0) {
                            sanitized.push({ role: 'user', content: otherBlocks });
                        }
                    }
                    continue;
                }
            }
            // Regular messages — pass through
            sanitized.push(msg);
        }
        // Ensure messages alternate roles (merge consecutive same-role messages)
        const final = [];
        for (const msg of sanitized) {
            const prev = final[final.length - 1];
            if (prev && prev.role === msg.role) {
                // Never merge messages that contain tool_use or tool_result blocks —
                // merging would destroy the block structure the API requires
                const hasToolBlocks = (m) => {
                    if (typeof m.content === 'string')
                        return false;
                    return m.content.some((b) => b.type === 'tool_use' || b.type === 'tool_result');
                };
                if (hasToolBlocks(prev) || hasToolBlocks(msg)) {
                    // Can't merge — drop the duplicate-role message to maintain alternation
                    // Keep the one with tool blocks (more important), or keep prev if neither has them
                    if (!hasToolBlocks(prev) && hasToolBlocks(msg)) {
                        final[final.length - 1] = msg;
                    }
                    // else: keep prev, skip msg
                    continue;
                }
                // Safe to merge: both are text-only
                const prevText = typeof prev.content === 'string'
                    ? prev.content
                    : prev.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
                const msgText = typeof msg.content === 'string'
                    ? msg.content
                    : msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
                final[final.length - 1] = {
                    role: msg.role,
                    content: [prevText, msgText].filter(Boolean).join('\n'),
                };
                continue;
            }
            final.push(msg);
        }
        // Ensure first message is from user
        while (final.length > 0 && final[0].role !== 'user') {
            final.shift();
        }
        // Safety: never return empty — prevents 400 "at least one message is required"
        if (final.length === 0) {
            return [{ role: 'user', content: 'Continue.' }];
        }
        return final;
    }
    /**
     * Truncate history while preserving tool_use/tool_result pairs.
     * Removes oldest messages first but never breaks a pair.
     */
    truncateHistory(messages, maxMessages) {
        if (messages.length <= maxMessages)
            return messages;
        // Walk from the front, find a safe cut point that doesn't split a tool pair
        let cutIndex = messages.length - maxMessages;
        // If the cut lands on a user(tool_result), move forward to skip it
        // (its paired assistant(tool_use) was already cut)
        while (cutIndex < messages.length) {
            const msg = messages[cutIndex];
            if (msg.role === 'user' && Array.isArray(msg.content) &&
                msg.content.some((b) => b.type === 'tool_result')) {
                cutIndex++;
                continue;
            }
            // If we land on an assistant(tool_use), also skip it — its tool_results
            // in the next message would become orphaned
            if (msg.role === 'assistant' && Array.isArray(msg.content) &&
                msg.content.some((b) => b.type === 'tool_use')) {
                cutIndex += 2; // Skip both the tool_use and its paired tool_result
                // Bounds check: if we overshot, keep at least the last message
                if (cutIndex >= messages.length) {
                    cutIndex = messages.length - 1;
                    break;
                }
                continue;
            }
            break;
        }
        // Final bounds safety — always return at least the last message
        if (cutIndex >= messages.length) {
            cutIndex = messages.length - 1;
        }
        return messages.slice(cutIndex);
    }
    pruneSessionMessages(session) {
        if (session.messages.length > this.config.maxSessionMessages) {
            session.messages = this.truncateHistory(session.messages, this.config.maxSessionMessages);
        }
    }
    /**
     * Replace old screenshot image blocks with text placeholders to save context tokens.
     * Walks messages in reverse, keeps the last `keep` image blocks intact,
     * replaces older ones with "[screenshot pruned]".
     */
    pruneOldScreenshots(messages, keep) {
        let imageCount = 0;
        // Walk in reverse to find and count image blocks
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (!Array.isArray(msg.content))
                continue;
            const blocks = msg.content;
            for (let j = blocks.length - 1; j >= 0; j--) {
                if (blocks[j].type === 'image') {
                    imageCount++;
                    if (imageCount > keep) {
                        // Replace with text placeholder
                        blocks[j] = { type: 'text', text: '[screenshot pruned — older image removed to save context]' };
                    }
                }
            }
        }
    }
    /**
     * Check if the current page is blank/black via Desktop Control Server.
     */
    async isPageBlank(context) {
        if (!context.useDesktop || context.desktopTabId === null)
            return false;
        try {
            const desktopUrl = context.desktopUrl || 'http://127.0.0.1:3002';
            const resp = await fetch(`${desktopUrl}/tabs/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: context.desktopTabId,
                    script: `(function(){ var b = document.body; if (!b) return true; return b.children.length < 3 && (b.innerText || '').trim().length < 50; })()`,
                }),
            });
            const data = await resp.json();
            return data.result === true;
        }
        catch {
            return false; // Can't check — assume OK
        }
    }
    /**
     * Check if the current page is an error page (permission denied, YouTube error, rate limited).
     * These pages have content so isPageBlank() passes — this catches them.
     */
    async isPageErrored(context) {
        if (!context.useDesktop || context.desktopTabId === null)
            return null;
        try {
            const desktopUrl = context.desktopUrl || 'http://127.0.0.1:3002';
            const resp = await fetch(`${desktopUrl}/tabs/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: context.desktopTabId,
                    script: `(function(){
            var t = (document.body && document.body.innerText) || '';
            if (t.includes("don't have permission")) return "PERMISSION_DENIED";
            if (t.includes("Oops") && t.includes("something went wrong")) return "YOUTUBE_ERROR";
            if (t.includes("try again later")) return "RATE_LIMITED";
            if (t.includes("404") && t.includes("page not found")) return "NOT_FOUND";
            return null;
          })()`,
                }),
            });
            const data = await resp.json();
            return data.result || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Silently ensure page is loaded after navigate/click.
     * Auto-refreshes blank pages up to 3 times with escalating waits.
     * Returns null if healthy, or a message if page is dead after all retries.
     */
    async ensurePageHealthy(context, url) {
        if (!context.useDesktop || context.desktopTabId === null || !url)
            return null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const blank = await this.isPageBlank(context);
            if (!blank)
                return null; // Page loaded fine
            console.log(`[PAGE HEALTH] Blank page detected (attempt ${attempt}/3). Re-navigating: ${url}`);
            try {
                const desktopUrl = context.desktopUrl || 'http://127.0.0.1:3002';
                await fetch(`${desktopUrl}/tabs/navigate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: context.desktopTabId, url }),
                });
            }
            catch { /* non-fatal */ }
            await new Promise(r => setTimeout(r, attempt * 3000)); // 3s, 6s, 9s
        }
        // Final check after all retries
        const stillBlank = await this.isPageBlank(context);
        if (!stillBlank)
            return null;
        return '[PAGE DEAD] Page blank after 3 refresh attempts. Skip this video — navigate to the next video ID.';
    }
    detectPlatformFromResult(result) {
        const lower = result.toLowerCase();
        if (lower.includes('twitter.com') || lower.includes('x.com'))
            return 'twitter';
        if (lower.includes('linkedin.com'))
            return 'linkedin';
        if (lower.includes('facebook.com') || lower.includes('fb.com'))
            return 'facebook';
        if (lower.includes('instagram.com'))
            return 'instagram';
        if (lower.includes('youtube.com'))
            return 'youtube';
        if (lower.includes('tiktok.com'))
            return 'tiktok';
        if (lower.includes('google.com'))
            return 'google';
        return undefined;
    }
    pruneExpiredSessions() {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (now - session.lastActivityAt > this.config.sessionTimeoutMs) {
                this.sessions.delete(id);
                console.log(`[CHROMADON Orchestrator] Pruned expired session: ${id}`);
            }
        }
    }
    destroy() {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
            this.pruneInterval = null;
        }
        this.sessions.clear();
    }
}
exports.AgenticOrchestrator = AgenticOrchestrator;
//# sourceMappingURL=agentic-orchestrator.js.map