"use strict";
/**
 * GUIDED ONBOARDING — Type Definitions
 *
 * First-time user experience: proactive guidance through platform discovery,
 * business profile capture, and first mission completion.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultState = exports.STEP_LABELS = exports.STEP_ORDER = void 0;
exports.STEP_ORDER = [
    'welcome',
    'businessProfile',
    'platformDiscovery',
    'firstMission',
    'celebration',
];
exports.STEP_LABELS = {
    welcome: 'Welcome',
    businessProfile: 'Business Profile',
    platformDiscovery: 'Platform Discovery',
    firstMission: 'First Mission',
    celebration: 'Celebration',
};
function createDefaultState() {
    return {
        version: '1.0',
        startedAt: new Date().toISOString(),
        completedAt: null,
        steps: {
            welcome: { completed: false, completedAt: null },
            businessProfile: { completed: false, completedAt: null },
            platformDiscovery: { completed: false, completedAt: null, platforms: [] },
            firstMission: { completed: false, completedAt: null, missionId: null },
            celebration: { completed: false, completedAt: null },
        },
    };
}
exports.createDefaultState = createDefaultState;
//# sourceMappingURL=onboarding-types.js.map