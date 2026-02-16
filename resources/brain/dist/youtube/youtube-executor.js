"use strict";
/**
 * YouTube Data API v3 Executor
 *
 * Async executor factory for YouTube tools. Each tool calls the YouTube
 * REST API via native fetch() and returns JSON-stringified results.
 *
 * Follows the createAnalyticsExecutor() pattern from analytics-executor.ts.
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
exports.createYouTubeExecutor = void 0;
const fs = __importStar(require("fs"));
const BASE_URL = 'https://www.googleapis.com/youtube/v3';
/**
 * Helper: authenticated fetch with auto-refreshing Bearer token
 */
async function authFetch(tokenManager, url, options = {}) {
    const token = await tokenManager.getAccessToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const err = await response.text();
        throw new Error(`YouTube API ${response.status}: ${err}`);
    }
    return response;
}
/**
 * Create an async YouTube tool executor bound to a token manager.
 */
function createYouTubeExecutor(tokenManager) {
    return async (toolName, input) => {
        try {
            // Track quota usage
            tokenManager.trackQuota(toolName);
            switch (toolName) {
                // =====================================================================
                // AUTH MANAGEMENT
                // =====================================================================
                case 'youtube_auth_status':
                    return JSON.stringify({
                        authorized: tokenManager.isAuthorized(),
                        apiKeyConfigured: !!tokenManager.getApiKey(),
                        quotaUsed: tokenManager.getQuotaUsed(),
                        quotaRemaining: tokenManager.getQuotaRemaining(),
                    });
                case 'youtube_oauth_authorize':
                    return JSON.stringify({
                        url: tokenManager.getAuthorizationUrl(input.redirect_uri),
                        instructions: 'Navigate to this URL in the current browser tab. After the user grants permissions, Google will redirect to localhost and the tokens will be saved automatically. No need to call youtube_oauth_callback — the callback endpoint handles it.',
                    });
                case 'youtube_oauth_callback': {
                    await tokenManager.exchangeCode(input.code, input.redirect_uri);
                    return JSON.stringify({
                        success: true,
                        message: 'YouTube OAuth authorized successfully. All authenticated tools are now available.',
                    });
                }
                // =====================================================================
                // PUBLIC TOOLS (API Key)
                // =====================================================================
                case 'youtube_search': {
                    const qs = new URLSearchParams({
                        part: 'snippet',
                        q: input.query,
                        maxResults: String(input.max_results || 10),
                        key: tokenManager.getApiKey(),
                    });
                    if (input.type)
                        qs.set('type', input.type);
                    if (input.order)
                        qs.set('order', input.order);
                    const resp = await fetch(`${BASE_URL}/search?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_get_video': {
                    const parts = input.parts || 'snippet,statistics,contentDetails';
                    const qs = new URLSearchParams({
                        part: parts,
                        id: input.video_id,
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/videos?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_get_channel': {
                    const parts = input.parts || 'snippet,statistics,contentDetails';
                    const qs = new URLSearchParams({
                        part: parts,
                        id: input.channel_id,
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/channels?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_list_playlist_items': {
                    const qs = new URLSearchParams({
                        part: 'snippet,contentDetails',
                        playlistId: input.playlist_id,
                        maxResults: String(input.max_results || 25),
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/playlistItems?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_list_comments': {
                    const qs = new URLSearchParams({
                        part: 'snippet,replies',
                        videoId: input.video_id,
                        maxResults: String(input.max_results || 20),
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/commentThreads?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                // =====================================================================
                // AUTHENTICATED TOOLS (OAuth)
                // =====================================================================
                case 'youtube_upload_video': {
                    const token = await tokenManager.getAccessToken();
                    const metadata = {
                        snippet: {
                            title: input.title,
                            description: input.description || '',
                            tags: input.tags || [],
                            categoryId: input.category_id || '22',
                        },
                        status: {
                            privacyStatus: input.privacy_status || 'private',
                        },
                    };
                    // Step 1: Initiate resumable upload
                    const initResp = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json; charset=UTF-8',
                        },
                        body: JSON.stringify(metadata),
                    });
                    if (!initResp.ok)
                        throw new Error(`Upload init failed: ${initResp.status} ${await initResp.text()}`);
                    const uploadUrl = initResp.headers.get('location');
                    if (!uploadUrl)
                        throw new Error('No upload URL returned');
                    // Step 2: Upload file
                    const fileBuffer = fs.readFileSync(input.file_path);
                    const uploadResp = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'video/*',
                            'Content-Length': String(fileBuffer.length),
                        },
                        body: fileBuffer,
                    });
                    if (!uploadResp.ok)
                        throw new Error(`Upload failed: ${uploadResp.status} ${await uploadResp.text()}`);
                    return JSON.stringify(await uploadResp.json(), null, 2);
                }
                case 'youtube_update_video': {
                    const snippet = {};
                    if (input.title !== undefined)
                        snippet.title = input.title;
                    if (input.description !== undefined)
                        snippet.description = input.description;
                    if (input.tags !== undefined)
                        snippet.tags = input.tags;
                    if (input.category_id !== undefined)
                        snippet.categoryId = input.category_id;
                    const body = { id: input.video_id };
                    const parts = [];
                    if (Object.keys(snippet).length > 0) {
                        body.snippet = snippet;
                        parts.push('snippet');
                    }
                    if (input.privacy_status !== undefined) {
                        body.status = { privacyStatus: input.privacy_status };
                        parts.push('status');
                    }
                    if (parts.length === 0)
                        throw new Error('No fields to update');
                    const resp = await authFetch(tokenManager, `${BASE_URL}/videos?part=${parts.join(',')}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_delete_video': {
                    await authFetch(tokenManager, `${BASE_URL}/videos?id=${input.video_id}`, { method: 'DELETE' });
                    return JSON.stringify({ deleted: true, videoId: input.video_id });
                }
                case 'youtube_create_playlist': {
                    const resp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet,status`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            snippet: { title: input.title, description: input.description || '' },
                            status: { privacyStatus: input.privacy_status || 'private' },
                        }),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_update_playlist': {
                    const body = { id: input.playlist_id };
                    const parts = [];
                    const snippet = {};
                    if (input.title !== undefined)
                        snippet.title = input.title;
                    if (input.description !== undefined)
                        snippet.description = input.description;
                    if (Object.keys(snippet).length > 0) {
                        body.snippet = snippet;
                        parts.push('snippet');
                    }
                    if (input.privacy_status !== undefined) {
                        body.status = { privacyStatus: input.privacy_status };
                        parts.push('status');
                    }
                    if (parts.length === 0)
                        throw new Error('No fields to update');
                    const resp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=${parts.join(',')}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_delete_playlist': {
                    await authFetch(tokenManager, `${BASE_URL}/playlists?id=${input.playlist_id}`, { method: 'DELETE' });
                    return JSON.stringify({ deleted: true, playlistId: input.playlist_id });
                }
                case 'youtube_add_to_playlist': {
                    const body = {
                        snippet: {
                            playlistId: input.playlist_id,
                            resourceId: { kind: 'youtube#video', videoId: input.video_id },
                        },
                    };
                    if (input.position !== undefined) {
                        body.snippet.position = input.position;
                    }
                    const resp = await authFetch(tokenManager, `${BASE_URL}/playlistItems?part=snippet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_remove_from_playlist': {
                    await authFetch(tokenManager, `${BASE_URL}/playlistItems?id=${input.playlist_item_id}`, { method: 'DELETE' });
                    return JSON.stringify({ deleted: true, playlistItemId: input.playlist_item_id });
                }
                case 'youtube_post_comment': {
                    const resp = await authFetch(tokenManager, `${BASE_URL}/commentThreads?part=snippet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            snippet: {
                                videoId: input.video_id,
                                topLevelComment: { snippet: { textOriginal: input.text } },
                            },
                        }),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_reply_to_comment': {
                    const resp = await authFetch(tokenManager, `${BASE_URL}/comments?part=snippet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            snippet: { parentId: input.parent_id, textOriginal: input.text },
                        }),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_rate_video': {
                    await authFetch(tokenManager, `${BASE_URL}/videos/rate?id=${input.video_id}&rating=${input.rating}`, { method: 'POST' });
                    return JSON.stringify({ rated: true, videoId: input.video_id, rating: input.rating });
                }
                case 'youtube_get_my_channel': {
                    const resp = await authFetch(tokenManager, `${BASE_URL}/channels?part=snippet,statistics,contentDetails&mine=true`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_list_my_playlists': {
                    const maxResults = input.max_results || 25;
                    const resp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet,contentDetails&mine=true&maxResults=${maxResults}`);
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_subscribe': {
                    const resp = await authFetch(tokenManager, `${BASE_URL}/subscriptions?part=snippet`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            snippet: { resourceId: { kind: 'youtube#channel', channelId: input.channel_id } },
                        }),
                    });
                    return JSON.stringify(await resp.json(), null, 2);
                }
                case 'youtube_unsubscribe': {
                    await authFetch(tokenManager, `${BASE_URL}/subscriptions?id=${input.subscription_id}`, { method: 'DELETE' });
                    return JSON.stringify({ unsubscribed: true, subscriptionId: input.subscription_id });
                }
                // =====================================================================
                // YOUTUBE STUDIO TOOLS (v1.4.0)
                // =====================================================================
                case 'youtube_video_analytics': {
                    const lines = [];
                    if (input.video_id) {
                        // Single video analytics
                        const qs = new URLSearchParams({
                            part: 'snippet,statistics,contentDetails',
                            id: input.video_id,
                            key: tokenManager.getApiKey(),
                        });
                        const resp = await fetch(`${BASE_URL}/videos?${qs}`);
                        if (!resp.ok)
                            throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                        const data = await resp.json();
                        const video = data.items?.[0];
                        if (!video)
                            return 'Video not found.';
                        const stats = video.statistics || {};
                        const snippet = video.snippet || {};
                        lines.push(`VIDEO ANALYTICS: "${snippet.title}"`);
                        lines.push(`Published: ${snippet.publishedAt}`);
                        lines.push(`Duration: ${video.contentDetails?.duration || 'N/A'}`);
                        lines.push('');
                        lines.push('METRICS:');
                        lines.push(`  Views: ${Number(stats.viewCount || 0).toLocaleString()}`);
                        lines.push(`  Likes: ${Number(stats.likeCount || 0).toLocaleString()}`);
                        lines.push(`  Comments: ${Number(stats.commentCount || 0).toLocaleString()}`);
                        const views = Number(stats.viewCount || 0);
                        const likes = Number(stats.likeCount || 0);
                        if (views > 0) {
                            lines.push(`  Like rate: ${((likes / views) * 100).toFixed(2)}%`);
                            lines.push(`  Comment rate: ${((Number(stats.commentCount || 0) / views) * 100).toFixed(2)}%`);
                        }
                    }
                    else {
                        // Channel-wide: recent uploads
                        const maxResults = input.max_results || 10;
                        // Get channel uploads playlist
                        const channelResp = await authFetch(tokenManager, `${BASE_URL}/channels?part=contentDetails,snippet,statistics&mine=true`);
                        const channelData = await channelResp.json();
                        const channel = channelData.items?.[0];
                        if (!channel)
                            return 'No authenticated channel found.';
                        const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
                        if (!uploadsId)
                            return 'No uploads playlist found.';
                        // Get recent uploads
                        const plResp = await fetch(`${BASE_URL}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}&key=${tokenManager.getApiKey()}`);
                        if (!plResp.ok)
                            throw new Error(`YouTube API ${plResp.status}: ${await plResp.text()}`);
                        const plData = await plResp.json();
                        const videoIds = (plData.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
                        if (videoIds.length === 0)
                            return 'No recent uploads found.';
                        // Get video stats
                        const vidResp = await fetch(`${BASE_URL}/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${tokenManager.getApiKey()}`);
                        if (!vidResp.ok)
                            throw new Error(`YouTube API ${vidResp.status}: ${await vidResp.text()}`);
                        const vidData = await vidResp.json();
                        lines.push(`CHANNEL VIDEO ANALYTICS (last ${videoIds.length} uploads)`);
                        lines.push(`Channel: ${channel.snippet?.title}`);
                        lines.push(`Subscribers: ${Number(channel.statistics?.subscriberCount || 0).toLocaleString()}`);
                        lines.push('');
                        let totalViews = 0, totalLikes = 0, totalComments = 0;
                        for (const v of vidData.items || []) {
                            const s = v.statistics || {};
                            const views = Number(s.viewCount || 0);
                            const likes = Number(s.likeCount || 0);
                            const comments = Number(s.commentCount || 0);
                            totalViews += views;
                            totalLikes += likes;
                            totalComments += comments;
                            const likeRate = views > 0 ? ((likes / views) * 100).toFixed(1) : '0';
                            lines.push(`"${(v.snippet?.title || '').slice(0, 50)}" — ${views.toLocaleString()} views, ${likes} likes (${likeRate}%)`);
                        }
                        lines.push('');
                        lines.push('TOTALS:');
                        lines.push(`  Views: ${totalViews.toLocaleString()} | Likes: ${totalLikes.toLocaleString()} | Comments: ${totalComments.toLocaleString()}`);
                        if (vidData.items?.length > 0) {
                            lines.push(`  Avg views/video: ${Math.round(totalViews / vidData.items.length).toLocaleString()}`);
                        }
                    }
                    return lines.join('\n');
                }
                case 'youtube_comment_manager': {
                    const { action, video_id, reply_text, max_results } = input;
                    const maxComments = max_results || 50;
                    // Fetch comments
                    const qs = new URLSearchParams({
                        part: 'snippet,replies',
                        videoId: video_id,
                        maxResults: String(maxComments),
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/commentThreads?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    const data = await resp.json();
                    const threads = data.items || [];
                    switch (action) {
                        case 'list_unanswered': {
                            const unanswered = threads.filter((t) => {
                                const replyCount = t.snippet?.totalReplyCount || 0;
                                return replyCount === 0;
                            });
                            const lines = [`UNANSWERED COMMENTS (${unanswered.length}/${threads.length} total)`, ''];
                            for (const t of unanswered.slice(0, 20)) {
                                const comment = t.snippet?.topLevelComment?.snippet;
                                if (comment) {
                                    lines.push(`[${t.id}] ${comment.authorDisplayName}: "${(comment.textDisplay || '').slice(0, 100)}"`);
                                    lines.push(`  Likes: ${comment.likeCount || 0} | ${comment.publishedAt}`);
                                }
                            }
                            return lines.join('\n');
                        }
                        case 'reply_all': {
                            if (!reply_text)
                                return 'Error: reply_text is required for reply_all action.';
                            const unanswered = threads.filter((t) => (t.snippet?.totalReplyCount || 0) === 0);
                            let replied = 0;
                            const lines = [];
                            for (const t of unanswered.slice(0, 10)) {
                                try {
                                    await authFetch(tokenManager, `${BASE_URL}/comments?part=snippet`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            snippet: { parentId: t.id, textOriginal: reply_text },
                                        }),
                                    });
                                    replied++;
                                }
                                catch (e) {
                                    lines.push(`  Failed to reply to ${t.id}: ${e.message}`);
                                }
                            }
                            return `Replied to ${replied}/${unanswered.length} unanswered comments.\n${lines.join('\n')}`;
                        }
                        case 'summary': {
                            const lines = [`COMMENT SUMMARY (${threads.length} threads)`, ''];
                            let totalLikes = 0;
                            let unanswered = 0;
                            const wordFreq = new Map();
                            for (const t of threads) {
                                const comment = t.snippet?.topLevelComment?.snippet;
                                if (!comment)
                                    continue;
                                totalLikes += comment.likeCount || 0;
                                if ((t.snippet?.totalReplyCount || 0) === 0)
                                    unanswered++;
                                // Simple word frequency for themes
                                const words = (comment.textDisplay || '').toLowerCase().split(/\s+/);
                                for (const w of words) {
                                    if (w.length > 4)
                                        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
                                }
                            }
                            lines.push(`Total comments: ${threads.length}`);
                            lines.push(`Unanswered: ${unanswered}`);
                            lines.push(`Total likes on comments: ${totalLikes}`);
                            lines.push('');
                            // Top themes (most frequent words)
                            const topWords = Array.from(wordFreq.entries())
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 10);
                            if (topWords.length > 0) {
                                lines.push('COMMON THEMES/WORDS:');
                                for (const [word, count] of topWords) {
                                    lines.push(`  "${word}" — mentioned ${count}x`);
                                }
                            }
                            // Most liked comments
                            const sortedByLikes = threads
                                .map((t) => t.snippet?.topLevelComment?.snippet)
                                .filter(Boolean)
                                .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
                            if (sortedByLikes.length > 0) {
                                lines.push('', 'MOST LIKED COMMENTS:');
                                for (const c of sortedByLikes.slice(0, 5)) {
                                    lines.push(`  [${c.likeCount} likes] ${c.authorDisplayName}: "${(c.textDisplay || '').slice(0, 80)}"`);
                                }
                            }
                            return lines.join('\n');
                        }
                        default:
                            return `Unknown comment_manager action: ${action}. Use list_unanswered, reply_all, or summary.`;
                    }
                }
                case 'youtube_seo_optimizer': {
                    const qs = new URLSearchParams({
                        part: 'snippet,statistics,status',
                        id: input.video_id,
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/videos?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    const data = await resp.json();
                    const video = data.items?.[0];
                    if (!video)
                        return 'Video not found.';
                    const snippet = video.snippet || {};
                    const title = snippet.title || '';
                    const description = snippet.description || '';
                    const tags = snippet.tags || [];
                    let score = 0;
                    const suggestions = [];
                    // Title analysis (max 20 points)
                    if (title.length >= 30 && title.length <= 60) {
                        score += 20;
                    }
                    else if (title.length > 0) {
                        score += 10;
                        if (title.length < 30)
                            suggestions.push(`Title too short (${title.length} chars). Aim for 30-60 characters for optimal CTR.`);
                        if (title.length > 60)
                            suggestions.push(`Title too long (${title.length} chars). Keep under 60 to avoid truncation.`);
                    }
                    else {
                        suggestions.push('Missing title.');
                    }
                    // Description analysis (max 25 points)
                    if (description.length >= 200) {
                        score += 25;
                    }
                    else if (description.length >= 50) {
                        score += 15;
                        suggestions.push(`Description is ${description.length} chars. Add more detail (200+ chars recommended) with keywords.`);
                    }
                    else {
                        score += 5;
                        suggestions.push('Description is too short. Write 200+ characters with target keywords in the first 2 lines.');
                    }
                    // Tags analysis (max 20 points)
                    if (tags.length >= 5 && tags.length <= 15) {
                        score += 20;
                    }
                    else if (tags.length > 0) {
                        score += 10;
                        if (tags.length < 5)
                            suggestions.push(`Only ${tags.length} tags. Add 5-15 relevant tags.`);
                        if (tags.length > 15)
                            suggestions.push(`${tags.length} tags is too many. Keep 5-15 focused tags.`);
                    }
                    else {
                        suggestions.push('No tags. Add 5-15 relevant keyword tags.');
                    }
                    // Hashtags in description (max 10 points)
                    const hashtagCount = (description.match(/#\w+/g) || []).length;
                    if (hashtagCount >= 1 && hashtagCount <= 3) {
                        score += 10;
                    }
                    else if (hashtagCount === 0) {
                        suggestions.push('No hashtags in description. Add 1-3 hashtags (first 3 appear above title).');
                    }
                    else {
                        score += 5;
                        suggestions.push(`${hashtagCount} hashtags. Keep to 3 max (first 3 appear above video title).`);
                    }
                    // Links in description (max 10 points)
                    const hasLinks = /https?:\/\//.test(description);
                    if (hasLinks) {
                        score += 10;
                    }
                    else {
                        suggestions.push('No links in description. Add your website, social links, or related videos.');
                    }
                    // Timestamps (max 5 points)
                    const hasTimestamps = /\d{1,2}:\d{2}/.test(description);
                    if (hasTimestamps) {
                        score += 5;
                    }
                    else if (description.length > 100) {
                        suggestions.push('Consider adding timestamps for viewer navigation.');
                    }
                    // Engagement potential (max 10 points)
                    const stats = video.statistics || {};
                    const views = Number(stats.viewCount || 0);
                    const likes = Number(stats.likeCount || 0);
                    if (views > 0 && (likes / views) > 0.04) {
                        score += 10;
                    }
                    else if (views > 0) {
                        score += 5;
                        suggestions.push(`Like rate is ${((likes / views) * 100).toFixed(1)}%. Consider asking viewers to like the video.`);
                    }
                    const lines = [
                        `SEO ANALYSIS: "${title}"`,
                        `Score: ${score}/100`,
                        '',
                        'CURRENT METADATA:',
                        `  Title: ${title} (${title.length} chars)`,
                        `  Description: ${description.length} chars`,
                        `  Tags: ${tags.length} (${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''})`,
                        `  Hashtags: ${hashtagCount}`,
                        '',
                    ];
                    if (suggestions.length > 0) {
                        lines.push('SUGGESTIONS:');
                        for (let i = 0; i < suggestions.length; i++) {
                            lines.push(`  ${i + 1}. ${suggestions[i]}`);
                        }
                    }
                    else {
                        lines.push('Great SEO! No major improvements needed.');
                    }
                    return lines.join('\n');
                }
                case 'youtube_thumbnail_test': {
                    const { action, video_id, notes } = input;
                    // Get current video stats
                    const qs = new URLSearchParams({
                        part: 'snippet,statistics',
                        id: video_id,
                        key: tokenManager.getApiKey(),
                    });
                    const resp = await fetch(`${BASE_URL}/videos?${qs}`);
                    if (!resp.ok)
                        throw new Error(`YouTube API ${resp.status}: ${await resp.text()}`);
                    const data = await resp.json();
                    const video = data.items?.[0];
                    if (!video)
                        return 'Video not found.';
                    const stats = video.statistics || {};
                    const views = Number(stats.viewCount || 0);
                    const title = video.snippet?.title || '';
                    if (action === 'check') {
                        const lines = [
                            `THUMBNAIL PERFORMANCE: "${title}"`,
                            '',
                            `Views: ${views.toLocaleString()}`,
                            `Likes: ${Number(stats.likeCount || 0).toLocaleString()}`,
                            `Comments: ${Number(stats.commentCount || 0).toLocaleString()}`,
                            `Current thumbnail: ${video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.high?.url || 'N/A'}`,
                            '',
                            'Note: YouTube does not expose CTR via API. Use YouTube Studio for exact CTR data.',
                            'Track view velocity (views per day) to estimate thumbnail impact after changes.',
                        ];
                        return lines.join('\n');
                    }
                    if (action === 'log_change') {
                        return [
                            `THUMBNAIL CHANGE LOGGED`,
                            `Video: "${title}" (${video_id})`,
                            `Views at change: ${views.toLocaleString()}`,
                            `Timestamp: ${new Date().toISOString()}`,
                            notes ? `Notes: ${notes}` : '',
                            '',
                            'Check back in 48-72 hours to compare view velocity.',
                        ].filter(Boolean).join('\n');
                    }
                    return `Unknown thumbnail_test action: ${action}. Use check or log_change.`;
                }
                case 'youtube_community_post': {
                    const { text, post_type, poll_options, image_path } = input;
                    // Community posts aren't available via YouTube Data API
                    // Route through Desktop marketing queue as browser automation
                    const content = post_type === 'poll'
                        ? `Create a YouTube community POLL post:\n\nText: ${text}\nOptions:\n${(poll_options || []).map((o, i) => `${i + 1}. ${o}`).join('\n')}`
                        : `Create a YouTube community post:\n\n${text}`;
                    try {
                        const resp = await fetch(`http://127.0.0.1:3002/queue/add`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform: 'youtube',
                                action: 'custom',
                                content,
                                customInstructions: `Navigate to YouTube Studio > Community tab and create a ${post_type || 'text'} post.`,
                                mediaUrls: image_path ? [image_path] : undefined,
                                priority: 7,
                            }),
                        });
                        const data = await resp.json();
                        return `Community post queued (Task ID: ${data.task?.id || 'unknown'}). Type: ${post_type || 'text'}.\nContent: "${text.slice(0, 100)}..."`;
                    }
                    catch {
                        return `Could not queue community post — Desktop may be offline. Content: "${text.slice(0, 100)}..."`;
                    }
                }
                case 'youtube_revenue_report': {
                    const maxResults = input.max_results || 20;
                    // Get channel uploads
                    const channelResp = await authFetch(tokenManager, `${BASE_URL}/channels?part=contentDetails,snippet,statistics&mine=true`);
                    const channelData = await channelResp.json();
                    const channel = channelData.items?.[0];
                    if (!channel)
                        return 'No authenticated channel found.';
                    const uploadsId = channel.contentDetails?.relatedPlaylists?.uploads;
                    if (!uploadsId)
                        return 'No uploads playlist found.';
                    // Get recent videos
                    const plResp = await fetch(`${BASE_URL}/playlistItems?part=contentDetails&playlistId=${uploadsId}&maxResults=${maxResults}&key=${tokenManager.getApiKey()}`);
                    if (!plResp.ok)
                        throw new Error(`YouTube API ${plResp.status}: ${await plResp.text()}`);
                    const plData = await plResp.json();
                    const videoIds = (plData.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
                    if (videoIds.length === 0)
                        return 'No uploads found.';
                    const vidResp = await fetch(`${BASE_URL}/videos?part=snippet,statistics&id=${videoIds.join(',')}&key=${tokenManager.getApiKey()}`);
                    if (!vidResp.ok)
                        throw new Error(`YouTube API ${vidResp.status}: ${await vidResp.text()}`);
                    const vidData = await vidResp.json();
                    // Estimate revenue using CPM range ($2-5 per 1000 views)
                    const lowCPM = 2.0;
                    const highCPM = 5.0;
                    let totalViews = 0;
                    const lines = [
                        `ESTIMATED REVENUE REPORT`,
                        `Channel: ${channel.snippet?.title}`,
                        `Total subscribers: ${Number(channel.statistics?.subscriberCount || 0).toLocaleString()}`,
                        `Total channel views: ${Number(channel.statistics?.viewCount || 0).toLocaleString()}`,
                        '',
                        `RECENT ${videoIds.length} VIDEOS:`,
                    ];
                    for (const v of vidData.items || []) {
                        const views = Number(v.statistics?.viewCount || 0);
                        totalViews += views;
                        const lowEst = ((views / 1000) * lowCPM).toFixed(2);
                        const highEst = ((views / 1000) * highCPM).toFixed(2);
                        lines.push(`  "${(v.snippet?.title || '').slice(0, 40)}" — ${views.toLocaleString()} views ($${lowEst}-$${highEst})`);
                    }
                    const totalLow = ((totalViews / 1000) * lowCPM).toFixed(2);
                    const totalHigh = ((totalViews / 1000) * highCPM).toFixed(2);
                    const channelTotalViews = Number(channel.statistics?.viewCount || 0);
                    const channelLow = ((channelTotalViews / 1000) * lowCPM).toFixed(2);
                    const channelHigh = ((channelTotalViews / 1000) * highCPM).toFixed(2);
                    lines.push('');
                    lines.push('ESTIMATES (based on $2-5 CPM):');
                    lines.push(`  Recent ${videoIds.length} videos: $${totalLow} - $${totalHigh}`);
                    lines.push(`  All-time channel: $${channelLow} - $${channelHigh}`);
                    lines.push('');
                    lines.push('Note: These are rough estimates. Actual revenue depends on ad types, viewer location, niche, and monetization eligibility. Check YouTube Studio for exact numbers.');
                    return lines.join('\n');
                }
                case 'youtube_playlist_manager': {
                    const { action, playlist_id, new_title } = input;
                    switch (action) {
                        case 'list_all': {
                            const resp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet,contentDetails&mine=true&maxResults=50`);
                            const data = await resp.json();
                            const playlists = data.items || [];
                            if (playlists.length === 0)
                                return 'No playlists found.';
                            const lines = [`YOUR PLAYLISTS (${playlists.length})`, ''];
                            for (const p of playlists) {
                                lines.push(`[${p.id}] "${p.snippet?.title}" — ${p.contentDetails?.itemCount || 0} videos`);
                                if (p.snippet?.description)
                                    lines.push(`  ${p.snippet.description.slice(0, 80)}`);
                            }
                            return lines.join('\n');
                        }
                        case 'stats': {
                            if (!playlist_id)
                                return 'Error: playlist_id required for stats.';
                            // Get playlist info
                            const plResp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet,contentDetails&id=${playlist_id}`);
                            const plData = await plResp.json();
                            const playlist = plData.items?.[0];
                            if (!playlist)
                                return 'Playlist not found.';
                            // Get playlist items
                            const itemsResp = await fetch(`${BASE_URL}/playlistItems?part=contentDetails&playlistId=${playlist_id}&maxResults=50&key=${tokenManager.getApiKey()}`);
                            if (!itemsResp.ok)
                                throw new Error(`YouTube API ${itemsResp.status}`);
                            const itemsData = await itemsResp.json();
                            const videoIds = (itemsData.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean);
                            const lines = [
                                `PLAYLIST STATS: "${playlist.snippet?.title}"`,
                                `Videos: ${playlist.contentDetails?.itemCount || 0}`,
                                '',
                            ];
                            if (videoIds.length > 0) {
                                const vidResp = await fetch(`${BASE_URL}/videos?part=statistics&id=${videoIds.join(',')}&key=${tokenManager.getApiKey()}`);
                                if (vidResp.ok) {
                                    const vidData = await vidResp.json();
                                    let totalViews = 0, totalLikes = 0;
                                    for (const v of vidData.items || []) {
                                        totalViews += Number(v.statistics?.viewCount || 0);
                                        totalLikes += Number(v.statistics?.likeCount || 0);
                                    }
                                    lines.push(`Total views: ${totalViews.toLocaleString()}`);
                                    lines.push(`Total likes: ${totalLikes.toLocaleString()}`);
                                    if (videoIds.length > 0) {
                                        lines.push(`Avg views/video: ${Math.round(totalViews / videoIds.length).toLocaleString()}`);
                                    }
                                }
                            }
                            return lines.join('\n');
                        }
                        case 'clone': {
                            if (!playlist_id)
                                return 'Error: playlist_id required for clone.';
                            // Get source playlist
                            const srcResp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet&id=${playlist_id}`);
                            const srcData = await srcResp.json();
                            const srcPlaylist = srcData.items?.[0];
                            if (!srcPlaylist)
                                return 'Source playlist not found.';
                            // Create new playlist
                            const title = new_title || `${srcPlaylist.snippet?.title} (Copy)`;
                            const createResp = await authFetch(tokenManager, `${BASE_URL}/playlists?part=snippet,status`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    snippet: { title, description: `Cloned from: ${srcPlaylist.snippet?.title}` },
                                    status: { privacyStatus: 'private' },
                                }),
                            });
                            const newPlaylist = await createResp.json();
                            // Get items from source
                            const itemsResp = await fetch(`${BASE_URL}/playlistItems?part=contentDetails&playlistId=${playlist_id}&maxResults=50&key=${tokenManager.getApiKey()}`);
                            if (!itemsResp.ok)
                                throw new Error(`Failed to get source items`);
                            const itemsData = await itemsResp.json();
                            // Add items to new playlist
                            let added = 0;
                            for (const item of itemsData.items || []) {
                                try {
                                    await authFetch(tokenManager, `${BASE_URL}/playlistItems?part=snippet`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            snippet: {
                                                playlistId: newPlaylist.id,
                                                resourceId: { kind: 'youtube#video', videoId: item.contentDetails?.videoId },
                                            },
                                        }),
                                    });
                                    added++;
                                }
                                catch { /* skip failed items */ }
                            }
                            return `Cloned playlist "${srcPlaylist.snippet?.title}" → "${title}" (${newPlaylist.id}). ${added}/${(itemsData.items || []).length} videos copied.`;
                        }
                        default:
                            return `Unknown playlist_manager action: ${action}. Use list_all, stats, or clone.`;
                    }
                }
                case 'youtube_upload_scheduler': {
                    const { file_path, title, description, tags, scheduled_time, privacy_status } = input;
                    // Validate file exists
                    if (!fs.existsSync(file_path)) {
                        return `Error: Video file not found at "${file_path}".`;
                    }
                    // Queue in Desktop for future execution
                    try {
                        const content = `Upload video to YouTube:\nTitle: ${title}\nFile: ${file_path}${description ? `\nDescription: ${description}` : ''}${tags?.length ? `\nTags: ${tags.join(', ')}` : ''}\nPrivacy: ${privacy_status || 'private'}`;
                        const resp = await fetch(`http://127.0.0.1:3002/queue/add`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                platform: 'youtube',
                                action: 'custom',
                                content,
                                customInstructions: `Use youtube_upload_video tool to upload "${file_path}" with title "${title}", description "${description || ''}", tags [${(tags || []).join(',')}], privacy "${privacy_status || 'private'}"`,
                                scheduledTime: scheduled_time,
                                priority: 8,
                            }),
                        });
                        const data = await resp.json();
                        return `Video upload scheduled for ${scheduled_time}.\nTask ID: ${data.task?.id || 'unknown'}\nTitle: "${title}"\nFile: ${file_path}`;
                    }
                    catch {
                        return `Could not schedule upload — Desktop may be offline.`;
                    }
                }
                default:
                    return `Unknown YouTube tool: ${toolName}`;
            }
        }
        catch (error) {
            return `YouTube error: ${error.message}`;
        }
    };
}
exports.createYouTubeExecutor = createYouTubeExecutor;
//# sourceMappingURL=youtube-executor.js.map