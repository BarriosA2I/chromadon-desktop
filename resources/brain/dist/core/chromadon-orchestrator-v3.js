"use strict";
// @ts-nocheck
// TODO: Fix strict TypeScript issues in this file
/**
 * CHROMADON Integration Layer v3.0
 * ================================
 * Connects Neural RAG AI Engine v3 to the CDP Controller.
 *
 * Features:
 * - Seamless AI command processing
 * - Page context extraction
 * - Action execution with verification
 * - Error recovery with circuit breakers
 * - Full observability integration
 *
 * Author: Barrios A2I
 * Version: 3.0.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRegistry = exports.createChromadonOrchestrator = exports.ChromadonOrchestrator = exports.ActionExecutor = void 0;
const events_1 = require("events");
const api_1 = require("@opentelemetry/api");
const prom_client_1 = require("prom-client");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('orchestrator');
// ============================================================================
// PROMETHEUS METRICS
// ============================================================================
const metricsRegistry = new prom_client_1.Registry();
exports.metricsRegistry = metricsRegistry;
const commandsProcessed = new prom_client_1.Counter({
    name: 'chromadon_commands_processed_total',
    help: 'Total commands processed',
    labelNames: ['status', 'cognitive_mode'],
    registers: [metricsRegistry],
});
const actionsExecuted = new prom_client_1.Counter({
    name: 'chromadon_actions_executed_total',
    help: 'Total actions executed',
    labelNames: ['action_type', 'status'],
    registers: [metricsRegistry],
});
const commandLatency = new prom_client_1.Histogram({
    name: 'chromadon_command_latency_seconds',
    help: 'Command processing latency',
    labelNames: ['cognitive_mode'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
});
const actionLatency = new prom_client_1.Histogram({
    name: 'chromadon_action_latency_seconds',
    help: 'Action execution latency',
    labelNames: ['action_type'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [metricsRegistry],
});
const confidenceScores = new prom_client_1.Histogram({
    name: 'chromadon_confidence_scores',
    help: 'AI confidence scores',
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registers: [metricsRegistry],
});
const activeCommands = new prom_client_1.Gauge({
    name: 'chromadon_active_commands',
    help: 'Currently processing commands',
    registers: [metricsRegistry],
});
// ============================================================================
// TRACER
// ============================================================================
const tracer = api_1.trace.getTracer('chromadon-integration', '3.0.0');
// ============================================================================
// ACTION EXECUTOR
// ============================================================================
class ActionExecutor {
    cdp;
    retryConfig = {
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
    };
    constructor(cdp) {
        this.cdp = cdp;
    }
    /**
     * Execute a single AI action with retries and observability
     */
    async execute(action) {
        return tracer.startActiveSpan(`action.${action.type}`, async (span) => {
            span.setAttribute('action.type', action.type);
            span.setAttribute('action.description', action.description);
            const startTime = Date.now();
            let lastError = null;
            for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
                try {
                    span.setAttribute('action.attempt', attempt + 1);
                    const result = await this.executeAction(action);
                    const durationMs = Date.now() - startTime;
                    // Record metrics
                    actionsExecuted.labels(action.type, 'success').inc();
                    actionLatency.labels(action.type).observe(durationMs / 1000);
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    span.setAttribute('action.duration_ms', durationMs);
                    return {
                        success: true,
                        action,
                        result,
                        durationMs,
                    };
                }
                catch (error) {
                    lastError = error;
                    span.recordException(lastError);
                    if (attempt < this.retryConfig.maxRetries) {
                        const delay = Math.min(this.retryConfig.baseDelayMs * Math.pow(2, attempt), this.retryConfig.maxDelayMs);
                        span.addEvent('retry_scheduled', { delay_ms: delay, attempt: attempt + 1 });
                        await this.sleep(delay);
                    }
                }
            }
            // All retries exhausted
            const durationMs = Date.now() - startTime;
            actionsExecuted.labels(action.type, 'error').inc();
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: lastError?.message });
            return {
                success: false,
                action,
                error: lastError?.message || 'Unknown error',
                durationMs,
            };
        });
    }
    /**
     * Execute action based on type
     */
    async executeAction(action) {
        const { type, params } = action;
        switch (type) {
            case 'navigate':
                await this.cdp.navigate(params.url);
                return { navigated: params.url };
            case 'click':
                await this.cdp.waitForSelector(params.selector, 5000);
                await this.cdp.click(params.selector);
                return { clicked: params.selector };
            case 'type':
                await this.cdp.waitForSelector(params.selector, 5000);
                await this.cdp.type(params.selector, params.text);
                return { typed: params.text, into: params.selector };
            case 'scroll':
                await this.cdp.scroll(params.direction, params.amount);
                return { scrolled: params.direction };
            case 'screenshot':
                const screenshot = await this.cdp.screenshot();
                return { screenshot };
            case 'extract':
                const text = await this.cdp.extractText(params.selector);
                return { extracted: text };
            case 'hover':
                await this.cdp.waitForSelector(params.selector, 5000);
                await this.cdp.hover(params.selector);
                return { hovered: params.selector };
            case 'wait':
                await this.sleep(params.duration || 1000);
                return { waited: params.duration };
            default:
                throw new Error(`Unknown action type: ${type}`);
        }
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ActionExecutor = ActionExecutor;
/**
 * CHROMADON Orchestrator v3.0
 *
 * Integrates Neural RAG AI Engine v3 with CDP Controller.
 * Handles the full command lifecycle:
 * 1. Extract page context
 * 2. Process command through AI Engine
 * 3. Execute actions with verification
 * 4. Update memory with results
 */
class ChromadonOrchestrator extends events_1.EventEmitter {
    aiEngine;
    cdp;
    executor;
    config;
    isProcessing = false;
    constructor(aiEngine, cdp, config = {}) {
        super();
        this.aiEngine = aiEngine;
        this.cdp = cdp;
        this.executor = new ActionExecutor(cdp);
        this.config = {
            minConfidence: 0.6,
            maxActionsPerCommand: 10,
            screenshotOnAction: false,
            verifyActions: true,
            commandTimeoutMs: 60000,
            ...config,
        };
    }
    /**
     * Process a user command end-to-end
     */
    async processCommand(command) {
        return tracer.startActiveSpan('chromadon.process_command', async (span) => {
            span.setAttribute('command', command.substring(0, 100));
            if (this.isProcessing) {
                throw new Error('Another command is being processed');
            }
            this.isProcessing = true;
            activeCommands.inc();
            const startTime = Date.now();
            try {
                // 1. Extract page context
                span.addEvent('extracting_page_context');
                const pageContext = await this.extractPageContext();
                span.setAttribute('page.url', pageContext.url);
                span.setAttribute('page.title', pageContext.title);
                // 2. Process through AI Engine
                span.addEvent('processing_with_ai_engine');
                const aiResponse = await this.withTimeout(this.aiEngine.processCommand(command, pageContext), this.config.commandTimeoutMs - 5000, // Leave 5s for action execution
                'AI Engine timeout');
                span.setAttribute('ai.confidence', aiResponse.confidence);
                span.setAttribute('ai.cognitive_mode', aiResponse.cognitiveMode);
                span.setAttribute('ai.actions_count', aiResponse.actions.length);
                if (aiResponse.verificationScore !== undefined) {
                    span.setAttribute('ai.verification_score', aiResponse.verificationScore);
                }
                // Record confidence metric
                confidenceScores.observe(aiResponse.confidence);
                // 3. Check confidence threshold
                if (aiResponse.confidence < this.config.minConfidence) {
                    span.addEvent('low_confidence', {
                        confidence: aiResponse.confidence,
                        threshold: this.config.minConfidence
                    });
                    this.emit('lowConfidence', {
                        command,
                        confidence: aiResponse.confidence,
                        threshold: this.config.minConfidence,
                    });
                    // Still return the response but with empty execution
                    const durationMs = Date.now() - startTime;
                    commandsProcessed.labels('low_confidence', aiResponse.cognitiveMode).inc();
                    commandLatency.labels(aiResponse.cognitiveMode).observe(durationMs / 1000);
                    return {
                        success: false,
                        command,
                        response: aiResponse,
                        executionResults: [],
                        totalDurationMs: durationMs,
                        confidence: aiResponse.confidence,
                        cognitiveMode: aiResponse.cognitiveMode,
                    };
                }
                // 4. Execute actions
                span.addEvent('executing_actions');
                const executionResults = await this.executeActions(aiResponse.actions, span);
                // 5. Verify results if configured
                if (this.config.verifyActions) {
                    span.addEvent('verifying_results');
                    await this.verifyResults(executionResults, pageContext);
                }
                const durationMs = Date.now() - startTime;
                const allSuccessful = executionResults.every(r => r.success);
                // Record metrics
                commandsProcessed.labels(allSuccessful ? 'success' : 'partial', aiResponse.cognitiveMode).inc();
                commandLatency.labels(aiResponse.cognitiveMode).observe(durationMs / 1000);
                span.setStatus({ code: allSuccessful ? api_1.SpanStatusCode.OK : api_1.SpanStatusCode.ERROR });
                span.setAttribute('total_duration_ms', durationMs);
                span.setAttribute('all_successful', allSuccessful);
                const result = {
                    success: allSuccessful,
                    command,
                    response: aiResponse,
                    executionResults,
                    totalDurationMs: durationMs,
                    confidence: aiResponse.confidence,
                    cognitiveMode: aiResponse.cognitiveMode,
                };
                this.emit('commandCompleted', result);
                return result;
            }
            catch (error) {
                const err = error;
                span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: err.message });
                span.recordException(err);
                commandsProcessed.labels('error', 'unknown').inc();
                this.emit('commandError', { command, error: err });
                throw err;
            }
            finally {
                this.isProcessing = false;
                activeCommands.dec();
            }
        });
    }
    /**
     * Extract comprehensive page context from CDP
     */
    async extractPageContext() {
        return tracer.startActiveSpan('extract_page_context', async (span) => {
            const context = await this.cdp.getPageContext();
            // Extract interactive elements if not provided
            if (!context.interactiveElements) {
                try {
                    context.interactiveElements = await this.cdp.evaluate(`
            (() => {
              const interactives = document.querySelectorAll(
                'button, a, input, textarea, select, [role="button"], [onclick], [tabindex]'
              );
              return Array.from(interactives)
                .slice(0, 50)
                .map(el => {
                  const tag = el.tagName.toLowerCase();
                  const id = el.id ? '#' + el.id : '';
                  const classes = el.className ? '.' + el.className.split(' ').join('.') : '';
                  const text = el.textContent?.trim().substring(0, 30) || '';
                  const type = el.getAttribute('type') || '';
                  const placeholder = el.getAttribute('placeholder') || '';
                  return \`[\${tag}\${id}\${classes}] \${text} \${type} \${placeholder}\`.trim();
                })
                .join('\\n');
            })()
          `);
                }
                catch (e) {
                    context.interactiveElements = '';
                }
            }
            span.setAttribute('context.url', context.url);
            span.setAttribute('context.title', context.title);
            span.setAttribute('context.text_length', context.visibleText.length);
            return context;
        });
    }
    /**
     * Execute a list of actions sequentially
     */
    async executeActions(actions, parentSpan) {
        const results = [];
        const actionsToExecute = actions.slice(0, this.config.maxActionsPerCommand);
        for (let i = 0; i < actionsToExecute.length; i++) {
            const action = actionsToExecute[i];
            parentSpan.addEvent('executing_action', {
                index: i,
                type: action.type,
                description: action.description
            });
            // Take screenshot before action if configured
            if (this.config.screenshotOnAction) {
                try {
                    await this.cdp.screenshot();
                }
                catch (e) {
                    // Ignore screenshot errors
                }
            }
            const result = await this.executor.execute(action);
            results.push(result);
            this.emit('actionExecuted', { action, result, index: i });
            // Stop execution on failure (unless it's a non-critical action)
            if (!result.success && action.type !== 'screenshot') {
                parentSpan.addEvent('action_failed', {
                    index: i,
                    error: result.error
                });
                break;
            }
            // Small delay between actions for stability
            if (i < actionsToExecute.length - 1) {
                await this.sleep(100);
            }
        }
        return results;
    }
    /**
     * Verify action results by checking page state
     */
    async verifyResults(results, originalContext) {
        // Get current page context
        const currentContext = await this.cdp.getPageContext();
        // Emit verification event for external handling
        this.emit('resultsVerified', {
            originalContext,
            currentContext,
            results,
            pageChanged: currentContext.url !== originalContext.url,
        });
    }
    /**
     * Wrap a promise with a timeout
     */
    withTimeout(promise, timeoutMs, message) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
        ]);
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // ============================================================================
    // STATUS & DIAGNOSTICS
    // ============================================================================
    /**
     * Get orchestrator status
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            aiEngineMemory: this.aiEngine.getMemoryStats(),
            circuitBreaker: this.aiEngine.getCircuitBreakerState(),
        };
    }
    /**
     * Reset AI engine state
     */
    reset() {
        this.aiEngine.resetCircuitBreaker();
        this.emit('reset');
    }
    /**
     * Get Prometheus metrics
     */
    getMetrics() {
        return metricsRegistry.metrics();
    }
}
exports.ChromadonOrchestrator = ChromadonOrchestrator;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
/**
 * Create a fully configured CHROMADON Orchestrator
 */
function createChromadonOrchestrator(aiEngine, cdp, config) {
    const orchestrator = new ChromadonOrchestrator(aiEngine, cdp, config);
    // Setup default event handlers
    orchestrator.on('commandCompleted', (result) => {
        log.info(`[CHROMADON] Command completed: ${result.success ? '✓' : '✗'} (${result.totalDurationMs}ms, confidence: ${result.confidence.toFixed(2)})`);
    });
    orchestrator.on('lowConfidence', ({ confidence, threshold }) => {
        log.warn(`[CHROMADON] Low confidence: ${confidence.toFixed(2)} < ${threshold}`);
    });
    orchestrator.on('commandError', ({ command, error }) => {
        log.error(`[CHROMADON] Command error: ${error.message}`);
    });
    orchestrator.on('actionExecuted', ({ action, result, index }) => {
        const status = result.success ? '✓' : '✗';
        log.info(`[CHROMADON] Action ${index + 1}: ${status} ${action.type} - ${action.description}`);
    });
    return orchestrator;
}
exports.createChromadonOrchestrator = createChromadonOrchestrator;
//# sourceMappingURL=chromadon-orchestrator-v3.js.map