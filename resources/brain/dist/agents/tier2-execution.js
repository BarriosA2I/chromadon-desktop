"use strict";
// @ts-nocheck
/**
 * CHROMADON Tier 2: Execution Layer
 * ==================================
 * THE NAVIGATOR - URL Navigation & History
 * THE CLICKER - Click Actions with Retry
 * THE TYPER - Keyboard Input with Human-like Timing
 * THE SCROLLER - Scroll & Viewport Management
 * THE SELECTOR - Dropdown & Multi-select
 * THE FORM MASTER - Complex Form Orchestration
 * THE CONTENT GENERATOR - AI Content Creation
 * THE FILE HANDLER - Upload/Download Management
 *
 * These agents are the "hands" of the system - they execute
 * physical browser actions with reliability and human-like behavior.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c, _d, _e;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExecutionAgents = exports.TheFileHandler = exports.TheContentGenerator = exports.TheFormMaster = exports.TheSelector = exports.TheScroller = exports.TheTyper = exports.TheClicker = exports.TheNavigator = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const uuid_1 = require("uuid");
const types_1 = require("./types");
const event_bus_1 = require("./event-bus");
// =============================================================================
// BASE EXECUTION AGENT CLASS
// =============================================================================
class BaseExecutionAgent {
    name;
    config;
    anthropic;
    eventBus;
    cdp = null;
    // Circuit breaker
    failures = 0;
    lastFailure = 0;
    state = 'closed';
    constructor(name, config = {}) {
        this.name = name;
        this.config = {
            name,
            model: 'haiku', // Execution agents use fast model
            maxRetries: 3,
            timeoutMs: 15000,
            circuitBreaker: {
                failureThreshold: 5,
                recoveryTimeMs: 30000,
                halfOpenRequests: 3,
            },
            ...config,
        };
        this.anthropic = new sdk_1.default();
        this.eventBus = (0, event_bus_1.getEventBus)();
    }
    setCDPController(cdp) {
        this.cdp = cdp;
    }
    async canExecute() {
        if (!this.cdp)
            throw new Error(`${this.name}: CDP controller not set`);
        if (this.state === 'closed')
            return true;
        if (this.state === 'open') {
            if (Date.now() - this.lastFailure > this.config.circuitBreaker.recoveryTimeMs) {
                this.state = 'half_open';
                return true;
            }
            return false;
        }
        return true;
    }
    recordSuccess() {
        if (this.state === 'half_open') {
            this.state = 'closed';
            this.failures = 0;
        }
    }
    recordFailure() {
        this.failures++;
        this.lastFailure = Date.now();
        if (this.failures >= this.config.circuitBreaker.failureThreshold || this.state === 'half_open') {
            this.state = 'open';
            this.publishEvent('circuit_breaker.opened', { agent: this.name, failures: this.failures });
        }
    }
    publishEvent(type, payload, correlationId) {
        this.eventBus.publish({
            type: type,
            source: this.name,
            correlationId: correlationId ?? (0, uuid_1.v4)(),
            payload,
        });
    }
    async retry(fn, retries = this.config.maxRetries, delayMs = 1000) {
        let lastError = null;
        for (let i = 0; i <= retries; i++) {
            try {
                return await fn();
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (i < retries) {
                    await this.delay(delayMs * Math.pow(2, i)); // Exponential backoff
                }
            }
        }
        throw lastError;
    }
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // Human-like random delay
    humanDelay(minMs, maxMs) {
        const delay = minMs + Math.random() * (maxMs - minMs);
        return this.delay(delay);
    }
}
// =============================================================================
// AGENT 9: THE NAVIGATOR
// =============================================================================
/**
 * THE NAVIGATOR
 * -------------
 * Handles URL navigation, history, and page load verification.
 * Includes smart URL normalization and redirect following.
 */
class TheNavigator extends BaseExecutionAgent {
    navigationHistory = [];
    constructor() {
        super('THE_NAVIGATOR');
    }
    async navigate(url, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        const normalizedUrl = this.normalizeUrl(url);
        this.publishEvent('agent.started', { action: 'navigate', url: normalizedUrl });
        try {
            const result = await this.retry(async () => {
                const navResult = await this.cdp.navigate(normalizedUrl);
                if (options.waitForLoad !== false) {
                    await this.cdp.waitForNavigation(options.timeout ?? this.config.timeoutMs);
                }
                return navResult;
            });
            const navigationResult = {
                success: result.success,
                originalUrl: url,
                finalUrl: result.finalUrl,
                redirected: result.finalUrl !== normalizedUrl,
                loadTimeMs: result.loadTime,
                timestamp: Date.now(),
            };
            this.navigationHistory.push({
                url: result.finalUrl,
                timestamp: Date.now(),
                success: true,
            });
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'navigate',
                durationMs: Date.now() - startTime,
                ...navigationResult,
            });
            return navigationResult;
        }
        catch (error) {
            this.recordFailure();
            const failResult = {
                success: false,
                originalUrl: url,
                finalUrl: url,
                redirected: false,
                loadTimeMs: Date.now() - startTime,
                timestamp: Date.now(),
                error: error instanceof Error ? error.message : 'Navigation failed',
            };
            this.publishEvent('agent.error', { action: 'navigate', error: failResult.error });
            return failResult;
        }
    }
    async goBack() {
        await this.canExecute();
        try {
            await this.cdp.goBack();
            await this.humanDelay(500, 1000);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async goForward() {
        await this.canExecute();
        try {
            await this.cdp.goForward();
            await this.humanDelay(500, 1000);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async refresh(hardRefresh = false) {
        await this.canExecute();
        try {
            await this.cdp.refresh();
            await this.cdp.waitForNavigation();
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async waitForUrl(urlPattern, timeout = 30000) {
        await this.canExecute();
        const startTime = Date.now();
        const pattern = typeof urlPattern === 'string' ? new RegExp(urlPattern) : urlPattern;
        while (Date.now() - startTime < timeout) {
            const currentUrl = await this.cdp.evaluate('window.location.href');
            if (pattern.test(currentUrl)) {
                return true;
            }
            await this.delay(500);
        }
        return false;
    }
    normalizeUrl(url) {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        // Handle common shortcuts
        const shortcuts = {
            'fb': 'https://www.facebook.com',
            'facebook': 'https://www.facebook.com',
            'ig': 'https://www.instagram.com',
            'instagram': 'https://www.instagram.com',
            'twitter': 'https://twitter.com',
            'x': 'https://x.com',
            'linkedin': 'https://www.linkedin.com',
            'google': 'https://www.google.com',
            'yt': 'https://www.youtube.com',
            'youtube': 'https://www.youtube.com',
        };
        const lowered = url.toLowerCase();
        for (const [shortcut, fullUrl] of Object.entries(shortcuts)) {
            if (lowered === shortcut || lowered === `https://${shortcut}`) {
                return fullUrl;
            }
        }
        return url;
    }
    getHistory() {
        return [...this.navigationHistory];
    }
    clearHistory() {
        this.navigationHistory = [];
    }
}
exports.TheNavigator = TheNavigator;
__decorate([
    (0, event_bus_1.traced)('navigator.navigate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], TheNavigator.prototype, "navigate", null);
__decorate([
    (0, event_bus_1.traced)('navigator.go_back'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheNavigator.prototype, "goBack", null);
__decorate([
    (0, event_bus_1.traced)('navigator.go_forward'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheNavigator.prototype, "goForward", null);
__decorate([
    (0, event_bus_1.traced)('navigator.refresh'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheNavigator.prototype, "refresh", null);
__decorate([
    (0, event_bus_1.traced)('navigator.wait_for_url'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TheNavigator.prototype, "waitForUrl", null);
// =============================================================================
// AGENT 10: THE CLICKER
// =============================================================================
/**
 * THE CLICKER
 * -----------
 * Handles all click operations with multiple fallback strategies.
 * Includes hover, double-click, right-click, and coordinate-based clicks.
 */
class TheClicker extends BaseExecutionAgent {
    constructor() {
        super('THE_CLICKER');
    }
    async click(target, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        const correlationId = (0, uuid_1.v4)();
        this.publishEvent('agent.started', { action: 'click', target }, correlationId);
        try {
            let success = false;
            if (typeof target === 'string') {
                // Selector-based click
                success = await this.clickBySelector(target, options);
            }
            else {
                // Coordinate-based click
                success = await this.clickByCoordinates(target.x, target.y, options);
            }
            if (success) {
                // Wait for any resulting action
                await this.humanDelay(options.postClickDelay ?? 200, options.postClickDelay ?? 500);
                this.recordSuccess();
            }
            else {
                this.recordFailure();
            }
            const result = {
                nodeId: correlationId,
                agent: this.name,
                action: 'click',
                success,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
            this.publishEvent('agent.completed', { ...result, target }, correlationId);
            return result;
        }
        catch (error) {
            this.recordFailure();
            const result = {
                nodeId: correlationId,
                agent: this.name,
                action: 'click',
                success: false,
                error: {
                    code: 'CLICK_FAILED',
                    message: error instanceof Error ? error.message : 'Click failed',
                    recoverable: true,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
            this.publishEvent('agent.error', { ...result, target }, correlationId);
            return result;
        }
    }
    async doubleClick(target, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        try {
            // Execute two rapid clicks
            if (typeof target === 'string') {
                await this.cdp.click(target, { force: options.force });
                await this.delay(50);
                await this.cdp.click(target, { force: options.force });
            }
            else {
                await this.cdp.clickCoordinates(target.x, target.y);
                await this.delay(50);
                await this.cdp.clickCoordinates(target.x, target.y);
            }
            this.recordSuccess();
            return {
                nodeId: (0, uuid_1.v4)(),
                agent: this.name,
                action: 'double_click',
                success: true,
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
        catch (error) {
            this.recordFailure();
            return {
                nodeId: (0, uuid_1.v4)(),
                agent: this.name,
                action: 'double_click',
                success: false,
                error: {
                    code: 'DOUBLE_CLICK_FAILED',
                    message: error instanceof Error ? error.message : 'Double click failed',
                    recoverable: true,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    async hover(target) {
        await this.canExecute();
        try {
            if (typeof target === 'string') {
                // Scroll to element first
                await this.cdp.scrollToElement(target);
                // Hover by evaluating JS
                await this.cdp.evaluate(`
          const el = document.querySelector('${target}');
          if (el) {
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          }
        `);
            }
            else {
                await this.cdp.scrollToCoordinates(target.x, target.y);
            }
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async clickBySelector(selector, options) {
        // Try multiple strategies
        const strategies = [
            () => this.cdp.click(selector, { timeout: options.timeout }),
            () => this.clickViaJS(selector),
            () => this.clickViaCoordinatesFromSelector(selector),
        ];
        for (const strategy of strategies) {
            try {
                const result = await strategy();
                if (result.success)
                    return true;
            }
            catch {
                continue;
            }
        }
        return false;
    }
    async clickByCoordinates(x, y, options) {
        try {
            // Scroll to position first if needed
            await this.cdp.scrollToCoordinates(x, y);
            await this.humanDelay(100, 200);
            const result = await this.cdp.clickCoordinates(x, y);
            return result.success;
        }
        catch {
            return false;
        }
    }
    async clickViaJS(selector) {
        try {
            await this.cdp.evaluate(`
        const el = document.querySelector('${selector}');
        if (el) {
          el.click();
        } else {
          throw new Error('Element not found');
        }
      `);
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async clickViaCoordinatesFromSelector(selector) {
        try {
            const rect = await this.cdp.evaluate(`
        const el = document.querySelector('${selector}');
        if (el) {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
        return null;
      `);
            if (rect) {
                const centerX = rect.x + rect.width / 2;
                const centerY = rect.y + rect.height / 2;
                return await this.cdp.clickCoordinates(centerX, centerY);
            }
            return { success: false };
        }
        catch {
            return { success: false };
        }
    }
}
exports.TheClicker = TheClicker;
__decorate([
    (0, event_bus_1.traced)('clicker.click'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_a = typeof types_1.ClickOptions !== "undefined" && types_1.ClickOptions) === "function" ? _a : Object]),
    __metadata("design:returntype", Promise)
], TheClicker.prototype, "click", null);
__decorate([
    (0, event_bus_1.traced)('clicker.double_click'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, typeof (_b = typeof types_1.ClickOptions !== "undefined" && types_1.ClickOptions) === "function" ? _b : Object]),
    __metadata("design:returntype", Promise)
], TheClicker.prototype, "doubleClick", null);
__decorate([
    (0, event_bus_1.traced)('clicker.hover'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheClicker.prototype, "hover", null);
// =============================================================================
// AGENT 11: THE TYPER
// =============================================================================
/**
 * THE TYPER
 * ---------
 * Handles keyboard input with human-like timing and behavior.
 * Supports special keys, modifiers, and paste operations.
 */
class TheTyper extends BaseExecutionAgent {
    constructor() {
        super('THE_TYPER');
    }
    async type(target, text, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        const correlationId = (0, uuid_1.v4)();
        this.publishEvent('agent.started', { action: 'type', target, textLength: text.length }, correlationId);
        try {
            // Focus the element first
            await this.cdp.click(target);
            await this.humanDelay(50, 150);
            // Clear existing content if requested
            if (options.clear) {
                await this.clear(target);
            }
            // Type with human-like timing
            if (options.instant) {
                // Paste-like instant typing
                await this.cdp.type(target, text, { delay: 0 });
            }
            else {
                // Character by character with variable delays
                const baseDelay = options.delay ?? 50;
                for (const char of text) {
                    await this.cdp.type(target, char, { delay: 0 });
                    await this.humanDelay(baseDelay * 0.5, baseDelay * 1.5);
                    // Occasional longer pause (simulates thinking)
                    if (Math.random() < 0.05) {
                        await this.humanDelay(200, 500);
                    }
                }
            }
            this.recordSuccess();
            const result = {
                nodeId: correlationId,
                agent: this.name,
                action: 'type',
                success: true,
                data: { textLength: text.length },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
            this.publishEvent('agent.completed', result, correlationId);
            return result;
        }
        catch (error) {
            this.recordFailure();
            return {
                nodeId: correlationId,
                agent: this.name,
                action: 'type',
                success: false,
                error: {
                    code: 'TYPE_FAILED',
                    message: error instanceof Error ? error.message : 'Type failed',
                    recoverable: true,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    async clear(target) {
        await this.canExecute();
        try {
            // Select all and delete
            await this.cdp.click(target);
            await this.delay(50);
            await this.cdp.typeKeys(['Control', 'a']);
            await this.delay(50);
            await this.cdp.typeKeys(['Backspace']);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async pressKey(key, modifiers = []) {
        await this.canExecute();
        try {
            const keys = [...modifiers, key];
            await this.cdp.typeKeys(keys);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async pressEnter() {
        return this.pressKey('Enter');
    }
    async pressTab() {
        return this.pressKey('Tab');
    }
    async pressEscape() {
        return this.pressKey('Escape');
    }
}
exports.TheTyper = TheTyper;
__decorate([
    (0, event_bus_1.traced)('typer.type'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, typeof (_c = typeof types_1.TypeOptions !== "undefined" && types_1.TypeOptions) === "function" ? _c : Object]),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "type", null);
__decorate([
    (0, event_bus_1.traced)('typer.clear'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "clear", null);
__decorate([
    (0, event_bus_1.traced)('typer.press_key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "pressKey", null);
__decorate([
    (0, event_bus_1.traced)('typer.press_enter'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "pressEnter", null);
__decorate([
    (0, event_bus_1.traced)('typer.press_tab'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "pressTab", null);
__decorate([
    (0, event_bus_1.traced)('typer.press_escape'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheTyper.prototype, "pressEscape", null);
// =============================================================================
// AGENT 12: THE SCROLLER
// =============================================================================
/**
 * THE SCROLLER
 * ------------
 * Manages viewport scrolling and element visibility.
 * Supports smooth scrolling, infinite scroll, and pagination.
 */
class TheScroller extends BaseExecutionAgent {
    constructor() {
        super('THE_SCROLLER');
    }
    async scroll(direction, options = {}) {
        await this.canExecute();
        try {
            const amount = options.amount ?? 300;
            if (options.smooth) {
                // Smooth scroll in increments
                const steps = 5;
                const stepAmount = amount / steps;
                for (let i = 0; i < steps; i++) {
                    await this.cdp.scroll({ direction, amount: stepAmount });
                    await this.delay(50);
                }
            }
            else {
                await this.cdp.scroll({ direction, amount });
            }
            await this.humanDelay(100, 300);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async scrollToElement(selector) {
        await this.canExecute();
        try {
            const result = await this.cdp.scrollToElement(selector);
            await this.humanDelay(200, 400);
            this.recordSuccess();
            return result.success;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async scrollToTop() {
        await this.canExecute();
        try {
            await this.cdp.evaluate('window.scrollTo({ top: 0, behavior: "smooth" })');
            await this.delay(500);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async scrollToBottom() {
        await this.canExecute();
        try {
            await this.cdp.evaluate('window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })');
            await this.delay(500);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async infiniteScroll(options = {}) {
        await this.canExecute();
        const maxScrolls = options.maxScrolls ?? 10;
        const waitBetween = options.waitBetween ?? 1500;
        let scrollCount = 0;
        let previousHeight = 0;
        let sameHeightCount = 0;
        try {
            while (scrollCount < maxScrolls) {
                // Check stop condition
                if (options.stopCondition && await options.stopCondition()) {
                    break;
                }
                // Get current scroll height
                const currentHeight = await this.cdp.evaluate('document.body.scrollHeight');
                // Check if we've stopped growing
                if (currentHeight === previousHeight) {
                    sameHeightCount++;
                    if (sameHeightCount >= 2) {
                        // Reached end
                        return { scrollCount, reachedEnd: true };
                    }
                }
                else {
                    sameHeightCount = 0;
                }
                previousHeight = currentHeight;
                // Scroll down
                await this.scrollToBottom();
                await this.delay(waitBetween);
                scrollCount++;
            }
            this.recordSuccess();
            return { scrollCount, reachedEnd: false };
        }
        catch (error) {
            this.recordFailure();
            return { scrollCount, reachedEnd: false };
        }
    }
}
exports.TheScroller = TheScroller;
__decorate([
    (0, event_bus_1.traced)('scroller.scroll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, typeof (_d = typeof types_1.ScrollOptions !== "undefined" && types_1.ScrollOptions) === "function" ? _d : Object]),
    __metadata("design:returntype", Promise)
], TheScroller.prototype, "scroll", null);
__decorate([
    (0, event_bus_1.traced)('scroller.scroll_to_element'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheScroller.prototype, "scrollToElement", null);
__decorate([
    (0, event_bus_1.traced)('scroller.scroll_to_top'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheScroller.prototype, "scrollToTop", null);
__decorate([
    (0, event_bus_1.traced)('scroller.scroll_to_bottom'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TheScroller.prototype, "scrollToBottom", null);
__decorate([
    (0, event_bus_1.traced)('scroller.infinite_scroll'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheScroller.prototype, "infiniteScroll", null);
// =============================================================================
// AGENT 13: THE SELECTOR
// =============================================================================
/**
 * THE SELECTOR
 * ------------
 * Handles dropdown, checkbox, radio button, and multi-select operations.
 */
class TheSelector extends BaseExecutionAgent {
    constructor() {
        super('THE_SELECTOR');
    }
    async select(target, value, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        const correlationId = (0, uuid_1.v4)();
        this.publishEvent('agent.started', { action: 'select', target, value }, correlationId);
        try {
            // Default to by value
            const result = await this.cdp.select(target, value);
            if (!result.success && options.byText) {
                // Try by visible text
                await this.cdp.evaluate(`
          const select = document.querySelector('${target}');
          if (select) {
            const option = Array.from(select.options).find(o => o.text === '${value}');
            if (option) {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        `);
            }
            this.recordSuccess();
            return {
                nodeId: correlationId,
                agent: this.name,
                action: 'select',
                success: true,
                data: { value },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
        catch (error) {
            this.recordFailure();
            return {
                nodeId: correlationId,
                agent: this.name,
                action: 'select',
                success: false,
                error: {
                    code: 'SELECT_FAILED',
                    message: error instanceof Error ? error.message : 'Select failed',
                    recoverable: true,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    async selectMultiple(target, values) {
        await this.canExecute();
        const startTime = Date.now();
        try {
            const result = await this.cdp.selectMultiple(target, values);
            this.recordSuccess();
            return {
                nodeId: (0, uuid_1.v4)(),
                agent: this.name,
                action: 'select_multiple',
                success: result.success,
                data: { values },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
        catch (error) {
            this.recordFailure();
            return {
                nodeId: (0, uuid_1.v4)(),
                agent: this.name,
                action: 'select_multiple',
                success: false,
                error: {
                    code: 'SELECT_MULTIPLE_FAILED',
                    message: error instanceof Error ? error.message : 'Multi-select failed',
                    recoverable: true,
                },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    async check(target) {
        await this.canExecute();
        try {
            const isChecked = await this.cdp.evaluate(`
        const el = document.querySelector('${target}');
        return el ? el.checked : false;
      `);
            if (!isChecked) {
                await this.cdp.click(target);
            }
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async uncheck(target) {
        await this.canExecute();
        try {
            const isChecked = await this.cdp.evaluate(`
        const el = document.querySelector('${target}');
        return el ? el.checked : false;
      `);
            if (isChecked) {
                await this.cdp.click(target);
            }
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async toggle(target) {
        await this.canExecute();
        try {
            await this.cdp.click(target);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async selectRadio(name, value) {
        await this.canExecute();
        try {
            await this.cdp.click(`input[name="${name}"][value="${value}"]`);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
}
exports.TheSelector = TheSelector;
__decorate([
    (0, event_bus_1.traced)('selector.select'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "select", null);
__decorate([
    (0, event_bus_1.traced)('selector.select_multiple'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "selectMultiple", null);
__decorate([
    (0, event_bus_1.traced)('selector.check'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "check", null);
__decorate([
    (0, event_bus_1.traced)('selector.uncheck'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "uncheck", null);
__decorate([
    (0, event_bus_1.traced)('selector.toggle'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "toggle", null);
__decorate([
    (0, event_bus_1.traced)('selector.select_radio'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheSelector.prototype, "selectRadio", null);
// =============================================================================
// AGENT 14: THE FORM MASTER
// =============================================================================
/**
 * THE FORM MASTER
 * ---------------
 * Orchestrates complex form filling operations.
 * Handles multi-step forms, validation, and conditional fields.
 */
class TheFormMaster extends BaseExecutionAgent {
    clicker;
    typer;
    selector;
    scroller;
    constructor() {
        super('THE_FORM_MASTER', { model: 'sonnet' });
        this.clicker = new TheClicker();
        this.typer = new TheTyper();
        this.selector = new TheSelector();
        this.scroller = new TheScroller();
    }
    setCDPController(cdp) {
        super.setCDPController(cdp);
        this.clicker.setCDPController(cdp);
        this.typer.setCDPController(cdp);
        this.selector.setCDPController(cdp);
        this.scroller.setCDPController(cdp);
    }
    async fillForm(fields, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        const correlationId = (0, uuid_1.v4)();
        const results = [];
        this.publishEvent('agent.started', { action: 'fill_form', fieldCount: fields.length }, correlationId);
        try {
            for (const field of fields) {
                // Scroll to field
                await this.scroller.scrollToElement(field.selector);
                await this.delay(200);
                let success = false;
                switch (field.type) {
                    case 'text':
                    case 'email':
                    case 'password':
                    case 'tel':
                    case 'url':
                    case 'textarea':
                        const typeResult = await this.typer.type(field.selector, field.value, { clear: true });
                        success = typeResult.success;
                        break;
                    case 'select':
                        const selectResult = await this.selector.select(field.selector, field.value);
                        success = selectResult.success;
                        break;
                    case 'checkbox':
                        if (field.value === 'true' || field.value === '1') {
                            success = await this.selector.check(field.selector);
                        }
                        else {
                            success = await this.selector.uncheck(field.selector);
                        }
                        break;
                    case 'radio':
                        success = await this.selector.selectRadio(field.selector, field.value);
                        break;
                    case 'file':
                        // Handled by file handler
                        success = true;
                        break;
                    default:
                        const clickResult = await this.clicker.click(field.selector);
                        success = clickResult.success;
                }
                results.push({ field: field.selector, success });
                await this.humanDelay(100, 300);
            }
            // Submit if requested
            if (options.submitAfter) {
                await this.submitForm();
            }
            const allSuccess = results.every((r) => r.success);
            this.recordSuccess();
            return {
                nodeId: correlationId,
                agent: this.name,
                action: 'fill_form',
                success: allSuccess,
                data: { results },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
        catch (error) {
            this.recordFailure();
            return {
                nodeId: correlationId,
                agent: this.name,
                action: 'fill_form',
                success: false,
                error: {
                    code: 'FORM_FILL_FAILED',
                    message: error instanceof Error ? error.message : 'Form fill failed',
                    recoverable: true,
                },
                data: { results },
                durationMs: Date.now() - startTime,
                timestamp: Date.now(),
                retryCount: 0,
            };
        }
    }
    async submitForm(buttonSelector) {
        await this.canExecute();
        try {
            if (buttonSelector) {
                const result = await this.clicker.click(buttonSelector);
                return result.success;
            }
            // Try common submit patterns
            const submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'form button:last-child',
                '[data-testid="submit"]',
                'button:contains("Submit")',
                'button:contains("Save")',
                'button:contains("Continue")',
            ];
            for (const selector of submitSelectors) {
                try {
                    const result = await this.clicker.click(selector);
                    if (result.success) {
                        this.recordSuccess();
                        return true;
                    }
                }
                catch {
                    continue;
                }
            }
            // Fallback: press Enter
            await this.typer.pressEnter();
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async waitForValidation(timeout = 5000) {
        await this.canExecute();
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            // Check for validation errors
            const errors = await this.cdp.evaluate(`
        const errorElements = document.querySelectorAll('.error, .invalid, [aria-invalid="true"], .form-error');
        return Array.from(errorElements).map(e => e.textContent?.trim()).filter(Boolean);
      `);
            if (errors.length > 0) {
                return { valid: false, errors };
            }
            // Check if form was submitted (page changed)
            const submitted = await this.cdp.evaluate(`
        document.querySelector('.success, .thank-you, [data-submitted="true"]') !== null
      `);
            if (submitted) {
                return { valid: true, errors: [] };
            }
            await this.delay(500);
        }
        return { valid: true, errors: [] };
    }
}
exports.TheFormMaster = TheFormMaster;
__decorate([
    (0, event_bus_1.traced)('form_master.fill_form'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], TheFormMaster.prototype, "fillForm", null);
__decorate([
    (0, event_bus_1.traced)('form_master.submit_form'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], TheFormMaster.prototype, "submitForm", null);
__decorate([
    (0, event_bus_1.traced)('form_master.wait_for_validation'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TheFormMaster.prototype, "waitForValidation", null);
// =============================================================================
// AGENT 15: THE CONTENT GENERATOR
// =============================================================================
/**
 * THE CONTENT GENERATOR
 * ---------------------
 * Creates AI-generated content for forms, posts, and profiles.
 * Uses Claude to generate contextually appropriate content.
 */
class TheContentGenerator extends BaseExecutionAgent {
    constructor() {
        super('THE_CONTENT_GENERATOR', { model: 'sonnet' });
    }
    async generate(request) {
        await this.canExecute();
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'generate', type: request.type });
        try {
            const systemPrompt = `You are THE CONTENT GENERATOR. Create authentic, engaging content.

Guidelines:
- Match the tone and style for the platform
- Be concise but complete
- Avoid generic filler phrases
- Include relevant keywords naturally
- Sound human, not AI-generated

Respond with JSON:
{
  "content": "the generated content",
  "alternatives": ["2-3 alternative versions"],
  "keywords": ["relevant keywords used"],
  "tone": "formal|casual|professional|friendly|etc",
  "characterCount": number,
  "wordCount": number
}`;
            const userMessage = `Generate ${request.type} content.

Context:
- Platform: ${request.platform ?? 'general'}
- Business/Topic: ${request.context?.business ?? 'not specified'}
- Target Audience: ${request.context?.audience ?? 'general'}
- Tone: ${request.tone ?? 'professional'}
- Max Length: ${request.maxLength ?? 'no limit'}
- Required Keywords: ${request.keywords?.join(', ') ?? 'none'}

${request.prompt ? `Additional Instructions: ${request.prompt}` : ''}`;
            const response = await this.callLLM(systemPrompt, userMessage);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Failed to parse generated content');
            }
            const generated = JSON.parse(jsonMatch[0]);
            generated.generatedAt = Date.now();
            generated.requestType = request.type;
            this.recordSuccess();
            this.publishEvent('agent.completed', {
                action: 'generate',
                type: request.type,
                durationMs: Date.now() - startTime,
                characterCount: generated.characterCount,
            });
            return generated;
        }
        catch (error) {
            this.recordFailure();
            throw error;
        }
    }
    async callLLM(systemPrompt, userMessage) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userMessage);
        return result.response.text();
    }
    // Convenience methods for common content types
    async generateBusinessDescription(businessName, industry, targetAudience) {
        const result = await this.generate({
            type: 'business_description',
            context: {
                business: businessName,
                industry,
                audience: targetAudience,
            },
            tone: 'professional',
            maxLength: 500,
        });
        return result.content;
    }
    async generateSocialPost(platform, topic, tone = 'engaging') {
        const result = await this.generate({
            type: 'social_post',
            platform,
            context: { topic },
            tone,
            maxLength: platform === 'twitter' ? 280 : 2000,
        });
        return result.content;
    }
    async generateProfileBio(name, role, platform) {
        const result = await this.generate({
            type: 'profile_bio',
            platform,
            context: { name, role },
            tone: 'professional',
            maxLength: 300,
        });
        return result.content;
    }
    async generateComment(platform, originalPost, tone = 'friendly', brandVoice) {
        const result = await this.generate({
            type: 'comment',
            platform,
            context: { originalPost, brandVoice },
            tone,
            maxLength: platform === 'twitter' ? 280 : 500,
            prompt: `Write a thoughtful, on-brand comment replying to this post. Be genuine, not salesy. ${brandVoice ? `Brand voice: ${brandVoice}` : ''}`,
        });
        return result.content;
    }
    async generateReply(platform, commentText, commentAuthor, tone = 'helpful', brandVoice) {
        const result = await this.generate({
            type: 'reply',
            platform,
            context: { commentText, commentAuthor, brandVoice },
            tone,
            maxLength: platform === 'twitter' ? 280 : 500,
            prompt: `Write a reply to ${commentAuthor}'s comment: "${commentText}". Be brief, professional, and helpful. ${brandVoice ? `Brand voice: ${brandVoice}` : ''}`,
        });
        return result.content;
    }
    async generateMessage(platform, messageContext, tone = 'professional') {
        const result = await this.generate({
            type: 'direct_message',
            platform,
            context: { messageContext },
            tone,
            maxLength: 1000,
            prompt: `Write a direct message response. Be professional and concise.`,
        });
        return result.content;
    }
}
exports.TheContentGenerator = TheContentGenerator;
__decorate([
    (0, event_bus_1.traced)('content_generator.generate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof types_1.ContentGenerationRequest !== "undefined" && types_1.ContentGenerationRequest) === "function" ? _e : Object]),
    __metadata("design:returntype", Promise)
], TheContentGenerator.prototype, "generate", null);
// =============================================================================
// AGENT 16: THE FILE HANDLER
// =============================================================================
/**
 * THE FILE HANDLER
 * ----------------
 * Manages file uploads and downloads.
 * Handles image optimization and file validation.
 */
class TheFileHandler extends BaseExecutionAgent {
    constructor() {
        super('THE_FILE_HANDLER');
    }
    async upload(selector, filePath, options = {}) {
        await this.canExecute();
        const startTime = Date.now();
        this.publishEvent('agent.started', { action: 'upload', filePath });
        try {
            const result = await this.cdp.uploadFile(selector, filePath);
            if (options.waitForUpload) {
                // Wait for upload indicator to disappear
                await this.waitForUploadComplete(options.timeout ?? 30000);
            }
            this.recordSuccess();
            const uploadResult = {
                success: result.success,
                filePath,
                uploadedAt: Date.now(),
                durationMs: Date.now() - startTime,
            };
            this.publishEvent('agent.completed', uploadResult);
            return uploadResult;
        }
        catch (error) {
            this.recordFailure();
            return {
                success: false,
                filePath,
                uploadedAt: Date.now(),
                durationMs: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Upload failed',
            };
        }
    }
    async dragAndDropFile(dropZoneSelector, filePath) {
        await this.canExecute();
        try {
            // Simulate drag and drop via JavaScript
            await this.cdp.evaluate(`
        const dropZone = document.querySelector('${dropZoneSelector}');
        if (dropZone) {
          const dataTransfer = new DataTransfer();
          // Note: Actual file injection requires CDP Input.setFiles
          dropZone.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
        }
      `);
            this.recordSuccess();
            return true;
        }
        catch (error) {
            this.recordFailure();
            return false;
        }
    }
    async waitForUploadComplete(timeout) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            // Check for common upload indicators
            const uploading = await this.cdp.evaluate(`
        const indicators = document.querySelectorAll('.uploading, .upload-progress, [data-uploading="true"]');
        return indicators.length > 0;
      `);
            if (!uploading)
                return;
            await this.delay(500);
        }
    }
}
exports.TheFileHandler = TheFileHandler;
__decorate([
    (0, event_bus_1.traced)('file_handler.upload'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TheFileHandler.prototype, "upload", null);
__decorate([
    (0, event_bus_1.traced)('file_handler.drag_drop'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], TheFileHandler.prototype, "dragAndDropFile", null);
// =============================================================================
// FACTORY & EXPORTS
// =============================================================================
function createExecutionAgents(cdp) {
    const agents = {
        navigator: new TheNavigator(),
        clicker: new TheClicker(),
        typer: new TheTyper(),
        scroller: new TheScroller(),
        selector: new TheSelector(),
        formMaster: new TheFormMaster(),
        contentGenerator: new TheContentGenerator(),
        fileHandler: new TheFileHandler(),
    };
    // Inject CDP controller
    Object.values(agents).forEach((agent) => agent.setCDPController(cdp));
    return agents;
}
exports.createExecutionAgents = createExecutionAgents;
//# sourceMappingURL=tier2-execution.js.map