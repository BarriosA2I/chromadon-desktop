"use strict";
/**
 * Visual Verify Tool — AI vision-based verification after browser actions
 *
 * The orchestrator calls this after critical actions (form submission, posting,
 * account changes) to confirm success before proceeding.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VISUAL_VERIFY_TOOL_NAMES = exports.VISUAL_VERIFY_TOOLS = void 0;
exports.VISUAL_VERIFY_TOOLS = [
    {
        name: 'visual_verify',
        description: 'Take a screenshot and verify that the last browser action succeeded. Uses AI vision to analyze the current page state. Call this after critical actions (form submissions, posting content, account creation, payment confirmations) to confirm success before proceeding. Returns verified/not-verified with evidence and a recommended next action.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    description: 'What action was performed, e.g. "clicked Submit button", "posted to Facebook", "filled registration form"',
                },
                expected: {
                    type: 'string',
                    description: 'What the expected outcome is, e.g. "success confirmation message", "redirect to dashboard", "post appears in feed"',
                },
            },
            required: ['action', 'expected'],
        },
    },
];
exports.VISUAL_VERIFY_TOOL_NAMES = new Set(exports.VISUAL_VERIFY_TOOLS.map(t => t.name));
//# sourceMappingURL=visual-verify-tools.js.map