/**
 * CHROMADON Tier 3: Specialist Layer
 * ===================================
 * THE AUTH GUARDIAN - Authentication Specialist
 * THE SOCIAL MEDIA PRO - Social Platform Expert
 * THE CAPTCHA BREAKER - CAPTCHA Resolution
 */
import { BaseAgent } from './tier0-orchestration';
import { Platform, Credentials, BusinessData, CaptchaChallenge, CaptchaSolution } from './types';
export declare class TheAuthGuardian extends BaseAgent {
    private sessions;
    private credentials;
    private platformConfigs;
    constructor();
    private initPlatformConfigs;
    ensureLoggedIn(platform: Platform, cdpController: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    performLogin(platform: Platform, credentials: Credentials, cdpController: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    handle2FA(platform: Platform, credentials: Credentials, cdpController: any): Promise<{
        success: boolean;
        error?: string;
    }>;
    private find2FAInput;
    private verifySession;
    /**
     * Store credentials securely (in production, use proper encryption)
     */
    storeCredentials(platform: Platform, credentials: Credentials): void;
    /**
     * Clear stored session for a platform
     */
    clearSession(platform: Platform): void;
    private delay;
}
export declare class TheSocialMediaPro extends BaseAgent {
    private platformFlows;
    constructor();
    private initPlatformFlows;
    createBusinessPage(platform: Platform, businessData: BusinessData, cdpController: any): Promise<{
        success: boolean;
        pageUrl?: string;
        error?: string;
    }>;
    createPost(platform: Platform, content: {
        text: string;
        images?: string[];
        hashtags?: string[];
    }, cdpController: any): Promise<{
        success: boolean;
        postUrl?: string;
        error?: string;
    }>;
    private adaptivePost;
    private getFieldValue;
    private delay;
}
export declare class TheCaptchaBreaker extends BaseAgent {
    constructor();
    detectCaptcha(cdpController: any): Promise<CaptchaChallenge | null>;
    solveCaptcha(challenge: CaptchaChallenge, cdpController: any): Promise<CaptchaSolution>;
    private solveRecaptchaV2;
    private solveHCaptcha;
    private solveTextCaptcha;
    private solveSliderCaptcha;
    private delay;
}
/**
 * Create all Tier 3 specialist agents
 */
export declare function createSpecialistAgents(): {
    authGuardian: TheAuthGuardian;
    socialMediaPro: TheSocialMediaPro;
    captchaBreaker: TheCaptchaBreaker;
};
export declare const authGuardian: TheAuthGuardian;
export declare const socialMediaPro: TheSocialMediaPro;
export declare const captchaBreaker: TheCaptchaBreaker;
