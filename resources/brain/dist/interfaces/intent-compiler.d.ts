/**
 * Intent Compiler Interface
 *
 * Neural RAG Brain Pattern: Dual-Process Router
 *
 * Transforms natural language missions into executable action sequences:
 * - System 1: Fast pattern matching (<200ms) for simple intents
 * - System 2: LLM-powered planning (1-5s) for complex missions
 * - Semantic caching for repeated intent patterns
 * - Ambiguity detection with clarification requests
 */
import type { Action, BaseAction, Complexity, ReflectionResult } from './types';
/**
 * Status of a compilation attempt.
 */
export type CompileStatus = 'success' | 'rejected' | 'needs_clarification' | 'error';
/**
 * Reason for rejection.
 */
export type RejectionReason = 'ambiguous_intent' | 'impossible_action' | 'unsupported_action' | 'safety_violation' | 'missing_context';
/**
 * Route taken for compilation.
 */
export type CompileRoute = 'system1' | 'system2' | 'cached';
/**
 * Clarification question for ambiguous intents.
 */
export interface ClarificationQuestion {
    /** The question to ask the user */
    question: string;
    /** Suggested options if applicable */
    options?: string[];
    /** What aspect needs clarification */
    aspect: 'target' | 'action' | 'condition' | 'value' | 'sequence';
}
/**
 * Compiled action with additional metadata.
 */
export interface CompiledAction extends BaseAction {
    /** Hints for selector healing */
    selectorHints?: string[];
    /** Expected outcome description */
    expectedOutcome?: string;
    /** Dependencies on other action IDs */
    dependsOn?: string[];
    /** Estimated duration in ms */
    estimatedDuration?: number;
}
/**
 * Successful compilation result.
 */
export interface CompileSuccess {
    status: 'success';
    actions: CompiledAction[];
    route: CompileRoute;
    compileTimeMs: number;
    complexity: Complexity;
    reflection?: ReflectionResult;
    /** Cache key if result was cached */
    cacheKey?: string;
    /** Confidence in the compilation (0-1) */
    confidence: number;
}
/**
 * Rejected compilation result.
 */
export interface CompileRejected {
    status: 'rejected';
    reason: RejectionReason;
    clarificationQuestions: ClarificationQuestion[];
    /** Partial actions if any were identified */
    partialActions?: CompiledAction[];
    /** Suggestions for reformulating the mission */
    suggestions?: string[];
}
/**
 * Needs clarification result.
 */
export interface CompileNeedsClarification {
    status: 'needs_clarification';
    clarificationQuestions: ClarificationQuestion[];
    /** Partial actions identified so far */
    partialActions: CompiledAction[];
    /** Which parts are unclear */
    uncertainParts: string[];
}
/**
 * Error during compilation.
 */
export interface CompileError {
    status: 'error';
    error: Error;
    /** Recovery suggestions */
    recoverySuggestions?: string[];
}
/**
 * Union type for all compile results.
 */
export type CompileResult = CompileSuccess | CompileRejected | CompileNeedsClarification | CompileError;
/**
 * Classification result from complexity analysis.
 */
export interface IntentClassification {
    /** Complexity score (0-1), <0.33 = System 1 */
    score: number;
    /** Classified complexity level */
    complexity: Complexity;
    /** Route recommendation */
    recommendedRoute: CompileRoute;
    /** Identified intents in the mission */
    intents: IdentifiedIntent[];
    /** Features that influenced classification */
    features: ClassificationFeatures;
}
/**
 * Individual intent identified in a mission.
 */
export interface IdentifiedIntent {
    /** Raw text segment */
    text: string;
    /** Action type inferred */
    actionType: Action['type'];
    /** Confidence in identification (0-1) */
    confidence: number;
    /** Target element hints */
    targetHints: string[];
    /** Is this conditional? */
    isConditional: boolean;
    /** Condition type if conditional */
    conditionType?: 'element_exists' | 'text_visible' | 'url_matches';
}
/**
 * Features used for complexity classification.
 */
export interface ClassificationFeatures {
    /** Number of distinct actions */
    actionCount: number;
    /** Has conditional branching */
    hasConditionals: boolean;
    /** Has loops or iterations */
    hasLoops: boolean;
    /** Requires authentication */
    requiresAuth: boolean;
    /** Number of page navigations */
    navigationCount: number;
    /** Uses dynamic data */
    usesDynamicData: boolean;
    /** Ambiguity level (0-1) */
    ambiguityLevel: number;
    /** Word count */
    wordCount: number;
    /** Sentence count */
    sentenceCount: number;
}
/**
 * Action plan with dependency graph.
 */
export interface ActionPlan {
    /** Ordered actions */
    actions: CompiledAction[];
    /** Dependency graph (action ID -> depends on IDs) */
    dependencies: Map<string, string[]>;
    /** Actions that can run in parallel */
    parallelGroups: string[][];
    /** Critical path (longest dependency chain) */
    criticalPath: string[];
    /** Estimated total duration */
    estimatedDuration: number;
}
/**
 * Validation result for an action plan.
 */
export interface PlanValidation {
    valid: boolean;
    errors: PlanError[];
    warnings: PlanWarning[];
}
/**
 * Error in action plan.
 */
export interface PlanError {
    actionId: string;
    type: 'circular_dependency' | 'missing_dependency' | 'invalid_selector' | 'impossible_action';
    message: string;
}
/**
 * Warning in action plan.
 */
export interface PlanWarning {
    actionId: string;
    type: 'slow_action' | 'unreliable_selector' | 'potential_popup' | 'auth_required';
    message: string;
    suggestion?: string;
}
/**
 * Cached compilation entry.
 */
export interface CachedCompilation {
    /** Cache key (hash of normalized mission) */
    key: string;
    /** Original mission text */
    mission: string;
    /** Compiled actions */
    actions: CompiledAction[];
    /** Compilation route used */
    route: CompileRoute;
    /** Complexity classification */
    complexity: Complexity;
    /** When cached */
    cachedAt: Date;
    /** Number of times used */
    hitCount: number;
    /** Last used */
    lastUsed: Date;
    /** Embedding vector for similarity search */
    embedding?: number[];
}
/**
 * Cache statistics.
 */
export interface CacheStats {
    /** Total entries */
    size: number;
    /** Cache hit rate (0-1) */
    hitRate: number;
    /** Total hits */
    hits: number;
    /** Total misses */
    misses: number;
    /** Average lookup time in ms */
    avgLookupTimeMs: number;
    /** Memory usage in bytes */
    memoryBytes: number;
}
/**
 * Configuration for IntentCompiler.
 */
export interface IntentCompilerConfig {
    /** System 1 timeout in ms. Default: 200 */
    system1TimeoutMs: number;
    /** System 2 timeout in ms. Default: 5000 */
    system2TimeoutMs: number;
    /** Complexity threshold for System 1 (0-1). Default: 0.33 */
    system1Threshold: number;
    /** Minimum confidence to accept compilation. Default: 0.7 */
    minConfidence: number;
    /** Enable semantic caching. Default: true */
    enableCache: boolean;
    /** Cache similarity threshold (0-1). Default: 0.95 */
    cacheSimilarityThreshold: number;
    /** Max cache entries. Default: 1000 */
    maxCacheEntries: number;
    /** Enable reflection for System 2. Default: true */
    enableReflection: boolean;
    /** Max refinement iterations. Default: 2 */
    maxRefinements: number;
}
/**
 * Intent Compiler interface.
 *
 * Transforms natural language missions into executable action sequences
 * using dual-process routing (System 1 fast vs System 2 deliberate).
 */
export interface IIntentCompiler {
    /**
     * Compile a natural language mission to actions.
     *
     * @param mission - Natural language mission description
     * @param context - Optional context (current URL, page state, etc.)
     * @returns Compilation result with actions or rejection
     */
    compile(mission: string, context?: CompileContext): Promise<CompileResult>;
    /**
     * Classify mission complexity.
     *
     * @param mission - Mission to classify
     * @returns Classification with complexity score and route
     */
    classify(mission: string): Promise<IntentClassification>;
    /**
     * Validate an action plan before execution.
     *
     * @param plan - Action plan to validate
     * @returns Validation result with errors and warnings
     */
    validatePlan(plan: ActionPlan): Promise<PlanValidation>;
    /**
     * Get cache statistics.
     */
    getCacheStats(): CacheStats;
    /**
     * Clear the semantic cache.
     */
    clearCache(): void;
    /**
     * Get the last route taken.
     */
    readonly lastRoute: CompileRoute | null;
    /**
     * Get the last compile time in ms.
     */
    readonly lastCompileTimeMs: number;
    /**
     * Get the last reflection result.
     */
    readonly lastReflection: ReflectionResult | null;
}
/**
 * Context for compilation.
 */
export interface CompileContext {
    /** Current page URL */
    currentUrl?: string;
    /** Page title */
    pageTitle?: string;
    /** Available element selectors */
    availableSelectors?: string[];
    /** User preferences */
    preferences?: Record<string, unknown>;
    /** Previous actions in session */
    previousActions?: Action[];
    /** Authentication state */
    isAuthenticated?: boolean;
}
/**
 * Pattern for System 1 fast matching.
 */
export interface ActionPattern {
    /** Pattern name */
    name: string;
    /** Regex or keyword patterns to match */
    patterns: RegExp[];
    /** Action type to generate */
    actionType: Action['type'];
    /** Selector extraction patterns */
    selectorPatterns: RegExp[];
    /** Priority (higher = checked first) */
    priority: number;
}
/**
 * System 1 fast action mapper interface.
 */
export interface IFastActionMapper {
    /**
     * Map mission to actions using pattern matching.
     *
     * @param mission - Mission text
     * @param intents - Pre-classified intents
     * @returns Compiled actions
     */
    map(mission: string, intents: IdentifiedIntent[]): Promise<CompiledAction[]>;
    /**
     * Register a new pattern.
     */
    registerPattern(pattern: ActionPattern): void;
    /**
     * Get registered patterns.
     */
    getPatterns(): ActionPattern[];
}
/**
 * System 2 deep action planner interface.
 */
export interface IDeepActionPlanner {
    /**
     * Plan actions using LLM reasoning.
     *
     * @param mission - Mission text
     * @param context - Compilation context
     * @returns Action plan with dependencies
     */
    plan(mission: string, context?: CompileContext): Promise<ActionPlan>;
    /**
     * Refine a plan based on reflection.
     *
     * @param mission - Original mission
     * @param plan - Current plan
     * @param reflection - Reflection feedback
     * @returns Refined plan
     */
    refine(mission: string, plan: ActionPlan, reflection: ReflectionResult): Promise<ActionPlan>;
}
//# sourceMappingURL=intent-compiler.d.ts.map