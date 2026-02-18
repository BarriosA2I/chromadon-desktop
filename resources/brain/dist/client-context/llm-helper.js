"use strict";
/**
 * Shared LLM Helper — Gemini-first with Anthropic fallback
 *
 * Used by InterviewEngine, StrategyEngine, and DocumentProcessor
 * so they route through Gemini (client's primary LLM) instead of
 * hardcoding Anthropic.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.callLLMVision = exports.callLLMConversation = exports.callLLM = void 0;
const generative_ai_1 = require("@google/generative-ai");
/** Retry wrapper for Gemini API calls — 429 backoff (5s, 10s) */
async function withGeminiRetry(fn, label = 'callLLM') {
    const MAX_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            const is429 = err?.status === 429 || err?.message?.includes?.('429');
            if (is429 && attempt < MAX_RETRIES) {
                const backoffMs = (attempt + 1) * 5000;
                console.warn(`[Gemini] ${label} 429 — retrying in ${backoffMs}ms (${attempt + 1}/${MAX_RETRIES})`);
                await new Promise(r => setTimeout(r, backoffMs));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Unreachable');
}
/**
 * Simple text generation: Gemini first, Anthropic fallback.
 */
async function callLLM(systemPrompt, userMessage, maxTokens = 1000) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt,
        });
        return withGeminiRetry(async () => {
            const result = await model.generateContent(userMessage);
            return result.response.text();
        }, 'callLLM');
    }
    // Fallback to Anthropic if no Gemini key
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text || '';
}
exports.callLLM = callLLM;
/**
 * Multi-turn conversation: flattens messages into a single prompt for Gemini.
 */
async function callLLMConversation(systemPrompt, messages, maxTokens = 500) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: systemPrompt,
        });
        // Convert to Gemini chat format
        const history = messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
        const lastMessage = messages[messages.length - 1];
        return withGeminiRetry(async () => {
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(lastMessage.content);
            return result.response.text();
        }, 'callLLMConversation');
    }
    // Fallback to Anthropic
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text || '';
}
exports.callLLMConversation = callLLMConversation;
/**
 * Image description: Gemini vision first, Anthropic fallback.
 */
async function callLLMVision(base64Data, mimeType, prompt, maxTokens = 4000) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        return withGeminiRetry(async () => {
            const result = await model.generateContent([
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt },
            ]);
            return result.response.text();
        }, 'callLLMVision');
    }
    // Fallback to Anthropic vision
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    let mediaType = 'image/png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg'))
        mediaType = 'image/jpeg';
    else if (mimeType.includes('webp'))
        mediaType = 'image/webp';
    else if (mimeType.includes('gif'))
        mediaType = 'image/gif';
    const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
                    { type: 'text', text: prompt },
                ],
            }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text || '';
}
exports.callLLMVision = callLLMVision;
//# sourceMappingURL=llm-helper.js.map