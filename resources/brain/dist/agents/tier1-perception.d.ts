/**
 * CHROMADON Tier 1: Perception Layer
 * ===================================
 * THE VISION ANALYZER - Screenshot Analysis via Claude Vision
 * THE DOM INSPECTOR - DOM Parsing & Selector Generation
 * THE CONTEXT BUILDER - Page Context Synthesis
 * THE INTENT DECODER - Natural Language Intent Parsing
 *
 * These agents form the "eyes and understanding" of the system,
 * converting raw browser state into actionable intelligence.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AgentName, AgentConfig, PageAnalysis, ElementInfo, DOMSnapshot, SelectorStrategy, PageContext, ParsedIntent, IntentType, RiskLevel } from './types';
import { AgentEventBus } from './event-bus';
import { CircuitBreaker } from '../core/circuit-breaker';
declare abstract class BasePerceptionAgent {
    readonly name: AgentName;
    protected config: AgentConfig;
    protected anthropic: Anthropic;
    protected eventBus: AgentEventBus;
    protected circuitBreaker: CircuitBreaker;
    constructor(name: AgentName, config?: Partial<AgentConfig>);
    protected getModelId(): string;
    protected canExecute(): Promise<boolean>;
    protected recordSuccess(): void;
    protected recordFailure(): void;
    protected callLLM(systemPrompt: string, userMessage: string, options?: {
        maxTokens?: number;
        temperature?: number;
    }): Promise<string>;
    protected callVision(systemPrompt: string, imageBase64: string, userMessage: string, options?: {
        maxTokens?: number;
    }): Promise<string>;
    protected publishEvent(type: string, payload: unknown, correlationId?: string): void;
}
/**
 * THE VISION ANALYZER
 * -------------------
 * Uses Claude Vision to understand screenshots and identify:
 * - Interactive elements (buttons, links, inputs)
 * - Page structure and layout
 * - Current state (logged in, error shown, etc.)
 * - Visual anomalies or blockers
 */
export declare class TheVisionAnalyzer extends BasePerceptionAgent {
    constructor();
    analyzePage(screenshotBase64: string, context?: {
        url?: string;
        previousAction?: string;
        lookingFor?: string;
    }): Promise<PageAnalysis>;
    findElement(screenshotBase64: string, description: string): Promise<ElementInfo | null>;
    compareScreenshots(before: string, after: string, expectedChange: string): Promise<{
        changed: boolean;
        changes: string[];
        success: boolean;
    }>;
}
/**
 * THE DOM INSPECTOR
 * -----------------
 * Parses DOM structure and generates reliable selectors.
 * Works with raw HTML/DOM snapshots from the browser.
 */
export declare class TheDOMInspector extends BasePerceptionAgent {
    private selectorCache;
    constructor();
    parseDOM(html: string, focusArea?: string): Promise<DOMSnapshot>;
    generateSelector(html: string, elementDescription: string): Promise<SelectorStrategy>;
    findFormFields(html: string, formPurpose: string): Promise<Array<{
        fieldName: string;
        selector: string;
        type: string;
        required: boolean;
    }>>;
    clearCache(): void;
}
/**
 * THE CONTEXT BUILDER
 * -------------------
 * Synthesizes information from Vision and DOM into unified page context.
 * Creates rich understanding of current state for decision-making.
 */
export declare class TheContextBuilder extends BasePerceptionAgent {
    constructor();
    buildContext(visionAnalysis: PageAnalysis, domSnapshot: DOMSnapshot, additionalInfo?: {
        url?: string;
        previousActions?: string[];
        taskGoal?: string;
    }): Promise<PageContext>;
    assessRisk(context: PageContext, proposedAction: string): Promise<{
        level: RiskLevel;
        reasons: string[];
        mitigations: string[];
    }>;
}
/**
 * THE INTENT DECODER
 * ------------------
 * Parses natural language commands into structured intents.
 * Handles ambiguity, multi-step tasks, and context-aware interpretation.
 */
export declare class TheIntentDecoder extends BasePerceptionAgent {
    private intentPatterns;
    constructor();
    decode(naturalLanguageCommand: string, context?: PageContext): Promise<ParsedIntent>;
    resolveAmbiguity(intent: ParsedIntent, clarification: string): Promise<ParsedIntent>;
    decomposeComplex(intent: ParsedIntent): Promise<ParsedIntent[]>;
    quickMatch(command: string): IntentType | null;
}
export declare function createPerceptionAgents(): {
    visionAnalyzer: TheVisionAnalyzer;
    domInspector: TheDOMInspector;
    contextBuilder: TheContextBuilder;
    intentDecoder: TheIntentDecoder;
};
export { TheVisionAnalyzer, TheDOMInspector, TheContextBuilder, TheIntentDecoder, };
//# sourceMappingURL=tier1-perception.d.ts.map