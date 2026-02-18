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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const api_1 = require("@opentelemetry/api");
// Neural RAG Brain v3.0 imports
const core_1 = require("../core");
// Agentic Orchestrator imports
const agentic_orchestrator_1 = require("../core/agentic-orchestrator");
const browser_tools_1 = require("../core/browser-tools");
const social_overlord_1 = require("../core/social-overlord");
const cortex_router_1 = require("../core/cortex-router");
// Analytics imports
const database_1 = require("../analytics/database");
const analytics_tools_1 = require("../analytics/analytics-tools");
const analytics_executor_1 = require("../analytics/analytics-executor");
const data_collector_1 = require("../analytics/data-collector");
// YouTube imports
const youtube_token_manager_1 = require("../youtube/youtube-token-manager");
const youtube_tools_1 = require("../youtube/youtube-tools");
const youtube_executor_1 = require("../youtube/youtube-executor");
const youtube_studio_tools_1 = require("../youtube/youtube-studio-tools");
const youtube_studio_executor_1 = require("../youtube/youtube-studio-executor");
const youtube_tool_bridge_1 = require("../agents/youtube-tool-bridge");
const social_tool_bridge_1 = require("../agents/social-tool-bridge");
// Client Context imports
const client_context_1 = require("../client-context");
const multer_1 = __importDefault(require("multer"));
const document_processor_1 = require("../client-context/document-processor");
// Skill Memory imports
const skills_1 = require("../skills");
// Autonomy Engine imports (visual verification + policy gate)
const autonomy_1 = require("../autonomy");
// Marketing Queue imports
const marketing_tools_1 = require("../marketing/marketing-tools");
const marketing_executor_1 = require("../marketing/marketing-executor");
// OBS Studio imports
const obs_1 = require("../obs");
// Social Media Monitoring imports
const monitoring_1 = require("../monitoring");
// THE_SCHEDULER imports
const scheduler_1 = require("../scheduler");
// v1.13.0 — Client Experience Engine modules
const activity_1 = require("../activity");
const onboarding_1 = require("../onboarding");
const templates_1 = require("../templates");
const proof_1 = require("../proof");
// Trinity Research imports
const trinity_1 = require("../trinity");
// Circuit Breaker for Desktop API calls
const circuit_breaker_1 = require("../core/circuit-breaker");
// MissionRegistry imports
const mission_1 = require("../core/mission");
// BudgetMonitor imports
const budget_1 = require("../core/budget");
// PulseBeacon imports
const monitoring_2 = require("../core/monitoring");
// Middleware imports
const middleware_1 = require("./middleware");
const request_logger_1 = require("./middleware/request-logger");
const logger_1 = require("../lib/logger");
// SessionWarmup imports
const session_1 = require("../core/session");
// ErrorChannel import
const error_channel_1 = require("../core/error-channel");
// Export router import
const export_1 = require("./routes/export");
// 27-Agent System imports
const agents_1 = require("../agents");
const log = (0, logger_1.createChildLogger)('api');
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.CHROMADON_PORT || 3001;
const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9222';
const CHROMADON_DESKTOP_URL = process.env.CHROMADON_DESKTOP_URL || 'http://127.0.0.1:3002';
const PREFER_DESKTOP = process.env.PREFER_DESKTOP !== 'false'; // Default true - route through Desktop when available
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(middleware_1.requestIdMiddleware);
app.use(request_logger_1.requestLoggerMiddleware);
app.use(middleware_1.brainAuthMiddleware);
// OpenTelemetry request tracing middleware
const tracer = api_1.trace.getTracer('chromadon-brain-api');
app.use((req, res, next) => {
    const span = tracer.startSpan(`${req.method} ${req.path}`, {
        attributes: {
            'http.method': req.method,
            'http.route': req.path,
            'http.url': req.originalUrl,
        },
    });
    res.on('finish', () => {
        span.setAttribute('http.status_code', res.statusCode);
        if (res.statusCode >= 400) {
            span.setStatus({ code: api_1.SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
        }
        span.end();
    });
    next();
});
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
let orchestratorInitError = null;
// 27-Agent System State
let agentSystem = null;
let cortexRouter = null;
// Analytics State
let analyticsDb = null;
let dataCollector = null;
// YouTube State
let youtubeTokenManager = null;
let youtubeExec = null;
// OBS Studio State
let obsClientInstance = null;
// Social Media Monitoring State
let socialMonitor = null;
let theScheduler = null;
// Trinity Intelligence State
let trinityIntelligence = null;
// v1.11.0 Sprint Components
let missionRegistry = null;
let budgetMonitor = null;
let pulseBeacon = null;
let sessionWarmup = null;
// Skill Memory (hoisted for diagnostics access)
let skillMemory = null;
// v1.13.0 — Client Experience Engine state
let activityLog = null;
let onboardingState = null;
let templateLoader = null;
let proofGenerator = null;
let isProcessingChat = false; // Busy lock flag for scheduler (Fix #1)
// Page registry for tab reuse by domain
const pageRegistry = new Map(); // domain -> pageIndex
// Abort controller tracking for stop functionality
const activeAbortControllers = new Map();
// Desktop routing state
let desktopAvailable = false;
let desktopTabIds = []; // Maps index -> Desktop tab ID
let desktopActiveTabId = null;
const activeTabRef = { tabId: null }; // Shared ref for visual_verify executor
// Circuit breaker for Desktop Control Server calls (prevents cascade failures when Desktop is restarting)
const desktopCircuitBreaker = new circuit_breaker_1.CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeoutMs: 10000,
    successThreshold: 2,
    halfOpenMaxAttempts: 2,
    failureWindowMs: 30000,
    enableLogging: true,
});
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
                log.info('[CHROMADON] ✅ Desktop routing ACTIVE (port 3002)');
                return true;
            }
            log.info(`[CHROMADON] Desktop health check attempt ${attempt}/${maxRetries}: windowReady=${data.windowReady}`);
        }
        catch {
            log.info(`[CHROMADON] Desktop health check attempt ${attempt}/${maxRetries}: connection failed`);
        }
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
    }
    desktopAvailable = false;
    log.info(`[CHROMADON] ⚠️ Desktop not available after ${maxRetries} attempts`);
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
    return desktopCircuitBreaker.execute(async () => {
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
    }, 'desktop:createTab');
}
/**
 * List all tabs from Desktop
 */
async function desktopListTabs() {
    return desktopCircuitBreaker.execute(async () => {
        const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs`);
        const data = await response.json();
        if (!data.success)
            throw new Error(data.error || 'Failed to list Desktop tabs');
        desktopTabIds = (data.tabs || []).map((t) => t.id);
        desktopActiveTabId = data.activeTabId ?? null;
        return data.tabs || [];
    }, 'desktop:listTabs');
}
/**
 * Focus a tab in Desktop by index (maps to tab ID)
 */
async function desktopFocusTab(tabId) {
    return desktopCircuitBreaker.execute(async () => {
        const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/focus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId }),
        });
        const data = await response.json();
        if (!data.success)
            throw new Error(data.error || 'Failed to focus Desktop tab');
        desktopActiveTabId = tabId;
    }, 'desktop:focusTab');
}
/**
 * Close a tab in Desktop
 */
async function desktopCloseTab(tabId) {
    return desktopCircuitBreaker.execute(async () => {
        const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId }),
        });
        const data = await response.json();
        if (!data.success)
            throw new Error(data.error || 'Failed to close Desktop tab');
    }, 'desktop:closeTab');
}
/**
 * Execute script in Desktop tab
 */
async function desktopExecuteScript(tabId, script) {
    return desktopCircuitBreaker.execute(async () => {
        const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, script }),
        });
        const data = await response.json();
        if (!data.success)
            throw new Error(data.error || 'Script execution failed');
        return data.result;
    }, 'desktop:executeScript');
}
/**
 * Get screenshot from Desktop tab
 */
async function desktopScreenshot(tabId) {
    return desktopCircuitBreaker.execute(async () => {
        const response = await fetch(`${CHROMADON_DESKTOP_URL}/tabs/screenshot/${tabId}`);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
    }, 'desktop:screenshot');
}
/**
 * Connect to existing Chrome via CDP (preserves login sessions!)
 */
async function connectViaCDP() {
    try {
        log.info(`[CHROMADON] Attempting CDP connection to ${CDP_ENDPOINT}...`);
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
        log.info(`[CHROMADON] ✅ CDP connection established!`);
        log.info(`[CHROMADON] ✅ Found ${globalPages.length} existing page(s)`);
        log.info(`[CHROMADON] ✅ Login sessions PRESERVED (Vercel, GitHub, etc.)`);
        return true;
    }
    catch (error) {
        log.info(`[CHROMADON] ⚠️ CDP connection failed: ${error.message}`);
        return false;
    }
}
/**
 * Launch fresh Chromium (fallback if CDP fails)
 */
async function launchFreshBrowser() {
    log.info(`[CHROMADON] Launching fresh Chromium browser...`);
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
    log.info(`[CHROMADON] ✅ Fresh browser launched`);
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
        log.info('[CHROMADON] DESKTOP mode - skipping browser launch (using Desktop BrowserViews via port 3002)');
        connectionMode = 'CDP'; // Report as CDP for compatibility, but no browser launched
        return;
    }
    // When PREFER_DESKTOP is true, NEVER launch external browsers
    // The user will start the Desktop app and restart Brain API
    if (PREFER_DESKTOP) {
        log.info('[CHROMADON] ⚠️ PREFER_DESKTOP=true but Desktop not available. Waiting for Desktop app...');
        log.info('[CHROMADON] ⚠️ No external browser will be launched. Start the Desktop app and restart Brain API.');
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
                    log.info(`[CHROMADON] Reusing existing page for ${targetDomain} (index ${pageIndex})`);
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
                        log.info(`[CHROMADON] Found existing page for ${targetDomain} at index ${i}`);
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
    log.info({ targetUrl: targetUrl || 'blank' }, 'Creating new page');
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
        log.info(`[CHROMADON] Browser disconnected, attempting graceful reconnect...`);
        // Try CDP reconnect first (don't launch new browser)
        const reconnected = await connectViaCDP();
        if (!reconnected) {
            log.info(`[CHROMADON] CDP reconnect failed, will use existing pages if available`);
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
 * Middleware: reject Playwright-era endpoints when running in DESKTOP mode.
 * Returns a clear 400 instead of letting getSelectedPage() throw a cryptic 500.
 */
function requirePlaywright(req, res, next) {
    if (desktopAvailable) {
        res.status(400).json({
            error: 'Endpoint unavailable in DESKTOP mode',
            hint: 'Use Desktop control server on :3002 instead',
        });
        return;
    }
    next();
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
    log.error({ err: err }, '[CHROMADON] Error:');
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
        version: process.env.npm_package_version || '1.8.2',
        mode: desktopAvailable ? 'DESKTOP' : connectionMode,
        cdpEndpoint: CDP_ENDPOINT,
        desktopUrl: desktopAvailable ? CHROMADON_DESKTOP_URL : undefined,
        desktopRouting: desktopAvailable,
        browserConnected: desktopAvailable || (globalBrowser?.isConnected() ?? false),
        pageCount: desktopAvailable ? desktopTabIds.length : globalPages.length,
        selectedPage: desktopAvailable ? (desktopActiveTabId ?? 0) : selectedPageIndex,
        orchestrator: !!orchestrator,
        orchestratorReason: orchestrator ? 'ready' : (process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY ? 'init_error' : 'no_api_key'),
        orchestratorError: orchestratorInitError || undefined,
        orchestratorSessions: orchestrator?.getSessionCount() ?? 0,
        analytics: !!analyticsDb,
        desktopCircuitBreaker: desktopCircuitBreaker.getMetrics(),
        uptime: Math.round((Date.now() - serverStartTime) / 1000),
        timestamp: new Date().toISOString(),
    });
});
// ==================== YOUTUBE OAUTH CALLBACK ====================
app.get('/api/youtube/oauth/callback', async (req, res) => {
    const code = req.query.code;
    const error = req.query.error;
    if (error) {
        res.status(400).send(`<html><body style="background:#0A0A0F;color:#FF6B6B;font-family:monospace;padding:40px;text-align:center;">
      <h1>YouTube Authorization Failed</h1><p>${error}</p>
      <p style="color:#888;">You can close this tab.</p></body></html>`);
        return;
    }
    if (!code) {
        res.status(400).send(`<html><body style="background:#0A0A0F;color:#FF6B6B;font-family:monospace;padding:40px;text-align:center;">
      <h1>Missing authorization code</h1><p>No code parameter received from Google.</p></body></html>`);
        return;
    }
    if (!youtubeTokenManager) {
        res.status(500).send(`<html><body style="background:#0A0A0F;color:#FF6B6B;font-family:monospace;padding:40px;text-align:center;">
      <h1>YouTube not configured</h1><p>YouTube Token Manager not initialized. Check API keys in settings.</p></body></html>`);
        return;
    }
    try {
        await youtubeTokenManager.exchangeCode(code, 'http://localhost:3001/api/youtube/oauth/callback');
        log.info('[YOUTUBE] OAuth callback received — tokens exchanged successfully');
        res.send(`<html><body style="background:#0A0A0F;color:#00CED1;font-family:monospace;padding:40px;text-align:center;">
      <h1 style="font-size:48px;">&#x2705;</h1>
      <h1>YouTube Authorized!</h1>
      <p style="color:#D4AF37;">CHROMADON now has full YouTube access.</p>
      <p style="color:#888;">You can close this tab.</p></body></html>`);
    }
    catch (err) {
        log.error({ err: err }, 'YouTube OAuth callback error');
        res.status(500).send(`<html><body style="background:#0A0A0F;color:#FF6B6B;font-family:monospace;padding:40px;text-align:center;">
      <h1>Token Exchange Failed</h1><p>${err.message}</p>
      <p style="color:#888;">Try the authorization flow again.</p></body></html>`);
    }
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
            log.info({ url: url || 'blank', platform }, 'Creating Desktop tab');
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
app.post('/api/navigate', requirePlaywright, async (req, res) => {
    try {
        const { url, type, waitFor, timeout } = req.body;
        const page = await getSelectedPage();
        log.info({ type: type || 'url', url }, 'Navigation');
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
app.post('/api/click', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, dblClick, description } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        log.info({ selector: targetSelector, description }, 'Click');
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
app.post('/api/hover', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        log.info(`[CHROMADON] 🖱️ Hover: ${targetSelector}`);
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
app.post('/api/fill', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, value, clearFirst } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || value === undefined) {
            res.status(400).json({ success: false, error: 'Selector/UID and value are required' });
            return;
        }
        log.info(`[CHROMADON] ✏️ Fill: ${targetSelector}`);
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
            log.info(`[CHROMADON] ✏️ Using contenteditable-safe fill`);
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
app.post('/api/fill-form', requirePlaywright, async (req, res) => {
    try {
        const { elements } = req.body;
        const page = await getSelectedPage();
        if (!elements || !Array.isArray(elements)) {
            res.status(400).json({ success: false, error: 'Elements array is required' });
            return;
        }
        log.info(`[CHROMADON] 📝 Filling ${elements.length} form fields`);
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
app.post('/api/type', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, text, delay } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || text === undefined) {
            res.status(400).json({ success: false, error: 'Selector/UID and text are required' });
            return;
        }
        log.info(`[CHROMADON] ⌨️ Type: ${targetSelector}`);
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
app.post('/api/press', requirePlaywright, async (req, res) => {
    try {
        const { key } = req.body;
        const page = await getSelectedPage();
        if (!key) {
            res.status(400).json({ success: false, error: 'Key is required' });
            return;
        }
        log.info(`[CHROMADON] ⌨️ Press: ${key}`);
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
app.post('/api/scroll', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, direction, amount, x, y } = req.body;
        const page = await getSelectedPage();
        log.info({ direction: direction || 'custom' }, 'Scroll');
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
app.post('/api/drag', requirePlaywright, async (req, res) => {
    try {
        const { fromSelector, fromUid, toSelector, toUid } = req.body;
        const page = await getSelectedPage();
        const from = fromUid ? `[data-chromadon-uid="${fromUid}"]` : fromSelector;
        const to = toUid ? `[data-chromadon-uid="${toUid}"]` : toSelector;
        if (!from || !to) {
            res.status(400).json({ success: false, error: 'From and To selectors/UIDs are required' });
            return;
        }
        log.info(`[CHROMADON] 🎯 Drag: ${from} → ${to}`);
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
app.post('/api/upload', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, filePath } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector || !filePath) {
            res.status(400).json({ success: false, error: 'Selector/UID and filePath are required' });
            return;
        }
        log.info(`[CHROMADON] 📁 Upload: ${filePath} to ${targetSelector}`);
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
app.post('/api/screenshot', requirePlaywright, async (req, res) => {
    try {
        const { fullPage, selector, uid, format, quality } = req.body;
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 📸 Screenshot`);
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
app.get('/api/snapshot', requirePlaywright, async (_req, res) => {
    try {
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 📋 DOM Snapshot`);
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
app.get('/api/content', requirePlaywright, async (_req, res) => {
    try {
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 📄 Page content`);
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
app.post('/api/pdf', requirePlaywright, async (req, res) => {
    try {
        const { format, landscape, printBackground } = req.body;
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 📑 Generate PDF`);
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
app.post('/api/wait', requirePlaywright, async (req, res) => {
    try {
        const { selector, uid, state, timeout } = req.body;
        const page = await getSelectedPage();
        const targetSelector = uid ? `[data-chromadon-uid="${uid}"]` : selector;
        if (!targetSelector) {
            res.status(400).json({ success: false, error: 'Selector or UID is required' });
            return;
        }
        log.info(`[CHROMADON] ⏳ Wait for: ${targetSelector}`);
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
app.post('/api/wait-for-text', requirePlaywright, async (req, res) => {
    try {
        const { text, timeout } = req.body;
        const page = await getSelectedPage();
        if (!text) {
            res.status(400).json({ success: false, error: 'Text is required' });
            return;
        }
        log.info(`[CHROMADON] ⏳ Wait for text: "${text}"`);
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
app.post('/api/wait-for-navigation', requirePlaywright, async (req, res) => {
    try {
        const { url, timeout } = req.body;
        const page = await getSelectedPage();
        log.info({ url }, 'Wait for navigation');
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
app.post('/api/dialog', requirePlaywright, async (req, res) => {
    try {
        const { action, promptText } = req.body;
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 🗨️ Dialog: ${action}`);
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
app.get('/api/cookies', requirePlaywright, async (_req, res) => {
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
app.post('/api/cookies', requirePlaywright, async (req, res) => {
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
app.delete('/api/cookies', requirePlaywright, async (_req, res) => {
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
app.get('/api/console', requirePlaywright, async (req, res) => {
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
app.delete('/api/console', requirePlaywright, async (_req, res) => {
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
app.post('/api/emulate', requirePlaywright, async (req, res) => {
    try {
        const { viewport, geolocation, locale, colorScheme } = req.body;
        const page = await getSelectedPage();
        log.info(`[CHROMADON] 🔧 Emulate settings`);
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
app.post('/api/resize', requirePlaywright, async (req, res) => {
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
app.post('/api/evaluate', requirePlaywright, async (req, res) => {
    try {
        const { script } = req.body;
        const page = await getSelectedPage();
        if (!script) {
            res.status(400).json({ success: false, error: 'Script is required' });
            return;
        }
        log.info(`[CHROMADON] 🔧 Evaluate script`);
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
app.post('/api/verify', requirePlaywright, async (req, res) => {
    try {
        const { assertions } = req.body;
        const page = await getSelectedPage();
        if (!assertions || !Array.isArray(assertions)) {
            res.status(400).json({ success: false, error: 'Assertions array is required' });
            return;
        }
        log.info(`[CHROMADON] 🔍 Verify ${assertions.length} assertions`);
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
app.post('/api/mission', requirePlaywright, async (req, res) => {
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
        log.info(`[CHROMADON] 🎯 Mission: ${intent}`);
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
            log.info('[CHROMADON] ⚠️ AI Engine not available, falling back to basic mission');
            res.status(503).json({
                success: false,
                error: 'Neural RAG AI Engine not initialized. Set ANTHROPIC_API_KEY or GEMINI_API_KEY environment variable.',
            });
            return;
        }
        // Desktop or CDP mode
        const useDesktop = desktopAvailable;
        let page = null;
        let desktopTabId = null;
        if (useDesktop) {
            desktopTabId = desktopActiveTabId;
            log.info({ desktopTabId, command }, 'AI Mission (Desktop)');
        }
        else {
            page = await getSelectedPage();
            log.info(`[CHROMADON] 🧠 AI Mission (CDP): ${command}`);
        }
        // Extract page context
        const pageContext = useDesktop
            ? await extractDesktopPageContext(desktopTabId)
            : await extractPageContext(page);
        // Process command with AI Engine
        const aiResponse = await aiEngine.processCommand(command, pageContext);
        log.info(`[CHROMADON] 🧠 AI Response: ${aiResponse.actions.length} actions, confidence: ${aiResponse.confidence}`);
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
        log.error({ err: error }, '[CHROMADON] AI Mission error:');
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
            error: 'Agentic Orchestrator not initialized. Set ANTHROPIC_API_KEY or GEMINI_API_KEY environment variable.',
        });
        return;
    }
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();
    // Prevent socket timeout on long-running SSE streams
    if (res.socket)
        res.socket.setTimeout(0);
    // Keep-alive heartbeat — prevents connection drops during long operations
    const keepAliveInterval = setInterval(() => {
        if (!closed) {
            try {
                res.write(':keepalive\n\n');
            }
            catch {
                closed = true;
            }
        }
    }, 15_000);
    // Sync Desktop state before building context (ensures desktopActiveTabId is current)
    const useDesktop = desktopAvailable;
    if (useDesktop) {
        try {
            await desktopListTabs();
        }
        catch { /* non-fatal */ }
    }
    // Sync active tab for visual_verify executor
    if (activeTabRef)
        activeTabRef.tabId = desktopActiveTabId;
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
        sessionRestoreAttempted: new Set(),
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
    isProcessingChat = true; // Fix #1: Busy lock — scheduler defers while user is chatting
    try {
        // CortexRouter: agent-first routing (simple commands → agents, copyright → monolithic, complex → TheCortex)
        await initializeCortexRouter();
        if (cortexRouter) {
            await cortexRouter.chat(sessionId, message, writer, context, pageContext);
        }
        else {
            // Fallback: direct to monolithic orchestrator
            await orchestrator.chat(sessionId, message, writer, context, pageContext);
        }
    }
    catch (error) {
        if (!closed) {
            writer.writeEvent('error', { message: error.message });
        }
    }
    finally {
        isProcessingChat = false; // Fix #1: Release busy lock
        clearInterval(keepAliveInterval);
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
        sessionRestoreAttempted: new Set(),
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
        log.info(`[SOCIAL OVERLORD] Processing task ${task.id}: ${task.platform}/${task.action}`);
        const result = await socialOverlord.processTask(task);
        log.info({ taskId: task.id, success: result.success, durationMs: result.durationMs }, 'Social Overlord task completed');
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
        log.info(`[SOCIAL OVERLORD] Processing batch of ${tasks.length} tasks`);
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
                    log.warn(`[CDP Adapter] Unhandled CDP method: ${method}`);
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
        log.warn('[DesktopBrowserAdapter] uploadFile not fully implemented');
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
                log.warn(`[DesktopBrowserAdapter] Unhandled CDP method: ${method}`);
                return { error: `Unsupported CDP method: ${method}` };
        }
    }
}
// Initialize CortexRouter (agent-first routing for chat)
async function initializeCortexRouter() {
    if (cortexRouter)
        return;
    if (!orchestrator)
        return;
    try {
        await initializeAgentSystem();
        if (!agentSystem) {
            log.info('[CHROMADON] ⚠️ CortexRouter skipped: agent system not available');
            return;
        }
        // Create YouTube bridge if executor is available
        let youtubeBridge;
        if (youtubeExec) {
            youtubeBridge = new youtube_tool_bridge_1.YouTubeToolBridge(youtubeExec);
            agentSystem.setYouTubeBridge(youtubeBridge);
            log.info('[CHROMADON] ✅ YouTube Tool Bridge connected to agent system');
        }
        // Create Social Media bridge if SocialOverlord is available
        let socialBridge;
        if (socialOverlord) {
            socialBridge = new social_tool_bridge_1.SocialMediaToolBridge(socialOverlord, trinityIntelligence || undefined);
            log.info({ hasTrinity: !!trinityIntelligence }, 'Social Media Tool Bridge connected');
        }
        // Inject SkillMemory into TheCortex for informed DAG planning
        const cortex = agentSystem.getCortex();
        if (skillMemory) {
            cortex.setSkillSummaryFn(() => skillMemory.getSkillsSummary());
            log.info('[CHROMADON] ✅ SkillMemory injected into TheCortex for DAG planning');
            // Wire TheLearningEngine to persist learning events to SkillMemory
            const learningEngine = agentSystem.getLearningEngine();
            learningEngine.setSkillPersistence((domain, taskName, success, durationMs, error) => {
                skillMemory.recordExecution(domain, taskName, success, durationMs, undefined, error);
            });
            log.info('[CHROMADON] ✅ TheLearningEngine wired to SkillMemory persistence');
        }
        cortexRouter = new cortex_router_1.CortexRouter({
            cortex,
            sequencer: agentSystem.getSequencer(),
            orchestrator,
            youtubeBridge,
            socialBridge,
        });
        log.info('[CHROMADON] ✅ CortexRouter initialized (agent-first routing)');
    }
    catch (error) {
        log.error({ err: error }, 'CortexRouter init failed');
    }
}
// Initialize agent system (called after browser is ready)
async function initializeAgentSystem() {
    if (!agentSystem) {
        try {
            log.info('[CHROMADON] 🔧 Attempting agent system init...');
            // Try Desktop adapter first if PREFER_DESKTOP is set
            if (PREFER_DESKTOP) {
                log.info('[CHROMADON] 🔧 PREFER_DESKTOP=true, checking Desktop availability...');
                const desktopAdapter = new DesktopBrowserAdapter();
                const desktopAvailable = await desktopAdapter.healthCheck();
                if (desktopAvailable) {
                    log.info('[CHROMADON] ✅ Using Desktop Browser Controller (port 3002)');
                    agentSystem = new agents_1.ChromadonAgentSystem(desktopAdapter);
                    log.info('[CHROMADON] ✅ 27-Agent System initialized with Desktop adapter');
                    return;
                }
                else {
                    log.info('[CHROMADON] ⚠️ Desktop not available, falling back to CDP...');
                }
            }
            // Fallback to CDP adapter
            log.info('[CHROMADON] 🔧 Creating CDP adapter...');
            const cdpAdapter = createCDPControllerAdapter();
            log.info('[CHROMADON] 🔧 CDP adapter created, instantiating ChromadonAgentSystem...');
            agentSystem = new agents_1.ChromadonAgentSystem(cdpAdapter);
            log.info('[CHROMADON] ✅ 27-Agent System initialized successfully');
        }
        catch (error) {
            log.error({ err: error }, '[CHROMADON] ❌ Agent System init FAILED:');
            log.error({ stack: error.stack }, 'Agent System stack trace');
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
        log.info(`[CHROMADON] 🤖 Agent Execute: ${task}`);
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
        log.info(`[CHROMADON] 🤖 Create ${platform} page: ${name}`);
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
        log.info(`[CHROMADON] 🤖 Post to ${platform}`);
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
        log.info(`[CHROMADON] 🤖 Research: ${topic}`);
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
        log.info(`[CHROMADON] 🤖 Add to cart: ${productUrl}`);
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
        log.info(`[CHROMADON] 🤖 Checkout`);
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
        log.info(`[CHROMADON] 🤖 Extract data from: ${url}`);
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
        log.info(`[CHROMADON] 🤖 Book ${type}`);
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
        log.info(`[CHROMADON] 🤖 Fill form: ${url}`);
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
        log.info(`[CHROMADON] 🤖 Store credentials: ${platform}`);
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
// ==================== SOCIAL MONITORING ====================
app.get('/api/monitoring/status', (_req, res) => {
    try {
        if (!socialMonitor) {
            res.json({ success: true, enabled: false, message: 'Social Monitor not initialized' });
            return;
        }
        const status = socialMonitor.getStatus();
        res.json({ success: true, ...status });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/monitoring/toggle', (req, res) => {
    try {
        if (!socialMonitor || !analyticsDb) {
            res.status(503).json({ success: false, error: 'Social Monitor not initialized' });
            return;
        }
        const { enabled, interval_minutes, platforms, max_replies_per_cycle } = req.body;
        if (enabled) {
            if (interval_minutes)
                socialMonitor.configure({ intervalMinutes: interval_minutes });
            if (platforms)
                socialMonitor.configure({ platforms });
            if (max_replies_per_cycle)
                socialMonitor.configure({ maxRepliesPerCycle: max_replies_per_cycle });
            socialMonitor.start();
            // Persist config
            analyticsDb.setMonitoringConfig({
                enabled: true,
                interval_minutes: socialMonitor.getConfig().intervalMinutes,
                platforms: socialMonitor.getConfig().platforms,
                max_replies_per_cycle: socialMonitor.getConfig().maxRepliesPerCycle,
            });
        }
        else {
            socialMonitor.stop();
            analyticsDb.setMonitoringConfig({
                enabled: false,
                interval_minutes: socialMonitor.getConfig().intervalMinutes,
                platforms: socialMonitor.getConfig().platforms,
                max_replies_per_cycle: socialMonitor.getConfig().maxRepliesPerCycle,
            });
        }
        const status = socialMonitor.getStatus();
        res.json({ success: true, ...status });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/monitoring/log', (req, res) => {
    try {
        if (!analyticsDb) {
            res.status(503).json({ success: false, error: 'Analytics not initialized' });
            return;
        }
        const platform = req.query.platform;
        const limit = parseInt(req.query.limit) || 20;
        const logs = analyticsDb.getMonitoringLog(platform, limit);
        res.json({ success: true, count: logs.length, entries: logs });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ==================== SCHEDULER ====================
app.get('/api/scheduler/status', (_req, res) => {
    try {
        if (!theScheduler) {
            res.json({ success: true, running: false, message: 'Scheduler not initialized' });
            return;
        }
        res.json({ success: true, ...theScheduler.getStatus() });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/scheduler/tasks', (req, res) => {
    try {
        if (!theScheduler) {
            res.json({ success: true, tasks: [] });
            return;
        }
        const tasks = theScheduler.getTasks({
            status: req.query.status,
            taskType: req.query.task_type,
        });
        res.json({ success: true, tasks });
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
app.get('/api/analytics/trinity', async (_req, res) => {
    try {
        if (!trinityIntelligence) {
            res.json({ success: true, data: { trends: [], audienceProfile: null, competitorInsights: [] } });
            return;
        }
        const [trends, audience, competitors] = await Promise.allSettled([
            trinityIntelligence.getTrendingTopics('linkedin'),
            trinityIntelligence.getAudienceInsights('linkedin'),
            trinityIntelligence.getCompetitorContent('linkedin', 'competitor'),
        ]);
        res.json({
            success: true,
            data: {
                trends: trends.status === 'fulfilled' ? trends.value : [],
                audienceProfile: audience.status === 'fulfilled' ? audience.value : null,
                competitorInsights: competitors.status === 'fulfilled' ? competitors.value : [],
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// ============================================================================
// CLIENT CONTEXT ENDPOINTS
// ============================================================================
// Multer upload handler for document uploads
const upload = (0, multer_1.default)({ dest: path.join(process.env.CHROMADON_DATA_DIR || process.cwd(), 'data', 'uploads') });
// --- Client Management ---
app.get('/api/client-context/clients', (_req, res) => {
    try {
        const storage = new client_context_1.ClientStorage();
        const clients = storage.listClients();
        res.json({ success: true, data: clients });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/clients/active', (_req, res) => {
    try {
        const storage = new client_context_1.ClientStorage();
        const activeId = storage.getActiveClientId();
        if (!activeId) {
            res.json({ success: true, data: null });
            return;
        }
        const client = storage.getClient(activeId);
        res.json({ success: true, data: client });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/clients/active', (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const result = storage.setActiveClient(clientId);
        res.json({ success: result, data: result ? storage.getClient(clientId) : null });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/clients/:id', (req, res) => {
    try {
        const storage = new client_context_1.ClientStorage();
        const context = storage.getFullContext(req.params.id);
        if (!context) {
            res.status(404).json({ success: false, error: 'Client not found' });
            return;
        }
        res.json({ success: true, data: context });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.delete('/api/client-context/clients/:id', (req, res) => {
    try {
        const storage = new client_context_1.ClientStorage();
        const deleted = storage.deleteClient(req.params.id);
        res.json({ success: deleted });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/clients', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            res.status(400).json({ success: false, error: 'name required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const client = storage.createClient(name);
        storage.setActiveClient(client.id);
        res.json({ success: true, data: client });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- Interview ---
app.post('/api/client-context/interview/start', async (req, res) => {
    try {
        const { clientName } = req.body;
        if (!clientName) {
            res.status(400).json({ success: false, error: 'clientName required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const interview = new client_context_1.InterviewEngine(storage);
        const client = storage.createClient(clientName);
        storage.setActiveClient(client.id);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'client_created', clientId: client.id })}\n\n`);
        const { state, greeting } = await interview.startInterview(client.id);
        res.write(`data: ${JSON.stringify({ type: 'phase', phase: state.currentPhase })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'message', role: 'assistant', content: greeting })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }
    catch (error) {
        log.error({ err: error }, 'Interview start error');
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
        else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }
});
app.post('/api/client-context/interview/chat', async (req, res) => {
    try {
        const { clientId, message } = req.body;
        if (!clientId || !message) {
            res.status(400).json({ success: false, error: 'clientId and message required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const interview = new client_context_1.InterviewEngine(storage);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const result = await interview.processResponse(clientId, message);
        if (result.phaseChanged) {
            res.write(`data: ${JSON.stringify({ type: 'phase_change', phase: result.newPhase, completedPhases: result.state.completedPhases })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: 'message', role: 'assistant', content: result.reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'progress', ...interview.getProgress(clientId) })}\n\n`);
        if (result.state.isComplete) {
            res.write(`data: ${JSON.stringify({ type: 'interview_complete' })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }
    catch (error) {
        log.error({ err: error }, 'Interview chat error');
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
        else {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
        }
    }
});
app.post('/api/client-context/interview/skip', async (req, res) => {
    try {
        const { clientId, phase } = req.body;
        if (!clientId || !phase) {
            res.status(400).json({ success: false, error: 'clientId and phase required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const interview = new client_context_1.InterviewEngine(storage);
        const state = await interview.skipToPhase(clientId, phase);
        res.json({ success: true, data: state });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/interview/state', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const interview = new client_context_1.InterviewEngine(storage);
        const progress = interview.getProgress(clientId);
        const state = storage.getInterviewState(clientId);
        res.json({ success: true, data: { progress, state } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/interview/resume', async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const interview = new client_context_1.InterviewEngine(storage);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        const { state, greeting } = await interview.resumeInterview(clientId);
        res.write(`data: ${JSON.stringify({ type: 'phase', phase: state.currentPhase })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'message', role: 'assistant', content: greeting })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- Document Knowledge Vault ---
app.post('/api/client-context/documents/upload', upload.single('file'), async (req, res) => {
    try {
        const clientId = req.body?.clientId;
        const file = req.file;
        if (!clientId || !file) {
            res.status(400).json({ success: false, error: 'clientId and file required' });
            return;
        }
        if (!document_processor_1.DocumentProcessor.isSupported(file.originalname)) {
            res.status(400).json({ success: false, error: `Unsupported file type: ${file.originalname}` });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const result = await vault.uploadDocument(clientId, file.path, file.originalname, file.mimetype);
        res.json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/documents/list', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const docs = vault.listDocuments(clientId);
        res.json({ success: true, data: docs });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/documents/:id/status', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const doc = vault.getDocument(clientId, req.params.id);
        if (!doc) {
            res.status(404).json({ success: false, error: 'Document not found' });
            return;
        }
        res.json({ success: true, data: { id: doc.id, status: doc.status, chunkCount: doc.chunkCount, errorMessage: doc.errorMessage } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.delete('/api/client-context/documents/:id', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const deleted = vault.deleteDocument(clientId, req.params.id);
        res.json({ success: deleted });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/knowledge/search', (req, res) => {
    try {
        const { clientId, query, topK } = req.body;
        if (!clientId || !query) {
            res.status(400).json({ success: false, error: 'clientId and query required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const results = vault.searchKnowledge(clientId, query, topK || 5);
        res.json({ success: true, data: results });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- Brand Assets (Media Vault) ---
const SUPPORTED_MEDIA_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.jfif',
    '.mp4', '.mov', '.avi', '.webm',
]);
function getAssetType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.jfif'].includes(ext))
        return 'image';
    if (['.mp4', '.mov', '.avi', '.webm'].includes(ext))
        return 'video';
    return null;
}
app.post('/api/client-context/media/upload', upload.single('file'), async (req, res) => {
    try {
        const clientId = req.body?.clientId;
        const file = req.file;
        if (!clientId || !file) {
            res.status(400).json({ success: false, error: 'clientId and file required' });
            return;
        }
        const ext = path.extname(file.originalname).toLowerCase();
        if (!SUPPORTED_MEDIA_EXTENSIONS.has(ext)) {
            res.status(400).json({ success: false, error: `Unsupported media type: ${ext}. Supported: ${[...SUPPORTED_MEDIA_EXTENSIONS].join(', ')}` });
            return;
        }
        const assetType = getAssetType(file.originalname);
        if (!assetType) {
            res.status(400).json({ success: false, error: 'Could not determine asset type' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const mediaDir = storage.getMediaStoragePath(clientId);
        const storedFilename = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const storedPath = path.join(mediaDir, storedFilename);
        fs.copyFileSync(file.path, storedPath);
        try {
            fs.unlinkSync(file.path);
        }
        catch { /* temp file cleanup */ }
        const stats = fs.statSync(storedPath);
        const { v4: uuid } = await import('uuid');
        const asset = {
            id: uuid(),
            clientId,
            filename: storedFilename,
            originalFilename: file.originalname,
            storedPath,
            mimeType: file.mimetype || `${assetType}/${ext.slice(1)}`,
            fileSize: stats.size,
            assetType: assetType,
            isPrimaryLogo: false,
            uploadedAt: new Date().toISOString(),
        };
        storage.addMediaAsset(clientId, asset);
        // If this is the first image asset, auto-set as primary logo
        const allAssets = storage.getMediaAssets(clientId);
        const imageAssets = allAssets.filter(a => a.assetType === 'image');
        if (imageAssets.length === 1 && assetType === 'image') {
            storage.setPrimaryLogo(clientId, asset.id);
            asset.isPrimaryLogo = true;
        }
        res.json({ success: true, data: asset });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/media/list', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const assets = storage.getMediaAssets(clientId);
        const primaryLogo = assets.find(a => a.isPrimaryLogo) || null;
        res.json({ success: true, data: { assets, primaryLogo, total: assets.length } });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.delete('/api/client-context/media/:id', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const deleted = storage.removeMediaAsset(clientId, req.params.id);
        res.json({ success: deleted });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/media/:id/primary', (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required in body' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const success = storage.setPrimaryLogo(clientId, req.params.id);
        if (!success) {
            res.status(404).json({ success: false, error: 'Asset not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/media/file/:id', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const assets = storage.getMediaAssets(clientId);
        const asset = assets.find((a) => a.id === req.params.id);
        if (!asset) {
            res.status(404).json({ success: false, error: 'Asset not found' });
            return;
        }
        if (!fs.existsSync(asset.storedPath)) {
            res.status(404).json({ success: false, error: 'File not found on disk' });
            return;
        }
        res.setHeader('Content-Type', asset.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(asset.storedPath).pipe(res);
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// --- Strategy ---
app.post('/api/client-context/strategy/generate', async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const engine = new client_context_1.StrategyEngine(storage, vault);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing business profile...' })}\n\n`);
        const strategy = await engine.generateStrategy(clientId);
        res.write(`data: ${JSON.stringify({ type: 'strategy', data: strategy })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/strategy/update', async (req, res) => {
    try {
        const { clientId, feedback } = req.body;
        if (!clientId || !feedback) {
            res.status(400).json({ success: false, error: 'clientId and feedback required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const engine = new client_context_1.StrategyEngine(storage, vault);
        const strategy = await engine.updateStrategy(clientId, feedback);
        res.json({ success: true, data: strategy });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/strategy/calendar', async (req, res) => {
    try {
        const { clientId, weeks } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const engine = new client_context_1.StrategyEngine(storage, vault);
        const calendar = await engine.generateContentCalendar(clientId, weeks || 4);
        res.json({ success: true, data: calendar });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/client-context/strategy/review', async (req, res) => {
    try {
        const { clientId } = req.body;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const vault = new client_context_1.KnowledgeVault(storage);
        const engine = new client_context_1.StrategyEngine(storage, vault);
        const review = await engine.weeklyReview(clientId);
        res.json({ success: true, data: review });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/client-context/strategy', (req, res) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) {
            res.status(400).json({ success: false, error: 'clientId query param required' });
            return;
        }
        const storage = new client_context_1.ClientStorage();
        const strategy = storage.getStrategy(clientId);
        res.json({ success: true, data: strategy });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// =========================================================================
// ERROR CHANNEL ROUTES (v1.11.0)
// =========================================================================
app.get('/api/errors/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const handler = (err) => {
        res.write(`data: ${JSON.stringify(err)}\n\n`);
    };
    error_channel_1.errorChannel.on('brain-error', handler);
    req.on('close', () => {
        error_channel_1.errorChannel.off('brain-error', handler);
    });
});
app.get('/api/errors/recent', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    res.json({ errors: error_channel_1.errorChannel.getRecent(limit) });
});
// =========================================================================
// CONTENT APPROVAL ROUTES (v1.11.0)
// =========================================================================
app.put('/api/missions/:id/approve', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    const mission = missionRegistry.get(req.params.id);
    if (!mission) {
        res.status(404).json({ error: 'Mission not found' });
        return;
    }
    if (mission.status !== 'QUEUED') {
        res.status(400).json({ error: `Cannot approve mission in ${mission.status} status (must be QUEUED)` });
        return;
    }
    missionRegistry.updateStatus(req.params.id, 'APPROVED');
    res.json({ success: true, message: `Mission ${req.params.id} approved` });
});
app.put('/api/missions/:id/cancel', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    const mission = missionRegistry.get(req.params.id);
    if (!mission) {
        res.status(404).json({ error: 'Mission not found' });
        return;
    }
    if (mission.status === 'COMPLETED' || mission.status === 'CANCELLED') {
        res.status(400).json({ error: `Cannot cancel mission in ${mission.status} status` });
        return;
    }
    missionRegistry.updateStatus(req.params.id, 'CANCELLED');
    res.json({ success: true, message: `Mission ${req.params.id} cancelled` });
});
app.get('/api/missions/pending-approval/:clientId', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    const queued = missionRegistry.listByClient(req.params.clientId, 100);
    const pending = queued.filter(m => m.status === 'QUEUED' && m.context.requiresApproval);
    res.json({ missions: pending });
});
// =========================================================================
// SYSTEM DIAGNOSTICS (v1.11.0) — auth-exempt
// =========================================================================
app.get('/api/system/diagnostics', (_req, res) => {
    const mem = process.memoryUsage();
    // Client context state
    let activeClient = null;
    try {
        const diagStorage = new client_context_1.ClientStorage();
        const activeId = diagStorage.getActiveClientId();
        if (activeId) {
            const info = diagStorage.getClient(activeId);
            activeClient = info ? { id: info.id, name: info.name } : { id: activeId, name: '(unknown)' };
        }
    }
    catch { /* non-critical */ }
    res.json({
        uptime: process.uptime(),
        memory: {
            heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
            rssMb: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
        },
        providers: orchestrator?.getProviderHealth() || null,
        routing: cortexRouter?.lastRouteDecision || null,
        activeClient,
        skills: skillMemory ? {
            ...skillMemory.getStats(),
            driftedTasks: skillMemory.getDriftedTasks().length,
        } : null,
        missions: missionRegistry?.getStats() || null,
        budget: budgetMonitor?.getGlobalStats() || null,
        sessions: sessionWarmup?.getStatuses() || null,
        beacon: pulseBeacon?.getStatus() || null,
        clientExperience: {
            activityLog: activityLog ? { todayEntries: activityLog.getToday().length } : null,
            onboarding: onboardingState ? { complete: onboardingState.isComplete() } : null,
            templates: templateLoader ? { count: templateLoader.loadTemplates().length } : null,
            proof: !!proofGenerator,
        },
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
    });
});
// =========================================================================
// SESSION STATUS (v1.11.0)
// =========================================================================
app.get('/api/sessions/status', (_req, res) => {
    if (!sessionWarmup) {
        res.status(503).json({ error: 'SessionWarmup not initialized' });
        return;
    }
    res.json(sessionWarmup.getStatuses());
});
// =========================================================================
// BUDGET MONITOR ROUTES (v1.11.0)
// =========================================================================
app.get('/api/budget/stats', (req, res) => {
    if (!budgetMonitor) {
        res.status(503).json({ error: 'BudgetMonitor not initialized' });
        return;
    }
    const sinceMs = req.query.since ? parseInt(req.query.since) : undefined;
    res.json(budgetMonitor.getGlobalStats(sinceMs));
});
app.get('/api/budget/client/:clientId', (req, res) => {
    if (!budgetMonitor) {
        res.status(503).json({ error: 'BudgetMonitor not initialized' });
        return;
    }
    const sinceMs = req.query.since ? parseInt(req.query.since) : undefined;
    res.json({ clientId: req.params.clientId, cost24h: budgetMonitor.getClientCost(req.params.clientId, sinceMs) });
});
app.get('/api/budget/fallbacks', (req, res) => {
    if (!budgetMonitor) {
        res.status(503).json({ error: 'BudgetMonitor not initialized' });
        return;
    }
    const sinceMs = req.query.since ? parseInt(req.query.since) : undefined;
    res.json(budgetMonitor.getFallbackStats(sinceMs));
});
// =========================================================================
// MISSION REGISTRY ROUTES (v1.11.0)
// =========================================================================
app.get('/api/missions/stats', (_req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    res.json(missionRegistry.getStats());
});
app.get('/api/missions/client/:clientId/stats', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    res.json(missionRegistry.getClientStats(req.params.clientId));
});
app.get('/api/missions/active/:clientId', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    res.json({ missions: missionRegistry.listActive(req.params.clientId) });
});
app.get('/api/missions/history/:clientId', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    const limit = parseInt(req.query.limit) || 50;
    res.json({ missions: missionRegistry.listByClient(req.params.clientId, limit) });
});
app.get('/api/missions/:id', (req, res) => {
    if (!missionRegistry) {
        res.status(503).json({ error: 'MissionRegistry not initialized' });
        return;
    }
    const mission = missionRegistry.get(req.params.id);
    if (!mission) {
        res.status(404).json({ error: 'Mission not found' });
        return;
    }
    res.json(mission);
});
// Analytics Export Router (v1.11.0)
try {
    const exportDbPath = process.env.CHROMADON_ANALYTICS_DB
        || path.join(process.env.APPDATA || process.env.HOME || '.', '.chromadon', 'analytics.db');
    app.use('/api/export', (0, export_1.createExportRouter)(exportDbPath));
}
catch { /* non-critical */ }
// Apply error handler
app.use(errorHandler);
// Cleanup on shutdown
async function cleanup() {
    log.info('[CHROMADON] Shutting down...');
    if (globalBrowser && connectionMode === 'FRESH') {
        try {
            await globalBrowser.close();
            log.info('[CHROMADON] Browser closed');
        }
        catch (e) {
            // Ignore
        }
    }
    else if (connectionMode === 'CDP') {
        log.info('[CHROMADON] CDP mode - browser left running');
    }
    // Disconnect OBS WebSocket
    if (obsClientInstance) {
        try {
            await obsClientInstance.disconnect();
            log.info('[CHROMADON] OBS disconnected');
        }
        catch (e) {
            // Ignore
        }
    }
    // Stop SessionWarmup
    if (sessionWarmup) {
        sessionWarmup.stop();
        log.info('[CHROMADON] SessionWarmup stopped');
    }
    // Stop PulseBeacon
    if (pulseBeacon) {
        pulseBeacon.stop();
        log.info('[CHROMADON] PulseBeacon stopped');
    }
    // Stop TheScheduler
    if (theScheduler) {
        theScheduler.destroy();
        log.info('[CHROMADON] TheScheduler stopped');
    }
    // Stop Social Monitor
    if (socialMonitor) {
        socialMonitor.destroy();
        log.info('[CHROMADON] Social Monitor stopped');
    }
    process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
// Crash protection - prevent silent process death
process.on('unhandledRejection', (reason, promise) => {
    log.error({ reason, promise }, 'Unhandled Promise Rejection');
    // Don't exit - keep server running
});
process.on('uncaughtException', (error) => {
    log.error({ err: error }, '[CHROMADON] ❌ Uncaught Exception:');
    // For truly fatal errors, attempt graceful shutdown
    if (error.message?.includes('EADDRINUSE') || error.message?.includes('out of memory')) {
        log.error(`[CHROMADON] ❌ Fatal error: ${error.message}`);
        process.exit(1); // Non-zero so Desktop restarts us
    }
    // Otherwise keep running - most uncaught exceptions are recoverable
});
// Start server
async function startServer() {
    // Log version for debugging client issues
    try {
        const pkg = require('../../package.json');
        log.info(`[CHROMADON] Brain version: ${pkg.version}`);
    }
    catch {
        log.info('[CHROMADON] Brain version: unknown');
    }
    // Check Desktop availability FIRST - before any browser launch
    await checkDesktopHealth();
    // Initialize browser connection (skipped in DESKTOP mode)
    await initializeBrowser();
    // Initialize Neural RAG AI Engine v3.0
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    // Hoist variables so orchestrator retry logic can access them
    let additionalTools = [];
    let combinedExecutor = null;
    // skillMemory is now module-level (hoisted for diagnostics)
    let clientStorage = null;
    let knowledgeVault = null;
    if (ANTHROPIC_API_KEY || GEMINI_API_KEY) {
        try {
            if (ANTHROPIC_API_KEY) {
                aiEngine = new core_1.NeuralRAGAIEngine(ANTHROPIC_API_KEY);
                log.info('[CHROMADON] ✅ Neural RAG AI Engine v3.0 initialized');
                log.info('[CHROMADON]    - Dual-Process Routing (System 1/System 2)');
                log.info('[CHROMADON]    - Self-Reflection Tokens [RET][REL][SUP][USE]');
                log.info('[CHROMADON]    - Hierarchical Memory (L0-L3)');
                log.info('[CHROMADON]    - Circuit Breaker Protection');
            }
            else {
                log.info('[CHROMADON] ⚠️ Neural RAG AI Engine skipped (no Anthropic key — Gemini only)');
            }
            // Initialize Analytics Database
            try {
                analyticsDb = new database_1.AnalyticsDatabase();
                log.info('[CHROMADON] ✅ Analytics Database initialized (SQLite)');
            }
            catch (dbError) {
                log.info(`[CHROMADON] ⚠️ Analytics DB init failed: ${dbError.message}`);
            }
            // Initialize MissionRegistry (shares analytics.db path)
            try {
                const missionDbPath = process.env.CHROMADON_ANALYTICS_DB
                    || path.join(process.env.APPDATA || process.env.HOME || '.', '.chromadon', 'analytics.db');
                missionRegistry = new mission_1.MissionRegistry(missionDbPath);
                const zombies = missionRegistry.failZombies();
                log.info({ zombiesCleaned: zombies }, 'MissionRegistry initialized');
            }
            catch (mrError) {
                log.info(`[CHROMADON] ⚠️ MissionRegistry init failed: ${mrError.message}`);
            }
            // Initialize BudgetMonitor (shares analytics.db path)
            try {
                const budgetDbPath = process.env.CHROMADON_ANALYTICS_DB
                    || path.join(process.env.APPDATA || process.env.HOME || '.', '.chromadon', 'analytics.db');
                budgetMonitor = new budget_1.BudgetMonitor(budgetDbPath);
                log.info('[CHROMADON] ✅ BudgetMonitor initialized');
            }
            catch (bmError) {
                log.info(`[CHROMADON] ⚠️ BudgetMonitor init failed: ${bmError.message}`);
            }
            // Initialize PulseBeacon
            try {
                pulseBeacon = new monitoring_2.PulseBeacon(missionRegistry, budgetMonitor);
                pulseBeacon.start();
                log.info('[CHROMADON] ✅ PulseBeacon started');
            }
            catch (pbError) {
                log.info(`[CHROMADON] ⚠️ PulseBeacon init failed: ${pbError.message}`);
            }
            // Initialize SessionWarmup
            try {
                sessionWarmup = new session_1.SessionWarmup(missionRegistry);
                sessionWarmup.start();
                log.info('[CHROMADON] ✅ SessionWarmup started');
            }
            catch (swError) {
                log.info(`[CHROMADON] ⚠️ SessionWarmup init failed: ${swError.message}`);
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
                log.info(`[CHROMADON] ✅ YouTube Token Manager initialized (authorized: ${youtubeTokenManager.isAuthorized()})`);
            }
            catch (ytError) {
                log.info(`[CHROMADON] ⚠️ YouTube init failed: ${ytError.message}`);
            }
            // Initialize Skill Memory
            // skillMemory declared above (hoisted for retry access)
            let skillExec = null;
            const skillToolNames = new Set(skills_1.SKILL_TOOLS.map(t => t.name));
            try {
                const skillDataDir = process.env.CHROMADON_DATA_DIR || process.env.USERPROFILE || process.env.HOME || '.';
                const skillDefaultsPath = path.join(process.env.CHROMADON_DATA_DIR || process.cwd(), 'skills.json');
                skillMemory = new skills_1.SkillMemory(skillDataDir, skillDefaultsPath);
                skillExec = (0, skills_1.createSkillExecutor)(skillMemory);
                log.info('[CHROMADON] ✅ Skill Memory initialized');
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Skill Memory init failed: ${err.message}`);
            }
            // Initialize Agentic Orchestrator with merged tools (browser + analytics + YouTube + skills)
            const toolExecutor = (0, browser_tools_1.createToolExecutor)();
            // Initialize Client Context Layer (non-critical — orchestrator works without it)
            // clientStorage, knowledgeVault declared above (hoisted for retry access)
            let clientContextExec = null;
            try {
                clientStorage = new client_context_1.ClientStorage();
                knowledgeVault = new client_context_1.KnowledgeVault(clientStorage);
                const interviewEngine = new client_context_1.InterviewEngine(clientStorage);
                const strategyEngine = new client_context_1.StrategyEngine(clientStorage, knowledgeVault);
                clientContextExec = new client_context_1.ClientContextExecutor(clientStorage, knowledgeVault);
                // Ensure a default client exists so the knowledge pipeline is always active
                const existingClients = clientStorage.listClients();
                if (existingClients.length === 0) {
                    const defaultClient = clientStorage.createClient('Default');
                    clientStorage.setActiveClient(defaultClient.id);
                    log.info(`[CHROMADON] Created default client: ${defaultClient.id}`);
                }
                else if (!clientStorage.getActiveClientId()) {
                    clientStorage.setActiveClient(existingClients[0].id);
                    log.info(`[CHROMADON] Activated existing client: ${existingClients[0].name}`);
                }
                log.info('[CHROMADON] ✅ Client Context Layer initialized');
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Client Context Layer init failed (non-critical): ${err.message}`);
            }
            // v1.13.0 — Initialize Client Experience Engine modules
            try {
                activityLog = new activity_1.ActivityLog();
                activityLog.pruneOldFiles();
                log.info('[CHROMADON] ✅ Activity Log initialized (JSONL, 30-day retention)');
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Activity Log init failed (non-critical): ${err.message}`);
            }
            try {
                onboardingState = new onboarding_1.OnboardingStatePersistence();
                const complete = onboardingState.isComplete();
                log.info({ complete }, 'Onboarding State initialized');
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Onboarding State init failed (non-critical): ${err.message}`);
            }
            try {
                templateLoader = new templates_1.TemplateLoader();
                templateLoader.ensureDefaults();
                const count = templateLoader.loadTemplates().length;
                log.info(`[CHROMADON] ✅ Template Loader initialized (${count} templates from file)`);
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Template Loader init failed (non-critical): ${err.message}`);
            }
            try {
                proofGenerator = new proof_1.ProofGenerator(CHROMADON_DESKTOP_URL);
                const pruned = proofGenerator.pruneOldProofs();
                log.info({ prunedByAge: pruned.deletedByAge, prunedBySize: pruned.deletedBySize }, "Proof Generator initialized");
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Proof Generator init failed (non-critical): ${err.message}`);
            }
            // Initialize OBS Studio client (non-blocking — server starts even if OBS is offline)
            let obsExec = null;
            const obsToolNames = new Set(obs_1.OBS_TOOLS.map(t => t.name));
            try {
                obsClientInstance = new obs_1.OBSClient();
                obsClientInstance.connect().catch(err => log.info({ detail: err.message }, '[CHROMADON] OBS not available:'));
                obsExec = (0, obs_1.createObsExecutor)(obsClientInstance, CHROMADON_DESKTOP_URL);
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ OBS init failed (non-critical): ${err.message}`);
            }
            // Trinity Intelligence + Research executor
            if (clientStorage && knowledgeVault) {
                trinityIntelligence = new trinity_1.TrinityIntelligence(clientStorage, knowledgeVault);
            }
            const trinityExec = (clientStorage && knowledgeVault)
                ? (0, trinity_1.createTrinityExecutor)(clientStorage, knowledgeVault, trinityIntelligence || undefined)
                : null;
            // Merge additional tools: analytics + YouTube + skills + client context + marketing + OBS + monitoring + scheduler + trinity
            // Filter out schedule_post and get_scheduled_posts from MARKETING_TOOLS — scheduler replaces them
            const schedulerReplacedTools = new Set(['schedule_post', 'get_scheduled_posts']);
            const filteredMarketingTools = marketing_tools_1.MARKETING_TOOLS.filter(t => !schedulerReplacedTools.has(t.name));
            additionalTools = [
                ...(analyticsDb ? analytics_tools_1.ANALYTICS_TOOLS : []),
                ...(youtubeTokenManager ? youtube_tools_1.YOUTUBE_TOOLS : []),
                ...youtube_studio_tools_1.YOUTUBE_STUDIO_TOOLS,
                ...(skillMemory ? skills_1.SKILL_TOOLS : []),
                ...(clientContextExec ? client_context_1.CLIENT_CONTEXT_TOOLS : []),
                ...filteredMarketingTools,
                ...(obsExec ? obs_1.OBS_TOOLS : []),
                ...monitoring_1.MONITORING_TOOLS,
                ...scheduler_1.SCHEDULER_TOOLS,
                ...(trinityExec ? [...trinity_1.TRINITY_TOOLS, ...trinity_1.TRINITY_INTELLIGENCE_TOOLS] : []),
                ...autonomy_1.VISUAL_VERIFY_TOOLS,
                ...autonomy_1.POLICY_TOOLS,
                ...(activityLog ? activity_1.ACTIVITY_TOOLS : []),
                ...(onboardingState ? onboarding_1.ONBOARDING_TOOLS : []),
                ...(templateLoader ? templates_1.TEMPLATE_TOOLS : []),
                ...(proofGenerator && activityLog ? proof_1.PROOF_TOOLS : []),
            ];
            // Create combined executor that routes to the right handler
            const analyticsExec = analyticsDb ? (0, analytics_executor_1.createAnalyticsExecutor)(analyticsDb) : null;
            youtubeExec = youtubeTokenManager ? (0, youtube_executor_1.createYouTubeExecutor)(youtubeTokenManager) : null;
            const youtubeToolNames = new Set(youtube_tools_1.YOUTUBE_TOOLS.map(t => t.name));
            const ytStudioExec = (0, youtube_studio_executor_1.createYouTubeStudioExecutor)(CHROMADON_DESKTOP_URL);
            const ytStudioToolNames = new Set(youtube_studio_tools_1.YOUTUBE_STUDIO_TOOLS.map(t => t.name));
            const marketingExec = (0, marketing_executor_1.createMarketingExecutor)(CHROMADON_DESKTOP_URL, analyticsDb);
            const marketingToolNames = new Set(filteredMarketingTools.map(t => t.name));
            const monitoringToolNames = new Set(monitoring_1.MONITORING_TOOLS.map(t => t.name));
            // Autonomy Engine executors (visual verify + policy gate)
            const policyExec = (0, autonomy_1.createPolicyExecutor)();
            const visualVerifyExec = (0, autonomy_1.createVisualVerifyExecutor)(CHROMADON_DESKTOP_URL, activeTabRef);
            // Scheduler executor — initialized after TheScheduler (see below). Uses a late-binding ref.
            let schedulerExec = null;
            // v1.13.0 — Client Experience Engine executors
            const activityExec = activityLog ? (0, activity_1.createActivityExecutor)(activityLog) : null;
            const onboardingExec = onboardingState ? (0, onboarding_1.createOnboardingExecutor)(onboardingState, CHROMADON_DESKTOP_URL) : null;
            let templateExec = null; // Late-bound after TheScheduler
            const proofExec = (proofGenerator && activityLog) ? (0, proof_1.createProofExecutor)(proofGenerator, activityLog) : null;
            combinedExecutor = async (toolName, input) => {
                // Scheduler tools — route BEFORE marketing (scheduler replaces schedule_post/get_scheduled_posts)
                if (scheduler_1.SCHEDULER_TOOL_NAMES.has(toolName) && schedulerExec)
                    return schedulerExec(toolName, input);
                if (obsExec && obsToolNames.has(toolName))
                    return obsExec(toolName, input);
                if (marketingToolNames.has(toolName))
                    return marketingExec(toolName, input);
                if (monitoringToolNames.has(toolName) && socialMonitor && analyticsDb) {
                    const monitoringExec = (0, monitoring_1.createMonitoringExecutor)(socialMonitor, analyticsDb);
                    return monitoringExec(toolName, input);
                }
                if ((trinity_1.TRINITY_TOOL_NAMES.has(toolName) || trinity_1.TRINITY_INTELLIGENCE_TOOL_NAMES.has(toolName)) && trinityExec)
                    return trinityExec(toolName, input);
                if (autonomy_1.POLICY_TOOL_NAMES.has(toolName))
                    return policyExec(toolName, input);
                if (autonomy_1.VISUAL_VERIFY_TOOL_NAMES.has(toolName))
                    return visualVerifyExec(toolName, input);
                if (activity_1.ACTIVITY_TOOL_NAMES.has(toolName) && activityExec)
                    return activityExec(toolName, input);
                if (onboarding_1.ONBOARDING_TOOL_NAMES.has(toolName) && onboardingExec)
                    return onboardingExec(toolName, input);
                if (templates_1.TEMPLATE_TOOL_NAMES.has(toolName) && templateExec)
                    return templateExec(toolName, input);
                if (proof_1.PROOF_TOOL_NAMES.has(toolName) && proofExec)
                    return proofExec(toolName, input);
                if (clientContextExec?.canHandle(toolName))
                    return clientContextExec.execute(toolName, input);
                if (skillExec && skillToolNames.has(toolName))
                    return skillExec(toolName, input);
                if (ytStudioToolNames.has(toolName))
                    return ytStudioExec(toolName, input);
                if (youtubeExec && youtubeToolNames.has(toolName))
                    return youtubeExec(toolName, input);
                if (analyticsExec)
                    return analyticsExec(toolName, input);
                return `Unknown additional tool: ${toolName}`;
            };
            orchestrator = new agentic_orchestrator_1.AgenticOrchestrator(ANTHROPIC_API_KEY || 'gemini-only-no-anthropic-fallback', toolExecutor, undefined, additionalTools, combinedExecutor, skillMemory ? () => skillMemory.getSkillsSummary() : () => '{}', clientStorage && knowledgeVault ? () => {
                const activeId = clientStorage.getActiveClientId();
                if (!activeId)
                    return null;
                return knowledgeVault.getClientContextSummary(activeId);
            } : () => null, 
            // Linked platforms — fetch authenticated social media sessions from Desktop
            desktopAvailable ? async () => {
                try {
                    const resp = await fetch(`${CHROMADON_DESKTOP_URL}/sessions`, { signal: AbortSignal.timeout(2000) });
                    const data = await resp.json();
                    const sessions = data.sessions || [];
                    const authenticated = sessions.filter((s) => s.isAuthenticated && s.platform !== 'google');
                    if (authenticated.length === 0)
                        return '';
                    return authenticated.map((s) => `- ${s.platform}${s.accountName ? ' (' + s.accountName + ')' : ''} (authenticated)`).join('\n');
                }
                catch {
                    return '';
                }
            } : async () => '', 
            // Onboarding context — injected into system prompt when incomplete, null when done (zero tokens)
            onboardingState ? () => onboardingState.getPromptContext() : () => null);
            orchestratorInitError = null; // Clear any previous error
            if (budgetMonitor)
                orchestrator.setBudgetMonitor(budgetMonitor);
            log.info('[CHROMADON] ✅ Agentic Orchestrator initialized (Claude tool-use mode)');
            if (analyticsDb)
                log.info('[CHROMADON]    - 8 Analytics tools registered');
            if (youtubeTokenManager)
                log.info(`[CHROMADON]    - ${youtube_tools_1.YOUTUBE_TOOLS.length} YouTube API tools registered`);
            log.info(`[CHROMADON]    - ${youtube_studio_tools_1.YOUTUBE_STUDIO_TOOLS.length} YouTube Studio tools registered`);
            if (skillMemory)
                log.info(`[CHROMADON]    - ${skills_1.SKILL_TOOLS.length} Skill Memory tools registered`);
            if (clientContextExec)
                log.info(`[CHROMADON]    - ${client_context_1.CLIENT_CONTEXT_TOOLS.length} Client Context tools registered`);
            log.info(`[CHROMADON]    - ${autonomy_1.VISUAL_VERIFY_TOOLS.length} Visual Verify + ${autonomy_1.POLICY_TOOLS.length} Policy tools registered`);
            log.info(`[CHROMADON]    - ${filteredMarketingTools.length} Marketing Queue tools registered`);
            log.info(`[CHROMADON]    - ${scheduler_1.SCHEDULER_TOOLS.length} Scheduler tools registered`);
            if (obsExec)
                log.info(`[CHROMADON]    - ${obs_1.OBS_TOOLS.length} OBS Studio tools registered`);
            if (trinityExec)
                log.info(`[CHROMADON]    - ${trinity_1.TRINITY_TOOLS.length + trinity_1.TRINITY_INTELLIGENCE_TOOLS.length} Trinity tools registered (${trinity_1.TRINITY_TOOLS.length} research + ${trinity_1.TRINITY_INTELLIGENCE_TOOLS.length} intelligence)`);
            // v1.13.0 Client Experience Engine tools
            const ceToolCount = (activityLog ? activity_1.ACTIVITY_TOOLS.length : 0) + (onboardingState ? onboarding_1.ONBOARDING_TOOLS.length : 0) + (templateLoader ? templates_1.TEMPLATE_TOOLS.length : 0) + (proofGenerator && activityLog ? proof_1.PROOF_TOOLS.length : 0);
            if (ceToolCount > 0)
                log.info(`[CHROMADON]    - ${ceToolCount} Client Experience tools (activity: ${activityLog ? activity_1.ACTIVITY_TOOLS.length : 0}, onboarding: ${onboardingState ? onboarding_1.ONBOARDING_TOOLS.length : 0}, templates: ${templateLoader ? templates_1.TEMPLATE_TOOLS.length : 0}, proof: ${proofGenerator && activityLog ? proof_1.PROOF_TOOLS.length : 0})`);
            // Initialize Social Overlord (queue execution engine)
            try {
                socialOverlord = new social_overlord_1.SocialOverlord(orchestrator, buildExecutionContext, analyticsDb || undefined);
                log.info('[CHROMADON] ✅ Social Media Overlord initialized (queue execution)');
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ Social Overlord init failed (non-critical): ${err.message}`);
            }
            // Initialize CortexRouter (agent-first routing for /api/orchestrator/chat)
            try {
                initializeCortexRouter();
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ CortexRouter init failed (non-critical): ${err.message}`);
            }
            // Initialize Data Collector (analytics scraping)
            if (analyticsDb) {
                try {
                    dataCollector = new data_collector_1.DataCollector(orchestrator, buildExecutionContext, analyticsDb);
                    log.info('[CHROMADON] ✅ Analytics Data Collector initialized (6h schedule)');
                }
                catch (err) {
                    log.info(`[CHROMADON] ⚠️ Data Collector init failed (non-critical): ${err.message}`);
                }
            }
            // Initialize Social Media Monitor (background comment monitoring)
            if (analyticsDb) {
                try {
                    socialMonitor = new monitoring_1.SocialMonitor(orchestrator, buildExecutionContext, analyticsDb, CHROMADON_DESKTOP_URL);
                    // Check DB for saved monitoring config
                    const savedConfig = analyticsDb.getMonitoringConfig();
                    if (savedConfig?.enabled) {
                        socialMonitor.configure({
                            intervalMinutes: savedConfig.interval_minutes,
                            platforms: JSON.parse(JSON.stringify(savedConfig.platforms)),
                            maxRepliesPerCycle: savedConfig.max_replies_per_cycle,
                        });
                        socialMonitor.start();
                        log.info(`[CHROMADON] ✅ Social Monitor initialized + STARTED (${savedConfig.interval_minutes}min interval)`);
                    }
                    else {
                        log.info('[CHROMADON] ✅ Social Monitor initialized (disabled — enable via chat)');
                    }
                }
                catch (err) {
                    log.info(`[CHROMADON] ⚠️ Social Monitor init failed (non-critical): ${err.message}`);
                }
            }
            // Initialize THE_SCHEDULER (Agent 0.2) — zero-cost when idle
            try {
                theScheduler = new scheduler_1.TheScheduler(orchestrator, buildExecutionContext, CHROMADON_DESKTOP_URL, socialMonitor || undefined, undefined, // config — use defaults (10s tick, 1 concurrent)
                () => isProcessingChat);
                schedulerExec = (0, scheduler_1.createSchedulerExecutor)(theScheduler, desktopAvailable ? async () => {
                    try {
                        const resp = await fetch(`${CHROMADON_DESKTOP_URL}/sessions`, { signal: AbortSignal.timeout(2000) });
                        const data = await resp.json();
                        const sessions = data.sessions || [];
                        return sessions
                            .filter((s) => s.isAuthenticated && s.platform !== 'google')
                            .map((s) => s.platform.toLowerCase());
                    }
                    catch {
                        return [];
                    }
                } : undefined, clientStorage ? () => {
                    const activeId = clientStorage.getActiveClientId();
                    if (!activeId)
                        return null;
                    const primaryLogo = clientStorage.getPrimaryLogo(activeId);
                    const assets = clientStorage.getMediaAssets(activeId);
                    const primaryVideo = assets.find(a => a.assetType === 'video');
                    return {
                        primaryLogo: primaryLogo?.storedPath || null,
                        primaryVideo: primaryVideo?.storedPath || null,
                    };
                } : undefined, trinityIntelligence);
                theScheduler.start();
                const status = theScheduler.getStatus();
                log.info(`[CHROMADON] ✅ TheScheduler initialized + STARTED (${status.pendingCount} pending task(s))`);
                // Late-bind template executor now that TheScheduler exists
                if (templateLoader) {
                    templateExec = (0, templates_1.createTemplateExecutor)(templateLoader, theScheduler);
                    log.info('[CHROMADON]    - Template executor bound to TheScheduler');
                }
            }
            catch (err) {
                log.info(`[CHROMADON] ⚠️ TheScheduler init failed (non-critical): ${err.message}`);
                // Template executor still works without scheduler (no scheduling, immediate execution only)
                if (templateLoader) {
                    templateExec = (0, templates_1.createTemplateExecutor)(templateLoader);
                }
            }
        }
        catch (error) {
            orchestratorInitError = error.message;
            log.error(`[CHROMADON] ❌ Orchestrator init FAILED: ${error.message}`);
            log.error(`[CHROMADON]    Stack: ${error.stack}`);
        }
        // Retry orchestrator init if it failed (transient errors, timing issues)
        if (!orchestrator && orchestratorInitError) {
            const MAX_INIT_RETRIES = 5;
            const RETRY_DELAYS = [5000, 10000, 15000, 20000, 25000]; // Progressive backoff
            for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
                const delay = RETRY_DELAYS[attempt - 1] || 25000;
                log.info(`[CHROMADON] Retrying orchestrator init in ${delay / 1000}s (attempt ${attempt}/${MAX_INIT_RETRIES})...`);
                await new Promise(r => setTimeout(r, delay));
                try {
                    const toolExecutorRetry = (0, browser_tools_1.createToolExecutor)();
                    orchestrator = new agentic_orchestrator_1.AgenticOrchestrator(ANTHROPIC_API_KEY || 'gemini-only-no-anthropic-fallback', toolExecutorRetry, undefined, additionalTools || [], combinedExecutor || (async () => 'Tool not available during retry'), skillMemory ? () => skillMemory.getSkillsSummary() : () => '{}', clientStorage && knowledgeVault ? () => {
                        const activeId = clientStorage.getActiveClientId();
                        if (!activeId)
                            return null;
                        return knowledgeVault.getClientContextSummary(activeId);
                    } : () => null, desktopAvailable ? async () => {
                        try {
                            const resp = await fetch(`${CHROMADON_DESKTOP_URL}/sessions`, { signal: AbortSignal.timeout(2000) });
                            const data = await resp.json();
                            const sessions = data.sessions || [];
                            const authenticated = sessions.filter((s) => s.isAuthenticated && s.platform !== 'google');
                            if (authenticated.length === 0)
                                return '';
                            return authenticated.map((s) => `- ${s.platform}${s.accountName ? ' (' + s.accountName + ')' : ''} (authenticated)`).join('\n');
                        }
                        catch {
                            return '';
                        }
                    } : async () => '', onboardingState ? () => onboardingState.getPromptContext() : () => null);
                    orchestratorInitError = null;
                    log.info(`[CHROMADON] ✅ Orchestrator initialized on retry attempt ${attempt}`);
                    break;
                }
                catch (retryErr) {
                    orchestratorInitError = retryErr.message;
                    log.error(`[CHROMADON] ❌ Orchestrator retry ${attempt}/${MAX_INIT_RETRIES} failed: ${retryErr.message}`);
                    log.error(`[CHROMADON]    Stack: ${retryErr.stack}`);
                    if (attempt === MAX_INIT_RETRIES) {
                        orchestratorInitError = `Failed after ${MAX_INIT_RETRIES + 1} attempts: ${retryErr.message}. Check API keys in Settings.`;
                        log.error(`[CHROMADON] ❌ All orchestrator init retries exhausted. Brain running without AI.`);
                    }
                }
            }
        }
    }
    else {
        log.info('[CHROMADON] ⚠️ No API keys set (ANTHROPIC_API_KEY or GEMINI_API_KEY) — AI features disabled');
    }
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            // Prevent Node.js from killing idle SSE connections (default keepAliveTimeout is 5s)
            server.keepAliveTimeout = 120_000; // 2 minutes
            server.headersTimeout = 125_000; // must be > keepAliveTimeout
            log.info(`\n[CHROMADON] ===========================================`);
            log.info(`[CHROMADON] 🚀 CHROMADON v4.0.0 - NEURAL RAG BRAIN ENABLED`);
            log.info(`[CHROMADON] Running on http://localhost:${PORT}`);
            log.info({ mode: desktopAvailable ? 'DESKTOP' : connectionMode }, 'Mode');
            log.info(`[CHROMADON] CDP Endpoint: ${CDP_ENDPOINT}`);
            log.info({ desktopAvailable, desktopUrl: CHROMADON_DESKTOP_URL }, 'Desktop status');
            log.info({ aiEngine: !!aiEngine }, 'AI Engine status');
            log.info({ pages: desktopAvailable ? 'via Desktop' : globalPages.length }, 'Pages');
            log.info(`[CHROMADON] ===========================================\n`);
            log.info('[CHROMADON] Endpoints:');
            log.info('  GET  /health                - Health check');
            log.info('  GET  /api/pages             - List all pages');
            log.info('  POST /api/pages/select      - Select a page');
            log.info('  POST /api/pages/new         - Create new page');
            log.info('  POST /api/pages/close       - Close a page');
            log.info('  POST /api/navigate          - Navigate (url/back/forward/reload)');
            log.info('  POST /api/click             - Click element');
            log.info('  POST /api/hover             - Hover element');
            log.info('  POST /api/fill              - Fill form field');
            log.info('  POST /api/fill-form         - Fill multiple fields');
            log.info('  POST /api/type              - Type text');
            log.info('  POST /api/press             - Press key');
            log.info('  POST /api/scroll            - Scroll page/element');
            log.info('  POST /api/drag              - Drag and drop');
            log.info('  POST /api/upload            - Upload file');
            log.info('  POST /api/screenshot        - Take screenshot');
            log.info('  GET  /api/snapshot          - DOM snapshot with UIDs');
            log.info('  GET  /api/content           - Get page HTML');
            log.info('  POST /api/pdf               - Generate PDF');
            log.info('  POST /api/wait              - Wait for element');
            log.info('  POST /api/wait-for-text     - Wait for text');
            log.info('  POST /api/wait-for-navigation - Wait for navigation');
            log.info('  POST /api/dialog            - Handle dialog');
            log.info('  GET  /api/cookies           - Get cookies');
            log.info('  POST /api/cookies           - Set cookies');
            log.info('  DELETE /api/cookies         - Clear cookies');
            log.info('  GET  /api/console           - Get console messages');
            log.info('  DELETE /api/console         - Clear console');
            log.info('  POST /api/emulate           - Emulate settings');
            log.info('  POST /api/resize            - Resize viewport');
            log.info('  POST /api/evaluate          - Run JavaScript');
            log.info('  POST /api/verify            - Verify assertions');
            log.info('  POST /api/mission           - Execute NL mission');
            log.info('  POST /api/mission/ai        - AI-powered mission (Neural RAG Brain v3.0)');
            log.info('  GET  /api/ai/status         - AI Engine status');
            log.info('  POST /api/ai/reset-circuit  - Reset AI circuit breaker');
            log.info('  GET  /api/session           - Session status');
            log.info('  POST /api/session/start     - Start session');
            log.info('  POST /api/session/end       - End session');
            log.info('');
            log.info('[CHROMADON] 27-Agent System Endpoints:');
            log.info('  POST /api/agent/execute     - Natural language task');
            log.info('  POST /api/agent/social/page - Create business page');
            log.info('  POST /api/agent/social/post - Post to social media');
            log.info('  POST /api/agent/research    - Deep research');
            log.info('  POST /api/agent/cart/add    - Add to cart');
            log.info('  POST /api/agent/checkout    - Complete checkout');
            log.info('  POST /api/agent/extract     - Extract data');
            log.info('  POST /api/agent/book        - Make reservation');
            log.info('  POST /api/agent/form        - Fill form');
            log.info('  POST /api/agent/credentials - Store credentials');
            log.info('  GET  /api/agent/stats       - Agent statistics');
            log.info('');
            log.info('[CHROMADON] RALPH System Endpoints (Never Give Up!):');
            log.info('  GET  /api/ralph/status      - Get RALPH execution status');
            log.info('  POST /api/ralph/pause       - Pause RALPH execution');
            log.info('  POST /api/ralph/resume      - Resume RALPH execution');
            log.info('  POST /api/ralph/abort       - Abort RALPH execution');
            log.info('  POST /api/ralph/respond     - Respond to intervention request\n');
            log.info('[CHROMADON] Social Media Overlord Endpoints:');
            log.info('  POST /api/social/process        - Process single task (JSON)');
            log.info('  POST /api/social/process-stream - Process single task (SSE)');
            log.info('  POST /api/social/process-all    - Process task batch (SSE)\n');
            log.info('[CHROMADON] Analytics Dashboard Endpoints:');
            log.info('  GET  /api/analytics/overview          - Cross-platform overview');
            log.info('  GET  /api/analytics/platform/:plat    - Platform deep dive');
            log.info('  GET  /api/analytics/content           - Content performance');
            log.info('  GET  /api/analytics/audience/:plat    - Audience insights');
            log.info('  GET  /api/analytics/competitors       - Competitor analysis');
            log.info('  GET  /api/analytics/timing/:plat      - Posting schedule heatmap');
            log.info('  GET  /api/analytics/roi               - ROI metrics');
            log.info('  POST /api/analytics/report            - Generate full report');
            log.info('  POST /api/analytics/collect           - Trigger data collection\n');
            log.info('[CHROMADON] Client Context Endpoints:');
            log.info('  GET  /api/client-context/clients           - List all clients');
            log.info('  GET  /api/client-context/clients/:id       - Get client context');
            log.info('  POST /api/client-context/clients/active    - Set active client');
            log.info('  GET  /api/client-context/clients/active    - Get active client');
            log.info('  DELETE /api/client-context/clients/:id     - Delete client');
            log.info('  POST /api/client-context/interview/start   - Start interview (SSE)');
            log.info('  POST /api/client-context/interview/chat    - Interview chat (SSE)');
            log.info('  POST /api/client-context/interview/skip    - Skip to phase');
            log.info('  GET  /api/client-context/interview/state   - Get interview state');
            log.info('  POST /api/client-context/interview/resume  - Resume interview (SSE)');
            log.info('  POST /api/client-context/documents/upload  - Upload document');
            log.info('  GET  /api/client-context/documents/list    - List documents');
            log.info('  GET  /api/client-context/documents/:id/status - Doc status');
            log.info('  DELETE /api/client-context/documents/:id   - Delete document');
            log.info('  POST /api/client-context/knowledge/search  - Search knowledge');
            log.info('  POST /api/client-context/strategy/generate - Generate strategy (SSE)');
            log.info('  POST /api/client-context/strategy/update   - Update with feedback');
            log.info('  POST /api/client-context/strategy/calendar - Generate calendar');
            log.info('  POST /api/client-context/strategy/review   - Weekly review');
            log.info('  GET  /api/client-context/strategy          - Get strategy\n');
            resolve();
        });
        server.on('error', (err) => {
            log.error(`[CHROMADON] ❌ Server failed to bind port ${PORT}: ${err.message}`);
            reject(err);
        });
    });
}
exports.startServer = startServer;
// Run if called directly — exit with code 1 on fatal failure so Desktop restarts us
startServer().catch((err) => {
    log.error({ err: err.message }, '[CHROMADON] ❌ Fatal: Server failed to start:');
    process.exit(1);
});
//# sourceMappingURL=server.js.map