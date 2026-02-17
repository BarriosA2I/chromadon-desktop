"use strict";
/**
 * Trinity Research Executor — Website Scraping + Knowledge Vault Ingestion
 *
 * research_website: Server-side fetch + HTML text extraction (no browser needed)
 * client_add_knowledge: Saves extracted text to the client's knowledge vault
 *
 * @author Barrios A2I
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTrinityExecutor = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const trinity_intelligence_1 = require("./trinity-intelligence");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('trinity');
// ============================================================================
// HTML TEXT EXTRACTION
// ============================================================================
/** Strip HTML tags and extract readable text content */
function htmlToText(html) {
    // Remove script/style/noscript blocks entirely
    let text = html.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    // Replace <br>, <p>, <div>, <li>, <h1-6> with newlines for structure
    text = text.replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|main)>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '- ');
    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, '');
    // Decode common HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&#\d+;/g, '');
    text = text.replace(/&\w+;/g, '');
    // Collapse multiple blank lines into max 2
    text = text.replace(/\n{3,}/g, '\n\n');
    // Trim each line
    text = text
        .split('\n')
        .map(line => line.trim())
        .join('\n');
    return text.trim();
}
/** Extract page title from HTML */
function extractTitle(html) {
    const match = html.match(/<title[^>]*>(.*?)<\/title>/i);
    return match ? match[1].trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
}
/** Extract same-domain links from HTML */
function extractLinks(html, baseUrl) {
    const base = new URL(baseUrl);
    const linkRegex = /href=["']([^"']+)["']/gi;
    const links = new Set();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        try {
            const href = match[1];
            // Skip anchors, mailto, tel, javascript
            if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:'))
                continue;
            const resolved = new URL(href, baseUrl);
            // Same domain only
            if (resolved.hostname !== base.hostname)
                continue;
            // Skip non-HTML resources
            if (/\.(pdf|jpg|jpeg|png|gif|svg|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|zip|tar|gz)$/i.test(resolved.pathname))
                continue;
            // Normalize: remove hash, keep path
            resolved.hash = '';
            links.add(resolved.href);
        }
        catch {
            // Invalid URL, skip
        }
    }
    return Array.from(links);
}
// ============================================================================
// FETCH WITH TIMEOUT
// ============================================================================
async function fetchPage(url, timeoutMs = 15000) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const resp = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CHROMADON-Brain/1.0; +https://barriosa2i.com)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            redirect: 'follow',
        });
        clearTimeout(timeout);
        if (!resp.ok)
            return { html: '', status: resp.status };
        const html = await resp.text();
        return { html, status: resp.status };
    }
    catch (err) {
        log.warn(`[Trinity] Failed to fetch ${url}: ${err.message}`);
        return null;
    }
}
// ============================================================================
// EXECUTOR
// ============================================================================
function createTrinityExecutor(storage, vault, intelligence) {
    const trinity = intelligence || new trinity_intelligence_1.TrinityIntelligence(storage, vault);
    return async (toolName, input) => {
        switch (toolName) {
            // ====================================================================
            // RESEARCH WEBSITE
            // ====================================================================
            case 'research_website': {
                const rawUrl = input.url;
                if (!rawUrl)
                    return JSON.stringify({ error: 'Missing required parameter: url' });
                // Normalize URL
                const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                const followLinks = input.follow_links === true;
                const maxPages = Math.min(input.max_pages || 10, 25);
                log.info(`[Trinity] Researching: ${url} (follow_links: ${followLinks}, max_pages: ${maxPages})`);
                // Fetch main page
                const mainResult = await fetchPage(url);
                if (!mainResult || !mainResult.html) {
                    return JSON.stringify({
                        error: `Failed to fetch ${url}`,
                        status: mainResult?.status || 0,
                    });
                }
                const mainTitle = extractTitle(mainResult.html) || url;
                const mainText = htmlToText(mainResult.html);
                const pages = [
                    { url, title: mainTitle, content: mainText },
                ];
                // Follow links if requested
                if (followLinks) {
                    const links = extractLinks(mainResult.html, url);
                    const visited = new Set([url]);
                    for (const link of links) {
                        if (pages.length >= maxPages)
                            break;
                        if (visited.has(link))
                            continue;
                        visited.add(link);
                        const pageResult = await fetchPage(link, 10000);
                        if (!pageResult || !pageResult.html)
                            continue;
                        const pageTitle = extractTitle(pageResult.html) || link;
                        const pageText = htmlToText(pageResult.html);
                        // Skip pages with very little content (likely nav-only or redirects)
                        if (pageText.length < 100)
                            continue;
                        pages.push({ url: link, title: pageTitle, content: pageText });
                    }
                }
                // Combine all page content
                const combinedContent = pages
                    .map(p => `=== ${p.title} ===\nSource: ${p.url}\n\n${p.content}`)
                    .join('\n\n---\n\n');
                const wordCount = combinedContent.split(/\s+/).length;
                log.info(`[Trinity] Extracted ${pages.length} page(s), ${wordCount} words from ${url}`);
                // Auto-save to vault if requested
                const saveToVault = input.save_to_vault === true;
                let vaultResult = null;
                if (saveToVault) {
                    const clientId = storage.getActiveClientId();
                    if (clientId) {
                        const vaultTitle = input.vault_title || `${mainTitle} - Website Content`;
                        const docDir = storage.getDocumentStoragePath(clientId);
                        if (!fs.existsSync(docDir)) {
                            fs.mkdirSync(docDir, { recursive: true });
                        }
                        const tempFilename = `trinity-${(0, uuid_1.v4)()}.txt`;
                        const tempPath = path.join(docDir, tempFilename);
                        fs.writeFileSync(tempPath, `Source: ${url}\n\n${combinedContent}`, 'utf-8');
                        try {
                            const result = await vault.uploadDocument(clientId, tempPath, `${vaultTitle}.txt`, 'text/plain', { sourceUrl: url });
                            vaultResult = { document_id: result.document.id, chunks_created: result.chunksCreated };
                            log.info(`[Trinity] Saved to vault: "${vaultTitle}" (${result.chunksCreated} chunks)`);
                        }
                        catch (err) {
                            log.error(`[Trinity] Vault save failed: ${err.message}`);
                        }
                        finally {
                            try {
                                fs.unlinkSync(tempPath);
                            }
                            catch { /* already moved */ }
                        }
                    }
                }
                // Return a summary (not the full content — it's huge and the AI doesn't need to relay it)
                const contentPreview = combinedContent.substring(0, 2000) + (combinedContent.length > 2000 ? '...' : '');
                return JSON.stringify({
                    title: mainTitle,
                    url,
                    pages_crawled: pages.length,
                    word_count: wordCount,
                    content_preview: contentPreview,
                    links_found: followLinks ? extractLinks(mainResult.html, url).length : 0,
                    ...(vaultResult ? {
                        saved_to_vault: true,
                        document_id: vaultResult.document_id,
                        chunks_created: vaultResult.chunks_created,
                        message: `Full content (${wordCount} words) saved to knowledge vault. Searchable via client_search_knowledge.`,
                    } : {
                        saved_to_vault: false,
                        message: 'Content extracted but NOT saved to vault. Call client_add_knowledge to save it.',
                    }),
                });
            }
            // ====================================================================
            // CLIENT ADD KNOWLEDGE
            // ====================================================================
            case 'client_add_knowledge': {
                const clientId = storage.getActiveClientId();
                if (!clientId) {
                    return JSON.stringify({
                        status: 'no_client',
                        message: 'No active client. Please set up a client first.',
                    });
                }
                const title = input.title;
                const content = input.content;
                const sourceUrl = input.source_url;
                if (!title)
                    return JSON.stringify({ error: 'Missing required parameter: title' });
                if (!content)
                    return JSON.stringify({ error: 'Missing required parameter: content' });
                // Write content to a temporary file for the vault's upload pipeline
                const docDir = storage.getDocumentStoragePath(clientId);
                if (!fs.existsSync(docDir)) {
                    fs.mkdirSync(docDir, { recursive: true });
                }
                const tempFilename = `trinity-${(0, uuid_1.v4)()}.txt`;
                const tempPath = path.join(docDir, tempFilename);
                // Prepend source URL if available
                const fullContent = sourceUrl
                    ? `Source: ${sourceUrl}\n\n${content}`
                    : content;
                fs.writeFileSync(tempPath, fullContent, 'utf-8');
                try {
                    const result = await vault.uploadDocument(clientId, tempPath, `${title}.txt`, 'text/plain', sourceUrl ? { sourceUrl } : undefined);
                    log.info(`[Trinity] Added to knowledge vault: "${title}" (${result.chunksCreated} chunks)`);
                    return JSON.stringify({
                        status: 'success',
                        document_id: result.document.id,
                        chunks_created: result.chunksCreated,
                        processing_time_ms: result.processingTimeMs,
                        message: `Saved "${title}" to knowledge vault (${result.chunksCreated} chunks). Content is now searchable via client_search_knowledge.`,
                    });
                }
                catch (err) {
                    log.error(`[Trinity] Failed to add knowledge: ${err.message}`);
                    return JSON.stringify({
                        error: `Failed to save to vault: ${err.message}`,
                    });
                }
                finally {
                    // Clean up temp file (vault copies it to its own storage)
                    try {
                        fs.unlinkSync(tempPath);
                    }
                    catch { /* already moved/deleted */ }
                }
            }
            // ====================================================================
            // ANALYZE COMPETITORS
            // ====================================================================
            case 'analyze_competitors': {
                const topic = input.topic;
                if (!topic)
                    return JSON.stringify({ error: 'Missing required parameter: topic' });
                const platform = input.platform || 'linkedin';
                log.info(`[Trinity] Analyzing competitors: "${topic}" on ${platform}`);
                const competitors = await trinity.getCompetitorContent(platform, topic);
                return JSON.stringify({
                    topic,
                    platform,
                    competitors_found: competitors.length,
                    insights: competitors,
                    message: competitors.length > 0
                        ? `Found ${competitors.length} relevant competitor insight(s) from the knowledge vault.`
                        : 'No competitor data found in the knowledge vault. Use research_website to learn competitor websites first.',
                });
            }
            // ====================================================================
            // GET TRENDING TOPICS
            // ====================================================================
            case 'get_trending_topics': {
                const platform = input.platform || 'linkedin';
                log.info(`[Trinity] Getting trending topics for ${platform}`);
                const trends = await trinity.getTrendingTopics(platform);
                const clientId = storage.getActiveClientId();
                const profile = clientId ? storage.getProfile(clientId) : null;
                const industry = profile?.industry || 'technology';
                return JSON.stringify({
                    industry,
                    platform,
                    trends_found: trends.length,
                    trends,
                    message: trends.length > 0
                        ? `Found ${trends.length} trending topic(s) in ${industry} from the knowledge vault.`
                        : `No trend data found for ${industry}. Use research_website to learn industry news sites first.`,
                });
            }
            // ====================================================================
            // GET AUDIENCE INSIGHTS
            // ====================================================================
            case 'get_audience_insights': {
                const platform = input.platform || 'linkedin';
                log.info(`[Trinity] Getting audience insights for ${platform}`);
                const insights = await trinity.getAudienceInsights(platform);
                return JSON.stringify({
                    platform,
                    ...insights,
                    message: (insights.products?.length || insights.services?.length)
                        ? 'Audience profile built from client onboarding data and knowledge vault.'
                        : 'Limited audience data available. Complete client onboarding or use research_website to learn more.',
                });
            }
            default:
                return JSON.stringify({ error: `Unknown Trinity tool: ${toolName}` });
        }
    };
}
exports.createTrinityExecutor = createTrinityExecutor;
//# sourceMappingURL=trinity-executor.js.map