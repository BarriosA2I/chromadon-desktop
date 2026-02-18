"use strict";
/**
 * ACTIVITY LOG — Tool Definitions
 *
 * 3 tools for the daily activity journal system.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVITY_TOOL_NAMES = exports.ACTIVITY_TOOLS = void 0;
exports.ACTIVITY_TOOLS = [
    {
        name: 'activity_log',
        description: 'Log an activity to the daily activity journal. Call this after completing significant actions ' +
            '(posting, scheduling, researching, completing tasks, navigating to complete a task). ' +
            'Do NOT log trivial actions like individual clicks, scrolls, or get_page_context calls.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'Action category. Examples: post_published, post_scheduled, navigation_complete, ' +
                        'skill_learned, skill_drift_detected, mission_completed, mission_failed, ' +
                        'research_complete, verification_passed, verification_failed, policy_blocked, error',
                },
                details: {
                    type: 'string',
                    description: 'Human-readable description of what happened. Example: "Posted to Instagram about summer sale"',
                },
                status: {
                    type: 'string',
                    enum: ['success', 'warning', 'error', 'info'],
                    description: 'Outcome status of the activity',
                },
                tool_name: {
                    type: 'string',
                    description: 'The tool that triggered this activity (optional)',
                },
                mission_id: {
                    type: 'string',
                    description: 'Associated mission ID if this is part of a mission (optional)',
                },
                platform: {
                    type: 'string',
                    description: 'Social media or web platform if applicable (optional). Examples: facebook, instagram, twitter, linkedin, shopify',
                },
                duration_ms: {
                    type: 'number',
                    description: 'Duration of the activity in milliseconds (optional)',
                },
            },
            required: ['action', 'details', 'status'],
        },
    },
    {
        name: 'activity_get_today',
        description: 'Get today\'s activity log. Returns recent activities as a timeline. ' +
            'If more than 50 entries exist, returns a compact summary instead to save context. ' +
            'Call this when the user asks "what did you do today?" or wants to see recent activity.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'activity_get_range',
        description: 'Get activity entries for a specific date range. Returns activities between start_date and end_date (inclusive). ' +
            'If more than 50 entries, returns a compact summary. ' +
            'Use this for historical activity queries like "what did you do last week?".',
        input_schema: {
            type: 'object',
            properties: {
                start_date: {
                    type: 'string',
                    description: 'Start date in YYYY-MM-DD format',
                },
                end_date: {
                    type: 'string',
                    description: 'End date in YYYY-MM-DD format',
                },
            },
            required: ['start_date', 'end_date'],
        },
    },
];
exports.ACTIVITY_TOOL_NAMES = new Set(exports.ACTIVITY_TOOLS.map(t => t.name));
//# sourceMappingURL=activity-tools.js.map