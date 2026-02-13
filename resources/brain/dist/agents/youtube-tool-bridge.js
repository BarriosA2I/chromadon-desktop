"use strict";
/**
 * YouTubeToolBridge — Typed wrapper around the YouTube tool executor
 * =================================================================
 * Provides the agent system and CortexRouter with direct access to
 * the 23 YouTube Data API tools without going through the monolithic
 * orchestrator's LLM loop.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTubeToolBridge = void 0;
const event_bus_1 = require("./event-bus");
class YouTubeToolBridge {
    executor;
    constructor(executor) {
        this.executor = executor;
    }
    /** Generic: call any YouTube tool by name */
    async call(toolName, args = {}) {
        const start = Date.now();
        const eventBus = (0, event_bus_1.getEventBus)();
        eventBus.publish({
            type: 'ACTION_PERFORMED',
            source: 'THE_CORTEX',
            correlationId: `yt-${toolName}-${start}`,
            payload: { action: 'youtube.api.call', tool: toolName, args },
        });
        try {
            const resultStr = await this.executor(toolName, args);
            const durationMs = Date.now() - start;
            eventBus.publish({
                type: 'STEP_COMPLETED',
                source: 'THE_CORTEX',
                correlationId: `yt-${toolName}-${start}`,
                payload: { action: 'youtube.api.call', tool: toolName, durationMs, success: true },
            });
            // Parse JSON result (executor returns JSON strings)
            try {
                return JSON.parse(resultStr);
            }
            catch {
                return resultStr;
            }
        }
        catch (error) {
            eventBus.publish({
                type: 'AGENT_ERROR',
                source: 'THE_CORTEX',
                correlationId: `yt-${toolName}-${start}`,
                payload: { action: 'youtube.api.call', tool: toolName, error: error.message, durationMs: Date.now() - start },
            });
            throw error;
        }
    }
    // === Typed convenience methods ===
    async authStatus() {
        return this.call('youtube_auth_status');
    }
    async search(query, maxResults = 10) {
        return this.call('youtube_search', { query, max_results: maxResults });
    }
    async getVideo(videoId) {
        return this.call('youtube_get_video', { video_id: videoId });
    }
    async getMyChannel() {
        return this.call('youtube_get_my_channel');
    }
    async getChannel(channelId) {
        return this.call('youtube_get_channel', { channel_id: channelId });
    }
    async updateVideo(videoId, updates) {
        return this.call('youtube_update_video', { video_id: videoId, ...updates });
    }
    async uploadVideo(filePath, title, opts) {
        return this.call('youtube_upload_video', { file_path: filePath, title, ...opts });
    }
    async deleteVideo(videoId) {
        return this.call('youtube_delete_video', { video_id: videoId });
    }
    async listMyPlaylists(maxResults = 25) {
        return this.call('youtube_list_my_playlists', { max_results: maxResults });
    }
    async createPlaylist(title, description) {
        return this.call('youtube_create_playlist', { title, description });
    }
    async addToPlaylist(playlistId, videoId) {
        return this.call('youtube_add_to_playlist', { playlist_id: playlistId, video_id: videoId });
    }
    async listPlaylistItems(playlistId, maxResults = 25) {
        return this.call('youtube_list_playlist_items', { playlist_id: playlistId, max_results: maxResults });
    }
    async listComments(videoId, maxResults = 20) {
        return this.call('youtube_list_comments', { video_id: videoId, max_results: maxResults });
    }
    async postComment(videoId, text) {
        return this.call('youtube_post_comment', { video_id: videoId, text });
    }
    async replyToComment(parentId, text) {
        return this.call('youtube_reply_to_comment', { parent_id: parentId, text });
    }
    async subscribe(channelId) {
        return this.call('youtube_subscribe', { channel_id: channelId });
    }
    async rateVideo(videoId, rating) {
        return this.call('youtube_rate_video', { video_id: videoId, rating });
    }
}
exports.YouTubeToolBridge = YouTubeToolBridge;
//# sourceMappingURL=youtube-tool-bridge.js.map