"use strict";
/**
 * GUIDED ONBOARDING — Tool Definitions
 *
 * 3 tools for the first-time user onboarding experience.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ONBOARDING_TOOL_NAMES = exports.ONBOARDING_TOOLS = void 0;
exports.ONBOARDING_TOOLS = [
    {
        name: 'onboarding_get_state',
        description: 'Get the current onboarding progress. Returns which steps are completed and which remain. ' +
            'Call this at the start of a conversation if onboarding is not yet complete to understand where the user is in the flow.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'onboarding_complete_step',
        description: 'Mark an onboarding step as complete. Call this when the user has accomplished a step: ' +
            'welcome (introduced themselves), businessProfile (shared business details via client_save_info), ' +
            'platformDiscovery (connected at least one social platform), firstMission (completed their first task), ' +
            'celebration (all steps done — celebrate!).',
        input_schema: {
            type: 'object',
            properties: {
                step_id: {
                    type: 'string',
                    enum: ['welcome', 'businessProfile', 'platformDiscovery', 'firstMission', 'celebration'],
                    description: 'The onboarding step to mark as complete',
                },
                mission_id: {
                    type: 'string',
                    description: 'For firstMission step: the mission ID that was completed (optional)',
                },
            },
            required: ['step_id'],
        },
    },
    {
        name: 'onboarding_add_platform',
        description: 'Record that a social media or web platform has been connected. Call this when the user logs into ' +
            'a platform through CHROMADON (twitter, linkedin, facebook, instagram, shopify, youtube, etc.).',
        input_schema: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    description: 'Platform name (lowercase): twitter, linkedin, facebook, instagram, shopify, youtube, tiktok, etc.',
                },
            },
            required: ['platform'],
        },
    },
];
exports.ONBOARDING_TOOL_NAMES = new Set(exports.ONBOARDING_TOOLS.map(t => t.name));
//# sourceMappingURL=onboarding-tools.js.map