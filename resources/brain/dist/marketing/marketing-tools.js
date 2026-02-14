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
];
//# sourceMappingURL=marketing-tools.js.map