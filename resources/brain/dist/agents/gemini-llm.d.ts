/**
 * Shared Gemini LLM Helper for Agent System
 * ==========================================
 * Gemini-first with Anthropic fallback.
 * Used by all 27 agents across tiers 0-4.
 *
 * Model tier mapping:
 *   haiku  → gemini-2.0-flash  ($0.10/M)
 *   sonnet → gemini-2.5-flash  ($0.30/M)
 *   opus   → gemini-2.5-pro    ($1.25/M)
 *
 * @author Barrios A2I
 */
/** Map agent model tiers to Gemini model IDs */
export declare function getGeminiModelId(tier: string): string;
/**
 * Text-only LLM call: Gemini first, Anthropic fallback.
 */
export declare function callGemini(systemPrompt: string, userMessage: string, options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
}): Promise<string>;
/**
 * Vision + text LLM call: Gemini first, Anthropic fallback.
 */
export declare function callGeminiVision(systemPrompt: string, imageBase64: string, userMessage: string, options?: {
    model?: string;
    maxTokens?: number;
    mimeType?: string;
}): Promise<string>;
//# sourceMappingURL=gemini-llm.d.ts.map