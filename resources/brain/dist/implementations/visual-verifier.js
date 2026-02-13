"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createVisualVerifier = exports.VisualVerifier = void 0;
const uuid_1 = require("uuid");
const pino_1 = __importDefault(require("pino"));
const vision_client_1 = require("../core/vision-client");
const pixel_diff_1 = require("../core/pixel-diff");
const visual_memory_1 = require("../core/visual-memory");
const logger = (0, pino_1.default)({ name: 'visual-verifier' });
const DEFAULT_CONFIG = {
    visionProvider: 'openai',
    defaultTier: 'balanced',
    diffThreshold: 0.1,
    minConfidence: 0.7,
    retrieveThreshold: 0.6,
    autoCheckpoint: true,
};
/**
 * Visual Verifier with Self-RAG reflection tokens.
 */
class VisualVerifier {
    config;
    page;
    vision;
    diffEngine;
    memory;
    constructor(page, config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.page = page;
        const visionConfig = {
            provider: this.config.visionProvider,
            defaultTier: this.config.defaultTier,
        };
        if (this.config.openaiApiKey) {
            visionConfig.openaiApiKey = this.config.openaiApiKey;
        }
        if (this.config.anthropicApiKey) {
            visionConfig.anthropicApiKey = this.config.anthropicApiKey;
        }
        this.vision = new vision_client_1.VisionClient(visionConfig);
        this.diffEngine = new pixel_diff_1.PixelDiffEngine({
            threshold: this.config.diffThreshold,
        });
        this.memory = new visual_memory_1.VisualMemory();
    }
    // ==========================================================================
    // SCREENSHOT CAPTURE
    // ==========================================================================
    async capture(options) {
        const captureOptions = {
            fullPage: options?.fullPage ?? false,
            type: options?.format === 'webp' ? 'png' : (options?.format ?? 'png'),
        };
        if (options?.quality && captureOptions.type === 'jpeg') {
            captureOptions.quality = options.quality;
        }
        let screenshot;
        if (options?.selector) {
            const element = await this.page.locator(options.selector).first();
            screenshot = await element.screenshot(captureOptions);
        }
        else {
            screenshot = await this.page.screenshot(captureOptions);
        }
        // Store in working memory
        const id = (0, uuid_1.v4)();
        const url = this.page.url();
        this.memory.storeWorking(id, screenshot, url, {
            fullPage: options?.fullPage,
            selector: options?.selector,
        });
        logger.debug({ id, url, size: screenshot.length }, 'Captured screenshot');
        return screenshot;
    }
    async captureStable(options) {
        // First capture
        const captureOpts = {};
        if (options?.fullPage !== undefined) {
            captureOpts.fullPage = options.fullPage;
        }
        let screenshot = await this.capture(captureOpts);
        // Mask specified selectors if any
        if (options?.maskSelectors?.length) {
            // Inject masking styles
            await this.page.evaluate((selectors) => {
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.style.visibility = 'hidden';
                    });
                });
            }, options.maskSelectors);
            screenshot = await this.capture(captureOpts);
            // Restore visibility
            await this.page.evaluate((selectors) => {
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        el.style.visibility = '';
                    });
                });
            }, options.maskSelectors);
        }
        return screenshot;
    }
    // ==========================================================================
    // VISUAL ASSERTIONS (Self-RAG [REL] Token)
    // ==========================================================================
    async assertVisible(description, screenshot) {
        const img = screenshot ?? await this.capture();
        const response = await this.vision.locateElement({
            image: img,
            description,
        });
        const assertion = {
            description: `Element visible: ${description}`,
            passed: response.found && response.confidence >= this.config.minConfidence,
            confidence: response.confidence,
            evidence: response.reasoning,
        };
        if (response.boundingBox) {
            assertion.boundingBox = response.boundingBox;
        }
        logger.debug({
            description,
            passed: assertion.passed,
            confidence: assertion.confidence,
        }, 'Visual assertion: visible');
        return assertion;
    }
    async assertTextVisible(text, options) {
        const img = options?.screenshot ?? await this.capture();
        const prompt = options?.exact
            ? `Find the exact text "${text}" in this screenshot`
            : `Find text containing "${text}" in this screenshot`;
        const response = await this.vision.locateElement({
            image: img,
            description: prompt,
            elementType: 'text',
        });
        const assertion = {
            description: `Text visible: "${text}"`,
            passed: response.found && response.confidence >= this.config.minConfidence,
            confidence: response.confidence,
            evidence: response.reasoning,
        };
        if (response.boundingBox) {
            assertion.boundingBox = response.boundingBox;
        }
        return assertion;
    }
    async assertAppearance(selector, expectedDescription) {
        // Capture just the element
        const screenshot = await this.capture({ selector });
        const result = await this.vision.verifyAssertion(screenshot, `This element matches the description: ${expectedDescription}`);
        return {
            description: `Appearance: ${expectedDescription}`,
            passed: result.passed,
            confidence: result.confidence,
            evidence: result.evidence,
        };
    }
    async assertLayout(layoutDescription, screenshot) {
        const img = screenshot ?? await this.capture({ fullPage: true });
        const result = await this.vision.verifyAssertion(img, `The page layout matches: ${layoutDescription}`);
        return {
            description: `Layout: ${layoutDescription}`,
            passed: result.passed,
            confidence: result.confidence,
            evidence: result.evidence,
        };
    }
    async assertAll(assertions, context) {
        const screenshot = await this.capture();
        const results = [];
        for (const desc of assertions) {
            const assertion = await this.assertVisible(desc, screenshot);
            results.push(assertion);
        }
        const passedCount = results.filter(a => a.passed).length;
        const avgConfidence = results.reduce((sum, a) => sum + a.confidence, 0) / results.length;
        const passed = passedCount === results.length && avgConfidence >= this.config.minConfidence;
        const result = {
            passed,
            confidence: avgConfidence,
            assertions: results,
            reflection: this.generateReflectionInternal(passed, avgConfidence, context),
            screenshot,
            timestamp: new Date(),
        };
        return result;
    }
    // ==========================================================================
    // VISUAL COMPARISON (Self-RAG [SUP] Token)
    // ==========================================================================
    async compare(before, after, options) {
        const compareOpts = {};
        if (options?.threshold !== undefined) {
            compareOpts.threshold = options.threshold;
        }
        if (options?.ignoreRegions !== undefined) {
            compareOpts.ignoreRegions = options.ignoreRegions;
        }
        return this.diffEngine.compare(before, after, compareOpts);
    }
    async compareToBaseline(baselineName, options) {
        const baseline = await this.getBaseline(baselineName);
        if (!baseline) {
            throw new Error(`Baseline not found: ${baselineName}`);
        }
        const current = await this.capture();
        return this.compare(baseline, current, options);
    }
    async saveBaseline(name, screenshot) {
        const img = screenshot ?? await this.capture();
        this.memory.saveBaseline(name, img, {
            url: this.page.url(),
            savedAt: new Date(),
        });
        logger.info({ name }, 'Saved baseline');
    }
    async getBaseline(name) {
        const baseline = this.memory.getBaseline(name);
        return baseline?.screenshot ?? null;
    }
    // ==========================================================================
    // VERIFICATION WITH REFLECTION (Self-RAG [USE] Token)
    // ==========================================================================
    async verify(expectations, context) {
        const screenshot = await this.capture();
        const assertions = [];
        let overallConfidence = 1;
        // Check visible elements
        if (expectations.visible?.length) {
            for (const desc of expectations.visible) {
                const assertion = await this.assertVisible(desc, screenshot);
                assertions.push(assertion);
                overallConfidence = Math.min(overallConfidence, assertion.confidence);
            }
        }
        // Check not visible elements
        if (expectations.notVisible?.length) {
            for (const desc of expectations.notVisible) {
                const assertion = await this.assertVisible(desc, screenshot);
                // Invert for "not visible"
                assertions.push({
                    ...assertion,
                    description: `Not visible: ${desc}`,
                    passed: !assertion.passed,
                    confidence: 1 - assertion.confidence,
                });
                overallConfidence = Math.min(overallConfidence, 1 - assertion.confidence);
            }
        }
        // Check text visibility
        if (expectations.text?.length) {
            for (const text of expectations.text) {
                const assertion = await this.assertTextVisible(text, { screenshot });
                assertions.push(assertion);
                overallConfidence = Math.min(overallConfidence, assertion.confidence);
            }
        }
        // Check layout
        if (expectations.layout) {
            const assertion = await this.assertLayout(expectations.layout, screenshot);
            assertions.push(assertion);
            overallConfidence = Math.min(overallConfidence, assertion.confidence);
        }
        // Compare to baseline
        if (expectations.baseline) {
            const diff = await this.compareToBaseline(expectations.baseline);
            const baselineAssertion = {
                description: `Matches baseline: ${expectations.baseline}`,
                passed: !diff.changed || diff.changePercentage < 5,
                confidence: 1 - diff.changePercentage / 100,
                evidence: `${diff.changePercentage.toFixed(2)}% change detected`,
            };
            assertions.push(baselineAssertion);
            overallConfidence = Math.min(overallConfidence, baselineAssertion.confidence);
        }
        const allPassed = assertions.every(a => a.passed);
        const result = {
            passed: allPassed,
            confidence: overallConfidence,
            assertions,
            reflection: this.generateReflectionInternal(allPassed, overallConfidence, context),
            screenshot,
            timestamp: new Date(),
        };
        // Auto-checkpoint on significant verification
        if (this.config.autoCheckpoint && assertions.length >= 3) {
            await this.createCheckpoint(`auto_${Date.now()}`, { verificationResult: result.passed });
        }
        return result;
    }
    async verifyActionEffect(actionDescription, expectedEffect, beforeScreenshot) {
        const after = await this.capture();
        // Compare before/after
        const diff = await this.compare(beforeScreenshot, after);
        // Ask Vision AI if expected effect occurred
        const prompt = `After performing "${actionDescription}", was the expected effect achieved: "${expectedEffect}"?
The screenshot shows ${diff.changePercentage.toFixed(2)}% visual change.`;
        const visionResult = await this.vision.verifyAssertion(after, prompt);
        const assertions = [
            {
                description: `Visual change detected`,
                passed: diff.changed,
                confidence: diff.changePercentage > 1 ? 0.9 : 0.3,
                evidence: `${diff.changePercentage.toFixed(2)}% pixels changed`,
            },
            {
                description: `Expected effect: ${expectedEffect}`,
                passed: visionResult.passed,
                confidence: visionResult.confidence,
                evidence: visionResult.evidence,
            },
        ];
        const passed = diff.changed && visionResult.passed;
        const confidence = (diff.changed ? 0.5 : 0) + (visionResult.confidence * 0.5);
        return {
            passed,
            confidence,
            assertions,
            reflection: this.generateReflectionInternal(passed, confidence),
            screenshot: after,
            timestamp: new Date(),
        };
    }
    async verifyNavigation(expectedUrl, expectedElements) {
        const currentUrl = this.page.url();
        const urlMatches = typeof expectedUrl === 'string'
            ? currentUrl.includes(expectedUrl)
            : expectedUrl.test(currentUrl);
        const assertions = [
            {
                description: `URL matches: ${expectedUrl}`,
                passed: urlMatches,
                confidence: urlMatches ? 1 : 0,
                evidence: `Current URL: ${currentUrl}`,
            },
        ];
        let minConfidence = urlMatches ? 1 : 0;
        if (expectedElements?.length) {
            const screenshot = await this.capture();
            for (const element of expectedElements) {
                const assertion = await this.assertVisible(element, screenshot);
                assertions.push(assertion);
                minConfidence = Math.min(minConfidence, assertion.confidence);
            }
        }
        const passed = assertions.every(a => a.passed);
        return {
            passed,
            confidence: minConfidence,
            assertions,
            reflection: this.generateReflectionInternal(passed, minConfidence),
            timestamp: new Date(),
        };
    }
    // ==========================================================================
    // AI-POWERED ANALYSIS
    // ==========================================================================
    async analyzeWithVision(screenshot, prompt) {
        const response = await this.vision.analyze({
            image: screenshot,
            prompt: `${prompt}\n\nList any notable UI elements with their approximate positions.`,
            tier: 'accurate',
        });
        return {
            description: response.content,
            elements: response.elements ?? [],
        };
    }
    async askAboutScreenshot(screenshot, question) {
        const response = await this.vision.askQuestion(screenshot, question);
        return {
            answer: response.answer,
            confidence: response.confidence,
        };
    }
    async detectIssues(screenshot) {
        return this.vision.detectIssues(screenshot);
    }
    // ==========================================================================
    // CHECKPOINT MANAGEMENT
    // ==========================================================================
    async createCheckpoint(name, metadata) {
        const screenshot = await this.capture();
        const checkpoint = {
            id: (0, uuid_1.v4)(),
            name,
            screenshot,
            url: this.page.url(),
            timestamp: new Date(),
            metadata: metadata ?? {},
        };
        this.memory.saveCheckpoint(checkpoint);
        logger.info({ id: checkpoint.id, name }, 'Created checkpoint');
        return checkpoint;
    }
    async listCheckpoints() {
        return this.memory.listCheckpoints();
    }
    async compareToCheckpoint(checkpointId) {
        const checkpoint = this.memory.getCheckpoint(checkpointId);
        if (!checkpoint) {
            throw new Error(`Checkpoint not found: ${checkpointId}`);
        }
        const current = await this.capture();
        return this.compare(checkpoint.screenshot, current);
    }
    // ==========================================================================
    // REFLECTION TOKEN GENERATION
    // ==========================================================================
    generateReflection(result, missionContext) {
        // Calculate progress factor
        const progressFactor = missionContext.currentStep / missionContext.totalSteps;
        // [RET] - Should retrieve more context?
        const shouldRetrieve = result.confidence < this.config.retrieveThreshold;
        // [REL] - Is the verification relevant to mission?
        const isRelevant = this.calculateRelevance(result, missionContext);
        // [SUP] - Does screenshot support expected state?
        const isSupported = result.passed ? result.confidence : result.confidence * 0.5;
        // [USE] - Is this useful progress?
        const isUseful = this.calculateUsefulness(result, progressFactor);
        const reflection = {
            shouldRetrieve,
            isRelevant,
            isSupported,
            isUseful,
        };
        logger.debug({
            reflection,
            passed: result.passed,
            confidence: result.confidence,
        }, 'Generated reflection tokens');
        return reflection;
    }
    shouldRetrieve(result) {
        return result.confidence < this.config.retrieveThreshold;
    }
    /**
     * Internal reflection generation without full mission context.
     */
    generateReflectionInternal(passed, confidence, context) {
        // [RET] - Low confidence triggers retrieval
        const shouldRetrieve = confidence < this.config.retrieveThreshold;
        // [REL] - Relevance based on step progression
        const isRelevant = context ? 0.8 : 0.6;
        // [SUP] - Support based on pass/confidence
        const isSupported = passed ? confidence : confidence * 0.4;
        // [USE] - Usefulness rating (1-5)
        let isUseful;
        if (passed && confidence > 0.9) {
            isUseful = 5;
        }
        else if (passed && confidence > 0.7) {
            isUseful = 4;
        }
        else if (passed) {
            isUseful = 3;
        }
        else if (confidence > 0.5) {
            isUseful = 2;
        }
        else {
            isUseful = 1;
        }
        return {
            shouldRetrieve,
            isRelevant,
            isSupported,
            isUseful,
        };
    }
    /**
     * Calculate relevance score for verification.
     */
    calculateRelevance(result, missionContext) {
        // Higher relevance if more assertions passed
        const passRate = result.assertions.filter(a => a.passed).length / result.assertions.length;
        // Early steps are more relevant as they set foundation
        const stepWeight = 1 - (missionContext.currentStep / missionContext.totalSteps) * 0.3;
        return Math.min(1, passRate * stepWeight * result.confidence);
    }
    /**
     * Calculate usefulness rating (1-5).
     */
    calculateUsefulness(result, progressFactor) {
        if (!result.passed) {
            // Failed verification still useful for error detection
            return result.confidence > 0.5 ? 2 : 1;
        }
        // Base usefulness on confidence and progress
        const baseScore = result.confidence * 4 + 1; // Maps 0-1 to 1-5
        const progressBonus = progressFactor * 0.5;
        return Math.min(5, Math.round(baseScore + progressBonus));
    }
    // ==========================================================================
    // UTILITY METHODS
    // ==========================================================================
    /**
     * Get memory statistics.
     */
    getMemoryStats() {
        return this.memory.getStats();
    }
    /**
     * Clear visual memory.
     */
    clearMemory() {
        this.memory.clear();
    }
}
exports.VisualVerifier = VisualVerifier;
/**
 * Factory function for creating Visual Verifier instances.
 */
function createVisualVerifier(page, options) {
    return new VisualVerifier(page, options);
}
exports.createVisualVerifier = createVisualVerifier;
//# sourceMappingURL=visual-verifier.js.map