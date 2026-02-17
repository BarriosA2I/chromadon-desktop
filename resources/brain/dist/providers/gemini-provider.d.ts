/**
 * CHROMADON Gemini Provider
 * =========================
 * Wraps Google's Generative AI SDK to provide an Anthropic-compatible
 * streaming interface. The orchestrator loop stays unchanged — only the
 * stream initialization swaps out.
 *
 * Format conversions:
 *   Anthropic messages → Gemini contents
 *   Anthropic tool_use → Gemini functionCall
 *   Anthropic tool_result → Gemini functionResponse
 *   Gemini response → Anthropic-format finalMessage
 *
 * @author Barrios A2I
 */
export interface GeminiStreamParams {
    model: string;
    system: string;
    messages: any[];
    tools: any[];
    maxTokens: number;
    temperature: number;
    toolConfig?: {
        mode?: 'AUTO' | 'ANY' | 'NONE';
        allowedFunctionNames?: string[];
    };
}
export interface GeminiStreamResult {
    on(event: 'text', cb: (text: string) => void): GeminiStreamResult;
    on(event: 'contentBlock', cb: (block: any) => void): GeminiStreamResult;
    on(event: 'error', cb: (err: Error) => void): GeminiStreamResult;
    finalMessage(): Promise<{
        content: any[];
        stop_reason: string;
        usage: {
            input_tokens: number;
            output_tokens: number;
        };
    }>;
    abort(): void;
}
export declare class GeminiProvider {
    private client;
    constructor(apiKey: string);
    /**
     * Stream a chat completion, returning an Anthropic-compatible stream object.
     * The orchestrator loop can use this identically to Anthropic's stream.
     */
    streamChat(params: GeminiStreamParams): GeminiStreamResult;
    private _runStream;
}
//# sourceMappingURL=gemini-provider.d.ts.map