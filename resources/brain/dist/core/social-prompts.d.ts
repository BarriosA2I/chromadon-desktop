/**
 * Social Media Overlord - Platform-Specific Prompt Templates
 * ==========================================================
 * Generates browser automation prompts for each platform + action combo.
 * The Agentic Orchestrator uses these to drive Claude's tool-use loop.
 *
 * @author Barrios A2I
 */
export type SocialPlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'pinterest' | 'google';
export type SocialAction = 'post' | 'comment' | 'like' | 'follow' | 'dm' | 'search' | 'scrape' | 'custom';
export interface SocialPromptContext {
    platform: SocialPlatform;
    action: SocialAction;
    content?: string;
    targetUrl?: string;
    mediaUrls?: string[];
    scheduledTime?: string;
    hashtags?: string[];
    mentions?: string[];
    customInstructions?: string;
}
export declare function generateSocialPrompt(ctx: SocialPromptContext): string;
//# sourceMappingURL=social-prompts.d.ts.map