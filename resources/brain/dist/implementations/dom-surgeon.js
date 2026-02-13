"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DOMSurgeon = void 0;
const interfaces_1 = require("../interfaces");
const selector_engine_1 = require("../core/selector-engine");
const healing_memory_1 = require("../core/healing-memory");
const crag_engine_1 = require("../core/crag-engine");
const DEFAULT_CONFIG = {
    defaultTimeout: 5000,
    maxHealingAttempts: 3,
    enableVisualFallback: false,
};
/**
 * DOM Surgeon implementation with CRAG self-healing.
 */
class DOMSurgeon {
    page;
    config;
    selectorEngine;
    healingMemory;
    cragEngine;
    lastSuccessfulStrategy = null;
    selectorHistory = new Map();
    constructor(page, config = {}) {
        this.page = page;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.selectorEngine = new selector_engine_1.SelectorEngine();
        this.healingMemory = new healing_memory_1.HealingMemory();
        this.cragEngine = new crag_engine_1.CRAGEngine(config.cragThresholds);
        // Clear working memory on navigation
        this.page.on('framenavigated', () => {
            this.healingMemory.clearWorkingMemory();
        });
    }
    // ==========================================================================
    // MULTI-STRATEGY ELEMENT FINDING
    // ==========================================================================
    async find(selectors, context) {
        // Try each selector in order
        for (const selector of selectors) {
            try {
                const element = await this.trySelector(selector);
                if (element) {
                    const strategy = this.detectStrategy(selector);
                    this.lastSuccessfulStrategy = strategy;
                    return {
                        element,
                        usedSelector: { value: selector, strategy, confidence: 1 },
                        healingApplied: false,
                    };
                }
            }
            catch {
                // Selector failed, try next
            }
        }
        // All selectors failed, attempt healing
        if (context && selectors[0]) {
            const healResult = await this.healSelector(selectors[0], context);
            if (healResult.success && healResult.healed) {
                const element = await this.trySelector(healResult.healed.value);
                return {
                    element,
                    usedSelector: healResult.healed,
                    healingApplied: true,
                    cragAction: healResult.cragAction,
                };
            }
        }
        return {
            element: null,
            usedSelector: null,
            healingApplied: true,
            cragAction: interfaces_1.CRAGAction.WEBSEARCH,
        };
    }
    async findSmart(selector, context) {
        // Check working memory first
        const cached = this.healingMemory.getWorkingSelector(selector);
        if (cached) {
            const element = await this.trySelector(cached.value);
            if (element)
                return element;
        }
        // Try the selector directly
        const element = await this.trySelector(selector);
        if (element) {
            this.healingMemory.setWorkingSelector(selector, {
                value: selector,
                strategy: this.detectStrategy(selector),
                confidence: 1,
            });
            return element;
        }
        // Healing needed
        if (context) {
            const result = await this.find([selector], context);
            return result.element;
        }
        return null;
    }
    async findAll(selectors) {
        const results = [];
        for (const selector of selectors) {
            try {
                const locator = this.page.locator(selector);
                const count = await locator.count();
                for (let i = 0; i < count; i++) {
                    const element = await this.extractElementInfo(locator.nth(i), selector);
                    if (element) {
                        results.push(element);
                    }
                }
            }
            catch {
                // Skip failed selectors
            }
        }
        return results;
    }
    // ==========================================================================
    // SELECTOR HEALING (CRAG PATTERN)
    // ==========================================================================
    async healSelector(brokenSelector, context) {
        const originalSelector = {
            value: brokenSelector,
            strategy: this.detectStrategy(brokenSelector),
            confidence: 0,
        };
        // Step 1: Generate candidates
        const candidates = await this.generateHealingCandidates(context);
        // Step 2: Find historical patterns
        const currentUrl = await this.page.url();
        const historicalRecords = this.healingMemory.findSimilarHealings(brokenSelector, {
            action: context.action,
            nearText: context.nearText,
            expectedTag: context.expectedTag,
        }, currentUrl);
        // Step 3: CRAG decision
        const decision = this.cragEngine.decide({
            candidates,
            historicalRecords,
            visualAvailable: this.config.enableVisualFallback,
            currentUrl,
            screenshot: context.screenshot,
        });
        // Step 4: Execute decision
        let healedSelector = null;
        switch (decision.action) {
            case interfaces_1.CRAGAction.GENERATE:
                healedSelector = await this.executeGenerate(decision);
                break;
            case interfaces_1.CRAGAction.DECOMPOSE:
                healedSelector = await this.executeDecompose(decision);
                break;
            case interfaces_1.CRAGAction.WEBSEARCH:
                healedSelector = await this.executeWebsearch(decision, context);
                break;
        }
        // Step 5: Record successful healing
        if (healedSelector) {
            this.healingMemory.recordHealing(brokenSelector, healedSelector, {
                action: context.action,
                nearText: context.nearText,
                expectedTag: context.expectedTag,
            }, currentUrl);
        }
        return {
            success: healedSelector !== null,
            original: originalSelector,
            healed: healedSelector,
            candidates: candidates.map(c => ({
                value: c.value,
                strategy: c.strategy,
                confidence: c.confidence,
            })),
            cragAction: decision.action,
        };
    }
    /**
     * Execute GENERATE action - use best selector directly.
     */
    async executeGenerate(decision) {
        if (!decision.selectedSelector)
            return null;
        const element = await this.trySelector(decision.selectedSelector.value);
        if (element) {
            this.lastSuccessfulStrategy = decision.selectedSelector.strategy;
            return decision.selectedSelector;
        }
        return null;
    }
    /**
     * Execute DECOMPOSE action - try multiple strategies in parallel.
     */
    async executeDecompose(decision) {
        if (!decision.strategiesToTry || decision.strategiesToTry.length === 0) {
            return null;
        }
        // Try strategies in parallel with Promise.race-style approach
        const attempts = decision.strategiesToTry.map(async (selector) => {
            const element = await this.trySelector(selector.value);
            return element ? selector : null;
        });
        const results = await Promise.all(attempts);
        const successful = results.find(r => r !== null);
        if (successful) {
            this.lastSuccessfulStrategy = successful.strategy;
        }
        return successful ?? null;
    }
    /**
     * Execute WEBSEARCH action - visual identification fallback.
     */
    async executeWebsearch(decision, context) {
        if (!this.config.enableVisualFallback || !this.config.vlmEndpoint) {
            // Fall back to trying all candidates if visual not available
            if (decision.strategiesToTry) {
                return this.executeDecompose(decision);
            }
            return null;
        }
        // Take screenshot if not provided
        const screenshot = context.screenshot ?? (await this.page.screenshot());
        // Call VLM API for visual identification
        const visualResult = await this.findByVisualDescription(decision.visualQuery ?? context.action, screenshot);
        if (visualResult.found && visualResult.selector) {
            return {
                value: visualResult.selector,
                strategy: 'visual',
                confidence: visualResult.confidence,
            };
        }
        return null;
    }
    async generateSelectors(element) {
        return this.selectorEngine.generateSelectors(element, this.page);
    }
    async validateSelector(selector) {
        try {
            const locator = this.page.locator(selector);
            const count = await locator.count();
            if (count === 0) {
                return {
                    valid: false,
                    matchCount: 0,
                    confidence: 0,
                    suggestion: 'No elements match this selector',
                };
            }
            if (count > 1) {
                return {
                    valid: true,
                    matchCount: count,
                    confidence: 0.5,
                    suggestion: `Selector matches ${count} elements - consider making it more specific`,
                };
            }
            return {
                valid: true,
                matchCount: 1,
                confidence: 0.95,
            };
        }
        catch (error) {
            return {
                valid: false,
                matchCount: 0,
                confidence: 0,
                suggestion: `Invalid selector: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
        }
    }
    // ==========================================================================
    // ELEMENT STATE DETECTION
    // ==========================================================================
    async getElementState(selector) {
        const locator = this.page.locator(selector);
        try {
            const [visible, enabled, editable] = await Promise.all([
                locator.isVisible().catch(() => false),
                locator.isEnabled().catch(() => false),
                locator.isEditable().catch(() => false),
            ]);
            // Check if clickable (visible and not covered)
            let clickable = visible && enabled;
            let reason;
            if (!visible) {
                reason = 'Element is not visible';
                clickable = false;
            }
            else if (!enabled) {
                reason = 'Element is disabled';
                clickable = false;
            }
            // Check for overlapping elements
            if (clickable) {
                const box = await locator.boundingBox();
                if (box) {
                    const centerX = box.x + box.width / 2;
                    const centerY = box.y + box.height / 2;
                    const elementAtPoint = await this.page.evaluate(([x, y]) => {
                        const el = document.elementFromPoint(x, y);
                        return el?.tagName ?? null;
                    }, [centerX, centerY]);
                    if (!elementAtPoint) {
                        clickable = false;
                        reason = 'Element center is not accessible';
                    }
                }
            }
            const state = {
                visible,
                enabled,
                clickable,
                focused: await locator.evaluate(el => el === document.activeElement).catch(() => false),
                readonly: !editable && enabled,
                reason,
            };
            return {
                state,
                selector,
                timestamp: new Date(),
            };
        }
        catch {
            return {
                state: {
                    visible: false,
                    enabled: false,
                    clickable: false,
                    focused: false,
                    reason: 'Element not found',
                },
                selector,
                timestamp: new Date(),
            };
        }
    }
    async isInteractable(selector) {
        const result = await this.getElementState(selector);
        return result.state.clickable;
    }
    async waitForInteractable(selector, options) {
        const timeout = options?.timeout ?? this.config.defaultTimeout;
        const pollInterval = options?.pollInterval ?? 100;
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const state = await this.getElementState(selector);
            if (state.state.clickable) {
                return state;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        return this.getElementState(selector);
    }
    // ==========================================================================
    // SHADOW DOM SUPPORT
    // ==========================================================================
    async findInShadow(hostSelector, innerSelector) {
        try {
            // Playwright pierces shadow DOM by default with >> syntax
            const combinedSelector = `${hostSelector} >> ${innerSelector}`;
            return this.trySelector(combinedSelector);
        }
        catch {
            return null;
        }
    }
    async pierceShadow(selector) {
        // Use Playwright's built-in shadow piercing
        return this.trySelector(selector);
    }
    // ==========================================================================
    // VIEWPORT & SCROLL MANAGEMENT
    // ==========================================================================
    async ensureInViewport(selector, options) {
        const locator = this.page.locator(selector);
        await locator.scrollIntoViewIfNeeded();
    }
    async isInViewport(selector) {
        const locator = this.page.locator(selector);
        const box = await locator.boundingBox();
        if (!box)
            return false;
        const viewport = await this.page.viewportSize();
        if (!viewport)
            return false;
        return (box.x >= 0 &&
            box.y >= 0 &&
            box.x + box.width <= viewport.width &&
            box.y + box.height <= viewport.height);
    }
    async getViewportPosition(selector) {
        const locator = this.page.locator(selector);
        const box = await locator.boundingBox();
        return box;
    }
    // ==========================================================================
    // XPATH SUPPORT
    // ==========================================================================
    async evaluateXPath(xpath) {
        const results = [];
        const locator = this.page.locator(`xpath=${xpath}`);
        const count = await locator.count();
        for (let i = 0; i < count; i++) {
            const element = await this.extractElementInfo(locator.nth(i), xpath);
            if (element) {
                results.push(element);
            }
        }
        return results;
    }
    cssToXPath(css) {
        return this.selectorEngine.cssToXPath(css);
    }
    // ==========================================================================
    // TEXT-BASED FINDING
    // ==========================================================================
    async findByText(text, options) {
        let selector;
        if (options?.exact) {
            selector = options?.tag
                ? `${options.tag}:text-is("${text}")`
                : `:text-is("${text}")`;
        }
        else {
            selector = options?.tag
                ? `${options.tag}:text("${text}")`
                : `:text("${text}")`;
        }
        if (options?.visible) {
            selector = `${selector}:visible`;
        }
        return this.trySelector(selector);
    }
    async findByAriaLabel(label) {
        return this.trySelector(`[aria-label="${label}"]`);
    }
    async findByTestId(testId, attribute = 'data-testid') {
        return this.trySelector(`[${attribute}="${testId}"]`);
    }
    // ==========================================================================
    // VISUAL IDENTIFICATION (CRAG WEBSEARCH FALLBACK)
    // ==========================================================================
    async findByVisualDescription(description, screenshot) {
        if (!this.config.vlmEndpoint) {
            return { found: false, boundingBox: null, confidence: 0 };
        }
        try {
            // Call VLM API (placeholder - implement with actual VLM service)
            const response = await fetch(this.config.vlmEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: screenshot.toString('base64'),
                    prompt: `Find the element described as: "${description}". Return the bounding box coordinates.`,
                }),
            });
            if (!response.ok) {
                return { found: false, boundingBox: null, confidence: 0 };
            }
            const result = await response.json();
            if (result.found && result.boundingBox) {
                // Generate selector from bounding box by finding element at that position
                const selector = await this.generateSelectorFromPosition(result.boundingBox);
                return {
                    found: true,
                    boundingBox: result.boundingBox,
                    confidence: result.confidence,
                    selector,
                };
            }
            return { found: false, boundingBox: null, confidence: 0 };
        }
        catch {
            return { found: false, boundingBox: null, confidence: 0 };
        }
    }
    // ==========================================================================
    // STRATEGY MANAGEMENT
    // ==========================================================================
    getLastSuccessfulStrategy() {
        return this.lastSuccessfulStrategy;
    }
    getSelectorHistory(elementDescription) {
        return this.selectorHistory.get(elementDescription) ?? [];
    }
    recordSuccessfulSelector(elementDescription, selector) {
        const history = this.selectorHistory.get(elementDescription) ?? [];
        history.unshift(selector);
        // Keep only last 5 successful selectors per element type
        this.selectorHistory.set(elementDescription, history.slice(0, 5));
    }
    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================
    /**
     * Try a selector and return element info if found.
     */
    async trySelector(selector) {
        try {
            const locator = this.page.locator(selector);
            const count = await locator.count();
            if (count === 0)
                return null;
            return this.extractElementInfo(locator.first(), selector);
        }
        catch {
            return null;
        }
    }
    /**
     * Extract element info from a locator.
     */
    async extractElementInfo(locator, selector) {
        try {
            const [tagName, textContent, box, attrs, isVisible, isEnabled] = await Promise.all([
                locator.evaluate(el => el.tagName.toLowerCase()),
                locator.innerText().catch(() => ''),
                locator.boundingBox(),
                locator.evaluate(el => {
                    const result = {};
                    for (const attr of Array.from(el.attributes)) {
                        result[attr.name] = attr.value;
                    }
                    return result;
                }),
                locator.isVisible().catch(() => false),
                locator.isEnabled().catch(() => true),
            ]);
            return {
                uid: `${tagName}_${Date.now()}`,
                tagName,
                attributes: attrs,
                textContent,
                boundingBox: box,
                state: {
                    visible: isVisible,
                    enabled: isEnabled,
                    clickable: isVisible && isEnabled,
                    focused: false,
                },
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Generate healing candidates from context.
     */
    async generateHealingCandidates(context) {
        const candidates = [];
        // Generate from near text
        if (context.nearText) {
            candidates.push({
                value: `:text("${context.nearText}")`,
                strategy: 'text',
                confidence: 0.7,
                reason: 'Text near element',
                isUnique: false,
                matchCount: 1,
                stabilityScore: 0.65,
            });
            candidates.push({
                value: `//*[contains(text(), "${context.nearText}")]`,
                strategy: 'xpath',
                confidence: 0.65,
                reason: 'XPath text contains',
                isUnique: false,
                matchCount: 1,
                stabilityScore: 0.6,
            });
        }
        // Generate from expected tag
        if (context.expectedTag) {
            candidates.push({
                value: `${context.expectedTag}:visible`,
                strategy: 'css',
                confidence: 0.4,
                reason: 'Visible tag',
                isUnique: false,
                matchCount: 1,
                stabilityScore: 0.3,
            });
        }
        // Generate from action type
        if (context.action.includes('click')) {
            candidates.push({
                value: 'button:visible, a:visible, [role="button"]:visible',
                strategy: 'css',
                confidence: 0.35,
                reason: 'Clickable elements',
                isUnique: false,
                matchCount: 1,
                stabilityScore: 0.25,
            });
        }
        // Add historical selectors
        if (context.historicalSelectors) {
            for (const historical of context.historicalSelectors) {
                candidates.push({
                    value: historical.value,
                    strategy: historical.strategy,
                    confidence: historical.confidence * 0.9,
                    reason: 'Historical selector',
                    isUnique: true,
                    matchCount: 1,
                    stabilityScore: 0.7,
                });
            }
        }
        // Sort by confidence * stability
        return candidates.sort((a, b) => b.confidence * b.stabilityScore - a.confidence * a.stabilityScore);
    }
    /**
     * Detect selector strategy from value.
     */
    detectStrategy(selector) {
        if (selector.startsWith('//') || selector.startsWith('xpath=')) {
            return 'xpath';
        }
        if (selector.startsWith('text=') || selector.startsWith(':text')) {
            return 'text';
        }
        if (selector.includes('[aria-') || selector.includes('[role=')) {
            return 'aria';
        }
        if (selector.includes('[data-testid') || selector.includes('[data-test')) {
            return 'testid';
        }
        return 'css';
    }
    /**
     * Generate selector from bounding box position.
     */
    async generateSelectorFromPosition(box) {
        const centerX = box.x + box.width / 2;
        const centerY = box.y + box.height / 2;
        try {
            // Find element at position and generate selector
            const selector = await this.page.evaluate(([x, y]) => {
                const el = document.elementFromPoint(x, y);
                if (!el)
                    return null;
                // Try to generate a unique selector
                if (el.id)
                    return `#${el.id}`;
                if (el.getAttribute('data-testid')) {
                    return `[data-testid="${el.getAttribute('data-testid')}"]`;
                }
                if (el.getAttribute('aria-label')) {
                    return `[aria-label="${el.getAttribute('aria-label')}"]`;
                }
                // Fall back to tag + classes
                const classes = Array.from(el.classList).slice(0, 2).join('.');
                return classes ? `${el.tagName.toLowerCase()}.${classes}` : null;
            }, [centerX, centerY]);
            return selector ?? undefined;
        }
        catch {
            return undefined;
        }
    }
    // ==========================================================================
    // METRICS & OBSERVABILITY
    // ==========================================================================
    /**
     * Get CRAG decision metrics.
     */
    getCRAGMetrics() {
        return this.cragEngine.getMetrics();
    }
    /**
     * Get healing memory statistics.
     */
    getMemoryStats() {
        return this.healingMemory.getStats();
    }
    /**
     * Export healing memory for persistence.
     */
    exportMemory() {
        return this.healingMemory.exportMemory();
    }
    /**
     * Import healing memory.
     */
    importMemory(data) {
        this.healingMemory.importMemory(data);
    }
}
exports.DOMSurgeon = DOMSurgeon;
//# sourceMappingURL=dom-surgeon.js.map