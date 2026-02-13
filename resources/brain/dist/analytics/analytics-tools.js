"use strict";
/**
 * Social Media Analytics - Claude Tool Definitions
 *
 * 8 analytics tools in Anthropic Tool[] schema format.
 * These get merged with BROWSER_TOOLS in the orchestrator.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANALYTICS_TOOLS = void 0;
exports.ANALYTICS_TOOLS = [
    {
        name: 'get_analytics_overview',
        description: 'Get a cross-platform analytics overview: total followers, posts, engagement rate, impressions, top post, and platform breakdown. Use this for general "how are my analytics" questions.',
        input_schema: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Number of days to look back (default: 30)',
                },
            },
        },
    },
    {
        name: 'get_platform_analytics',
        description: 'Get detailed analytics for a specific platform: followers, growth rate, top/worst posts, engagement trends, and audience history. Use this when the user asks about a specific platform.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'The social media platform to analyze',
                },
                days: {
                    type: 'number',
                    description: 'Number of days to look back (default: 30)',
                },
            },
            required: ['platform'],
        },
    },
    {
        name: 'get_content_analytics',
        description: 'Analyze content performance: post type breakdown (text, image, video, etc.), hashtag performance, and top posts. Use this when the user wants to know what content works best.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Filter by platform (optional)',
                },
                days: {
                    type: 'number',
                    description: 'Number of days to look back (default: 30)',
                },
                post_type: {
                    type: 'string',
                    description: 'Filter by post type: text, image, video, carousel, story, reel',
                },
            },
        },
    },
    {
        name: 'get_audience_analytics',
        description: 'Get audience insights for a platform: current follower count, follower growth trend over time, demographics, and active hours. Use this for audience-related questions.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'The platform to get audience data for',
                },
                days: {
                    type: 'number',
                    description: 'Number of days to look back (default: 30)',
                },
            },
            required: ['platform'],
        },
    },
    {
        name: 'get_competitor_analytics',
        description: 'Get competitor analysis: tracked competitors, their recent posts, engagement comparison, and post frequency. Use this when the user wants competitive insights.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Filter by platform (optional)',
                },
                competitor_id: {
                    type: 'number',
                    description: 'Specific competitor ID to analyze (optional)',
                },
            },
        },
    },
    {
        name: 'get_timing_heatmap',
        description: 'Get a 7-day x 24-hour engagement heatmap showing the best and worst times to post on a platform. Use this for "when should I post" questions.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'The platform to get timing data for',
                },
            },
            required: ['platform'],
        },
    },
    {
        name: 'get_roi_analytics',
        description: 'Get ROI metrics: total engagements, cost per engagement, cost per follower, and platform-level ROI comparison. Use this for ROI and spend efficiency questions.',
        input_schema: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Number of days to look back (default: 30)',
                },
            },
        },
    },
    {
        name: 'generate_analytics_report',
        description: 'Generate a comprehensive analytics report in markdown, JSON, or summary format. Covers all platforms, engagement trends, top content, audience growth, and recommendations. Use this when the user asks for a full report.',
        input_schema: {
            type: 'object',
            properties: {
                format: {
                    type: 'string',
                    enum: ['markdown', 'json', 'summary'],
                    description: 'Report format (default: markdown)',
                },
                days: {
                    type: 'number',
                    description: 'Number of days to cover (default: 30)',
                },
                platforms: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Platforms to include (default: all)',
                },
            },
        },
    },
];
//# sourceMappingURL=analytics-tools.js.map