"use strict";
// @ts-nocheck
/**
 * RALPH Progress Tracking
 *
 * Generates human-readable progress.txt and tracks progress metrics.
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
exports.RalphProgress = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class RalphProgress {
    baseDir;
    progressPath;
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.progressPath = path.join(baseDir, 'progress.txt');
    }
    /**
     * Update progress.txt with current state
     */
    async updateProgress(state, iterations, message) {
        const metrics = this.calculateMetrics(state, iterations);
        const content = this.generateProgressContent(state, metrics, iterations, message);
        fs.writeFileSync(this.progressPath, content);
    }
    /**
     * Calculate progress metrics
     */
    calculateMetrics(state, iterations) {
        const successfulIterations = iterations.filter(i => i.success).length;
        const failedIterations = iterations.filter(i => !i.success).length;
        const totalCost = iterations.reduce((sum, i) => sum + (i.costUsd || 0), 0);
        const totalTime = iterations.reduce((sum, i) => sum + (i.endTime - i.startTime), 0);
        const lastFailed = iterations.filter(i => !i.success).slice(-1)[0];
        return {
            totalIterations: iterations.length,
            successfulIterations,
            failedIterations,
            successRate: iterations.length > 0 ? successfulIterations / iterations.length : 0,
            totalCostUsd: totalCost,
            avgCostPerIteration: iterations.length > 0 ? totalCost / iterations.length : 0,
            totalTimeMs: totalTime,
            avgTimePerIteration: iterations.length > 0 ? totalTime / iterations.length : 0,
            currentStatus: state.status,
            lastError: lastFailed?.error,
        };
    }
    /**
     * Generate human-readable progress content
     */
    generateProgressContent(state, metrics, iterations, message) {
        const lines = [];
        const now = new Date();
        // Header
        lines.push('='.repeat(60));
        lines.push('RALPH PROGRESS REPORT');
        lines.push('='.repeat(60));
        lines.push('');
        // Mission Info
        lines.push(`Mission ID: ${state.missionId}`);
        lines.push(`Task: ${state.task}`);
        lines.push(`Status: ${state.status.toUpperCase()}`);
        lines.push(`Updated: ${now.toISOString()}`);
        lines.push('');
        // Progress Bar
        const maxIter = 50; // Default max iterations
        const progress = Math.min(state.iteration / maxIter, 1);
        const barLength = 40;
        const filled = Math.round(progress * barLength);
        const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
        lines.push(`Progress: [${bar}] ${state.iteration}/${maxIter}`);
        lines.push('');
        // Metrics
        lines.push('-'.repeat(30));
        lines.push('METRICS');
        lines.push('-'.repeat(30));
        lines.push(`Iterations: ${metrics.totalIterations} (${metrics.successfulIterations} success, ${metrics.failedIterations} failed)`);
        lines.push(`Success Rate: ${(metrics.successRate * 100).toFixed(1)}%`);
        lines.push(`Total Cost: $${metrics.totalCostUsd.toFixed(4)}`);
        lines.push(`Avg Cost/Iter: $${metrics.avgCostPerIteration.toFixed(4)}`);
        lines.push(`Total Time: ${this.formatDuration(metrics.totalTimeMs)}`);
        lines.push(`Avg Time/Iter: ${this.formatDuration(metrics.avgTimePerIteration)}`);
        lines.push('');
        // Last Error (if any)
        if (metrics.lastError) {
            lines.push('-'.repeat(30));
            lines.push('LAST ERROR');
            lines.push('-'.repeat(30));
            lines.push(metrics.lastError);
            lines.push('');
        }
        // Recent Iterations
        lines.push('-'.repeat(30));
        lines.push('RECENT ITERATIONS');
        lines.push('-'.repeat(30));
        const recentIterations = iterations.slice(-5);
        for (const iter of recentIterations) {
            const status = iter.success ? '✓' : '✗';
            const time = this.formatDuration(iter.endTime - iter.startTime);
            const cost = `$${(iter.costUsd || 0).toFixed(4)}`;
            lines.push(`  ${status} Iteration ${iter.iteration}: ${time} | ${cost}`);
            if (!iter.success && iter.error) {
                lines.push(`    Error: ${iter.error.substring(0, 60)}...`);
            }
        }
        lines.push('');
        // Adaptations
        if (state.adaptations && state.adaptations.length > 0) {
            lines.push('-'.repeat(30));
            lines.push('ADAPTATIONS APPLIED');
            lines.push('-'.repeat(30));
            for (const adapt of state.adaptations.slice(-5)) {
                const status = adapt.applied ? '✓' : '○';
                lines.push(`  ${status} [Iter ${adapt.iteration}] ${adapt.type}: ${adapt.description}`);
            }
            lines.push('');
        }
        // Current Message
        if (message) {
            lines.push('-'.repeat(30));
            lines.push('CURRENT ACTION');
            lines.push('-'.repeat(30));
            lines.push(message);
            lines.push('');
        }
        // Footer
        lines.push('='.repeat(60));
        lines.push('RALPH: Relentless Autonomous Loop with Persistent History');
        lines.push('Never give up. Never surrender. (Unless human says so.)');
        lines.push('='.repeat(60));
        return lines.join('\n');
    }
    /**
     * Format duration in human-readable format
     */
    formatDuration(ms) {
        if (ms < 1000)
            return `${ms}ms`;
        if (ms < 60000)
            return `${(ms / 1000).toFixed(1)}s`;
        if (ms < 3600000)
            return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
    }
    /**
     * Log a progress event
     */
    async logEvent(event, details) {
        const logPath = path.join(this.baseDir, 'events.log');
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${event}${details ? ' | ' + JSON.stringify(details) : ''}\n`;
        fs.appendFileSync(logPath, line);
    }
    /**
     * Get current progress as string
     */
    async getProgress() {
        if (!fs.existsSync(this.progressPath)) {
            return 'No progress file found.';
        }
        return fs.readFileSync(this.progressPath, 'utf-8');
    }
}
exports.RalphProgress = RalphProgress;
