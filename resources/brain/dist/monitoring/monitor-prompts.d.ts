/**
 * Social Media Monitoring - Platform-Specific Prompts
 *
 * Prompts instruct the AI to check EXISTING open tabs for new comments/mentions
 * and respond using safe, read-first patterns. NEVER navigates to new URLs.
 *
 * @author Barrios A2I
 */
export type MonitorablePlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube';
/**
 * Returns domains to match when looking for existing tabs for a platform.
 */
export declare function getPlatformDomains(platform: MonitorablePlatform): string[];
export declare function getMonitoringPrompt(platform: MonitorablePlatform, autoReplyRules: string): string;
export declare function getSupportedMonitoringPlatforms(): MonitorablePlatform[];
//# sourceMappingURL=monitor-prompts.d.ts.map