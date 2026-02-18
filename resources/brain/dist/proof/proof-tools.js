"use strict";
/**
 * PROOF OF WORK — Tool Definitions
 *
 * 2 tools for generating and retrieving proof packages.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROOF_TOOL_NAMES = exports.PROOF_TOOLS = void 0;
exports.PROOF_TOOLS = [
    {
        name: 'proof_generate',
        description: 'Generate a proof-of-work package for a completed mission. ' +
            'Collects activity log entries, takes a final screenshot, and produces an AI summary. ' +
            'Call this after completing any multi-step browser mission.',
        input_schema: {
            type: 'object',
            properties: {
                mission_id: {
                    type: 'string',
                    description: 'The mission ID to generate proof for',
                },
                summary: {
                    type: 'string',
                    description: 'Brief summary of what was accomplished during this mission',
                },
                status: {
                    type: 'string',
                    enum: ['success', 'partial', 'failed'],
                    description: 'Overall mission outcome (default: success)',
                },
            },
            required: ['mission_id', 'summary'],
        },
    },
    {
        name: 'proof_get',
        description: 'Retrieve a previously generated proof-of-work package for a mission. ' +
            'Returns the summary, activity trail, screenshot paths, and status. ' +
            'Call this when the user asks "show me what you did" or "proof of work".',
        input_schema: {
            type: 'object',
            properties: {
                mission_id: {
                    type: 'string',
                    description: 'The mission ID to retrieve proof for',
                },
            },
            required: ['mission_id'],
        },
    },
];
exports.PROOF_TOOL_NAMES = new Set(exports.PROOF_TOOLS.map(t => t.name));
//# sourceMappingURL=proof-tools.js.map