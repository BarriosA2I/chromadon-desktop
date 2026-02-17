"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopBrowserAdapter = void 0;
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('browser');
class DesktopBrowserAdapter {
    baseUrl;
    activeTabId = null;
    constructor(baseUrl = 'http://127.0.0.1:3002') {
        this.baseUrl = baseUrl;
    }
    /**
     * Health check - verify Desktop is running
     */
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    /**
     * List all open browser tabs
     */
    async listTabs() {
        const response = await fetch(`${this.baseUrl}/tabs`);
        const data = await response.json();
        return data.tabs;
    }
    /**
     * Switch to a specific tab by ID
     */
    async switchTab(tabId) {
        await fetch(`${this.baseUrl}/tabs/focus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId }),
        });
        this.activeTabId = tabId;
    }
    /**
     * Find a tab whose URL contains the given domain
     */
    async findTabByDomain(domain) {
        const tabs = await this.listTabs();
        return tabs.find(t => t.url.includes(domain)) || null;
    }
    /**
     * Get all platform sessions from Desktop (authenticated social media accounts)
     */
    async getPlatformSessions() {
        try {
            const response = await fetch(`${this.baseUrl}/sessions`);
            const data = await response.json();
            return data.sessions || [];
        }
        catch {
            return [];
        }
    }
    /**
     * Get or create active tab ID
     */
    async getActiveTabId() {
        if (this.activeTabId !== null) {
            return this.activeTabId;
        }
        const response = await fetch(`${this.baseUrl}/tabs`);
        const data = await response.json();
        if (data.tabs.length > 0 && data.activeTabId !== undefined) {
            this.activeTabId = data.activeTabId;
            return data.activeTabId;
        }
        // Create new tab if none exists
        const createResponse = await fetch(`${this.baseUrl}/tabs/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'about:blank' }),
        });
        const createData = await createResponse.json();
        this.activeTabId = createData.id;
        return createData.id;
    }
    /**
     * Execute JavaScript in BrowserView and return result
     */
    async execute(script) {
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, script }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Execute failed');
        }
        return data.result;
    }
    /**
     * Get element center coordinates from selector
     */
    async getElementCoordinates(selector) {
        const escapedSelector = selector.replace(/'/g, "\\'");
        const result = await this.execute(`
      (function() {
        const el = document.querySelector('${escapedSelector}');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      })()
    `);
        if (!result) {
            throw new Error(`Element not found: ${selector}`);
        }
        return result;
    }
    // ==================== CDPController Interface Implementation ====================
    async navigate(url) {
        const start = Date.now();
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, url }),
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Navigation failed');
        }
        // Wait for page load
        await this.sleep(1000);
        const finalUrl = await this.execute('window.location.href');
        return {
            success: true,
            finalUrl,
            loadTime: Date.now() - start,
        };
    }
    async click(selector, options) {
        const timeout = options?.timeout || 10000;
        // Wait for element to exist
        const found = await this.waitForSelector(selector, timeout);
        if (!found) {
            throw new Error(`Element not found within timeout: ${selector}`);
        }
        // Get element coordinates
        const coords = await this.getElementCoordinates(selector);
        // Scroll element into view first
        await this.scrollToElement(selector);
        await this.sleep(100);
        // Re-get coordinates after scroll
        const finalCoords = await this.getElementCoordinates(selector);
        // Native click
        return this.clickCoordinates(finalCoords.x, finalCoords.y);
    }
    async clickCoordinates(x, y) {
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/click/${tabId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: Math.round(x), y: Math.round(y) }),
        });
        const data = await response.json();
        return { success: data.success };
    }
    async type(selector, text, options) {
        const tabId = await this.getActiveTabId();
        // Click to focus element first
        await this.click(selector);
        await this.sleep(100);
        // Clear if requested
        if (options?.clear) {
            await this.execute(`document.querySelector('${selector.replace(/'/g, "\\'")}').value = ''`);
        }
        // Type each character with delay
        const delay = options?.delay || 50;
        for (const char of text) {
            await fetch(`${this.baseUrl}/tabs/type/${tabId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: char }),
            });
            if (delay > 0) {
                await this.sleep(delay);
            }
        }
        return { success: true };
    }
    async typeKeys(keys) {
        const tabId = await this.getActiveTabId();
        for (const key of keys) {
            await fetch(`${this.baseUrl}/tabs/key/${tabId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key }),
            });
            await this.sleep(50);
        }
        return { success: true };
    }
    async scroll(options) {
        const deltaX = options.direction === 'left' ? -options.amount : options.direction === 'right' ? options.amount : 0;
        const deltaY = options.direction === 'up' ? -options.amount : options.direction === 'down' ? options.amount : 0;
        await this.execute(`window.scrollBy(${deltaX}, ${deltaY})`);
    }
    async scrollToElement(selector) {
        const escapedSelector = selector.replace(/'/g, "\\'");
        await this.execute(`
      (function() {
        const el = document.querySelector('${escapedSelector}');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })()
    `);
        return { success: true };
    }
    async scrollToCoordinates(x, y) {
        await this.execute(`window.scrollTo(${x}, ${y})`);
    }
    async select(selector, value) {
        const escapedSelector = selector.replace(/'/g, "\\'");
        await this.execute(`
      (function() {
        const el = document.querySelector('${escapedSelector}');
        if (el) {
          el.value = '${value.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
        return { success: true };
    }
    async selectMultiple(selector, values) {
        const escapedSelector = selector.replace(/'/g, "\\'");
        const valuesJson = JSON.stringify(values);
        await this.execute(`
      (function() {
        const el = document.querySelector('${escapedSelector}');
        if (el && el.options) {
          const values = ${valuesJson};
          for (const option of el.options) {
            option.selected = values.includes(option.value);
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
        return { success: true };
    }
    async uploadFile(selector, filePath) {
        // File upload requires special handling - not fully supported via REST
        log.warn('[DesktopBrowserAdapter] uploadFile not fully implemented - requires IPC');
        return { success: false };
    }
    async screenshot() {
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/screenshot/${tabId}`);
        if (!response.ok) {
            throw new Error('Screenshot failed');
        }
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }
    async getHTML() {
        return this.execute('document.documentElement.outerHTML');
    }
    async evaluate(script) {
        return this.execute(script);
    }
    async waitForSelector(selector, timeout) {
        const maxWait = timeout || 10000;
        const interval = 200;
        const startTime = Date.now();
        const escapedSelector = selector.replace(/'/g, "\\'");
        while (Date.now() - startTime < maxWait) {
            const exists = await this.execute(`!!document.querySelector('${escapedSelector}')`);
            if (exists) {
                return true;
            }
            await this.sleep(interval);
        }
        return false;
    }
    async waitForNavigation(timeout) {
        const maxWait = timeout || 30000;
        const startUrl = await this.execute('window.location.href');
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
            await this.sleep(500);
            const currentUrl = await this.execute('window.location.href');
            if (currentUrl !== startUrl) {
                // Wait a bit more for page to settle
                await this.sleep(500);
                return true;
            }
        }
        return false;
    }
    async goBack() {
        await this.execute('history.back()');
        await this.sleep(500);
    }
    async goForward() {
        await this.execute('history.forward()');
        await this.sleep(500);
    }
    async refresh() {
        await this.execute('location.reload()');
        await this.sleep(1000);
    }
    async send(method, params) {
        // CDP protocol compatibility layer
        switch (method) {
            case 'Runtime.evaluate': {
                const { expression } = params || {};
                try {
                    const result = await this.execute(expression);
                    return { result: { value: result } };
                }
                catch (error) {
                    return { result: { value: null }, error: error.message };
                }
            }
            case 'Page.navigate': {
                await this.navigate(params.url);
                return { frameId: 'main' };
            }
            case 'DOM.getDocument': {
                const html = await this.getHTML();
                return { root: { nodeId: 1, outerHTML: html } };
            }
            case 'Page.captureScreenshot': {
                const data = await this.screenshot();
                return { data };
            }
            default:
                log.warn(`[DesktopBrowserAdapter] Unhandled CDP method: ${method}`);
                return { error: `Unsupported CDP method: ${method}` };
        }
    }
    // ==================== Utility Methods ====================
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.DesktopBrowserAdapter = DesktopBrowserAdapter;
exports.default = DesktopBrowserAdapter;
//# sourceMappingURL=desktop-browser-adapter.js.map