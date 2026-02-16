"use strict";
// @ts-nocheck
/**
 * RALPH Intervention Monitor
 *
 * Detects when human intervention is needed and manages the request/response cycle.
 * Uses filesystem signals for pause/abort and MCP tools for notifications.
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
exports.InterventionMonitor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const human_intervention_1 = require("./human-intervention");
const DEFAULT_CONFIG = {
    timeoutMs: 300000, // 5 minutes
    pollIntervalMs: 1000, // Check every second
    screenshotOnIntervention: true,
    notifyMethod: 'mcp',
};
class InterventionMonitor {
    config;
    persistence;
    currentRequest = null;
    constructor(persistence, config = {}) {
        this.persistence = persistence;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Check if error requires human intervention
     */
    checkError(error) {
        const reason = (0, human_intervention_1.classifyError)(error);
        return {
            requiresIntervention: (0, human_intervention_1.requiresHumanIntervention)(reason),
            reason,
        };
    }
    /**
     * Request human intervention
     */
    async requestIntervention(reason, context) {
        const request = {
            reason,
            message: this.getInterventionMessage(reason),
            context: {
                error: context.error?.toString(),
                ...context.additionalContext,
            },
            timestamp: Date.now(),
            missionId: context.missionId,
            iteration: context.iteration,
            suggestedActions: (0, human_intervention_1.getSuggestedActions)(reason),
            screenshotPath: context.screenshotPath,
        };
        // Save request to filesystem
        await this.persistence.saveInterventionRequest(request);
        this.currentRequest = request;
        return request;
    }
    /**
     * Wait for human response
     */
    async waitForResponse() {
        const startTime = Date.now();
        while (Date.now() - startTime < this.config.timeoutMs) {
            // Check for response file
            const response = await this.persistence.loadInterventionResponse();
            if (response) {
                await this.persistence.clearIntervention();
                this.currentRequest = null;
                return response;
            }
            // Check for abort signal
            const signals = await this.persistence.checkSignals();
            if (signals.abort) {
                return {
                    action: 'abort',
                    timestamp: Date.now(),
                };
            }
            // Wait before next check
            await this.sleep(this.config.pollIntervalMs);
        }
        // Timeout - return null
        return null;
    }
    /**
     * Check for pause/abort signals
     */
    async checkSignals() {
        const signals = await this.persistence.checkSignals();
        return {
            shouldPause: signals.pause,
            shouldAbort: signals.abort,
            abortReason: signals.reason,
        };
    }
    /**
     * Create pause signal
     */
    async pause() {
        const pausePath = path.join(this.persistence.getBaseDir(), 'PAUSE');
        fs.writeFileSync(pausePath, new Date().toISOString());
    }
    /**
     * Remove pause signal
     */
    async resume() {
        const pausePath = path.join(this.persistence.getBaseDir(), 'PAUSE');
        if (fs.existsSync(pausePath)) {
            fs.unlinkSync(pausePath);
        }
    }
    /**
     * Create abort signal
     */
    async abort(reason) {
        const abortPath = path.join(this.persistence.getBaseDir(), 'ABORT');
        fs.writeFileSync(abortPath, reason);
    }
    /**
     * Get current intervention request (for MCP status)
     */
    getCurrentRequest() {
        return this.currentRequest;
    }
    /**
     * Respond to intervention (for MCP tools)
     */
    async respondToIntervention(response) {
        const responsePath = path.join(this.persistence.getBaseDir(), 'intervention', 'response.json');
        fs.writeFileSync(responsePath, JSON.stringify(response, null, 2));
    }
    /**
     * Get message for intervention reason
     */
    getInterventionMessage(reason) {
        const messages = {
            [human_intervention_1.InterventionReason.INVALID_CREDENTIALS]: 'Login credentials are invalid. Please provide correct username and password.',
            [human_intervention_1.InterventionReason.ACCOUNT_LOCKED]: 'Account has been locked. Manual intervention required.',
            [human_intervention_1.InterventionReason.MFA_REQUIRED]: 'Two-factor authentication required. Please complete verification.',
            [human_intervention_1.InterventionReason.CAPTCHA_UNSOLVABLE]: 'CAPTCHA challenge detected. Please solve manually.',
            [human_intervention_1.InterventionReason.SESSION_EXPIRED]: 'Session has expired. Please re-authenticate.',
            [human_intervention_1.InterventionReason.ACCESS_DENIED]: 'Access denied to requested resource.',
            [human_intervention_1.InterventionReason.SUBSCRIPTION_REQUIRED]: 'This feature requires a subscription or upgrade.',
            [human_intervention_1.InterventionReason.PAYMENT_REQUIRED]: 'Payment is required to proceed. Please review and approve.',
            [human_intervention_1.InterventionReason.PREMIUM_FEATURE]: 'This is a premium feature. Upgrade or skip required.',
            [human_intervention_1.InterventionReason.CLARIFICATION_NEEDED]: 'Task requirements are ambiguous. Please clarify.',
            [human_intervention_1.InterventionReason.MULTIPLE_OPTIONS]: 'Multiple valid options detected. Please select one.',
            [human_intervention_1.InterventionReason.AMBIGUOUS_SELECTOR]: 'Multiple matching elements found. Please specify.',
            [human_intervention_1.InterventionReason.MISSING_INFORMATION]: 'Required information is missing. Please provide.',
            [human_intervention_1.InterventionReason.DESTRUCTIVE_ACTION]: 'About to perform destructive action. Please confirm.',
            [human_intervention_1.InterventionReason.FINANCIAL_TRANSACTION]: 'Financial transaction detected. Please approve.',
            [human_intervention_1.InterventionReason.PERSONAL_DATA]: 'Personal data handling required. Please confirm.',
            [human_intervention_1.InterventionReason.LEGAL_AGREEMENT]: 'Legal agreement requires review and acceptance.',
            [human_intervention_1.InterventionReason.SITE_DOWN]: 'Target site is unavailable. Waiting for recovery.',
            [human_intervention_1.InterventionReason.GEO_BLOCKED]: 'Access blocked due to geographic restrictions.',
            [human_intervention_1.InterventionReason.RATE_LIMITED_HARD]: 'Rate limit exceeded. Extended wait required.',
            [human_intervention_1.InterventionReason.NETWORK_UNREACHABLE]: 'Network connectivity issues detected.',
            [human_intervention_1.InterventionReason.COST_LIMIT_REACHED]: 'Cost limit reached. Increase limit or abort.',
            [human_intervention_1.InterventionReason.MAX_ITERATIONS_REACHED]: 'Maximum iterations reached without success.',
            [human_intervention_1.InterventionReason.TIMEOUT_REACHED]: 'Operation timed out.',
            [human_intervention_1.InterventionReason.USER_PAUSE]: 'Paused by user request.',
            [human_intervention_1.InterventionReason.USER_ABORT]: 'Aborted by user request.',
        };
        return messages[reason] || `Intervention required: ${reason}`;
    }
    /**
     * Helper to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.InterventionMonitor = InterventionMonitor;
//# sourceMappingURL=InterventionMonitor.js.map