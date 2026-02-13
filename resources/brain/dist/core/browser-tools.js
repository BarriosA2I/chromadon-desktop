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
exports.createToolExecutor = exports.BROWSER_TOOLS = void 0;
// ============================================================================
// TOOL DEFINITIONS (Anthropic Tool[] format)
// ============================================================================
exports.BROWSER_TOOLS = [
    {
        name: 'navigate',
        description: 'Navigate the browser to a URL. Use this to go to websites. The page will load and you can then interact with it.',
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
        description: 'Click on an element on the page. Provide either a CSS selector or visible text to identify the element. The element will be scrolled into view before clicking.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the element to click (e.g. #btn, .submit, button[type="submit"])' },
                text: { type: 'string', description: 'Visible text of the element to click (alternative to selector, for links and buttons)' },
            },
        },
    },
    {
        name: 'type_text',
        description: 'Type text into an input field, textarea, or contenteditable element. The field will be focused and existing text cleared by default before typing.',
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
        description: 'Scroll the page in a direction. Use to reveal more content or navigate long pages.',
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
        description: 'Press a keyboard key. Use for Enter to submit forms, Tab to move between fields, Escape to close dialogs, arrow keys for navigation.',
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
        description: 'Wait for a specified number of seconds. Use after navigation or actions that trigger page updates.',
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
        description: 'Take a screenshot of the current page. Returns a text description of what is visible. Use to verify actions or understand the page state.',
        input_schema: {
            type: 'object',
            properties: {
                fullPage: { type: 'boolean', description: 'Whether to capture the full scrollable page. Defaults to false (viewport only).' },
            },
        },
    },
    {
        name: 'extract_text',
        description: 'Extract text content from the page or a specific element. Use to read page content, verify actions, or gather information.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector to extract text from. If omitted, extracts from the visible page body.' },
            },
        },
    },
    {
        name: 'select_option',
        description: 'Select an option from a dropdown/select element by its value or visible text.',
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
        description: 'Hover the mouse over an element. Use to trigger dropdown menus, tooltips, or hover effects.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the element to hover over' },
            },
            required: ['selector'],
        },
    },
    {
        name: 'get_page_context',
        description: 'Get the current page URL, title, and a list of interactive elements (links, buttons, inputs, etc.). Always use this before interacting with a page you haven\'t seen yet.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_tabs',
        description: 'List all open browser tabs with their URLs, titles, and which one is active.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'switch_tab',
        description: 'Switch to a different browser tab by its ID number.',
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
        description: 'Open a new browser tab. If a URL is provided, navigates to it. Social media URLs (Twitter, LinkedIn, Google) will use authenticated sessions if available.',
        input_schema: {
            type: 'object',
            properties: {
                url: { type: 'string', description: 'URL to open in the new tab. Omit for a blank tab.' },
            },
        },
    },
    {
        name: 'upload_file',
        description: 'Upload a file (image, video, document) to a file input on the page. Use this for attaching media to social media posts, uploading profile pictures, or any file upload. First click the upload/media button to reveal the file input, then call this tool.',
        input_schema: {
            type: 'object',
            properties: {
                selector: { type: 'string', description: 'CSS selector for the file input element (e.g. input[type="file"]). If omitted, finds the first file input on the page.' },
                filePath: { type: 'string', description: 'Absolute path to the file to upload (e.g. C:\\Users\\gary\\images\\post.jpg)' },
            },
            required: ['filePath'],
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
                return await executeDesktop(toolName, input, ctx.desktopTabId, ctx.desktopUrl);
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
async function executeDesktop(toolName, input, tabId, desktopUrl) {
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
            const url = input.url;
            await fetch(`${desktopUrl}/tabs/navigate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: tabId, url }),
            });
            await new Promise(r => setTimeout(r, 1500)); // Wait for navigation
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
            const scrollMap = {
                down: `window.scrollBy(0, ${amount})`,
                up: `window.scrollBy(0, -${amount})`,
                right: `window.scrollBy(${amount}, 0)`,
                left: `window.scrollBy(-${amount}, 0)`,
            };
            await desktopExecuteScript(tabId, scrollMap[direction] || scrollMap.down, desktopUrl);
            return { success: true, result: `Scrolled ${direction} by ${amount}px` };
        }
        case 'press_key': {
            const key = input.key;
            await desktopExecuteScript(tabId, `
        document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: '${escape(key)}', bubbles: true}));
        document.activeElement.dispatchEvent(new KeyboardEvent('keyup', {key: '${escape(key)}', bubbles: true}));
      `, desktopUrl);
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
            const selector = escape(input.selector);
            const result = await desktopExecuteScript(tabId, `
        (function() {
          var el = document.querySelector('${selector}');
          if (!el) return null;
          el.scrollIntoView({block:'center'});
          el.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
          el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
          return 'Hovered over ' + el.tagName;
        })()
      `, desktopUrl);
            if (!result)
                return { success: false, result: '', error: `Element not found: ${input.selector}` };
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
        case 'upload_file': {
            const selector = input.selector;
            const filePath = input.filePath;
            const result = await desktopUploadFile(tabId, selector || null, filePath, desktopUrl);
            return {
                success: true,
                result: result + ' IMPORTANT: If you need to type text in the post composer, do it NOW (after the upload). Any text typed BEFORE the upload was likely erased by the platform re-render.',
            };
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
        default:
            return { success: false, result: '', error: `Unknown tool: ${toolName}` };
    }
}
//# sourceMappingURL=browser-tools.js.map