"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectorEngine = exports.DEFAULT_CONFIG = void 0;
/**
 * Default configuration.
 */
exports.DEFAULT_CONFIG = {
    preferredStrategies: ['testid', 'aria', 'css', 'xpath', 'text'],
    minConfidence: 0.5,
    maxCandidatesPerStrategy: 3,
    testIdAttributes: ['data-testid', 'data-test-id', 'data-cy', 'data-test'],
};
/**
 * Multi-strategy selector engine.
 */
class SelectorEngine {
    config;
    constructor(config = {}) {
        this.config = { ...exports.DEFAULT_CONFIG, ...config };
    }
    /**
     * Generate all possible selectors for an element.
     */
    async generateSelectors(element, page) {
        const candidates = [];
        // Generate selectors for each strategy
        for (const strategy of this.config.preferredStrategies) {
            const strategyCandidates = await this.generateForStrategy(element, strategy, page);
            candidates.push(...strategyCandidates);
        }
        // Sort by confidence * stability
        return candidates.sort((a, b) => b.confidence * b.stabilityScore - a.confidence * a.stabilityScore);
    }
    /**
     * Generate selectors for a specific strategy.
     */
    async generateForStrategy(element, strategy, _page) {
        switch (strategy) {
            case 'testid':
                return this.generateTestIdSelectors(element);
            case 'aria':
                return this.generateAriaSelectors(element);
            case 'css':
                return this.generateCssSelectors(element);
            case 'xpath':
                return this.generateXPathSelectors(element);
            case 'text':
                return this.generateTextSelectors(element);
            case 'visual':
                // Placeholder for VLM integration
                return [];
            default:
                return [];
        }
    }
    /**
     * Generate test ID selectors (most stable).
     */
    generateTestIdSelectors(element) {
        const candidates = [];
        for (const attr of this.config.testIdAttributes) {
            const value = element.attributes[attr];
            if (value) {
                candidates.push({
                    value: `[${attr}="${value}"]`,
                    strategy: 'testid',
                    confidence: 0.95,
                    reason: `Test ID attribute: ${attr}`,
                    isUnique: true, // Assume test IDs are unique
                    matchCount: 1,
                    stabilityScore: 1.0, // Test IDs are most stable
                });
            }
        }
        return candidates;
    }
    /**
     * Generate ARIA selectors.
     */
    generateAriaSelectors(element) {
        const candidates = [];
        const attrs = element.attributes;
        // aria-label
        if (attrs['aria-label']) {
            candidates.push({
                value: `[aria-label="${attrs['aria-label']}"]`,
                strategy: 'aria',
                confidence: 0.9,
                reason: 'ARIA label',
                isUnique: true,
                matchCount: 1,
                stabilityScore: 0.9,
            });
        }
        // aria-labelledby
        if (attrs['aria-labelledby']) {
            candidates.push({
                value: `[aria-labelledby="${attrs['aria-labelledby']}"]`,
                strategy: 'aria',
                confidence: 0.85,
                reason: 'ARIA labelledby',
                isUnique: true,
                matchCount: 1,
                stabilityScore: 0.85,
            });
        }
        // role with name
        if (attrs['role']) {
            const roleName = attrs['aria-label'] || element.textContent.trim().slice(0, 50);
            if (roleName) {
                candidates.push({
                    value: `[role="${attrs['role']}"][aria-label="${roleName}"]`,
                    strategy: 'aria',
                    confidence: 0.8,
                    reason: `Role ${attrs['role']} with name`,
                    isUnique: true,
                    matchCount: 1,
                    stabilityScore: 0.8,
                });
            }
        }
        return candidates;
    }
    /**
     * Generate CSS selectors.
     */
    generateCssSelectors(element) {
        const candidates = [];
        const attrs = element.attributes;
        // ID selector (high priority)
        if (attrs['id'] && !this.isGeneratedId(attrs['id'])) {
            candidates.push({
                value: `#${this.escapeCssValue(attrs['id'])}`,
                strategy: 'css',
                confidence: 0.92,
                reason: 'Element ID',
                isUnique: true,
                matchCount: 1,
                stabilityScore: 0.7, // IDs can change
            });
        }
        // Unique class combination
        if (attrs['class']) {
            const classes = attrs['class'].split(/\s+/).filter(c => !this.isGeneratedClass(c));
            if (classes.length > 0) {
                const selector = `${element.tagName.toLowerCase()}.${classes.slice(0, 3).join('.')}`;
                candidates.push({
                    value: selector,
                    strategy: 'css',
                    confidence: 0.75,
                    reason: 'Tag + classes',
                    isUnique: false,
                    matchCount: 1,
                    stabilityScore: 0.6,
                });
            }
        }
        // Tag + attributes
        const meaningfulAttrs = ['name', 'type', 'placeholder', 'title', 'alt'];
        for (const attr of meaningfulAttrs) {
            if (attrs[attr]) {
                candidates.push({
                    value: `${element.tagName.toLowerCase()}[${attr}="${attrs[attr]}"]`,
                    strategy: 'css',
                    confidence: 0.7,
                    reason: `Tag + ${attr} attribute`,
                    isUnique: false,
                    matchCount: 1,
                    stabilityScore: 0.65,
                });
            }
        }
        // nth-child fallback (less stable)
        if (attrs['data-nth-child']) {
            candidates.push({
                value: `${element.tagName.toLowerCase()}:nth-child(${attrs['data-nth-child']})`,
                strategy: 'css',
                confidence: 0.5,
                reason: 'nth-child position',
                isUnique: true,
                matchCount: 1,
                stabilityScore: 0.3, // Very unstable
            });
        }
        return candidates;
    }
    /**
     * Generate XPath selectors.
     */
    generateXPathSelectors(element) {
        const candidates = [];
        const text = element.textContent.trim();
        // Text contains
        if (text && text.length > 0 && text.length < 100) {
            candidates.push({
                value: `//${element.tagName.toLowerCase()}[contains(text(), "${this.escapeXPathString(text.slice(0, 50))}")]`,
                strategy: 'xpath',
                confidence: 0.75,
                reason: 'Text contains',
                isUnique: false,
                matchCount: 1,
                stabilityScore: 0.7,
            });
            // Exact text match
            if (text.length < 50) {
                candidates.push({
                    value: `//${element.tagName.toLowerCase()}[normalize-space()="${this.escapeXPathString(text)}"]`,
                    strategy: 'xpath',
                    confidence: 0.8,
                    reason: 'Exact text match',
                    isUnique: true,
                    matchCount: 1,
                    stabilityScore: 0.75,
                });
            }
        }
        // Attribute-based XPath
        const attrs = element.attributes;
        if (attrs['id']) {
            candidates.push({
                value: `//${element.tagName.toLowerCase()}[@id="${attrs['id']}"]`,
                strategy: 'xpath',
                confidence: 0.85,
                reason: 'XPath by ID',
                isUnique: true,
                matchCount: 1,
                stabilityScore: 0.7,
            });
        }
        return candidates;
    }
    /**
     * Generate text-based selectors.
     */
    generateTextSelectors(element) {
        const candidates = [];
        const text = element.textContent.trim();
        if (text && text.length > 0 && text.length < 100) {
            // Playwright-style text selector
            candidates.push({
                value: `text="${text}"`,
                strategy: 'text',
                confidence: 0.7,
                reason: 'Text content',
                isUnique: text.length > 10,
                matchCount: 1,
                stabilityScore: 0.65,
            });
            // Partial text match
            if (text.length > 20) {
                const partialText = text.slice(0, 30);
                candidates.push({
                    value: `text=${partialText}`,
                    strategy: 'text',
                    confidence: 0.6,
                    reason: 'Partial text match',
                    isUnique: false,
                    matchCount: 1,
                    stabilityScore: 0.55,
                });
            }
        }
        return candidates;
    }
    /**
     * Check if an ID looks generated (random hash, uuid, etc.).
     */
    isGeneratedId(id) {
        // Check for common generated ID patterns
        const generatedPatterns = [
            /^[a-f0-9]{8,}$/i, // Hex hashes
            /^[a-z0-9]{20,}$/i, // Long random strings
            /^:r[0-9]+:$/, // React generated
            /^__[a-z]+_[0-9]+$/, // Framework generated
            /^ember[0-9]+$/, // Ember.js
            /^ng-[a-z]+-[0-9]+$/, // Angular
        ];
        return generatedPatterns.some(pattern => pattern.test(id));
    }
    /**
     * Check if a class looks generated.
     */
    isGeneratedClass(className) {
        const generatedPatterns = [
            /^[a-z]{1,2}[0-9]+$/i, // Minified classes like "a1", "bc23"
            /^css-[a-z0-9]+$/i, // CSS-in-JS
            /^sc-[a-z]+$/i, // Styled components
            /^_[a-z0-9]+$/i, // Underscore prefixed generated
            /^[a-f0-9]{6,}$/i, // Hash-based classes
        ];
        return generatedPatterns.some(pattern => pattern.test(className));
    }
    /**
     * Escape CSS selector value.
     */
    escapeCssValue(value) {
        return value.replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
    }
    /**
     * Escape XPath string.
     */
    escapeXPathString(str) {
        if (!str.includes("'")) {
            return str;
        }
        if (!str.includes('"')) {
            return str;
        }
        // Handle strings with both quotes
        return str.replace(/'/g, "\\'");
    }
    /**
     * Convert CSS selector to XPath.
     */
    cssToXPath(css) {
        // Basic CSS to XPath conversion
        let xpath = css;
        // ID selector
        xpath = xpath.replace(/#([a-zA-Z0-9_-]+)/g, '[@id="$1"]');
        // Class selector
        xpath = xpath.replace(/\.([a-zA-Z0-9_-]+)/g, '[contains(@class, "$1")]');
        // Attribute selector
        xpath = xpath.replace(/\[([a-zA-Z-]+)="([^"]+)"\]/g, '[@$1="$2"]');
        // Tag name
        xpath = xpath.replace(/^([a-zA-Z0-9]+)/, '//$1');
        return xpath;
    }
}
exports.SelectorEngine = SelectorEngine;
//# sourceMappingURL=selector-engine.js.map