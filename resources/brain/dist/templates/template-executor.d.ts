/**
 * MISSION TEMPLATES — Tool Executor
 *
 * Factory pattern. mission_from_template can optionally schedule via TheScheduler.
 *
 * @author Barrios A2I
 */
import { TemplateLoader } from './template-loader';
interface SchedulerAddTask {
    addTask(params: {
        instruction: string;
        taskType?: string;
        scheduledTimeUtc: string;
        recurrence?: string;
        templateId?: string;
    }): string;
}
export declare function createTemplateExecutor(loader: TemplateLoader, scheduler?: SchedulerAddTask | null): (toolName: string, input: Record<string, unknown>) => Promise<string>;
export {};
//# sourceMappingURL=template-executor.d.ts.map