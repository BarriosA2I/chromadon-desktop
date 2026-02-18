"use strict";
/**
 * MISSION TEMPLATES — Tool Definitions
 *
 * 4 tools for the mission template system.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEMPLATE_TOOL_NAMES = exports.TEMPLATE_TOOLS = void 0;
exports.TEMPLATE_TOOLS = [
    {
        name: 'mission_list_templates',
        description: 'List available mission templates. Optionally filter by category. ' +
            'Call this when the user asks "what can you do?", "help me get started", or wants to see available automations.',
        input_schema: {
            type: 'object',
            properties: {
                category: {
                    type: 'string',
                    enum: ['social', 'ecommerce', 'content', 'research', 'monitoring', 'all'],
                    description: 'Filter by category (default: all)',
                },
            },
            required: [],
        },
    },
    {
        name: 'mission_from_template',
        description: 'Create and execute a mission from a template. Substitute variables and optionally schedule for later. ' +
            'If no scheduled_time is provided, returns the hydrated prompt for immediate execution.',
        input_schema: {
            type: 'object',
            properties: {
                template_id: {
                    type: 'string',
                    description: 'Template ID (e.g., "social-post-all", "shopify-order-summary")',
                },
                variables: {
                    type: 'object',
                    description: 'Template variables as key-value pairs (e.g., {"postContent": "Hello world!", "topic": "AI"})',
                },
                scheduled_time: {
                    type: 'string',
                    description: 'Optional: schedule for later execution. Supports natural language ("3pm tomorrow") or ISO 8601. If omitted, returns prompt for immediate execution.',
                },
                recurrence: {
                    type: 'string',
                    enum: ['none', 'daily', 'weekly', 'biweekly', 'monthly'],
                    description: 'Optional: repeat schedule (default: none)',
                },
            },
            required: ['template_id'],
        },
    },
    {
        name: 'mission_get_template',
        description: 'Get full details of a specific template including variables, description, and suggested schedule.',
        input_schema: {
            type: 'object',
            properties: {
                template_id: {
                    type: 'string',
                    description: 'Template ID to look up',
                },
            },
            required: ['template_id'],
        },
    },
    {
        name: 'mission_suggest_templates',
        description: 'Suggest relevant templates based on what the user wants to accomplish. ' +
            'Uses keyword matching against template names, descriptions, and tags. Returns top 3 matches.',
        input_schema: {
            type: 'object',
            properties: {
                user_message: {
                    type: 'string',
                    description: 'What the user wants to accomplish',
                },
            },
            required: ['user_message'],
        },
    },
];
exports.TEMPLATE_TOOL_NAMES = new Set(exports.TEMPLATE_TOOLS.map(t => t.name));
//# sourceMappingURL=template-tools.js.map