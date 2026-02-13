"use strict";
// @ts-nocheck
// TODO: Fix strict TypeScript issues in this file
/**
 * CHROMADON AI Engine v3.0 - Neural RAG Brain Edition
 * ====================================================
 * Production-grade AI command layer with:
 * - Circuit Breakers for Anthropic API resilience
 * - Dual-Process Router (System 1/2 cognitive routing)
 * - Self-Reflection Tokens [RET][REL][SUP][USE]
 * - Hierarchical Memory (4-tier)
 * - OpenTelemetry observability
 *
 * Battle-tested architecture from 230K+ automations.
 *
 * @author Barrios A2I
 * @version 3.0.0
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralRAGAIEngine = exports.HierarchicalMemory = exports.SelfReflection = exports.DualProcessRouter = exports.CircuitBreakerOpenError = exports.CircuitBreaker = exports.metricsRegistry = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const api_1 = require("@opentelemetry/api");
const prom_client_1 = require("prom-client");
const uuid_1 = require("uuid");
const immer_1 = require("immer");
// ============================================================================
// PROMETHEUS METRICS
// ============================================================================
const metricsRegistry = new prom_client_1.Registry();
exports.metricsRegistry = metricsRegistry;
const aiEngineCallsTotal = new prom_client_1.Counter({
    name: 'chromadon_ai_engine_calls_total',
    help: 'Total AI engine calls',
    labelNames: ['model', 'cognitive_mode', 'status'],
    registers: [metricsRegistry],
});
const aiEngineLatency = new prom_client_1.Histogram({
    name: 'chromadon_ai_engine_latency_seconds',
    help: 'AI engine latency in seconds',
    labelNames: ['model', 'cognitive_mode'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
});
const circuitBreakerState = new prom_client_1.Gauge({
    name: 'chromadon_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['component'],
    registers: [metricsRegistry],
});
const prmVerificationScore = new prom_client_1.Histogram({
    name: 'chromadon_prm_verification_score',
    help: 'PRM verification scores',
    labelNames: ['cognitive_mode'],
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registers: [metricsRegistry],
});
const reflectionTokenScores = new prom_client_1.Histogram({
    name: 'chromadon_reflection_token_scores',
    help: 'Self-reflection token scores',
    labelNames: ['token'],
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
    registers: [metricsRegistry],
});
const memoryTierHits = new prom_client_1.Counter({
    name: 'chromadon_memory_tier_hits_total',
    help: 'Memory tier cache hits',
    labelNames: ['tier'],
    registers: [metricsRegistry],
});
// ============================================================================
// CIRCUIT BREAKER
// ============================================================================
class CircuitBreaker {
    state;
    config;
    tracer;
    componentName;
    constructor(componentName, config) {
        this.componentName = componentName;
        this.config = {
            failureThreshold: config?.failureThreshold ?? 5,
            successThreshold: config?.successThreshold ?? 3,
            recoveryTimeoutMs: config?.recoveryTimeoutMs ?? 60000,
            monitorWindowMs: config?.monitorWindowMs ?? 120000,
        };
        this.state = {
            state: 'closed',
            failures: 0,
            successes: 0,
            totalCalls: 0,
            totalFailures: 0,
        };
        this.tracer = api_1.trace.getTracer('chromadon-circuit-breaker');
        this.updateMetric();
    }
    updateMetric() {
        const stateValue = this.state.state === 'closed' ? 0 : this.state.state === 'open' ? 1 : 2;
        circuitBreakerState.labels(this.componentName).set(stateValue);
    }
    async call(fn) {
        const span = this.tracer.startSpan(`circuit-breaker-${this.componentName}`);
        span.setAttribute('circuit_breaker.component', this.componentName);
        span.setAttribute('circuit_breaker.state_before', this.state.state);
        try {
            // Check if circuit is open
            if (this.state.state === 'open') {
                const timeSinceFailure = Date.now() - (this.state.lastFailure || 0);
                if (timeSinceFailure >= this.config.recoveryTimeoutMs) {
                    // Transition to half-open
                    this.state = (0, immer_1.produce)(this.state, draft => {
                        draft.state = 'half-open';
                        draft.successes = 0;
                    });
                    this.updateMetric();
                    span.setAttribute('circuit_breaker.transition', 'open->half-open');
                    console.log(`[CircuitBreaker:${this.componentName}] Transitioning to half-open after ${timeSinceFailure}ms`);
                }
                else {
                    span.setAttribute('circuit_breaker.rejected', true);
                    span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: 'Circuit breaker open' });
                    span.end();
                    throw new CircuitBreakerOpenError(this.componentName, this.config.recoveryTimeoutMs - timeSinceFailure);
                }
            }
            // Execute the function
            const startTime = Date.now();
            const result = await fn();
            const duration = Date.now() - startTime;
            // Record success
            this.onSuccess();
            span.setAttribute('circuit_breaker.duration_ms', duration);
            span.setAttribute('circuit_breaker.state_after', this.state.state);
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            span.end();
            return result;
        }
        catch (error) {
            // Don't count circuit breaker errors as failures
            if (error instanceof CircuitBreakerOpenError) {
                throw error;
            }
            this.onFailure(error);
            span.setAttribute('circuit_breaker.state_after', this.state.state);
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            span.recordException(error);
            span.end();
            throw error;
        }
    }
    onSuccess() {
        this.state = (0, immer_1.produce)(this.state, draft => {
            draft.totalCalls++;
            draft.lastSuccess = Date.now();
            if (draft.state === 'half-open') {
                draft.successes++;
                if (draft.successes >= this.config.successThreshold) {
                    // Transition to closed
                    draft.state = 'closed';
                    draft.failures = 0;
                    draft.successes = 0;
                    console.log(`[CircuitBreaker:${this.componentName}] Circuit CLOSED after ${this.config.successThreshold} successes`);
                }
            }
            else if (draft.state === 'closed') {
                // Reset failure count on success in closed state
                draft.failures = Math.max(0, draft.failures - 1);
            }
        });
        this.updateMetric();
    }
    onFailure(error) {
        this.state = (0, immer_1.produce)(this.state, draft => {
            draft.totalCalls++;
            draft.totalFailures++;
            draft.failures++;
            draft.lastFailure = Date.now();
            if (draft.state === 'half-open') {
                // Any failure in half-open returns to open
                draft.state = 'open';
                console.log(`[CircuitBreaker:${this.componentName}] Circuit OPEN (half-open failure): ${error.message}`);
            }
            else if (draft.state === 'closed' && draft.failures >= this.config.failureThreshold) {
                // Trip the circuit
                draft.state = 'open';
                console.log(`[CircuitBreaker:${this.componentName}] Circuit OPEN after ${draft.failures} failures: ${error.message}`);
            }
        });
        this.updateMetric();
    }
    getState() {
        return { ...this.state };
    }
    reset() {
        this.state = {
            state: 'closed',
            failures: 0,
            successes: 0,
            totalCalls: this.state.totalCalls,
            totalFailures: this.state.totalFailures,
        };
        this.updateMetric();
        console.log(`[CircuitBreaker:${this.componentName}] Circuit manually reset`);
    }
}
exports.CircuitBreaker = CircuitBreaker;
class CircuitBreakerOpenError extends Error {
    component;
    retryAfterMs;
    constructor(component, retryAfterMs) {
        super(`Circuit breaker open for ${component}. Retry after ${retryAfterMs}ms`);
        this.component = component;
        this.retryAfterMs = retryAfterMs;
        this.name = 'CircuitBreakerOpenError';
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
// ============================================================================
// DUAL-PROCESS COGNITIVE ROUTER
// ============================================================================
class DualProcessRouter {
    tracer;
    // System 1 patterns: Fast, intuitive commands (complexity 1-3)
    system1Patterns = [
        /^(go to|open|visit)\s+\S+$/i,
        /^(click|tap|press)\s+.{1,30}$/i,
        /^(scroll|page)\s+(up|down|left|right)$/i,
        /^(back|forward|reload|refresh)$/i,
        /^screenshot$/i,
        /^(type|enter|input)\s+.{1,50}$/i,
        /^wait\s+\d+\s*(s|seconds?|ms)?$/i,
    ];
    // System 2 patterns: Slow, deliberate reasoning (complexity 7-10)
    system2Patterns = [
        /analyze|evaluate|compare|contrast|synthesize/i,
        /research|investigate|find\s+all|gather|collect/i,
        /fill\s+(out|in)\s+(the\s+)?(entire\s+)?form/i,
        /multi-?step|sequence|workflow|automate/i,
        /if\s+.+\s+then|otherwise|conditional/i,
        /loop|repeat|iterate|for\s+each/i,
        /scrape|extract\s+(all|multiple|data)/i,
        /summarize|create\s+report|generate\s+summary/i,
        /compare\s+.+\s+(with|to|against)/i,
    ];
    // Complexity indicators
    complexityIndicators = [
        { pattern: /\band\b/gi, weight: 0.5 },
        { pattern: /\bthen\b/gi, weight: 1 },
        { pattern: /\bafter\b/gi, weight: 0.5 },
        { pattern: /\bif\b/gi, weight: 1.5 },
        { pattern: /\ball\b/gi, weight: 1 },
        { pattern: /\bmultiple\b/gi, weight: 1 },
        { pattern: /\beach\b/gi, weight: 1 },
        { pattern: /\bevery\b/gi, weight: 1 },
    ];
    constructor() {
        this.tracer = api_1.trace.getTracer('chromadon-dual-process-router');
    }
    classify(command) {
        const span = this.tracer.startSpan('classify-command');
        span.setAttribute('command_length', command.length);
        try {
            // Check System 1 patterns first (fast path)
            for (const pattern of this.system1Patterns) {
                if (pattern.test(command)) {
                    const result = {
                        type: 'simple',
                        complexity: 2,
                        usePRM: false,
                        model: 'claude-3-5-haiku-latest',
                        thinkBudget: 500,
                        cognitiveMode: 'system1',
                    };
                    span.setAttribute('cognitive_mode', 'system1');
                    span.setAttribute('complexity', result.complexity);
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    span.end();
                    return result;
                }
            }
            // Check System 2 patterns (slow path)
            for (const pattern of this.system2Patterns) {
                if (pattern.test(command)) {
                    const result = {
                        type: 'complex',
                        complexity: 8,
                        usePRM: true,
                        model: 'claude-sonnet-4-20250514',
                        thinkBudget: 8000,
                        cognitiveMode: 'system2',
                    };
                    span.setAttribute('cognitive_mode', 'system2');
                    span.setAttribute('complexity', result.complexity);
                    span.setStatus({ code: api_1.SpanStatusCode.OK });
                    span.end();
                    return result;
                }
            }
            // Calculate complexity score for hybrid classification
            let complexityScore = 3; // Base complexity
            for (const indicator of this.complexityIndicators) {
                const matches = command.match(indicator.pattern);
                if (matches) {
                    complexityScore += matches.length * indicator.weight;
                }
            }
            // Word count affects complexity
            const wordCount = command.split(/\s+/).length;
            if (wordCount > 15)
                complexityScore += 1;
            if (wordCount > 30)
                complexityScore += 1;
            // Cap complexity at 10
            complexityScore = Math.min(10, complexityScore);
            // Determine mode based on calculated complexity
            if (complexityScore <= 3) {
                const result = {
                    type: 'simple',
                    complexity: complexityScore,
                    usePRM: false,
                    model: 'claude-3-5-haiku-latest',
                    thinkBudget: 500,
                    cognitiveMode: 'system1',
                };
                span.setAttribute('cognitive_mode', 'system1');
                span.setAttribute('complexity', result.complexity);
                span.setStatus({ code: api_1.SpanStatusCode.OK });
                span.end();
                return result;
            }
            if (complexityScore >= 7) {
                const result = {
                    type: 'complex',
                    complexity: complexityScore,
                    usePRM: true,
                    model: 'claude-sonnet-4-20250514',
                    thinkBudget: 8000,
                    cognitiveMode: 'system2',
                };
                span.setAttribute('cognitive_mode', 'system2');
                span.setAttribute('complexity', result.complexity);
                span.setStatus({ code: api_1.SpanStatusCode.OK });
                span.end();
                return result;
            }
            // Hybrid mode: Start with fast model, escalate if confidence low
            const result = {
                type: 'moderate',
                complexity: complexityScore,
                usePRM: false, // Will be enabled on escalation
                model: 'claude-sonnet-4-20250514',
                thinkBudget: 3000,
                cognitiveMode: 'hybrid',
            };
            span.setAttribute('cognitive_mode', 'hybrid');
            span.setAttribute('complexity', result.complexity);
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            span.end();
            return result;
        }
        catch (error) {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            span.end();
            throw error;
        }
    }
    shouldEscalate(confidence, threshold = 0.75) {
        return confidence < threshold;
    }
}
exports.DualProcessRouter = DualProcessRouter;
// ============================================================================
// SELF-REFLECTION ENGINE
// ============================================================================
class SelfReflection {
    client;
    circuitBreaker;
    tracer;
    constructor(client) {
        this.client = client;
        this.circuitBreaker = new CircuitBreaker('self-reflection', {
            failureThreshold: 3,
            recoveryTimeoutMs: 30000,
        });
        this.tracer = api_1.trace.getTracer('chromadon-self-reflection');
    }
    async evaluateResponse(query, response, context) {
        const span = this.tracer.startSpan('evaluate-response');
        span.setAttribute('query_length', query.length);
        span.setAttribute('response_length', response.length);
        const prompt = `You are a critical evaluator for browser automation responses. Evaluate this response:

ORIGINAL QUERY: ${query}

PAGE CONTEXT: ${context.slice(0, 1000)}

PROPOSED RESPONSE/ACTIONS: ${response}

Evaluate on these dimensions (score 0.0 to 1.0):

1. [RET] RETRIEVAL NEEDED: Does this response need additional information from the page?
   - 0.0 = Has all needed info
   - 1.0 = Missing critical information

2. [REL] RELEVANCE: Is the response directly relevant to what the user asked?
   - 0.0 = Completely off-topic
   - 1.0 = Perfectly addresses the query

3. [SUP] SUPPORTED: Are the proposed actions supported by the page context?
   - 0.0 = Actions reference non-existent elements
   - 1.0 = All actions are clearly supported

4. [USE] USEFUL: Will executing these actions achieve the user's goal?
   - 0.0 = Will not help at all
   - 1.0 = Will completely accomplish the goal

Respond ONLY with valid JSON:
{
  "shouldRetrieve": false,
  "relevanceScore": 0.9,
  "supportScore": 0.85,
  "usefulScore": 0.92,
  "confidence": 0.89,
  "feedback": "Brief explanation if any issues"
}`;
        try {
            const result = await this.circuitBreaker.call(async () => {
                return this.client.messages.create({
                    model: 'claude-3-5-haiku-latest',
                    max_tokens: 300,
                    messages: [{ role: 'user', content: prompt }],
                });
            });
            const text = result.content[0].type === 'text' ? result.content[0].text : '';
            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in reflection response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            const reflectionResult = {
                shouldRetrieve: parsed.shouldRetrieve ?? false,
                isRelevant: (parsed.relevanceScore ?? 0.5) >= 0.7,
                isSupported: (parsed.supportScore ?? 0.5) >= 0.7,
                isUseful: (parsed.usefulScore ?? 0.5) >= 0.7,
                confidence: parsed.confidence ?? 0.5,
                feedback: parsed.feedback,
            };
            // Record metrics
            reflectionTokenScores.labels('RET').observe(parsed.shouldRetrieve ? 1 : 0);
            reflectionTokenScores.labels('REL').observe(parsed.relevanceScore ?? 0.5);
            reflectionTokenScores.labels('SUP').observe(parsed.supportScore ?? 0.5);
            reflectionTokenScores.labels('USE').observe(parsed.usefulScore ?? 0.5);
            span.setAttribute('should_retrieve', reflectionResult.shouldRetrieve);
            span.setAttribute('is_relevant', reflectionResult.isRelevant);
            span.setAttribute('is_supported', reflectionResult.isSupported);
            span.setAttribute('is_useful', reflectionResult.isUseful);
            span.setAttribute('confidence', reflectionResult.confidence);
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            span.end();
            return reflectionResult;
        }
        catch (error) {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            span.end();
            // Return safe defaults on error
            return {
                shouldRetrieve: false,
                isRelevant: true,
                isSupported: true,
                isUseful: true,
                confidence: 0.5,
                feedback: `Reflection failed: ${error.message}`,
            };
        }
    }
}
exports.SelfReflection = SelfReflection;
// ============================================================================
// HIERARCHICAL MEMORY (4-TIER)
// ============================================================================
class HierarchicalMemory {
    tracer;
    // L0: Working memory (active context, 7±2 items)
    workingMemory = [];
    workingCapacity = 7;
    // L1: Episodic memory (recent interactions, decays over 24h)
    episodicMemory = new Map();
    episodicTau = 86400000; // 24h decay constant
    episodicMaxSize = 100;
    // L2: Semantic memory (extracted patterns and facts)
    semanticMemory = new Map();
    semanticMaxSize = 50;
    // L3: Procedural memory (successful command sequences)
    proceduralMemory = new Map();
    proceduralMaxSize = 30;
    constructor() {
        this.tracer = api_1.trace.getTracer('chromadon-hierarchical-memory');
    }
    addToWorking(content, importance = 1.0) {
        const id = (0, uuid_1.v4)();
        const trace = {
            id,
            content,
            timestamp: Date.now(),
            accessCount: 1,
            importance,
        };
        this.workingMemory.push(trace);
        // Evict oldest if over capacity
        if (this.workingMemory.length > this.workingCapacity) {
            const evicted = this.workingMemory.shift();
            // Consolidate to episodic
            if (evicted && evicted.importance > 0.5) {
                this.addToEpisodic(evicted.content, evicted.importance);
            }
        }
        memoryTierHits.labels('L0_working').inc();
        return id;
    }
    addToEpisodic(content, importance = 1.0) {
        const id = (0, uuid_1.v4)();
        const trace = {
            id,
            content,
            timestamp: Date.now(),
            accessCount: 1,
            importance,
        };
        this.episodicMemory.set(id, trace);
        // Evict least important if over capacity
        if (this.episodicMemory.size > this.episodicMaxSize) {
            this.evictLeastImportant(this.episodicMemory);
        }
        memoryTierHits.labels('L1_episodic').inc();
        return id;
    }
    addToSemantic(key, content, importance = 1.0) {
        this.semanticMemory.set(key, { content, importance });
        if (this.semanticMemory.size > this.semanticMaxSize) {
            // Remove lowest importance
            let minKey = null;
            let minImportance = Infinity;
            for (const [k, v] of this.semanticMemory) {
                if (v.importance < minImportance) {
                    minImportance = v.importance;
                    minKey = k;
                }
            }
            if (minKey)
                this.semanticMemory.delete(minKey);
        }
        memoryTierHits.labels('L2_semantic').inc();
    }
    addToProcedural(pattern, steps, successRate = 1.0) {
        this.proceduralMemory.set(pattern, { steps, successRate });
        if (this.proceduralMemory.size > this.proceduralMaxSize) {
            // Remove lowest success rate
            let minKey = null;
            let minRate = Infinity;
            for (const [k, v] of this.proceduralMemory) {
                if (v.successRate < minRate) {
                    minRate = v.successRate;
                    minKey = k;
                }
            }
            if (minKey)
                this.proceduralMemory.delete(minKey);
        }
        memoryTierHits.labels('L3_procedural').inc();
    }
    evictLeastImportant(memory) {
        const now = Date.now();
        let minId = null;
        let minScore = Infinity;
        for (const [id, trace] of memory) {
            const score = this.computeImportance(trace, now);
            if (score < minScore) {
                minScore = score;
                minId = id;
            }
        }
        if (minId)
            memory.delete(minId);
    }
    computeImportance(trace, now = Date.now()) {
        const age = now - trace.timestamp;
        const decay = Math.exp(-age / this.episodicTau);
        const accessBoost = 1 + Math.log(Math.max(trace.accessCount, 1));
        return trace.importance * decay * accessBoost;
    }
    getRelevantContext(query) {
        const span = this.tracer.startSpan('get-relevant-context');
        const results = [];
        const now = Date.now();
        // L0: All working memory (most recent context)
        results.push(...this.workingMemory.map(t => `[Working] ${t.content}`));
        // L1: Top episodic by computed importance
        const episodicRanked = [...this.episodicMemory.values()]
            .map(t => ({ trace: t, score: this.computeImportance(t, now) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
        results.push(...episodicRanked.map(({ trace }) => `[Episodic] ${trace.content}`));
        // L2: Relevant semantic facts (simple keyword matching for now)
        const queryWords = query.toLowerCase().split(/\s+/);
        for (const [key, value] of this.semanticMemory) {
            const keyWords = key.toLowerCase().split(/\s+/);
            if (queryWords.some(qw => keyWords.includes(qw))) {
                results.push(`[Semantic] ${key}: ${value.content}`);
            }
        }
        // L3: Matching procedural patterns
        for (const [pattern, value] of this.proceduralMemory) {
            if (query.toLowerCase().includes(pattern.toLowerCase())) {
                results.push(`[Procedural] ${pattern}: ${value.steps.join(' → ')}`);
            }
        }
        span.setAttribute('results_count', results.length);
        span.setStatus({ code: api_1.SpanStatusCode.OK });
        span.end();
        return results.slice(0, 15); // Limit total context
    }
    accessMemory(id) {
        // Check episodic
        const trace = this.episodicMemory.get(id);
        if (trace) {
            trace.accessCount++;
            trace.importance = Math.min(1.0, trace.importance + 0.1);
            return trace;
        }
        return undefined;
    }
    consolidate() {
        // Move important episodic to semantic
        const now = Date.now();
        for (const [id, trace] of this.episodicMemory) {
            if (trace.accessCount >= 3 && this.computeImportance(trace, now) > 0.7) {
                this.addToSemantic(`consolidated_${id.slice(0, 8)}`, trace.content, trace.importance);
            }
        }
    }
    getStats() {
        return {
            working: this.workingMemory.length,
            episodic: this.episodicMemory.size,
            semantic: this.semanticMemory.size,
            procedural: this.proceduralMemory.size,
        };
    }
}
exports.HierarchicalMemory = HierarchicalMemory;
// ============================================================================
// NEURAL RAG AI ENGINE v3.0
// ============================================================================
class NeuralRAGAIEngine {
    client = null;
    router;
    circuitBreaker;
    reflection = null;
    memory;
    tracer;
    conversationHistory = [];
    maxHistoryItems = 20;
    constructor(apiKey) {
        this.tracer = api_1.trace.getTracer('chromadon-ai-engine-v3');
        this.router = new DualProcessRouter();
        this.memory = new HierarchicalMemory();
        this.circuitBreaker = new CircuitBreaker('anthropic-api', {
            failureThreshold: 5,
            recoveryTimeoutMs: 60000,
            successThreshold: 3,
        });
        if (apiKey) {
            this.client = new sdk_1.default({ apiKey });
            this.reflection = new SelfReflection(this.client);
        }
    }
    async processCommand(command, pageContext) {
        const span = this.tracer.startSpan('process-command');
        span.setAttribute('command', command.slice(0, 100));
        span.setAttribute('url', pageContext.url);
        const startTime = Date.now();
        if (!this.client) {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: 'No API key configured' });
            span.end();
            throw new Error('AI Engine not configured. Please set API key in settings.');
        }
        try {
            // 1. Dual-process cognitive routing
            const classification = this.router.classify(command);
            span.setAttribute('complexity', classification.complexity);
            span.setAttribute('cognitive_mode', classification.cognitiveMode);
            span.setAttribute('model', classification.model);
            span.setAttribute('use_prm', classification.usePRM);
            // 2. Retrieve hierarchical memory context
            const memoryContext = this.memory.getRelevantContext(command);
            span.setAttribute('memory_context_items', memoryContext.length);
            // 3. Build system prompt with cognitive context
            const systemPrompt = this.buildSystemPrompt(pageContext, memoryContext, classification);
            // 4. Execute with circuit breaker protection
            const response = await this.circuitBreaker.call(async () => {
                return this.client.messages.create({
                    model: classification.model,
                    max_tokens: classification.thinkBudget,
                    system: systemPrompt,
                    messages: [
                        ...this.conversationHistory.slice(-10),
                        { role: 'user', content: command }
                    ],
                });
            });
            // 5. Parse response
            const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
            let parsed = this.parseResponse(responseText);
            parsed.cognitiveMode = classification.cognitiveMode;
            // 6. Self-reflection verification (for System 2 or hybrid with low confidence)
            let verificationScore = parsed.confidence;
            if ((classification.usePRM || (classification.cognitiveMode === 'hybrid' && parsed.confidence < 0.85))
                && this.reflection) {
                span.setAttribute('reflection_enabled', true);
                const reflection = await this.reflection.evaluateResponse(command, JSON.stringify(parsed.actions), memoryContext.join('\n'));
                span.setAttribute('reflection_supported', reflection.isSupported);
                span.setAttribute('reflection_useful', reflection.isUseful);
                span.setAttribute('reflection_confidence', reflection.confidence);
                verificationScore = reflection.confidence;
                prmVerificationScore.labels(classification.cognitiveMode).observe(verificationScore);
                // Regenerate if verification fails
                if (!reflection.isSupported || !reflection.isUseful) {
                    span.setAttribute('regenerated', true);
                    console.log(`[NeuralRAGAIEngine] Regenerating due to low verification: SUP=${reflection.isSupported}, USE=${reflection.isUseful}`);
                    parsed = await this.regenerateWithGuidance(command, pageContext, memoryContext, classification, reflection);
                }
                // Apply escalation for hybrid mode
                if (classification.cognitiveMode === 'hybrid' && this.router.shouldEscalate(reflection.confidence)) {
                    span.setAttribute('escalated', true);
                    console.log(`[NeuralRAGAIEngine] Escalating to System 2 due to low confidence: ${reflection.confidence}`);
                    // Re-run with System 2 settings
                    const escalatedClassification = {
                        ...classification,
                        cognitiveMode: 'system2',
                        usePRM: true,
                        model: 'claude-sonnet-4-20250514',
                        thinkBudget: 8000,
                    };
                    return this.processCommandWithClassification(command, pageContext, memoryContext, escalatedClassification);
                }
            }
            parsed.verificationScore = verificationScore;
            // 7. Update memory with this interaction
            this.memory.addToWorking(`${command} → ${parsed.actions.map(a => a.type).join(', ')} (conf: ${parsed.confidence.toFixed(2)})`, parsed.confidence);
            // 8. Update conversation history
            this.conversationHistory.push({ role: 'user', content: command }, { role: 'assistant', content: responseText });
            if (this.conversationHistory.length > this.maxHistoryItems * 2) {
                this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryItems * 2);
            }
            // 9. Store successful patterns in procedural memory
            if (parsed.confidence >= 0.9 && parsed.actions.length > 0) {
                const patternKey = this.extractPatternKey(command);
                this.memory.addToProcedural(patternKey, parsed.actions.map(a => `${a.type}(${JSON.stringify(a.params)})`), parsed.confidence);
            }
            // Record metrics
            const latency = (Date.now() - startTime) / 1000;
            aiEngineCallsTotal.labels(classification.model, classification.cognitiveMode, 'success').inc();
            aiEngineLatency.labels(classification.model, classification.cognitiveMode).observe(latency);
            span.setAttribute('latency_ms', latency * 1000);
            span.setAttribute('actions_count', parsed.actions.length);
            span.setAttribute('final_confidence', parsed.confidence);
            span.setStatus({ code: api_1.SpanStatusCode.OK });
            span.end();
            return parsed;
        }
        catch (error) {
            const latency = (Date.now() - startTime) / 1000;
            aiEngineCallsTotal.labels('unknown', 'unknown', 'error').inc();
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: error.message });
            span.recordException(error);
            span.end();
            throw error;
        }
    }
    async processCommandWithClassification(command, pageContext, memoryContext, classification) {
        const systemPrompt = this.buildSystemPrompt(pageContext, memoryContext, classification);
        const response = await this.circuitBreaker.call(async () => {
            return this.client.messages.create({
                model: classification.model,
                max_tokens: classification.thinkBudget,
                system: systemPrompt,
                messages: [
                    ...this.conversationHistory.slice(-10),
                    { role: 'user', content: command }
                ],
            });
        });
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = this.parseResponse(responseText);
        parsed.cognitiveMode = classification.cognitiveMode;
        return parsed;
    }
    async regenerateWithGuidance(command, pageContext, memoryContext, classification, reflection) {
        const guidancePrompt = `REGENERATION REQUIRED - Previous response failed verification.

FEEDBACK: ${reflection.feedback || 'Response was not supported by page context or not useful.'}

VERIFICATION RESULTS:
- Relevant: ${reflection.isRelevant}
- Supported by context: ${reflection.isSupported}
- Useful for goal: ${reflection.isUseful}

Please provide a REVISED response that:
1. Only references elements that exist on the page
2. Directly addresses the user's actual goal
3. Uses conservative, verifiable actions

ORIGINAL COMMAND: ${command}`;
        const response = await this.circuitBreaker.call(async () => {
            return this.client.messages.create({
                model: classification.model,
                max_tokens: classification.thinkBudget,
                system: this.buildSystemPrompt(pageContext, memoryContext, classification),
                messages: [
                    { role: 'user', content: guidancePrompt }
                ],
            });
        });
        const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
        const parsed = this.parseResponse(responseText);
        parsed.cognitiveMode = classification.cognitiveMode;
        // Mark as regenerated with slightly lower confidence
        parsed.confidence = Math.min(parsed.confidence, 0.85);
        return parsed;
    }
    buildSystemPrompt(context, memory, classification) {
        const cognitiveStatus = classification.cognitiveMode === 'system1'
            ? 'FAST PATH (System 1) - Quick, intuitive response'
            : classification.cognitiveMode === 'system2'
                ? 'DELIBERATE PATH (System 2) - Deep reasoning required'
                : 'HYBRID PATH - Start fast, escalate if uncertain';
        return `You are CHROMADON with Neural RAG Brain v3.0, an AI browser automation assistant.

═══════════════════════════════════════════════════════════
COGNITIVE MODE: ${cognitiveStatus}
Complexity: ${classification.complexity}/10 | PRM Verification: ${classification.usePRM ? 'ENABLED' : 'DISABLED'}
═══════════════════════════════════════════════════════════

CURRENT PAGE CONTEXT:
━━━━━━━━━━━━━━━━━━━━
URL: ${context.url}
Title: ${context.title}
${context.visibleText ? `Visible Text (excerpt): ${context.visibleText.slice(0, 500)}...` : ''}
${context.interactiveElements?.length ? `Interactive Elements: ${context.interactiveElements.length} found` : ''}

HIERARCHICAL MEMORY CONTEXT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${memory.length > 0 ? memory.slice(0, 10).join('\n') : '[No relevant memory]'}

AVAILABLE ACTIONS:
━━━━━━━━━━━━━━━━━
1. navigate: { url: string }
2. click: { selector: string } OR { text: string }  
3. type: { selector: string, text: string, clearFirst?: boolean }
4. scroll: { direction: "up" | "down" | "left" | "right", amount?: number }
5. wait: { seconds: number }
6. screenshot: { fullPage?: boolean }
7. extract: { selector: string } OR { pattern: string }
8. press_key: { key: string } (Enter, Tab, Escape, etc.)
9. select: { selector: string, value: string }
10. hover: { selector: string }

SELECTOR STRATEGIES (in order of preference):
1. ID: #elementId
2. Data attributes: [data-testid="..."]
3. ARIA: [aria-label="..."]
4. Unique class: .specific-class
5. Text content: button:contains("Submit")
6. CSS path: form > button[type="submit"]

${classification.usePRM ? `
REFLECTION PROTOCOL (PRM-Guided):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before finalizing response, verify each action:
- [RET] Do I need more information from the page?
- [REL] Is this action directly relevant to the query?
- [SUP] Is this action supported by the page context?
- [USE] Will this action help achieve the user's goal?
` : ''}

RESPONSE FORMAT (JSON only):
━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "thinking": "Step-by-step reasoning about the task",
  "actions": [
    {
      "type": "action_type",
      "params": { ... },
      "description": "What this action does",
      "reasoning": "Why this action is needed"
    }
  ],
  "needsMoreInfo": false,
  "question": null,
  "confidence": 0.95
}

CRITICAL RULES:
- Only propose actions for elements that exist on the page
- Prefer specific selectors over generic ones
- Include reasoning for each action
- Set confidence < 0.8 if uncertain about element existence
- If unsure, ask for clarification with needsMoreInfo: true`;
    }
    parseResponse(text) {
        const defaultResponse = {
            thinking: '',
            actions: [],
            needsMoreInfo: false,
            confidence: 0.5,
            cognitiveMode: 'hybrid',
        };
        try {
            // Try to extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.warn('[NeuralRAGAIEngine] No JSON found in response, attempting text parse');
                return this.parseTextResponse(text);
            }
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                thinking: parsed.thinking || '',
                actions: (parsed.actions || []).map((a) => ({
                    type: a.type || 'unknown',
                    params: a.params || {},
                    description: a.description || '',
                    reasoning: a.reasoning || '',
                })),
                needsMoreInfo: parsed.needsMoreInfo || false,
                question: parsed.question,
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
                cognitiveMode: 'hybrid',
            };
        }
        catch (error) {
            console.warn('[NeuralRAGAIEngine] Failed to parse JSON response:', error);
            return this.parseTextResponse(text);
        }
    }
    parseTextResponse(text) {
        // Fallback text parsing for non-JSON responses
        const actions = [];
        // Look for navigation URLs
        const urlMatch = text.match(/(?:navigate|go) to\s+(https?:\/\/\S+)/i);
        if (urlMatch) {
            actions.push({
                type: 'navigate',
                params: { url: urlMatch[1] },
                description: `Navigate to ${urlMatch[1]}`,
            });
        }
        // Look for click instructions
        const clickMatch = text.match(/click\s+(?:on\s+)?["']?([^"'\n]+)["']?/i);
        if (clickMatch) {
            actions.push({
                type: 'click',
                params: { text: clickMatch[1].trim() },
                description: `Click on "${clickMatch[1].trim()}"`,
            });
        }
        // Look for type instructions
        const typeMatch = text.match(/type\s+["']([^"']+)["']\s+(?:in(?:to)?|on)\s+["']?([^"'\n]+)["']?/i);
        if (typeMatch) {
            actions.push({
                type: 'type',
                params: { text: typeMatch[1], selector: typeMatch[2] },
                description: `Type "${typeMatch[1]}" into ${typeMatch[2]}`,
            });
        }
        return {
            thinking: text.slice(0, 200),
            actions,
            needsMoreInfo: actions.length === 0,
            question: actions.length === 0 ? 'Could you please clarify what you would like me to do?' : undefined,
            confidence: actions.length > 0 ? 0.6 : 0.3,
            cognitiveMode: 'hybrid',
        };
    }
    extractPatternKey(command) {
        // Extract a generalizable pattern from the command
        return command
            .toLowerCase()
            .replace(/["'].*?["']/g, '[VALUE]')
            .replace(/\d+/g, '[NUM]')
            .replace(/https?:\/\/\S+/g, '[URL]')
            .trim()
            .slice(0, 50);
    }
    clearHistory() {
        this.conversationHistory = [];
    }
    getMemoryStats() {
        return this.memory.getStats();
    }
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
    consolidateMemory() {
        this.memory.consolidate();
    }
}
exports.NeuralRAGAIEngine = NeuralRAGAIEngine;
// ============================================================================
// EXPORTS
// ============================================================================
exports.default = NeuralRAGAIEngine;
//# sourceMappingURL=ai-engine-v3.js.map