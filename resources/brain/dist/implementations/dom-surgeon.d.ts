/**
 * DOM Surgeon Implementation
 *
 * Neural RAG Brain Pattern: CRAG Corrective
 *
 * Robust DOM manipulation with:
 * - Multi-strategy selector resolution
 * - Self-healing via CRAG pattern
 * - Playwright integration
 * - L1 episodic healing memory
 */
/// <reference types="node" />
/// <reference types="node" />
import type { Page } from 'playwright';
import { CRAGAction, type IDOMSurgeon, type HealingContext, type ElementStateResult, type ElementInfo, type Selector, type SelectorHealResult, type SelectorStrategy, type BoundingBox } from '../interfaces';
import { type SelectorCandidate } from '../core/selector-engine';
import { HealingMemory, type HealingRecord } from '../core/healing-memory';
/**
 * DOM Surgeon configuration.
 */
export interface DOMSurgeonConfig {
    /** Default timeout for operations (ms) */
    defaultTimeout: number;
    /** Maximum healing attempts */
    maxHealingAttempts: number;
    /** Enable visual fallback (requires VLM) */
    enableVisualFallback: boolean;
    /** VLM API endpoint for visual identification */
    vlmEndpoint?: string;
    /** CRAG thresholds */
    cragThresholds?: {
        generateThreshold: number;
        decomposeThreshold: number;
    };
}
/**
 * DOM Surgeon implementation with CRAG self-healing.
 */
export declare class DOMSurgeon implements IDOMSurgeon {
    private page;
    private config;
    private selectorEngine;
    private healingMemory;
    private cragEngine;
    private lastSuccessfulStrategy;
    private selectorHistory;
    constructor(page: Page, config?: Partial<DOMSurgeonConfig>);
    find(selectors: string[], context?: HealingContext): Promise<{
        element: ElementInfo | null;
        usedSelector: Selector | null;
        healingApplied: boolean;
        cragAction?: CRAGAction;
    }>;
    findSmart(selector: string, context?: HealingContext): Promise<ElementInfo | null>;
    findAll(selectors: string[]): Promise<ElementInfo[]>;
    healSelector(brokenSelector: string, context: HealingContext): Promise<SelectorHealResult>;
    /**
     * Execute GENERATE action - use best selector directly.
     */
    private executeGenerate;
    /**
     * Execute DECOMPOSE action - try multiple strategies in parallel.
     */
    private executeDecompose;
    /**
     * Execute WEBSEARCH action - visual identification fallback.
     */
    private executeWebsearch;
    generateSelectors(element: ElementInfo): Promise<SelectorCandidate[]>;
    validateSelector(selector: string): Promise<{
        valid: boolean;
        matchCount: number;
        confidence: number;
        suggestion?: string;
    }>;
    getElementState(selector: string): Promise<ElementStateResult>;
    isInteractable(selector: string): Promise<boolean>;
    waitForInteractable(selector: string, options?: {
        timeout?: number;
        pollInterval?: number;
    }): Promise<ElementStateResult>;
    findInShadow(hostSelector: string, innerSelector: string): Promise<ElementInfo | null>;
    pierceShadow(selector: string): Promise<ElementInfo | null>;
    ensureInViewport(selector: string, options?: {
        block?: 'start' | 'center' | 'end' | 'nearest';
        inline?: 'start' | 'center' | 'end' | 'nearest';
        behavior?: 'auto' | 'smooth';
    }): Promise<void>;
    isInViewport(selector: string): Promise<boolean>;
    getViewportPosition(selector: string): Promise<BoundingBox | null>;
    evaluateXPath(xpath: string): Promise<ElementInfo[]>;
    cssToXPath(css: string): string;
    findByText(text: string, options?: {
        exact?: boolean;
        tag?: string;
        visible?: boolean;
    }): Promise<ElementInfo | null>;
    findByAriaLabel(label: string): Promise<ElementInfo | null>;
    findByTestId(testId: string, attribute?: string): Promise<ElementInfo | null>;
    findByVisualDescription(description: string, screenshot: Buffer): Promise<{
        found: boolean;
        boundingBox: BoundingBox | null;
        confidence: number;
        selector?: string;
    }>;
    getLastSuccessfulStrategy(): SelectorStrategy | null;
    getSelectorHistory(elementDescription: string): Selector[];
    recordSuccessfulSelector(elementDescription: string, selector: Selector): void;
    /**
     * Try a selector and return element info if found.
     */
    private trySelector;
    /**
     * Extract element info from a locator.
     */
    private extractElementInfo;
    /**
     * Generate healing candidates from context.
     */
    private generateHealingCandidates;
    /**
     * Detect selector strategy from value.
     */
    private detectStrategy;
    /**
     * Generate selector from bounding box position.
     */
    private generateSelectorFromPosition;
    /**
     * Get CRAG decision metrics.
     */
    getCRAGMetrics(): import("../core/crag-engine").CRAGMetrics;
    /**
     * Get healing memory statistics.
     */
    getMemoryStats(): {
        workingMemorySize: number;
        episodicMemorySize: number;
        semanticDomainsCount: number;
        proceduralPatternsCount: number;
        totalHealingRecords: number;
        averageSuccessRate: number;
    };
    /**
     * Export healing memory for persistence.
     */
    exportMemory(): {
        episodic: HealingRecord[];
        semantic: Record<string, HealingRecord[]>;
        procedural: HealingRecord[];
    };
    /**
     * Import healing memory.
     */
    importMemory(data: Parameters<HealingMemory['importMemory']>[0]): void;
}
//# sourceMappingURL=dom-surgeon.d.ts.map