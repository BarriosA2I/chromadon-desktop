"use strict";
/**
 * THE_SCHEDULER — AI Chat Tool Definitions
 *
 * General-purpose scheduling: not just social posts, but ANY browser automation.
 * schedule_post is a backward-compatible alias that converts to schedule_task.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEDULER_TOOL_NAMES = exports.SCHEDULER_TOOLS = void 0;
exports.SCHEDULER_TOOLS = [
    {
        name: 'schedule_task',
        description: 'Schedule any browser automation task for future execution. Can schedule social media posts, web scraping, data collection, form filling, or any other browser action. The instruction will be executed by the AI assistant at the scheduled time — anything you can do interactively, you can schedule. Examples: "Post to Twitter: Hello!", "Scrape prices from example.com", "Check Google Ads and report metrics".',
        input_schema: {
            type: 'object',
            properties: {
                instruction: {
                    type: 'string',
                    description: 'What to do — natural language instruction that will be executed at the scheduled time. This is the exact prompt that will be sent to the AI assistant.',
                },
                scheduled_time: {
                    type: 'string',
                    description: 'When to execute. Supports natural language ("3pm tomorrow", "next Monday at 9am", "in 2 hours") or ISO 8601 UTC.',
                },
                recurrence: {
                    type: 'string',
                    enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
                    description: 'How often to repeat. Default: none (one-time).',
                },
                recurrence_end_date: {
                    type: 'string',
                    description: 'When to stop recurring (ISO 8601). Omit for indefinite.',
                },
                task_type: {
                    type: 'string',
                    enum: ['social_post', 'browser_automation', 'scrape', 'custom'],
                    description: 'Category of task. Helps with prioritization. Default: custom.',
                },
                platforms: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'For social posts: target platforms (twitter, linkedin, facebook, youtube, instagram).',
                },
                media_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'For social posts: local file paths for images/videos to attach.',
                },
            },
            required: ['instruction', 'scheduled_time'],
        },
    },
    {
        name: 'schedule_post',
        description: 'Schedule a social media post. Shorthand for schedule_task with task_type=social_post. Builds the instruction from content + platforms automatically.',
        input_schema: {
            type: 'object',
            properties: {
                platforms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['twitter', 'linkedin', 'facebook', 'youtube', 'instagram', 'tiktok'],
                    },
                    description: 'Platforms to post on (can be multiple for cross-posting)',
                },
                content: {
                    type: 'string',
                    description: 'The post content/text. Optional — if omitted, provide a topic and content will be generated at execution time.',
                },
                topic: {
                    type: 'string',
                    description: 'Topic for the post. If content is not provided, the AI will generate platform-appropriate content about this topic at execution time.',
                },
                scheduled_time: {
                    type: 'string',
                    description: 'When to post. Supports natural language ("3pm tomorrow", "next Monday at 9am") or ISO 8601 UTC. Omit for immediate execution.',
                },
                recurrence: {
                    type: 'string',
                    enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
                    description: 'Repeat schedule (default: none)',
                },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Hashtags to include',
                },
                media_urls: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Local file paths of images or videos to upload. Provide absolute paths (e.g. "G:\\\\My Drive\\\\Logo\\\\image.jfif").',
                },
            },
            required: ['platforms'],
        },
    },
    {
        name: 'get_scheduled_tasks',
        description: 'List all scheduled tasks with status. Shows ALL scheduled tasks: posts, scrapes, browser automations, etc. Returns a summary grouped by status.',
        input_schema: {
            type: 'object',
            properties: {
                status_filter: {
                    type: 'string',
                    enum: ['all', 'scheduled', 'completed', 'failed', 'cancelled'],
                    description: 'Filter by status (default: all)',
                },
                task_type: {
                    type: 'string',
                    enum: ['social_post', 'browser_automation', 'scrape', 'custom', 'all'],
                    description: 'Filter by task type (default: all)',
                },
            },
        },
    },
    {
        name: 'cancel_scheduled_task',
        description: 'Cancel a scheduled task by ID. Cannot cancel tasks currently executing.',
        input_schema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'string',
                    description: 'The task ID to cancel',
                },
            },
            required: ['task_id'],
        },
    },
    {
        name: 'reschedule_task',
        description: 'Change the time of a scheduled task. Only works on tasks in "scheduled" status.',
        input_schema: {
            type: 'object',
            properties: {
                task_id: {
                    type: 'string',
                    description: 'The task ID to reschedule',
                },
                new_time: {
                    type: 'string',
                    description: 'New time — natural language ("3pm tomorrow") or ISO 8601 UTC.',
                },
            },
            required: ['task_id', 'new_time'],
        },
    },
];
/** Tool names for routing in server.ts */
exports.SCHEDULER_TOOL_NAMES = new Set(exports.SCHEDULER_TOOLS.map(t => t.name));
//# sourceMappingURL=scheduler-tools.js.map