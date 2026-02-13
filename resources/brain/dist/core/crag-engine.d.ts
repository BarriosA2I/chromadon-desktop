/**
 * CRAG Decision Engine
 *
 * Neural RAG Brain Pattern: Corrective RAG
 *
 * Decision tree for selector healing:
 * - GENERATE (confidence > 0.7): Use healed selector directly
 * - DECOMPOSE (0.4 < confidence <= 0.7): Try multiple strategies in parallel
 * - WEBSEARCH (confidence <= 0.4): Visual identification fallback via VLM
 */
/// <reference types="node" />
/// <reference types="node" />
import { CRAGAction, type Selector } from '../interfaces';
import type { SelectorCandidate } from './selector-engine';
import type { HealingRecord } from './healing-memory';
/**
 * CRAG thresholds for decision making.
 */
export interface CRAGThresholds {
    /** Confidence above this → GENERATE */
    generateThreshold: number;
    /** Confidence above this but below generate → DECOMPOSE */
    decomposeThreshold: number;
}
/**
 * Context for CRAG decision.
 */
export interface CRAGContext {
    /** Candidates from selector generation */
    candidates: SelectorCandidate[];
    /** Historical healing records */
    historicalRecords: HealingRecord[];
    /** Whether visual fallback is available */
    visualAvailable: boolean;
    /** Current page URL */
    currentUrl: string;
    /** Screenshot buffer for visual identification */
    screenshot?: Buffer;
}
/**
 * CRAG decision result.
 */
export interface CRAGDecision {
    /** The action to take */
    action: CRAGAction;
    /** Confidence in this decision */
    confidence: number;
    /** Reasoning for this decision */
    reason: string;
    /** Selected selector(s) for GENERATE */
    selectedSelector?: Selector;
    /** Strategies to try for DECOMPOSE */
    strategiesToTry?: Selector[];
    /** Visual description for WEBSEARCH */
    visualQuery?: string;
}
/**
 * CRAG metrics for observability.
 */
export interface CRAGMetrics {
    totalDecisions: number;
    generateCount: number;
    decomposeCount: number;
    websearchCount: number;
    avgConfidence: number;
    decisionHistory: Array<{
        action: CRAGAction;
        confidence: number;
        timestamp: Date;
    }>;
}
/**
 * CRAG Decision Engine for selector healing.
 */
export declare class CRAGEngine {
    private thresholds;
    private metrics;
    constructor(thresholds?: Partial<CRAGThresholds>);
    /**
     * Make a CRAG decision based on context.
     */
    decide(context: CRAGContext): CRAGDecision;
    /**
     * GENERATE: High confidence, use best selector directly.
     */
    private makeGenerateDecision;
    /**
     * DECOMPOSE: Medium confidence, try multiple strategies.
     */
    private makeDecomposeDecision;
    /**
     * WEBSEARCH: Low confidence, visual identification.
     */
    private makeWebsearchDecision;
    /**
     * Calculate aggregate confidence from candidates.
     */
    private calculateCandidateConfidence;
    /**
     * Calculate confidence boost from historical records.
     */
    private calculateHistoricalBoost;
    /**
     * Build visual query for VLM-based identification.
     */
    private buildVisualQuery;
    /**
     * Record metrics for this decision.
     */
    private recordMetrics;
    /**
     * Get current metrics.
     */
    getMetrics(): CRAGMetrics;
    /**
     * Reset metrics.
     */
    resetMetrics(): void;
    /**
     * Get decision distribution.
     */
    getDistribution(): Record<CRAGAction, number>;
    /**
     * Adjust thresholds based on success rates.
     * Call this periodically to auto-tune.
     */
    autoTuneThresholds(successRates: {
        generate: number;
        decompose: number;
        websearch: number;
    }): void;
}
//# sourceMappingURL=crag-engine.d.ts.map