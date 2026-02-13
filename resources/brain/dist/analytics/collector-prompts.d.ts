/**
 * Social Media Analytics - Platform Collection Prompts
 *
 * Generates prompts that tell the orchestrator how to navigate to each
 * platform's analytics page and extract metrics.
 *
 * @author Barrios A2I
 */
export type CollectablePlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube';
export declare function getCollectionPrompt(platform: CollectablePlatform): string;
export declare function getSupportedPlatforms(): CollectablePlatform[];
//# sourceMappingURL=collector-prompts.d.ts.map