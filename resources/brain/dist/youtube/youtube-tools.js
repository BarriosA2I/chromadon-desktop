"use strict";
/**
 * YouTube Data API v3 Tool Definitions
 *
 * 23 tools in Anthropic ToolDefinition format for the Agentic Orchestrator.
 * Follows the same pattern as BROWSER_TOOLS and ANALYTICS_TOOLS.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YOUTUBE_TOOLS = void 0;
exports.YOUTUBE_TOOLS = [
    // =========================================================================
    // AUTH MANAGEMENT (3 tools)
    // =========================================================================
    {
        name: 'youtube_auth_status',
        description: 'Check YouTube OAuth authorization status, API key configuration, and remaining daily quota.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'youtube_oauth_authorize',
        description: 'Generate Google OAuth consent URL for YouTube authorization. User visits the URL, grants permissions, and gets an authorization code to pass to youtube_oauth_callback.',
        input_schema: {
            type: 'object',
            properties: {
                redirect_uri: { type: 'string', description: 'OAuth redirect URI (default: oob for manual copy)' },
            },
        },
    },
    {
        name: 'youtube_oauth_callback',
        description: 'Exchange an authorization code for OAuth tokens. Use after user completes the consent flow from youtube_oauth_authorize.',
        input_schema: {
            type: 'object',
            properties: {
                code: { type: 'string', description: 'Authorization code from Google consent' },
                redirect_uri: { type: 'string', description: 'Must match the redirect_uri used in youtube_oauth_authorize' },
            },
            required: ['code'],
        },
    },
    // =========================================================================
    // PUBLIC TOOLS - API Key only (5 tools)
    // =========================================================================
    {
        name: 'youtube_search',
        description: 'Search YouTube for videos, channels, or playlists. Returns titles, thumbnails, channel info, and video IDs. Costs 100 quota units per call.',
        input_schema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query text' },
                max_results: { type: 'number', description: 'Max results 1-50 (default 10)' },
                type: { type: 'string', description: 'Filter by type: video, channel, or playlist' },
                order: { type: 'string', description: 'Sort order: date, rating, relevance, title, viewCount' },
            },
            required: ['query'],
        },
    },
    {
        name: 'youtube_get_video',
        description: 'Get detailed info about a YouTube video including title, description, view count, likes, duration, and publish date.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID (e.g. dQw4w9WgXcQ)' },
                parts: { type: 'string', description: 'Comma-separated parts: snippet,statistics,contentDetails,status (default: snippet,statistics,contentDetails)' },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'youtube_get_channel',
        description: 'Get YouTube channel details including subscriber count, total views, video count, and description.',
        input_schema: {
            type: 'object',
            properties: {
                channel_id: { type: 'string', description: 'YouTube channel ID' },
                parts: { type: 'string', description: 'Comma-separated parts: snippet,statistics,contentDetails (default: snippet,statistics,contentDetails)' },
            },
            required: ['channel_id'],
        },
    },
    {
        name: 'youtube_list_playlist_items',
        description: 'List all videos in a YouTube playlist with their titles, positions, and video IDs.',
        input_schema: {
            type: 'object',
            properties: {
                playlist_id: { type: 'string', description: 'YouTube playlist ID' },
                max_results: { type: 'number', description: 'Max results 1-50 (default 25)' },
            },
            required: ['playlist_id'],
        },
    },
    {
        name: 'youtube_list_comments',
        description: 'List comment threads on a YouTube video including top-level comments and their replies.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID' },
                max_results: { type: 'number', description: 'Max results 1-100 (default 20)' },
            },
            required: ['video_id'],
        },
    },
    // =========================================================================
    // AUTHENTICATED TOOLS - OAuth required (15 tools)
    // =========================================================================
    {
        name: 'youtube_upload_video',
        description: 'Upload a video file to YouTube using resumable upload. Costs 1600 quota units. File must be accessible on disk.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to video file on disk' },
                title: { type: 'string', description: 'Video title' },
                description: { type: 'string', description: 'Video description' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Video tags' },
                privacy_status: { type: 'string', description: 'Privacy: private, unlisted, or public (default: private)' },
                category_id: { type: 'string', description: 'YouTube category ID (default: 22 for People & Blogs)' },
            },
            required: ['file_path', 'title'],
        },
    },
    {
        name: 'youtube_update_video',
        description: 'Update metadata of an existing YouTube video (title, description, tags, privacy, category).',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID to update' },
                title: { type: 'string', description: 'New title' },
                description: { type: 'string', description: 'New description' },
                tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
                privacy_status: { type: 'string', description: 'New privacy: private, unlisted, or public' },
                category_id: { type: 'string', description: 'New category ID' },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'youtube_delete_video',
        description: 'Permanently delete a YouTube video. This cannot be undone.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID to delete' },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'youtube_create_playlist',
        description: 'Create a new YouTube playlist.',
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Playlist title' },
                description: { type: 'string', description: 'Playlist description' },
                privacy_status: { type: 'string', description: 'Privacy: private, unlisted, or public (default: private)' },
            },
            required: ['title'],
        },
    },
    {
        name: 'youtube_update_playlist',
        description: 'Update metadata of an existing YouTube playlist.',
        input_schema: {
            type: 'object',
            properties: {
                playlist_id: { type: 'string', description: 'YouTube playlist ID' },
                title: { type: 'string', description: 'New title' },
                description: { type: 'string', description: 'New description' },
                privacy_status: { type: 'string', description: 'New privacy: private, unlisted, or public' },
            },
            required: ['playlist_id'],
        },
    },
    {
        name: 'youtube_delete_playlist',
        description: 'Permanently delete a YouTube playlist. This cannot be undone.',
        input_schema: {
            type: 'object',
            properties: {
                playlist_id: { type: 'string', description: 'YouTube playlist ID to delete' },
            },
            required: ['playlist_id'],
        },
    },
    {
        name: 'youtube_add_to_playlist',
        description: 'Add a video to a YouTube playlist at an optional position.',
        input_schema: {
            type: 'object',
            properties: {
                playlist_id: { type: 'string', description: 'YouTube playlist ID' },
                video_id: { type: 'string', description: 'YouTube video ID to add' },
                position: { type: 'number', description: 'Position in playlist (0-based, optional)' },
            },
            required: ['playlist_id', 'video_id'],
        },
    },
    {
        name: 'youtube_remove_from_playlist',
        description: 'Remove an item from a YouTube playlist by its playlist item ID.',
        input_schema: {
            type: 'object',
            properties: {
                playlist_item_id: { type: 'string', description: 'Playlist item ID (from youtube_list_playlist_items)' },
            },
            required: ['playlist_item_id'],
        },
    },
    {
        name: 'youtube_post_comment',
        description: 'Post a top-level comment on a YouTube video.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID' },
                text: { type: 'string', description: 'Comment text' },
            },
            required: ['video_id', 'text'],
        },
    },
    {
        name: 'youtube_reply_to_comment',
        description: 'Reply to an existing YouTube comment.',
        input_schema: {
            type: 'object',
            properties: {
                parent_id: { type: 'string', description: 'Parent comment ID to reply to' },
                text: { type: 'string', description: 'Reply text' },
            },
            required: ['parent_id', 'text'],
        },
    },
    {
        name: 'youtube_rate_video',
        description: 'Like, dislike, or remove your rating from a YouTube video.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID' },
                rating: { type: 'string', description: 'Rating: like, dislike, or none (to remove)' },
            },
            required: ['video_id', 'rating'],
        },
    },
    {
        name: 'youtube_get_my_channel',
        description: 'Get the authenticated user\'s YouTube channel info including subscriber count, total views, and uploads playlist ID.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'youtube_list_my_playlists',
        description: 'List all playlists owned by the authenticated user.',
        input_schema: {
            type: 'object',
            properties: {
                max_results: { type: 'number', description: 'Max results 1-50 (default 25)' },
            },
        },
    },
    {
        name: 'youtube_subscribe',
        description: 'Subscribe to a YouTube channel.',
        input_schema: {
            type: 'object',
            properties: {
                channel_id: { type: 'string', description: 'YouTube channel ID to subscribe to' },
            },
            required: ['channel_id'],
        },
    },
    {
        name: 'youtube_unsubscribe',
        description: 'Unsubscribe from a YouTube channel by subscription ID.',
        input_schema: {
            type: 'object',
            properties: {
                subscription_id: { type: 'string', description: 'Subscription ID (from subscriptions list)' },
            },
            required: ['subscription_id'],
        },
    },
    // =========================================================================
    // YOUTUBE STUDIO TOOLS (v1.4.0)
    // =========================================================================
    {
        name: 'youtube_video_analytics',
        description: 'Get a detailed performance report for a specific video or your channel\'s recent uploads. Shows views, likes, comments, engagement rate, and performance comparison. Use when the user asks about video performance or wants analytics.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'Specific video ID to analyze (optional — omit for channel-wide recent uploads report)' },
                max_results: { type: 'number', description: 'Number of recent videos to analyze if no video_id (default: 10)' },
            },
        },
    },
    {
        name: 'youtube_comment_manager',
        description: 'Bulk comment management for YouTube videos. List unanswered comments, reply to all unanswered with a template, or get a comment summary with themes and sentiment. Use when the user wants to manage comments in bulk.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list_unanswered', 'reply_all', 'summary'],
                    description: 'Action: list_unanswered (comments without replies), reply_all (reply to all unanswered), summary (themes and stats)',
                },
                video_id: { type: 'string', description: 'YouTube video ID' },
                reply_text: { type: 'string', description: 'Reply text for reply_all action' },
                max_results: { type: 'number', description: 'Max comments to process (default: 50)' },
            },
            required: ['action', 'video_id'],
        },
    },
    {
        name: 'youtube_seo_optimizer',
        description: 'Analyze a YouTube video\'s SEO and get specific improvement suggestions. Checks title length, description keywords, tag count, and thumbnail. Returns an SEO score with actionable recommendations. Use when the user wants to optimize a video for search.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: { type: 'string', description: 'YouTube video ID to analyze' },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'youtube_thumbnail_test',
        description: 'Track thumbnail performance for a video. Check current view stats (as a CTR proxy) or log a thumbnail change for later comparison. Use when the user wants to test different thumbnails.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['check', 'log_change'],
                    description: 'check: get current stats, log_change: record a thumbnail change event',
                },
                video_id: { type: 'string', description: 'YouTube video ID' },
                notes: { type: 'string', description: 'Notes about the thumbnail change (for log_change)' },
            },
            required: ['action', 'video_id'],
        },
    },
    {
        name: 'youtube_community_post',
        description: 'Create a YouTube community tab post. Since community posts aren\'t available via API, this queues a browser automation task to navigate YouTube Studio and post. Use when the user wants to post to their YouTube community tab.',
        input_schema: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'Community post text content' },
                post_type: {
                    type: 'string',
                    enum: ['text', 'poll', 'image'],
                    description: 'Type of community post (default: text)',
                },
                poll_options: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Poll options (required if post_type is poll)',
                },
                image_path: { type: 'string', description: 'Path to image file (for image posts)' },
            },
            required: ['text'],
        },
    },
    {
        name: 'youtube_revenue_report',
        description: 'Get an estimated revenue report based on video view counts and industry CPM estimates. Provides per-video and total estimated earnings. Use when the user asks about monetization or revenue.',
        input_schema: {
            type: 'object',
            properties: {
                max_results: { type: 'number', description: 'Number of recent videos to include (default: 20)' },
            },
        },
    },
    {
        name: 'youtube_playlist_manager',
        description: 'Advanced playlist management. List all playlists with stats, get detailed playlist analytics, or clone a playlist. Use when the user wants to manage playlists beyond basic CRUD.',
        input_schema: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['list_all', 'stats', 'clone'],
                    description: 'list_all: all playlists with counts, stats: detailed playlist stats, clone: copy playlist to new one',
                },
                playlist_id: { type: 'string', description: 'Playlist ID (required for stats and clone)' },
                new_title: { type: 'string', description: 'Title for cloned playlist (for clone action)' },
            },
            required: ['action'],
        },
    },
    {
        name: 'youtube_upload_scheduler',
        description: 'Schedule a video upload for a future time. Queues the upload in the marketing queue and executes it at the scheduled time. Use when the user wants to upload a video at a specific time in the future.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'Absolute path to video file on disk' },
                title: { type: 'string', description: 'Video title' },
                description: { type: 'string', description: 'Video description' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Video tags' },
                scheduled_time: { type: 'string', description: 'ISO 8601 datetime for when to upload (required)' },
                privacy_status: { type: 'string', description: 'Privacy: private, unlisted, or public (default: private)' },
            },
            required: ['file_path', 'title', 'scheduled_time'],
        },
    },
];
//# sourceMappingURL=youtube-tools.js.map