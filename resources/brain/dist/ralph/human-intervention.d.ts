/**
 * RALPH Human Intervention System
 *
 * Defines errors that MUST stop the loop and request human help.
 * These are the ONLY conditions where RALPH gives up iterating.
 */
export declare enum InterventionReason {
    INVALID_CREDENTIALS = "invalid_credentials",
    ACCOUNT_LOCKED = "account_locked",
    MFA_REQUIRED = "mfa_required",
    CAPTCHA_UNSOLVABLE = "captcha_unsolvable",
    SESSION_EXPIRED = "session_expired",
    ACCESS_DENIED = "access_denied",
    SUBSCRIPTION_REQUIRED = "subscription_required",
    PAYMENT_REQUIRED = "payment_required",
    PREMIUM_FEATURE = "premium_feature",
    CLARIFICATION_NEEDED = "clarification_needed",
    MULTIPLE_OPTIONS = "multiple_options",
    AMBIGUOUS_SELECTOR = "ambiguous_selector",
    MISSING_INFORMATION = "missing_information",
    DESTRUCTIVE_ACTION = "destructive_action",
    FINANCIAL_TRANSACTION = "financial_transaction",
    PERSONAL_DATA = "personal_data",
    LEGAL_AGREEMENT = "legal_agreement",
    SITE_DOWN = "site_down",
    GEO_BLOCKED = "geo_blocked",
    RATE_LIMITED_HARD = "rate_limited_hard",
    NETWORK_UNREACHABLE = "network_unreachable",
    COST_LIMIT_REACHED = "cost_limit_reached",
    MAX_ITERATIONS_REACHED = "max_iterations_reached",
    TIMEOUT_REACHED = "timeout_reached",
    USER_PAUSE = "user_pause",
    USER_ABORT = "user_abort"
}
export interface InterventionRequest {
    reason: InterventionReason;
    message: string;
    context: Record<string, any>;
    timestamp: number;
    missionId: string;
    iteration: number;
    suggestedActions?: string[];
    screenshotPath?: string;
}
export interface InterventionResponse {
    action: 'continue' | 'retry' | 'abort' | 'modify';
    data?: Record<string, any>;
    newCredentials?: {
        username: string;
        password: string;
    };
    captchaSolution?: string;
    clarification?: string;
    timestamp: number;
}
/**
 * Triggers that require immediate human intervention
 */
export declare const HUMAN_INTERVENTION_TRIGGERS: InterventionReason[];
/**
 * Triggers that can be auto-retried with backoff
 */
export declare const AUTO_RETRY_TRIGGERS: InterventionReason[];
/**
 * Error patterns mapped to intervention reasons
 */
export declare const ERROR_PATTERNS: Array<{
    pattern: RegExp;
    reason: InterventionReason;
}>;
/**
 * Classify an error into an intervention reason
 */
export declare function classifyError(error: Error | string): InterventionReason | null;
/**
 * Check if an error requires human intervention
 */
export declare function requiresHumanIntervention(reason: InterventionReason | null): boolean;
/**
 * Check if an error can be auto-retried
 */
export declare function canAutoRetry(reason: InterventionReason | null): boolean;
/**
 * Get suggested actions for an intervention reason
 */
export declare function getSuggestedActions(reason: InterventionReason): string[];
