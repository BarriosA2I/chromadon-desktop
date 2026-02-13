"use strict";
// @ts-nocheck
/**
 * RALPH Completion Signal System
 *
 * Clear completion signals for each agent type to indicate
 * when tasks are truly done vs need more iteration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCompletionSignal = exports.extractCompletionSignal = exports.hasCompletionSignal = exports.COMPLETION_SIGNAL_PATTERN = exports.COMPLETION_SIGNALS = void 0;
exports.COMPLETION_SIGNALS = {
    // Navigation
    NAVIGATE_COMPLETE: '<promise>NAVIGATION_COMPLETE</promise>',
    PAGE_LOADED: '<promise>PAGE_LOADED</promise>',
    // Form Operations
    FORM_FILLED: '<promise>FORM_FILLED</promise>',
    FORM_SUBMITTED: '<promise>FORM_SUBMITTED</promise>',
    FORM_VALIDATED: '<promise>FORM_VALIDATED</promise>',
    // Data Operations
    DATA_EXTRACTED: '<promise>DATA_EXTRACTED</promise>',
    OCR_CLEAN: '<promise>OCR_CLEAN</promise>',
    SCRAPE_COMPLETE: '<promise>SCRAPE_COMPLETE</promise>',
    // Authentication
    LOGIN_SUCCESS: '<promise>LOGIN_SUCCESS</promise>',
    LOGOUT_SUCCESS: '<promise>LOGOUT_SUCCESS</promise>',
    SESSION_VALID: '<promise>SESSION_VALID</promise>',
    // E-commerce
    CART_UPDATED: '<promise>CART_UPDATED</promise>',
    CART_CLEARED: '<promise>CART_CLEARED</promise>',
    CHECKOUT_COMPLETE: '<promise>CHECKOUT_COMPLETE</promise>',
    PAYMENT_SUCCESS: '<promise>PAYMENT_SUCCESS</promise>',
    ORDER_CONFIRMED: '<promise>ORDER_CONFIRMED</promise>',
    // Research
    RESEARCH_COMPLETE: '<promise>RESEARCH_COMPLETE</promise>',
    SEARCH_COMPLETE: '<promise>SEARCH_COMPLETE</promise>',
    ANALYSIS_COMPLETE: '<promise>ANALYSIS_COMPLETE</promise>',
    // Booking
    BOOKING_CONFIRMED: '<promise>BOOKING_CONFIRMED</promise>',
    RESERVATION_MADE: '<promise>RESERVATION_MADE</promise>',
    // Social Media
    POST_PUBLISHED: '<promise>POST_PUBLISHED</promise>',
    COMMENT_POSTED: '<promise>COMMENT_POSTED</promise>',
    // Captcha
    CAPTCHA_SOLVED: '<promise>CAPTCHA_SOLVED</promise>',
    // Generic
    TASK_COMPLETE: '<promise>TASK_COMPLETE</promise>',
    STEP_COMPLETE: '<promise>STEP_COMPLETE</promise>',
    MISSION_COMPLETE: '<promise>MISSION_COMPLETE</promise>',
    // Human Intervention
    HUMAN_INTERVENTION_REQUIRED: '<promise>HUMAN_REQUIRED</promise>',
    AWAITING_INPUT: '<promise>AWAITING_INPUT</promise>',
};
/**
 * Regex pattern to detect any completion signal
 */
exports.COMPLETION_SIGNAL_PATTERN = /<promise>.*COMPLETE.*<\/promise>|<promise>.*SUCCESS.*<\/promise>|<promise>.*CONFIRMED.*<\/promise>/;
/**
 * Check if a result contains a completion signal
 */
function hasCompletionSignal(result) {
    if (!result)
        return false;
    const resultStr = typeof result === 'string'
        ? result
        : JSON.stringify(result);
    return exports.COMPLETION_SIGNAL_PATTERN.test(resultStr);
}
exports.hasCompletionSignal = hasCompletionSignal;
/**
 * Extract completion signal from result
 */
function extractCompletionSignal(result) {
    if (!result)
        return null;
    const resultStr = typeof result === 'string'
        ? result
        : JSON.stringify(result);
    const match = resultStr.match(/<promise>([^<]+)<\/promise>/);
    if (match) {
        return `<promise>${match[1]}</promise>`;
    }
    return null;
}
exports.extractCompletionSignal = extractCompletionSignal;
/**
 * Add completion signal to result
 */
function addCompletionSignal(result, signal) {
    if (typeof result === 'object' && result !== null) {
        return { ...result, completionSignal: signal };
    }
    return { result, completionSignal: signal };
}
exports.addCompletionSignal = addCompletionSignal;
