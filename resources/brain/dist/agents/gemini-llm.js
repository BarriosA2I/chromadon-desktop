"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.callGeminiVision = exports.callGemini = exports.getGeminiModelId = void 0;
const generative_ai_1 = require("@google/generative-ai");
/** Map agent model tiers to Gemini model IDs */
function getGeminiModelId(tier) {
    switch (tier) {
        case 'haiku': return 'gemini-2.0-flash';
        case 'sonnet': return 'gemini-2.5-flash';
        case 'opus': return 'gemini-2.5-pro';
        default: return 'gemini-2.5-flash';
    }
}
exports.getGeminiModelId = getGeminiModelId;
/** Map agent model tiers to Anthropic model IDs (fallback) */
function getAnthropicModelId(tier) {
    switch (tier) {
        case 'haiku': return 'claude-haiku-4-5-20251001';
        case 'sonnet': return 'claude-sonnet-4-20250514';
        case 'opus': return 'claude-opus-4-20250514';
        default: return 'claude-sonnet-4-20250514';
    }
}
/**
 * Text-only LLM call: Gemini first, Anthropic fallback.
 */
async function callGemini(systemPrompt, userMessage, options = {}) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const modelTier = options.model || 'sonnet';
    if (geminiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: getGeminiModelId(modelTier),
            systemInstruction: systemPrompt || undefined,
            generationConfig: {
                maxOutputTokens: options.maxTokens ?? 4096,
                temperature: options.temperature ?? 0.7,
            },
        });
        const result = await model.generateContent(userMessage);
        return result.response.text();
    }
    // Fallback to Anthropic
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
        model: getAnthropicModelId(modelTier),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
        system: systemPrompt || undefined,
        messages: [{ role: 'user', content: userMessage }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text || '';
}
exports.callGemini = callGemini;
/**
 * Vision + text LLM call: Gemini first, Anthropic fallback.
 */
async function callGeminiVision(systemPrompt, imageBase64, userMessage, options = {}) {
    const geminiKey = process.env.GEMINI_API_KEY;
    const modelTier = options.model || 'sonnet';
    const mimeType = options.mimeType || 'image/png';
    if (geminiKey) {
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({
            model: getGeminiModelId(modelTier),
            systemInstruction: systemPrompt || undefined,
            generationConfig: {
                maxOutputTokens: options.maxTokens ?? 4096,
            },
        });
        const result = await model.generateContent([
            { inlineData: { data: imageBase64, mimeType } },
            { text: userMessage },
        ]);
        return result.response.text();
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
        model: getAnthropicModelId(modelTier),
        max_tokens: options.maxTokens ?? 4096,
        system: systemPrompt || undefined,
        messages: [{
                role: 'user',
                content: [
                    { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                    { type: 'text', text: userMessage },
                ],
            }],
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    return textBlock?.text || '';
}
exports.callGeminiVision = callGeminiVision;
//# sourceMappingURL=gemini-llm.js.map