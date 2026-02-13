/**
 * Visual Verifier Implementation
 *
 * Neural RAG Brain Pattern: Self-RAG Reflection
 *
 * Screenshot-based verification using Vision AI with [RET][REL][SUP][USE] tokens:
 * - [RET] Determines if more context retrieval is needed
 * - [REL] Scores relevance of visual state to mission (0-1)
 * - [SUP] Scores how well screenshot supports expected state (0-1)
 * - [USE] Rates usefulness of verification progress (1-5)
 */
/// <reference types="node" />
/// <reference types="node" />
import type { Page } from 'playwright';
import type { BoundingBox, ReflectionResult, VisualAssertion, VisualDiff } from '../interfaces';
import type { IVisualVerifier, VisualCompareOptions, VerificationResult, AssertionContext } from '../interfaces/visual-verifier';
import { VisionModelTier } from '../core/vision-client';
/**
 * Configuration for Visual Verifier.
 */
export interface VisualVerifierConfig {
    /** OpenAI API key for Vision AI */
    openaiApiKey?: string;
    /** Anthropic API key for Vision AI */
    anthropicApiKey?: string;
    /** Default Vision AI provider */
    visionProvider: 'openai' | 'anthropic';
    /** Default model tier */
    defaultTier: VisionModelTier;
    /** Pixel diff threshold (0-1) */
    diffThreshold: number;
    /** Minimum confidence for passing assertions */
    minConfidence: number;
    /** [RET] threshold - retrieve more context below this */
    retrieveThreshold: number;
    /** Enable auto-checkpointing */
    autoCheckpoint: boolean;
}
/**
 * Visual Verifier with Self-RAG reflection tokens.
 */
export declare class VisualVerifier implements IVisualVerifier {
    private config;
    private page;
    private vision;
    private diffEngine;
    private memory;
    constructor(page: Page, config?: Partial<VisualVerifierConfig>);
    capture(options?: {
        fullPage?: boolean;
        selector?: string;
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
    }): Promise<Buffer>;
    captureStable(options?: {
        fullPage?: boolean;
        maskSelectors?: string[];
        maskDynamicContent?: boolean;
    }): Promise<Buffer>;
    assertVisible(description: string, screenshot?: Buffer): Promise<VisualAssertion>;
    assertTextVisible(text: string, options?: {
        exact?: boolean;
        region?: BoundingBox;
        screenshot?: Buffer;
    }): Promise<VisualAssertion>;
    assertAppearance(selector: string, expectedDescription: string): Promise<VisualAssertion>;
    assertLayout(layoutDescription: string, screenshot?: Buffer): Promise<VisualAssertion>;
    assertAll(assertions: string[], context?: AssertionContext): Promise<VerificationResult>;
    compare(before: Buffer, after: Buffer, options?: VisualCompareOptions): Promise<VisualDiff>;
    compareToBaseline(baselineName: string, options?: VisualCompareOptions): Promise<VisualDiff>;
    saveBaseline(name: string, screenshot?: Buffer): Promise<void>;
    getBaseline(name: string): Promise<Buffer | null>;
    verify(expectations: {
        visible?: string[];
        notVisible?: string[];
        text?: string[];
        layout?: string;
        baseline?: string;
    }, context?: AssertionContext): Promise<VerificationResult>;
    verifyActionEffect(actionDescription: string, expectedEffect: string, beforeScreenshot: Buffer): Promise<VerificationResult>;
    verifyNavigation(expectedUrl: string | RegExp, expectedElements?: string[]): Promise<VerificationResult>;
    analyzeWithVision(screenshot: Buffer, prompt: string): Promise<{
        description: string;
        elements: Array<{
            description: string;
            boundingBox: BoundingBox;
            confidence: number;
        }>;
    }>;
    askAboutScreenshot(screenshot: Buffer, question: string): Promise<{
        answer: string;
        confidence: number;
        evidence?: BoundingBox[];
    }>;
    detectIssues(screenshot: Buffer): Promise<Array<{
        type: 'error' | 'warning' | 'broken_layout' | 'missing_element';
        description: string;
        severity: 'low' | 'medium' | 'high';
        boundingBox?: BoundingBox;
    }>>;
    createCheckpoint(name: string, metadata?: Record<string, unknown>): Promise<{
        id: string;
        name: string;
        screenshot: Buffer;
        url: string;
        timestamp: Date;
    }>;
    listCheckpoints(): Promise<Array<{
        id: string;
        name: string;
        timestamp: Date;
    }>>;
    compareToCheckpoint(checkpointId: string): Promise<VisualDiff>;
    generateReflection(result: VerificationResult, missionContext: {
        missionDescription: string;
        currentStep: number;
        totalSteps: number;
    }): ReflectionResult;
    shouldRetrieve(result: VerificationResult): boolean;
    /**
     * Internal reflection generation without full mission context.
     */
    private generateReflectionInternal;
    /**
     * Calculate relevance score for verification.
     */
    private calculateRelevance;
    /**
     * Calculate usefulness rating (1-5).
     */
    private calculateUsefulness;
    /**
     * Get memory statistics.
     */
    getMemoryStats(): {
        working: number;
        episodic: number;
        semantic: number;
        procedural: number;
        checkpoints: number;
        baselines: number;
    };
    /**
     * Clear visual memory.
     */
    clearMemory(): void;
}
/**
 * Factory function for creating Visual Verifier instances.
 */
export declare function createVisualVerifier(page: Page, options?: {
    openaiApiKey?: string;
    anthropicApiKey?: string;
    visionProvider?: 'openai' | 'anthropic';
}): VisualVerifier;
//# sourceMappingURL=visual-verifier.d.ts.map