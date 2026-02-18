/**
 * GUIDED ONBOARDING — State Persistence
 *
 * Manages onboarding progress in ~/.chromadon/onboarding.json
 * Atomic writes via tmp + rename. Auto-creates default state on first use.
 *
 * @author Barrios A2I
 */
import { OnboardingState, OnboardingStepId } from './onboarding-types';
export declare class OnboardingStatePersistence {
    private readonly filePath;
    private state;
    constructor(dataDir?: string);
    load(): OnboardingState;
    isComplete(): boolean;
    /**
     * Get concise prompt context for system prompt injection.
     * Returns null when onboarding is complete (zero tokens spent).
     */
    getPromptContext(): string | null;
    completeStep(stepId: OnboardingStepId, metadata?: {
        missionId?: string;
    }): OnboardingState;
    addPlatform(platform: string): OnboardingState;
    private loadFromDisk;
    private saveToDisk;
}
//# sourceMappingURL=onboarding-state.d.ts.map