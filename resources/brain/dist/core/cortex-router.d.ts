/**
 * CHROMADON CortexRouter — Agent-First Chat Routing
 * ==================================================
 * Sits between /api/orchestrator/chat and the execution backends.
 * Routes messages to the 27-agent system or the monolithic orchestrator.
 *
 * Routing priority:
 *   1. Copyright workflows (100) → monolithic (VideoTracker + auto-continue)
 *   2. Simple commands (90) → direct agent dispatch via EventBus (no LLM)
 *   3. YouTube API tasks (80) → YouTubeToolBridge (no LLM, ~200ms)
 *   3.4. OBS intent (76) → monolithic (forceToolCall + OBS tools only)
 *   3.5. Conversational/status (75) → monolithic orchestrator (greetings, questions)
 *   3.6. Social media tasks (70) → SocialMediaToolBridge → SocialOverlord (~15-20s)
 *   3.7. Browser navigation (65) → monolithic orchestrator (multi-platform, alt verbs)
 *   3.8. Client context (60) → monolithic orchestrator
 *   3.9. Scheduling (55) → monolithic orchestrator (schedule_post tool)
 *   4. Cortex planning (50) → TheCortex DAG execution (catch-all)
 *
 * @author Barrios A2I
 */
import { TheCortex, TheTemporalSequencer } from '../agents/tier0-orchestration';
import { YouTubeToolBridge } from '../agents/youtube-tool-bridge';
import { SocialMediaToolBridge } from '../agents/social-tool-bridge';
import type { SSEWriter } from './agentic-orchestrator';
import { AgenticOrchestrator } from './agentic-orchestrator';
import type { ExecutionContext } from './browser-tools';
import type { PageContext } from './ai-engine-v3';
interface CortexRouterDeps {
    cortex: TheCortex;
    sequencer: TheTemporalSequencer;
    orchestrator: AgenticOrchestrator;
    youtubeBridge?: YouTubeToolBridge;
    socialBridge?: SocialMediaToolBridge;
}
interface RouteCandidate {
    name: string;
    priority: number;
    match: (msg: string) => any;
    execute: (matchData: any, sessionId: string | undefined, message: string, writer: SSEWriter, context: ExecutionContext, pageContext?: PageContext) => Promise<void>;
}
export declare class CortexRouter {
    private cortex;
    private sequencer;
    private orchestrator;
    private youtubeBridge;
    private socialBridge;
    private routes;
    private _lastRouteDecision;
    constructor(deps: CortexRouterDeps);
    /**
     * Build sorted route candidates (highest priority first).
     */
    private buildRoutes;
    /**
     * Register an external route candidate (e.g., from a plugin).
     */
    addRoute(route: RouteCandidate): void;
    /**
     * Main entry point — routes user messages to the best backend.
     * Iterates through priority-sorted route candidates until one matches.
     */
    chat(sessionId: string | undefined, message: string, writer: SSEWriter, context: ExecutionContext, pageContext?: PageContext): Promise<void>;
    /** Last routing decision — exposed for diagnostics */
    get lastRouteDecision(): {
        route: string;
        priority: number;
        message: string;
        routeMs: number;
        timestamp: number;
    } | null;
    private isCopyrightWorkflow;
    private isConversational;
    private isSchedulingIntent;
    private isBrowserNavigation;
    private isOBSIntent;
    private isClientContextQuery;
    private parseSimpleCommand;
    private parseYouTubeAPICommand;
    private parseSocialMediaTask;
    private resolveUrl;
    private executeSimpleCommand;
    private executeYouTubeAPI;
    private executeSocialMedia;
    private executeDAG;
}
export {};
//# sourceMappingURL=cortex-router.d.ts.map