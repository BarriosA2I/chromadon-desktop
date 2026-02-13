/**
 * CHROMADON Agentic Orchestrator - System Prompt
 * Claude Code-like browser automation assistant
 *
 * @author Barrios A2I
 */
import type { PageContext } from './ai-engine-v3';
export declare function buildOrchestratorSystemPrompt(pageContext?: PageContext, skillsJson?: string, clientKnowledge?: string): string;
