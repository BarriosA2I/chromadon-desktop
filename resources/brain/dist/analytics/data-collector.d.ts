/**
 * Social Media Analytics - Data Collector
 *
 * Scheduled browser scraping via the Agentic Orchestrator.
 * Follows SocialOverlord pattern: orchestrator + contextFactory + db.
 *
 * @author Barrios A2I
 */
import type { AgenticOrchestrator } from '../core/agentic-orchestrator';
import type { ExecutionContext } from '../core/browser-tools';
import type { PageContext } from '../core/ai-engine-v3';
import type { AnalyticsDatabase } from './database';
import { type CollectablePlatform } from './collector-prompts';
interface CollectionResult {
    platform: string;
    success: boolean;
    postsCollected: number;
    error?: string;
}
export declare class DataCollector {
    private orchestrator;
    private contextFactory;
    private db;
    private collectInterval;
    private isCollecting;
    constructor(orchestrator: AgenticOrchestrator, contextFactory: () => Promise<{
        context: ExecutionContext;
        pageContext?: PageContext;
    }>, db: AnalyticsDatabase);
    /**
     * Start scheduled collection (every 6 hours by default).
     */
    startSchedule(intervalMs?: number): void;
    stopSchedule(): void;
    /**
     * Collect data from all supported platforms.
     */
    collectAll(): Promise<CollectionResult[]>;
    /**
     * Collect data from a single platform via the orchestrator.
     */
    collectPlatform(platform: CollectablePlatform): Promise<CollectionResult>;
    /**
     * Parse orchestrator response JSON and store in database.
     */
    private parseAndStore;
    private calculateEngagement;
    private extractHashtags;
    destroy(): void;
}
export {};
//# sourceMappingURL=data-collector.d.ts.map