"use strict";
/**
 * Client Context Tools — Anthropic Tool Definitions for 27-Agent System
 *
 * These tools let any of the 27 agents access client business context:
 * profile, brand voice, knowledge vault, and growth strategy.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_CONTEXT_TOOLS = void 0;
// ============================================================================
// TOOL DEFINITIONS
// ============================================================================
exports.CLIENT_CONTEXT_TOOLS = [
    {
        name: 'client_get_profile',
        description: 'Get the active client\'s business profile including business name, industry, products, services, goals, and challenges. Use this before creating any content to understand who the client is.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'client_get_voice',
        description: 'Get the active client\'s brand voice profile including tone, personality, formality level, emoji usage, and words to avoid. ALWAYS call this before writing any content (social posts, emails, ads, etc.) to match the client\'s voice.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'client_search_knowledge',
        description: 'Search the active client\'s document knowledge vault for relevant information. Use this to find specific details about products, services, pricing, or any business data the client has uploaded.',
        input_schema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to find relevant knowledge chunks',
                },
                topK: {
                    type: 'number',
                    description: 'Number of results to return (default: 5)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'client_get_strategy',
        description: 'Get the active client\'s growth strategy including channel strategies, content calendar, success metrics, and goals. Use this to align actions with the overall strategy.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'client_get_media',
        description: 'Get the active client\'s brand assets (logos, images, videos) for social media posts. Returns file paths to use with upload_file tool. Call this before scheduling or posting to use the client\'s own branding instead of defaults.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'client_save_info',
        description: 'Save business information mentioned by the user in conversation. Call this when the user mentions their business name, industry, products, services, target audience, or any other business detail. This persists the information so it is available in future sessions.',
        input_schema: {
            type: 'object',
            properties: {
                field: {
                    type: 'string',
                    enum: ['businessName', 'industry', 'products', 'services', 'goals', 'location', 'website', 'missionStatement'],
                    description: 'Which profile field to update',
                },
                value: {
                    type: 'string',
                    description: 'The value to save',
                },
            },
            required: ['field', 'value'],
        },
    },
];
//# sourceMappingURL=context-tools.js.map