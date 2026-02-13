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
                        instructions: 'Visit this URL in a browser, grant permissions, then pass the authorization code to youtube_oauth_callback',
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