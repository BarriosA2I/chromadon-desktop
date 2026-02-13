"use strict";
/**
 * Skill Memory Executor
 *
 * Async executor factory for skill memory tools.
 * Follows the createYouTubeExecutor() / createAnalyticsExecutor() pattern.
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
                    return JSON.stringify({
                        found: true,
                        domain: match.site.domain,
                        siteName: match.site.siteName,
                        taskName: match.taskName,
                        task: match.task,
                        siteRules: match.site.siteRules,
                        knownSelectors: match.site.knownSelectors,
                        globalRules: skillMemory.cache?.globalRules || [],
                    });
                }
                case 'skills_record_success': {
                    skillMemory.learnNewSkill(input.domain, input.taskName, input.steps, {
                        siteName: input.siteName,
                        description: input.description,
                        rules: input.rules,
                    });
                    const stats = skillMemory.getStats();
                    return JSON.stringify({
                        success: true,
                        message: `Skill saved: ${input.domain} -> ${input.taskName}. Total: ${stats.domains} domains, ${stats.totalTasks} tasks.`,
                    });
                }
                case 'skills_record_failure': {
                    skillMemory.recordFailure(input.domain, input.taskName, input.failedStep, input.error);
                    return JSON.stringify({
                        success: true,
                        message: `Failure recorded for ${input.domain} -> ${input.taskName} step ${input.failedStep}.`,
                    });
                }
                case 'skills_save_client_notes': {
                    skillMemory.saveClientNotes(input.domain, input.taskName, input.notes);
                    return JSON.stringify({
                        success: true,
                        message: `Client notes saved for ${input.domain} -> ${input.taskName}. These will be shown on future visits.`,
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