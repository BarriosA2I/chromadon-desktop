"use strict";
/**
 * Trinity Intelligence Tools — AI Chat Tool Definitions
 *
 * 3 market intelligence tools for on-demand analysis:
 *   analyze_competitors    — vault-powered competitor positioning analysis
 *   get_trending_topics    — industry trend detection from vault data
 *   get_audience_insights  — audience profile from vault + client onboarding
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRINITY_INTELLIGENCE_TOOL_NAMES = exports.TRINITY_INTELLIGENCE_TOOLS = void 0;
// ============================================================================
// TOOL DEFINITIONS
// ============================================================================
exports.TRINITY_INTELLIGENCE_TOOLS = [
    {
        name: 'analyze_competitors',
        description: 'Search the knowledge vault for competitor content, pricing, and positioning insights. Returns relevant vault chunks about competitors in the client\'s industry. Best used after research_website has been used to learn competitor websites.',
        input_schema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Topic or competitor name to analyze (e.g., "AI automation", "social media management tools")',
                },
                platform: {
                    type: 'string',
                    description: 'Social platform context for competitive analysis (e.g., "linkedin", "twitter")',
                },
            },
            required: ['topic'],
        },
    },
    {
        name: 'get_trending_topics',
        description: 'Find industry trends relevant to the client\'s business by searching the knowledge vault. Returns trend data, news, and content themes from stored vault documents.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    description: 'Social platform to find trends for (e.g., "linkedin", "twitter"). Defaults to general trends.',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_audience_insights',
        description: 'Build a comprehensive audience profile from the knowledge vault and client onboarding data. Returns target audiences, brand voice, products, services, and USPs.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    description: 'Social platform for audience context (e.g., "linkedin", "twitter"). Defaults to general audience.',
                },
            },
            required: [],
        },
    },
];
exports.TRINITY_INTELLIGENCE_TOOL_NAMES = new Set(exports.TRINITY_INTELLIGENCE_TOOLS.map(t => t.name));
//# sourceMappingURL=trinity-tools-intelligence.js.map