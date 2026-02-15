/**
 * Social Media Monitoring - Platform-Specific Prompts
 *
 * Prompts instruct the AI to check notifications and respond to comments.
 *
 * @author Barrios A2I
 */
export type MonitorablePlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube';
export declare function getMonitoringPrompt(platform: MonitorablePlatform, autoReplyRules: string): string;
export declare function getSupportedMonitoringPlatforms(): MonitorablePlatform[];
//# sourceMappingURL=monitor-prompts.d.ts.map