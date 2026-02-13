"use strict";
/**
 * Vision AI Client
 *
 * Neural RAG Brain Pattern: Multi-Model Routing
 *
 * Unified interface for Vision AI providers:
 * - OpenAI GPT-4V (gpt-4-vision-preview)
 * - Anthropic Claude Vision (claude-3-opus/sonnet)
 *
 * Supports intelligent model routing based on task complexity.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VisionClient = void 0;
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'vision-client' });
const DEFAULT_CONFIG = {
    provider: 'openai',
    defaultTier: 'balanced',
    maxTokens: 1024,
    timeout: 30000,
};
/**
 * Model mapping for each tier and provider.
 */
const MODEL_MAP = {
    openai: {
        fast: 'gpt-4o-mini',
        balanced: 'gpt-4o',
        accurate: 'gpt-4o',
    },
    anthropic: {
        fast: 'claude-haiku-4-5-20251001',
        balanced: 'claude-sonnet-4-20250514',
        accurate: 'claude-opus-4-20250514',
    },
};
/**
 * Vision AI Client with multi-provider support.
 */
class VisionClient {
    config;
    openai = null;
    anthropic = null;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeClients();
    }
    /**
     * Initialize API clients lazily.
     */
    initializeClients() {
        // Clients are initialized on first use to avoid import errors
        // when API keys are not set
    }
    /**
     * Get OpenAI client.
     */
    async getOpenAI() {
        if (!this.openai && this.config.openaiApiKey) {
            const { default: OpenAI } = await import('openai');
            this.openai = new OpenAI({ apiKey: this.config.openaiApiKey });
        }
        return this.openai;
    }
    /**
     * Get Anthropic client.
     */
    async getAnthropic() {
        if (!this.anthropic && this.config.anthropicApiKey) {
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            this.anthropic = new Anthropic({ apiKey: this.config.anthropicApiKey });
        }
        return this.anthropic;
    }
    /**
     * Analyze screenshot with Vision AI.
     */
    async analyze(request) {
        const startTime = Date.now();
        const tier = request.tier ?? this.config.defaultTier;
        const model = MODEL_MAP[this.config.provider][tier];
        try {
            let response;
            if (this.config.provider === 'openai') {
                response = await this.analyzeWithOpenAI(request, model);
            }
            else {
                response = await this.analyzeWithAnthropic(request, model);
            }
            response.latencyMs = Date.now() - startTime;
            response.model = model;
            logger.info({
                provider: this.config.provider,
                model,
                latencyMs: response.latencyMs,
                tokensUsed: response.tokensUsed,
            }, 'Vision analysis complete');
            return response;
        }
        catch (error) {
            logger.error({ error, provider: this.config.provider }, 'Vision analysis failed');
            throw error;
        }
    }
    /**
     * Analyze with OpenAI GPT-4V.
     */
    async analyzeWithOpenAI(request, model) {
        const client = await this.getOpenAI();
        if (!client) {
            throw new Error('OpenAI client not initialized - missing API key');
        }
        const base64Image = request.image.toString('base64');
        const systemPrompt = request.context
            ? `Context: ${request.context}\n\n${request.prompt}`
            : request.prompt;
        const response = await client.chat.completions.create({
            model,
            max_tokens: this.config.maxTokens,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/png;base64,${base64Image}`,
                                detail: 'high',
                            },
                        },
                        {
                            type: 'text',
                            text: systemPrompt,
                        },
                    ],
                },
            ],
        });
        const content = response.choices[0]?.message.content ?? '';
        const confidence = this.extractConfidence(content);
        return {
            content,
            confidence,
            model,
            tokensUsed: response.usage?.total_tokens ?? 0,
            latencyMs: 0,
        };
    }
    /**
     * Analyze with Anthropic Claude Vision.
     */
    async analyzeWithAnthropic(request, model) {
        const client = await this.getAnthropic();
        if (!client) {
            throw new Error('Anthropic client not initialized - missing API key');
        }
        const base64Image = request.image.toString('base64');
        const response = await client.messages.create({
            model,
            max_tokens: this.config.maxTokens,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: base64Image,
                            },
                        },
                        {
                            type: 'text',
                            text: request.context
                                ? `Context: ${request.context}\n\n${request.prompt}`
                                : request.prompt,
                        },
                    ],
                },
            ],
        });
        const content = response.content[0]?.text ?? '';
        const confidence = this.extractConfidence(content);
        const tokensUsed = response.usage
            ? response.usage.input_tokens + response.usage.output_tokens
            : 0;
        return {
            content,
            confidence,
            model,
            tokensUsed,
            latencyMs: 0,
        };
    }
    /**
     * Locate element in screenshot by description.
     */
    async locateElement(request) {
        const prompt = `Analyze this screenshot and locate the following element:
"${request.description}"
${request.elementType ? `Expected type: ${request.elementType}` : ''}

Respond in JSON format:
{
  "found": true/false,
  "boundingBox": { "x": number, "y": number, "width": number, "height": number } or null,
  "confidence": 0.0-1.0,
  "reasoning": "explanation of how you identified the element"
}

If the element is found, provide the bounding box coordinates in pixels.
If uncertain, provide alternative locations with lower confidence scores.`;
        const response = await this.analyze({
            image: request.image,
            prompt,
            tier: 'balanced',
            jsonMode: true,
        });
        try {
            const parsed = JSON.parse(response.content);
            return {
                found: parsed.found ?? false,
                boundingBox: parsed.boundingBox,
                confidence: parsed.confidence ?? response.confidence,
                reasoning: parsed.reasoning ?? 'Unable to parse reasoning',
                alternatives: parsed.alternatives,
            };
        }
        catch {
            // Fallback if JSON parsing fails
            return {
                found: false,
                confidence: 0,
                reasoning: 'Failed to parse vision response',
            };
        }
    }
    /**
     * Ask a question about the screenshot.
     */
    async askQuestion(image, question) {
        const response = await this.analyze({
            image,
            prompt: `Answer this question about the screenshot:
${question}

Provide a clear, concise answer. If you're uncertain, indicate your confidence level.`,
            tier: 'fast',
        });
        return {
            answer: response.content,
            confidence: response.confidence,
        };
    }
    /**
     * Verify a visual assertion.
     */
    async verifyAssertion(image, assertion) {
        const prompt = `Verify this assertion about the screenshot:
"${assertion}"

Respond in JSON format:
{
  "passed": true/false,
  "confidence": 0.0-1.0,
  "evidence": "description of visual evidence supporting your conclusion"
}`;
        const response = await this.analyze({
            image,
            prompt,
            tier: 'balanced',
            jsonMode: true,
        });
        try {
            const parsed = JSON.parse(response.content);
            return {
                passed: parsed.passed ?? false,
                confidence: parsed.confidence ?? response.confidence,
                evidence: parsed.evidence ?? 'No evidence provided',
            };
        }
        catch {
            // Fallback parsing
            const passed = response.content.toLowerCase().includes('true') ||
                response.content.toLowerCase().includes('yes');
            return {
                passed,
                confidence: response.confidence * 0.7, // Lower confidence for fallback
                evidence: response.content,
            };
        }
    }
    /**
     * Detect issues in screenshot (errors, broken layouts, etc.).
     */
    async detectIssues(image) {
        const prompt = `Analyze this screenshot for any issues, errors, or problems.

Look for:
- Error messages or alerts
- Broken layouts or misaligned elements
- Missing images or broken content
- Warning indicators
- Accessibility issues

Respond in JSON format:
{
  "issues": [
    {
      "type": "error" | "warning" | "broken_layout" | "missing_element",
      "description": "description of the issue",
      "severity": "low" | "medium" | "high",
      "boundingBox": { "x": number, "y": number, "width": number, "height": number } (optional)
    }
  ]
}

If no issues found, return: { "issues": [] }`;
        const response = await this.analyze({
            image,
            prompt,
            tier: 'accurate',
            jsonMode: true,
        });
        try {
            const parsed = JSON.parse(response.content);
            return parsed.issues ?? [];
        }
        catch {
            return [];
        }
    }
    /**
     * Extract confidence score from response text.
     */
    extractConfidence(text) {
        // Look for explicit confidence mentions
        const confidenceMatch = text.match(/confidence[:\s]+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)[%]?\s*confiden/i);
        if (confidenceMatch) {
            const value = parseFloat(confidenceMatch[1] || confidenceMatch[2] || '0');
            return value > 1 ? value / 100 : value;
        }
        // Look for certainty keywords
        const certainWords = ['certain', 'definitely', 'clearly', 'obviously', 'sure'];
        const uncertainWords = ['might', 'maybe', 'possibly', 'unclear', 'uncertain'];
        const lowerText = text.toLowerCase();
        const certainCount = certainWords.filter(w => lowerText.includes(w)).length;
        const uncertainCount = uncertainWords.filter(w => lowerText.includes(w)).length;
        if (certainCount > uncertainCount) {
            return 0.8 + (certainCount * 0.04);
        }
        else if (uncertainCount > certainCount) {
            return 0.5 - (uncertainCount * 0.1);
        }
        return 0.7; // Default moderate confidence
    }
}
exports.VisionClient = VisionClient;
//# sourceMappingURL=vision-client.js.map