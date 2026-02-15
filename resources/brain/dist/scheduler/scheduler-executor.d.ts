/**
 * THE_SCHEDULER — Tool Call Executor
 *
 * Routes AI tool calls to TheScheduler methods.
 * For schedule_post, constructs NL instruction from structured fields.
 * Uses chrono-node for natural language time parsing.
 *
 * @author Barrios A2I
 */
import { TheScheduler } from './the-scheduler';
export type SchedulerExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
export declare function createSchedulerExecutor(scheduler: TheScheduler): SchedulerExecutor;
//# sourceMappingURL=scheduler-executor.d.ts.map