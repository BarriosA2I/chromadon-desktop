"use strict";
/**
 * Social Media Monitoring - Claude Tool Definitions
 *
 * 2 tools for enabling/configuring monitoring and viewing activity log.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONITORING_TOOLS = void 0;
exports.MONITORING_TOOLS = [
    {
        name: 'social_monitor',
        description: 'Enable, disable, or configure always-on social media monitoring. When enabled, CHROMADON periodically checks all social media tabs for new comments, mentions, and notifications, and responds automatically using AI judgment and auto-reply rules.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['enable', 'disable', 'status', 'configure'],
                    description: 'Action to take on the monitor',
                },
                interval_minutes: {
                    type: 'number',
                    description: 'How often to check (default: 10 minutes). Only used with "configure" action.',
                },
                platforms: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube'],
                    },
                    description: 'Which platforms to monitor. Only used with "configure" action.',
                },
                max_replies_per_cycle: {
                    type: 'number',
                    description: 'Maximum replies to post per monitoring cycle (default: 5). Only used with "configure" action.',
                },
            },
            required: ['action'],
        },
    },
    {
        name: 'monitoring_log',
        description: 'View recent social media monitoring activity — what comments were found, which were replied to, and any errors.',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube'],
                    description: 'Filter by platform (optional — shows all if omitted)',
                },
                limit: {
                    type: 'number',
                    description: 'Number of recent entries to show (default: 20)',
                },
            },
            required: [],
        },
    },
];
//# sourceMappingURL=monitor-tools.js.map