/**
 * Multi-Strategy Selector Engine
 *
 * Generates and manages selectors using multiple strategies:
 * - CSS selectors (id, class, attributes)
 * - XPath expressions
 * - Text-based selectors
 * - ARIA labels
 * - Test IDs
 * - Visual (placeholder for VLM integration)
 */
import type { Selector, SelectorStrategy, ElementInfo } from '../interfaces';
/**
 * Configuration for selector generation.
 */
export interface SelectorGeneratorConfig {
    /** Preferred strategies in priority order */
    preferredStrategies: SelectorStrategy[];
    /** Minimum confidence to accept a selector */
    minConfidence: number;
    /** Maximum candidates to generate per strategy */
    maxCandidatesPerStrategy: number;
    /** Custom attribute names to check for IDs */
    testIdAttributes: string[];
}
/**
 * Default configuration.
 */
export declare const DEFAULT_CONFIG: SelectorGeneratorConfig;
/**
 * Selector candidate with metadata.
 */
export interface SelectorCandidate extends Selector {
    /** Why this selector was generated */
    reason: string;
    /** Is this selector unique on the page? */
    isUnique: boolean;
    /** Number of elements matched */
    matchCount: number;
    /** Stability score (higher = less likely to break) */
    stabilityScore: number;
}
/**
 * Multi-strategy selector engine.
 */
export declare class SelectorEngine {
    private config;
    constructor(config?: Partial<SelectorGeneratorConfig>);
    /**
     * Generate all possible selectors for an element.
     */
    generateSelectors(element: ElementInfo, page: unknown): Promise<SelectorCandidate[]>;
    /**
     * Generate selectors for a specific strategy.
     */
    private generateForStrategy;
    /**
     * Generate test ID selectors (most stable).
     */
    private generateTestIdSelectors;
    /**
     * Generate ARIA selectors.
     */
    private generateAriaSelectors;
    /**
     * Generate CSS selectors.
     */
    private generateCssSelectors;
    /**
     * Generate XPath selectors.
     */
    private generateXPathSelectors;
    /**
     * Generate text-based selectors.
     */
    private generateTextSelectors;
    /**
     * Check if an ID looks generated (random hash, uuid, etc.).
     */
    private isGeneratedId;
    /**
     * Check if a class looks generated.
     */
    private isGeneratedClass;
    /**
     * Escape CSS selector value.
     */
    private escapeCssValue;
    /**
     * Escape XPath string.
     */
    private escapeXPathString;
    /**
     * Convert CSS selector to XPath.
     */
    cssToXPath(css: string): string;
}
//# sourceMappingURL=selector-engine.d.ts.map