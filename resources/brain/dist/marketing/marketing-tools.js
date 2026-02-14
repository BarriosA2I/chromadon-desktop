"use strict";
/**
 * Marketing Queue - Claude Tool Definitions
 *
 * 2 tools in Anthropic Tool[] schema format for scheduling and
 * querying marketing tasks via conversational AI chat.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKETING_TOOLS = void 0;
exports.MARKETING_TOOLS = [
    {
        name: 'schedule_post',
        description: 'Schedule a social media post for future execution, or add it to the queue for immediate execution. Use this when the user wants to post content to social media at a specific time, or right now. Supports multiple platforms at once for cross-posting.',
        input_schema: {
            type: 'object',
            properties: {
                platforms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    },
                    description: 'Platforms to post on (can be multiple for cross-posting)',
                },
                content: {
                    type: 'string',
                    description: 'The post content/text',
                },
                action: {
                    type: 'string',
                    enum: ['post', 'comment', 'like', 'follow', 'custom'],
                    description: 'Action type (default: post)',
                },
                scheduled_time: {
                    type: 'string',
                    description: 'ISO 8601 datetime for when to post. Do NOT include this field at all for immediate execution — only provide it when the user specifies a future time. Convert natural language times to ISO 8601 (e.g. "tomorrow 9am" becomes the appropriate ISO datetime).',
                },
                recurrence: {
                    type: 'string',
                    enum: ['none', 'daily', 'weekly'],
                    description: 'Repeat schedule (default: none)',
                },
                priority: {
                    type: 'number',
                    description: 'Priority 0-10, higher = first (default: 5)',
                },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Hashtags to include',
                },
                target_url: {
                    type: 'string',
                    description: 'Target URL for comments/likes/follows',
                },
                media_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Local file paths of images or videos to upload with the post. Provide absolute paths (e.g. "G:\\My Drive\\Logo\\image.jfif"). Supported: JPEG, PNG, GIF, WebP, MP4, WebM.',
                },
            },
            required: ['platforms', 'content'],
        },
    },
    {
        name: 'get_scheduled_posts',
        description: 'Get the current marketing queue showing scheduled, queued, running, and completed tasks. Use when the user asks about their scheduled posts, marketing queue status, or upcoming tasks.',
        input_schema: {
            type: 'object',
            properties: {
                status_filter: {
                    type: 'string',
                    enum: ['all', 'scheduled', 'queued', 'running', 'completed', 'failed'],
                    description: 'Filter by task status (default: all)',
                },
                platform_filter: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Filter by platform (optional)',
                },
            },
        },
    },
    // =========================================================================
    // MARKETING AUTOMATION TOOLS (v1.4.0)
    // =========================================================================
    {
        name: 'content_calendar',
        description: 'View the content calendar showing upcoming scheduled posts and recently completed posts across all platforms. Use when the user asks about their content schedule, upcoming posts, or recent posting history.',
        input_schema: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Number of days to look back for completed posts (default: 7)',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Filter by platform (optional)',
                },
            },
        },
    },
    {
        name: 'repurpose_content',
        description: 'Get platform-specific formatting guidelines to adapt content from one platform to another. Returns character limits, best practices, and style rules for each target platform so you can rewrite the content appropriately.',
        input_schema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'The original post content to repurpose',
                },
                source_platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Platform the content was originally written for',
                },
                target_platforms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    },
                    description: 'Platforms to adapt the content for',
                },
            },
            required: ['content', 'source_platform', 'target_platforms'],
        },
    },
    {
        name: 'hashtag_research',
        description: 'Research the best hashtags for a topic. Returns historically best-performing hashtags from your analytics data plus platform-specific hashtag guidelines. Use when the user wants hashtag suggestions or wants to optimize their hashtag strategy.',
        input_schema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Topic or niche to research hashtags for',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Platform to optimize hashtags for (optional)',
                },
            },
            required: ['topic'],
        },
    },
    {
        name: 'engagement_report',
        description: 'Get a detailed engagement report with metrics like likes, comments, shares, engagement rates, trends, and best/worst performing posts. Use when the user asks about engagement, how their posts are doing, or wants performance insights.',
        input_schema: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Number of days to analyze (default: 30)',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Filter by specific platform (optional, default: all platforms)',
                },
            },
        },
    },
    {
        name: 'competitor_watch',
        description: 'Manage competitor tracking. Add, remove, list, or compare competitors across social media platforms. Use when the user wants to track competitors, see competitor activity, or compare their performance.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'remove', 'list', 'compare'],
                    description: 'Action to perform',
                },
                name: {
                    type: 'string',
                    description: 'Competitor name (required for add)',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Platform (required for add)',
                },
                handle: {
                    type: 'string',
                    description: 'Competitor handle/username (required for add)',
                },
                competitor_id: {
                    type: 'number',
                    description: 'Competitor ID (required for remove)',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'auto_reply',
        description: 'Manage automatic reply rules for social media comments. Set up keyword-triggered auto-replies, list existing rules, or remove rules. Use when the user wants to automate comment responses.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'remove', 'list'],
                    description: 'Action to perform',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Platform for the rule (required for add)',
                },
                trigger_type: {
                    type: 'string',
                    enum: ['keyword', 'all', 'mention', 'question'],
                    description: 'What triggers the auto-reply (default: keyword)',
                },
                trigger_value: {
                    type: 'string',
                    description: 'The keyword/phrase that triggers the reply (required for add with keyword trigger)',
                },
                reply_template: {
                    type: 'string',
                    description: 'The reply text template (required for add)',
                },
                rule_id: {
                    type: 'number',
                    description: 'Rule ID (required for remove)',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'lead_capture',
        description: 'Capture and manage potential leads from social media interactions. Add new leads, list existing leads, or update lead status. Use when the user identifies a potential client or wants to review their leads.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['add', 'list', 'update'],
                    description: 'Action to perform',
                },
                name: {
                    type: 'string',
                    description: 'Lead name (required for add)',
                },
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    description: 'Platform where lead was found (required for add)',
                },
                handle: {
                    type: 'string',
                    description: 'Lead social media handle',
                },
                interest: {
                    type: 'string',
                    description: 'What the lead is interested in',
                },
                source: {
                    type: 'string',
                    description: 'How the lead was found (e.g., "commented on AI post", "DM inquiry")',
                },
                notes: {
                    type: 'string',
                    description: 'Additional notes about the lead',
                },
                lead_id: {
                    type: 'number',
                    description: 'Lead ID (required for update)',
                },
                status: {
                    type: 'string',
                    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
                    description: 'Lead status (required for update)',
                },
                status_filter: {
                    type: 'string',
                    enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
                    description: 'Filter leads by status (for list)',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'campaign_tracker',
        description: 'Create and manage marketing campaigns. Group posts into campaigns, track campaign performance, and generate reports. Use when the user wants to organize posts into campaigns or track campaign metrics.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['create', 'list', 'add_post', 'report'],
                    description: 'Action to perform',
                },
                name: {
                    type: 'string',
                    description: 'Campaign name (required for create)',
                },
                description: {
                    type: 'string',
                    description: 'Campaign description',
                },
                platforms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'],
                    },
                    description: 'Target platforms for the campaign',
                },
                campaign_id: {
                    type: 'number',
                    description: 'Campaign ID (required for add_post, report)',
                },
                post_id: {
                    type: 'number',
                    description: 'Post ID to add to campaign (required for add_post)',
                },
                start_date: {
                    type: 'string',
                    description: 'Campaign start date (ISO 8601)',
                },
                end_date: {
                    type: 'string',
                    description: 'Campaign end date (ISO 8601)',
                },
            },
            required: ['action'],
        },
    },
];
//# sourceMappingURL=marketing-tools.js.map