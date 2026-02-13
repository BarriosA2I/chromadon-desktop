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
/// <reference types="node" />
/// <reference types="node" />
/**
 * Vision AI provider types.
 */
export type VisionProvider = 'openai' | 'anthropic';
/**
 * Vision AI model tiers for cost optimization.
 */
export type VisionModelTier = 'fast' | 'balanced' | 'accurate';
/**
 * Configuration for Vision AI client.
 */
export interface VisionClientConfig {
    /** Default provider to use */
    provider: VisionProvider;
    /** OpenAI API key */
    openaiApiKey?: string;
    /** Anthropic API key */
    anthropicApiKey?: string;
    /** Default model tier */
    defaultTier: VisionModelTier;
    /** Max tokens for response */
    maxTokens: number;
    /** Request timeout in ms */
    timeout: number;
}
/**
 * Vision analysis request.
 */
export interface VisionRequest {
    /** Screenshot buffer (PNG) */
    image: Buffer;
    /** Analysis prompt */
    prompt: string;
    /** Override model tier */
    tier?: VisionModelTier;
    /** Additional context */
    context?: string;
    /** Return structured JSON */
    jsonMode?: boolean;
}
/**
 * Vision analysis response.
 */
export interface VisionResponse {
    /** Analysis text */
    content: string;
    /** Confidence score (0-1) */
    confidence: number;
    /** Detected elements with bounding boxes */
    elements?: Array<{
        description: string;
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        confidence: number;
    }>;
    /** Model used */
    model: string;
    /** Tokens used */
    tokensUsed: number;
    /** Request latency in ms */
    latencyMs: number;
}
/**
 * Vision element location request.
 */
export interface ElementLocationRequest {
    /** Screenshot buffer */
    image: Buffer;
    /** Description of element to find */
    description: string;
    /** Expected element type (button, input, etc.) */
    elementType?: string;
}
/**
 * Vision element location response.
 */
export interface ElementLocationResponse {
    /** Whether element was found */
    found: boolean;
    /** Bounding box of element */
    boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Confidence in location */
    confidence: number;
    /** Reasoning for location */
    reasoning: string;
    /** Alternative locations if uncertain */
    alternatives?: Array<{
        boundingBox: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        confidence: number;
    }>;
}
/**
 * Vision AI Client with multi-provider support.
 */
export declare class VisionClient {
    private config;
    private openai;
    private anthropic;
    constructor(config?: Partial<VisionClientConfig>);
    /**
     * Initialize API clients lazily.
     */
    private initializeClients;
    /**
     * Get OpenAI client.
     */
    private getOpenAI;
    /**
     * Get Anthropic client.
     */
    private getAnthropic;
    /**
     * Analyze screenshot with Vision AI.
     */
    analyze(request: VisionRequest): Promise<VisionResponse>;
    /**
     * Analyze with OpenAI GPT-4V.
     */
    private analyzeWithOpenAI;
    /**
     * Analyze with Anthropic Claude Vision.
     */
    private analyzeWithAnthropic;
    /**
     * Locate element in screenshot by description.
     */
    locateElement(request: ElementLocationRequest): Promise<ElementLocationResponse>;
    /**
     * Ask a question about the screenshot.
     */
    askQuestion(image: Buffer, question: string): Promise<{
        answer: string;
        confidence: number;
    }>;
    /**
     * Verify a visual assertion.
     */
    verifyAssertion(image: Buffer, assertion: string): Promise<{
        passed: boolean;
        confidence: number;
        evidence: string;
    }>;
    /**
     * Detect issues in screenshot (errors, broken layouts, etc.).
     */
    detectIssues(image: Buffer): Promise<Array<{
        type: 'error' | 'warning' | 'broken_layout' | 'missing_element';
        description: string;
        severity: 'low' | 'medium' | 'high';
        boundingBox?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }>>;
    /**
     * Extract confidence score from response text.
     */
    private extractConfidence;
}
//# sourceMappingURL=vision-client.d.ts.map