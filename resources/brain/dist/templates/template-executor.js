"use strict";
/**
 * MISSION TEMPLATES — Tool Executor
 *
 * Factory pattern. mission_from_template can optionally schedule via TheScheduler.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTemplateExecutor = void 0;
function createTemplateExecutor(loader, scheduler) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'mission_list_templates': {
                    const category = input.category;
                    const templates = loader.listTemplates(category);
                    if (templates.length === 0) {
                        return JSON.stringify({ templates: [], message: 'No templates found for that category.' });
                    }
                    // Return compact list (no full prompts to save context)
                    const list = templates.map(t => ({
                        id: t.id,
                        name: t.name,
                        icon: t.icon,
                        category: t.category,
                        description: t.description,
                        schedulable: t.schedulable,
                        suggestedSchedule: t.suggestedSchedule,
                        variableCount: t.variables.length,
                    }));
                    return JSON.stringify({ templates: list, count: list.length });
                }
                case 'mission_from_template': {
                    const templateId = input.template_id;
                    if (!templateId)
                        return JSON.stringify({ error: 'template_id is required' });
                    const template = loader.getTemplate(templateId);
                    if (!template)
                        return JSON.stringify({ error: `Template "${templateId}" not found.` });
                    const vars = input.variables || {};
                    const { prompt, error } = loader.substituteVariables(template, vars);
                    if (error)
                        return JSON.stringify({ error });
                    // If scheduled_time provided, schedule via TheScheduler
                    const scheduledTime = input.scheduled_time;
                    if (scheduledTime && scheduler) {
                        // Import chrono-node dynamically to parse NL time
                        let scheduledTimeUtc;
                        try {
                            const chrono = require('chrono-node');
                            const parsed = chrono.parseDate(scheduledTime, new Date(), { forwardDate: true });
                            scheduledTimeUtc = parsed ? parsed.toISOString() : new Date(scheduledTime).toISOString();
                        }
                        catch {
                            scheduledTimeUtc = new Date(scheduledTime).toISOString();
                        }
                        const taskId = scheduler.addTask({
                            instruction: prompt,
                            taskType: template.category === 'social' ? 'social_post' : 'custom',
                            scheduledTimeUtc,
                            recurrence: input.recurrence || 'none',
                            templateId: template.id,
                        });
                        return JSON.stringify({
                            scheduled: true,
                            taskId,
                            templateId: template.id,
                            templateName: template.name,
                            scheduledTime: scheduledTimeUtc,
                            recurrence: input.recurrence || 'none',
                            message: `Scheduled "${template.name}" for ${scheduledTimeUtc}`,
                        });
                    }
                    // No schedule — return prompt for immediate execution
                    return JSON.stringify({
                        scheduled: false,
                        templateId: template.id,
                        templateName: template.name,
                        prompt,
                        message: `Ready to execute "${template.name}". Use this prompt to run the mission now.`,
                    });
                }
                case 'mission_get_template': {
                    const templateId = input.template_id;
                    if (!templateId)
                        return JSON.stringify({ error: 'template_id is required' });
                    const template = loader.getTemplate(templateId);
                    if (!template)
                        return JSON.stringify({ error: `Template "${templateId}" not found.` });
                    return JSON.stringify(template);
                }
                case 'mission_suggest_templates': {
                    const userMessage = input.user_message;
                    if (!userMessage)
                        return JSON.stringify({ error: 'user_message is required' });
                    const suggestions = loader.suggestTemplates(userMessage);
                    if (suggestions.length === 0) {
                        return JSON.stringify({
                            suggestions: [],
                            message: 'No matching templates found. You can describe what you want and I\'ll help create a custom mission.',
                        });
                    }
                    const list = suggestions.map(t => ({
                        id: t.id,
                        name: t.name,
                        icon: t.icon,
                        description: t.description,
                        variables: t.variables.map(v => ({ name: v.name, label: v.label, required: v.required })),
                    }));
                    return JSON.stringify({ suggestions: list });
                }
                default:
                    return JSON.stringify({ error: `Unknown template tool: ${toolName}` });
            }
        }
        catch (err) {
            return JSON.stringify({ error: err.message });
        }
    };
}
exports.createTemplateExecutor = createTemplateExecutor;
//# sourceMappingURL=template-executor.js.map