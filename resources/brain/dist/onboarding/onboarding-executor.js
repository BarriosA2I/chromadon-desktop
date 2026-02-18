"use strict";
/**
 * GUIDED ONBOARDING — Tool Executor
 *
 * Factory pattern matching existing CHROMADON tool executors.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOnboardingExecutor = void 0;
function createOnboardingExecutor(onboardingState) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'onboarding_get_state': {
                    const state = onboardingState.load();
                    return JSON.stringify(state);
                }
                case 'onboarding_complete_step': {
                    const stepId = input.step_id;
                    if (!stepId) {
                        return JSON.stringify({ error: 'step_id is required' });
                    }
                    const metadata = input.mission_id ? { missionId: input.mission_id } : undefined;
                    const updated = onboardingState.completeStep(stepId, metadata);
                    const isComplete = updated.completedAt !== null;
                    return JSON.stringify({
                        success: true,
                        step: stepId,
                        completed: true,
                        onboardingComplete: isComplete,
                        message: isComplete
                            ? 'Onboarding complete! All steps finished.'
                            : `Step "${stepId}" marked complete.`,
                    });
                }
                case 'onboarding_add_platform': {
                    const platform = input.platform;
                    if (!platform) {
                        return JSON.stringify({ error: 'platform is required' });
                    }
                    const updated = onboardingState.addPlatform(platform);
                    return JSON.stringify({
                        success: true,
                        platform: platform.toLowerCase(),
                        totalPlatforms: updated.steps.platformDiscovery.platforms.length,
                        platforms: updated.steps.platformDiscovery.platforms,
                    });
                }
                default:
                    return JSON.stringify({ error: `Unknown onboarding tool: ${toolName}` });
            }
        }
        catch (err) {
            return JSON.stringify({ error: err.message });
        }
    };
}
exports.createOnboardingExecutor = createOnboardingExecutor;
//# sourceMappingURL=onboarding-executor.js.map