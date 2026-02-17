"use strict";
// @ts-nocheck
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const events_1 = require("events");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('ai');
// ============================================================================
// FORMAT CONVERTERS
// ============================================================================
/**
 * Convert Anthropic tool definitions to Gemini functionDeclarations.
 * input_schema → parameters (same JSON Schema, just renamed)
 */
function convertToolsToGemini(anthropicTools) {
    if (!anthropicTools || anthropicTools.length === 0)
        return [];
    const declarations = anthropicTools.map(t => {
        const decl = {
            name: t.name,
            description: t.description || `Execute ${t.name}`,
        };
        if (t.input_schema && t.input_schema.properties && Object.keys(t.input_schema.properties).length > 0) {
            decl.parameters = sanitizeSchemaForGemini(t.input_schema);
        }
        return decl;
    });
    return [{ functionDeclarations: declarations }];
}
/**
 * Sanitize JSON Schema for Gemini compatibility.
 * Gemini doesn't support some JSON Schema features like `additionalProperties`,
 * `default`, `$schema`, or complex union types.
 */
function sanitizeSchemaForGemini(schema) {
    if (!schema || typeof schema !== 'object')
        return schema;
    const clean = {};
    for (const [key, value] of Object.entries(schema)) {
        // Skip unsupported keys
        if (['additionalProperties', 'default', '$schema', '$ref', 'examples'].includes(key))
            continue;
        if (key === 'properties' && typeof value === 'object') {
            clean.properties = {};
            for (const [propName, propSchema] of Object.entries(value)) {
                clean.properties[propName] = sanitizeSchemaForGemini(propSchema);
            }
        }
        else if (key === 'items' && typeof value === 'object') {
            clean.items = sanitizeSchemaForGemini(value);
        }
        else {
            clean[key] = value;
        }
    }
    return clean;
}
/**
 * Convert Anthropic message history to Gemini contents format.
 *
 * Anthropic: { role: 'user'|'assistant', content: string | ContentBlock[] }
 * Gemini:    { role: 'user'|'model', parts: Part[] }
 *
 * Special handling:
 *   - tool_use blocks → functionCall parts
 *   - tool_result blocks → functionResponse parts
 *   - image blocks → inlineData parts
 *   - Merge consecutive same-role messages (Gemini requires alternating)
 */
function convertMessagesToGemini(messages) {
    const contents = [];
    for (const msg of messages) {
        const role = msg.role === 'assistant' ? 'model' : 'user';
        let parts = [];
        if (typeof msg.content === 'string') {
            parts = [{ text: msg.content }];
        }
        else if (Array.isArray(msg.content)) {
            parts = msg.content.map((block) => convertBlockToPart(block, msg.role)).filter(Boolean);
        }
        // Skip empty parts
        if (parts.length === 0) {
            parts = [{ text: '(continued)' }];
        }
        // Merge with previous if same role (Gemini requires strict alternation)
        const prev = contents[contents.length - 1];
        if (prev && prev.role === role) {
            prev.parts.push(...parts);
        }
        else {
            contents.push({ role, parts });
        }
    }
    // Ensure first message is from user
    if (contents.length > 0 && contents[0].role !== 'user') {
        contents.unshift({ role: 'user', parts: [{ text: 'Continue.' }] });
    }
    // Ensure messages alternate — if two consecutive have same role, merge
    const final = [];
    for (const c of contents) {
        const prev = final[final.length - 1];
        if (prev && prev.role === c.role) {
            prev.parts.push(...c.parts);
        }
        else {
            final.push(c);
        }
    }
    return final;
}
/**
 * Convert a single Anthropic content block to a Gemini part.
 */
function convertBlockToPart(block, msgRole) {
    if (!block)
        return null;
    switch (block.type) {
        case 'text':
            return { text: block.text || '' };
        case 'tool_use':
            return {
                functionCall: {
                    name: block.name,
                    args: block.input || {},
                },
            };
        case 'tool_result': {
            // Extract the tool name — Gemini needs the actual function name, NOT the opaque tool_use_id
            const name = block.tool_name || block.tool_use_id || 'unknown_tool';
            let responseContent;
            if (typeof block.content === 'string') {
                responseContent = block.content;
            }
            else if (Array.isArray(block.content)) {
                // tool_result content can be an array of blocks (text + image)
                // Extract text parts, skip images for functionResponse
                const textParts = block.content
                    .filter((b) => b.type === 'text')
                    .map((b) => b.text);
                responseContent = textParts.join('\n') || 'OK';
            }
            else {
                responseContent = JSON.stringify(block.content) || 'OK';
            }
            return {
                functionResponse: {
                    name,
                    response: { result: responseContent },
                },
            };
        }
        case 'image':
            if (block.source?.type === 'base64') {
                return {
                    inlineData: {
                        mimeType: block.source.media_type || 'image/jpeg',
                        data: block.source.data,
                    },
                };
            }
            return { text: '[image]' };
        default:
            return { text: typeof block === 'string' ? block : JSON.stringify(block) };
    }
}
/**
 * Convert Gemini response parts back to Anthropic-format content blocks.
 */
function convertGeminiResponseToAnthropic(parts) {
    const blocks = [];
    let toolCallIndex = 0;
    for (const part of parts) {
        if (part.text) {
            blocks.push({ type: 'text', text: part.text });
        }
        else if (part.functionCall) {
            blocks.push({
                type: 'tool_use',
                id: `toolu_gemini_${Date.now()}_${toolCallIndex++}`,
                name: part.functionCall.name,
                input: part.functionCall.args || {},
            });
        }
    }
    return blocks;
}
// ============================================================================
// MALFORMED FUNCTION CALL RECOVERY
// ============================================================================
/**
 * Parse a MALFORMED_FUNCTION_CALL finishMessage to extract the intended
 * function name and arguments. Gemini sometimes emits Python code instead
 * of proper JSON function calls, especially for datetime computations.
 *
 * Example finishMessage:
 *   "from datetime import datetime, timedelta\nnow = datetime.now()\n..."
 *   "print(default_api.schedule_post(platforms=['twitter'], content='Hello'))"
 */
function parseMalformedFunctionCall(finishMessage) {
    if (!finishMessage)
        return null;
    try {
        // Extract function call: default_api.FUNC_NAME(ARGS)
        const callMatch = finishMessage.match(/default_api\.(\w+)\(([^)]*)\)/s);
        if (!callMatch)
            return null;
        const funcName = callMatch[1];
        const argsStr = callMatch[2];
        // Parse Python-style keyword arguments into a JS object
        const args = {};
        // Match keyword=value pairs (handles strings, lists, numbers, variables)
        const kwargPattern = /(\w+)\s*=\s*(\[.*?\]|'[^']*'|"[^"]*"|\w+)/g;
        let match;
        while ((match = kwargPattern.exec(argsStr)) !== null) {
            const key = match[1];
            let value = match[2];
            // Convert Python values to JS
            if (value.startsWith('[') && value.endsWith(']')) {
                // Python list → JS array: ['twitter', 'linkedin'] → ["twitter", "linkedin"]
                const items = value.slice(1, -1).split(',').map((s) => {
                    s = s.trim();
                    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
                        return s.slice(1, -1);
                    }
                    return s;
                }).filter(Boolean);
                value = items;
            }
            else if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                // String literal
                value = value.slice(1, -1);
            }
            else if (!isNaN(Number(value))) {
                value = Number(value);
            }
            else {
                // Variable reference — try to compute datetime values
                if (key === 'scheduled_time' || key.includes('time') || key.includes('date')) {
                    // Extract timedelta from the code
                    const deltaMatch = finishMessage.match(/timedelta\((\w+)\s*=\s*(\d+)\)/);
                    if (deltaMatch) {
                        const unit = deltaMatch[1]; // minutes, hours, days
                        const amount = parseInt(deltaMatch[2], 10);
                        const now = new Date();
                        if (unit === 'minutes')
                            now.setMinutes(now.getMinutes() + amount);
                        else if (unit === 'hours')
                            now.setHours(now.getHours() + amount);
                        else if (unit === 'days')
                            now.setDate(now.getDate() + amount);
                        value = now.toISOString();
                    }
                    else {
                        continue; // Skip unresolvable variables
                    }
                }
                else {
                    continue; // Skip unresolvable variables
                }
            }
            args[key] = value;
        }
        // Validate we got something useful
        if (!funcName || Object.keys(args).length === 0)
            return null;
        return { name: funcName, args };
    }
    catch {
        return null;
    }
}
// ============================================================================
// GEMINI PROVIDER
// ============================================================================
class GeminiProvider {
    client;
    constructor(apiKey) {
        if (!apiKey)
            throw new Error('Missing GEMINI_API_KEY');
        this.client = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    /**
     * Stream a chat completion, returning an Anthropic-compatible stream object.
     * The orchestrator loop can use this identically to Anthropic's stream.
     */
    streamChat(params) {
        const emitter = new events_1.EventEmitter();
        let aborted = false;
        let resolveMessage;
        let rejectMessage;
        const messagePromise = new Promise((resolve, reject) => {
            resolveMessage = resolve;
            rejectMessage = reject;
        });
        // Run the stream in the background
        this._runStream(params, emitter, () => aborted, resolveMessage, rejectMessage);
        const result = {
            on(event, cb) {
                emitter.on(event, cb);
                return result;
            },
            finalMessage() {
                return messagePromise;
            },
            abort() {
                aborted = true;
            },
        };
        return result;
    }
    async _runStream(params, emitter, isAborted, resolve, reject) {
        try {
            // Build the generative model with safety settings disabled
            const model = this.client.getGenerativeModel({
                model: params.model,
                systemInstruction: params.system ? { role: 'user', parts: [{ text: params.system }] } : undefined,
                safetySettings: [
                    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                    { category: generative_ai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: generative_ai_1.HarmBlockThreshold.BLOCK_NONE },
                ],
                generationConfig: {
                    maxOutputTokens: params.maxTokens,
                    temperature: params.temperature,
                },
            });
            // Convert formats
            const geminiTools = convertToolsToGemini(params.tools);
            const geminiContents = convertMessagesToGemini(params.messages);
            // Start streaming
            const streamResult = await model.generateContentStream({
                contents: geminiContents,
                tools: geminiTools.length > 0 ? geminiTools : undefined,
            });
            // Accumulate all parts for finalMessage
            const allParts = [];
            let inputTokens = 0;
            let outputTokens = 0;
            for await (const chunk of streamResult.stream) {
                if (isAborted())
                    break;
                // Extract usage metadata
                if (chunk.usageMetadata) {
                    inputTokens = chunk.usageMetadata.promptTokenCount || 0;
                    outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
                }
                // Process candidates
                const candidate = chunk.candidates?.[0];
                if (!candidate?.content?.parts)
                    continue;
                for (const part of candidate.content.parts) {
                    allParts.push(part);
                    if (part.text) {
                        emitter.emit('text', part.text);
                    }
                    if (part.functionCall) {
                        const block = {
                            type: 'tool_use',
                            id: `toolu_gemini_${Date.now()}_${allParts.length}`,
                            name: part.functionCall.name,
                            input: part.functionCall.args || {},
                        };
                        emitter.emit('contentBlock', block);
                    }
                }
            }
            if (isAborted()) {
                resolve({
                    content: [{ type: 'text', text: '\n\nExecution stopped by user.' }],
                    stop_reason: 'end_turn',
                    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
                });
                return;
            }
            // Also check the aggregated response for any parts we missed
            const aggregated = await streamResult.response;
            if (aggregated.usageMetadata) {
                inputTokens = aggregated.usageMetadata.promptTokenCount || inputTokens;
                outputTokens = aggregated.usageMetadata.candidatesTokenCount || outputTokens;
            }
            // Debug: log response details when output is 0 tokens
            const finishReason = aggregated.candidates?.[0]?.finishReason;
            if (outputTokens === 0 || allParts.length === 0) {
                log.info(`[Gemini] DEBUG 0-token response:`);
                log.info(`  finishReason: ${finishReason}`);
                log.info(`  allParts.length: ${allParts.length}`);
                log.info(`  candidates: ${JSON.stringify(aggregated.candidates?.map((c) => ({ finishReason: c.finishReason, finishMessage: c.finishMessage?.substring(0, 200), partsCount: c.content?.parts?.length })))}`);
            }
            // Handle MALFORMED_FUNCTION_CALL — Gemini tried to compute values via code
            // instead of outputting a proper function call JSON. Parse the intent and retry.
            if (finishReason === 'MALFORMED_FUNCTION_CALL' && allParts.length === 0) {
                const finishMessage = aggregated.candidates?.[0]?.finishMessage || '';
                log.info(`[Gemini] MALFORMED_FUNCTION_CALL detected. Attempting recovery...`);
                log.info(`[Gemini] finishMessage: ${finishMessage.substring(0, 300)}`);
                // Try to extract the function name and reconstruct the call
                const parsed = parseMalformedFunctionCall(finishMessage);
                if (parsed) {
                    log.info(`[Gemini] Recovered function call: ${parsed.name}(${JSON.stringify(parsed.args)})`);
                    const recoveredBlock = {
                        type: 'tool_use',
                        id: `toolu_gemini_${Date.now()}_recovered`,
                        name: parsed.name,
                        input: parsed.args,
                    };
                    emitter.emit('contentBlock', recoveredBlock);
                    resolve({
                        content: [recoveredBlock],
                        stop_reason: 'tool_use',
                        usage: { input_tokens: inputTokens, output_tokens: outputTokens },
                    });
                    return;
                }
                // Could not parse — return error text so orchestrator ends the stream gracefully
                log.warn(`[Gemini] Could not recover malformed function call`);
                const errorText = 'I tried to schedule that but ran into a formatting issue. Could you try again with the exact date and time? For example: "Schedule a post to Twitter for February 14 at 11:30 PM"';
                emitter.emit('text', errorText);
                resolve({
                    content: [{ type: 'text', text: errorText }],
                    stop_reason: 'end_turn',
                    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
                });
                return;
            }
            // Handle STOP with 0 output tokens — Gemini sometimes returns empty
            // on tool-result continuations. Flag for orchestrator retry.
            if ((finishReason === 'STOP' || !finishReason) && allParts.length === 0 && outputTokens === 0) {
                log.warn(`[Gemini] 0-token STOP response — flagging for retry`);
                resolve({
                    content: [{ type: 'text', text: '' }],
                    stop_reason: 'end_turn',
                    usage: { input_tokens: inputTokens, output_tokens: 0 },
                });
                return;
            }
            // Convert all accumulated parts to Anthropic format
            const anthropicContent = convertGeminiResponseToAnthropic(allParts);
            // Determine stop reason
            const hasToolUse = anthropicContent.some((b) => b.type === 'tool_use');
            let stopReason = 'end_turn';
            if (hasToolUse) {
                stopReason = 'tool_use';
            }
            else if (finishReason === 'MAX_TOKENS') {
                stopReason = 'max_tokens';
            }
            // Ensure we have at least some content
            if (anthropicContent.length === 0) {
                anthropicContent.push({ type: 'text', text: '' });
            }
            resolve({
                content: anthropicContent,
                stop_reason: stopReason,
                usage: { input_tokens: inputTokens, output_tokens: outputTokens },
            });
        }
        catch (err) {
            emitter.emit('error', err);
            reject(err);
        }
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini-provider.js.map