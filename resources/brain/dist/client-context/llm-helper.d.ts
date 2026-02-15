/**
 * Shared LLM Helper — Gemini-first with Anthropic fallback
 *
 * Used by InterviewEngine, StrategyEngine, and DocumentProcessor
 * so they route through Gemini (client's primary LLM) instead of
 * hardcoding Anthropic.
 *
 * @author Barrios A2I
 */
/**
 * Simple text generation: Gemini first, Anthropic fallback.
 */
export declare function callLLM(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string>;
/**
 * Multi-turn conversation: flattens messages into a single prompt for Gemini.
 */
export declare function callLLMConversation(systemPrompt: string, messages: Array<{
    role: 'assistant' | 'user';
    content: string;
}>, maxTokens?: number): Promise<string>;
/**
 * Image description: Gemini vision first, Anthropic fallback.
 */
export declare function callLLMVision(base64Data: string, mimeType: string, prompt: string, maxTokens?: number): Promise<string>;
//# sourceMappingURL=llm-helper.d.ts.map