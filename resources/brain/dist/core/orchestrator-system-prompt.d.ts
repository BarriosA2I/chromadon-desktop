/**
 * CHROMADON Agentic Orchestrator - System Prompt
 * Claude Code-like browser automation assistant
 *
 * @author Barrios A2I
 */
import type { PageContext } from './ai-engine-v3';
export declare function buildOrchestratorSystemPrompt(pageContext?: PageContext, skillsJson?: string, clientKnowledge?: string, linkedPlatforms?: string, onboardingContext?: string): string;
/**
 * Compact system prompt for FAST tier tasks (~500 tokens vs ~40K).
 * Used for simple browser actions (click, navigate, scroll, etc.)
 * where the full prompt is overkill and wastes tokens.
 */
export declare function buildCompactSystemPrompt(linkedPlatforms?: string): string;
//# sourceMappingURL=orchestrator-system-prompt.d.ts.map