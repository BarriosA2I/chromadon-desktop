"use strict";
/**
 * YouTube Studio Browser Automation — Executor
 *
 * Routes yt_studio_* tool calls to Desktop HTTP API,
 * using Shadow DOM piercing helpers for YouTube Studio's Lit/Polymer UI.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createYouTubeStudioExecutor = void 0;
const logger_1 = require("../lib/logger");
const studio_browser_helpers_1 = require("./studio-browser-helpers");
const log = (0, logger_1.createChildLogger)('yt-studio');
// ============================================================================
// STUDIO SECTION URL MAP
// ============================================================================
const STUDIO_SECTIONS = {
    dashboard: 'https://studio.youtube.com',
    content: 'https://studio.youtube.com/channel/UC/videos',
    analytics: 'https://studio.youtube.com/channel/UC/analytics',
    comments: 'https://studio.youtube.com/channel/UC/comments',
    subtitles: 'https://studio.youtube.com/channel/UC/translations',
    copyright: 'https://studio.youtube.com/channel/UC/music',
    earn: 'https://studio.youtube.com/channel/UC/monetization',
    customization: 'https://studio.youtube.com/channel/UC/editing',
    audio_library: 'https://studio.youtube.com/channel/UC/music',
};
// ============================================================================
// EXECUTOR FACTORY
// ============================================================================
function createYouTubeStudioExecutor(desktopUrl) {
    // ── Helpers ──────────────────────────────────────────────
    async function getActiveTabId() {
        const resp = await fetch(`${desktopUrl}/state`);
        const data = (await resp.json());
        if (data.activeTabId)
            return data.activeTabId;
        if (data.tabs?.length)
            return data.tabs[0].id;
        throw new Error('No active tab found in Desktop');
    }
    async function execOnTab(script) {
        const tabId = await getActiveTabId();
        const resp = await fetch(`${desktopUrl}/tabs/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, script }),
        });
        const data = (await resp.json());
        if (!data.success)
            throw new Error(data.error || 'Script execution failed');
        return data.result;
    }
    async function navigateTo(url) {
        const tabId = await getActiveTabId();
        await fetch(`${desktopUrl}/tabs/navigate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: tabId, url }),
        });
        // Wait for YouTube Studio to load (heavy SPA)
        await new Promise((r) => setTimeout(r, 3000));
    }
    async function getCurrentUrl() {
        return await execOnTab('window.location.href');
    }
    async function getPageTitle() {
        return await execOnTab('document.title');
    }
    // ── Main Executor ───────────────────────────────────────
    return async (toolName, input) => {
        try {
            switch (toolName) {
                // ─── Navigate to Studio section ──────────────────
                case 'yt_studio_navigate': {
                    const { section } = input;
                    const url = STUDIO_SECTIONS[section?.toLowerCase()];
                    if (!url) {
                        const validSections = Object.keys(STUDIO_SECTIONS).join(', ');
                        return `Error: Unknown section "${section}". Valid sections: ${validSections}`;
                    }
                    log.info({ section }, 'Navigating to YouTube Studio section');
                    await navigateTo(url);
                    // YouTube Studio redirects /channel/UC/* to the actual channel ID
                    const finalUrl = await getCurrentUrl();
                    const title = await getPageTitle();
                    return [
                        `Navigated to YouTube Studio: ${section}`,
                        `URL: ${finalUrl}`,
                        `Page: ${title}`,
                    ].join('\n');
                }
                // ─── Scrape video list from content page ─────────
                case 'yt_studio_video_list': {
                    const maxResults = input.max_results || 20;
                    const filter = input.filter || 'all';
                    // Navigate to content page if not already there
                    const currentUrl = await getCurrentUrl();
                    if (!currentUrl.includes('studio.youtube.com') || !currentUrl.includes('/videos')) {
                        let targetUrl = STUDIO_SECTIONS.content;
                        // Apply copyright filter if requested
                        if (filter === 'copyright') {
                            // Use the copyright claim filter URL
                            targetUrl = currentUrl.includes('/channel/')
                                ? currentUrl.replace(/\/videos.*/, '/videos/live?filter=%5B%7B%22name%22%3A%22HAS_COPYRIGHT_CLAIM%22%2C%22value%22%3A%22HAS_COPYRIGHT_CLAIM%22%7D%5D')
                                : 'https://studio.youtube.com/channel/UC/videos/live?filter=%5B%7B%22name%22%3A%22HAS_COPYRIGHT_CLAIM%22%2C%22value%22%3A%22HAS_COPYRIGHT_CLAIM%22%7D%5D';
                        }
                        await navigateTo(targetUrl);
                    }
                    // Wait for video rows to appear in Shadow DOM
                    const waitResult = await execOnTab((0, studio_browser_helpers_1.waitForDeepElementScript)('ytcp-video-row, #video-title', 8000));
                    if (waitResult === 'TIMEOUT') {
                        return 'No videos found on the Studio content page. The page may still be loading or the session may have expired.';
                    }
                    // Scrape video data from Studio's Shadow DOM table
                    const videoData = await execOnTab(`
(function() {
  function deepQueryAll(root, sel) {
    var results = Array.from(root.querySelectorAll(sel));
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        results = results.concat(deepQueryAll(all[i].shadowRoot, sel));
      }
    }
    return results;
  }

  // Find video rows or links
  var rows = deepQueryAll(document, 'ytcp-video-row');
  if (rows.length === 0) {
    // Fallback: try finding video title links
    var links = deepQueryAll(document, 'a#video-title');
    if (links.length === 0) return JSON.stringify({ videos: [], count: 0 });

    return JSON.stringify({
      videos: links.slice(0, ${maxResults}).map(function(a, i) {
        var href = a.getAttribute('href') || '';
        var idMatch = href.match(/\\/video\\/([a-zA-Z0-9_-]+)/);
        return {
          index: i,
          title: (a.textContent || '').trim().slice(0, 100),
          videoId: idMatch ? idMatch[1] : null,
          href: href,
        };
      }),
      count: links.length,
    });
  }

  return JSON.stringify({
    videos: rows.slice(0, ${maxResults}).map(function(row, i) {
      var titleEl = row.querySelector('#video-title') ||
                    (row.shadowRoot && row.shadowRoot.querySelector('#video-title'));
      var title = titleEl ? (titleEl.textContent || '').trim() : 'Unknown';
      var href = titleEl && titleEl.getAttribute ? (titleEl.getAttribute('href') || '') : '';
      var idMatch = href.match(/\\/video\\/([a-zA-Z0-9_-]+)/);
      return {
        index: i,
        title: title.slice(0, 100),
        videoId: idMatch ? idMatch[1] : null,
      };
    }),
    count: rows.length,
  });
})()
          `);
                    try {
                        const parsed = typeof videoData === 'string' ? JSON.parse(videoData) : videoData;
                        const videos = parsed.videos || [];
                        if (videos.length === 0) {
                            return 'No videos found on the content page.';
                        }
                        const lines = [
                            `YOUTUBE STUDIO — ${videos.length} videos (${parsed.count} total on page)`,
                            '',
                        ];
                        for (const v of videos) {
                            lines.push(`  [${v.index}] ${v.videoId || '???'} — "${v.title}"`);
                        }
                        return lines.join('\n');
                    }
                    catch {
                        return `Raw video data: ${String(videoData).slice(0, 500)}`;
                    }
                }
                // ─── Check copyright claims ──────────────────────
                case 'yt_studio_copyright_check': {
                    const { video_id } = input;
                    if (!video_id)
                        return 'Error: video_id is required.';
                    log.info({ videoId: video_id }, 'Checking copyright claims');
                    await navigateTo(`https://studio.youtube.com/video/${video_id}/copyright`);
                    // Wait for the copyright page to load
                    await new Promise((r) => setTimeout(r, 2000));
                    // Check for "Video editing is in progress" banner
                    const inProgressCheck = await execOnTab((0, studio_browser_helpers_1.waitForTextScript)('editing is in progress', 3000));
                    // Look for copyright claims
                    const claimData = await execOnTab(`
(function() {
  function deepQueryAll(root, sel) {
    var results = Array.from(root.querySelectorAll(sel));
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        results = results.concat(deepQueryAll(all[i].shadowRoot, sel));
      }
    }
    return results;
  }

  function deepTextSearchAll(root, searchText) {
    var found = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        found = found.concat(deepTextSearchAll(node.shadowRoot, searchText));
      }
      var text = '';
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType === 3) text += node.childNodes[i].textContent;
      }
      if (text.trim().toLowerCase().includes(searchText.toLowerCase())) {
        var rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          found.push({ tag: node.tagName, text: text.trim().slice(0, 200) });
        }
      }
    }
    return found;
  }

  // Look for "Take action" buttons (indicates active claims)
  var actionBtns = deepTextSearchAll(document, 'Take action');

  // Look for claim details
  var claimElements = deepTextSearchAll(document, 'Content ID');
  var songElements = deepTextSearchAll(document, 'Song');

  // Check for "No copyright claims" or similar
  var noClaims = deepTextSearchAll(document, 'No issues found');

  return JSON.stringify({
    hasClaims: actionBtns.length > 0,
    claimCount: actionBtns.length,
    actionButtons: actionBtns.length,
    noClaims: noClaims.length > 0,
    details: claimElements.concat(songElements).slice(0, 10),
  });
})()
          `);
                    try {
                        const parsed = typeof claimData === 'string' ? JSON.parse(claimData) : claimData;
                        const inProgress = typeof inProgressCheck === 'string'
                            ? JSON.parse(inProgressCheck)
                            : inProgressCheck;
                        const lines = [
                            `COPYRIGHT CHECK — Video: ${video_id}`,
                            `URL: https://studio.youtube.com/video/${video_id}/copyright`,
                            '',
                        ];
                        if (inProgress?.found) {
                            lines.push('STATUS: Video editing is in progress (previous erase may still be processing)');
                        }
                        if (parsed.noClaims) {
                            lines.push('STATUS: No copyright issues found.');
                        }
                        else if (parsed.hasClaims) {
                            lines.push(`STATUS: ${parsed.claimCount} copyright claim(s) with "Take action" available.`);
                            if (parsed.details?.length) {
                                lines.push('');
                                lines.push('CLAIM DETAILS:');
                                for (const d of parsed.details) {
                                    lines.push(`  ${d.text}`);
                                }
                            }
                        }
                        else {
                            lines.push('STATUS: Could not determine copyright status. The page may still be loading.');
                        }
                        return lines.join('\n');
                    }
                    catch {
                        return `Raw claim data: ${String(claimData).slice(0, 500)}`;
                    }
                }
                // ─── Erase copyrighted song ──────────────────────
                case 'yt_studio_erase_song': {
                    const { video_id, claim_index } = input;
                    if (!video_id)
                        return 'Error: video_id is required.';
                    const idx = claim_index || 0;
                    log.info({ videoId: video_id, claimIndex: idx }, 'Erasing copyrighted song');
                    // Navigate to copyright page
                    const currentUrl = await getCurrentUrl();
                    if (!currentUrl.includes(`/video/${video_id}/copyright`)) {
                        await navigateTo(`https://studio.youtube.com/video/${video_id}/copyright`);
                        await new Promise((r) => setTimeout(r, 2000));
                    }
                    // Step 1: Click "Take action" button (nth one based on claim_index)
                    const takeActionResult = await execOnTab(`
(function() {
  function deepTextSearchAll(root, searchText) {
    var found = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        found = found.concat(deepTextSearchAll(node.shadowRoot, searchText));
      }
      var text = '';
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType === 3) text += node.childNodes[i].textContent;
      }
      if (text.trim().toLowerCase().includes(searchText.toLowerCase())) {
        var rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) found.push(node);
      }
    }
    return found;
  }

  var buttons = deepTextSearchAll(document, 'Take action');
  if (buttons.length === 0) return JSON.stringify({ success: false, message: 'No "Take action" buttons found. Either no claims or editing in progress.' });
  if (${idx} >= buttons.length) return JSON.stringify({ success: false, message: 'Claim index ' + ${idx} + ' out of range (found ' + buttons.length + ' claims).' });

  var btn = buttons[${idx}];
  var rect = btn.getBoundingClientRect();
  var opts = { bubbles: true, composed: true, clientX: rect.left + rect.width/2, clientY: rect.top + rect.height/2 };
  btn.dispatchEvent(new MouseEvent('mousedown', opts));
  btn.dispatchEvent(new MouseEvent('mouseup', opts));
  btn.dispatchEvent(new MouseEvent('click', opts));

  return JSON.stringify({ success: true, message: 'Clicked Take action button ' + ${idx} });
})()
          `);
                    const takeAction = typeof takeActionResult === 'string'
                        ? JSON.parse(takeActionResult)
                        : takeActionResult;
                    if (!takeAction.success)
                        return `Error: ${takeAction.message}`;
                    // Wait for dropdown/dialog
                    await new Promise((r) => setTimeout(r, 1500));
                    // Step 2: Click "Erase song"
                    const eraseResult = await execOnTab((0, studio_browser_helpers_1.litClickByTextScript)('Erase song'));
                    const erase = typeof eraseResult === 'string'
                        ? JSON.parse(eraseResult)
                        : eraseResult;
                    if (!erase.success) {
                        return `Error: Could not find "Erase song" option. Available actions may differ. ${erase.message}`;
                    }
                    await new Promise((r) => setTimeout(r, 1500));
                    // Step 3: Click acknowledge checkbox if present
                    const ackResult = await execOnTab((0, studio_browser_helpers_1.litClickByTextScript)('acknowledge'));
                    // Ignore failure — checkbox may not appear
                    await new Promise((r) => setTimeout(r, 500));
                    // Step 4: Click Save/Continue/Confirm
                    let saved = false;
                    for (const saveText of ['Save', 'Continue', 'Confirm changes', 'Erase']) {
                        const saveResult = await execOnTab((0, studio_browser_helpers_1.litClickByTextScript)(saveText));
                        const parsed = typeof saveResult === 'string'
                            ? JSON.parse(saveResult)
                            : saveResult;
                        if (parsed.success) {
                            saved = true;
                            log.info({ saveButton: saveText }, 'Clicked save button');
                            break;
                        }
                    }
                    if (!saved) {
                        return `Warning: Clicked "Erase song" but could not find save/confirm button. Check the page manually — the erase may not have been saved.`;
                    }
                    // Wait for YouTube to process
                    await new Promise((r) => setTimeout(r, 3000));
                    return `Successfully erased song for claim ${idx} on video ${video_id}. YouTube is processing the change (may take up to 48 hours).`;
                }
                // ─── Session health check ────────────────────────
                case 'yt_studio_session_check': {
                    try {
                        // Force a fresh cookie verification first
                        try {
                            await fetch(`${desktopUrl}/sessions/google/verify`, { method: 'POST', signal: AbortSignal.timeout(5000) });
                        }
                        catch { /* ignore — verify endpoint may not exist in older Desktop */ }
                        const resp = await fetch(`${desktopUrl}/sessions`, { signal: AbortSignal.timeout(5000) });
                        const data = await resp.json();
                        const sessions = data.sessions || [];
                        const google = sessions.find((s) => s.platform === 'google');
                        if (!google) {
                            return [
                                'YOUTUBE SESSION: Not found',
                                'No Google session detected in Desktop browser.',
                                'The user needs to log in to Google via the Desktop browser first.',
                            ].join('\n');
                        }
                        const lines = [
                            `YOUTUBE SESSION: ${google.isAuthenticated ? 'Authenticated' : 'Not authenticated'}`,
                            `Partition: ${google.partition || 'persist:platform-google'}`,
                        ];
                        if (google.accountName)
                            lines.push(`Account: ${google.accountName}`);
                        if (google.accountEmail)
                            lines.push(`Email: ${google.accountEmail}`);
                        if (google.lastVerified) {
                            lines.push(`Last verified: ${new Date(google.lastVerified).toLocaleString()}`);
                        }
                        if (!google.isAuthenticated) {
                            lines.push('');
                            lines.push('The user needs to re-login to Google. Navigate to accounts.google.com to authenticate.');
                        }
                        else {
                            lines.push('');
                            lines.push('Session is healthy. YouTube Studio tools are ready to use.');
                        }
                        return lines.join('\n');
                    }
                    catch (err) {
                        return `Error checking session: ${err.message}. Desktop may be offline.`;
                    }
                }
                default:
                    return `Unknown YouTube Studio tool: ${toolName}`;
            }
        }
        catch (error) {
            log.error({ err: error.message, toolName }, 'YouTube Studio tool error');
            return `YouTube Studio error: ${error.message}`;
        }
    };
}
exports.createYouTubeStudioExecutor = createYouTubeStudioExecutor;
//# sourceMappingURL=youtube-studio-executor.js.map