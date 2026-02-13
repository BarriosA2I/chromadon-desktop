"use strict";
// @ts-nocheck
// TODO: Fix strict TypeScript issues in this file
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanValidator = exports.DeepActionPlanner = exports.FastActionMapper = void 0;
const uuid_1 = require("uuid");
const intent_classifier_1 = require("./intent-classifier");
const DEFAULT_CONFIG = {
    defaultTimeout: 30000,
    defaultRetries: 2,
    enableParallel: true,
    maxParallel: 3,
};
// =============================================================================
// ACTION TEMPLATES
// =============================================================================
/**
 * Templates for common action types.
 */
const ACTION_TEMPLATES = {
    click: (hints) => ({
        type: 'click',
        selector: hints[0] || '',
        selectorHints: hints,
    }),
    navigate: (hints) => ({
        type: 'navigate',
        url: hints.find(h => h.startsWith('http')) || hints[0] || '',
    }),
    fill: (hints) => ({
        type: 'fill',
        selector: hints[0] || '',
        value: hints[1] || '',
        clearFirst: true,
    }),
    select: (hints) => ({
        type: 'select',
        selector: hints[0] || '',
        value: hints[1] || '',
    }),
    hover: (hints) => ({
        type: 'hover',
        selector: hints[0] || '',
    }),
    scroll: (hints) => ({
        type: 'scroll',
        target: hints[0] || 'bottom',
    }),
    wait: (hints) => ({
        type: 'wait',
        condition: 'element',
        selector: hints[0] || '',
        duration: parseInt(hints[1], 10) || 1000,
    }),
    screenshot: (hints) => ({
        type: 'screenshot',
        fullPage: hints.includes('full') || hints.includes('fullPage'),
        selector: hints.find(h => !['full', 'fullPage'].includes(h)),
    }),
    conditional: (hints) => ({
        type: 'conditional',
        condition: {
            type: 'element_exists',
            selector: hints[0] || '',
        },
        thenAction: {
            id: (0, uuid_1.v4)(),
            type: 'click',
            selector: hints[1] || hints[0] || '',
        },
    }),
};
// =============================================================================
// FAST ACTION MAPPER (SYSTEM 1)
// =============================================================================
/**
 * Fast Action Mapper for System 1 processing.
 *
 * Uses pattern matching and templates to quickly generate
 * actions without LLM calls. Target: <200ms.
 */
class FastActionMapper {
    config;
    patterns;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.patterns = [];
    }
    /**
     * Map mission to actions using pattern matching.
     */
    async map(mission, intents) {
        const actions = [];
        for (const intent of intents) {
            const action = this.intentToAction(intent);
            actions.push(action);
        }
        // If no intents, try to extract from raw mission
        if (actions.length === 0) {
            const fallbackAction = this.extractFallbackAction(mission);
            if (fallbackAction) {
                actions.push(fallbackAction);
            }
        }
        return actions;
    }
    /**
     * Convert an identified intent to a compiled action.
     */
    intentToAction(intent) {
        const template = ACTION_TEMPLATES[intent.actionType];
        const baseAction = template(intent.targetHints);
        const action = {
            id: (0, uuid_1.v4)(),
            type: intent.actionType,
            timeout: this.config.defaultTimeout,
            retries: this.config.defaultRetries,
            selectorHints: intent.targetHints,
            expectedOutcome: this.generateExpectedOutcome(intent),
            estimatedDuration: this.estimateDuration(intent.actionType),
            ...baseAction,
        };
        // Handle conditional actions specially
        if (intent.isConditional && intent.actionType !== 'conditional') {
            return this.wrapInConditional(action, intent);
        }
        return action;
    }
    /**
     * Wrap action in a conditional.
     */
    wrapInConditional(action, intent) {
        const conditionalAction = {
            id: (0, uuid_1.v4)(),
            type: 'conditional',
            condition: {
                type: intent.conditionType || 'element_exists',
                selector: intent.targetHints[0] || '',
            },
            thenAction: action,
            timeout: this.config.defaultTimeout,
            selectorHints: intent.targetHints,
            expectedOutcome: `Conditionally ${action.type} if element exists`,
            estimatedDuration: action.estimatedDuration,
        };
        return conditionalAction;
    }
    /**
     * Generate expected outcome description.
     */
    generateExpectedOutcome(intent) {
        const target = intent.targetHints[0] || 'element';
        switch (intent.actionType) {
            case 'click':
                return `Element "${target}" is clicked`;
            case 'navigate':
                return `Page navigates to ${target}`;
            case 'fill':
                return `Value entered into "${target}" field`;
            case 'select':
                return `Option selected from "${target}"`;
            case 'hover':
                return `Mouse hovers over "${target}"`;
            case 'scroll':
                return `Page scrolls to ${target}`;
            case 'wait':
                return `Wait until "${target}" condition is met`;
            case 'screenshot':
                return `Screenshot captured`;
            case 'conditional':
                return `Conditional action executed based on element presence`;
            default:
                return `Action ${intent.actionType} completed`;
        }
    }
    /**
     * Estimate action duration in ms.
     */
    estimateDuration(actionType) {
        switch (actionType) {
            case 'click':
                return 500;
            case 'navigate':
                return 3000;
            case 'fill':
                return 1000;
            case 'select':
                return 500;
            case 'hover':
                return 300;
            case 'scroll':
                return 500;
            case 'wait':
                return 1000;
            case 'screenshot':
                return 500;
            case 'conditional':
                return 1500;
            default:
                return 1000;
        }
    }
    /**
     * Extract a fallback action from raw mission text.
     */
    extractFallbackAction(mission) {
        // Try to extract any quoted targets
        const quotedMatch = mission.match(/["']([^"']+)["']/);
        const target = quotedMatch ? quotedMatch[1] : '';
        // Detect action type from keywords
        const lowerMission = mission.toLowerCase();
        if (/\bclick\b/.test(lowerMission)) {
            return this.intentToAction({
                text: mission,
                actionType: 'click',
                confidence: 0.5,
                targetHints: target ? [target] : [],
                isConditional: false,
            });
        }
        if (/\b(go|navigate|open)\b/.test(lowerMission)) {
            return this.intentToAction({
                text: mission,
                actionType: 'navigate',
                confidence: 0.5,
                targetHints: target ? [target] : [],
                isConditional: false,
            });
        }
        if (/\b(type|enter|fill)\b/.test(lowerMission)) {
            return this.intentToAction({
                text: mission,
                actionType: 'fill',
                confidence: 0.5,
                targetHints: target ? [target] : [],
                isConditional: false,
            });
        }
        // Default to click if we have a target
        if (target) {
            return this.intentToAction({
                text: mission,
                actionType: 'click',
                confidence: 0.3,
                targetHints: [target],
                isConditional: false,
            });
        }
        return null;
    }
    /**
     * Register a custom pattern.
     */
    registerPattern(pattern) {
        this.patterns.push(pattern);
    }
    /**
     * Get registered patterns.
     */
    getPatterns() {
        return [...this.patterns];
    }
}
exports.FastActionMapper = FastActionMapper;
// =============================================================================
// DEEP ACTION PLANNER (SYSTEM 2)
// =============================================================================
/**
 * Deep Action Planner for System 2 processing.
 *
 * Uses LLM reasoning for complex mission decomposition
 * and dependency graph construction. Target: 1-5s.
 */
class DeepActionPlanner {
    config;
    fastMapper;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.fastMapper = new FastActionMapper(config);
    }
    /**
     * Plan actions using LLM reasoning.
     *
     * For now, uses enhanced pattern matching.
     * In production, this would call an LLM API.
     */
    async plan(mission, context) {
        // Decompose mission into steps
        const steps = this.decomposeMission(mission);
        // Generate actions for each step
        const actions = [];
        for (const step of steps) {
            const stepActions = await this.planStep(step, context);
            actions.push(...stepActions);
        }
        // Build dependency graph
        const dependencies = this.buildDependencies(actions);
        // Identify parallel groups
        const parallelGroups = this.findParallelGroups(actions, dependencies);
        // Calculate critical path
        const criticalPath = this.calculateCriticalPath(actions, dependencies);
        // Estimate total duration
        const estimatedDuration = this.estimateTotalDuration(actions, parallelGroups);
        return {
            actions,
            dependencies,
            parallelGroups,
            criticalPath,
            estimatedDuration,
        };
    }
    /**
     * Decompose mission into ordered steps.
     */
    decomposeMission(mission) {
        const steps = [];
        // Split by step indicators
        const stepPatterns = [
            /\bthen\b/gi,
            /\bafter that\b/gi,
            /\bnext\b/gi,
            /\bfinally\b/gi,
            /\band then\b/gi,
            /\bfollowed by\b/gi,
            /[,;]/g,
        ];
        let remaining = mission;
        // First try numbered steps
        const numberedSteps = mission.match(/\d+\.\s*[^.]+/g);
        if (numberedSteps && numberedSteps.length > 1) {
            return numberedSteps.map(s => s.replace(/^\d+\.\s*/, '').trim());
        }
        // Then try natural language separators
        for (const pattern of stepPatterns) {
            remaining = remaining.replace(pattern, '\n');
        }
        const splitSteps = remaining.split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 3);
        if (splitSteps.length > 1) {
            return splitSteps;
        }
        // Fallback: return as single step
        return [mission];
    }
    /**
     * Plan actions for a single step.
     */
    async planStep(step, context) {
        const classifier = new intent_classifier_1.IntentClassifier();
        const intents = classifier.identifyIntents(step);
        return this.fastMapper.map(step, intents);
    }
    /**
     * Build dependency graph between actions.
     */
    buildDependencies(actions) {
        const dependencies = new Map();
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            if (!action)
                continue;
            const deps = [];
            // Navigation must complete before page interactions
            if (i > 0 && ['navigate'].includes(actions[i - 1]?.type || '')) {
                deps.push(actions[i - 1].id);
            }
            // Sequential actions depend on previous by default
            if (i > 0 && !this.canRunParallel(actions[i - 1], action)) {
                deps.push(actions[i - 1].id);
            }
            // Login/auth actions block subsequent actions
            const authKeywords = ['login', 'sign in', 'authenticate'];
            for (let j = 0; j < i; j++) {
                const prevAction = actions[j];
                if (!prevAction)
                    continue;
                const hints = prevAction.selectorHints || [];
                if (hints.some(h => authKeywords.some(kw => h.includes(kw)))) {
                    deps.push(prevAction.id);
                    break;
                }
            }
            dependencies.set(action.id, deps);
        }
        return dependencies;
    }
    /**
     * Check if two actions can run in parallel.
     */
    canRunParallel(action1, action2) {
        if (!this.config.enableParallel) {
            return false;
        }
        // Navigations can't be parallel
        if (action1.type === 'navigate' || action2.type === 'navigate') {
            return false;
        }
        // Actions on same selector can't be parallel
        const selector1 = this.getActionSelector(action1);
        const selector2 = this.getActionSelector(action2);
        if (selector1 && selector2 && selector1 === selector2) {
            return false;
        }
        // Conditionals can't be parallel
        if (action1.type === 'conditional' || action2.type === 'conditional') {
            return false;
        }
        // Different elements can potentially run in parallel
        return true;
    }
    /**
     * Get selector from action.
     */
    getActionSelector(action) {
        if ('selector' in action && action.selector) {
            return action.selector;
        }
        return null;
    }
    /**
     * Find groups of actions that can run in parallel.
     */
    findParallelGroups(actions, dependencies) {
        const groups = [];
        const assigned = new Set();
        for (const action of actions) {
            if (assigned.has(action.id))
                continue;
            const group = [action.id];
            assigned.add(action.id);
            // Find other actions that can run in parallel with this one
            for (const other of actions) {
                if (assigned.has(other.id))
                    continue;
                if (group.length >= this.config.maxParallel)
                    break;
                // Check if other has same dependencies as first in group
                const actionDeps = dependencies.get(action.id) || [];
                const otherDeps = dependencies.get(other.id) || [];
                // Can be parallel if they share same dependencies
                if (this.arraysEqual(actionDeps, otherDeps) &&
                    this.canRunParallel(action, other)) {
                    group.push(other.id);
                    assigned.add(other.id);
                }
            }
            if (group.length > 1) {
                groups.push(group);
            }
        }
        return groups;
    }
    /**
     * Calculate critical path (longest dependency chain).
     */
    calculateCriticalPath(actions, dependencies) {
        const actionMap = new Map(actions.map(a => [a.id, a]));
        let longestPath = [];
        const findPath = (actionId, currentPath) => {
            const newPath = [...currentPath, actionId];
            const deps = dependencies.get(actionId) || [];
            if (deps.length === 0) {
                return newPath;
            }
            let longest = newPath;
            for (const depId of deps) {
                const depPath = findPath(depId, newPath);
                if (depPath.length > longest.length) {
                    longest = depPath;
                }
            }
            return longest;
        };
        for (const action of actions) {
            const path = findPath(action.id, []);
            if (path.length > longestPath.length) {
                longestPath = path;
            }
        }
        return longestPath.reverse(); // Return in execution order
    }
    /**
     * Estimate total duration considering parallelism.
     */
    estimateTotalDuration(actions, parallelGroups) {
        let total = 0;
        const counted = new Set();
        for (const group of parallelGroups) {
            // Parallel group: use max duration
            let maxDuration = 0;
            for (const id of group) {
                const action = actions.find(a => a.id === id);
                if (action) {
                    maxDuration = Math.max(maxDuration, action.estimatedDuration || 1000);
                    counted.add(id);
                }
            }
            total += maxDuration;
        }
        // Add sequential actions
        for (const action of actions) {
            if (!counted.has(action.id)) {
                total += action.estimatedDuration || 1000;
            }
        }
        return total;
    }
    /**
     * Refine plan based on reflection feedback.
     */
    async refine(mission, plan, reflection) {
        // If relevance is low, try to re-plan
        if (reflection.isRelevant < 0.5) {
            return this.plan(mission);
        }
        // If support is low, add validation steps
        if (reflection.isSupported < 0.7) {
            const refinedActions = [...plan.actions];
            // Add wait steps before critical actions
            for (let i = refinedActions.length - 1; i >= 0; i--) {
                const action = refinedActions[i];
                if (!action)
                    continue;
                if (['click', 'fill', 'select'].includes(action.type)) {
                    const waitAction = {
                        id: (0, uuid_1.v4)(),
                        type: 'wait',
                        condition: 'element',
                        selector: this.getActionSelector(action) || '',
                        timeout: 5000,
                        selectorHints: action.selectorHints,
                        expectedOutcome: 'Element is visible and ready',
                        estimatedDuration: 1000,
                    };
                    refinedActions.splice(i, 0, waitAction);
                }
            }
            // Rebuild plan with new actions
            const dependencies = this.buildDependencies(refinedActions);
            const parallelGroups = this.findParallelGroups(refinedActions, dependencies);
            const criticalPath = this.calculateCriticalPath(refinedActions, dependencies);
            const estimatedDuration = this.estimateTotalDuration(refinedActions, parallelGroups);
            return {
                actions: refinedActions,
                dependencies,
                parallelGroups,
                criticalPath,
                estimatedDuration,
            };
        }
        // Plan is good enough
        return plan;
    }
    /**
     * Check if two arrays are equal.
     */
    arraysEqual(a, b) {
        if (a.length !== b.length)
            return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, i) => val === sortedB[i]);
    }
}
exports.DeepActionPlanner = DeepActionPlanner;
// =============================================================================
// PLAN VALIDATOR
// =============================================================================
/**
 * Validate an action plan for errors and warnings.
 */
class PlanValidator {
    /**
     * Validate a plan.
     */
    validate(plan) {
        const errors = [];
        const warnings = [];
        // Check for circular dependencies
        const circularDeps = this.findCircularDependencies(plan);
        errors.push(...circularDeps);
        // Check for missing dependencies
        const missingDeps = this.findMissingDependencies(plan);
        errors.push(...missingDeps);
        // Check for empty selectors
        for (const action of plan.actions) {
            if (this.requiresSelector(action) && !this.hasValidSelector(action)) {
                errors.push({
                    actionId: action.id,
                    type: 'invalid_selector',
                    message: `Action ${action.type} requires a valid selector`,
                });
            }
        }
        // Add warnings for potentially slow actions
        for (const action of plan.actions) {
            if (action.type === 'navigate') {
                warnings.push({
                    actionId: action.id,
                    type: 'slow_action',
                    message: 'Navigation actions may be slow on poor connections',
                    suggestion: 'Consider adding a wait condition after navigation',
                });
            }
        }
        // Add warnings for potential popups
        const popupKeywords = ['cookie', 'newsletter', 'subscribe', 'notification'];
        for (const action of plan.actions) {
            const hints = action.selectorHints || [];
            if (hints.some(h => popupKeywords.some(kw => h.includes(kw)))) {
                warnings.push({
                    actionId: action.id,
                    type: 'potential_popup',
                    message: 'This selector may refer to a popup that might not appear',
                    suggestion: 'Consider wrapping in a conditional action',
                });
            }
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Find circular dependencies.
     */
    findCircularDependencies(plan) {
        const errors = [];
        const visited = new Set();
        const recursionStack = new Set();
        const hasCycle = (actionId) => {
            visited.add(actionId);
            recursionStack.add(actionId);
            const deps = plan.dependencies.get(actionId) || [];
            for (const depId of deps) {
                if (!visited.has(depId)) {
                    if (hasCycle(depId))
                        return true;
                }
                else if (recursionStack.has(depId)) {
                    return true;
                }
            }
            recursionStack.delete(actionId);
            return false;
        };
        for (const action of plan.actions) {
            if (!visited.has(action.id) && hasCycle(action.id)) {
                errors.push({
                    actionId: action.id,
                    type: 'circular_dependency',
                    message: `Circular dependency detected involving action ${action.id}`,
                });
            }
        }
        return errors;
    }
    /**
     * Find missing dependencies.
     */
    findMissingDependencies(plan) {
        const errors = [];
        const actionIds = new Set(plan.actions.map(a => a.id));
        for (const [actionId, deps] of plan.dependencies) {
            for (const depId of deps) {
                if (!actionIds.has(depId)) {
                    errors.push({
                        actionId,
                        type: 'missing_dependency',
                        message: `Action ${actionId} depends on non-existent action ${depId}`,
                    });
                }
            }
        }
        return errors;
    }
    /**
     * Check if action type requires a selector.
     */
    requiresSelector(action) {
        return ['click', 'fill', 'select', 'hover'].includes(action.type);
    }
    /**
     * Check if action has a valid selector.
     */
    hasValidSelector(action) {
        if ('selector' in action && action.selector) {
            return typeof action.selector === 'string' && action.selector.length > 0;
        }
        // Check selector hints as fallback
        return (action.selectorHints?.length ?? 0) > 0;
    }
}
exports.PlanValidator = PlanValidator;
//# sourceMappingURL=action-planner.js.map