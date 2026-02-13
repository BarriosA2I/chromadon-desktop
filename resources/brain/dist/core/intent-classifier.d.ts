/**
 * Intent Classifier
 *
 * Neural RAG Brain Pattern: Dual-Process Router
 *
 * Classifies mission complexity for System 1/2 routing:
 * - System 1: Score < 0.33, fast pattern matching (<200ms)
 * - System 2: Score >= 0.33, LLM reasoning (1-5s)
 *
 * Features analyzed:
 * - Action count (more = more complex)
 * - Conditional branching (increases complexity)
 * - Navigation depth (multi-page = complex)
 * - Ambiguity level (unclear targets = complex)
 * - Dynamic data usage (variables = complex)
 */
import type { IntentClassification, IdentifiedIntent, ActionPattern } from '../interfaces/intent-compiler';
/**
 * Configuration for intent classification.
 */
export interface IntentClassifierConfig {
    /** Threshold for System 1 routing (0-1). Default: 0.33 */
    system1Threshold: number;
    /** Threshold for System 2/Complex (0-1). Default: 0.66 */
    complexThreshold: number;
    /** Weight for action count. Default: 0.25 */
    actionCountWeight: number;
    /** Weight for conditionals. Default: 0.20 */
    conditionalWeight: number;
    /** Weight for navigation. Default: 0.15 */
    navigationWeight: number;
    /** Weight for ambiguity. Default: 0.25 */
    ambiguityWeight: number;
    /** Weight for dynamic data. Default: 0.15 */
    dynamicDataWeight: number;
}
/**
 * Intent Classifier for dual-process routing.
 *
 * Analyzes mission text to determine complexity and route:
 * - System 1: Fast pattern matching for simple intents
 * - System 2: LLM reasoning for complex missions
 */
export declare class IntentClassifier {
    private config;
    private patterns;
    constructor(config?: Partial<IntentClassifierConfig>);
    /**
     * Classify mission complexity and identify intents.
     */
    classify(mission: string): IntentClassification;
    /**
     * Extract classification features from mission text.
     */
    private extractFeatures;
    /**
     * Calculate ambiguity level (0-1).
     */
    private calculateAmbiguity;
    /**
     * Calculate complexity score (0-1).
     */
    private calculateScore;
    /**
     * Convert score to complexity level.
     */
    private scoreToComplexity;
    /**
     * Determine routing based on score and features.
     */
    private determineRoute;
    /**
     * Identify individual intents in mission text.
     */
    identifyIntents(mission: string): IdentifiedIntent[];
    /**
     * Extract target hints using selector patterns.
     */
    private extractTargetHints;
    /**
     * Extract generic targets from mission text.
     */
    private extractGenericTargets;
    /**
     * Calculate confidence for an identified intent.
     */
    private calculateIntentConfidence;
    /**
     * Infer condition type from mission text.
     */
    private inferConditionType;
    /**
     * Register a custom pattern.
     */
    registerPattern(pattern: ActionPattern): void;
    /**
     * Get all registered patterns.
     */
    getPatterns(): ActionPattern[];
    /**
     * Check if a mission is too ambiguous to process.
     */
    isAmbiguous(mission: string, threshold?: number): boolean;
    /**
     * Generate clarification questions for ambiguous missions.
     */
    generateClarifications(mission: string): string[];
}
//# sourceMappingURL=intent-classifier.d.ts.map