"use strict";
/**
 * CHROMADON Browser Tools - Claude Tool Definitions + Executor
 *
 * 14 browser automation tools defined in Anthropic Tool[] schema format.
 * The ToolExecutor bridges to Desktop BrowserView or CDP/Playwright execution.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToolExecutor = exports.BROWSER_TOOLS = exports.attemptSessionRestore = exports.detectPlatformFromUrl = void 0;
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('browser');
// ============================================================================
// SESSION RESTORE UTILITIES
// ============================================================================
const PLATFORM_URL_MAP = [
    { patterns: [/google\.com/i, /youtube\.com/i, /accounts\.google/i], platform: 'google' },
    { patterns: [/twitter\.com/i, /x\.com/i], platform: 'twitter' },
    { patterns: [/linkedin\.com/i], platform: 'linkedin' },
    { patterns: [/facebook\.com/i, /fb\.com/i], platform: 'facebook' },
    { patterns: [/instagram\.com/i], platform: 'instagram' },
    { patterns: [/tiktok\.com/i], platform: 'tiktok' },
];
/**
 * Detect which platform a URL belongs to (matches Desktop session partition names).
 * Returns null for unrecognized domains.
 */
function detectPlatformFromUrl(url) {
    try {
        const hostname = new URL(url).hostname;
        for (const entry of PLATFORM_URL_MAP) {
            if (entry.patterns.some(p => p.test(hostname)))
                return entry.platform;
        }
    }
    catch { /* invalid URL */ }
    return null;
}
exports.detectPlatformFromUrl = detectPlatformFromUrl;
/**
 * Attempt to restore a platform session via the Desktop Control Server's backup/restore endpoint.
 * Returns true if restore succeeded, false otherwise.
 */
async function attemptSessionRestore(platform, desktopUrl) {
    const password = process.env.SESSION_BACKUP_PASSWORD;
    if (!password) {
        log.info(`[SESSION RESTORE] No SESSION_BACKUP_PASSWORD set — skipping restore for ${platform}`);
        return false;
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(`${desktopUrl}/sessions/${platform}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await resp.json();
        if (data.success) {
            log.info(`[SESSION RESTORE] ✅ Restored ${platform} session (${data.cookiesRestored || '?'} cookies)`);
            return true;
        }
        log.info(`[SESSION RESTORE] ❌ Restore failed for ${platform}: ${data.error || 'unknown'}`);
        return false;
    }
    catch (err) {
        log.info(`[SESSION RESTORE] ❌ Restore request failed for ${platform}: ${err.message}`);
        return false;
    }
}
exports.attemptSessionRestore = attemptSessionRestore;
/**
 * Sanitize a navigation URL from LLM output.
 * Strips natural language prefixes/suffixes, adds protocol if missing, validates.
 */
function sanitizeNavigationUrl(raw) {
    let url = raw.trim();
    // Strip NL prefixes the LLM might embed
    url = url.replace(/^(go\s+to|open|navigate\s+to|visit|head\s+to|browse\s+to)\s+/i, '');
    // Strip compound tails ("and search for...", "then click...", "and post about...")
    url = url.replace(/\s+(and|then|&)\s+.*/i, '');
    // Remove surrounding quotes
    url = url.replace(/^["'`]+|["'`]+$/g, '');
    url = url.trim();
    // Add protocol if missing
    if (url && !/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    // Validate
    try {
        new URL(url);
    }
    catch {
        // If invalid, return original — let the browser handle the error
        return raw.trim();
    }
    return url;
}
// ============================================================================
// TOOL DEFINITIONS (Anthropic Tool[] format)
// ============================================================================
exports.BROWSER_TOOLS = [
    {
        name: 'navigate',
        description: 'Navigate to a URL.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'The full URL to navigate to (include https://)' },
            },
            required: ['url'],
        },
    },
    {
        name: 'click',
        description: 'Click an element by CSS selector or visible text. Pierces Shadow DOM.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector (e.g. #btn, [data-testid="submit"]). Preferred when available.' },
                text: { type: 'string', description: 'Visible text to click (e.g. "Submit", "Log in"). Use when no good selector exists.' },
            },
        },
    },
    {
        name: 'type_text',
        description: 'Type text into an input/textarea. Clears existing text by default.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the input element' },
                text: { type: 'string', description: 'The text to type into the element' },
                clearFirst: { type: 'boolean', description: 'Whether to clear existing text before typing. Defaults to true.' },
            },
            required: ['selector', 'text'],
        },
    },
    {
        name: 'scroll',
        description: 'Scroll the page or a scrollable container.',
        input_schema: {
            type: 'object',
            properties: {
                direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Direction to scroll' },
                amount: { type: 'number', description: 'Pixels to scroll. Defaults to 500.' },
                selector: { type: 'string', description: 'CSS selector of a specific element to scroll into view instead' },
            },
            required: ['direction'],
        },
    },
    {
        name: 'press_key',
        description: 'Press a keyboard key (Enter, Tab, Escape, Backspace, arrow keys, etc.).',
        input_schema: {
            type: 'object',
            properties: {
                key: { type: 'string', description: 'Key to press: Enter, Tab, Escape, Backspace, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space' },
            },
            required: ['key'],
        },
    },
    {
        name: 'wait',
        description: 'Wait for a specified number of seconds.',
        input_schema: {
            type: 'object',
            properties: {
                seconds: { type: 'number', description: 'Number of seconds to wait (1-30)' },
            },
            required: ['seconds'],
        },
    },
    {
        name: 'take_screenshot',
        description: 'Screenshot the current page. Returns an image of what is visible.',
        input_schema: {
            type: 'object',
            properties: {
                fullPage: { type: 'boolean', description: 'Whether to capture the full scrollable page. Defaults to false (viewport only).' },
            },
        },
    },
    {
        name: 'extract_text',
        description: 'Extract text from the page or a specific element.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to extract text from. If omitted, extracts from the visible page body.' },
            },
        },
    },
    {
        name: 'select_option',
        description: 'Select a dropdown option by value or visible text.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the <select> element' },
                value: { type: 'string', description: 'The value attribute or visible text of the option to select' },
            },
            required: ['selector', 'value'],
        },
    },
    {
        name: 'hover',
        description: 'Hover over an element. Triggers tooltips, dropdowns, hover effects. Pierces Shadow DOM.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the element to hover over' },
                text: { type: 'string', description: 'Text content of the element to hover over (alternative to selector)' },
            },
        },
    },
    {
        name: 'hover_and_click',
        description: 'Hover then click inside the tooltip/popup. Atomic action for dropdown menus.',
        input_schema: {
            type: 'object',
            properties: {
                hoverSelector: { type: 'string', description: 'CSS selector of the element to hover over' },
                hoverText: { type: 'string', description: 'Text content of the element to hover over (alternative to hoverSelector)' },
                clickText: { type: 'string', description: 'Text of the button/link to click inside the tooltip' },
                waitMs: { type: 'number', description: 'Milliseconds to wait for tooltip to appear (default: 800)' },
            },
            required: ['clickText'],
        },
    },
    {
        name: 'get_page_context',
        description: 'Get page URL, title, and interactive elements.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_tabs',
        description: 'List all open browser tabs.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'switch_tab',
        description: 'Switch to a different browser tab by ID.',
        input_schema: {
            type: 'object',
            properties: {
                tabId: { type: 'number', description: 'The ID of the tab to switch to (from list_tabs)' },
            },
            required: ['tabId'],
        },
    },
    {
        name: 'create_tab',
        description: 'Open a new browser tab, optionally navigating to a URL. Uses authenticated sessions.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to open in the new tab. Omit for a blank tab.' },
            },
        },
    },
    {
        name: 'close_tab',
        description: 'Close a browser tab by its ID. Use list_tabs first to get tab IDs.',
        input_schema: {
            type: 'object',
            properties: {
                tabId: { type: 'number', description: 'The ID of the tab to close (from list_tabs)' },
            },
            required: ['tabId'],
        },
    },
    {
        name: 'close_all_tabs',
        description: 'Close all open browser tabs at once.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'upload_file',
        description: 'Upload a file to a file input. Provide absolute filePath.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the file input element (e.g. input[type="file"]). If omitted, finds the first file input on the page.' },
                filePath: { type: 'string', description: 'Absolute path to the file to upload (e.g. C:\\Users\\gary\\images\\post.jpg)' },
            },
            required: ['filePath'],
        },
    },
    {
        name: 'get_video_ids',
        description: 'Extract video IDs with copyright flags from YouTube Studio. Only returns flagged videos when copyright filter is applied.',
        input_schema: {
            type: 'object',
            properties: {},
            required: [],
        },
    },
    {
        name: 'click_table_row',
        description: 'Click the Nth video row in YouTube Studio. 0-based index. Use when text click fails.',
        input_schema: {
            type: 'object',
            properties: {
                rowIndex: { type: 'number', description: '0-based row index to click' },
            },
            required: ['rowIndex'],
        },
    },
    {
        name: 'get_interactive_elements',
        description: 'List all clickable elements INCLUDING Shadow DOM. Use when a click fails.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'check_page_health',
        description: 'Check if page loaded correctly. Detects blank pages, rate limits, login prompts, editing in progress.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'wait_for_result',
        description: 'Wait up to 10s for success/error toast after clicking confirm/submit.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
];
// ============================================================================
// DESKTOP HELPER FUNCTIONS
// ============================================================================
async function desktopExecuteScript(tabId, script, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, script }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Script execution failed');
    return data.result;
}
async function desktopTypeText(tabId, selector, text, clearFirst, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, selector, text, clearFirst }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Type text failed');
    return data.result;
}
async function desktopHover(tabId, selector, text, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/hover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, selector, text }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Hover failed');
    return data.result;
}
async function desktopHoverAndClick(tabId, hoverSelector, hoverText, clickText, waitMs, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/hover-and-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, hoverSelector, hoverText, clickText, waitMs }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Hover and click failed');
    return data.result;
}
async function desktopGetInteractiveElements(tabId, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/get-interactive-elements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to get interactive elements');
    if (data.count === 0)
        return 'No interactive elements found on this page.';
    const lines = data.elements.map((e, i) => {
        const parts = [`${i + 1}. "${e.text}"`];
        if (e.tag)
            parts.push(`<${e.tag}>`);
        if (e.role)
            parts.push(`role="${e.role}"`);
        if (e.ariaLabel)
            parts.push(`aria-label="${e.ariaLabel}"`);
        if (e.href)
            parts.push(`href="${e.href}"`);
        return parts.join(' ');
    });
    return `Found ${data.count} interactive elements:\n${lines.join('\n')}`;
}
async function desktopGetVideoIds(tabId, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/get-video-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to extract video IDs');
    if (data.count === 0)
        return 'No video IDs found on page. Make sure you are on the YouTube Studio Content page with the Copyright filter applied.';
    const header = data.copyrightOnly
        ? `Found ${data.count} videos WITH COPYRIGHT FLAGS (out of ${data.totalOnPage} total on page):`
        : `Found ${data.count} video IDs (copyrightOnly: false — copyright filter may not be applied, go back and apply it):`;
    return `${header}\n${data.videoIds.map((id, i) => `${i + 1}. ${id} → https://studio.youtube.com/video/${id}/copyright`).join('\n')}`;
}
async function desktopClickTableRow(tabId, rowIndex, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/click-table-row`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, rowIndex }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to click table row');
    return `Clicked row ${data.clickedIndex} of ${data.totalRows}: "${data.text}" (${data.href || 'no href'})`;
}
async function desktopClick(tabId, selector, text, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, selector, text }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Click failed');
    // Include pageChanged and warning in the result so Claude knows if click actually worked
    let result = data.result;
    if (data.pageChanged === true) {
        result += ' [PAGE CHANGED — click confirmed]';
    }
    else if (data.warning) {
        result += ` [WARNING: ${data.warning}]`;
    }
    return result;
}
async function desktopUploadFile(tabId, selector, filePath, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId, selector, filePath }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'File upload failed');
    return data.result;
}
async function desktopListTabs(desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs`);
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to list tabs');
    return data.tabs || [];
}
async function desktopFocusTab(tabId, desktopUrl) {
    const response = await fetch(`${desktopUrl}/tabs/focus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tabId }),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to focus tab');
}
async function desktopCreateTab(url, desktopUrl) {
    // Detect platform for authenticated session routing
    let platform = null;
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        if (hostname.includes('twitter.com') || hostname.includes('x.com'))
            platform = 'twitter';
        else if (hostname.includes('linkedin.com'))
            platform = 'linkedin';
        else if (hostname.includes('google.com') || hostname.includes('gmail.com'))
            platform = 'google';
        else if (hostname.includes('facebook.com'))
            platform = 'facebook';
        else if (hostname.includes('instagram.com'))
            platform = 'instagram';
        else if (hostname.includes('youtube.com'))
            platform = 'youtube';
    }
    catch { /* ignore invalid URLs */ }
    const endpoint = platform ? '/tabs/platform' : '/tabs/create';
    const body = platform ? { url, platform } : { url };
    const response = await fetch(`${desktopUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.success)
        throw new Error(data.error || 'Failed to create tab');
    return { id: data.id, url: url || 'about:blank', title: data.title || '' };
}
async function extractDesktopPageContext(tabId, desktopUrl) {
    const urlResult = await desktopExecuteScript(tabId, 'window.location.href', desktopUrl);
    const titleResult = await desktopExecuteScript(tabId, 'document.title', desktopUrl);
    const elements = await desktopExecuteScript(tabId, `
    (function() {
      var selectors = 'a, button, input, select, textarea, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [onclick], [contenteditable="true"], [tabindex], tp-yt-paper-tab, tp-yt-paper-item, ytcp-button';
      var results = [];
      // Search light DOM
      var els = document.querySelectorAll(selectors);
      for (var i = 0; i < els.length; i++) results.push(els[i]);
      // Search shadow DOM recursively
      function searchShadow(root) {
        var all = root.querySelectorAll('*');
        for (var j = 0; j < all.length; j++) {
          if (all[j].shadowRoot) {
            var shadowEls = all[j].shadowRoot.querySelectorAll(selectors);
            for (var k = 0; k < shadowEls.length; k++) results.push(shadowEls[k]);
            searchShadow(all[j].shadowRoot);
          }
        }
      }
      searchShadow(document);
      // Deduplicate and map
      var seen = new Set();
      return results.filter(function(el) {
        if (seen.has(el)) return false;
        seen.add(el);
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).slice(0, 100).map(function(el) {
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 100),
          id: el.id || undefined,
          className: (typeof el.className === 'string' ? el.className : '') || undefined,
          href: el.getAttribute ? el.getAttribute('href') || undefined : undefined,
          type: el.getAttribute ? el.getAttribute('type') || undefined : undefined,
          role: el.getAttribute ? el.getAttribute('role') || undefined : undefined,
          placeholder: el.getAttribute ? el.getAttribute('placeholder') || undefined : undefined,
          ariaLabel: el.getAttribute ? el.getAttribute('aria-label') || undefined : undefined,
          inShadowDOM: el.getRootNode() !== document,
        };
      });
    })()
  `, desktopUrl);
    return {
        url: urlResult || '',
        title: titleResult || '',
        interactiveElements: (elements || []),
    };
}
function formatPageContext(ctx) {
    let result = `URL: ${ctx.url}\nTitle: ${ctx.title}`;
    if (ctx.interactiveElements && ctx.interactiveElements.length > 0) {
        result += `\n\nInteractive Elements (${ctx.interactiveElements.length}):`;
        for (const el of ctx.interactiveElements.slice(0, 50)) {
            const parts = [el.tag];
            if (el.id)
                parts.push(`#${el.id}`);
            if (el.role)
                parts.push(`role="${el.role}"`);
            if (el.type)
                parts.push(`type="${el.type}"`);
            if (el.ariaLabel)
                parts.push(`aria-label="${el.ariaLabel}"`);
            if (el.placeholder)
                parts.push(`placeholder="${el.placeholder}"`);
            if (el.href)
                parts.push(`href="${el.href.slice(0, 80)}"`);
            if (el.text && el.text.length > 0)
                parts.push(`"${el.text.slice(0, 60)}"`);
            if (el.inShadowDOM)
                parts.push('[shadow-dom]');
            result += `\n  - ${parts.join(' ')}`;
        }
        if (ctx.interactiveElements.length > 50) {
            result += `\n  ... and ${ctx.interactiveElements.length - 50} more elements`;
        }
    }
    return result;
}
// ============================================================================
// TOOL EXECUTOR FACTORY
// ============================================================================
function createToolExecutor() {
    return async (toolName, input, ctx) => {
        const startTime = Date.now();
        try {
            if (ctx.useDesktop) {
                return await executeDesktop(toolName, input, ctx.desktopTabId, ctx.desktopUrl, ctx);
            }
            else if (ctx.page) {
                return await executeCDP(toolName, input, ctx.page);
            }
            else {
                return { success: false, result: '', error: 'No browser connection available' };
            }
        }
        catch (error) {
            const elapsed = Date.now() - startTime;
            return {
                success: false,
                result: '',
                error: `${toolName} failed after ${elapsed}ms: ${error.message}`,
            };
        }
    };
}
exports.createToolExecutor = createToolExecutor;
// ============================================================================
// DESKTOP EXECUTION
// ============================================================================
async function executeDesktop(toolName, input, tabId, desktopUrl, context) {
    const escape = (s) => s.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
    // Tab-independent tools work without a tabId
    if (toolName === 'list_tabs') {
        const tabs = await desktopListTabs(desktopUrl);
        const lines = tabs.map((t) => `[${t.id}] ${t.isActive ? '(active) ' : ''}${t.title || 'Untitled'} - ${t.url}`);
        return { success: true, result: `Open tabs:\n${lines.join('\n')}` };
    }
    if (toolName === 'create_tab') {
        const url = input.url || 'about:blank';
        const tab = await desktopCreateTab(url, desktopUrl);
        return { success: true, result: `Created new tab [${tab.id}]: ${url}` };
    }
    if (toolName === 'wait') {
        const seconds = Math.min(input.seconds, 30);
        await new Promise(r => setTimeout(r, seconds * 1000));
        return { success: true, result: `Waited ${seconds} seconds` };
    }
    // For all other tools, ensure we have a tab - find a usable one
    // Note: about:blank tabs hang on script execution in Electron BrowserViews
    if (tabId === null) {
        const tabs = await desktopListTabs(desktopUrl);
        // Prefer: 1) active tab with content, 2) any tab with content, 3) active tab, 4) any tab
        const withContent = tabs.filter(t => t.url && !t.url.startsWith('about:'));
        const activeWithContent = withContent.find(t => t.isActive);
        if (activeWithContent) {
            tabId = activeWithContent.id;
        }
        else if (withContent.length > 0) {
            tabId = withContent[0].id;
        }
        else {
            // All tabs are about:blank - navigate the active one to make it usable
            const activeTab = tabs.find(t => t.isActive) || tabs[0];
            if (activeTab) {
                // For navigate tool, we'll handle it in the switch. For others, create a google tab
                if (toolName === 'navigate') {
                    tabId = activeTab.id;
                }
                else {
                    const tab = await desktopCreateTab('https://www.google.com', desktopUrl);
                    // Wait for page load
                    await new Promise(r => setTimeout(r, 2000));
                    tabId = tab.id;
                }
            }
            else {
                const tab = await desktopCreateTab('https://www.google.com', desktopUrl);
                await new Promise(r => setTimeout(r, 2000));
                tabId = tab.id;
            }
        }
    }
    switch (toolName) {
        case 'navigate': {
            const url = sanitizeNavigationUrl(input.url);
            await fetch(`${desktopUrl}/tabs/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tabId, url }),
            });
            await new Promise(r => setTimeout(r, 2000)); // Wait for page load
            // Auto health check after navigation
            try {
                const health = await desktopExecuteScript(tabId, `
          (function() {
            var body = document.body;
            if (!body || body.children.length < 3 || (body.innerText || '').trim().length < 50)
              return 'BLANK';
            if (/something went wrong|unusual traffic/i.test(body.innerText))
              return 'ERROR';
            if (/sign in|log in|choose an account/i.test(body.innerText))
              return 'LOGGED_OUT';
            return 'OK';
          })()
        `, desktopUrl);
                if (health === 'BLANK') {
                    // Auto-retry once
                    await fetch(`${desktopUrl}/tabs/navigate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: tabId, url }),
                    });
                    await new Promise(r => setTimeout(r, 3000));
                    return { success: true, result: `Navigated to ${url} [page was blank, auto-refreshed]` };
                }
                if (health === 'ERROR') {
                    return { success: true, result: `Navigated to ${url} [WARNING: page shows error]` };
                }
                if (health === 'LOGGED_OUT') {
                    // Attempt session restore before giving up
                    const platform = detectPlatformFromUrl(url);
                    if (platform && context?.sessionRestoreAttempted && !context.sessionRestoreAttempted.has(platform)) {
                        context.sessionRestoreAttempted.add(platform);
                        log.info(`[SESSION RESTORE] Login wall detected on ${platform} — attempting restore...`);
                        const restored = await attemptSessionRestore(platform, desktopUrl);
                        if (restored) {
                            // Re-navigate after restore
                            await fetch(`${desktopUrl}/tabs/navigate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: tabId, url }),
                            });
                            await new Promise(r => setTimeout(r, 3000));
                            return { success: true, result: `Navigated to ${url} [session restored for ${platform}]` };
                        }
                    }
                    return { success: false, result: '', error: `Navigation to ${url} landed on login page — session expired` };
                }
            }
            catch { /* non-fatal */ }
            return { success: true, result: `Navigated to ${url}` };
        }
        case 'click': {
            const selector = input.selector;
            const text = input.text;
            if (!selector && !text) {
                return { success: false, result: '', error: 'click requires either selector or text' };
            }
            // Use dedicated /tabs/click endpoint with selector + text fallback + aria-label matching
            const result = await desktopClick(tabId, selector || null, text || null, desktopUrl);
            return { success: true, result };
        }
        case 'type_text': {
            const selector = input.selector;
            const text = input.text;
            const clearFirst = input.clearFirst !== false;
            // Use dedicated /tabs/type endpoint with Electron insertText API
            // Works with contenteditable (LinkedIn, Twitter), inputs, Shadow DOM, etc.
            const result = await desktopTypeText(tabId, selector, text, clearFirst, desktopUrl);
            return { success: true, result };
        }
        case 'scroll': {
            const direction = input.direction;
            const amount = input.amount || 500;
            const selector = input.selector;
            if (selector) {
                const escaped = escape(selector);
                await desktopExecuteScript(tabId, `
          (function() { var el = document.querySelector('${escaped}'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); })()
        `, desktopUrl);
                return { success: true, result: `Scrolled to element: ${selector}` };
            }
            // Use Desktop's native /tabs/scroll/:id endpoint — has verified JS scroll + keyboard fallback
            try {
                const scrollRes = await fetch(`${desktopUrl}/tabs/scroll/${tabId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ direction, amount }),
                });
                const scrollData = await scrollRes.json();
                return {
                    success: scrollData.success !== false,
                    result: `Scrolled ${direction} by ${amount}px (${scrollData.strategy || 'keyboard_fallback'})`,
                };
            }
            catch {
                // If scroll endpoint fails, use keyboard as last resort
                const keyEndpoint = `${desktopUrl}/tabs/key/${tabId}`;
                const keyCode = direction === 'up' ? 'PageUp' : 'PageDown';
                await fetch(keyEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: keyCode }),
                }).catch(() => { });
                return { success: true, result: `Scrolled ${direction} via keyboard fallback` };
            }
        }
        case 'press_key': {
            const key = input.key;
            // Use sendInputEvent via the native key endpoint for real key events
            const keyEndpoint = `${desktopUrl}/tabs/key/${tabId}`;
            try {
                await fetch(keyEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key }),
                });
            }
            catch {
                // Fallback to JS dispatch
                await desktopExecuteScript(tabId, `
          document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: '${escape(key)}', bubbles: true}));
          document.activeElement.dispatchEvent(new KeyboardEvent('keyup', {key: '${escape(key)}', bubbles: true}));
        `, desktopUrl);
            }
            return { success: true, result: `Pressed key: ${key}` };
        }
        case 'take_screenshot': {
            // Return page description (text-based) for AI + save image to disk
            const context = await extractDesktopPageContext(tabId, desktopUrl);
            // Save visual screenshot to client's Documents/CHROMADON/
            try {
                fetch(`${desktopUrl}/storage/screenshot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tabId,
                        sessionId: 'manual',
                        action: 'manual_screenshot',
                        url: context.url,
                    }),
                }).catch(() => { }); // Fire-and-forget
            }
            catch { /* non-fatal */ }
            return { success: true, result: `Screenshot captured and saved.\n${formatPageContext(context)}` };
        }
        case 'extract_text': {
            const selector = input.selector;
            if (selector) {
                const escaped = escape(selector);
                const text = await desktopExecuteScript(tabId, `
          (function() { var el = document.querySelector('${escaped}'); return el ? el.textContent.trim().slice(0, 2000) : null; })()
        `, desktopUrl);
                if (text === null)
                    return { success: false, result: '', error: `Element not found: ${selector}` };
                return { success: true, result: text };
            }
            const text = await desktopExecuteScript(tabId, `document.body.innerText.slice(0, 3000)`, desktopUrl);
            return { success: true, result: text || '(empty page)' };
        }
        case 'select_option': {
            const selector = escape(input.selector);
            const value = escape(input.value);
            const result = await desktopExecuteScript(tabId, `
        (function() {
          var el = document.querySelector('${selector}');
          if (!el || el.tagName !== 'SELECT') return null;
          for (var i = 0; i < el.options.length; i++) {
            if (el.options[i].value === '${value}' || el.options[i].text.includes('${value}')) {
              el.selectedIndex = i;
              el.dispatchEvent(new Event('change', {bubbles: true}));
              return 'Selected: ' + el.options[i].text;
            }
          }
          return null;
        })()
      `, desktopUrl);
            if (!result)
                return { success: false, result: '', error: `Could not select "${input.value}" in ${input.selector}` };
            return { success: true, result };
        }
        case 'hover': {
            const selector = input.selector;
            const text = input.text;
            if (!selector && !text) {
                return { success: false, result: '', error: 'hover requires either selector or text' };
            }
            const result = await desktopHover(tabId, selector || null, text || null, desktopUrl);
            return { success: true, result };
        }
        case 'hover_and_click': {
            const hoverSelector = input.hoverSelector;
            const hoverText = input.hoverText;
            const clickText = input.clickText;
            const waitMs = input.waitMs;
            if (!hoverSelector && !hoverText) {
                return { success: false, result: '', error: 'hover_and_click requires either hoverSelector or hoverText' };
            }
            const result = await desktopHoverAndClick(tabId, hoverSelector || null, hoverText || null, clickText, waitMs, desktopUrl);
            return { success: true, result };
        }
        case 'get_page_context': {
            const context = await extractDesktopPageContext(tabId, desktopUrl);
            return { success: true, result: formatPageContext(context) };
        }
        case 'switch_tab': {
            const tabIdToFocus = input.tabId;
            await desktopFocusTab(tabIdToFocus, desktopUrl);
            return { success: true, result: `Switched to tab ${tabIdToFocus}` };
        }
        case 'close_tab': {
            const tabIdToClose = input.tabId;
            const closeResp = await fetch(`${desktopUrl}/tabs/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tabIdToClose }),
            });
            const closeData = await closeResp.json();
            if (!closeData.success)
                throw new Error(closeData.error || 'Failed to close tab');
            return { success: true, result: `Closed tab ${tabIdToClose}` };
        }
        case 'close_all_tabs': {
            const tabs = await desktopListTabs(desktopUrl);
            if (tabs.length === 0) {
                return { success: true, result: 'No tabs open to close.' };
            }
            let closed = 0;
            for (const tab of tabs) {
                const resp = await fetch(`${desktopUrl}/tabs/close`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: tab.id }),
                });
                const data = await resp.json();
                if (data.success)
                    closed++;
            }
            return { success: true, result: `Closed ${closed} of ${tabs.length} tab(s).` };
        }
        case 'upload_file': {
            const selector = input.selector;
            const filePath = input.filePath;
            const result = await desktopUploadFile(tabId, selector || null, filePath, desktopUrl);
            return {
                success: true,
                result: result + ' NEXT STEP: Call wait with seconds=3 to let the upload preview render before typing. Any text typed BEFORE the upload was likely erased by the platform re-render. Type your post content AFTER the wait.',
            };
        }
        case 'get_video_ids': {
            const result = await desktopGetVideoIds(tabId, desktopUrl);
            return { success: true, result };
        }
        case 'click_table_row': {
            const rowIndex = input.rowIndex || 0;
            const result = await desktopClickTableRow(tabId, rowIndex, desktopUrl);
            return { success: true, result };
        }
        case 'get_interactive_elements': {
            const result = await desktopGetInteractiveElements(tabId, desktopUrl);
            return { success: true, result };
        }
        case 'check_page_health': {
            const health = await desktopExecuteScript(tabId, `
        (function() {
          var body = document.body;
          if (!body) return { status: 'BLANK_PAGE', action: 'REFRESH' };
          var text = body.innerText || '';
          var children = body.children.length;
          if (children < 3 || text.trim().length < 50)
            return { status: 'BLANK_PAGE', action: 'REFRESH' };
          if (/something went wrong|try again later|unusual traffic/i.test(text))
            return { status: 'RATE_LIMITED', action: 'WAIT_60S_AND_RETRY' };
          if (/sign in|log in|choose an account/i.test(text))
            return { status: 'LOGGED_OUT', action: 'ALERT_USER' };
          if (/take action/i.test(text))
            return { status: 'CLAIMS_READY', action: 'CLICK_TAKE_ACTION' };
          if (/editing is in progress/i.test(text))
            return { status: 'EDITING_IN_PROGRESS', action: 'DEFER_VIDEO' };
          if (/no copyright claims|no issues found/i.test(text))
            return { status: 'NO_CLAIMS', action: 'NEXT_VIDEO' };
          return { status: 'OK', action: 'CONTINUE' };
        })()
      `, desktopUrl);
            return { success: true, result: `Page health: ${health.status} → ${health.action}` };
        }
        case 'wait_for_result': {
            for (let i = 0; i < 20; i++) {
                const check = await desktopExecuteScript(tabId, `
          (function() {
            var text = document.body?.innerText || '';
            if (/changes saved|video updated|edit.*applied|erase.*complete/i.test(text))
              return 'SUCCESS';
            if (/editing is in progress/i.test(text))
              return 'SUCCESS_EDITING';
            if (/something went wrong|couldn.*save|error occurred|failed/i.test(text))
              return 'ERROR';
            return null;
          })()
        `, desktopUrl);
                if (check)
                    return { success: true, result: `Result: ${check}` };
                await new Promise(r => setTimeout(r, 500));
            }
            return { success: true, result: 'Result: TIMEOUT — no confirmation detected after 10s' };
        }
        default:
            return { success: false, result: '', error: `Unknown tool: ${toolName}` };
    }
}
// ============================================================================
// CDP (PLAYWRIGHT) EXECUTION
// ============================================================================
async function executeCDP(toolName, input, page) {
    switch (toolName) {
        case 'navigate': {
            await page.goto(input.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
            return { success: true, result: `Navigated to ${input.url}` };
        }
        case 'click': {
            const selector = input.selector;
            const text = input.text;
            if (selector) {
                await page.click(selector, { timeout: 10000 });
                return { success: true, result: `Clicked ${selector}` };
            }
            else if (text) {
                const locator = page.getByText(text, { exact: false }).first();
                await locator.click({ timeout: 10000 });
                return { success: true, result: `Clicked element with text: ${text}` };
            }
            return { success: false, result: '', error: 'click requires either selector or text' };
        }
        case 'type_text': {
            const selector = input.selector;
            const text = input.text;
            const clearFirst = input.clearFirst !== false;
            if (clearFirst) {
                await page.fill(selector, text, { timeout: 10000 });
            }
            else {
                await page.locator(selector).pressSequentially(text, { timeout: 10000 });
            }
            return { success: true, result: `Typed into ${selector}` };
        }
        case 'scroll': {
            const direction = input.direction;
            const amount = input.amount || 500;
            const selector = input.selector;
            if (selector) {
                await page.locator(selector).scrollIntoViewIfNeeded({ timeout: 10000 });
                return { success: true, result: `Scrolled to ${selector}` };
            }
            const scrollMap = {
                down: [0, amount], up: [0, -amount], right: [amount, 0], left: [-amount, 0],
            };
            const [x, y] = scrollMap[direction] || scrollMap.down;
            await page.evaluate(([sx, sy]) => window.scrollBy(sx, sy), [x, y]);
            return { success: true, result: `Scrolled ${direction} by ${amount}px` };
        }
        case 'press_key': {
            await page.keyboard.press(input.key);
            return { success: true, result: `Pressed key: ${input.key}` };
        }
        case 'wait': {
            const seconds = Math.min(input.seconds, 30);
            await page.waitForTimeout(seconds * 1000);
            return { success: true, result: `Waited ${seconds} seconds` };
        }
        case 'take_screenshot': {
            const url = page.url();
            const title = await page.title();
            const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
            return { success: true, result: `Screenshot captured.\nURL: ${url}\nTitle: ${title}\nVisible text:\n${bodyText}` };
        }
        case 'extract_text': {
            const selector = input.selector;
            if (selector) {
                const text = await page.textContent(selector, { timeout: 10000 });
                return { success: true, result: text?.trim().slice(0, 2000) || '(empty)' };
            }
            const text = await page.evaluate(() => document.body.innerText.slice(0, 3000));
            return { success: true, result: text || '(empty page)' };
        }
        case 'select_option': {
            await page.selectOption(input.selector, input.value, { timeout: 10000 });
            return { success: true, result: `Selected "${input.value}" in ${input.selector}` };
        }
        case 'hover': {
            await page.hover(input.selector, { timeout: 10000 });
            return { success: true, result: `Hovered over ${input.selector}` };
        }
        case 'get_page_context': {
            const url = page.url();
            const title = await page.title();
            const elements = await page.evaluate(() => {
                const selectors = 'a, button, input, select, textarea, [role="button"], [onclick], [contenteditable="true"]';
                return Array.from(document.querySelectorAll(selectors)).slice(0, 100).map(el => ({
                    tag: el.tagName.toLowerCase(),
                    text: el.textContent?.trim().slice(0, 100) || '',
                    id: el.id || undefined,
                    className: el.className || undefined,
                    href: el.getAttribute('href') || undefined,
                    type: el.getAttribute('type') || undefined,
                    placeholder: el.getAttribute('placeholder') || undefined,
                    ariaLabel: el.getAttribute('aria-label') || undefined,
                }));
            });
            const ctx = { url, title, interactiveElements: elements };
            return { success: true, result: formatPageContext(ctx) };
        }
        case 'list_tabs': {
            const context = page.context();
            const pages = context.pages();
            const lines = await Promise.all(pages.map(async (p, i) => {
                const url = p.url();
                const title = await p.title();
                const active = p === page;
                return `[${i}] ${active ? '(active) ' : ''}${title || 'Untitled'} - ${url}`;
            }));
            return { success: true, result: `Open tabs:\n${lines.join('\n')}` };
        }
        case 'switch_tab': {
            const context = page.context();
            const pages = context.pages();
            const idx = input.tabId;
            if (idx < 0 || idx >= pages.length) {
                return { success: false, result: '', error: `Tab index ${idx} out of range (0-${pages.length - 1})` };
            }
            await pages[idx].bringToFront();
            return { success: true, result: `Switched to tab ${idx}` };
        }
        case 'create_tab': {
            const context = page.context();
            const newPage = await context.newPage();
            if (input.url) {
                await newPage.goto(input.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
            }
            return { success: true, result: `Created new tab: ${input.url || 'about:blank'}` };
        }
        case 'close_tab': {
            return { success: false, result: '', error: 'close_tab is not supported in CDP mode. Use Desktop mode.' };
        }
        case 'close_all_tabs': {
            return { success: false, result: '', error: 'close_all_tabs is not supported in CDP mode. Use Desktop mode.' };
        }
        default:
            return { success: false, result: '', error: `Unknown tool: ${toolName}` };
    }
}
//# sourceMappingURL=browser-tools.js.map