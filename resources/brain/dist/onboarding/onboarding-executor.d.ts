/**
 * GUIDED ONBOARDING — Tool Executor
 *
 * Factory pattern matching existing CHROMADON tool executors.
 *
 * @author Barrios A2I
 */
import { OnboardingStatePersistence } from './onboarding-state';
export declare function createOnboardingExecutor(onboardingState: OnboardingStatePersistence): (toolName: string, input: Record<string, unknown>) => Promise<string>;
//# sourceMappingURL=onboarding-executor.d.ts.map