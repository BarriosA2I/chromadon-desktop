/**
 * YouTubeToolBridge — Typed wrapper around the YouTube tool executor
 * =================================================================
 * Provides the agent system and CortexRouter with direct access to
 * the 23 YouTube Data API tools without going through the monolithic
 * orchestrator's LLM loop.
 *
 * @author Barrios A2I
 */
export type YouTubeToolExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
export declare class YouTubeToolBridge {
    private executor;
    constructor(executor: YouTubeToolExecutor);
    /** Generic: call any YouTube tool by name */
    call(toolName: string, args?: Record<string, any>): Promise<any>;
    authStatus(): Promise<{
        authorized: boolean;
        quotaRemaining: number;
    }>;
    search(query: string, maxResults?: number): Promise<any[]>;
    getVideo(videoId: string): Promise<any>;
    getMyChannel(): Promise<any>;
    getChannel(channelId: string): Promise<any>;
    updateVideo(videoId: string, updates: Record<string, any>): Promise<any>;
    uploadVideo(filePath: string, title: string, opts?: Record<string, any>): Promise<any>;
    deleteVideo(videoId: string): Promise<any>;
    listMyPlaylists(maxResults?: number): Promise<any[]>;
    createPlaylist(title: string, description?: string): Promise<any>;
    addToPlaylist(playlistId: string, videoId: string): Promise<any>;
    listPlaylistItems(playlistId: string, maxResults?: number): Promise<any[]>;
    listComments(videoId: string, maxResults?: number): Promise<any[]>;
    postComment(videoId: string, text: string): Promise<any>;
    replyToComment(parentId: string, text: string): Promise<any>;
    subscribe(channelId: string): Promise<any>;
    rateVideo(videoId: string, rating: 'like' | 'dislike' | 'none'): Promise<any>;
}
//# sourceMappingURL=youtube-tool-bridge.d.ts.map