/**
 * ACTIVITY LOG — Tool Executor
 *
 * Factory pattern matching existing CHROMADON tool executors.
 *
 * @author Barrios A2I
 */
import { ActivityLog } from './activity-log';
export declare function createActivityExecutor(activityLog: ActivityLog): (toolName: string, input: Record<string, unknown>) => Promise<string>;
//# sourceMappingURL=activity-executor.d.ts.map