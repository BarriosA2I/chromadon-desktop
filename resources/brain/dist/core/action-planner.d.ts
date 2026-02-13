/**
 * Action Planner
 *
 * Neural RAG Brain Pattern: Dual-Process Action Planning
 *
 * System 1 (Fast): Pattern-based action mapping (<200ms)
 * - Direct pattern matching for simple intents
 * - Template-based action generation
 * - No LLM calls
 *
 * System 2 (Deliberate): LLM-powered planning (1-5s)
 * - Complex mission decomposition
 * - Dependency graph construction
 * - Reflection-based refinement
 */
import { ReflectionResult } from '../interfaces/types';
import type { CompiledAction, ActionPlan, IdentifiedIntent, CompileContext, IFastActionMapper, IDeepActionPlanner, ActionPattern, PlanValidation } from '../interfaces/intent-compiler';
/**
 * Configuration for action planning.
 */
export interface ActionPlannerConfig {
    /** Default action timeout in ms. Default: 30000 */
    defaultTimeout: number;
    /** Default retries for failed actions. Default: 2 */
    defaultRetries: number;
    /** Enable parallel action detection. Default: true */
    enableParallel: boolean;
    /** Max parallel actions. Default: 3 */
    maxParallel: number;
}
/**
 * Fast Action Mapper for System 1 processing.
 *
 * Uses pattern matching and templates to quickly generate
 * actions without LLM calls. Target: <200ms.
 */
export declare class FastActionMapper implements IFastActionMapper {
    private config;
    private patterns;
    constructor(config?: Partial<ActionPlannerConfig>);
    /**
     * Map mission to actions using pattern matching.
     */
    map(mission: string, intents: IdentifiedIntent[]): Promise<CompiledAction[]>;
    /**
     * Convert an identified intent to a compiled action.
     */
    private intentToAction;
    /**
     * Wrap action in a conditional.
     */
    private wrapInConditional;
    /**
     * Generate expected outcome description.
     */
    private generateExpectedOutcome;
    /**
     * Estimate action duration in ms.
     */
    private estimateDuration;
    /**
     * Extract a fallback action from raw mission text.
     */
    private extractFallbackAction;
    /**
     * Register a custom pattern.
     */
    registerPattern(pattern: ActionPattern): void;
    /**
     * Get registered patterns.
     */
    getPatterns(): ActionPattern[];
}
/**
 * Deep Action Planner for System 2 processing.
 *
 * Uses LLM reasoning for complex mission decomposition
 * and dependency graph construction. Target: 1-5s.
 */
export declare class DeepActionPlanner implements IDeepActionPlanner {
    private config;
    private fastMapper;
    constructor(config?: Partial<ActionPlannerConfig>);
    /**
     * Plan actions using LLM reasoning.
     *
     * For now, uses enhanced pattern matching.
     * In production, this would call an LLM API.
     */
    plan(mission: string, context?: CompileContext): Promise<ActionPlan>;
    /**
     * Decompose mission into ordered steps.
     */
    private decomposeMission;
    /**
     * Plan actions for a single step.
     */
    private planStep;
    /**
     * Build dependency graph between actions.
     */
    private buildDependencies;
    /**
     * Check if two actions can run in parallel.
     */
    private canRunParallel;
    /**
     * Get selector from action.
     */
    private getActionSelector;
    /**
     * Find groups of actions that can run in parallel.
     */
    private findParallelGroups;
    /**
     * Calculate critical path (longest dependency chain).
     */
    private calculateCriticalPath;
    /**
     * Estimate total duration considering parallelism.
     */
    private estimateTotalDuration;
    /**
     * Refine plan based on reflection feedback.
     */
    refine(mission: string, plan: ActionPlan, reflection: ReflectionResult): Promise<ActionPlan>;
    /**
     * Check if two arrays are equal.
     */
    private arraysEqual;
}
/**
 * Validate an action plan for errors and warnings.
 */
export declare class PlanValidator {
    /**
     * Validate a plan.
     */
    validate(plan: ActionPlan): PlanValidation;
    /**
     * Find circular dependencies.
     */
    private findCircularDependencies;
    /**
     * Find missing dependencies.
     */
    private findMissingDependencies;
    /**
     * Check if action type requires a selector.
     */
    private requiresSelector;
    /**
     * Check if action has a valid selector.
     */
    private hasValidSelector;
}
//# sourceMappingURL=action-planner.d.ts.map