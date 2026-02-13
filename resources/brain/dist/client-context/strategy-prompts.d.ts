/**
 * Strategy Engine — AI Prompts for Business Growth Planning
 *
 * @author Barrios A2I
 */
import type { BusinessProfile, BrandVoiceProfile, AudiencePersona, CompetitorProfile, SearchResult } from './types';
export declare function buildStrategyPrompt(profile: BusinessProfile, voice: BrandVoiceProfile | null, personas: AudiencePersona[], competitors: CompetitorProfile[], relevantDocs: SearchResult[]): string;
export declare function buildCalendarPrompt(profile: BusinessProfile, voice: BrandVoiceProfile | null, channels: Array<{
    platform: string;
    postingFrequency: string;
    contentTypes: string[];
}>, weeks: number): string;
export declare function buildReviewPrompt(profile: BusinessProfile, currentStrategy: string, feedback?: string): string;
//# sourceMappingURL=strategy-prompts.d.ts.map