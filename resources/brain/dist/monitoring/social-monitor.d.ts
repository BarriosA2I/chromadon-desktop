/**
 * Social Media Monitoring - Always-On Monitor
 *
 * Follows DataCollector pattern: uses orchestrator.chat() with a silent
 * CollectorWriter to run monitoring in the background without interfering
 * with the user's active chat session.
 *
 * @author Barrios A2I
 */
import type { AgenticOrchestrator } from '../core/agentic-orchestrator';
import type { ExecutionContext } from '../core/browser-tools';
import type { PageContext } from '../core/ai-engine-v3';
import type { AnalyticsDatabase } from '../analytics/database';
import { type MonitorablePlatform } from './monitor-prompts';
export interface MonitorConfig {
    enabled: boolean;
    intervalMinutes: number;
    platforms: MonitorablePlatform[];
    maxRepliesPerCycle: number;
    idleThresholdMs: number;
}
export interface MonitoringLogEntry {
    platform: string;
    actionType: 'reply' | 'skip' | 'error' | 'cycle_start' | 'cycle_end';
    commentAuthor?: string;
    commentText?: string;
    replyText?: string;
    ruleId?: number;
    createdAt: string;
}
export interface MonitorStatus {
    enabled: boolean;
    running: boolean;
    lastRunAt: string | null;
    nextRunAt: string | null;
    config: MonitorConfig;
    totalReplies: number;
    totalCycles: number;
}
export declare class SocialMonitor {
    private orchestrator;
    private contextFactory;
    private db;
    private desktopUrl;
    private monitorInterval;
    private isMonitoring;
    private config;
    private lastRunAt;
    private totalReplies;
    private totalCycles;
    constructor(orchestrator: AgenticOrchestrator, contextFactory: () => Promise<{
        context: ExecutionContext;
        pageContext?: PageContext;
    }>, db: AnalyticsDatabase, desktopUrl: string, config?: Partial<MonitorConfig>);
    start(intervalMs?: number): void;
    stop(): void;
    configure(updates: Partial<MonitorConfig>): void;
    getStatus(): MonitorStatus;
    getConfig(): MonitorConfig;
    private runCycle;
    private monitorPlatform;
    private parseAndLog;
    private checkUserIdle;
    destroy(): void;
}
//# sourceMappingURL=social-monitor.d.ts.map