/**
 * CHROMADON CortexRouter — Agent-First Chat Routing
 * ==================================================
 * Sits between /api/orchestrator/chat and the execution backends.
 * Routes messages to the 27-agent system or the monolithic orchestrator.
 *
 * Routing priority:
 *   1. Copyright workflows → monolithic (VideoTracker + auto-continue)
 *   2. Simple commands → direct agent dispatch via EventBus (no LLM)
 *   3. YouTube API tasks → YouTubeToolBridge (no LLM, ~200ms)
 *   3.5. Conversational/status → monolithic orchestrator (greetings, questions)
 *   3.6. Social media tasks → SocialMediaToolBridge → SocialOverlord (~15-20s)
 *   4. Template/complex → TheCortex planning → DAG execution
 *   5. Fallback → monolithic orchestrator
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
    private isCopyrightWorkflow;
    private isConversational;
    private isSchedulingIntent;
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