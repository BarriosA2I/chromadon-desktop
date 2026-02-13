/**
 * YouTube OAuth Token Manager
 *
 * Handles OAuth 2.0 token lifecycle for YouTube Data API v3:
 * - Token persistence to disk
 * - Auto-refresh with 60s buffer before expiry
 * - Authorization URL generation
 * - Code exchange for tokens
 * - Daily quota tracking (10K units/day)
 *
 * @author Barrios A2I
 */
export interface YouTubeConfig {
    apiKey: string;
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    tokenStorePath: string;
}
export declare class YouTubeTokenManager {
    private tokens;
    private readonly config;
    private quota;
    private refreshPromise;
    constructor(config: YouTubeConfig);
    private loadFromDisk;
    private saveToDisk;
    getApiKey(): string;
    isAuthorized(): boolean;
    getAuthorizationUrl(redirectUri?: string): string;
    exchangeCode(code: string, redirectUri?: string): Promise<void>;
    getAccessToken(): Promise<string>;
    private doRefresh;
    trackQuota(toolName: string): void;
    getQuotaRemaining(): number;
    getQuotaUsed(): number;
    private resetQuotaIfNewDay;
}
//# sourceMappingURL=youtube-token-manager.d.ts.map