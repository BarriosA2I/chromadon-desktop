/**
 * RALPH Completion Signal System
 *
 * Clear completion signals for each agent type to indicate
 * when tasks are truly done vs need more iteration.
 */
export declare const COMPLETION_SIGNALS: {
    readonly NAVIGATE_COMPLETE: "<promise>NAVIGATION_COMPLETE</promise>";
    readonly PAGE_LOADED: "<promise>PAGE_LOADED</promise>";
    readonly FORM_FILLED: "<promise>FORM_FILLED</promise>";
    readonly FORM_SUBMITTED: "<promise>FORM_SUBMITTED</promise>";
    readonly FORM_VALIDATED: "<promise>FORM_VALIDATED</promise>";
    readonly DATA_EXTRACTED: "<promise>DATA_EXTRACTED</promise>";
    readonly OCR_CLEAN: "<promise>OCR_CLEAN</promise>";
    readonly SCRAPE_COMPLETE: "<promise>SCRAPE_COMPLETE</promise>";
    readonly LOGIN_SUCCESS: "<promise>LOGIN_SUCCESS</promise>";
    readonly LOGOUT_SUCCESS: "<promise>LOGOUT_SUCCESS</promise>";
    readonly SESSION_VALID: "<promise>SESSION_VALID</promise>";
    readonly CART_UPDATED: "<promise>CART_UPDATED</promise>";
    readonly CART_CLEARED: "<promise>CART_CLEARED</promise>";
    readonly CHECKOUT_COMPLETE: "<promise>CHECKOUT_COMPLETE</promise>";
    readonly PAYMENT_SUCCESS: "<promise>PAYMENT_SUCCESS</promise>";
    readonly ORDER_CONFIRMED: "<promise>ORDER_CONFIRMED</promise>";
    readonly RESEARCH_COMPLETE: "<promise>RESEARCH_COMPLETE</promise>";
    readonly SEARCH_COMPLETE: "<promise>SEARCH_COMPLETE</promise>";
    readonly ANALYSIS_COMPLETE: "<promise>ANALYSIS_COMPLETE</promise>";
    readonly BOOKING_CONFIRMED: "<promise>BOOKING_CONFIRMED</promise>";
    readonly RESERVATION_MADE: "<promise>RESERVATION_MADE</promise>";
    readonly POST_PUBLISHED: "<promise>POST_PUBLISHED</promise>";
    readonly COMMENT_POSTED: "<promise>COMMENT_POSTED</promise>";
    readonly CAPTCHA_SOLVED: "<promise>CAPTCHA_SOLVED</promise>";
    readonly TASK_COMPLETE: "<promise>TASK_COMPLETE</promise>";
    readonly STEP_COMPLETE: "<promise>STEP_COMPLETE</promise>";
    readonly MISSION_COMPLETE: "<promise>MISSION_COMPLETE</promise>";
    readonly HUMAN_INTERVENTION_REQUIRED: "<promise>HUMAN_REQUIRED</promise>";
    readonly AWAITING_INPUT: "<promise>AWAITING_INPUT</promise>";
};
export type CompletionSignal = typeof COMPLETION_SIGNALS[keyof typeof COMPLETION_SIGNALS];
/**
 * Regex pattern to detect any completion signal
 */
export declare const COMPLETION_SIGNAL_PATTERN: RegExp;
/**
 * Check if a result contains a completion signal
 */
export declare function hasCompletionSignal(result: any): boolean;
/**
 * Extract completion signal from result
 */
export declare function extractCompletionSignal(result: any): CompletionSignal | null;
/**
 * Add completion signal to result
 */
export declare function addCompletionSignal(result: any, signal: CompletionSignal): any;
