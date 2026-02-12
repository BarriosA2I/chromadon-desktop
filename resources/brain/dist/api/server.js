"use strict";
/**
 * CHROMADON HTTP API Server v4.0.0 - CDP ENABLED
 *
 * Connects to EXISTING Chrome via CDP to preserve login sessions (Vercel, GitHub, Render, etc.)
 * Falls back to launching fresh Chromium if CDP connection fails.
 *
 * START CHROME WITH: chrome.exe --remote-debugging-port=9222
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.startServer = void 0;
// Load environment variables from .env file, then override with .env.local (never shipped)
const dotenv = __importStar(require("dotenv"));
dotenv.config();
dotenv.config({ path: '.env.local', override: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
// Neural RAG Brain v3.0 imports
const core_1 = require("../core");
// Agentic Orchestrator imports
const agentic_orchestrator_1 = require("../core/agentic-orchestrator");
const browser_tools_1 = require("../core/browser-tools");
const social_overlord_1 = require("../core/social-overlord");
// Analytics imports
const database_1 = require("../analytics/database");
const analytics_tools_1 = require("../analytics/analytics-tools");
const analytics_executor_1 = require("../analytics/analytics-executor");
const data_collector_1 = require("../analytics/data-collector");
// YouTube imports
const youtube_token_manager_1 = require("../youtube/youtube-token-manager");
const youtube_tools_1 = require("../youtube/youtube-tools");
const youtube_executor_1 = require("../youtube/youtube-executor");
// 27-Agent System imports (runtime load to avoid type conflicts)
// @ts-ignore - Agent types handled at runtime
const agentModule = require('../../dist/agents/index.js');
const ChromadonAgentSystem = agentModule.ChromadonAgentSystem;
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.CHROMADON_PORT || 3001;
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const CHROMADON_DESKTOP_URL = process.env.CHROMADON_DESKTOP_URL || 'http://127.0.0.1:3002';
const PREFER_DESKTOP = process.env.PREFER_DESKTOP !== 'false'; // Default true - route through Desktop when available
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
// Serve static files from public directory
app.use(express_1.default.static(path.join(__dirname, '../../public')));
// Serve UI at /ui
app.get('/ui', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../public/ui.html'));
});
// GLOBAL STATE
let globalBrowser = null;
let globalContext = null;
let globalPages = [];
let selectedPageIndex = 0;
let serverStartTime = Date.now();
let connectionMode = 'FRESH';
let consoleMessages = [];
// Neural RAG Brain v3.0 State
let aiEngine = null;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Agentic Orchestrator State
let orchestrator = null;
let socialOverlord = null;
// 27-Agent System State
let agentSystem = null;
// Analytics State
let analyticsDb = null;
let dataCollector = null;
// YouTube State
let youtubeTokenManager = null;
// Page registry for tab reuse by domain
const pageRegistry = new Map(); // domain -> pageIndex
// Abort controller tracking for stop functionality
const activeAbortControllers = new Map();
// Desktop routing state
let desktopAvailable = false;
let desktopTabIds = []; // Maps index -> Desktop tab ID
let desktopActiveTabId = null;
/**
 * Check if Desktop control server is available (with retries)
 */
async function checkDesktopHealth() {
    if (!PREFER_DESKTOP)
        return false;
    const maxRetries = 5;
    const retryDelayMs = 2000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(`${CHROMADON_DESKTOP_URL}/health`, { signal: AbortSignal.timeout(2000) });
            const data = await response.json();
            desktopAvailable = data.status === 'healthy' && data.windowReady === true;
            if (desktopAvailable) {
                console.log('[CHROMADON] ✅ Desktop routing ACTIVE (port 3002)');
                return true;
            }
            console.log(`[CHROMADON] Desktop health check attempt ${attempt}/${maxRetries}: windowReady=${data.windowReady}`);
        }
        catch {
            console.log(`[CHROMADON] Desktop health check attempt ${attempt}/${maxRetries}: connection failed`);
        }
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }
    desktopAvailable = false;
    console.log(`[CHROMADON] ⚠️ Desktop not available after ${maxRetries} attempts`);
    return false;
}
/**
 * Detect social media platform from URL for session partition routing
 */
function detectPlatformFromUrl(url) {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('twitter.com') || hostname.includes('x.com'))
            return 'twitter';
        if (hostname.includes('linkedin.com'))
            return 'linkedin';
        if (hostname.includes('facebook.com') || hostname.includes('fb.com'))
            return 'facebook';
        if (hostname.includes('instagram.com'))
            return 'instagram';
        if (hostname.includes('youtube.com'))
            return 'youtube';
        if (hostname.includes('tiktok.com'))
            return 'tiktok';
        if (hostname.includes('google.com') || hostname.includes('gmail.com'))
            return 'google';
        return null;
    }
    catch {
        return null;
    }
}
/**
 * Create a tab in Desktop (with platform auth if applicable)
 */
async function desktopCreateTab(url) {
    const platform = url ? detectPlatformFromUrl(url) : null;
    const endpoint = platform ? '/tabs/platform' : '/tabs/create';
    const body = platform ? { url, platform } : { url };
    const response = await fetch(`${CHROMADON_DESKTOP_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to create Desktop tab');
    desktopActiveTabId = data.id;
    return { id: data.id, url: url || 'about:blank', title: '' };
}
/**
 * List all tabs from Desktop
 */
async function desktopListTabs() {
    const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs`);
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to list Desktop tabs');
    desktopTabIds = (data.tabs || []).map((t) => t.id);
    desktopActiveTabId = data.activeTabId ?? null;
    return data.tabs || [];
}
/**
 * Focus a tab in Desktop by index (maps to tab ID)
 */
async function desktopFocusTab(tabId) {
    const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/focus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to focus Desktop tab');
    desktopActiveTabId = tabId;
}
/**
 * Close a tab in Desktop
 */
async function desktopCloseTab(tabId) {
    const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to close Desktop tab');
}
/**
 * Execute script in Desktop tab
 */
async function desktopExecuteScript(tabId, script) {
    const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, script }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Script execution failed');
    return data.result;
}
/**
 * Get screenshot from Desktop tab
 */
async function desktopScreenshot(tabId) {
    const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/screenshot/${tabId}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
}
/**
 * Connect to existing Chrome via CDP (preserves login sessions!)
 */
async function connectViaCDP() {
    try {
        console.log(`[CHROMADON] Attempting CDP connection to ${CDP_ENDPOINT}...`);
        const { chromium } = await import('playwright');
        globalBrowser = await chromium.connectOverCDP(CDP_ENDPOINT);
        connectionMode = 'CDP';
        // Get existing contexts and pages
        const contexts = globalBrowser.contexts();
        if (contexts.length > 0) {
            globalContext = contexts[0] || null;
            if (globalContext) {
                globalPages = globalContext.pages();
                if (globalPages.length === 0) {
                    const newPage = await globalContext.newPage();
                    globalPages.push(newPage);
                }
            }
        }
        if (!globalContext) {
            // Create new context if none exist
            globalContext = await globalBrowser.newContext();
            const newPage = await globalContext.newPage();
            globalPages.push(newPage);
        }
        // Set up console message listener for all pages
        for (const page of globalPages) {
            setupPageListeners(page, globalPages.indexOf(page));
        }
        console.log(`[CHROMADON] ✅ CDP connection established!`);
        console.log(`[CHROMADON] ✅ Found ${globalPages.length} existing page(s)`);
        console.log(`[CHROMADON] ✅ Login sessions PRESERVED (Vercel, GitHub, etc.)`);
        return true;
    }
    catch (error) {
        console.log(`[CHROMADON] ⚠️ CDP connection failed: ${error.message}`);
        return false;
    }
}
/**
 * Launch fresh Chromium (fallback if CDP fails)
 */
async function launchFreshBrowser() {
    console.log(`[CHROMADON] Launching fresh Chromium browser...`);
    const { chromium } = await import('playwright');
    globalBrowser = await chromium.launch({
        headless: false,
        slowMo: 300,
        args: [
            '--window-position=100,100',
            '--window-size=1500,1000',
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
        ],
    });
    connectionMode = 'FRESH';
    globalContext = await globalBrowser.newContext({
        viewport: { width: 1400, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await globalContext.newPage();
    globalPages = [page];
    setupPageListeners(page, 0);
    // Show welcome screen
    await page.goto('about:blank');
    await page.setContent(`
    <html>
      <head><title>CHROMADON Ready</title></head>
      <body style="background: #0a0a0f; color: #00ced1; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center;">
          <h1 style="font-size: 48px; margin-bottom: 20px;">🤖 CHROMADON v4.0</h1>
          <p style="font-size: 24px; color: #f59e0b;">Mode: FRESH BROWSER</p>
          <p style="font-size: 18px; color: #888;">CDP not available - using standalone Chromium</p>
          <p style="font-size: 16px; color: #555;">To preserve logins, start Chrome with: --remote-debugging-port=9222</p>
        </div>
      </body>
    </html>
  `);
    console.log(`[CHROMADON] ✅ Fresh browser launched`);
}
/**
 * Set up listeners on a page
 */
function setupPageListeners(page, pageIndex) {
    page.on('console', (msg) => {
        consoleMessages.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString(),
            pageIndex,
        });
        // Keep only last 1000 messages
        if (consoleMessages.length > 1000) {
            consoleMessages = consoleMessages.slice(-1000);
        }
    });
    page.on('close', () => {
        const idx = globalPages.indexOf(page);
        if (idx > -1) {
            globalPages.splice(idx, 1);
            if (selectedPageIndex >= globalPages.length) {
                selectedPageIndex = Math.max(0, globalPages.length - 1);
            }
            // Clean up pageRegistry entries that pointed to this or higher indices
            for (const [domain, pageIdx] of pageRegistry.entries()) {
                if (pageIdx === idx) {
                    pageRegistry.delete(domain);
                }
                else if (pageIdx > idx) {
                    // Shift down indices above the removed page
                    pageRegistry.set(domain, pageIdx - 1);
                }
            }
        }
    });
}
/**
 * Initialize browser connection
 */
async function initializeBrowser() {
    // In DESKTOP mode, skip all browser launching - Desktop app IS the browser
    if (desktopAvailable) {
        console.log('[CHROMADON] DESKTOP mode - skipping browser launch (using Desktop BrowserViews via port 3002)');
        connectionMode = 'CDP'; // Report as CDP for compatibility, but no browser launched
        return;
    }
    // When PREFER_DESKTOP is true, NEVER launch external browsers
    // The user will start the Desktop app and restart Brain API
    if (PREFER_DESKTOP) {
        console.log('[CHROMADON] ⚠️ PREFER_DESKTOP=true but Desktop not available. Waiting for Desktop app...');
        console.log('[CHROMADON] ⚠️ No external browser will be launched. Start the Desktop app and restart Brain API.');
        connectionMode = 'CDP'; // Set for compatibility
        return;
    }
    // Only launch external browsers when PREFER_DESKTOP is explicitly false
    const cdpSuccess = await connectViaCDP();
    if (!cdpSuccess) {
        await launchFreshBrowser();
    }
}
/**
 * Get or reuse an existing page by domain
 * Prevents opening new windows for the same domain
 */
async function getOrReusePage(targetUrl) {
    // If we have a target URL, check for existing page with same domain
    if (targetUrl) {
        try {
            const targetDomain = new URL(targetUrl).hostname;
            // Check registry for existing page
            if (pageRegistry.has(targetDomain)) {
                const pageIndex = pageRegistry.get(targetDomain);
                const existingPage = globalPages[pageIndex];
                if (existingPage && !existingPage.isClosed()) {
                    console.log(`[CHROMADON] Reusing existing page for ${targetDomain} (index ${pageIndex})`);
                    selectedPageIndex = pageIndex;
                    return existingPage;
                }
            }
            // Check all pages for matching domain
            for (let i = 0; i < globalPages.length; i++) {
                const page = globalPages[i];
                if (page && !page.isClosed()) {
                    const pageUrl = page.url();
                    if (pageUrl.includes(targetDomain)) {
                        console.log(`[CHROMADON] Found existing page for ${targetDomain} at index ${i}`);
                        pageRegistry.set(targetDomain, i);
                        selectedPageIndex = i;
                        return page;
                    }
                }
            }
        }
        catch (e) {
            // Invalid URL, fall through to create new
        }
    }
    // No reusable page found, create new
    console.log(`[CHROMADON] Creating new page for ${targetUrl || 'blank'}`);
    const page = await globalContext.newPage();
    globalPages.push(page);
    const newIndex = globalPages.length - 1;
    setupPageListeners(page, newIndex);
    selectedPageIndex = newIndex;
    if (targetUrl) {
        try {
            const domain = new URL(targetUrl).hostname;
            pageRegistry.set(domain, newIndex);
        }
        catch (e) { }
    }
    return page;
}
/**
 * Get the currently selected page
 */
async function getSelectedPage() {
    // In DESKTOP mode, never launch a browser - all operations go through port 3002
    if (desktopAvailable) {
        throw new Error('No Playwright page in DESKTOP mode - use Desktop BrowserView tools instead');
    }
    if (!globalBrowser?.isConnected()) {
        console.log(`[CHROMADON] Browser disconnected, attempting graceful reconnect...`);
        // Try CDP reconnect first (don't launch new browser)
        const reconnected = await connectViaCDP();
        if (!reconnected) {
            console.log(`[CHROMADON] CDP reconnect failed, will use existing pages if available`);
            // NEVER launch fresh browser when PREFER_DESKTOP is true
            if (!globalContext && !PREFER_DESKTOP) {
                await launchFreshBrowser();
            }
            else if (!globalContext && PREFER_DESKTOP) {
                throw new Error('No browser available - PREFER_DESKTOP is true, start Desktop app and restart Brain API');
            }
        }
    }
    if (globalPages.length === 0) {
        const page = await globalContext.newPage();
        globalPages.push(page);
        setupPageListeners(page, 0);
    }
    if (selectedPageIndex >= globalPages.length) {
        selectedPageIndex = Math.max(0, globalPages.length - 1);
    }
    const page = globalPages[selectedPageIndex];
    if (!page) {
        throw new Error('No page available');
    }
    try {
        await page.bringToFront();
    }
    catch (e) {
        // Ignore if can't bring to front
    }
    return page;
}
/**
 * Generate DOM snapshot with UIDs
 */
async function getDOMSnapshot(page) {
    const snapshot = await page.evaluate(() => {
        let counter = 0;
        function getElementInfo(el, depth = 0) {
            const uid = `e${counter++}`;
            el.setAttribute('data-chromadon-uid', uid);
            const indent = '  '.repeat(depth);
            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const classes = el.className && typeof el.className === 'string'
                ? `.${el.className.split(' ').filter(c => c).join('.')}`
                : '';
            const text = el.textContent?.trim().slice(0, 50) || '';
            const textPreview = text ? ` "${text}${text.length >= 50 ? '...' : ''}"` : '';
            // Get relevant attributes
            const attrs = [];
            if (el.getAttribute('href'))
                attrs.push(`href="${el.getAttribute('href')?.slice(0, 50)}"`);
            if (el.getAttribute('src'))
                attrs.push(`src="${el.getAttribute('src')?.slice(0, 50)}"`);
            if (el.getAttribute('name'))
                attrs.push(`name="${el.getAttribute('name')}"`);
            if (el.getAttribute('type'))
                attrs.push(`type="${el.getAttribute('type')}"`);
            if (el.getAttribute('value'))
                attrs.push(`value="${el.getAttribute('value')?.slice(0, 30)}"`);
            if (el.getAttribute('placeholder'))
                attrs.push(`placeholder="${el.getAttribute('placeholder')}"`);
            if (el.getAttribute('aria-label'))
                attrs.push(`aria-label="${el.getAttribute('aria-label')}"`);
            if (el.getAttribute('role'))
                attrs.push(`role="${el.getAttribute('role')}"`);
            const attrStr = attrs.length > 0 ? ` [${attrs.join(', ')}]` : '';
            let result = `${indent}[${uid}] <${tag}${id}${classes}>${attrStr}${textPreview}\n`;
            // Only recurse into visible, interactive elements
            const skipTags = ['script', 'style', 'noscript', 'svg', 'path', 'meta', 'link'];
            if (!skipTags.includes(tag)) {
                for (const child of Array.from(el.children)) {
                    if (depth < 10) { // Max depth
                        result += getElementInfo(child, depth + 1);
                    }
                }
            }
            return result;
        }
        return getElementInfo(document.body);
    });
    return snapshot;
}
// Error handler middleware
function errorHandler(err, _req, res, _next) {
    console.error('[CHROMADON] Error:', err);
    res.status(500).json({
        success: false,
        error: err.message,
        timestamp: new Date().toISOString(),
    });
}
// ==================== HEALTH & STATUS ====================
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'chromadon-brain',
        version: '4.0.0',
        mode: desktopAvailable ? 'DESKTOP' : connectionMode,
        cdpEndpoint: CDP_ENDPOINT,
        desktopUrl: desktopAvailable ? CHROMADON_DESKTOP_URL : undefined,
        desktopRouting: desktopAvailable,
        browserConnected: desktopAvailable || (globalBrowser?.isConnected() ?? false),
        pageCount: desktopAvailable ? desktopTabIds.length : globalPages.length,
        selectedPage: desktopAvailable ? (desktopActiveTabId ?? 0) : selectedPageIndex,
        orchestrator: !!orchestrator,
        orchestratorSessions: orchestrator?.getSessionCount() ?? 0,
        analytics: !!analyticsDb,
        uptime: Math.round((Date.now() - serverStartTime) / 1000),
        timestamp: new Date().toISOString(),
    });
});
// ==================== PAGE MANAGEMENT ====================
// List all pages
app.get('/api/pages', async (_req, res) => {
    try {
        // Desktop routing
        if (desktopAvailable) {
            const tabs = await desktopListTabs();
            const pages = tabs.map((tab, idx) => ({
                index: idx,
                selected: tab.isActive,
                url: tab.url,
                title: tab.title,
                desktopTabId: tab.id,
            }));
            const selectedIdx = pages.findIndex(p => p.selected);
            res.json({
                success: true,
                data: {
                    pages,
                    selectedIndex: selectedIdx >= 0 ? selectedIdx : 0,
                    count: pages.length,
                    mode: 'desktop',
                },
            });
            return;
        }
        // CDP fallback
        const pages = await Promise.all(globalPages.map(async (page, idx) => ({
            index: idx,
            selected: idx === selectedPageIndex,
            url: page.url(),
            title: await page.title(),
        })));
        res.json({
            success: true,
            data: {
                pages,
                selectedIndex: selectedPageIndex,
                count: pages.length,
                mode: connectionMode.toLowerCase(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Select a page
app.post('/api/pages/select', async (req, res) => {
    try {
        const { pageIndex } = req.body;
        // Desktop routing
        if (desktopAvailable) {
            const tabs = await desktopListTabs();
            if (pageIndex < 0 || pageIndex >= tabs.length) {
                res.status(400).json({ success: false, error: `Invalid page index. Valid range: 0-${tabs.length - 1}` });
                return;
            }
            const tab = tabs[pageIndex];
            await desktopFocusTab(tab.id);
            res.json({
                success: true,
                data: {
                    selectedIndex: pageIndex,
                    url: tab.url,
                    title: tab.title,
                    desktopTabId: tab.id,
                },
            });
            return;
        }
        // CDP fallback
        if (pageIndex < 0 || pageIndex >= globalPages.length) {
            res.status(400).json({ success: false, error: `Invalid page index. Valid range: 0-${globalPages.length - 1}` });
            return;
        }
        selectedPageIndex = pageIndex;
        const page = globalPages[selectedPageIndex];
        if (!page) {
            res.status(400).json({ success: false, error: 'Page not found' });
            return;
        }
        await page.bringToFront();
        res.json({
            success: true,
            data: {
                selectedIndex: selectedPageIndex,
                url: page.url(),
                title: await page.title(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Create new page (or reuse existing by domain)
app.post('/api/pages/new', async (req, res) => {
    try {
        const { url } = req.body;
        // Desktop routing - creates BrowserView with authenticated session partition
        if (desktopAvailable) {
            const platform = url ? detectPlatformFromUrl(url) : null;
            console.log(`[CHROMADON] 🖥️ Creating Desktop tab: ${url || 'blank'}${platform ? ` (platform: ${platform})` : ''}`);
            const tab = await desktopCreateTab(url || 'about:blank');
            // Refresh tab list to get accurate index
            const tabs = await desktopListTabs();
            const tabIndex = tabs.findIndex(t => t.id === tab.id);
            res.json({
                success: true,
                data: {
                    pageIndex: tabIndex >= 0 ? tabIndex : tabs.length - 1,
                    url: url || 'about:blank',
                    title: tab.title || '',
                    totalPages: tabs.length,
                    desktopTabId: tab.id,
                    mode: 'desktop',
                    platform: platform || undefined,
                },
            });
            return;
        }
        // CDP fallback - use getOrReusePage to reuse existing tabs when possible
        const page = await getOrReusePage(url);
        if (url) {
            // Only navigate if not already on this URL
            const currentUrl = page.url();
            if (!currentUrl.includes(new URL(url).hostname)) {
                await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            }
        }
        res.json({
            success: true,
            data: {
                pageIndex: selectedPageIndex,
                url: page.url(),
                title: await page.title(),
                totalPages: globalPages.length,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Close a page
app.post('/api/pages/close', async (req, res) => {
    try {
        const { pageIndex } = req.body;
        // Desktop routing
        if (desktopAvailable) {
            const tabs = await desktopListTabs();
            const idx = pageIndex ?? tabs.findIndex(t => t.isActive);
            if (tabs.length <= 1) {
                res.status(400).json({ success: false, error: 'Cannot close the last page' });
                return;
            }
            if (idx < 0 || idx >= tabs.length) {
                res.status(400).json({ success: false, error: 'Invalid page index' });
                return;
            }
            await desktopCloseTab(tabs[idx].id);
            const remainingTabs = await desktopListTabs();
            res.json({
                success: true,
                data: {
                    closedIndex: idx,
                    remainingPages: remainingTabs.length,
                    selectedIndex: remainingTabs.findIndex(t => t.isActive),
                },
            });
            return;
        }
        // CDP fallback
        const idx = pageIndex ?? selectedPageIndex;
        if (globalPages.length <= 1) {
            res.status(400).json({ success: false, error: 'Cannot close the last page' });
            return;
        }
        if (idx < 0 || idx >= globalPages.length) {
            res.status(400).json({ success: false, error: 'Invalid page index' });
            return;
        }
        const page = globalPages[idx];
        if (!page) {
            res.status(400).json({ success: false, error: 'Page not found' });
            return;
        }
        await page.close();
        res.json({
            success: true,
            data: {
                closedIndex: idx,
                remainingPages: globalPages.length,
                selectedIndex: selectedPageIndex,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== NAVIGATION ====================
app.post('/api/navigate', async (req, res) => {
    try {
        const { url, type, waitFor, timeout } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 🌐 Navigation: ${type || 'url'} ${url || ''}`);
        const navTimeout = timeout || 30000;
        if (type === 'back') {
            await page.goBack({ timeout: navTimeout });
        }
        else if (type === 'forward') {
            await page.goForward({ timeout: navTimeout });
        }
        else if (type === 'reload') {
            await page.reload({ timeout: navTimeout });
        }
        else {
            if (!url) {
                res.status(400).json({ success: false, error: 'URL is required for url navigation' });
                return;
            }
            await page.goto(url, {
                waitUntil: waitFor === 'domcontentloaded' ? 'domcontentloaded' : 'load',
                timeout: navTimeout,
            });
        }
        res.json({
            success: true,
            data: {
                url: page.url(),
                title: await page.title(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== INTERACTIONS ====================
// Click element (by selector or UID)
app.post('/api/click', async (req, res) => {
    try {
        const { selector, uid, dblClick, description } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        console.log(`[CHROMADON] 👆 Click: ${targetSelector} ${description ? `(${description})` : ''}`);
        if (dblClick) {
            await page.dblclick(targetSelector, { timeout: 10000 });
        }
        else {
            await page.click(targetSelector, { timeout: 10000 });
        }
        res.json({
            success: true,
            data: {
                clicked: true,
                selector: targetSelector,
                dblClick: dblClick || false,
                currentUrl: page.url(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Hover over element
app.post('/api/hover', async (req, res) => {
    try {
        const { selector, uid } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        console.log(`[CHROMADON] 🖱️ Hover: ${targetSelector}`);
        await page.hover(targetSelector, { timeout: 10000 });
        res.json({
            success: true,
            data: {
                hovered: true,
                selector: targetSelector,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Fill form field
app.post('/api/fill', async (req, res) => {
    try {
        const { selector, uid, value, clearFirst } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || value === undefined) {
            res.status(400).json({ success: false, error: 'Selector/UID and value are required' });
            return;
        }
        console.log(`[CHROMADON] ✏️ Fill: ${targetSelector}`);
        // Check if target is contenteditable (Facebook, etc.)
        const isContentEditable = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el)
                return false;
            return el.getAttribute('contenteditable') === 'true' ||
                el.getAttribute('role') === 'textbox' ||
                el.closest('[contenteditable="true"]') !== null;
        }, targetSelector);
        if (isContentEditable) {
            // Contenteditable-safe approach using execCommand
            console.log(`[CHROMADON] ✏️ Using contenteditable-safe fill`);
            await page.click(targetSelector, { timeout: 10000 });
            await page.evaluate((text) => {
                document.execCommand('selectAll', false);
                document.execCommand('insertText', false, text);
            }, value);
        }
        else {
            // Original approach for regular inputs
            if (clearFirst !== false) {
                await page.fill(targetSelector, '');
            }
            await page.fill(targetSelector, value, { timeout: 10000 });
        }
        res.json({
            success: true,
            data: {
                filled: true,
                selector: targetSelector,
                valueLength: value.length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Fill multiple form elements at once
app.post('/api/fill-form', async (req, res) => {
    try {
        const { elements } = req.body;
        const page = await getSelectedPage();
        if (!elements || !Array.isArray(elements)) {
            res.status(400).json({ success: false, error: 'Elements array is required' });
            return;
        }
        console.log(`[CHROMADON] 📝 Filling ${elements.length} form fields`);
        const results = [];
        for (const el of elements) {
            const targetSelector = el.uid ? `[data-chromadon-uid="${el.uid}"]` : el.selector;
            try {
                await page.fill(targetSelector, el.value, { timeout: 5000 });
                results.push({ selector: targetSelector, success: true });
            }
            catch (e) {
                results.push({ selector: targetSelector, success: false, error: e.message });
            }
        }
        res.json({
            success: true,
            data: {
                results,
                successCount: results.filter(r => r.success).length,
                failedCount: results.filter(r => !r.success).length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Type text (keystroke by keystroke)
app.post('/api/type', async (req, res) => {
    try {
        const { selector, uid, text, delay } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || text === undefined) {
            res.status(400).json({ success: false, error: 'Selector/UID and text are required' });
            return;
        }
        console.log(`[CHROMADON] ⌨️ Type: ${targetSelector}`);
        await page.click(targetSelector, { timeout: 10000 });
        await page.keyboard.type(text, { delay: delay || 50 });
        res.json({
            success: true,
            data: {
                typed: true,
                selector: targetSelector,
                textLength: text.length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Press key or key combination
app.post('/api/press', async (req, res) => {
    try {
        const { key } = req.body;
        const page = await getSelectedPage();
        if (!key) {
            res.status(400).json({ success: false, error: 'Key is required' });
            return;
        }
        console.log(`[CHROMADON] ⌨️ Press: ${key}`);
        // Handle key combinations like "Control+A" or "Control+Shift+R"
        await page.keyboard.press(key);
        res.json({
            success: true,
            data: {
                pressed: true,
                key,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Scroll the page or element
app.post('/api/scroll', async (req, res) => {
    try {
        const { selector, uid, direction, amount, x, y } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 📜 Scroll: ${direction || 'custom'}`);
        if (selector || uid) {
            const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
            await page.locator(targetSelector).scrollIntoViewIfNeeded();
        }
        else if (x !== undefined && y !== undefined) {
            await page.evaluate(({ x, y }) => window.scrollTo(x, y), { x, y });
        }
        else {
            const scrollAmount = amount || 500;
            const scrollMap = {
                'up': { x: 0, y: -scrollAmount },
                'down': { x: 0, y: scrollAmount },
                'left': { x: -scrollAmount, y: 0 },
                'right': { x: scrollAmount, y: 0 },
                'top': { x: 0, y: -999999 },
                'bottom': { x: 0, y: 999999 },
            };
            const scroll = scrollMap[direction || 'down'] || { x: 0, y: scrollAmount };
            await page.evaluate(({ x, y }) => window.scrollBy(x, y), scroll);
        }
        res.json({
            success: true,
            data: {
                scrolled: true,
                direction: direction || 'custom',
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Drag element to another element
app.post('/api/drag', async (req, res) => {
    try {
        const { fromSelector, fromUid, toSelector, toUid } = req.body;
        const page = await getSelectedPage();
        const from = fromUid ? `[data-chromadon-uid="${fromUid}"]` : fromSelector;
        const to = toUid ? `[data-chromadon-uid="${toUid}"]` : toSelector;
        if (!from || !to) {
            res.status(400).json({ success: false, error: 'From and To selectors/UIDs are required' });
            return;
        }
        console.log(`[CHROMADON] 🎯 Drag: ${from} → ${to}`);
        await page.dragAndDrop(from, to);
        res.json({
            success: true,
            data: {
                dragged: true,
                from,
                to,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Upload file
app.post('/api/upload', async (req, res) => {
    try {
        const { selector, uid, filePath } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || !filePath) {
            res.status(400).json({ success: false, error: 'Selector/UID and filePath are required' });
            return;
        }
        console.log(`[CHROMADON] 📁 Upload: ${filePath} to ${targetSelector}`);
        await page.setInputFiles(targetSelector, filePath);
        res.json({
            success: true,
            data: {
                uploaded: true,
                filePath,
                selector: targetSelector,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== SCREENSHOTS & CONTENT ====================
// Take screenshot
app.post('/api/screenshot', async (req, res) => {
    try {
        const { fullPage, selector, uid, format, quality } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 📸 Screenshot`);
        let screenshotBuffer;
        const screenshotFormat = format || 'png';
        if (selector || uid) {
            const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
            const element = await page.$(targetSelector);
            if (!element) {
                res.status(404).json({ success: false, error: `Element not found: ${targetSelector}` });
                return;
            }
            screenshotBuffer = await element.screenshot({ type: screenshotFormat });
        }
        else {
            screenshotBuffer = await page.screenshot({
                fullPage: fullPage || false,
                type: screenshotFormat,
                quality: screenshotFormat === 'jpeg' ? (quality || 80) : undefined,
            });
        }
        res.json({
            success: true,
            data: {
                screenshot: screenshotBuffer.toString('base64'),
                format: screenshotFormat,
                size: screenshotBuffer.length,
                pageUrl: page.url(),
                pageTitle: await page.title(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get DOM snapshot with UIDs
app.get('/api/snapshot', async (_req, res) => {
    try {
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 📋 DOM Snapshot`);
        const snapshot = await getDOMSnapshot(page);
        res.json({
            success: true,
            data: {
                snapshot,
                url: page.url(),
                title: await page.title(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get page content (HTML)
app.get('/api/content', async (_req, res) => {
    try {
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 📄 Page content`);
        res.json({
            success: true,
            data: {
                html: await page.content(),
                title: await page.title(),
                url: page.url(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Generate PDF
app.post('/api/pdf', async (req, res) => {
    try {
        const { format, landscape, printBackground } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 📑 Generate PDF`);
        const pdfBuffer = await page.pdf({
            format: format || 'A4',
            landscape: landscape || false,
            printBackground: printBackground !== false,
        });
        res.json({
            success: true,
            data: {
                pdf: pdfBuffer.toString('base64'),
                size: pdfBuffer.length,
                pageUrl: page.url(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== WAITING ====================
// Wait for element
app.post('/api/wait', async (req, res) => {
    try {
        const { selector, uid, state, timeout } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        console.log(`[CHROMADON] ⏳ Wait for: ${targetSelector}`);
        await page.waitForSelector(targetSelector, {
            state: (state || 'visible'),
            timeout: timeout || 30000,
        });
        res.json({
            success: true,
            data: {
                found: true,
                selector: targetSelector,
                state: state || 'visible',
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Wait for text to appear
app.post('/api/wait-for-text', async (req, res) => {
    try {
        const { text, timeout } = req.body;
        const page = await getSelectedPage();
        if (!text) {
            res.status(400).json({ success: false, error: 'Text is required' });
            return;
        }
        console.log(`[CHROMADON] ⏳ Wait for text: "${text}"`);
        await page.waitForFunction((searchText) => document.body.innerText.includes(searchText), text, { timeout: timeout || 30000 });
        res.json({
            success: true,
            data: {
                found: true,
                text,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Wait for navigation
app.post('/api/wait-for-navigation', async (req, res) => {
    try {
        const { url, timeout } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] ⏳ Wait for navigation${url ? `: ${url}` : ''}`);
        await page.waitForURL(url || '**/*', { timeout: timeout || 30000 });
        res.json({
            success: true,
            data: {
                navigated: true,
                currentUrl: page.url(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== DIALOGS ====================
// Handle browser dialog (alert, confirm, prompt)
app.post('/api/dialog', async (req, res) => {
    try {
        const { action, promptText } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 🗨️ Dialog: ${action}`);
        // Set up dialog handler
        page.once('dialog', async (dialog) => {
            if (action === 'accept') {
                await dialog.accept(promptText);
            }
            else {
                await dialog.dismiss();
            }
        });
        res.json({
            success: true,
            data: {
                handlerSet: true,
                action,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== COOKIES ====================
// Get cookies
app.get('/api/cookies', async (_req, res) => {
    try {
        const page = await getSelectedPage();
        const cookies = await page.context().cookies();
        res.json({
            success: true,
            data: {
                cookies,
                count: cookies.length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Set cookies
app.post('/api/cookies', async (req, res) => {
    try {
        const { cookies } = req.body;
        const page = await getSelectedPage();
        if (!cookies || !Array.isArray(cookies)) {
            res.status(400).json({ success: false, error: 'Cookies array is required' });
            return;
        }
        await page.context().addCookies(cookies);
        res.json({
            success: true,
            data: {
                added: cookies.length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Clear cookies
app.delete('/api/cookies', async (_req, res) => {
    try {
        const page = await getSelectedPage();
        await page.context().clearCookies();
        res.json({
            success: true,
            data: {
                cleared: true,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== CONSOLE ====================
// Get console messages
app.get('/api/console', async (req, res) => {
    try {
        const { types, pageIdx, limit } = req.query;
        let messages = [...consoleMessages];
        // Filter by page index
        if (pageIdx !== undefined) {
            messages = messages.filter(m => m.pageIndex === Number(pageIdx));
        }
        // Filter by types
        if (types) {
            const typeList = types.split(',');
            messages = messages.filter(m => typeList.includes(m.type));
        }
        // Limit
        if (limit) {
            messages = messages.slice(-Number(limit));
        }
        res.json({
            success: true,
            data: {
                messages,
                count: messages.length,
                totalCount: consoleMessages.length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Clear console messages
app.delete('/api/console', async (_req, res) => {
    consoleMessages = [];
    res.json({
        success: true,
        data: {
            cleared: true,
            timestamp: new Date().toISOString(),
        },
    });
});
// ==================== EMULATION ====================
// Emulate device/conditions
app.post('/api/emulate', async (req, res) => {
    try {
        const { viewport, geolocation, locale, colorScheme } = req.body;
        const page = await getSelectedPage();
        console.log(`[CHROMADON] 🔧 Emulate settings`);
        if (viewport) {
            await page.setViewportSize(viewport);
        }
        if (geolocation) {
            await page.context().setGeolocation(geolocation);
            await page.context().grantPermissions(['geolocation']);
        }
        if (colorScheme) {
            await page.emulateMedia({ colorScheme: colorScheme });
        }
        res.json({
            success: true,
            data: {
                emulated: true,
                settings: { viewport, geolocation, locale, colorScheme },
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Resize page
app.post('/api/resize', async (req, res) => {
    try {
        const { width, height } = req.body;
        const page = await getSelectedPage();
        if (!width || !height) {
            res.status(400).json({ success: false, error: 'Width and height are required' });
            return;
        }
        await page.setViewportSize({ width, height });
        res.json({
            success: true,
            data: {
                resized: true,
                width,
                height,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== JAVASCRIPT ====================
// Evaluate JavaScript
app.post('/api/evaluate', async (req, res) => {
    try {
        const { script } = req.body;
        const page = await getSelectedPage();
        if (!script) {
            res.status(400).json({ success: false, error: 'Script is required' });
            return;
        }
        console.log(`[CHROMADON] 🔧 Evaluate script`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await page.evaluate((code) => eval(code), script);
        res.json({
            success: true,
            data: {
                result,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== VERIFICATION ====================
// Verify page state
app.post('/api/verify', async (req, res) => {
    try {
        const { assertions } = req.body;
        const page = await getSelectedPage();
        if (!assertions || !Array.isArray(assertions)) {
            res.status(400).json({ success: false, error: 'Assertions array is required' });
            return;
        }
        console.log(`[CHROMADON] 🔍 Verify ${assertions.length} assertions`);
        const results = [];
        for (const assertion of assertions) {
            let actual;
            let passed;
            try {
                switch (assertion.type) {
                    case 'visible':
                        actual = await page.isVisible(assertion.target, { timeout: 5000 });
                        passed = actual === true;
                        break;
                    case 'text':
                        const textContent = await page.textContent(assertion.target, { timeout: 5000 });
                        actual = textContent || '';
                        passed = assertion.expected ? actual.includes(assertion.expected) : actual.length > 0;
                        break;
                    case 'url':
                        actual = page.url();
                        passed = assertion.expected ? actual.includes(assertion.expected) : true;
                        break;
                    case 'title':
                        actual = await page.title();
                        passed = assertion.expected ? actual.includes(assertion.expected) : actual.length > 0;
                        break;
                    case 'attribute':
                        const element = await page.$(assertion.target);
                        if (element && assertion.attribute) {
                            actual = await element.getAttribute(assertion.attribute) || '';
                            passed = assertion.expected ? actual === assertion.expected : actual.length > 0;
                        }
                        else {
                            actual = '';
                            passed = false;
                        }
                        break;
                    default:
                        actual = 'unknown assertion type';
                        passed = false;
                }
            }
            catch (e) {
                actual = `Error: ${e.message}`;
                passed = false;
            }
            results.push({
                type: assertion.type,
                target: assertion.target,
                expected: assertion.expected,
                actual,
                passed,
            });
        }
        res.json({
            success: true,
            data: {
                passed: results.every(r => r.passed),
                results,
                passedCount: results.filter(r => r.passed).length,
                failedCount: results.filter(r => !r.passed).length,
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== MISSION (NL Command) ====================
// Execute mission (natural language)
app.post('/api/mission', async (req, res) => {
    try {
        const { intent } = req.body;
        const page = await getSelectedPage();
        const missionId = `mission-${Date.now()}`;
        const startTime = Date.now();
        const steps = [];
        if (!intent) {
            res.status(400).json({ success: false, error: 'Intent is required' });
            return;
        }
        console.log(`[CHROMADON] 🎯 Mission: ${intent}`);
        // Simple intent parsing
        const intentLower = intent.toLowerCase();
        if (intentLower.includes('navigate to') || intentLower.includes('go to')) {
            const urlMatch = intent.match(/(?:navigate to|go to)\s+(\S+)/i);
            if (urlMatch) {
                await page.goto(urlMatch[1]);
                steps.push(`Navigated to ${urlMatch[1]}`);
            }
        }
        if (intentLower.includes('click')) {
            const selectorMatch = intent.match(/click\s+(?:on\s+)?["']?([^"']+)["']?/i);
            if (selectorMatch) {
                try {
                    await page.click(selectorMatch[1], { timeout: 5000 });
                    steps.push(`Clicked ${selectorMatch[1]}`);
                }
                catch (e) {
                    steps.push(`Failed to click: ${e.message}`);
                }
            }
        }
        if (intentLower.includes('type') || intentLower.includes('enter')) {
            const typeMatch = intent.match(/(?:type|enter)\s+["']([^"']+)["']\s+(?:in|into)\s+["']?([^"']+)["']?/i);
            if (typeMatch) {
                try {
                    await page.fill(typeMatch[2], typeMatch[1], { timeout: 5000 });
                    steps.push(`Typed "${typeMatch[1]}" into ${typeMatch[2]}`);
                }
                catch (e) {
                    steps.push(`Failed to type: ${e.message}`);
                }
            }
        }
        if (intentLower.includes('screenshot')) {
            steps.push('Screenshot captured');
        }
        const duration = Date.now() - startTime;
        res.json({
            success: true,
            data: {
                missionId,
                intent,
                status: 'completed',
                steps: steps.length,
                stepDetails: steps,
                duration,
                currentUrl: page.url(),
                currentTitle: await page.title(),
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== NEURAL RAG BRAIN v3.0 (AI-POWERED MISSION) ====================
/**
 * Extract page context for AI Engine
 */
/**
 * Extract page context from Desktop BrowserView tab
 */
async function extractDesktopPageContext(tabId) {
    const urlResult = await desktopExecuteScript(tabId, 'window.location.href');
    const titleResult = await desktopExecuteScript(tabId, 'document.title');
    const elements = await desktopExecuteScript(tabId, `
    (function() {
      var selectors = 'a, button, input, select, textarea, [role="button"], [onclick], [contenteditable="true"]';
      var els = document.querySelectorAll(selectors);
      return Array.from(els).slice(0, 100).map(function(el) {
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 100),
          id: el.id || undefined,
          className: el.className || undefined,
          href: el.getAttribute('href') || undefined,
          type: el.getAttribute('type') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          ariaLabel: el.getAttribute('aria-label') || undefined,
        };
      });
    })()
  `);
    return {
        url: urlResult || '',
        title: titleResult || '',
        interactiveElements: (elements || []),
    };
}
async function extractPageContext(page) {
    const url = page.url();
    const title = await page.title();
    // Extract interactive elements
    const elements = await page.evaluate(() => {
        const interactiveSelectors = 'a, button, input, select, textarea, [role="button"], [onclick], [contenteditable="true"]';
        const els = document.querySelectorAll(interactiveSelectors);
        return Array.from(els).slice(0, 100).map((el) => {
            return {
                tag: el.tagName.toLowerCase(),
                text: el.textContent?.trim().slice(0, 100) || '',
                id: el.id || undefined,
                className: el.className || undefined,
                href: el.getAttribute('href') || undefined,
                type: el.getAttribute('type') || undefined,
                placeholder: el.getAttribute('placeholder') || undefined,
                ariaLabel: el.getAttribute('aria-label') || undefined,
            };
        });
    });
    return {
        url,
        title,
        interactiveElements: elements,
    };
}
// AI-powered mission execution (Neural RAG Brain v3.0)
app.post('/api/mission/ai', async (req, res) => {
    try {
        const { command, minConfidence } = req.body;
        const startTime = Date.now();
        if (!command) {
            res.status(400).json({ success: false, error: 'Command is required' });
            return;
        }
        if (!aiEngine) {
            console.log('[CHROMADON] ⚠️ AI Engine not available, falling back to basic mission');
            res.status(503).json({
                success: false,
                error: 'Neural RAG AI Engine not initialized. Set ANTHROPIC_API_KEY environment variable.',
            });
            return;
        }
        // Desktop or CDP mode
        const useDesktop = desktopAvailable;
        let page = null;
        let desktopTabId = null;
        if (useDesktop) {
            desktopTabId = desktopActiveTabId;
            console.log(`[CHROMADON] 🧠 AI Mission (Desktop${desktopTabId !== null ? ` tab ${desktopTabId}` : ''}): ${command}`);
        }
        else {
            page = await getSelectedPage();
            console.log(`[CHROMADON] 🧠 AI Mission (CDP): ${command}`);
        }
        // Extract page context
        const pageContext = useDesktop
            ? await extractDesktopPageContext(desktopTabId)
            : await extractPageContext(page);
        // Process command with AI Engine
        const aiResponse = await aiEngine.processCommand(command, pageContext);
        console.log(`[CHROMADON] 🧠 AI Response: ${aiResponse.actions.length} actions, confidence: ${aiResponse.confidence}`);
        // Check confidence threshold
        const threshold = minConfidence || 0.6;
        if (aiResponse.confidence < threshold) {
            res.json({
                success: false,
                data: {
                    error: 'Low confidence',
                    confidence: aiResponse.confidence,
                    threshold,
                    cognitiveMode: aiResponse.cognitiveMode,
                    suggestedActions: aiResponse.actions,
                },
            });
            return;
        }
        // Execute actions
        const executionResults = [];
        for (const action of aiResponse.actions) {
            const params = action.params || {};
            const selector = params.selector;
            const url = params.url;
            const value = params.value;
            const timeout = params.timeout || 10000;
            try {
                let result = { success: true };
                if (useDesktop) {
                    // Execute via Desktop BrowserView
                    const escapedSelector = selector ? selector.replace(/'/g, "\\'") : '';
                    switch (action.type) {
                        case 'navigate':
                            if (url) {
                                await fetch(`${CHROMADON_DESKTOP_URL}/tabs/navigate`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ id: desktopTabId, url }),
                                });
                                result.details = `Navigated to ${url}`;
                            }
                            break;
                        case 'click':
                            if (selector) {
                                await desktopExecuteScript(desktopTabId, `
                  (function() {
                    var el = document.querySelector('${escapedSelector}');
                    if (el) { el.scrollIntoView({block:'center'}); el.click(); return true; }
                    return false;
                  })()
                `);
                                result.details = `Clicked ${selector}`;
                            }
                            break;
                        case 'type':
                            if (selector && value) {
                                const escapedValue = value.replace(/'/g, "\\'").replace(/\n/g, '\\n');
                                await desktopExecuteScript(desktopTabId, `
                  (function() {
                    var el = document.querySelector('${escapedSelector}');
                    if (el) { el.focus(); el.value = '${escapedValue}'; el.dispatchEvent(new Event('input',{bubbles:true})); return true; }
                    return false;
                  })()
                `);
                                result.details = `Typed into ${selector}`;
                            }
                            break;
                        case 'scroll':
                            if (selector) {
                                await desktopExecuteScript(desktopTabId, `
                  (function() { var el = document.querySelector('${escapedSelector}'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); })()
                `);
                                result.details = `Scrolled to ${selector}`;
                            }
                            else {
                                await desktopExecuteScript(desktopTabId, 'window.scrollBy(0, 500)');
                                result.details = 'Scrolled down';
                            }
                            break;
                        case 'wait':
                            await new Promise(resolve => setTimeout(resolve, timeout));
                            result.details = `Waited ${timeout}ms`;
                            break;
                        case 'extract':
                            if (selector) {
                                const text = await desktopExecuteScript(desktopTabId, `
                  (function() { var el = document.querySelector('${escapedSelector}'); return el ? el.textContent.trim().slice(0,100) : null; })()
                `);
                                result.details = `Extracted: ${text}`;
                            }
                            break;
                        default:
                            result = { success: false, details: `Unknown action type: ${action.type}` };
                    }
                }
                else {
                    // Execute via CDP (Playwright)
                    switch (action.type) {
                        case 'navigate':
                            if (url) {
                                await page.goto(url, { timeout: 30000 });
                                result.details = `Navigated to ${url}`;
                            }
                            break;
                        case 'click':
                            if (selector) {
                                await page.click(selector, { timeout: 10000 });
                                result.details = `Clicked ${selector}`;
                            }
                            break;
                        case 'type':
                            if (selector && value) {
                                await page.fill(selector, value, { timeout: 10000 });
                                result.details = `Typed into ${selector}`;
                            }
                            break;
                        case 'scroll':
                            if (selector) {
                                await page.locator(selector).scrollIntoViewIfNeeded();
                                result.details = `Scrolled to ${selector}`;
                            }
                            else {
                                await page.evaluate(() => window.scrollBy(0, 500));
                                result.details = 'Scrolled down';
                            }
                            break;
                        case 'wait':
                            if (selector) {
                                await page.waitForSelector(selector, { timeout });
                                result.details = `Waited for ${selector}`;
                            }
                            else {
                                await page.waitForTimeout(timeout);
                                result.details = `Waited ${timeout}ms`;
                            }
                            break;
                        case 'screenshot':
                            await page.screenshot();
                            result.details = 'Screenshot captured';
                            break;
                        case 'extract':
                            if (selector) {
                                const text = await page.textContent(selector);
                                result.details = `Extracted: ${text?.slice(0, 100)}`;
                            }
                            break;
                        case 'hover':
                            if (selector) {
                                await page.hover(selector, { timeout: 10000 });
                                result.details = `Hovered over ${selector}`;
                            }
                            break;
                        default:
                            result = { success: false, details: `Unknown action type: ${action.type}` };
                    }
                }
                executionResults.push({
                    action: action.type,
                    selector,
                    description: action.description,
                    ...result,
                });
            }
            catch (actionError) {
                executionResults.push({
                    action: action.type,
                    selector,
                    description: action.description,
                    success: false,
                    error: actionError.message,
                });
            }
        }
        const duration = Date.now() - startTime;
        const successCount = executionResults.filter(r => r.success).length;
        // Observation/describe commands return 0 actions - this is valid
        const isObservation = aiResponse.actions.length === 0 && aiResponse.confidence >= threshold;
        // Get current URL/title from appropriate source
        let currentUrl = '';
        let currentTitle = '';
        if (useDesktop) {
            try {
                currentUrl = await desktopExecuteScript(desktopTabId, 'window.location.href') || '';
                currentTitle = await desktopExecuteScript(desktopTabId, 'document.title') || '';
            }
            catch { /* ignore */ }
        }
        else {
            currentUrl = page.url();
            currentTitle = await page.title();
        }
        res.json({
            success: isObservation || successCount > 0,
            data: {
                command,
                cognitiveMode: aiResponse.cognitiveMode,
                confidence: aiResponse.confidence,
                verificationScore: aiResponse.verificationScore,
                thinking: aiResponse.thinking || undefined,
                response: isObservation ? (aiResponse.thinking || 'Observation completed') : undefined,
                actionsPlanned: aiResponse.actions.length,
                actionsExecuted: executionResults.length,
                actionsSucceeded: successCount,
                executionResults,
                duration,
                currentUrl,
                currentTitle,
                mode: useDesktop ? 'desktop' : 'cdp',
                timestamp: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        console.error('[CHROMADON] AI Mission error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get AI Engine status
app.get('/api/ai/status', (_req, res) => {
    res.json({
        success: true,
        data: {
            aiEngineAvailable: !!aiEngine,
            version: '3.0.0',
            features: [
                'Dual-Process Routing (System 1/System 2)',
                'Self-Reflection Tokens [RET][REL][SUP][USE]',
                'Hierarchical Memory (L0-L3)',
                'Circuit Breaker Protection',
                'PRM Verification',
            ],
            memoryStats: aiEngine ? aiEngine.getMemoryStats() : null,
            circuitBreakerState: aiEngine ? aiEngine.getCircuitBreakerState() : null,
            timestamp: new Date().toISOString(),
        },
    });
});
// Reset AI Engine circuit breaker
app.post('/api/ai/reset-circuit', (_req, res) => {
    if (!aiEngine) {
        res.status(503).json({ success: false, error: 'AI Engine not available' });
        return;
    }
    aiEngine.resetCircuitBreaker();
    res.json({
        success: true,
        data: {
            message: 'Circuit breaker reset',
            newState: aiEngine.getCircuitBreakerState(),
            timestamp: new Date().toISOString(),
        },
    });
});
// ==================== AGENTIC ORCHESTRATOR (Claude tool-use loop) ====================
/**
 * POST /api/orchestrator/chat
 * SSE streaming endpoint for the agentic orchestrator.
 * Receives a user message, streams Claude's response + tool executions.
 */
app.post('/api/orchestrator/chat', async (req, res) => {
    const { message, sessionId } = req.body;
    if (!message) {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
    }
    if (!orchestrator) {
        res.status(503).json({
            success: false,
            error: 'Agentic Orchestrator not initialized. Set ANTHROPIC_API_KEY environment variable.',
        });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    // Sync Desktop state before building context (ensures desktopActiveTabId is current)
    const useDesktop = desktopAvailable;
    if (useDesktop) {
        try {
            await desktopListTabs();
        }
        catch { /* non-fatal */ }
    }
    // Create abort controller for this execution
    const abortController = new AbortController();
    const trackingId = sessionId || `req-${Date.now()}`;
    activeAbortControllers.set(trackingId, abortController);
    // Build execution context - gracefully handle no browser (YouTube/analytics tools work without one)
    let selectedPage = null;
    if (!useDesktop) {
        try {
            selectedPage = await getSelectedPage();
        }
        catch { /* no browser available - YouTube/analytics tools still work */ }
    }
    const context = {
        page: selectedPage,
        desktopTabId: useDesktop ? desktopActiveTabId : null,
        useDesktop,
        desktopUrl: CHROMADON_DESKTOP_URL,
        abortSignal: abortController.signal,
    };
    // Get current page context for system prompt
    let pageContext;
    try {
        if (useDesktop && desktopActiveTabId !== null) {
            pageContext = await extractDesktopPageContext(desktopActiveTabId);
        }
        else if (context.page) {
            pageContext = await extractPageContext(context.page);
        }
    }
    catch {
        // Page context is optional - orchestrator works without it
    }
    // SSE writer
    let closed = false;
    const writer = {
        writeEvent(event, data) {
            if (closed)
                return;
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            }
            catch {
                closed = true;
            }
        },
        close() {
            closed = true;
        },
        isClosed() {
            return closed;
        },
    };
    // Handle client disconnect - listen on RESPONSE close, not request close
    // req.on('close') fires when the request body is consumed, NOT when the client disconnects
    res.on('close', () => {
        closed = true;
    });
    try {
        await orchestrator.chat(sessionId, message, writer, context, pageContext);
    }
    catch (error) {
        if (!closed) {
            writer.writeEvent('error', { message: error.message });
        }
    }
    finally {
        activeAbortControllers.delete(trackingId);
        if (!closed) {
            res.end();
        }
    }
});
/**
 * POST /api/orchestrator/stop
 * Stop a specific orchestrator execution by sessionId.
 */
app.post('/api/orchestrator/stop', (req, res) => {
    const { sessionId } = req.body;
    const controller = activeAbortControllers.get(sessionId);
    if (controller) {
        controller.abort();
        activeAbortControllers.delete(sessionId);
        res.json({ success: true, message: 'Execution aborted' });
    }
    else {
        res.json({ success: true, message: 'No active execution' });
    }
});
/**
 * POST /api/orchestrator/stop-all
 * Stop ALL active orchestrator executions.
 */
app.post('/api/orchestrator/stop-all', (_req, res) => {
    const count = activeAbortControllers.size;
    for (const [, controller] of activeAbortControllers) {
        controller.abort();
    }
    activeAbortControllers.clear();
    res.json({ success: true, aborted: count });
});
/**
 * DELETE /api/orchestrator/session/:id
 * Clear a specific orchestrator session.
 */
app.delete('/api/orchestrator/session/:id', (req, res) => {
    if (!orchestrator) {
        res.status(503).json({ success: false, error: 'Orchestrator not initialized' });
        return;
    }
    const deleted = orchestrator.clearSession(req.params.id);
    res.json({ success: deleted, sessionId: req.params.id });
});
/**
 * GET /api/orchestrator/status
 * Get orchestrator status.
 */
app.get('/api/orchestrator/status', (_req, res) => {
    res.json({
        success: true,
        data: {
            available: !!orchestrator,
            sessions: orchestrator?.getSessionCount() ?? 0,
            mode: desktopAvailable ? 'DESKTOP' : 'CDP',
            timestamp: new Date().toISOString(),
        },
    });
});
// ==================== SOCIAL MEDIA OVERLORD ====================
/**
 * Helper: Build execution context + page context for the Social Overlord.
 * Reuses the same Desktop/CDP detection logic as the orchestrator endpoint.
 */
async function buildExecutionContext() {
    const useDesktop = desktopAvailable;
    if (useDesktop) {
        try {
            await desktopListTabs();
        }
        catch { /* non-fatal */ }
    }
    const context = {
        page: useDesktop ? null : await getSelectedPage(),
        desktopTabId: useDesktop ? desktopActiveTabId : null,
        useDesktop,
        desktopUrl: CHROMADON_DESKTOP_URL,
    };
    let pageContext;
    try {
        if (useDesktop && desktopActiveTabId !== null) {
            pageContext = await extractDesktopPageContext(desktopActiveTabId);
        }
        else if (context.page) {
            pageContext = await extractPageContext(context.page);
        }
    }
    catch {
        // Page context is optional
    }
    return { context, pageContext };
}
/**
 * POST /api/social/process
 * Process a single marketing task (non-streaming, returns JSON result).
 */
app.post('/api/social/process', async (req, res) => {
    const { task } = req.body;
    if (!task || !task.id || !task.platform || !task.action) {
        res.status(400).json({ success: false, error: 'task with id, platform, and action is required' });
        return;
    }
    if (!socialOverlord) {
        res.status(503).json({ success: false, error: 'Social Overlord not initialized. Set ANTHROPIC_API_KEY.' });
        return;
    }
    try {
        console.log(`[SOCIAL OVERLORD] Processing task ${task.id}: ${task.platform}/${task.action}`);
        const result = await socialOverlord.processTask(task);
        console.log(`[SOCIAL OVERLORD] Task ${task.id} ${result.success ? 'completed' : 'failed'} in ${result.durationMs}ms`);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/social/process-stream
 * Process a single task with full SSE streaming (tool-by-tool, like /api/orchestrator/chat).
 */
app.post('/api/social/process-stream', async (req, res) => {
    const { task } = req.body;
    if (!task || !task.id || !task.platform || !task.action) {
        res.status(400).json({ success: false, error: 'task with id, platform, and action is required' });
        return;
    }
    if (!socialOverlord) {
        res.status(503).json({ success: false, error: 'Social Overlord not initialized.' });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    let closed = false;
    const writer = {
        writeEvent(event, data) {
            if (closed)
                return;
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            }
            catch {
                closed = true;
            }
        },
        close() { closed = true; },
        isClosed() { return closed; },
    };
    res.on('close', () => { closed = true; });
    try {
        await socialOverlord.processTaskStreaming(task, writer);
    }
    catch (error) {
        if (!closed) {
            writer.writeEvent('error', { message: error.message });
        }
    }
    finally {
        if (!closed) {
            writer.writeEvent('done', {});
            res.end();
        }
    }
});
/**
 * POST /api/social/process-all
 * Process an array of tasks with SSE progress reporting.
 */
app.post('/api/social/process-all', async (req, res) => {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        res.status(400).json({ success: false, error: 'tasks array is required and must not be empty' });
        return;
    }
    if (!socialOverlord) {
        res.status(503).json({ success: false, error: 'Social Overlord not initialized.' });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    let closed = false;
    const writer = {
        writeEvent(event, data) {
            if (closed)
                return;
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            }
            catch {
                closed = true;
            }
        },
        close() { closed = true; },
        isClosed() { return closed; },
    };
    res.on('close', () => { closed = true; });
    try {
        console.log(`[SOCIAL OVERLORD] Processing batch of ${tasks.length} tasks`);
        await socialOverlord.processQueue(tasks, writer);
    }
    catch (error) {
        if (!closed) {
            writer.writeEvent('error', { message: error.message });
        }
    }
    finally {
        if (!closed) {
            res.end();
        }
    }
});
// ==================== SESSION MANAGEMENT ====================
// Get session status
app.get('/api/session', async (_req, res) => {
    const currentPage = globalPages[selectedPageIndex];
    res.json({
        success: true,
        data: {
            active: globalBrowser?.isConnected() ?? false,
            mode: connectionMode,
            cdpEndpoint: CDP_ENDPOINT,
            pageCount: globalPages.length,
            selectedPage: selectedPageIndex,
            currentUrl: currentPage?.url() || null,
            pageTitle: currentPage ? await currentPage.title() : null,
            uptime: Math.round((Date.now() - serverStartTime) / 1000),
            timestamp: new Date().toISOString(),
        },
    });
});
// Start session (no-op for CDP, reconnects if needed)
app.post('/api/session/start', async (_req, res) => {
    await getSelectedPage();
    res.json({
        success: true,
        data: {
            message: `${connectionMode} mode - browser connected`,
            mode: connectionMode,
            pageCount: globalPages.length,
            timestamp: new Date().toISOString(),
        },
    });
});
// End session
app.post('/api/session/end', async (_req, res) => {
    const page = await getSelectedPage();
    await page.goto('about:blank');
    await page.setContent(`
    <html>
      <head><title>CHROMADON Ready</title></head>
      <body style="background: #0a0a0f; color: #00ced1; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center;">
          <h1>🤖 CHROMADON v4.0</h1>
          <p>Session cleared - Ready for next task</p>
        </div>
      </body>
    </html>
  `);
    res.json({
        success: true,
        data: {
            message: 'Session cleared',
            mode: connectionMode,
            timestamp: new Date().toISOString(),
        },
    });
});
// List sessions
app.get('/api/sessions', async (_req, res) => {
    const pages = await Promise.all(globalPages.map(async (page, idx) => ({
        index: idx,
        selected: idx === selectedPageIndex,
        url: page.url(),
        title: await page.title(),
    })));
    res.json({
        success: true,
        data: {
            mode: connectionMode,
            cdpEndpoint: CDP_ENDPOINT,
            count: pages.length,
            pages,
            timestamp: new Date().toISOString(),
        },
    });
});
// ==================== 27-AGENT SYSTEM ENDPOINTS ====================
/**
 * Create CDP Controller adapter from Playwright page
 */
function createCDPControllerAdapter() {
    return {
        async navigate(url) {
            const page = await getSelectedPage();
            const start = Date.now();
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });
            return { success: true, finalUrl: page.url(), loadTime: Date.now() - start };
        },
        async click(selector, options) {
            const page = await getSelectedPage();
            await page.click(selector, { timeout: options?.timeout || 10000, force: options?.force });
            return { success: true };
        },
        async clickCoordinates(x, y) {
            const page = await getSelectedPage();
            await page.mouse.click(x, y);
            return { success: true };
        },
        async type(selector, text, options) {
            const page = await getSelectedPage();
            if (options?.clear) {
                await page.fill(selector, '');
            }
            await page.type(selector, text, { delay: options?.delay || 50 });
            return { success: true };
        },
        async typeKeys(keys) {
            const page = await getSelectedPage();
            for (const key of keys) {
                await page.keyboard.press(key);
            }
            return { success: true };
        },
        async scroll(options) {
            const page = await getSelectedPage();
            const deltaX = options.direction === 'left' ? -options.amount : options.direction === 'right' ? options.amount : 0;
            const deltaY = options.direction === 'up' ? -options.amount : options.direction === 'down' ? options.amount : 0;
            await page.mouse.wheel(deltaX, deltaY);
        },
        async scrollToElement(selector) {
            const page = await getSelectedPage();
            await page.locator(selector).scrollIntoViewIfNeeded();
            return { success: true };
        },
        async scrollToCoordinates(x, y) {
            const page = await getSelectedPage();
            await page.evaluate(([scrollX, scrollY]) => window.scrollTo(scrollX, scrollY), [x, y]);
        },
        async select(selector, value) {
            const page = await getSelectedPage();
            await page.selectOption(selector, value);
            return { success: true };
        },
        async selectMultiple(selector, values) {
            const page = await getSelectedPage();
            await page.selectOption(selector, values);
            return { success: true };
        },
        async uploadFile(selector, filePath) {
            const page = await getSelectedPage();
            await page.setInputFiles(selector, filePath);
            return { success: true };
        },
        async screenshot() {
            const page = await getSelectedPage();
            const buffer = await page.screenshot({ type: 'png' });
            return buffer.toString('base64');
        },
        async getHTML() {
            const page = await getSelectedPage();
            return page.content();
        },
        async evaluate(script) {
            const page = await getSelectedPage();
            return page.evaluate(script);
        },
        async waitForSelector(selector, timeout) {
            const page = await getSelectedPage();
            try {
                await page.waitForSelector(selector, { timeout: timeout || 10000 });
                return true;
            }
            catch {
                return false;
            }
        },
        async waitForNavigation(timeout) {
            const page = await getSelectedPage();
            try {
                await page.waitForLoadState('load', { timeout: timeout || 30000 });
                return true;
            }
            catch {
                return false;
            }
        },
        async goBack() {
            const page = await getSelectedPage();
            await page.goBack();
        },
        async goForward() {
            const page = await getSelectedPage();
            await page.goForward();
        },
        async refresh() {
            const page = await getSelectedPage();
            await page.reload();
        },
        // CDP Protocol compatibility layer for agents that use raw CDP
        async send(method, params) {
            const page = await getSelectedPage();
            switch (method) {
                case 'Runtime.evaluate': {
                    const { expression, returnByValue } = params || {};
                    try {
                        const result = await page.evaluate(expression);
                        return { result: { value: result } };
                    }
                    catch (error) {
                        return { result: { value: null }, error: error.message };
                    }
                }
                case 'Page.navigate': {
                    await page.goto(params.url);
                    return { frameId: 'main' };
                }
                case 'DOM.getDocument': {
                    const html = await page.content();
                    return { root: { nodeId: 1, outerHTML: html } };
                }
                case 'Page.captureScreenshot': {
                    const buffer = await page.screenshot({ type: 'png' });
                    return { data: buffer.toString('base64') };
                }
                default:
                    console.warn(`[CDP Adapter] Unhandled CDP method: ${method}`);
                    return { error: `Unsupported CDP method: ${method}` };
            }
        },
    };
}
// DesktopBrowserAdapter for controlling chromadon-desktop
class DesktopBrowserAdapter {
    baseUrl;
    activeTabId = null;
    constructor(baseUrl = CHROMADON_DESKTOP_URL) {
        this.baseUrl = baseUrl;
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        }
        catch {
            return false;
        }
    }
    async getActiveTabId() {
        if (this.activeTabId !== null)
            return this.activeTabId;
        const response = await fetch(`${this.baseUrl}/tabs`);
        const data = await response.json();
        if (data.tabs?.length > 0 && data.activeTabId !== undefined) {
            this.activeTabId = data.activeTabId;
            return data.activeTabId;
        }
        const createResponse = await fetch(`${this.baseUrl}/tabs/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: 'about:blank' }),
        });
        const createData = await createResponse.json();
        this.activeTabId = createData.id;
        return createData.id;
    }
    async execute(script) {
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, script }),
        });
        const data = await response.json();
        if (!data.success)
            throw new Error(data.error || 'Execute failed');
        return data.result;
    }
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
        if (!result)
            throw new Error(`Element not found: ${selector}`);
        return result;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async navigate(url) {
        const start = Date.now();
        const tabId = await this.getActiveTabId();
        await fetch(`${this.baseUrl}/tabs/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, url }),
        });
        await this.sleep(1000);
        const finalUrl = await this.execute('window.location.href');
        return { success: true, finalUrl, loadTime: Date.now() - start };
    }
    async click(selector, options) {
        const found = await this.waitForSelector(selector, options?.timeout || 10000);
        if (!found)
            throw new Error(`Element not found: ${selector}`);
        await this.scrollToElement(selector);
        await this.sleep(100);
        const coords = await this.getElementCoordinates(selector);
        return this.clickCoordinates(coords.x, coords.y);
    }
    async clickCoordinates(x, y) {
        const tabId = await this.getActiveTabId();
        await fetch(`${this.baseUrl}/tabs/click/${tabId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: Math.round(x), y: Math.round(y) }),
        });
        return { success: true };
    }
    async type(selector, text, options) {
        const tabId = await this.getActiveTabId();
        await this.click(selector);
        await this.sleep(100);
        if (options?.clear) {
            await this.execute(`document.querySelector('${selector.replace(/'/g, "\\'")}').value = ''`);
        }
        for (const char of text) {
            await fetch(`${this.baseUrl}/tabs/type/${tabId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: char }),
            });
            if (options?.delay)
                await this.sleep(options.delay);
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
        if (el) { el.value = '${value.replace(/'/g, "\\'")}'; el.dispatchEvent(new Event('change', { bubbles: true })); }
      })()
    `);
        return { success: true };
    }
    async selectMultiple(selector, values) {
        const escapedSelector = selector.replace(/'/g, "\\'");
        await this.execute(`
      (function() {
        const el = document.querySelector('${escapedSelector}');
        if (el && el.options) {
          const values = ${JSON.stringify(values)};
          for (const option of el.options) option.selected = values.includes(option.value);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
        return { success: true };
    }
    async uploadFile(_selector, _filePath) {
        console.warn('[DesktopBrowserAdapter] uploadFile not fully implemented');
        return { success: false };
    }
    async screenshot() {
        const tabId = await this.getActiveTabId();
        const response = await fetch(`${this.baseUrl}/tabs/screenshot/${tabId}`);
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
            if (exists)
                return true;
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
                await this.sleep(500);
                return true;
            }
        }
        return false;
    }
    async goBack() { await this.execute('history.back()'); await this.sleep(500); }
    async goForward() { await this.execute('history.forward()'); await this.sleep(500); }
    async refresh() { await this.execute('location.reload()'); await this.sleep(1000); }
    async send(method, params) {
        switch (method) {
            case 'Runtime.evaluate': {
                try {
                    const result = await this.execute(params?.expression);
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
                console.warn(`[DesktopBrowserAdapter] Unhandled CDP method: ${method}`);
                return { error: `Unsupported CDP method: ${method}` };
        }
    }
}
// Initialize agent system (called after browser is ready)
async function initializeAgentSystem() {
    if (!agentSystem) {
        try {
            console.log('[CHROMADON] 🔧 Attempting agent system init...');
            // Try Desktop adapter first if PREFER_DESKTOP is set
            if (PREFER_DESKTOP) {
                console.log('[CHROMADON] 🔧 PREFER_DESKTOP=true, checking Desktop availability...');
                const desktopAdapter = new DesktopBrowserAdapter();
                const desktopAvailable = await desktopAdapter.healthCheck();
                if (desktopAvailable) {
                    console.log('[CHROMADON] ✅ Using Desktop Browser Controller (port 3002)');
                    agentSystem = new ChromadonAgentSystem(desktopAdapter);
                    console.log('[CHROMADON] ✅ 27-Agent System initialized with Desktop adapter');
                    return;
                }
                else {
                    console.log('[CHROMADON] ⚠️ Desktop not available, falling back to CDP...');
                }
            }
            // Fallback to CDP adapter
            console.log('[CHROMADON] 🔧 Creating CDP adapter...');
            const cdpAdapter = createCDPControllerAdapter();
            console.log('[CHROMADON] 🔧 CDP adapter created, instantiating ChromadonAgentSystem...');
            agentSystem = new ChromadonAgentSystem(cdpAdapter);
            console.log('[CHROMADON] ✅ 27-Agent System initialized successfully');
        }
        catch (error) {
            console.error('[CHROMADON] ❌ Agent System init FAILED:', error);
            console.error('[CHROMADON] ❌ Stack trace:', error.stack);
        }
    }
}
// Natural language task execution
app.post('/api/agent/execute', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { task } = req.body;
        if (!task) {
            res.status(400).json({ success: false, error: 'Task is required' });
            return;
        }
        console.log(`[CHROMADON] 🤖 Agent Execute: ${task}`);
        const result = await agentSystem.execute(task);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Social media page creation
app.post('/api/agent/social/page', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { platform, name, category, description } = req.body;
        console.log(`[CHROMADON] 🤖 Create ${platform} page: ${name}`);
        const result = await agentSystem.createBusinessPage(platform, name, category, description);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Social media posting
app.post('/api/agent/social/post', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { platform, content, options } = req.body;
        console.log(`[CHROMADON] 🤖 Post to ${platform}`);
        const result = await agentSystem.postToSocial(platform, content, options);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Research endpoint
app.post('/api/agent/research', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { topic, options } = req.body;
        console.log(`[CHROMADON] 🤖 Research: ${topic}`);
        const result = await agentSystem.deepResearch(topic, options);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Add to cart
app.post('/api/agent/cart/add', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { productUrl, quantity, options } = req.body;
        console.log(`[CHROMADON] 🤖 Add to cart: ${productUrl}`);
        const result = await agentSystem.addToCart(productUrl, quantity || 1, options);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Checkout
app.post('/api/agent/checkout', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        console.log(`[CHROMADON] 🤖 Checkout`);
        const result = await agentSystem.checkout(req.body);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Data extraction
app.post('/api/agent/extract', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { url, rules } = req.body;
        console.log(`[CHROMADON] 🤖 Extract data from: ${url}`);
        const result = await agentSystem.extractData(url, rules);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Booking
app.post('/api/agent/book', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { type, ...details } = req.body;
        console.log(`[CHROMADON] 🤖 Book ${type}`);
        const result = await agentSystem.makeReservation(type, details);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Form filling
app.post('/api/agent/form', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { url, formData } = req.body;
        console.log(`[CHROMADON] 🤖 Fill form: ${url}`);
        const result = await agentSystem.fillForm(url, formData);
        res.json({ success: result.success, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Store credentials
app.post('/api/agent/credentials', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const { platform, username, password } = req.body;
        console.log(`[CHROMADON] 🤖 Store credentials: ${platform}`);
        await agentSystem.storeCredentials(platform, username, password);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Agent stats
app.get('/api/agent/stats', async (_req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const stats = agentSystem.getStats();
        res.json({ success: true, data: stats });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== RALPH SYSTEM ENDPOINTS ====================
// Get RALPH status for active mission
app.get('/api/ralph/status', async (_req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        const ralph = agentSystem.getActiveRalph?.();
        if (!ralph) {
            res.json({
                success: true,
                data: {
                    active: false,
                    message: 'No active RALPH execution',
                },
            });
            return;
        }
        const state = ralph.getState();
        const metrics = ralph.getMetrics();
        res.json({
            success: true,
            data: {
                active: true,
                missionId: ralph.getMissionId(),
                state,
                metrics,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Pause active RALPH execution
app.post('/api/ralph/pause', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        await agentSystem.pauseRalph?.();
        res.json({ success: true, message: 'RALPH execution paused' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Resume paused RALPH execution
app.post('/api/ralph/resume', async (req, res) => {
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        await agentSystem.resumeRalph?.();
        res.json({ success: true, message: 'RALPH execution resumed' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Abort active RALPH execution
app.post('/api/ralph/abort', async (req, res) => {
    try {
        const { reason } = req.body;
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        await agentSystem.abortRalph?.(reason || 'User requested abort');
        res.json({ success: true, message: 'RALPH execution aborted' });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Respond to RALPH intervention request
app.post('/api/ralph/respond', async (req, res) => {
    try {
        const { action, data } = req.body;
        await initializeAgentSystem();
        if (!agentSystem) {
            res.status(503).json({ success: false, error: 'Agent system not available' });
            return;
        }
        if (!action || !['continue', 'retry', 'abort', 'modify'].includes(action)) {
            res.status(400).json({
                success: false,
                error: 'Action must be one of: continue, retry, abort, modify',
            });
            return;
        }
        await agentSystem.respondToIntervention?.({ action, data });
        res.json({ success: true, message: `Intervention response sent: ${action}` });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== ANALYTICS ====================
app.get('/api/analytics/overview', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const days = parseInt(req.query.days) || 30;
        res.json({ success: true, data: analyticsDb.getOverview(days) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/platform/:platform', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const days = parseInt(req.query.days) || 30;
        res.json({ success: true, data: analyticsDb.getPlatformAnalytics(req.params.platform, days) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/content', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const days = parseInt(req.query.days) || 30;
        const platform = req.query.platform;
        const postType = req.query.post_type;
        res.json({ success: true, data: analyticsDb.getContentAnalytics(platform, days, postType) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/audience/:platform', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const days = parseInt(req.query.days) || 30;
        res.json({ success: true, data: analyticsDb.getAudienceHistory(req.params.platform, days) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/competitors', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const platform = req.query.platform;
        const competitorId = req.query.competitor_id ? parseInt(req.query.competitor_id) : undefined;
        res.json({ success: true, data: analyticsDb.getCompetitorAnalytics(platform, competitorId) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/timing/:platform', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        res.json({ success: true, data: analyticsDb.getTimingHeatmap(req.params.platform) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/analytics/roi', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const days = parseInt(req.query.days) || 30;
        res.json({ success: true, data: analyticsDb.getROIAnalytics(days) });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/analytics/report', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const executor = (0, analytics_executor_1.createAnalyticsExecutor)(analyticsDb);
        const report = executor('generate_analytics_report', req.body || {});
        res.json({ success: true, data: report });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/analytics/collect', async (req, res) => {
    try {
        if (!dataCollector) {
            res.status(503).json({ success: false, error: 'Data collector not initialized' });
            return;
        }
        const platform = req.body?.platform;
        if (platform) {
            const result = await dataCollector.collectPlatform(platform);
            res.json({ success: true, data: result });
        }
        else {
            const results = await dataCollector.collectAll();
            res.json({ success: true, data: results });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Apply error handler
app.use(errorHandler);
// Cleanup on shutdown
async function cleanup() {
    console.log('[CHROMADON] Shutting down...');
    if (globalBrowser && connectionMode === 'FRESH') {
        try {
            await globalBrowser.close();
            console.log('[CHROMADON] Browser closed');
        }
        catch (e) {
            // Ignore
        }
    }
    else if (connectionMode === 'CDP') {
        console.log('[CHROMADON] CDP mode - browser left running');
    }
    process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
// Crash protection - prevent silent process death
process.on('unhandledRejection', (reason, promise) => {
    console.error('[CHROMADON] ❌ Unhandled Promise Rejection:', reason);
    console.error('[CHROMADON] Promise:', promise);
    // Don't exit - keep server running
});
process.on('uncaughtException', (error) => {
    console.error('[CHROMADON] ❌ Uncaught Exception:', error);
    // For truly fatal errors, attempt graceful shutdown
    if (error.message?.includes('EADDRINUSE') || error.message?.includes('out of memory')) {
        cleanup();
    }
    // Otherwise keep running - most uncaught exceptions are recoverable
});
// Start server
async function startServer() {
    // Check Desktop availability FIRST - before any browser launch
    await checkDesktopHealth();
    // Initialize browser connection (skipped in DESKTOP mode)
    await initializeBrowser();
    // Initialize Neural RAG AI Engine v3.0
    if (ANTHROPIC_API_KEY) {
        try {
            aiEngine = new core_1.NeuralRAGAIEngine(ANTHROPIC_API_KEY);
            console.log('[CHROMADON] ✅ Neural RAG AI Engine v3.0 initialized');
            console.log('[CHROMADON]    - Dual-Process Routing (System 1/System 2)');
            console.log('[CHROMADON]    - Self-Reflection Tokens [RET][REL][SUP][USE]');
            console.log('[CHROMADON]    - Hierarchical Memory (L0-L3)');
            console.log('[CHROMADON]    - Circuit Breaker Protection');
            // Initialize Analytics Database
            try {
                analyticsDb = new database_1.AnalyticsDatabase();
                console.log('[CHROMADON] ✅ Analytics Database initialized (SQLite)');
            }
            catch (dbError) {
                console.log(`[CHROMADON] ⚠️ Analytics DB init failed: ${dbError.message}`);
            }
            // Initialize YouTube Token Manager
            try {
                youtubeTokenManager = new youtube_token_manager_1.YouTubeTokenManager({
                    apiKey: process.env.YOUTUBE_API_KEY || '',
                    clientId: process.env.YOUTUBE_CLIENT_ID || '',
                    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
                    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
                    tokenStorePath: process.env.YOUTUBE_TOKEN_STORE || path.join(process.env.USERPROFILE || process.env.HOME || '.', '.chromadon-youtube-tokens.json'),
                });
                console.log(`[CHROMADON] ✅ YouTube Token Manager initialized (authorized: ${youtubeTokenManager.isAuthorized()})`);
            }
            catch (ytError) {
                console.log(`[CHROMADON] ⚠️ YouTube init failed: ${ytError.message}`);
            }
            // Initialize Agentic Orchestrator with merged tools (browser + analytics + YouTube)
            const toolExecutor = (0, browser_tools_1.createToolExecutor)();
            // Merge additional tools: analytics + YouTube
            const additionalTools = [
                ...(analyticsDb ? analytics_tools_1.ANALYTICS_TOOLS : []),
                ...(youtubeTokenManager ? youtube_tools_1.YOUTUBE_TOOLS : []),
            ];
            // Create combined executor that routes to the right handler
            const analyticsExec = analyticsDb ? (0, analytics_executor_1.createAnalyticsExecutor)(analyticsDb) : null;
            const youtubeExec = youtubeTokenManager ? (0, youtube_executor_1.createYouTubeExecutor)(youtubeTokenManager) : null;
            const youtubeToolNames = new Set(youtube_tools_1.YOUTUBE_TOOLS.map(t => t.name));
            const combinedExecutor = additionalTools.length > 0
                ? async (toolName, input) => {
                    if (youtubeExec && youtubeToolNames.has(toolName))
                        return youtubeExec(toolName, input);
                    if (analyticsExec)
                        return analyticsExec(toolName, input);
                    return `Unknown additional tool: ${toolName}`;
                }
                : undefined;
            orchestrator = new agentic_orchestrator_1.AgenticOrchestrator(ANTHROPIC_API_KEY, toolExecutor, undefined, additionalTools.length > 0 ? additionalTools : undefined, combinedExecutor);
            console.log('[CHROMADON] ✅ Agentic Orchestrator initialized (Claude tool-use mode)');
            if (analyticsDb)
                console.log('[CHROMADON]    - 8 Analytics tools registered');
            if (youtubeTokenManager)
                console.log(`[CHROMADON]    - ${youtube_tools_1.YOUTUBE_TOOLS.length} YouTube tools registered`);
            // Initialize Social Overlord (queue execution engine)
            socialOverlord = new social_overlord_1.SocialOverlord(orchestrator, buildExecutionContext);
            console.log('[CHROMADON] ✅ Social Media Overlord initialized (queue execution)');
            // Initialize Data Collector (analytics scraping)
            if (analyticsDb) {
                dataCollector = new data_collector_1.DataCollector(orchestrator, buildExecutionContext, analyticsDb);
                console.log('[CHROMADON] ✅ Analytics Data Collector initialized (6h schedule)');
            }
        }
        catch (error) {
            console.log(`[CHROMADON] ⚠️ AI Engine init failed: ${error.message}`);
        }
    }
    else {
        console.log('[CHROMADON] ⚠️ ANTHROPIC_API_KEY not set - AI features disabled');
    }
    return new Promise((resolve) => {
        app.listen(PORT, () => {
            console.log(`\n[CHROMADON] ===========================================`);
            console.log(`[CHROMADON] 🚀 CHROMADON v4.0.0 - NEURAL RAG BRAIN ENABLED`);
            console.log(`[CHROMADON] Running on http://localhost:${PORT}`);
            console.log(`[CHROMADON] Mode: ${desktopAvailable ? 'DESKTOP' : connectionMode}`);
            console.log(`[CHROMADON] CDP Endpoint: ${CDP_ENDPOINT}`);
            console.log(`[CHROMADON] Desktop: ${desktopAvailable ? `ACTIVE (${CHROMADON_DESKTOP_URL})` : 'Not available'}`);
            console.log(`[CHROMADON] AI Engine: ${aiEngine ? 'Active' : 'Disabled'}`);
            console.log(`[CHROMADON] Pages: ${desktopAvailable ? 'via Desktop' : globalPages.length}`);
            console.log(`[CHROMADON] ===========================================\n`);
            console.log('[CHROMADON] Endpoints:');
            console.log('  GET  /health                - Health check');
            console.log('  GET  /api/pages             - List all pages');
            console.log('  POST /api/pages/select      - Select a page');
            console.log('  POST /api/pages/new         - Create new page');
            console.log('  POST /api/pages/close       - Close a page');
            console.log('  POST /api/navigate          - Navigate (url/back/forward/reload)');
            console.log('  POST /api/click             - Click element');
            console.log('  POST /api/hover             - Hover element');
            console.log('  POST /api/fill              - Fill form field');
            console.log('  POST /api/fill-form         - Fill multiple fields');
            console.log('  POST /api/type              - Type text');
            console.log('  POST /api/press             - Press key');
            console.log('  POST /api/scroll            - Scroll page/element');
            console.log('  POST /api/drag              - Drag and drop');
            console.log('  POST /api/upload            - Upload file');
            console.log('  POST /api/screenshot        - Take screenshot');
            console.log('  GET  /api/snapshot          - DOM snapshot with UIDs');
            console.log('  GET  /api/content           - Get page HTML');
            console.log('  POST /api/pdf               - Generate PDF');
            console.log('  POST /api/wait              - Wait for element');
            console.log('  POST /api/wait-for-text     - Wait for text');
            console.log('  POST /api/wait-for-navigation - Wait for navigation');
            console.log('  POST /api/dialog            - Handle dialog');
            console.log('  GET  /api/cookies           - Get cookies');
            console.log('  POST /api/cookies           - Set cookies');
            console.log('  DELETE /api/cookies         - Clear cookies');
            console.log('  GET  /api/console           - Get console messages');
            console.log('  DELETE /api/console         - Clear console');
            console.log('  POST /api/emulate           - Emulate settings');
            console.log('  POST /api/resize            - Resize viewport');
            console.log('  POST /api/evaluate          - Run JavaScript');
            console.log('  POST /api/verify            - Verify assertions');
            console.log('  POST /api/mission           - Execute NL mission');
            console.log('  POST /api/mission/ai        - AI-powered mission (Neural RAG Brain v3.0)');
            console.log('  GET  /api/ai/status         - AI Engine status');
            console.log('  POST /api/ai/reset-circuit  - Reset AI circuit breaker');
            console.log('  GET  /api/session           - Session status');
            console.log('  POST /api/session/start     - Start session');
            console.log('  POST /api/session/end       - End session');
            console.log('');
            console.log('[CHROMADON] 27-Agent System Endpoints:');
            console.log('  POST /api/agent/execute     - Natural language task');
            console.log('  POST /api/agent/social/page - Create business page');
            console.log('  POST /api/agent/social/post - Post to social media');
            console.log('  POST /api/agent/research    - Deep research');
            console.log('  POST /api/agent/cart/add    - Add to cart');
            console.log('  POST /api/agent/checkout    - Complete checkout');
            console.log('  POST /api/agent/extract     - Extract data');
            console.log('  POST /api/agent/book        - Make reservation');
            console.log('  POST /api/agent/form        - Fill form');
            console.log('  POST /api/agent/credentials - Store credentials');
            console.log('  GET  /api/agent/stats       - Agent statistics');
            console.log('');
            console.log('[CHROMADON] RALPH System Endpoints (Never Give Up!):');
            console.log('  GET  /api/ralph/status      - Get RALPH execution status');
            console.log('  POST /api/ralph/pause       - Pause RALPH execution');
            console.log('  POST /api/ralph/resume      - Resume RALPH execution');
            console.log('  POST /api/ralph/abort       - Abort RALPH execution');
            console.log('  POST /api/ralph/respond     - Respond to intervention request\n');
            console.log('[CHROMADON] Social Media Overlord Endpoints:');
            console.log('  POST /api/social/process        - Process single task (JSON)');
            console.log('  POST /api/social/process-stream - Process single task (SSE)');
            console.log('  POST /api/social/process-all    - Process task batch (SSE)\n');
            console.log('[CHROMADON] Analytics Dashboard Endpoints:');
            console.log('  GET  /api/analytics/overview          - Cross-platform overview');
            console.log('  GET  /api/analytics/platform/:plat    - Platform deep dive');
            console.log('  GET  /api/analytics/content           - Content performance');
            console.log('  GET  /api/analytics/audience/:plat    - Audience insights');
            console.log('  GET  /api/analytics/competitors       - Competitor analysis');
            console.log('  GET  /api/analytics/timing/:plat      - Posting schedule heatmap');
            console.log('  GET  /api/analytics/roi               - ROI metrics');
            console.log('  POST /api/analytics/report            - Generate full report');
            console.log('  POST /api/analytics/collect           - Trigger data collection\n');
            resolve();
        });
    });
}
exports.startServer = startServer;
// Run if called directly
startServer().catch(console.error);
//# sourceMappingURL=server.js.map