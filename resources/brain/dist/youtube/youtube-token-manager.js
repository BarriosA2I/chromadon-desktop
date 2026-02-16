"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeTokenManager = void 0;
const fs = __importStar(require("fs"));
// Quota costs per tool (YouTube Data API v3 documentation)
const QUOTA_COSTS = {
    youtube_search: 100,
    youtube_get_video: 1,
    youtube_get_channel: 1,
    youtube_list_playlist_items: 1,
    youtube_list_comments: 1,
    youtube_upload_video: 1600,
    youtube_update_video: 50,
    youtube_delete_video: 50,
    youtube_create_playlist: 50,
    youtube_update_playlist: 50,
    youtube_delete_playlist: 50,
    youtube_add_to_playlist: 50,
    youtube_remove_from_playlist: 50,
    youtube_post_comment: 50,
    youtube_reply_to_comment: 50,
    youtube_rate_video: 50,
    youtube_get_my_channel: 1,
    youtube_list_my_playlists: 1,
    youtube_subscribe: 50,
    youtube_unsubscribe: 50,
};
const DAILY_QUOTA_LIMIT = 10000;
// ============================================================================
// TOKEN MANAGER
// ============================================================================
class YouTubeTokenManager {
    tokens = null;
    config;
    quota = { unitsUsed: 0, resetDate: '' };
    refreshPromise = null; // Lock for concurrent refresh
    constructor(config) {
        this.config = config;
        this.loadFromDisk();
    }
    loadFromDisk() {
        try {
            if (fs.existsSync(this.config.tokenStorePath)) {
                const data = JSON.parse(fs.readFileSync(this.config.tokenStorePath, 'utf-8'));
                this.tokens = data;
                console.log('[YOUTUBE] Tokens loaded from disk');
            }
        }
        catch (error) {
            console.warn('[YOUTUBE] Failed to load tokens from disk:', error.message);
        }
        // Load refresh token from config if not yet stored
        if (!this.tokens?.refreshToken && this.config.refreshToken) {
            this.tokens = {
                accessToken: '',
                refreshToken: this.config.refreshToken,
                expiresAt: 0,
            };
        }
    }
    saveToDisk() {
        try {
            fs.writeFileSync(this.config.tokenStorePath, JSON.stringify(this.tokens, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('[YOUTUBE] Failed to save tokens:', error.message);
        }
    }
    getApiKey() {
        return this.config.apiKey;
    }
    isAuthorized() {
        return !!this.tokens?.refreshToken;
    }
    getAuthorizationUrl(redirectUri) {
        const uri = redirectUri || 'http://localhost:3001/api/youtube/oauth/callback';
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: uri,
            response_type: 'code',
            scope: [
                'https://www.googleapis.com/auth/youtube',
                'https://www.googleapis.com/auth/youtube.upload',
                'https://www.googleapis.com/auth/youtube.force-ssl',
            ].join(' '),
            access_type: 'offline',
            prompt: 'consent',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    async exchangeCode(code, redirectUri) {
        const uri = redirectUri || 'http://localhost:3001/api/youtube/oauth/callback';
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                redirect_uri: uri,
                grant_type: 'authorization_code',
            }).toString(),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`OAuth code exchange failed: ${response.status} ${err}`);
        }
        const data = await response.json();
        this.tokens = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || this.tokens?.refreshToken || '',
            expiresAt: Date.now() + (data.expires_in - 60) * 1000,
        };
        this.saveToDisk();
        console.log('[YOUTUBE] OAuth tokens exchanged and stored');
    }
    async getAccessToken() {
        if (!this.tokens?.refreshToken) {
            throw new Error('YouTube not authorized. Use youtube_oauth_authorize first.');
        }
        // Return cached token if still valid
        if (this.tokens.accessToken && Date.now() < this.tokens.expiresAt) {
            return this.tokens.accessToken;
        }
        // Avoid concurrent refreshes
        if (this.refreshPromise)
            return this.refreshPromise;
        this.refreshPromise = this.doRefresh();
        try {
            return await this.refreshPromise;
        }
        finally {
            this.refreshPromise = null;
        }
    }
    async doRefresh() {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                refresh_token: this.tokens.refreshToken,
                grant_type: 'refresh_token',
            }).toString(),
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`YouTube token refresh failed: ${response.status} ${err}`);
        }
        const data = await response.json();
        this.tokens.accessToken = data.access_token;
        this.tokens.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
        this.saveToDisk();
        return this.tokens.accessToken;
    }
    // =========================================================================
    // QUOTA TRACKING
    // =========================================================================
    trackQuota(toolName) {
        this.resetQuotaIfNewDay();
        const cost = QUOTA_COSTS[toolName] || 0;
        this.quota.unitsUsed += cost;
    }
    getQuotaRemaining() {
        this.resetQuotaIfNewDay();
        return Math.max(0, DAILY_QUOTA_LIMIT - this.quota.unitsUsed);
    }
    getQuotaUsed() {
        this.resetQuotaIfNewDay();
        return this.quota.unitsUsed;
    }
    resetQuotaIfNewDay() {
        // YouTube quota resets at midnight Pacific Time
        const now = new Date();
        const pacific = now.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        if (pacific !== this.quota.resetDate) {
            this.quota = { unitsUsed: 0, resetDate: pacific };
        }
    }
}
exports.YouTubeTokenManager = YouTubeTokenManager;
//# sourceMappingURL=youtube-token-manager.js.map