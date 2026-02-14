/**
 * Marketing Queue - Tool Executor
 *
 * Routes marketing tool calls to the Desktop's queue API
 * and returns formatted text results for Claude's consumption.
 *
 * @author Barrios A2I
 */
export type MarketingExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
/**
 * Creates an executor function that calls the Desktop control server's
 * queue endpoints to schedule and query marketing tasks.
 */
export declare function createMarketingExecutor(desktopUrl: string): MarketingExecutor;
//# sourceMappingURL=marketing-executor.d.ts.map