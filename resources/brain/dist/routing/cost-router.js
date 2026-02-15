"use strict";
/**
 * CHROMADON Cost Router
 * =====================
 * Zero-latency keyword-based classifier that routes tasks to the cheapest
 * capable Gemini model. No LLM calls — pure regex matching.
 *
 * Tier distribution target:
 *   FAST      70% of traffic  ($0.10/M input)  — browser actions
 *   BALANCED  25% of traffic  ($0.30/M input)  — analysis, content
 *   REASONING  5% of traffic  ($1.25/M input)  — strategy, planning
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldUseCompactPrompt = exports.selectModelForTask = exports.resolveModel = exports.ModelTier = void 0;
var ModelTier;
(function (ModelTier) {
    ModelTier["FAST"] = "gemini-2.0-flash";
    ModelTier["BALANCED"] = "gemini-2.5-flash";
    ModelTier["REASONING"] = "gemini-2.5-pro";
})(ModelTier || (exports.ModelTier = ModelTier = {}));
/**
 * Get the actual model ID, resolving env overrides.
 * Allows overriding via LLM_MODEL env var for when gemini-2.0-flash
 * isn't available (e.g. free tier with zero quota).
 */
function resolveModel(tier) {
    const override = process.env.LLM_MODEL;
    // If an override is set and the tier is FAST, use the override
    // (users on free tier can set LLM_MODEL=gemini-2.5-flash to avoid 2.0 quota issues)
    if (override && tier === ModelTier.FAST) {
        return override;
    }
    return tier;
}
exports.resolveModel = resolveModel;
/**
 * Select the cheapest model capable of handling the task.
 *
 * @param userMessage - The user's chat message
 * @param lastToolName - The last tool that was called (for continuation routing)
 * @returns The model ID to use
 */
function selectModelForTask(userMessage, lastToolName) {
    const input = (userMessage + ' ' + (lastToolName || '')).toLowerCase();
    // FAST: Browser automation actions (click, navigate, type, etc.)
    // These are simple tool-call tasks — the AI just needs to pick the right tool
    if (input.match(/\b(click|scroll|navigate|go to|open|type|enter|press|wait|sleep|close tab)\b/) ||
        input.match(/\b(extract|get text|find element|selector|css|xpath|screenshot)\b/) ||
        input.match(/\b(what.*page|what.*see|where am i|current page|take a)\b/) ||
        input.match(/\b(switch tab|list tabs|new tab|create tab)\b/) ||
        input.match(/\b(done|continue|resume|next|yes|ok|confirm)\b/)) {
        return ModelTier.FAST;
    }
    // FAST: Marketing queue queries — simple tool calls that retrieve and display data
    if (input.match(/\b(scheduled|schedule|queue|calendar)\b.*\b(post|posts|status|show|list|all)\b/) ||
        input.match(/\b(show|list|get|check)\b.*\b(scheduled|queue|posts|calendar)\b/)) {
        return ModelTier.FAST;
    }
    // FAST: Continuation loops — when the AI is in a tool-use loop,
    // the "user" messages are just tool results, not new instructions.
    // After tool execution, the AI just needs to present results — no thinking needed.
    if (lastToolName && [
        'click', 'navigate', 'scroll', 'type_text', 'wait', 'extract_text',
        'get_page_context', 'get_interactive_elements', 'hover', 'press_key',
        'hover_and_click', 'click_table_row', 'create_tab', 'switch_tab',
        'list_tabs', 'close_tab', 'upload_file', 'select_option',
        'get_video_ids', 'check_page_health', 'wait_for_result',
        // Marketing & scheduling tools — result presentation only
        'schedule_post', 'get_scheduled_posts', 'content_calendar',
        'repurpose_content', 'hashtag_research', 'engagement_report',
        'competitor_watch', 'auto_reply', 'lead_capture', 'campaign_tracker',
        // YouTube Studio tools
        'video_analytics', 'comment_manager', 'seo_optimizer',
        'thumbnail_test', 'community_post', 'revenue_report',
        'playlist_manager', 'upload_scheduler',
    ].includes(lastToolName)) {
        return ModelTier.FAST;
    }
    // REASONING: Complex multi-step tasks requiring deep thinking
    if (input.match(/\b(strategy|plan|analyze.*and.*create|campaign|optimize)\b/) ||
        input.match(/\b(write.*comprehensive|compare.*and.*recommend|research)\b/) ||
        input.match(/\b(design|architect|evaluate|audit|review.*and)\b/) ||
        input.match(/\b(multi.?step|complex|workflow|erase.*all.*copyright)\b/)) {
        return ModelTier.REASONING;
    }
    // BALANCED: Everything else — content creation, analysis, Q&A
    return ModelTier.BALANCED;
}
exports.selectModelForTask = selectModelForTask;
/**
 * Determine whether to use the compact or full system prompt.
 * FAST tasks don't need the 40K token prompt — a 500 token version works.
 */
function shouldUseCompactPrompt(tier) {
    return tier === ModelTier.FAST;
}
exports.shouldUseCompactPrompt = shouldUseCompactPrompt;
//# sourceMappingURL=cost-router.js.map