/**
 * Marketing Queue - Tool Executor
 *
 * Routes marketing tool calls to the Desktop's queue API
 * and analytics database, returning formatted text for Claude's consumption.
 *
 * @author Barrios A2I
 */
import type { AnalyticsDatabase } from '../analytics/database';
export type MarketingExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
/**
 * Creates an executor function that calls the Desktop control server's
 * queue endpoints and analytics DB to handle marketing tools.
 */
export declare function createMarketingExecutor(desktopUrl: string, analyticsDb?: AnalyticsDatabase | null): MarketingExecutor;
//# sourceMappingURL=marketing-executor.d.ts.map