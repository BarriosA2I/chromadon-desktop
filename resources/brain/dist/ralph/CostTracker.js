"use strict";
// @ts-nocheck
/**
 * RALPH Cost Tracking
 *
 * Monitors API costs and enforces limits to prevent runaway spending.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostTracker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Approximate costs per 1K tokens (updated 2026-02)
const MODEL_COSTS = {
    'claude-opus-4': { input: 0.015, output: 0.075 },
    'claude-sonnet-4': { input: 0.003, output: 0.015 },
    'claude-haiku-4-5': { input: 0.0008, output: 0.004 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
    'claude-3-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-haiku': { input: 0.00025, output: 0.00125 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'default': { input: 0.003, output: 0.015 },
};
class CostTracker {
    baseDir;
    costPath;
    limitUsd;
    entries = [];
    constructor(baseDir, limitUsd = 10.00) {
        this.baseDir = baseDir;
        this.costPath = path.join(baseDir, 'costs', 'summary.json');
        this.limitUsd = limitUsd;
    }
    /**
     * Initialize cost tracking
     */
    async initialize() {
        const costsDir = path.join(this.baseDir, 'costs');
        if (!fs.existsSync(costsDir)) {
            fs.mkdirSync(costsDir, { recursive: true });
        }
        // Load existing entries if resuming
        if (fs.existsSync(this.costPath)) {
            const content = fs.readFileSync(this.costPath, 'utf-8');
            const data = JSON.parse(content);
            this.entries = data.entries || [];
        }
    }
    /**
     * Record a cost entry
     */
    async recordCost(entry) {
        const fullEntry = {
            ...entry,
            timestamp: Date.now(),
        };
        this.entries.push(fullEntry);
        await this.save();
    }
    /**
     * Record cost from token usage
     */
    async recordTokenUsage(iteration, operation, model, inputTokens, outputTokens) {
        const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
        const costUsd = (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output;
        await this.recordCost({
            iteration,
            operation,
            model,
            inputTokens,
            outputTokens,
            costUsd,
        });
    }
    /**
     * Get current cost summary
     */
    getSummary() {
        const totalCostUsd = this.entries.reduce((sum, e) => sum + e.costUsd, 0);
        const totalInputTokens = this.entries.reduce((sum, e) => sum + (e.inputTokens || 0), 0);
        const totalOutputTokens = this.entries.reduce((sum, e) => sum + (e.outputTokens || 0), 0);
        const costByOperation = {};
        const costByModel = {};
        const costByIteration = {};
        for (const entry of this.entries) {
            // By operation
            costByOperation[entry.operation] = (costByOperation[entry.operation] || 0) + entry.costUsd;
            // By model
            if (entry.model) {
                costByModel[entry.model] = (costByModel[entry.model] || 0) + entry.costUsd;
            }
            // By iteration
            costByIteration[entry.iteration] = (costByIteration[entry.iteration] || 0) + entry.costUsd;
        }
        return {
            totalCostUsd,
            totalInputTokens,
            totalOutputTokens,
            entriesCount: this.entries.length,
            costByOperation,
            costByModel,
            costByIteration,
            limitUsd: this.limitUsd,
            remainingUsd: this.limitUsd - totalCostUsd,
            percentUsed: (totalCostUsd / this.limitUsd) * 100,
        };
    }
    /**
     * Check if cost limit has been reached
     */
    isLimitReached() {
        const summary = this.getSummary();
        return summary.totalCostUsd >= this.limitUsd;
    }
    /**
     * Check if approaching limit (80% threshold)
     */
    isApproachingLimit() {
        const summary = this.getSummary();
        return summary.percentUsed >= 80;
    }
    /**
     * Get remaining budget
     */
    getRemainingBudget() {
        const summary = this.getSummary();
        return summary.remainingUsd;
    }
    /**
     * Get total cost
     */
    getTotalCost() {
        return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
    }
    /**
     * Get cost for specific iteration
     */
    getIterationCost(iteration) {
        return this.entries
            .filter(e => e.iteration === iteration)
            .reduce((sum, e) => sum + e.costUsd, 0);
    }
    /**
     * Set new cost limit
     */
    setLimit(limitUsd) {
        this.limitUsd = limitUsd;
    }
    /**
     * Get cost limit
     */
    getLimit() {
        return this.limitUsd;
    }
    /**
     * Save to filesystem
     */
    async save() {
        const data = {
            entries: this.entries,
            summary: this.getSummary(),
            lastUpdated: Date.now(),
        };
        fs.writeFileSync(this.costPath, JSON.stringify(data, null, 2));
    }
    /**
     * Estimate cost for an operation
     */
    static estimateCost(model, estimatedInputTokens, estimatedOutputTokens) {
        const costs = MODEL_COSTS[model] || MODEL_COSTS['default'];
        return (estimatedInputTokens / 1000) * costs.input +
            (estimatedOutputTokens / 1000) * costs.output;
    }
}
exports.CostTracker = CostTracker;
