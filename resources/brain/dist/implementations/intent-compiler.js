"use strict";
/**
 * Intent Compiler Implementation
 *
 * Neural RAG Brain Pattern: Dual-Process Router
 *
 * Transforms natural language missions into executable action sequences:
 * - System 1: Fast pattern matching (<200ms) for simple intents
 * - System 2: LLM-powered planning (1-5s) for complex missions
 * - Semantic caching for repeated intent patterns
 * - Reflection-based refinement for complex plans
 * - Ambiguity detection with clarification requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIntentCompiler = exports.IntentCompiler = void 0;
const uuid_1 = require("uuid");
const intent_classifier_1 = require("../core/intent-classifier");
const action_planner_1 = require("../core/action-planner");
const semantic_cache_1 = require("../core/semantic-cache");
// =============================================================================
// CONFIGURATION
// =============================================================================
const DEFAULT_CONFIG = {
    system1TimeoutMs: 200,
    system2TimeoutMs: 5000,
    system1Threshold: 0.33,
    minConfidence: 0.7,
    enableCache: true,
    cacheSimilarityThreshold: 0.95,
    maxCacheEntries: 1000,
    enableReflection: true,
    maxRefinements: 2,
};
// =============================================================================
// INTENT COMPILER IMPLEMENTATION
// =============================================================================
/**
 * Intent Compiler for mission-to-action transformation.
 *
 * Implements dual-process routing:
 * - System 1: Fast pattern matching for simple missions
 * - System 2: LLM reasoning for complex missions
 */
class IntentCompiler {
    config;
    classifier;
    system1;
    system2;
    validator;
    cache;
    _lastRoute = null;
    _lastCompileTimeMs = 0;
    _lastReflection = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Initialize classifier
        const classifierConfig = {
            system1Threshold: this.config.system1Threshold,
        };
        this.classifier = new intent_classifier_1.IntentClassifier(classifierConfig);
        // Initialize System 1 and System 2 planners
        const plannerConfig = {};
        this.system1 = new action_planner_1.FastActionMapper(plannerConfig);
        this.system2 = new action_planner_1.DeepActionPlanner(plannerConfig);
        this.validator = new action_planner_1.PlanValidator();
        // Initialize cache
        const cacheConfig = {
            maxEntries: this.config.maxCacheEntries,
            similarityThreshold: this.config.cacheSimilarityThreshold,
            enableSimilarity: this.config.enableCache,
        };
        this.cache = new semantic_cache_1.SemanticCache(cacheConfig);
    }
    /**
     * Compile a natural language mission to actions.
     */
    async compile(mission, context) {
        const startTime = Date.now();
        try {
            // Validate mission
            if (!mission || mission.trim().length === 0) {
                return this.createRejection('ambiguous_intent', [
                    {
                        question: 'What action would you like me to perform?',
                        aspect: 'action',
                    },
                ]);
            }
            // Check cache first
            if (this.config.enableCache) {
                const cached = this.cache.lookup(mission);
                if (cached) {
                    this._lastRoute = 'cached';
                    this._lastCompileTimeMs = Date.now() - startTime;
                    return {
                        status: 'success',
                        actions: cached.actions,
                        route: 'cached',
                        compileTimeMs: this._lastCompileTimeMs,
                        complexity: cached.complexity,
                        confidence: 1.0,
                        cacheKey: cached.key,
                    };
                }
            }
            // Classify complexity
            const classification = await this.classify(mission);
            // Check for ambiguity
            if (classification.features.ambiguityLevel > 0.6) {
                const questions = this.classifier.generateClarifications(mission);
                return this.createNeedsClarification(questions.map(q => ({ question: q, aspect: 'action' })), classification.intents.map(i => this.intentToAction(i)));
            }
            // Route to appropriate system
            let result;
            if (classification.recommendedRoute === 'system1') {
                result = await this.compileSystem1(mission, classification, startTime);
            }
            else {
                result = await this.compileSystem2(mission, classification, context, startTime);
            }
            // Cache successful compilations
            if (result.status === 'success' && this.config.enableCache) {
                this.cache.store(mission, result.actions, result.route, result.complexity);
            }
            return result;
        }
        catch (error) {
            this._lastCompileTimeMs = Date.now() - startTime;
            return {
                status: 'error',
                error: error instanceof Error ? error : new Error(String(error)),
                recoverySuggestions: [
                    'Try rephrasing the mission with more specific details',
                    'Break down the mission into smaller steps',
                ],
            };
        }
    }
    /**
     * Compile using System 1 (fast pattern matching).
     */
    async compileSystem1(mission, classification, startTime) {
        this._lastRoute = 'system1';
        // Apply timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('System 1 timeout')), this.config.system1TimeoutMs);
        });
        try {
            const actions = await Promise.race([
                this.system1.map(mission, classification.intents),
                timeoutPromise,
            ]);
            this._lastCompileTimeMs = Date.now() - startTime;
            // Validate actions
            if (actions.length === 0) {
                return this.createRejection('ambiguous_intent', [
                    {
                        question: 'I couldn\'t identify any specific actions. What would you like me to do?',
                        aspect: 'action',
                    },
                ]);
            }
            // Check confidence
            const avgConfidence = classification.intents.reduce((sum, i) => sum + i.confidence, 0) / classification.intents.length;
            if (avgConfidence < this.config.minConfidence) {
                return this.createNeedsClarification(this.classifier.generateClarifications(mission).map(q => ({
                    question: q,
                    aspect: 'target',
                })), actions);
            }
            return {
                status: 'success',
                actions,
                route: 'system1',
                compileTimeMs: this._lastCompileTimeMs,
                complexity: classification.complexity,
                confidence: avgConfidence,
            };
        }
        catch (error) {
            // System 1 failed, fallback to System 2 if appropriate
            if (error instanceof Error && error.message === 'System 1 timeout') {
                return this.compileSystem2(mission, classification, undefined, startTime);
            }
            throw error;
        }
    }
    /**
     * Compile using System 2 (LLM reasoning).
     */
    async compileSystem2(mission, classification, context, startTime) {
        this._lastRoute = 'system2';
        // Apply timeout
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('System 2 timeout')), this.config.system2TimeoutMs);
        });
        try {
            const plan = await Promise.race([
                this.system2.plan(mission, context),
                timeoutPromise,
            ]);
            // Generate reflection
            let reflection;
            if (this.config.enableReflection) {
                reflection = this.generateReflection(mission, plan, classification);
                this._lastReflection = reflection;
                // Refine if low confidence
                if (reflection.isSupported < 0.7 && this.config.maxRefinements > 0) {
                    const refinedPlan = await this.refineWithReflection(mission, plan, reflection, this.config.maxRefinements);
                    plan.actions = refinedPlan.actions;
                    plan.dependencies = refinedPlan.dependencies;
                }
            }
            // Validate plan
            const validation = this.validator.validate(plan);
            if (!validation.valid) {
                return this.createRejection('impossible_action', validation.errors.map(e => ({
                    question: `Issue with action: ${e.message}. Can you provide more details?`,
                    aspect: 'action',
                })));
            }
            this._lastCompileTimeMs = Date.now() - startTime;
            // Calculate confidence from reflection
            const confidence = reflection
                ? (reflection.isRelevant + reflection.isSupported) / 2
                : 0.8;
            return {
                status: 'success',
                actions: plan.actions,
                route: 'system2',
                compileTimeMs: this._lastCompileTimeMs,
                complexity: classification.complexity,
                confidence,
                reflection,
            };
        }
        catch (error) {
            this._lastCompileTimeMs = Date.now() - startTime;
            if (error instanceof Error && error.message === 'System 2 timeout') {
                return {
                    status: 'error',
                    error,
                    recoverySuggestions: [
                        'The mission is too complex. Try breaking it into smaller steps.',
                        'Simplify the mission by removing conditional logic.',
                    ],
                };
            }
            throw error;
        }
    }
    /**
     * Generate reflection for a plan.
     */
    generateReflection(mission, plan, classification) {
        // Calculate relevance based on intent coverage
        const intentTypes = new Set(classification.intents.map(i => i.actionType));
        const actionTypes = new Set(plan.actions.map(a => a.type));
        const relevantCount = [...intentTypes].filter(t => actionTypes.has(t)).length;
        const isRelevant = intentTypes.size > 0 ? relevantCount / intentTypes.size : 0.5;
        // Calculate support based on selector hints
        const actionsWithHints = plan.actions.filter(a => a.selectorHints && a.selectorHints.length > 0);
        const isSupported = plan.actions.length > 0
            ? actionsWithHints.length / plan.actions.length
            : 0.5;
        // Calculate usefulness (1-5)
        const isUseful = Math.round(1 + (isRelevant * 2) + (isSupported * 2));
        // Determine if retrieval is needed
        const shouldRetrieve = isSupported < 0.6 || classification.features.ambiguityLevel > 0.4;
        return {
            shouldRetrieve,
            isRelevant,
            isSupported,
            isUseful: Math.min(5, Math.max(1, isUseful)),
        };
    }
    /**
     * Refine plan with reflection feedback.
     */
    async refineWithReflection(mission, plan, reflection, remainingIterations) {
        if (remainingIterations <= 0) {
            return plan;
        }
        const refinedPlan = await this.system2.refine(mission, plan, reflection);
        // Re-evaluate
        const newReflection = this.generateReflection(mission, refinedPlan, await this.classify(mission));
        // If still low confidence and iterations remain, refine again
        if (newReflection.isSupported < 0.7 && remainingIterations > 1) {
            return this.refineWithReflection(mission, refinedPlan, newReflection, remainingIterations - 1);
        }
        this._lastReflection = newReflection;
        return refinedPlan;
    }
    /**
     * Classify mission complexity.
     */
    async classify(mission) {
        return this.classifier.classify(mission);
    }
    /**
     * Validate an action plan.
     */
    async validatePlan(plan) {
        return this.validator.validate(plan);
    }
    /**
     * Get cache statistics.
     */
    getCacheStats() {
        return this.cache.getStats();
    }
    /**
     * Clear the semantic cache.
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get the last route taken.
     */
    get lastRoute() {
        return this._lastRoute;
    }
    /**
     * Get the last compile time in ms.
     */
    get lastCompileTimeMs() {
        return this._lastCompileTimeMs;
    }
    /**
     * Get the last reflection result.
     */
    get lastReflection() {
        return this._lastReflection;
    }
    /**
     * Alias for lastCompileTimeMs (for test compatibility).
     */
    get compile_time_ms() {
        return this._lastCompileTimeMs;
    }
    /**
     * Alias for lastRoute (for test compatibility).
     */
    get last_route() {
        return this._lastRoute;
    }
    /**
     * Get reflection from last compilation (for test compatibility).
     */
    get reflection() {
        return this._lastReflection;
    }
    /**
     * Create a rejection result.
     */
    createRejection(reason, questions) {
        return {
            status: 'rejected',
            reason,
            clarificationQuestions: questions.map(q => ({
                question: q.question,
                aspect: q.aspect,
            })),
        };
    }
    /**
     * Create a needs clarification result.
     */
    createNeedsClarification(questions, partialActions) {
        return {
            status: 'needs_clarification',
            clarificationQuestions: questions.map(q => ({
                question: q.question,
                aspect: q.aspect,
            })),
            partialActions,
            uncertainParts: questions.map(q => q.question),
        };
    }
    /**
     * Convert an identified intent to a compiled action.
     */
    intentToAction(intent) {
        return {
            id: (0, uuid_1.v4)(),
            type: intent.actionType,
            selectorHints: intent.targetHints,
            timeout: 30000,
        };
    }
    /**
     * Destroy the compiler and clean up resources.
     */
    destroy() {
        this.cache.destroy();
    }
}
exports.IntentCompiler = IntentCompiler;
// =============================================================================
// FACTORY FUNCTION
// =============================================================================
/**
 * Create an IntentCompiler instance.
 */
function createIntentCompiler(config) {
    return new IntentCompiler(config);
}
exports.createIntentCompiler = createIntentCompiler;
//# sourceMappingURL=intent-compiler.js.map