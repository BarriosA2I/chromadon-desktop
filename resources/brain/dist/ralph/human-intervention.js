"use strict";
// @ts-nocheck
/**
 * RALPH Human Intervention System
 *
 * Defines errors that MUST stop the loop and request human help.
 * These are the ONLY conditions where RALPH gives up iterating.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSuggestedActions = exports.canAutoRetry = exports.requiresHumanIntervention = exports.classifyError = exports.ERROR_PATTERNS = exports.AUTO_RETRY_TRIGGERS = exports.HUMAN_INTERVENTION_TRIGGERS = exports.InterventionReason = void 0;
var InterventionReason;
(function (InterventionReason) {
    // Authentication Issues
    InterventionReason["INVALID_CREDENTIALS"] = "invalid_credentials";
    InterventionReason["ACCOUNT_LOCKED"] = "account_locked";
    InterventionReason["MFA_REQUIRED"] = "mfa_required";
    InterventionReason["CAPTCHA_UNSOLVABLE"] = "captcha_unsolvable";
    InterventionReason["SESSION_EXPIRED"] = "session_expired";
    // Permission Issues
    InterventionReason["ACCESS_DENIED"] = "access_denied";
    InterventionReason["SUBSCRIPTION_REQUIRED"] = "subscription_required";
    InterventionReason["PAYMENT_REQUIRED"] = "payment_required";
    InterventionReason["PREMIUM_FEATURE"] = "premium_feature";
    // Ambiguous Requirements
    InterventionReason["CLARIFICATION_NEEDED"] = "clarification_needed";
    InterventionReason["MULTIPLE_OPTIONS"] = "multiple_options";
    InterventionReason["AMBIGUOUS_SELECTOR"] = "ambiguous_selector";
    InterventionReason["MISSING_INFORMATION"] = "missing_information";
    // Safety Concerns
    InterventionReason["DESTRUCTIVE_ACTION"] = "destructive_action";
    InterventionReason["FINANCIAL_TRANSACTION"] = "financial_transaction";
    InterventionReason["PERSONAL_DATA"] = "personal_data";
    InterventionReason["LEGAL_AGREEMENT"] = "legal_agreement";
    // Technical Blockers
    InterventionReason["SITE_DOWN"] = "site_down";
    InterventionReason["GEO_BLOCKED"] = "geo_blocked";
    InterventionReason["RATE_LIMITED_HARD"] = "rate_limited_hard";
    InterventionReason["NETWORK_UNREACHABLE"] = "network_unreachable";
    // Resource Limits
    InterventionReason["COST_LIMIT_REACHED"] = "cost_limit_reached";
    InterventionReason["MAX_ITERATIONS_REACHED"] = "max_iterations_reached";
    InterventionReason["TIMEOUT_REACHED"] = "timeout_reached";
    // User Requested
    InterventionReason["USER_PAUSE"] = "user_pause";
    InterventionReason["USER_ABORT"] = "user_abort";
})(InterventionReason || (exports.InterventionReason = InterventionReason = {}));
/**
 * Triggers that require immediate human intervention
 */
exports.HUMAN_INTERVENTION_TRIGGERS = [
    // Auth - can't proceed without human
    InterventionReason.INVALID_CREDENTIALS,
    InterventionReason.ACCOUNT_LOCKED,
    InterventionReason.MFA_REQUIRED,
    InterventionReason.CAPTCHA_UNSOLVABLE,
    // Money - always needs approval
    InterventionReason.PAYMENT_REQUIRED,
    InterventionReason.FINANCIAL_TRANSACTION,
    // Safety - needs confirmation
    InterventionReason.DESTRUCTIVE_ACTION,
    InterventionReason.PERSONAL_DATA,
    InterventionReason.LEGAL_AGREEMENT,
    // Ambiguity - needs clarification
    InterventionReason.CLARIFICATION_NEEDED,
    InterventionReason.MULTIPLE_OPTIONS,
    // Limits
    InterventionReason.COST_LIMIT_REACHED,
    InterventionReason.MAX_ITERATIONS_REACHED,
];
/**
 * Triggers that can be auto-retried with backoff
 */
exports.AUTO_RETRY_TRIGGERS = [
    InterventionReason.SITE_DOWN,
    InterventionReason.NETWORK_UNREACHABLE,
    InterventionReason.SESSION_EXPIRED,
];
/**
 * Error patterns mapped to intervention reasons
 */
exports.ERROR_PATTERNS = [
    // Authentication
    { pattern: /invalid (password|credentials|login)/i, reason: InterventionReason.INVALID_CREDENTIALS },
    { pattern: /account (locked|suspended|disabled)/i, reason: InterventionReason.ACCOUNT_LOCKED },
    { pattern: /(2fa|two.?factor|mfa|verification code)/i, reason: InterventionReason.MFA_REQUIRED },
    { pattern: /captcha/i, reason: InterventionReason.CAPTCHA_UNSOLVABLE },
    { pattern: /session (expired|invalid|timeout)/i, reason: InterventionReason.SESSION_EXPIRED },
    // Permissions
    { pattern: /(access denied|forbidden|403)/i, reason: InterventionReason.ACCESS_DENIED },
    { pattern: /(subscription|upgrade|premium) required/i, reason: InterventionReason.SUBSCRIPTION_REQUIRED },
    { pattern: /payment (required|needed|method)/i, reason: InterventionReason.PAYMENT_REQUIRED },
    // Technical
    { pattern: /(site|server) (down|unavailable|error)/i, reason: InterventionReason.SITE_DOWN },
    { pattern: /(geo.?block|region|country)/i, reason: InterventionReason.GEO_BLOCKED },
    { pattern: /rate.?limit|too many requests|429/i, reason: InterventionReason.RATE_LIMITED_HARD },
    { pattern: /(network|connection) (error|failed|timeout)/i, reason: InterventionReason.NETWORK_UNREACHABLE },
];
/**
 * Classify an error into an intervention reason
 */
function classifyError(error) {
    const errorStr = typeof error === 'string' ? error : error.message;
    for (const { pattern, reason } of exports.ERROR_PATTERNS) {
        if (pattern.test(errorStr)) {
            return reason;
        }
    }
    return null;
}
exports.classifyError = classifyError;
/**
 * Check if an error requires human intervention
 */
function requiresHumanIntervention(reason) {
    if (!reason)
        return false;
    return exports.HUMAN_INTERVENTION_TRIGGERS.includes(reason);
}
exports.requiresHumanIntervention = requiresHumanIntervention;
/**
 * Check if an error can be auto-retried
 */
function canAutoRetry(reason) {
    if (!reason)
        return true; // Unknown errors can be retried
    return exports.AUTO_RETRY_TRIGGERS.includes(reason);
}
exports.canAutoRetry = canAutoRetry;
/**
 * Get suggested actions for an intervention reason
 */
function getSuggestedActions(reason) {
    switch (reason) {
        case InterventionReason.INVALID_CREDENTIALS:
            return ['Provide correct credentials', 'Reset password', 'Use different account'];
        case InterventionReason.MFA_REQUIRED:
            return ['Enter verification code', 'Use authenticator app'];
        case InterventionReason.CAPTCHA_UNSOLVABLE:
            return ['Solve captcha manually', 'Try different approach'];
        case InterventionReason.PAYMENT_REQUIRED:
            return ['Add payment method', 'Approve transaction', 'Skip this step'];
        case InterventionReason.CLARIFICATION_NEEDED:
            return ['Provide more details', 'Select an option', 'Modify task'];
        case InterventionReason.COST_LIMIT_REACHED:
            return ['Increase cost limit', 'Abort task', 'Continue with caution'];
        default:
            return ['Review and decide', 'Retry', 'Abort'];
    }
}
exports.getSuggestedActions = getSuggestedActions;
