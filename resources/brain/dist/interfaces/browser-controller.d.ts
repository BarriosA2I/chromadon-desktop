/**
 * IBrowserController Interface
 *
 * Core abstraction for browser automation.
 * Implements low-level browser operations that other components build upon.
 */
/// <reference types="node" />
/// <reference types="node" />
import type { BoundingBox, ElementInfo, Position, Viewport } from './types';
/**
 * Browser controller interface for core automation operations.
 */
export interface IBrowserController {
    /**
     * Navigate to a URL.
     * @param url - Target URL
     * @param options - Navigation options
     */
    navigate(url: string, options?: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
        timeout?: number;
    }): Promise<void>;
    /**
     * Go back in history.
     */
    goBack(): Promise<void>;
    /**
     * Go forward in history.
     */
    goForward(): Promise<void>;
    /**
     * Reload the current page.
     * @param ignoreCache - Whether to ignore browser cache
     */
    reload(ignoreCache?: boolean): Promise<void>;
    /**
     * Get current URL.
     */
    getCurrentUrl(): Promise<string>;
    /**
     * Get page title.
     */
    getTitle(): Promise<string>;
    /**
     * Click on an element.
     * @param selector - Element selector
     * @param options - Click options
     */
    click(selector: string, options?: {
        button?: 'left' | 'right' | 'middle';
        clickCount?: number;
        delay?: number;
        force?: boolean;
        position?: Position;
    }): Promise<void>;
    /**
     * Double-click on an element.
     * @param selector - Element selector
     */
    dblClick(selector: string): Promise<void>;
    /**
     * Fill an input field.
     * @param selector - Input selector
     * @param value - Value to fill
     * @param options - Fill options
     */
    fill(selector: string, value: string, options?: {
        clearFirst?: boolean;
        delay?: number;
    }): Promise<void>;
    /**
     * Select option(s) from a select element.
     * @param selector - Select element selector
     * @param values - Value(s) to select
     */
    select(selector: string, values: string | string[]): Promise<void>;
    /**
     * Hover over an element.
     * @param selector - Element selector
     */
    hover(selector: string): Promise<void>;
    /**
     * Focus on an element.
     * @param selector - Element selector
     */
    focus(selector: string): Promise<void>;
    /**
     * Press a key or key combination.
     * @param key - Key to press (e.g., 'Enter', 'Control+A')
     */
    pressKey(key: string): Promise<void>;
    /**
     * Type text character by character.
     * @param text - Text to type
     * @param options - Typing options
     */
    type(text: string, options?: {
        delay?: number;
    }): Promise<void>;
    /**
     * Find an element by selector.
     * @param selector - Element selector
     * @returns Element info or null
     */
    findElement(selector: string): Promise<ElementInfo | null>;
    /**
     * Find all elements matching selector.
     * @param selector - Element selector
     * @returns Array of element info
     */
    findElements(selector: string): Promise<ElementInfo[]>;
    /**
     * Check if element exists.
     * @param selector - Element selector
     */
    elementExists(selector: string): Promise<boolean>;
    /**
     * Wait for element to appear.
     * @param selector - Element selector
     * @param options - Wait options
     */
    waitForElement(selector: string, options?: {
        state?: 'attached' | 'detached' | 'visible' | 'hidden';
        timeout?: number;
    }): Promise<ElementInfo>;
    /**
     * Get element bounding box.
     * @param selector - Element selector
     */
    getBoundingBox(selector: string): Promise<BoundingBox | null>;
    /**
     * Get element text content.
     * @param selector - Element selector
     */
    getTextContent(selector: string): Promise<string>;
    /**
     * Get element attribute.
     * @param selector - Element selector
     * @param attribute - Attribute name
     */
    getAttribute(selector: string, attribute: string): Promise<string | null>;
    /**
     * Scroll to position.
     * @param position - Target position
     */
    scrollTo(position: Position): Promise<void>;
    /**
     * Scroll element into view.
     * @param selector - Element selector
     */
    scrollIntoView(selector: string): Promise<void>;
    /**
     * Scroll by delta.
     * @param delta - Scroll delta
     */
    scrollBy(delta: {
        x: number;
        y: number;
    }): Promise<void>;
    /**
     * Take a screenshot.
     * @param options - Screenshot options
     */
    screenshot(options?: {
        fullPage?: boolean;
        selector?: string;
        format?: 'png' | 'jpeg' | 'webp';
        quality?: number;
    }): Promise<Buffer>;
    /**
     * Get current viewport.
     */
    getViewport(): Promise<Viewport>;
    /**
     * Set viewport size.
     * @param viewport - New viewport
     */
    setViewport(viewport: Partial<Viewport>): Promise<void>;
    /**
     * Evaluate JavaScript in page context.
     * @param script - JavaScript code or function
     * @param args - Arguments to pass
     */
    evaluate<R, A extends unknown[]>(script: string | ((...args: A) => R), ...args: A): Promise<R>;
    /**
     * Evaluate JavaScript on element.
     * @param selector - Element selector
     * @param script - JavaScript code
     */
    evaluateOnElement<R>(selector: string, script: string | ((el: unknown) => R)): Promise<R>;
    /**
     * Handle browser dialog.
     * @param action - Accept or dismiss
     * @param promptText - Text for prompt dialogs
     */
    handleDialog(action: 'accept' | 'dismiss', promptText?: string): Promise<void>;
    /**
     * Switch to frame.
     * @param selector - Frame selector or index
     */
    switchToFrame(selector: string | number): Promise<void>;
    /**
     * Switch to main frame.
     */
    switchToMainFrame(): Promise<void>;
    /**
     * Get cookies.
     * @param urls - URLs to get cookies for
     */
    getCookies(urls?: string[]): Promise<Record<string, string>>;
    /**
     * Set cookies.
     * @param cookies - Cookies to set
     */
    setCookies(cookies: Array<{
        name: string;
        value: string;
        domain?: string;
        path?: string;
        expires?: number;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
    }>): Promise<void>;
    /**
     * Clear cookies.
     */
    clearCookies(): Promise<void>;
    /**
     * Get local storage.
     */
    getLocalStorage(): Promise<Record<string, string>>;
    /**
     * Set local storage.
     * @param items - Items to set
     */
    setLocalStorage(items: Record<string, string>): Promise<void>;
    /**
     * Check if browser is connected.
     */
    isConnected(): boolean;
    /**
     * Close the browser.
     */
    close(): Promise<void>;
}
/**
 * Factory function type for creating browser controllers.
 */
export type BrowserControllerFactory = (options?: {
    headless?: boolean;
    viewport?: Viewport;
    timeout?: number;
}) => Promise<IBrowserController>;
//# sourceMappingURL=browser-controller.d.ts.map