/**
 * Social Media Analytics - Tool Executor
 *
 * Routes analytics tool calls to the AnalyticsDatabase and returns
 * formatted text results for Claude's consumption.
 *
 * @author Barrios A2I
 */
import type { AnalyticsDatabase } from './database';
export type AnalyticsExecutor = (toolName: string, input: Record<string, any>) => string;
/**
 * Creates an executor function bound to an AnalyticsDatabase instance.
 */
export declare function createAnalyticsExecutor(db: AnalyticsDatabase): AnalyticsExecutor;
//# sourceMappingURL=analytics-executor.d.ts.map