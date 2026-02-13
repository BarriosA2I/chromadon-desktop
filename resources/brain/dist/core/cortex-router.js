"use strict";
/**
 * CHROMADON CortexRouter — Agent-First Chat Routing
 * ==================================================
 * Sits between /api/orchestrator/chat and the execution backends.
 * Routes messages to the 27-agent system or the monolithic orchestrator.
 *
 * Routing priority:
 *   1. Copyright workflows → monolithic (VideoTracker + auto-continue)
 *   2. Simple commands → direct agent dispatch via EventBus (no LLM)
 *   3. YouTube API tasks → YouTubeToolBridge (no LLM, ~200ms)
 *   3.5. Social media tasks → SocialMediaToolBridge → SocialOverlord (~15-20s)
 *   4. Template/complex → TheCortex planning → DAG execution
 *   5. Fallback → monolithic orchestrator
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortexRouter = void 0;
const event_bus_1 = require("../agents/event-bus");
const uuid_1 = require("uuid");
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
                    console.log('[CortexRouter] Copyright workflow → monolithic');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'simple_command',
                priority: 90,
                match: (msg) => this.parseSimpleCommand(msg),
                execute: async (simple, sessionId, _message, writer) => {
                    console.log(`[CortexRouter] Simple command: ${simple.agent}.${simple.action} →`, simple.params);
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
                    console.log(`[CortexRouter] YouTube API: ${ytCommand.tool}`);
                    const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                    writer.writeEvent('session_id', { sessionId: sid });
                    return this.executeYouTubeAPI(ytCommand, sid, writer);
                },
            },
            {
                name: 'social_media',
                priority: 70,
                match: (msg) => this.parseSocialMediaTask(msg),
                execute: async (socialTask, sessionId, _message, writer) => {
                    console.log(`[CortexRouter] Social media: ${socialTask.platform}/${socialTask.action}`);
                    const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                    writer.writeEvent('session_id', { sessionId: sid });
                    return this.executeSocialMedia(socialTask, sid, writer);
                },
            },
            {
                name: 'client_context',
                priority: 60,
                match: (msg) => this.isClientContextQuery(msg),
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    console.log('[CortexRouter] Client context query detected');
                    return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                },
            },
            {
                name: 'cortex_planning',
                priority: 50,
                match: () => true, // Always matches as fallback
                execute: async (_m, sessionId, message, writer, context, pageContext) => {
                    const msg = message.trim();
                    try {
                        console.log(`[CortexRouter] Cortex planning for: "${msg.slice(0, 80)}"`);
                        const dag = await this.cortex.planWorkflow(msg, pageContext ? { pageContext } : undefined);
                        const sid = sessionId || `cortex-${(0, uuid_1.v4)()}`;
                        writer.writeEvent('session_id', { sessionId: sid });
                        await this.executeDAG(dag, sid, writer);
                    }
                    catch (error) {
                        console.log('[CortexRouter] Cortex planning failed, falling back to monolithic:', error.message);
                        return this.orchestrator.chat(sessionId, message, writer, context, pageContext);
                    }
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
        for (const route of this.routes) {
            const matchData = route.match(msg);
            if (matchData) {
                return route.execute(matchData, sessionId, message, writer, context, pageContext);
            }
        }
    }
    // ==========================================================================
    // INTENT CLASSIFICATION (regex, no LLM)
    // ==========================================================================
    isCopyrightWorkflow(msg) {
        return /erase.*claim|solve.*claim|process.*video|copyright.*claim|remove.*claim/i.test(msg);
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
            if (lower.includes(keyword)) {
                platform = p;
                break;
            }
        }
        if (!platform)
            return null;
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
        // YouTube guard: if platform is youtube but no social action verb detected,
        // let the YouTube API bridge or monolithic handle it
        if (platform === 'youtube' && !action)
            return null;
        // Default to 'post' if platform detected but no action verb
        if (!action)
            action = 'post';
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
        // Known site names (check longest match first)
        const lower = input.toLowerCase();
        for (const [name, url] of Object.entries(KNOWN_SITES)) {
            if (lower === name)
                return url;
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
        try {
            const startMs = Date.now();
            // Dispatch to agent via EventBus → ChromadonAgentSystem.routeRequest() → CDP
            const result = await eventBus.request(action.agent, // AgentName union — target agent
            'THE_CORTEX', // Source: acting on behalf of TheCortex
            action.action, action.params, { timeoutMs: 30_000 });
            const durationMs = Date.now() - startMs;
            writer.writeEvent('tool_result', {
                id: '1',
                name: toolName,
                success: true,
                result: JSON.stringify(result).slice(0, 500),
                durationMs,
            });
        }
        catch (error) {
            writer.writeEvent('tool_result', {
                id: '1',
                name: toolName,
                success: false,
                error: error.message,
                durationMs: 0,
            });
        }
        writer.writeEvent('text_delta', { text: 'Done.' });
        writer.writeEvent('done', { apiCalls: 0, inputTokens: 0, outputTokens: 0, costUSD: 0 });
    }
    // ==========================================================================
    // YOUTUBE API EXECUTION (YouTubeToolBridge → direct API call)
    // ==========================================================================
    async executeYouTubeAPI(cmd, sessionId, writer) {
        writer.writeEvent('tool_start', { id: '1', name: cmd.tool });
        writer.writeEvent('tool_executing', { id: '1', name: cmd.tool, input: cmd.args });
        try {
            const startMs = Date.now();
            const result = await this.youtubeBridge.call(cmd.tool, cmd.args);
            const durationMs = Date.now() - startMs;
            writer.writeEvent('tool_result', {
                id: '1',
                name: cmd.tool,
                success: true,
                result: JSON.stringify(result).slice(0, 2000),
                durationMs,
            });
        }
        catch (error) {
            writer.writeEvent('tool_result', {
                id: '1',
                name: cmd.tool,
                success: false,
                error: error.message,
                durationMs: 0,
            });
        }
        writer.writeEvent('text_delta', { text: 'Done.' });
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
                // Non-optional failures throw from the sequencer, so if we get here
                // the step was optional. Continue with remaining steps.
            }
        }
        if (failedStep) {
            writer.writeEvent('text_delta', { text: `Completed with errors: ${failedStep}` });
        }
        else {
            writer.writeEvent('text_delta', { text: 'Done.' });
        }
        writer.writeEvent('done', {
            apiCalls: 1, // TheCortex LLM call for planning
            inputTokens: 0,
            outputTokens: 0,
            costUSD: 0,
        });
    }
}
exports.CortexRouter = CortexRouter;
//# sourceMappingURL=cortex-router.js.map