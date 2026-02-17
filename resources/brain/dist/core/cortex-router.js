"use strict";
/**
 * CHROMADON CortexRouter — Agent-First Chat Routing
 * ==================================================
 * Sits between /api/orchestrator/chat and the execution backends.
 * Routes messages to the 27-agent system or the monolithic orchestrator.
 *
 * Routing priority:
 *   1. Copyright workflows (100) → monolithic (VideoTracker + auto-continue)
 *   2. Simple commands (90) → direct agent dispatch via EventBus (no LLM)
 *   3. YouTube API tasks (80) → YouTubeToolBridge (no LLM, ~200ms)
 *   3.5. Conversational/status (75) → monolithic orchestrator (greetings, questions)
 *   3.6. Social media tasks (70) → SocialMediaToolBridge → SocialOverlord (~15-20s)
 *   3.7. Browser navigation (65) → monolithic orchestrator (multi-platform, alt verbs)
 *   3.8. Client context (60) → monolithic orchestrator
 *   3.9. Scheduling (55) → monolithic orchestrator (schedule_post tool)
 *   4. Cortex planning (50) → TheCortex DAG execution (catch-all)
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortexRouter = void 0;
const event_bus_1 = require("../agents/event-bus");
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('orchestrator');
// ============================================================================
// URL RESOLUTION
// ============================================================================
const KNOWN_SITES = {
    'youtube studio': 'https://studio.youtube.com',
    'youtube': 'https://www.youtube.com',
    'google': 'https://www.google.com',
    'twitter': 'https://twitter.com',
    'x': 'https://twitter.com',
    'facebook': 'https://www.facebook.com',
    'linkedin': 'https://www.linkedin.com',
    'instagram': 'https://www.instagram.com',
    'github': 'https://github.com',
    'reddit': 'https://www.reddit.com',
    'tiktok': 'https://www.tiktok.com',
};
// ============================================================================
// CORTEX ROUTER
// ============================================================================
class CortexRouter {
    cortex;
    sequencer;
    orchestrator;
    youtubeBridge;
    socialBridge;
    routes;
    _lastRouteDecision = null;
    constructor(deps) {
        this.cortex = deps.cortex;
        this.sequencer = deps.sequencer;
        this.orchestrator = deps.orchestrator;
        this.youtubeBridge = deps.youtubeBridge || null;
        this.socialBridge = deps.socialBridge || null;
        this.routes = this.buildRoutes();
    }
    /**
     * Build sorted route candidates (highest priority first).
     */
    buildRoutes() {
        const routes = [
            {
                name: 'copyright',
                priority: 100,
                match: (msg) => this.isCopyrightWorkflow(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    log.info('[CortexRouter] Copyright workflow → monolithic');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'simple_command',
                priority: 90,
                match: (msg) => this.parseSimpleCommand(msg),
                execute: async (simple, sessionId, _message, writer) => {
                    log.info({ detail: simple.params }, `[CortexRouter] Simple command: ${simple.agent}.${simple.action} →`);
                    const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                    writer.writeEvent('session_id', { sessionId: sid });
                    return this.executeSimpleCommand(simple, sid, writer);
                },
            },
            {
                name: 'youtube_api',
                priority: 80,
                match: (msg) => this.parseYouTubeAPICommand(msg),
                execute: async (ytCommand, sessionId, _message, writer) => {
                    log.info(`[CortexRouter] YouTube API: ${ytCommand.tool}`);
                    const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                    writer.writeEvent('session_id', { sessionId: sid });
                    return this.executeYouTubeAPI(ytCommand, sid, writer);
                },
            },
            {
                name: 'conversational',
                priority: 75,
                match: (msg) => this.isConversational(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    log.info('[CortexRouter] Conversational → monolithic');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'social_media',
                priority: 70,
                match: (msg) => this.parseSocialMediaTask(msg),
                execute: async (socialTask, sessionId, _message, writer) => {
                    log.info(`[CortexRouter] Social media: ${socialTask.platform}/${socialTask.action}`);
                    const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                    writer.writeEvent('session_id', { sessionId: sid });
                    return this.executeSocialMedia(socialTask, sid, writer);
                },
            },
            {
                name: 'browser_navigation',
                priority: 65,
                match: (msg) => this.isBrowserNavigation(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    log.info('[CortexRouter] Browser navigation → monolithic orchestrator');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'client_context',
                priority: 60,
                match: (msg) => this.isClientContextQuery(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    log.info('[CortexRouter] Client context query detected');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'scheduling',
                priority: 55,
                match: (msg) => this.isSchedulingIntent(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    log.info('[CortexRouter] Scheduling intent → monolithic orchestrator');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'cortex_planning',
                priority: 50,
                // DISABLED: 27-agent system cannot execute — EventBus not wired,
                // agents have no DesktopBrowserAdapter access. All unmatched messages
                // go straight to monolithic orchestrator via chat() default path.
                // TODO: Re-enable when 27-agent EventBus request/response + DesktopBrowserAdapter is wired.
                // See: agents/event-bus.ts, agents/index.ts, agents/tier0-orchestration.ts
                match: () => false,
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
        ];
        // Sort by priority (highest first)
        return routes.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Register an external route candidate (e.g., from a plugin).
     */
    addRoute(route) {
        this.routes.push(route);
        this.routes.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Main entry point — routes user messages to the best backend.
     * Iterates through priority-sorted route candidates until one matches.
     */
    async chat(sessionId, message, writer, context, pageContext) {
        const msg = message.trim();
        const routeStartMs = Date.now();
        for (const route of this.routes) {
            const matchData = route.match(msg);
            if (matchData) {
                const routeMs = Date.now() - routeStartMs;
                this._lastRouteDecision = { route: route.name, priority: route.priority, message: msg.slice(0, 80), routeMs, timestamp: Date.now() };
                log.info(`[CortexRouter] ROUTE: ${route.name} (p${route.priority}) matched in ${routeMs}ms — "${msg.slice(0, 60)}"`);
                return route.execute(matchData, sessionId, message, writer, context, pageContext);
            }
        }
        // No route matched — fall through to monolithic orchestrator
        const routeMs = Date.now() - routeStartMs;
        this._lastRouteDecision = { route: 'default_fallback', priority: 0, message: msg.slice(0, 80), routeMs, timestamp: Date.now() };
        log.info(`[CortexRouter] ROUTE: default_fallback (no match) in ${routeMs}ms — "${msg.slice(0, 60)}"`);
        return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
    }
    /** Last routing decision — exposed for diagnostics */
    get lastRouteDecision() {
        return this._lastRouteDecision;
    }
    // ==========================================================================
    // INTENT CLASSIFICATION (regex, no LLM)
    // ==========================================================================
    isCopyrightWorkflow(msg) {
        return /erase.*claim|solve.*claim|process.*video|copyright.*claim|remove.*claim/i.test(msg);
    }
    isConversational(msg) {
        // Questions about current state, status, identity, capabilities
        if (/\b(?:what|where|which)\b.*\b(?:page|tab|site|url|am i|are you|is this)\b/i.test(msg))
            return true;
        // Greetings and pleasantries
        if (/^(?:hi|hello|hey|thanks|thank you|good (?:morning|afternoon|evening)|how are you)\b/i.test(msg))
            return true;
        // Meta/help questions
        if (/\b(?:what can you|how do(?:es)? (?:this|you)|help me|are you (?:working|alive|there))\b/i.test(msg))
            return true;
        // Short questions (under 6 words, ends with ?)
        if (msg.endsWith('?') && msg.split(/\s+/).length <= 6)
            return true;
        return false;
    }
    isSchedulingIntent(msg) {
        // Schedule/cancel scheduling messages → monolithic orchestrator (has schedule_post tool)
        // Without this, scheduling falls to cortex_planning DAG which can't use schedule_post
        return /\b(?:schedule|scheduled|cancel.*(?:task|schedule)|get.*scheduled|show.*scheduled|list.*scheduled|how many.*(?:task|schedule))\b/i.test(msg);
    }
    isBrowserNavigation(msg) {
        // Browser navigation intent → monolithic orchestrator (has navigate, create_tab tools)
        // Catches multi-platform ("open linkedin, facebook and twitter") and alternative verbs
        // ("take me to", "visit", "log in to") that parseSimpleCommand() can't handle
        if (!/\b(?:open|go\s+to|navigate|visit|take\s+me\s+to|show\s+me|launch|pull\s+up|log\s*(?:in|on)\s+to|sign\s+in\s+to)\b/i.test(msg))
            return false;
        // Must mention a known site/platform
        const siteKeywords = Object.keys(KNOWN_SITES).join('|');
        if (!new RegExp(`\\b(?:${siteKeywords})\\b`, 'i').test(msg))
            return false;
        // NOT a social media action (those route to social_media bridge)
        if (/\b(?:post|tweet|share|publish|comment|reply|like|follow|dm|message)\b/i.test(msg))
            return false;
        return true;
    }
    isClientContextQuery(msg) {
        return /\b(brand voice|target audience|our audience|our customers|our strategy|content calendar|business profile|our products|our services|search.*(?:docs|documents|knowledge|vault)|who (?:are|is) (?:our|my) (?:target|audience|customer)|what(?:'s| is) our (?:brand|voice|tone|strategy))\b/i.test(msg);
    }
    parseSimpleCommand(msg) {
        // Navigate with explicit URL: "navigate to https://..."
        const navUrlMatch = msg.match(/^(?:navigate|go|open)\s+(?:to\s+)?(https?:\/\/\S+)$/i);
        if (navUrlMatch) {
            return { agent: 'THE_NAVIGATOR', action: 'navigate', params: { url: navUrlMatch[1] } };
        }
        // Navigate with multi-word site name: "go to youtube studio"
        const navSiteMatch = msg.match(/^(?:navigate|go|open)\s+(?:to\s+)?(.+)$/i);
        if (navSiteMatch) {
            const url = this.resolveUrl(navSiteMatch[1].trim());
            if (url)
                return { agent: 'THE_NAVIGATOR', action: 'navigate', params: { url } };
            // No URL resolved → fall through to Cortex (not a simple command)
        }
        // Screenshot
        if (/^take\s+(?:a\s+)?screenshot$/i.test(msg)) {
            return { agent: 'THE_VISION_ANALYZER', action: 'screenshot', params: {} };
        }
        // Scroll
        const scrollMatch = msg.match(/^scroll\s+(up|down)(?:\s+(\d+))?$/i);
        if (scrollMatch) {
            return {
                agent: 'THE_SCROLLER',
                action: 'scroll',
                params: {
                    direction: scrollMatch[1].toLowerCase(),
                    amount: parseInt(scrollMatch[2] || '500', 10),
                },
            };
        }
        // Go back / go forward
        if (/^go\s+back$/i.test(msg)) {
            return { agent: 'THE_NAVIGATOR', action: 'goBack', params: {} };
        }
        if (/^go\s+forward$/i.test(msg)) {
            return { agent: 'THE_NAVIGATOR', action: 'goForward', params: {} };
        }
        return null; // Not a simple command → continue to Cortex
    }
    parseYouTubeAPICommand(msg) {
        if (!this.youtubeBridge)
            return null;
        const lower = msg.toLowerCase();
        // Must mention youtube/channel/video/playlist/comment context
        if (!/youtube|channel|video|playlist|subscriber|comment/i.test(lower))
            return null;
        // "show me my channel" / "my youtube channel"
        if (/my\s+(?:youtube\s+)?channel/i.test(lower))
            return { tool: 'youtube_get_my_channel', args: {} };
        // "search youtube for X"
        const searchMatch = msg.match(/search\s+(?:youtube\s+)?(?:for\s+)?(.+)/i);
        if (searchMatch)
            return { tool: 'youtube_search', args: { query: searchMatch[1].trim(), max_results: 10 } };
        // "get video <ID>" or "video details for <ID>"
        const videoMatch = msg.match(/(?:get|show|details)\s+(?:for\s+)?video\s+([a-zA-Z0-9_-]{11})/i);
        if (videoMatch)
            return { tool: 'youtube_get_video', args: { video_id: videoMatch[1] } };
        // "list my playlists"
        if (/list\s+(?:my\s+)?playlists/i.test(lower))
            return { tool: 'youtube_list_my_playlists', args: {} };
        // "list comments on <videoId>"
        const commentsMatch = msg.match(/(?:list|show|read)\s+comments\s+(?:on|for)\s+(?:video\s+)?([a-zA-Z0-9_-]{11})/i);
        if (commentsMatch)
            return { tool: 'youtube_list_comments', args: { video_id: commentsMatch[1] } };
        return null; // Not a recognized YouTube API command
    }
    parseSocialMediaTask(msg) {
        if (!this.socialBridge)
            return null;
        const lower = msg.toLowerCase();
        // Phase 1: Platform detection
        const platformMap = {
            twitter: 'twitter', tweet: 'twitter', x: 'twitter',
            linkedin: 'linkedin',
            instagram: 'instagram', ig: 'instagram', insta: 'instagram',
            facebook: 'facebook', fb: 'facebook',
            tiktok: 'tiktok',
            pinterest: 'pinterest',
            google: 'google',
        };
        let platform = null;
        for (const [keyword, p] of Object.entries(platformMap)) {
            // Use word boundary for short keywords to avoid false positives
            // e.g. "x" must not match "explain", "ig" must not match "big"
            const regex = keyword.length <= 2
                ? new RegExp(`\\b${keyword}\\b`, 'i')
                : new RegExp(keyword, 'i');
            if (regex.test(lower)) {
                platform = p;
                break;
            }
        }
        if (!platform)
            return null;
        // Draft/write/compose/create/schedule WITHOUT explicit "and post now/publish now"
        // should NOT route to social media bridge — let orchestrator handle it
        // "schedule" uses schedule_post tool (not browser automation)
        // "draft/write/compose/create" shows content to user first
        if (/\b(?:draft|write|compose|create|schedule)\b/i.test(msg)) {
            return null;
        }
        // Phase 2: Action detection
        const actionPatterns = [
            [/\b(?:post|tweet|share|publish)\b/i, 'post'],
            [/\b(?:comment|reply)\b/i, 'comment'],
            [/\b(?:like|heart|upvote)\b/i, 'like'],
            [/\b(?:follow|subscribe)\b/i, 'follow'],
            [/\b(?:dm|message|direct message)\b/i, 'dm'],
            [/\b(?:search|find|look for)\b/i, 'search'],
            [/\b(?:scrape|extract|crawl)\b/i, 'scrape'],
        ];
        let action = null;
        for (const [pattern, a] of actionPatterns) {
            if (pattern.test(msg)) {
                action = a;
                break;
            }
        }
        // Require explicit action verb — platform mention alone is not enough
        // "go to instagram" should navigate, not become instagram/post
        if (!action)
            return null;
        // Phase 3: Content extraction
        let content;
        let generateContent = false;
        let contentTopic;
        let contentTone;
        // Quoted content: "Hello world" or 'Hello world'
        const quotedMatch = msg.match(/['""]([^'""]+)['""]/) || msg.match(/'([^']+)'/);
        if (quotedMatch) {
            content = quotedMatch[1];
        }
        // "about X" topic extraction (only if no quoted content)
        if (!content) {
            const aboutMatch = msg.match(/\babout\s+(.+?)(?:\s+on\s+\w+|\s+to\s+\w+|$)/i);
            if (aboutMatch) {
                contentTopic = aboutMatch[1].trim();
                generateContent = true;
            }
        }
        // Tone detection
        const toneMatch = msg.match(/\b(?:in\s+(?:a\s+)?)?(professional|casual|humorous|formal|friendly|serious|witty)\s+(?:tone|style|way)\b/i);
        if (toneMatch)
            contentTone = toneMatch[1].toLowerCase();
        // Phase 4: URL extraction
        let targetUrl;
        const urlMatch = msg.match(/(https?:\/\/\S+)/i);
        if (urlMatch)
            targetUrl = urlMatch[1];
        // Hashtag extraction
        const hashtags = msg.match(/#\w+/g) || undefined;
        // Mention extraction
        const mentions = msg.match(/@\w+/g) || undefined;
        // Build custom instructions for content generation
        let customInstructions;
        if (generateContent && contentTopic) {
            customInstructions = `Generate engaging content about: ${contentTopic}`;
            if (contentTone)
                customInstructions += `. Tone: ${contentTone}`;
        }
        return {
            platform,
            action,
            content,
            targetUrl,
            hashtags: hashtags || undefined,
            mentions: mentions || undefined,
            generateContent,
            contentTopic,
            contentTone,
            customInstructions,
        };
    }
    resolveUrl(input) {
        // Already a URL
        if (/^https?:\/\//i.test(input))
            return input;
        // Known site names — direct match
        const lower = input.toLowerCase();
        for (const [name, url] of Object.entries(KNOWN_SITES)) {
            if (lower === name)
                return url;
        }
        // Strip noise words and retry: "my linkedin" → "linkedin", "the facebook" → "facebook"
        const stripped = lower.replace(/\b(?:my|our|the|please|a)\b/g, '').trim().replace(/\s+/g, ' ');
        if (stripped !== lower) {
            for (const [name, url] of Object.entries(KNOWN_SITES)) {
                if (stripped === name)
                    return url;
            }
        }
        // Looks like a domain (e.g. "google.com")
        if (/^[\w-]+\.\w{2,}/.test(input)) {
            return `https://${input}`;
        }
        return null;
    }
    // ==========================================================================
    // SIMPLE COMMAND EXECUTION (EventBus → routeRequest → CDP)
    // ==========================================================================
    async executeSimpleCommand(action, sessionId, writer) {
        const eventBus = (0, event_bus_1.getEventBus)();
        const toolName = `${action.agent}.${action.action}`;
        writer.writeEvent('tool_start', { id: '1', name: toolName });
        writer.writeEvent('tool_executing', { id: '1', name: toolName, input: action.params });
        let success = false;
        let resultStr = '';
        let errorMsg = '';
        try {
            const startMs = Date.now();
            // Dispatch to agent via EventBus → ChromadonAgentSystem.routeRequest() → CDP
            const result = await eventBus.request(action.agent, // AgentName union — target agent
            'THE_CORTEX', // Source: acting on behalf of TheCortex
            action.action, action.params, { timeoutMs: 30_000 });
            const durationMs = Date.now() - startMs;
            success = true;
            resultStr = JSON.stringify(result).slice(0, 500);
            writer.writeEvent('tool_result', {
                id: '1',
                name: toolName,
                success: true,
                result: resultStr,
                durationMs,
            });
        }
        catch (error) {
            errorMsg = error.message;
            writer.writeEvent('tool_result', {
                id: '1',
                name: toolName,
                success: false,
                error: errorMsg,
                durationMs: 0,
            });
        }
        const summary = success
            ? `${action.action} completed successfully.`
            : `${action.action} failed: ${errorMsg}`;
        writer.writeEvent('text_delta', { text: summary });
        writer.writeEvent('done', { apiCalls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 });
    }
    // ==========================================================================
    // YOUTUBE API EXECUTION (YouTubeToolBridge → direct API call)
    // ==========================================================================
    async executeYouTubeAPI(cmd, sessionId, writer) {
        writer.writeEvent('tool_start', { id: '1', name: cmd.tool });
        writer.writeEvent('tool_executing', { id: '1', name: cmd.tool, input: cmd.args });
        let success = false;
        let errorMsg = '';
        try {
            const startMs = Date.now();
            const result = await this.youtubeBridge.call(cmd.tool, cmd.args);
            const durationMs = Date.now() - startMs;
            success = true;
            writer.writeEvent('tool_result', {
                id: '1',
                name: cmd.tool,
                success: true,
                result: JSON.stringify(result).slice(0, 2000),
                durationMs,
            });
        }
        catch (error) {
            errorMsg = error.message;
            writer.writeEvent('tool_result', {
                id: '1',
                name: cmd.tool,
                success: false,
                error: errorMsg,
                durationMs: 0,
            });
        }
        const summary = success
            ? `${cmd.tool} completed successfully.`
            : `${cmd.tool} failed: ${errorMsg}`;
        writer.writeEvent('text_delta', { text: summary });
        writer.writeEvent('done', { apiCalls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 });
    }
    // ==========================================================================
    // SOCIAL MEDIA EXECUTION (SocialMediaToolBridge → SocialOverlord)
    // ==========================================================================
    async executeSocialMedia(task, sessionId, writer) {
        // If content should be generated but wasn't provided, set action to 'custom'
        // so SocialOverlord uses custom instructions for content generation
        if (task.generateContent && !task.content && task.customInstructions) {
            task.action = 'custom';
        }
        try {
            const result = await this.socialBridge.executeStreaming(task, writer);
            if (!result.success) {
                writer.writeEvent('text_delta', { text: `Social media task failed: ${result.error || 'Unknown error'}` });
            }
        }
        catch (error) {
            writer.writeEvent('text_delta', { text: `Social media error: ${error.message}` });
        }
        writer.writeEvent('done', { apiCalls: 1, inputTokens: 0, outputTokens: 0, costUSD: 0 });
    }
    // ==========================================================================
    // DAG EXECUTION (TheTemporalSequencer → per-step SSE events)
    // ==========================================================================
    async executeDAG(dag, sessionId, writer) {
        let stepCount = 0;
        let failedStep = null;
        for await (const step of this.sequencer.execute(dag)) {
            stepCount++;
            const toolName = `${step.agent}.${step.action}`;
            writer.writeEvent('tool_start', { id: step.nodeId, name: toolName });
            writer.writeEvent('tool_result', {
                id: step.nodeId,
                name: toolName,
                success: step.success,
                result: step.data ? JSON.stringify(step.data).slice(0, 500) : undefined,
                error: step.error?.message,
                durationMs: step.durationMs,
            });
            if (!step.success) {
                failedStep = `${toolName}: ${step.error?.message || 'unknown error'}`;
            }
        }
        // Only write completion events if steps actually ran (caller handles 0-step fallback)
        if (stepCount > 0) {
            if (failedStep) {
                writer.writeEvent('text_delta', { text: `Completed ${stepCount} steps with errors: ${failedStep}` });
            }
            else {
                writer.writeEvent('text_delta', { text: `Completed ${stepCount} step${stepCount !== 1 ? 's' : ''} successfully.` });
            }
            writer.writeEvent('done', {
                apiCalls: 1,
                inputTokens: 0,
                outputTokens: 0,
                costUSD: 0,
            });
        }
        return stepCount;
    }
}
exports.CortexRouter = CortexRouter;
//# sourceMappingURL=cortex-router.js.map