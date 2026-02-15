/**
 * Social Media Monitoring - Tool Executor
 *
 * Routes social_monitor and monitoring_log tool calls to the SocialMonitor.
 *
 * @author Barrios A2I
 */
import type { SocialMonitor } from './social-monitor';
import type { AnalyticsDatabase } from '../analytics/database';
export declare function createMonitoringExecutor(monitor: SocialMonitor, db: AnalyticsDatabase): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=monitor-executor.d.ts.map