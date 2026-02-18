/**
 * GUIDED ONBOARDING — Type Definitions
 *
 * First-time user experience: proactive guidance through platform discovery,
 * business profile capture, and first mission completion.
 *
 * @author Barrios A2I
 */
export interface OnboardingStepState {
    completed: boolean;
    completedAt: string | null;
}
export interface PlatformDiscoveryState extends OnboardingStepState {
    platforms: string[];
}
export interface FirstMissionState extends OnboardingStepState {
    missionId: string | null;
}
export interface OnboardingState {
    version: '1.0';
    startedAt: string;
    completedAt: string | null;
    steps: {
        welcome: OnboardingStepState;
        businessProfile: OnboardingStepState;
        platformDiscovery: PlatformDiscoveryState;
        firstMission: FirstMissionState;
        celebration: OnboardingStepState;
    };
}
export type OnboardingStepId = keyof OnboardingState['steps'];
export declare const STEP_ORDER: OnboardingStepId[];
export declare const STEP_LABELS: Record<OnboardingStepId, string>;
export declare function createDefaultState(): OnboardingState;
//# sourceMappingURL=onboarding-types.d.ts.map