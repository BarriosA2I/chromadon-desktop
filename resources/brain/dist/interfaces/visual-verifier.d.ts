/**
 * IVisualVerifier Interface
 *
 * Neural RAG Brain Pattern: Self-RAG Reflection
 *
 * Visual verification using [REL][SUP][USE] reflection tokens:
 * - [REL] Is the visual state relevant to the mission?
 * - [SUP] Does the screenshot support the expected state?
 * - [USE] Is this verification useful progress?
 */
/// <reference types="node" />
/// <reference types="node" />
import type { BoundingBox, ReflectionResult, VisualAssertion, VisualDiff } from './types';
/**
 * Options for visual comparison operations.
 */
export interface VisualCompareOptions {
    /** Threshold for pixel difference (0-1) */
    threshold?: number;
    /** Include anti-aliasing in comparison */
    includeAA?: boolean;
    /** Regions to ignore in comparison */
    ignoreRegions?: BoundingBox[];
    /** Output diff image */
    outputDiff?: boolean;
}
/**
 * Result of a visual verification operation.
 */
export interface VerificationResult {
    /** Overall verification passed */
    passed: boolean;
    /** Confidence score (0-1) */
    confidence: number;
    /** Individual assertions and their results */
    assertions: VisualAssertion[];
    /** Reflection tokens for self-assessment */
    reflection: ReflectionResult;
    /** Screenshot used for verification */
    screenshot?: Buffer;
    /** Timestamp of verification */
    timestamp: Date;
}
/**
 * Context for visual assertions.
 */
export interface AssertionContext {
    /** Current mission step */
    stepIndex: number;
    /** Expected page URL pattern */
    expectedUrl?: string;
    /** Previous verification result */
    previous?: VerificationResult;
}
/**
 * Visual Verifier interface for screenshot-based verification.
 *
 * Applies Self-RAG reflection pattern:
 * - Captures visual state at key checkpoints
 * - Verifies expected elements are visible
 * - Detects unexpected changes
 * - Scores verification confidence using reflection tokens
 */
export interface IVisualVerifier {
    /**
     * Capture screenshot for verification.
     *
     * @param options - Capture options
     * @returns Screenshot buffer
     */
    capture(options?: {
        fullPage?: boolean;
        selector?: string;
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
    }): Promise<Buffer>;
    /**
     * Capture screenshot with automatic masking of dynamic content.
     * Masks timestamps, ads, animations, etc.
     *
     * @param options - Capture options with mask configuration
     */
    captureStable(options?: {
        fullPage?: boolean;
        maskSelectors?: string[];
        maskDynamicContent?: boolean;
    }): Promise<Buffer>;
    /**
     * Assert element is visible in screenshot.
     *
     * @param description - What should be visible
     * @param screenshot - Screenshot to analyze (or captures new)
     * @returns Assertion result with confidence
     */
    assertVisible(description: string, screenshot?: Buffer): Promise<VisualAssertion>;
    /**
     * Assert text is visible in screenshot.
     *
     * @param text - Text that should be visible
     * @param options - Assertion options
     */
    assertTextVisible(text: string, options?: {
        exact?: boolean;
        region?: BoundingBox;
        screenshot?: Buffer;
    }): Promise<VisualAssertion>;
    /**
     * Assert element matches expected appearance.
     *
     * @param selector - Element to verify
     * @param expectedDescription - Description of expected appearance
     */
    assertAppearance(selector: string, expectedDescription: string): Promise<VisualAssertion>;
    /**
     * Assert page layout matches expected structure.
     *
     * @param layoutDescription - Description of expected layout
     * @param screenshot - Screenshot to analyze
     */
    assertLayout(layoutDescription: string, screenshot?: Buffer): Promise<VisualAssertion>;
    /**
     * Run multiple assertions and aggregate results.
     *
     * @param assertions - Array of assertion descriptions
     * @param context - Assertion context
     */
    assertAll(assertions: string[], context?: AssertionContext): Promise<VerificationResult>;
    /**
     * Compare two screenshots for differences.
     *
     * @param before - Before screenshot
     * @param after - After screenshot
     * @param options - Comparison options
     */
    compare(before: Buffer, after: Buffer, options?: VisualCompareOptions): Promise<VisualDiff>;
    /**
     * Compare current state to baseline.
     *
     * @param baselineName - Name of baseline to compare against
     * @param options - Comparison options
     */
    compareToBaseline(baselineName: string, options?: VisualCompareOptions): Promise<VisualDiff>;
    /**
     * Save current screenshot as baseline.
     *
     * @param name - Baseline name
     * @param screenshot - Screenshot to save (or captures new)
     */
    saveBaseline(name: string, screenshot?: Buffer): Promise<void>;
    /**
     * Get baseline screenshot.
     *
     * @param name - Baseline name
     */
    getBaseline(name: string): Promise<Buffer | null>;
    /**
     * Verify page state with full reflection.
     * Returns comprehensive verification with [REL][SUP][USE] tokens.
     *
     * @param expectations - What to verify
     * @param context - Verification context
     */
    verify(expectations: {
        visible?: string[];
        notVisible?: string[];
        text?: string[];
        layout?: string;
        baseline?: string;
    }, context?: AssertionContext): Promise<VerificationResult>;
    /**
     * Verify action result visually.
     * Checks if action had expected visual effect.
     *
     * @param actionDescription - What action was performed
     * @param expectedEffect - Expected visual change
     * @param beforeScreenshot - Screenshot before action
     */
    verifyActionEffect(actionDescription: string, expectedEffect: string, beforeScreenshot: Buffer): Promise<VerificationResult>;
    /**
     * Verify navigation completed correctly.
     *
     * @param expectedUrl - Expected URL pattern
     * @param expectedElements - Elements that should be visible
     */
    verifyNavigation(expectedUrl: string | RegExp, expectedElements?: string[]): Promise<VerificationResult>;
    /**
     * Analyze screenshot using Vision AI.
     * Returns natural language description of page state.
     *
     * @param screenshot - Screenshot to analyze
     * @param prompt - Analysis prompt
     */
    analyzeWithVision(screenshot: Buffer, prompt: string): Promise<{
        description: string;
        elements: Array<{
            description: string;
            boundingBox: BoundingBox;
            confidence: number;
        }>;
    }>;
    /**
     * Ask question about screenshot.
     *
     * @param screenshot - Screenshot to analyze
     * @param question - Question to answer
     */
    askAboutScreenshot(screenshot: Buffer, question: string): Promise<{
        answer: string;
        confidence: number;
        evidence?: BoundingBox[];
    }>;
    /**
     * Detect errors or issues in screenshot.
     * Looks for error messages, broken layouts, missing elements.
     *
     * @param screenshot - Screenshot to analyze
     */
    detectIssues(screenshot: Buffer): Promise<Array<{
        type: 'error' | 'warning' | 'broken_layout' | 'missing_element';
        description: string;
        severity: 'low' | 'medium' | 'high';
        boundingBox?: BoundingBox;
    }>>;
    /**
     * Create visual checkpoint.
     * Saves current state for potential rollback.
     *
     * @param name - Checkpoint name
     * @param metadata - Additional metadata
     */
    createCheckpoint(name: string, metadata?: Record<string, unknown>): Promise<{
        id: string;
        name: string;
        screenshot: Buffer;
        url: string;
        timestamp: Date;
    }>;
    /**
     * List available checkpoints.
     */
    listCheckpoints(): Promise<Array<{
        id: string;
        name: string;
        timestamp: Date;
    }>>;
    /**
     * Compare current state to checkpoint.
     *
     * @param checkpointId - Checkpoint to compare against
     */
    compareToCheckpoint(checkpointId: string): Promise<VisualDiff>;
    /**
     * Generate reflection tokens for verification result.
     * Implements Self-RAG [RET][REL][SUP][USE] pattern.
     *
     * @param result - Verification result to reflect on
     * @param missionContext - Current mission context
     */
    generateReflection(result: VerificationResult, missionContext: {
        missionDescription: string;
        currentStep: number;
        totalSteps: number;
    }): ReflectionResult;
    /**
     * Determine if retrieval is needed based on verification.
     * [RET] token: Should we gather more context?
     *
     * @param result - Verification result
     */
    shouldRetrieve(result: VerificationResult): boolean;
}
/**
 * Factory function type for creating Visual Verifier instances.
 */
export type VisualVerifierFactory = (browserController: unknown, options?: {
    visionApiKey?: string;
    baselineDir?: string;
    checkpointDir?: string;
}) => IVisualVerifier;
//# sourceMappingURL=visual-verifier.d.ts.map