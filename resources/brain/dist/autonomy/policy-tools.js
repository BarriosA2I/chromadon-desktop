"use strict";
/**
 * Policy Check Tool — Regex-based risk assessment before browser actions
 *
 * Zero LLM cost. Runs in microseconds. Classifies actions as SAFE/RISKY/FORBIDDEN.
 * The orchestrator calls this before any action with real-world consequences.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POLICY_TOOL_NAMES = exports.POLICY_TOOLS = void 0;
exports.POLICY_TOOLS = [
    {
        name: 'policy_check',
        description: 'Check if a planned browser action is safe to execute. Call this before any action that could have real-world consequences: form submissions, purchases, account deletions, payment info entry, subscription changes, or posting content publicly. Returns SAFE (proceed), RISKY (proceed with caution + verify after), or FORBIDDEN (do not execute without explicit user confirmation).',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'The action you plan to take, e.g. "click Delete Account button", "submit payment form", "post tweet"',
                },
                url: {
                    type: 'string',
                    description: 'Current page URL (optional)',
                },
                context: {
                    type: 'string',
                    description: 'Any additional context about why this action is being taken (optional)',
                },
            },
            required: ['action'],
        },
    },
];
exports.POLICY_TOOL_NAMES = new Set(exports.POLICY_TOOLS.map(t => t.name));
//# sourceMappingURL=policy-tools.js.map