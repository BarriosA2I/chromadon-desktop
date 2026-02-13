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
import { ReflectionResult } from '../interfaces/types';
import type { IIntentCompiler, IntentCompilerConfig, CompileResult, CompileRoute, IntentClassification, ActionPlan, PlanValidation, CacheStats, CompileContext } from '../interfaces/intent-compiler';
/**
 * Intent Compiler for mission-to-action transformation.
 *
 * Implements dual-process routing:
 * - System 1: Fast pattern matching for simple missions
 * - System 2: LLM reasoning for complex missions
 */
export declare class IntentCompiler implements IIntentCompiler {
    private config;
    private classifier;
    private system1;
    private system2;
    private validator;
    private cache;
    private _lastRoute;
    private _lastCompileTimeMs;
    private _lastReflection;
    constructor(config?: Partial<IntentCompilerConfig>);
    /**
     * Compile a natural language mission to actions.
     */
    compile(mission: string, context?: CompileContext): Promise<CompileResult>;
    /**
     * Compile using System 1 (fast pattern matching).
     */
    private compileSystem1;
    /**
     * Compile using System 2 (LLM reasoning).
     */
    private compileSystem2;
    /**
     * Generate reflection for a plan.
     */
    private generateReflection;
    /**
     * Refine plan with reflection feedback.
     */
    private refineWithReflection;
    /**
     * Classify mission complexity.
     */
    classify(mission: string): Promise<IntentClassification>;
    /**
     * Validate an action plan.
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
    get lastRoute(): CompileRoute | null;
    /**
     * Get the last compile time in ms.
     */
    get lastCompileTimeMs(): number;
    /**
     * Get the last reflection result.
     */
    get lastReflection(): ReflectionResult | null;
    /**
     * Alias for lastCompileTimeMs (for test compatibility).
     */
    get compile_time_ms(): number;
    /**
     * Alias for lastRoute (for test compatibility).
     */
    get last_route(): CompileRoute | null;
    /**
     * Get reflection from last compilation (for test compatibility).
     */
    get reflection(): ReflectionResult | null;
    /**
     * Create a rejection result.
     */
    private createRejection;
    /**
     * Create a needs clarification result.
     */
    private createNeedsClarification;
    /**
     * Convert an identified intent to a compiled action.
     */
    private intentToAction;
    /**
     * Destroy the compiler and clean up resources.
     */
    destroy(): void;
}
/**
 * Create an IntentCompiler instance.
 */
export declare function createIntentCompiler(config?: Partial<IntentCompilerConfig>): IntentCompiler;
//# sourceMappingURL=intent-compiler.d.ts.map