/**
 * AI Interview Engine — Phase Prompts
 *
 * System prompts for each interview phase. The interview is a real
 * AI conversation — not a form. Claude asks one question, listens,
 * asks smart follow-ups based on answers.
 *
 * @author Barrios A2I
 */
import type { InterviewPhase, ExtractedInterviewData } from './types';
export declare function getPhaseSystemPrompt(phase: InterviewPhase, clientName: string, priorData: Partial<ExtractedInterviewData>): string;
export declare function getExtractionPrompt(phase: InterviewPhase, conversationHistory: string): string;
export declare const PHASE_TRANSITIONS: Record<InterviewPhase, {
    minMessages: number;
    nextPhase: InterviewPhase | null;
}>;
//# sourceMappingURL=interview-prompts.d.ts.map