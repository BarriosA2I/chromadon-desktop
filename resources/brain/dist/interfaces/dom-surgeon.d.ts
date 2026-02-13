/**
 * IDOMSurgeon Interface
 *
 * Neural RAG Brain Pattern: CRAG Corrective
 *
 * Robust DOM manipulation with multi-strategy selector resolution
 * and self-healing capabilities. When selectors break, DOM Surgeon
 * applies CRAG pattern:
 * - GENERATE: Try alternative selectors
 * - DECOMPOSE: Break down identification strategies
 * - WEBSEARCH: Fall back to visual identification
 */
/// <reference types="node" />
/// <reference types="node" />
import type { BoundingBox, CRAGAction, ElementInfo, ElementState, Selector, SelectorHealResult, SelectorStrategy } from './types';
/**
 * Context for selector healing operations.
 */
export interface HealingContext {
    /** Original action being attempted */
    action: string;
    /** Text near the target element */
    nearText?: string;
    /** Expected element type */
    expectedTag?: string;
    /** Screenshot for visual identification */
    screenshot?: Buffer;
    /** Previous successful selectors for this element */
    historicalSelectors?: Selector[];
}
/**
 * Result of element state detection.
 */
export interface ElementStateResult {
    state: ElementState;
    selector: string;
    timestamp: Date;
}
/**
 * DOM Surgeon interface for robust element manipulation.
 *
 * Applies CRAG corrective pattern for self-healing:
 * - Confidence > 0.7 → GENERATE: Use healed selector
 * - 0.4 < Confidence ≤ 0.7 → DECOMPOSE: Try multiple strategies
 * - Confidence ≤ 0.4 → WEBSEARCH: Visual identification fallback
 */
export interface IDOMSurgeon {
    /**
     * Find element using multiple selector strategies.
     * Tries selectors in order, falls back to healing if all fail.
     *
     * @param selectors - Array of selectors to try (in priority order)
     * @param context - Context for healing if all selectors fail
     * @returns Element info or null
     */
    find(selectors: string[], context?: HealingContext): Promise<{
        element: ElementInfo | null;
        usedSelector: Selector | null;
        healingApplied: boolean;
        cragAction?: CRAGAction;
    }>;
    /**
     * Find element with automatic strategy selection.
     * Analyzes the selector and chooses optimal strategy.
     *
     * @param selector - Single selector (any format)
     * @param context - Context for healing
     */
    findSmart(selector: string, context?: HealingContext): Promise<ElementInfo | null>;
    /**
     * Find all elements matching any of the selectors.
     *
     * @param selectors - Array of selectors
     */
    findAll(selectors: string[]): Promise<ElementInfo[]>;
    /**
     * Heal a broken selector using CRAG corrective pattern.
     *
     * CRAG Decision Tree:
     * 1. Generate alternative selectors from context
     * 2. Score each candidate's confidence
     * 3. Apply CRAG action based on average confidence:
     *    - > 0.7: GENERATE (use best candidate)
     *    - 0.4-0.7: DECOMPOSE (try multiple strategies)
     *    - < 0.4: WEBSEARCH (visual identification)
     *
     * @param brokenSelector - The selector that failed
     * @param context - Context for generating alternatives
     * @returns Healing result with healed selector or null
     */
    healSelector(brokenSelector: string, context: HealingContext): Promise<SelectorHealResult>;
    /**
     * Generate alternative selectors for an element.
     *
     * @param element - Element to generate selectors for
     * @returns Array of selector candidates with confidence scores
     */
    generateSelectors(element: ElementInfo): Promise<Selector[]>;
    /**
     * Validate a selector against current DOM.
     *
     * @param selector - Selector to validate
     * @returns Validation result with confidence
     */
    validateSelector(selector: string): Promise<{
        valid: boolean;
        matchCount: number;
        confidence: number;
        suggestion?: string;
    }>;
    /**
     * Get detailed element state.
     * Detects visibility, clickability, enabled state, etc.
     *
     * @param selector - Element selector
     * @returns Element state with reason if not interactable
     */
    getElementState(selector: string): Promise<ElementStateResult>;
    /**
     * Check if element is interactable.
     *
     * @param selector - Element selector
     */
    isInteractable(selector: string): Promise<boolean>;
    /**
     * Wait for element to become interactable.
     *
     * @param selector - Element selector
     * @param options - Wait options
     */
    waitForInteractable(selector: string, options?: {
        timeout?: number;
        pollInterval?: number;
    }): Promise<ElementStateResult>;
    /**
     * Find element inside shadow DOM.
     *
     * @param hostSelector - Shadow host selector
     * @param innerSelector - Selector within shadow root
     */
    findInShadow(hostSelector: string, innerSelector: string): Promise<ElementInfo | null>;
    /**
     * Pierce all shadow boundaries to find element.
     *
     * @param selector - CSS selector (will pierce shadow)
     */
    pierceShadow(selector: string): Promise<ElementInfo | null>;
    /**
     * Ensure element is in viewport.
     *
     * @param selector - Element selector
     * @param options - Scroll options
     */
    ensureInViewport(selector: string, options?: {
        block?: 'start' | 'center' | 'end' | 'nearest';
        inline?: 'start' | 'center' | 'end' | 'nearest';
        behavior?: 'auto' | 'smooth';
    }): Promise<void>;
    /**
     * Check if element is in viewport.
     *
     * @param selector - Element selector
     */
    isInViewport(selector: string): Promise<boolean>;
    /**
     * Get element position relative to viewport.
     *
     * @param selector - Element selector
     */
    getViewportPosition(selector: string): Promise<BoundingBox | null>;
    /**
     * Evaluate XPath expression.
     *
     * @param xpath - XPath expression
     * @returns Matching elements
     */
    evaluateXPath(xpath: string): Promise<ElementInfo[]>;
    /**
     * Convert CSS selector to XPath.
     *
     * @param css - CSS selector
     * @returns Equivalent XPath
     */
    cssToXPath(css: string): string;
    /**
     * Find element by text content.
     *
     * @param text - Text to search for
     * @param options - Search options
     */
    findByText(text: string, options?: {
        exact?: boolean;
        tag?: string;
        visible?: boolean;
    }): Promise<ElementInfo | null>;
    /**
     * Find element by ARIA label.
     *
     * @param label - ARIA label
     */
    findByAriaLabel(label: string): Promise<ElementInfo | null>;
    /**
     * Find element by test ID.
     *
     * @param testId - Test ID attribute value
     * @param attribute - Attribute name (default: data-testid)
     */
    findByTestId(testId: string, attribute?: string): Promise<ElementInfo | null>;
    /**
     * Find element by visual description.
     * Uses Vision AI when other methods fail.
     *
     * @param description - Visual description of the element
     * @param screenshot - Current page screenshot
     * @returns Element bounding box or null
     */
    findByVisualDescription(description: string, screenshot: Buffer): Promise<{
        found: boolean;
        boundingBox: BoundingBox | null;
        confidence: number;
        selector?: string;
    }>;
    /**
     * Get the last successful strategy used.
     */
    getLastSuccessfulStrategy(): SelectorStrategy | null;
    /**
     * Get selector history for an element type.
     *
     * @param elementDescription - Description of the element type
     */
    getSelectorHistory(elementDescription: string): Selector[];
    /**
     * Record successful selector for future use.
     *
     * @param elementDescription - Description of the element type
     * @param selector - Successful selector
     */
    recordSuccessfulSelector(elementDescription: string, selector: Selector): void;
}
/**
 * Factory function type for creating DOM Surgeon instances.
 */
export type DOMSurgeonFactory = (browserController: unknown) => IDOMSurgeon;
//# sourceMappingURL=dom-surgeon.d.ts.map