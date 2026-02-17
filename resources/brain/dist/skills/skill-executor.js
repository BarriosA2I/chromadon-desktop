"use strict";
/**
 * Skill Memory Executor
 *
 * Async executor factory for skill memory tools.
 * v2.1: Enhanced with drift warnings, reliability info, drift report, stats, rollback.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSkillExecutor = void 0;
function createSkillExecutor(skillMemory) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'skills_lookup': {
                    const match = skillMemory.findMatchingTask(input.domain, input.intent);
                    if (!match) {
                        return JSON.stringify({
                            found: false,
                            message: `No skills found for ${input.domain}. You'll need to figure out the task manually. After success, call skills_record_success to save what worked.`,
                        });
                    }
                    // Build drift warning if applicable
                    const unresolvedDrift = match.task.drift?.driftedSelectors.filter(d => !d.resolvedAt) || [];
                    const driftWarning = unresolvedDrift.length > 0
                        ? `WARNING: ${unresolvedDrift.length} selector(s) may have changed since last verified. Use fallback selectors or try alternative approaches. Drifted: ${unresolvedDrift.map(d => d.selector).join(', ')}`
                        : null;
                    // Build reliability info if stats available
                    const reliability = match.task.stats ? {
                        successRate: match.task.stats.successRate,
                        totalAttempts: match.task.stats.totalAttempts,
                        lastSuccess: match.task.stats.lastSuccess,
                        averageDurationMs: match.task.stats.averageDurationMs,
                    } : null;
                    return JSON.stringify({
                        found: true,
                        domain: match.site.domain,
                        siteName: match.site.siteName,
                        taskName: match.taskName,
                        task: match.task,
                        siteRules: match.site.siteRules,
                        knownSelectors: match.site.knownSelectors,
                        globalRules: skillMemory.cache?.globalRules || [],
                        driftWarning,
                        reliability,
                        lastVerified: match.task.lastVerified || match.task.lastUsed || null,
                    });
                }
                case 'skills_record_success': {
                    skillMemory.learnNewSkill(input.domain, input.taskName, input.steps, {
                        siteName: input.siteName,
                        description: input.description,
                        rules: input.rules,
                        durationMs: input.durationMs,
                    });
                    const stats = skillMemory.getStats();
                    return JSON.stringify({
                        success: true,
                        message: `Skill saved: ${input.domain} -> ${input.taskName}. Total: ${stats.domains} domains, ${stats.totalTasks} tasks.`,
                    });
                }
                case 'skills_record_failure': {
                    skillMemory.recordFailure(input.domain, input.taskName, input.failedStep, input.error, input.failedSelector);
                    return JSON.stringify({
                        success: true,
                        message: `Failure recorded for ${input.domain} -> ${input.taskName} step ${input.failedStep}.${input.failedSelector ? ' Selector drift tracked.' : ''}`,
                    });
                }
                case 'skills_save_client_notes': {
                    skillMemory.saveClientNotes(input.domain, input.taskName, input.notes);
                    return JSON.stringify({
                        success: true,
                        message: `Client notes saved for ${input.domain} -> ${input.taskName}. These will be shown on future visits.`,
                    });
                }
                case 'skills_get_drift_report': {
                    const drifted = skillMemory.getDriftedTasks();
                    const filtered = input.domain
                        ? drifted.filter(d => d.domain === input.domain)
                        : drifted;
                    return JSON.stringify({
                        totalDrifted: filtered.length,
                        tasks: filtered.map(d => ({
                            domain: d.domain,
                            taskName: d.taskName,
                            unresolvedCount: d.drift.driftedSelectors.filter(s => !s.resolvedAt).length,
                            stabilityScore: d.drift.stabilityScore,
                            lastDriftAt: d.drift.lastDriftAt,
                            driftedSelectors: d.drift.driftedSelectors.filter(s => !s.resolvedAt).map(s => ({
                                selector: s.selector,
                                failedAt: s.failedAt,
                                error: s.error,
                            })),
                        })),
                    });
                }
                case 'skills_get_stats': {
                    if (input.domain && input.taskName) {
                        const taskStats = skillMemory.getTaskStats(input.domain, input.taskName);
                        if (!taskStats)
                            return JSON.stringify({ found: false, message: 'No stats for this task.' });
                        return JSON.stringify({ found: true, domain: input.domain, taskName: input.taskName, stats: taskStats });
                    }
                    const report = skillMemory.getReliabilityReport();
                    const filtered = input.domain
                        ? report.filter(r => r.domain === input.domain)
                        : report;
                    return JSON.stringify({
                        totalTasks: filtered.length,
                        tasks: filtered,
                    });
                }
                case 'skills_rollback': {
                    const success = skillMemory.rollbackSkill(input.domain, input.taskName);
                    if (!success) {
                        return JSON.stringify({
                            success: false,
                            message: `No previous version available for ${input.domain} -> ${input.taskName}. Cannot rollback.`,
                        });
                    }
                    return JSON.stringify({
                        success: true,
                        message: `Rolled back ${input.domain} -> ${input.taskName} to previous version. Test the skill again.`,
                    });
                }
                default:
                    return `Unknown skill tool: ${toolName}`;
            }
        }
        catch (err) {
            return JSON.stringify({ error: err.message });
        }
    };
}
exports.createSkillExecutor = createSkillExecutor;
//# sourceMappingURL=skill-executor.js.map