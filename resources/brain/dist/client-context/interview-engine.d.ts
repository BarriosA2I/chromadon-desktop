/**
 * AI Interview Engine — Conversational Business Onboarding
 *
 * State machine driving a multi-phase AI conversation that deeply
 * learns each client's business. Uses Claude Haiku for fast responses
 * and entity extraction at phase transitions.
 *
 * @author Barrios A2I
 */
import type { InterviewPhase, InterviewState } from './types';
import { ClientStorage } from './client-storage';
export declare class InterviewEngine {
    private readonly anthropic;
    private readonly storage;
    private readonly conversationModel;
    private readonly extractionModel;
    constructor(storage: ClientStorage);
    startInterview(clientId: string): Promise<{
        state: InterviewState;
        greeting: string;
    }>;
    resumeInterview(clientId: string): Promise<{
        state: InterviewState;
        greeting: string;
    }>;
    processResponse(clientId: string, userMessage: string): Promise<{
        state: InterviewState;
        reply: string;
        phaseChanged: boolean;
        newPhase?: InterviewPhase;
    }>;
    skipToPhase(clientId: string, targetPhase: InterviewPhase): Promise<InterviewState>;
    getProgress(clientId: string): {
        currentPhase: InterviewPhase;
        completedPhases: InterviewPhase[];
        totalPhases: number;
        percentComplete: number;
        isComplete: boolean;
    } | null;
    private validateAndTransition;
    private generateResponse;
    private generateResumeMessage;
    private shouldTransitionPhase;
    private extractEntities;
    private finalizeProfile;
}
//# sourceMappingURL=interview-engine.d.ts.map