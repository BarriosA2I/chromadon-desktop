"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRAGEngine = void 0;
const interfaces_1 = require("../interfaces");
const DEFAULT_THRESHOLDS = {
    generateThreshold: 0.7,
    decomposeThreshold: 0.4,
};
/**
 * CRAG Decision Engine for selector healing.
 */
class CRAGEngine {
    thresholds;
    metrics = {
        totalDecisions: 0,
        generateCount: 0,
        decomposeCount: 0,
        websearchCount: 0,
        avgConfidence: 0,
        decisionHistory: [],
    };
    constructor(thresholds = {}) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }
    /**
     * Make a CRAG decision based on context.
     */
    decide(context) {
        // Calculate aggregate confidence
        const candidateConfidence = this.calculateCandidateConfidence(context.candidates);
        const historicalBoost = this.calculateHistoricalBoost(context.historicalRecords);
        const totalConfidence = Math.min(1, candidateConfidence + historicalBoost);
        let decision;
        if (totalConfidence > this.thresholds.generateThreshold) {
            decision = this.makeGenerateDecision(context, totalConfidence);
        }
        else if (totalConfidence > this.thresholds.decomposeThreshold) {
            decision = this.makeDecomposeDecision(context, totalConfidence);
        }
        else {
            decision = this.makeWebsearchDecision(context, totalConfidence);
        }
        this.recordMetrics(decision);
        return decision;
    }
    /**
     * GENERATE: High confidence, use best selector directly.
     */
    makeGenerateDecision(context, confidence) {
        // Select the best candidate
        const bestCandidate = context.candidates[0];
        if (!bestCandidate) {
            // Fall back to historical if no candidates
            const bestHistorical = context.historicalRecords[0];
            if (bestHistorical) {
                return {
                    action: interfaces_1.CRAGAction.GENERATE,
                    confidence,
                    reason: 'Using historical healing pattern',
                    selectedSelector: bestHistorical.healedSelector,
                };
            }
            // No options, force DECOMPOSE
            return this.makeDecomposeDecision(context, confidence);
        }
        return {
            action: interfaces_1.CRAGAction.GENERATE,
            confidence,
            reason: `Best candidate: ${bestCandidate.reason} (confidence: ${bestCandidate.confidence.toFixed(2)})`,
            selectedSelector: {
                value: bestCandidate.value,
                strategy: bestCandidate.strategy,
                confidence: bestCandidate.confidence,
            },
        };
    }
    /**
     * DECOMPOSE: Medium confidence, try multiple strategies.
     */
    makeDecomposeDecision(context, confidence) {
        // Select top candidates from different strategies
        const strategiesToTry = [];
        const usedStrategies = new Set();
        for (const candidate of context.candidates) {
            if (!usedStrategies.has(candidate.strategy)) {
                strategiesToTry.push({
                    value: candidate.value,
                    strategy: candidate.strategy,
                    confidence: candidate.confidence,
                });
                usedStrategies.add(candidate.strategy);
                if (strategiesToTry.length >= 4)
                    break;
            }
        }
        // Add historical patterns if we have room
        for (const record of context.historicalRecords) {
            if (strategiesToTry.length < 5 &&
                !usedStrategies.has(record.healedSelector.strategy)) {
                strategiesToTry.push(record.healedSelector);
                usedStrategies.add(record.healedSelector.strategy);
            }
        }
        return {
            action: interfaces_1.CRAGAction.DECOMPOSE,
            confidence,
            reason: `Trying ${strategiesToTry.length} strategies in parallel`,
            strategiesToTry,
        };
    }
    /**
     * WEBSEARCH: Low confidence, visual identification.
     */
    makeWebsearchDecision(context, confidence) {
        if (!context.visualAvailable) {
            // No visual available, force DECOMPOSE with what we have
            return {
                action: interfaces_1.CRAGAction.DECOMPOSE,
                confidence,
                reason: 'Visual fallback unavailable, trying available strategies',
                strategiesToTry: context.candidates.slice(0, 3).map(c => ({
                    value: c.value,
                    strategy: c.strategy,
                    confidence: c.confidence,
                })),
            };
        }
        // Build visual query from context
        const visualQuery = this.buildVisualQuery(context);
        return {
            action: interfaces_1.CRAGAction.WEBSEARCH,
            confidence,
            reason: 'Low confidence in selectors, using visual identification',
            visualQuery,
        };
    }
    /**
     * Calculate aggregate confidence from candidates.
     */
    calculateCandidateConfidence(candidates) {
        if (candidates.length === 0)
            return 0;
        // Weight by position (earlier = more weight)
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < Math.min(candidates.length, 5); i++) {
            const weight = 1 / (i + 1); // 1, 0.5, 0.33, 0.25, 0.2
            const candidate = candidates[i];
            if (candidate) {
                weightedSum += candidate.confidence * candidate.stabilityScore * weight;
                totalWeight += weight;
            }
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 0;
    }
    /**
     * Calculate confidence boost from historical records.
     */
    calculateHistoricalBoost(records) {
        if (records.length === 0)
            return 0;
        // Boost based on successful historical healings
        const relevantRecords = records.filter(r => r.successRate > 0.7);
        if (relevantRecords.length === 0)
            return 0;
        const avgSuccessRate = relevantRecords.reduce((sum, r) => sum + r.successRate, 0) /
            relevantRecords.length;
        // Max boost of 0.15 from historical data
        return Math.min(0.15, avgSuccessRate * 0.15);
    }
    /**
     * Build visual query for VLM-based identification.
     */
    buildVisualQuery(context) {
        const parts = [];
        // Add candidate hints
        if (context.candidates.length > 0) {
            const firstCandidate = context.candidates[0];
            if (firstCandidate) {
                if (firstCandidate.strategy === 'text') {
                    parts.push(`element with text containing "${firstCandidate.value.replace('text=', '')}"`);
                }
                else if (firstCandidate.strategy === 'aria') {
                    parts.push(`element with accessibility label`);
                }
            }
        }
        // Add historical context
        if (context.historicalRecords.length > 0) {
            const firstRecord = context.historicalRecords[0];
            if (firstRecord?.context.nearText) {
                parts.push(`near text "${firstRecord.context.nearText}"`);
            }
            if (firstRecord?.context.expectedTag) {
                parts.push(`${firstRecord.context.expectedTag} element`);
            }
        }
        return parts.length > 0 ? parts.join(', ') : 'interactive element matching the action context';
    }
    /**
     * Record metrics for this decision.
     */
    recordMetrics(decision) {
        this.metrics.totalDecisions++;
        switch (decision.action) {
            case interfaces_1.CRAGAction.GENERATE:
                this.metrics.generateCount++;
                break;
            case interfaces_1.CRAGAction.DECOMPOSE:
                this.metrics.decomposeCount++;
                break;
            case interfaces_1.CRAGAction.WEBSEARCH:
                this.metrics.websearchCount++;
                break;
        }
        // Update running average
        this.metrics.avgConfidence =
            (this.metrics.avgConfidence * (this.metrics.totalDecisions - 1) +
                decision.confidence) /
                this.metrics.totalDecisions;
        // Keep last 100 decisions
        this.metrics.decisionHistory.push({
            action: decision.action,
            confidence: decision.confidence,
            timestamp: new Date(),
        });
        if (this.metrics.decisionHistory.length > 100) {
            this.metrics.decisionHistory.shift();
        }
    }
    /**
     * Get current metrics.
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset metrics.
     */
    resetMetrics() {
        this.metrics = {
            totalDecisions: 0,
            generateCount: 0,
            decomposeCount: 0,
            websearchCount: 0,
            avgConfidence: 0,
            decisionHistory: [],
        };
    }
    /**
     * Get decision distribution.
     */
    getDistribution() {
        const total = this.metrics.totalDecisions || 1;
        return {
            [interfaces_1.CRAGAction.GENERATE]: this.metrics.generateCount / total,
            [interfaces_1.CRAGAction.DECOMPOSE]: this.metrics.decomposeCount / total,
            [interfaces_1.CRAGAction.WEBSEARCH]: this.metrics.websearchCount / total,
        };
    }
    /**
     * Adjust thresholds based on success rates.
     * Call this periodically to auto-tune.
     */
    autoTuneThresholds(successRates) {
        // If GENERATE is too aggressive (low success), raise threshold
        if (successRates.generate < 0.7 && this.thresholds.generateThreshold < 0.9) {
            this.thresholds.generateThreshold += 0.05;
        }
        // If DECOMPOSE is underutilized but successful, lower generate threshold
        if (successRates.decompose > 0.8 && this.thresholds.generateThreshold > 0.6) {
            this.thresholds.generateThreshold -= 0.02;
        }
        // If WEBSEARCH is often needed, lower decompose threshold
        if (this.metrics.websearchCount / (this.metrics.totalDecisions || 1) > 0.3) {
            this.thresholds.decomposeThreshold = Math.max(0.3, this.thresholds.decomposeThreshold - 0.05);
        }
    }
}
exports.CRAGEngine = CRAGEngine;
//# sourceMappingURL=crag-engine.js.map