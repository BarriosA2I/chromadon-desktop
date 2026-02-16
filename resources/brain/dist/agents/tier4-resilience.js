"use strict";
// @ts-nocheck
/**
 * CHROMADON Tier 4: Resilience Layer
 * ====================================
 * THE ERROR HANDLER - Error Classification & Response
 * THE RECOVERY EXPERT - Automated Recovery Strategies
 * THE LEARNING ENGINE - Pattern Learning & Optimization
 *
 * These agents provide fault tolerance, self-healing capabilities,
 * and continuous improvement through experience.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResilienceAgents = exports.TheLearningEngine = exports.TheRecoveryExpert = exports.TheErrorHandler = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const types_1 = require("./types");
const event_bus_1 = require("./event-bus");
// =============================================================================
// BASE RESILIENCE AGENT CLASS
// =============================================================================
class BaseResilienceAgent {
    name;
    config;
    anthropic;
    eventBus;
    constructor(name, config = {}) {
        this.name = name;
        this.config = {
            name,
            model: 'haiku', // Fast model for quick decisions
            maxRetries: 3,
            timeoutMs: 10000,
            circuitBreaker: {
                failureThreshold: 10,
                recoveryTimeMs: 60000,
                halfOpenRequests: 5,
            },
            ...config,
        };
        this.anthropic = new sdk_1.default();
        this.eventBus = (0, event_bus_1.getEventBus)();
    }
    getModelId() {
        switch (this.config.model) {
            case 'haiku':
                return 'claude-haiku-4-5-20251001';
            case 'sonnet':
                return 'claude-sonnet-4-20250514';
            case 'opus':
                return 'claude-opus-4-20250514';
            default:
                return 'claude-haiku-4-5-20251001';
        }
    }
    async callLLM(systemPrompt, userMessage, options = {}) {
        const response = await this.anthropic.messages.create({
            model: this.getModelId(),
            max_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
        });
        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock?.type === 'text' ? textBlock.text : '';
    }
    publishEvent(type, payload, correlationId) {
        this.eventBus.publish({
            type: type,
            source: this.name,
            correlationId: correlationId ?? (0, uuid_1.v4)(),
            payload,
        });
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
// =============================================================================
// AGENT 25: THE ERROR HANDLER
// =============================================================================
/**
 * THE ERROR HANDLER
 * -----------------
 * Classifies errors, determines recoverability, and routes to appropriate
 * recovery strategies. Maintains error history for pattern detection.
 */
class TheErrorHandler extends BaseResilienceAgent {
    errorPatterns;
    errorHistory = [];
    maxHistorySize = 1000;
    constructor() {
        super('THE_ERROR_HANDLER');
        this.errorPatterns = this.initializePatterns();
    }
    initializePatterns() {
        return [
            // Network errors
            {
                id: 'net_timeout',
                category: 'network',
                messagePatterns: [/timeout/i, /ETIMEDOUT/i, /network.*error/i],
                recoverable: true,
                suggestedRecovery: ['retry', 'wait_and_retry'],
                maxRetries: 3,
            },
            {
                id: 'net_disconnect',
                category: 'network',
                messagePatterns: [/disconnected/i, /ECONNRESET/i, /connection.*closed/i],
                recoverable: true,
                suggestedRecovery: ['reconnect', 'refresh'],
                maxRetries: 2,
            },
            // Authentication errors
            {
                id: 'auth_expired',
                category: 'authentication',
                messagePatterns: [/session.*expired/i, /login.*required/i, /unauthorized/i],
                recoverable: true,
                suggestedRecovery: ['re_authenticate'],
                maxRetries: 1,
            },
            {
                id: 'auth_invalid',
                category: 'authentication',
                messagePatterns: [/invalid.*credentials/i, /wrong.*password/i, /authentication.*failed/i],
                recoverable: false,
                suggestedRecovery: ['notify_user'],
                maxRetries: 0,
            },
            // Element not found
            {
                id: 'element_missing',
                category: 'element_not_found',
                messagePatterns: [/element.*not.*found/i, /selector.*not.*found/i, /no.*element/i],
                recoverable: true,
                suggestedRecovery: ['wait_for_element', 'try_alternative_selector', 'scroll_and_retry'],
                maxRetries: 3,
            },
            // Timeouts
            {
                id: 'page_timeout',
                category: 'timeout',
                messagePatterns: [/page.*load.*timeout/i, /navigation.*timeout/i],
                recoverable: true,
                suggestedRecovery: ['refresh', 'wait_and_retry'],
                maxRetries: 2,
            },
            // Rate limiting
            {
                id: 'rate_limited',
                category: 'rate_limit',
                messagePatterns: [/rate.*limit/i, /too.*many.*requests/i, /429/i, /throttl/i],
                recoverable: true,
                suggestedRecovery: ['exponential_backoff'],
                cooldownMs: 60000,
                maxRetries: 5,
            },
            // CAPTCHA
            {
                id: 'captcha_required',
                category: 'captcha',
                messagePatterns: [/captcha/i, /verify.*human/i, /robot/i],
                recoverable: true,
                suggestedRecovery: ['solve_captcha', 'notify_user'],
                maxRetries: 2,
            },
            // Permission errors
            {
                id: 'access_denied',
                category: 'permission',
                messagePatterns: [/access.*denied/i, /forbidden/i, /403/i, /permission/i],
                recoverable: false,
                suggestedRecovery: ['notify_user'],
                maxRetries: 0,
            },
            // State mismatch
            {
                id: 'unexpected_state',
                category: 'state_mismatch',
                messagePatterns: [/unexpected.*state/i, /page.*changed/i, /stale.*element/i],
                recoverable: true,
                suggestedRecovery: ['refresh', 'rollback_to_checkpoint'],
                maxRetries: 2,
            },
        ];
    }
    async classify(error) {
        const startTime = Date.now();
        const normalizedError = this.normalizeError(error);
        this.publishEvent('agent.started', { action: 'classify', errorCode: normalizedError.code });
        // Try pattern matching first (fast)
        const patternMatch = this.matchPattern(normalizedError);
        if (patternMatch) {
            const classification = {
                id: (0, uuid_1.v4)(),
                error: normalizedError,
                category: patternMatch.category,
                severity: this.determineSeverity(patternMatch),
                recoverable: patternMatch.recoverable,
                suggestedRecovery: patternMatch.suggestedRecovery,
                maxRetries: patternMatch.maxRetries,
                cooldownMs: patternMatch.cooldownMs,
                confidence: 0.9,
                classifiedAt: Date.now(),
            };
            this.recordError(normalizedError, classification);
            this.publishEvent('agent.completed', {
                action: 'classify',
                category: classification.category,
                recoverable: classification.recoverable,
                durationMs: Date.now() - startTime,
            });
            return classification;
        }
        // Fall back to LLM classification for unknown errors
        const llmClassification = await this.classifyWithLLM(normalizedError);
        this.recordError(normalizedError, llmClassification);
        this.publishEvent('agent.completed', {
            action: 'classify',
            category: llmClassification.category,
            recoverable: llmClassification.recoverable,
            durationMs: Date.now() - startTime,
            usedLLM: true,
        });
        return llmClassification;
    }
    async suggestRecovery(classification, context) {
        // Check if similar error was recently resolved
        const recentSuccess = this.findRecentSuccessfulRecovery(classification.category);
        if (recentSuccess) {
            return [recentSuccess.action];
        }
        // Return suggested recoveries based on classification
        if (classification.suggestedRecovery.length > 0) {
            return classification.suggestedRecovery;
        }
        // Ask LLM for recovery suggestions
        const systemPrompt = `You are THE ERROR HANDLER. Suggest recovery actions for browser automation errors.

Available recovery actions:
- retry: Simple retry of the failed operation
- wait_and_retry: Wait then retry (for transient issues)
- refresh: Refresh the page
- reconnect: Reconnect to the browser
- re_authenticate: Re-login to the service
- rollback_to_checkpoint: Restore previous state
- try_alternative_selector: Use different element selector
- scroll_and_retry: Scroll element into view and retry
- wait_for_element: Wait for element to appear
- solve_captcha: Attempt CAPTCHA resolution
- exponential_backoff: Wait with increasing delays
- notify_user: Alert user for manual intervention
- abort: Give up on this operation

Respond with JSON:
{
  "actions": ["ordered list of actions to try"],
  "reasoning": "why these actions",
  "estimatedSuccessChance": 0.0 to 1.0
}`;
        const response = await this.callLLM(systemPrompt, `Error: ${JSON.stringify(classification.error)}\nContext: ${JSON.stringify(context)}`);
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return result.actions;
            }
        }
        catch {
            // Fall back to default
        }
        return ['retry', 'notify_user'];
    }
    shouldRetry(classification, attemptCount) {
        if (!classification.recoverable)
            return false;
        if (attemptCount >= classification.maxRetries)
            return false;
        // Check for cooldown
        if (classification.cooldownMs) {
            const recentSameError = this.errorHistory
                .filter((e) => e.classification.category === classification.category)
                .sort((a, b) => b.timestamp - a.timestamp)[0];
            if (recentSameError && Date.now() - recentSameError.timestamp < classification.cooldownMs) {
                return false;
            }
        }
        return true;
    }
    getBackoffDelay(attemptCount, baseDelayMs = 1000) {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attemptCount);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds
    }
    normalizeError(error) {
        if (typeof error === 'string') {
            return {
                code: 'UNKNOWN',
                message: error,
                recoverable: true,
            };
        }
        if (error instanceof Error) {
            return {
                code: error.name,
                message: error.message,
                recoverable: true,
                stack: error.stack,
            };
        }
        return error;
    }
    matchPattern(error) {
        for (const pattern of this.errorPatterns) {
            for (const regex of pattern.messagePatterns) {
                if (regex.test(error.message)) {
                    return pattern;
                }
            }
        }
        return null;
    }
    determineSeverity(pattern) {
        if (!pattern.recoverable)
            return 'critical';
        if (pattern.category === 'rate_limit' || pattern.category === 'captcha')
            return 'medium';
        if (pattern.category === 'network' || pattern.category === 'timeout')
            return 'low';
        return 'medium';
    }
    async classifyWithLLM(error) {
        const systemPrompt = `You are THE ERROR HANDLER. Classify browser automation errors.

Categories:
- network: Connection, timeout, DNS issues
- authentication: Login, session, credentials issues
- element_not_found: Missing DOM elements
- timeout: Operation timeouts
- validation: Form validation failures
- rate_limit: Too many requests
- captcha: CAPTCHA challenges
- permission: Access denied
- state_mismatch: Unexpected page state
- data_format: Invalid data
- system: Internal errors
- unknown: Cannot classify

Respond with JSON:
{
  "category": "category name",
  "recoverable": boolean,
  "suggestedRecovery": ["actions"],
  "maxRetries": number,
  "severity": "low|medium|high|critical",
  "confidence": 0.0 to 1.0
}`;
        try {
            const response = await this.callLLM(systemPrompt, `Classify this error: ${JSON.stringify(error)}`);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    id: (0, uuid_1.v4)(),
                    error,
                    category: result.category,
                    severity: result.severity,
                    recoverable: result.recoverable,
                    suggestedRecovery: result.suggestedRecovery,
                    maxRetries: result.maxRetries,
                    confidence: result.confidence,
                    classifiedAt: Date.now(),
                };
            }
        }
        catch {
            // Fall through to default
        }
        return {
            id: (0, uuid_1.v4)(),
            error,
            category: 'unknown',
            severity: 'medium',
            recoverable: true,
            suggestedRecovery: ['retry', 'notify_user'],
            maxRetries: 2,
            confidence: 0.3,
            classifiedAt: Date.now(),
        };
    }
    recordError(error, classification) {
        this.errorHistory.push({
            error,
            classification,
            timestamp: Date.now(),
        });
        // Trim history if too large
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize / 2);
        }
    }
    findRecentSuccessfulRecovery(category) {
        // This would be populated by THE_RECOVERY_EXPERT
        return null;
    }
    getErrorStats() {
        const stats = {};
        let recovered = 0;
        for (const entry of this.errorHistory) {
            stats[entry.classification.category] = (stats[entry.classification.category] || 0) + 1;
            if (entry.classification.recoverable)
                recovered++;
        }
        return {
            total: this.errorHistory.length,
            byCategory: stats,
            recoveryRate: this.errorHistory.length > 0 ? recovered / this.errorHistory.length : 0,
        };
    }
    clearHistory() {
        this.errorHistory = [];
    }
}
exports.TheErrorHandler = TheErrorHandler;
__decorate([
    (0, event_bus_1.traced)('error_handler.classify'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheErrorHandler.prototype, "classify", null);
__decorate([
    (0, event_bus_1.traced)('error_handler.suggest_recovery'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_a = typeof types_1.ErrorClassification !== "undefined" && types_1.ErrorClassification) === "function" ? _a : Object, Object]),
    __metadata("design:returntype", Promise)
], TheErrorHandler.prototype, "suggestRecovery", null);
__decorate([
    (0, event_bus_1.traced)('error_handler.should_retry'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_b = typeof types_1.ErrorClassification !== "undefined" && types_1.ErrorClassification) === "function" ? _b : Object, Number]),
    __metadata("design:returntype", Boolean)
], TheErrorHandler.prototype, "shouldRetry", null);
__decorate([
    (0, event_bus_1.traced)('error_handler.get_backoff_delay'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Number)
], TheErrorHandler.prototype, "getBackoffDelay", null);
// =============================================================================
// AGENT 26: THE RECOVERY EXPERT
// =============================================================================
/**
 * THE RECOVERY EXPERT
 * -------------------
 * Executes recovery strategies, manages checkpoints, and coordinates
 * rollback operations. Works with THE_ERROR_HANDLER for intelligent recovery.
 */
class TheRecoveryExpert extends BaseResilienceAgent {
    recoveryStrategies;
    recoveryHistory = [];
    constructor() {
        super('THE_RECOVERY_EXPERT');
        this.recoveryStrategies = this.initializeStrategies();
    }
    initializeStrategies() {
        const strategies = new Map();
        strategies.set('retry', {
            name: 'retry',
            description: 'Simple retry of the failed operation',
            async execute(context, params) {
                // Just return success - actual retry happens in orchestrator
                return { success: true, message: 'Retry requested' };
            },
            applicableErrors: ['network', 'timeout', 'element_not_found'],
        });
        strategies.set('wait_and_retry', {
            name: 'wait_and_retry',
            description: 'Wait for a period then retry',
            async execute(context, params) {
                const waitMs = params?.waitMs ?? 2000;
                await new Promise((r) => setTimeout(r, waitMs));
                return { success: true, message: `Waited ${waitMs}ms` };
            },
            applicableErrors: ['network', 'timeout', 'rate_limit'],
        });
        strategies.set('refresh', {
            name: 'refresh',
            description: 'Refresh the current page',
            async execute(context, params) {
                // This requires access to CDP controller - handled by orchestrator
                return { success: true, message: 'Refresh requested' };
            },
            applicableErrors: ['state_mismatch', 'element_not_found'],
        });
        strategies.set('exponential_backoff', {
            name: 'exponential_backoff',
            description: 'Wait with exponentially increasing delays',
            async execute(context, params) {
                const attempt = params?.attempt ?? 1;
                const baseDelay = params?.baseDelayMs ?? 1000;
                const delay = Math.min(baseDelay * Math.pow(2, attempt), 60000);
                await new Promise((r) => setTimeout(r, delay));
                return { success: true, message: `Backoff: ${delay}ms` };
            },
            applicableErrors: ['rate_limit', 'network'],
        });
        strategies.set('rollback_to_checkpoint', {
            name: 'rollback_to_checkpoint',
            description: 'Restore state from last checkpoint',
            async execute(context, params) {
                const checkpointId = params?.checkpointId;
                if (!checkpointId) {
                    // Find most recent checkpoint
                    const checkpoint = context.checkpoints[context.checkpoints.length - 1];
                    if (!checkpoint) {
                        return { success: false, message: 'No checkpoint available' };
                    }
                    return { success: true, message: 'Rollback to checkpoint', data: checkpoint };
                }
                const checkpoint = context.checkpoints.find((c) => c.id === checkpointId);
                if (!checkpoint) {
                    return { success: false, message: 'Checkpoint not found' };
                }
                return { success: true, message: 'Rollback to checkpoint', data: checkpoint };
            },
            applicableErrors: ['state_mismatch', 'validation'],
        });
        return strategies;
    }
    async executeRecovery(action, context, params) {
        const startTime = Date.now();
        const correlationId = (0, uuid_1.v4)();
        this.publishEvent('agent.started', { action: 'execute_recovery', recoveryAction: action }, correlationId);
        const strategy = this.recoveryStrategies.get(action);
        if (!strategy) {
            return {
                success: false,
                action,
                stepsExecuted: [],
                error: `Unknown recovery action: ${action}`,
                durationMs: Date.now() - startTime,
            };
        }
        try {
            const result = await strategy.execute(context, params);
            const recoveryResult = {
                success: result.success,
                action,
                stepsExecuted: [action],
                finalState: result.data?.state,
                durationMs: Date.now() - startTime,
            };
            this.recoveryHistory.push({
                action,
                success: result.success,
                errorCategory: params?.errorCategory ?? 'unknown',
                timestamp: Date.now(),
            });
            this.publishEvent('agent.completed', {
                ...recoveryResult,
                correlationId,
            });
            return recoveryResult;
        }
        catch (error) {
            const failResult = {
                success: false,
                action,
                stepsExecuted: [action],
                error: error instanceof Error ? error.message : 'Recovery failed',
                durationMs: Date.now() - startTime,
            };
            this.recoveryHistory.push({
                action,
                success: false,
                errorCategory: params?.errorCategory ?? 'unknown',
                timestamp: Date.now(),
            });
            this.publishEvent('agent.error', {
                ...failResult,
                correlationId,
            });
            return failResult;
        }
    }
    async executeRecoverySequence(actions, context, params) {
        const startTime = Date.now();
        const stepsExecuted = [];
        let lastError;
        for (const action of actions) {
            const result = await this.executeRecovery(action, context, params);
            stepsExecuted.push(action);
            if (result.success) {
                return {
                    success: true,
                    action,
                    stepsExecuted,
                    finalState: result.finalState,
                    durationMs: Date.now() - startTime,
                };
            }
            lastError = result.error;
            // If action is 'abort' or 'notify_user', stop trying
            if (action === 'abort' || action === 'notify_user') {
                break;
            }
        }
        return {
            success: false,
            action: actions[actions.length - 1],
            stepsExecuted,
            error: lastError ?? 'All recovery actions failed',
            durationMs: Date.now() - startTime,
        };
    }
    createCheckpoint(context, label) {
        const checkpoint = {
            id: (0, uuid_1.v4)(),
            stepId: context.currentStep,
            timestamp: Date.now(),
            state: { ...context },
        };
        this.publishEvent('checkpoint.created', {
            checkpointId: checkpoint.id,
            stepId: context.currentStep,
            label,
        });
        return checkpoint;
    }
    async rollback(context, checkpointId) {
        const checkpoint = context.checkpoints.find((c) => c.id === checkpointId);
        if (!checkpoint) {
            return { success: false };
        }
        this.publishEvent('checkpoint.restored', {
            checkpointId,
            originalStep: context.currentStep,
            restoredStep: checkpoint.stepId,
        });
        return {
            success: true,
            restoredContext: {
                ...checkpoint.state,
                checkpoints: context.checkpoints, // Keep full checkpoint history
            },
        };
    }
    getSuccessRate(action, category) {
        let relevant = this.recoveryHistory;
        if (action) {
            relevant = relevant.filter((r) => r.action === action);
        }
        if (category) {
            relevant = relevant.filter((r) => r.errorCategory === category);
        }
        if (relevant.length === 0)
            return 0;
        return relevant.filter((r) => r.success).length / relevant.length;
    }
    getBestRecoveryAction(category) {
        const actionsForCategory = this.recoveryHistory
            .filter((r) => r.errorCategory === category && r.success)
            .reduce((acc, r) => {
            acc[r.action] = (acc[r.action] || 0) + 1;
            return acc;
        }, {});
        const sorted = Object.entries(actionsForCategory).sort((a, b) => b[1] - a[1]);
        return sorted[0]?.[0] || null;
    }
}
exports.TheRecoveryExpert = TheRecoveryExpert;
__decorate([
    (0, event_bus_1.traced)('recovery_expert.execute'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], TheRecoveryExpert.prototype, "executeRecovery", null);
__decorate([
    (0, event_bus_1.traced)('recovery_expert.execute_sequence'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object, Object]),
    __metadata("design:returntype", Promise)
], TheRecoveryExpert.prototype, "executeRecoverySequence", null);
__decorate([
    (0, event_bus_1.traced)('recovery_expert.create_checkpoint'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Object)
], TheRecoveryExpert.prototype, "createCheckpoint", null);
__decorate([
    (0, event_bus_1.traced)('recovery_expert.rollback'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], TheRecoveryExpert.prototype, "rollback", null);
// =============================================================================
// AGENT 27: THE LEARNING ENGINE
// =============================================================================
/**
 * THE LEARNING ENGINE
 * -------------------
 * Learns from execution patterns to improve future performance.
 * Identifies optimal strategies, timing, and element selectors.
 */
class TheLearningEngine extends BaseResilienceAgent {
    learningEvents = [];
    patterns = [];
    optimizations = new Map();
    maxEventsSize = 5000;
    constructor() {
        super('THE_LEARNING_ENGINE', { model: 'sonnet' });
    }
    recordEvent(event) {
        this.learningEvents.push({
            ...event,
            timestamp: event.timestamp ?? Date.now(),
        });
        // Trim if too large
        if (this.learningEvents.length > this.maxEventsSize) {
            this.learningEvents = this.learningEvents.slice(-this.maxEventsSize / 2);
        }
        this.publishEvent('learning.event_recorded', {
            eventType: event.type,
            success: event.success,
        });
    }
    async analyzePatterns() {
        this.publishEvent('agent.started', { action: 'analyze_patterns' });
        const patterns = [];
        // Analyze success/failure patterns by action type
        const actionStats = this.calculateActionStats();
        for (const [action, stats] of Object.entries(actionStats)) {
            if (stats.total >= 10) {
                patterns.push({
                    id: `action_${action}`,
                    type: 'action_success_rate',
                    pattern: action,
                    confidence: stats.successRate,
                    occurrences: stats.total,
                    recommendation: stats.successRate < 0.7
                        ? `Action "${action}" has low success rate (${(stats.successRate * 100).toFixed(1)}%). Consider alternative approaches.`
                        : undefined,
                });
            }
        }
        // Analyze timing patterns
        const timingPatterns = this.analyzeTimingPatterns();
        patterns.push(...timingPatterns);
        // Analyze error patterns
        const errorPatterns = this.analyzeErrorPatterns();
        patterns.push(...errorPatterns);
        this.patterns = patterns;
        this.publishEvent('agent.completed', {
            action: 'analyze_patterns',
            patternsFound: patterns.length,
        });
        return patterns;
    }
    async getOptimization(taskType, context) {
        // Check cached optimizations
        const cacheKey = `${taskType}_${JSON.stringify(context ?? {})}`;
        if (this.optimizations.has(cacheKey)) {
            return this.optimizations.get(cacheKey);
        }
        // Analyze relevant events
        const relevantEvents = this.learningEvents.filter((e) => e.taskType === taskType && e.success);
        if (relevantEvents.length < 5) {
            return null; // Not enough data
        }
        // Find optimal parameters
        const optimization = this.deriveOptimalParameters(relevantEvents);
        this.optimizations.set(cacheKey, optimization);
        return optimization;
    }
    async suggestSelector(element, platform, previousAttempts) {
        // Find successful selectors for similar elements
        const relevantEvents = this.learningEvents.filter((e) => e.type === 'selector_used' &&
            e.metadata?.platform === platform &&
            e.success);
        // Use LLM to suggest improved selector
        const systemPrompt = `You are THE LEARNING ENGINE. Suggest optimal CSS selectors.

Consider:
- Stability (IDs > data-* > aria-* > class > tag)
- Specificity (avoid overly broad selectors)
- Platform patterns (each site has conventions)

Respond with JSON:
{
  "selector": "recommended CSS selector",
  "confidence": 0.0 to 1.0,
  "reasoning": "why this selector",
  "alternatives": ["backup selectors"]
}`;
        const response = await this.callLLM(systemPrompt, `Element: ${element}\nPlatform: ${platform}\nPrevious attempts: ${JSON.stringify(previousAttempts ?? [])}\nSuccessful patterns: ${JSON.stringify(relevantEvents.slice(-10).map((e) => e.metadata?.selector))}`);
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch {
            // Fall through
        }
        return {
            selector: element,
            confidence: 0.3,
            reasoning: 'Using original selector (no improvements found)',
        };
    }
    async predictSuccess(taskType, platform, context) {
        const relevantEvents = this.learningEvents.filter((e) => e.taskType === taskType && e.metadata?.platform === platform);
        if (relevantEvents.length < 10) {
            return { probability: 0.5, factors: ['Insufficient historical data'] };
        }
        const successRate = relevantEvents.filter((e) => e.success).length / relevantEvents.length;
        const factors = [];
        // Analyze factors
        const recentSuccess = relevantEvents.slice(-10).filter((e) => e.success).length / 10;
        if (recentSuccess > successRate) {
            factors.push('Recent performance improving');
        }
        else if (recentSuccess < successRate) {
            factors.push('Recent performance declining');
        }
        // Time-based patterns
        const hour = new Date().getHours();
        const hourlySuccess = this.calculateHourlySuccessRate(relevantEvents);
        if (hourlySuccess[hour] !== undefined) {
            factors.push(`Historical success at this hour: ${(hourlySuccess[hour] * 100).toFixed(0)}%`);
        }
        return {
            probability: successRate,
            factors,
        };
    }
    calculateActionStats() {
        const stats = {};
        for (const event of this.learningEvents) {
            if (event.action) {
                if (!stats[event.action]) {
                    stats[event.action] = { success: 0, total: 0 };
                }
                stats[event.action].total++;
                if (event.success)
                    stats[event.action].success++;
            }
        }
        const result = {};
        for (const [action, data] of Object.entries(stats)) {
            result[action] = {
                total: data.total,
                successRate: data.success / data.total,
            };
        }
        return result;
    }
    analyzeTimingPatterns() {
        const patterns = [];
        // Group by action and calculate optimal timing
        const actionDurations = {};
        for (const event of this.learningEvents.filter((e) => e.success && e.durationMs)) {
            if (event.action) {
                if (!actionDurations[event.action]) {
                    actionDurations[event.action] = [];
                }
                actionDurations[event.action].push(event.durationMs);
            }
        }
        for (const [action, durations] of Object.entries(actionDurations)) {
            if (durations.length >= 10) {
                const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
                const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
                patterns.push({
                    id: `timing_${action}`,
                    type: 'timing',
                    pattern: action,
                    confidence: 0.8,
                    occurrences: durations.length,
                    data: { avgMs: avg, p95Ms: p95 },
                });
            }
        }
        return patterns;
    }
    analyzeErrorPatterns() {
        const patterns = [];
        // Find repeated errors
        const errorCounts = {};
        for (const event of this.learningEvents.filter((e) => !e.success && e.error)) {
            const key = event.error;
            errorCounts[key] = (errorCounts[key] || 0) + 1;
        }
        for (const [error, count] of Object.entries(errorCounts)) {
            if (count >= 5) {
                patterns.push({
                    id: `error_${error.slice(0, 20)}`,
                    type: 'repeated_error',
                    pattern: error,
                    confidence: count / this.learningEvents.length,
                    occurrences: count,
                    recommendation: `Recurring error: "${error}". Consider implementing specific handling.`,
                });
            }
        }
        return patterns;
    }
    deriveOptimalParameters(events) {
        // Calculate average successful parameters
        const delays = [];
        const timeouts = [];
        for (const event of events) {
            if (event.metadata?.delay)
                delays.push(event.metadata.delay);
            if (event.metadata?.timeout)
                timeouts.push(event.metadata.timeout);
        }
        return {
            optimalDelay: delays.length > 0 ? delays.reduce((a, b) => a + b, 0) / delays.length : 100,
            optimalTimeout: timeouts.length > 0 ? timeouts.reduce((a, b) => a + b, 0) / timeouts.length : 10000,
            sampleSize: events.length,
        };
    }
    calculateHourlySuccessRate(events) {
        const hourly = {};
        for (const event of events) {
            const hour = new Date(event.timestamp).getHours();
            if (!hourly[hour])
                hourly[hour] = { success: 0, total: 0 };
            hourly[hour].total++;
            if (event.success)
                hourly[hour].success++;
        }
        const result = {};
        for (const [hour, data] of Object.entries(hourly)) {
            result[parseInt(hour)] = data.success / data.total;
        }
        return result;
    }
    getPatterns() {
        return [...this.patterns];
    }
    getStats() {
        const successful = this.learningEvents.filter((e) => e.success).length;
        const actionStats = this.calculateActionStats();
        const topActions = Object.entries(actionStats)
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, 5)
            .map(([action]) => action);
        return {
            totalEvents: this.learningEvents.length,
            successRate: this.learningEvents.length > 0 ? successful / this.learningEvents.length : 0,
            topActions,
        };
    }
    clearData() {
        this.learningEvents = [];
        this.patterns = [];
        this.optimizations.clear();
    }
}
exports.TheLearningEngine = TheLearningEngine;
__decorate([
    (0, event_bus_1.traced)('learning_engine.analyze_patterns'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheLearningEngine.prototype, "analyzePatterns", null);
__decorate([
    (0, event_bus_1.traced)('learning_engine.get_optimization'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TheLearningEngine.prototype, "getOptimization", null);
__decorate([
    (0, event_bus_1.traced)('learning_engine.suggest_selector'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Array]),
    __metadata("design:returntype", Promise)
], TheLearningEngine.prototype, "suggestSelector", null);
__decorate([
    (0, event_bus_1.traced)('learning_engine.predict_success'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TheLearningEngine.prototype, "predictSuccess", null);
// =============================================================================
// FACTORY & EXPORTS
// =============================================================================
function createResilienceAgents() {
    return {
        errorHandler: new TheErrorHandler(),
        recoveryExpert: new TheRecoveryExpert(),
        learningEngine: new TheLearningEngine(),
    };
}
exports.createResilienceAgents = createResilienceAgents;
//# sourceMappingURL=tier4-resilience.js.map