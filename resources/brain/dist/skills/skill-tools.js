"use strict";
/**
 * Skill Memory Tool Definitions
 *
 * 7 tools in Anthropic ToolDefinition format for the Agentic Orchestrator.
 * v2.1: Added drift report, stats, rollback tools + extended existing schemas.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SKILL_TOOLS = void 0;
exports.SKILL_TOOLS = [
    {
        name: 'skills_lookup',
        description: 'Look up known skills for a website domain. Call this BEFORE attempting any task on a website to get proven action sequences and selectors. Returns the full skill including steps, selectors, rules, and reliability info.',
        input_schema: {
            type: 'object',
            properties: {
                domain: {
                    type: 'string',
                    description: "The website domain, e.g. 'www.facebook.com', 'x.com', 'admin.shopify.com'",
                },
                intent: {
                    type: 'string',
                    description: "What the user wants to do, e.g. 'create a post with an image', 'update product listing'",
                },
            },
            required: ['domain'],
        },
    },
    {
        name: 'skills_record_success',
        description: 'Record a successful task completion with the exact steps that worked. Call this after you successfully complete a task on any website. This teaches you to do it faster next time.',
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Website domain' },
                siteName: { type: 'string', description: 'Human-friendly site name' },
                taskName: { type: 'string', description: "Snake_case task name, e.g. 'create_post_with_media'" },
                description: { type: 'string', description: 'What this task does' },
                steps: {
                    type: 'array',
                    description: 'The exact action sequence that worked',
                    items: {
                        type: 'object',
                        properties: {
                            order: { type: 'number' },
                            action: { type: 'string', description: 'navigate, click, type_text, upload_file, wait, scroll, get_page_context' },
                            selectors: { type: 'array', items: { type: 'string' } },
                            params: { type: 'object' },
                            waitAfter: { type: 'number' },
                            note: { type: 'string' },
                        },
                        required: ['order', 'action'],
                    },
                },
                rules: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Important rules learned about this task',
                },
                durationMs: {
                    type: 'number',
                    description: 'How long the task took in milliseconds (for performance tracking)',
                },
            },
            required: ['domain', 'taskName', 'steps'],
        },
    },
    {
        name: 'skills_record_failure',
        description: 'Record that a task step failed. Helps track which selectors are breaking and detect website drift.',
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Website domain' },
                taskName: { type: 'string', description: 'Task that failed' },
                failedStep: { type: 'number', description: 'Which step number failed' },
                error: { type: 'string', description: 'What went wrong' },
                failedSelector: { type: 'string', description: 'The CSS selector that failed to find an element (for drift tracking)' },
            },
            required: ['domain', 'taskName', 'failedStep', 'error'],
        },
    },
    {
        name: 'skills_save_client_notes',
        description: "Save what the client specifically wants for a task. E.g. 'Always use the Barrios A2I logo', 'Post in a professional tone', 'Tag @barriosa2i'. These notes will be shown to you on future visits.",
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Website domain' },
                taskName: { type: 'string', description: 'Task to annotate' },
                notes: { type: 'string', description: 'Client preferences and instructions for this task' },
            },
            required: ['domain', 'taskName', 'notes'],
        },
    },
    {
        name: 'skills_get_drift_report',
        description: 'Get a report of skills with drifted selectors that may need re-verification. Shows which selectors have broken and whether replacements were found.',
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Filter by domain (optional — omit for all domains)' },
            },
        },
    },
    {
        name: 'skills_get_stats',
        description: 'Get execution statistics and reliability metrics for skills. Shows success rates, attempt counts, average duration, and recent execution history.',
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Filter by domain (optional)' },
                taskName: { type: 'string', description: 'Specific task name (optional — requires domain)' },
            },
        },
    },
    {
        name: 'skills_rollback',
        description: 'Rollback a skill to its previous version. Use when a recently updated skill has a poor success rate and you want to restore the version that was working before.',
        input_schema: {
            type: 'object',
            properties: {
                domain: { type: 'string', description: 'Website domain' },
                taskName: { type: 'string', description: 'Task to rollback' },
            },
            required: ['domain', 'taskName'],
        },
    },
];
//# sourceMappingURL=skill-tools.js.map