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
import type { TrinityIntelligence } from '../trinity/trinity-intelligence';
export type SchedulerExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
export declare function createSchedulerExecutor(scheduler: TheScheduler, getAuthenticatedPlatforms?: () => Promise<string[]>, getClientMedia?: () => {
    primaryLogo: string | null;
    primaryVideo: string | null;
} | null, trinityIntel?: TrinityIntelligence | null): SchedulerExecutor;
//# sourceMappingURL=scheduler-executor.d.ts.map