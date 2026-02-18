"use strict";
/**
 * YouTube Studio Browser Automation — Tool Definitions
 *
 * 5 tools for controlling YouTube Studio directly through the Desktop browser.
 * These pierce Shadow DOM automatically via studio-browser-helpers.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.YOUTUBE_STUDIO_TOOLS = void 0;
exports.YOUTUBE_STUDIO_TOOLS = [
    {
        name: 'yt_studio_navigate',
        description: 'Navigate to a YouTube Studio section. Requires an authenticated Google session in the Desktop browser. Use yt_studio_session_check first to verify session health.',
        input_schema: {
            type: 'object',
            properties: {
                section: {
                    type: 'string',
                    description: 'Studio section: dashboard, content, analytics, comments, subtitles, copyright, earn, customization, audio_library',
                },
            },
            required: ['section'],
        },
    },
    {
        name: 'yt_studio_video_list',
        description: 'Get list of videos from YouTube Studio content page. Scrapes the Shadow DOM table to extract video titles, IDs, status, views, and dates. Returns up to max_results videos.',
        input_schema: {
            type: 'object',
            properties: {
                max_results: {
                    type: 'number',
                    description: 'Max videos to return (default 20)',
                },
                filter: {
                    type: 'string',
                    description: 'Filter: all, public, private, unlisted, draft, copyright (default: all). "copyright" filters to videos with copyright claims.',
                },
            },
        },
    },
    {
        name: 'yt_studio_copyright_check',
        description: 'Check copyright claim status for a specific video in YouTube Studio. Navigates to the video copyright page and reads claim details (asset name, claimant, status, available actions).',
        input_schema: {
            type: 'object',
            properties: {
                video_id: {
                    type: 'string',
                    description: 'YouTube video ID to check',
                },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'yt_studio_erase_song',
        description: 'Erase a copyrighted song from a video in YouTube Studio. Clicks Take Action → Erase Song → Save for the specified claim. Always call yt_studio_copyright_check first to verify claims exist.',
        input_schema: {
            type: 'object',
            properties: {
                video_id: {
                    type: 'string',
                    description: 'YouTube video ID',
                },
                claim_index: {
                    type: 'number',
                    description: 'Which claim to erase (0-based index, default 0 for first claim)',
                },
            },
            required: ['video_id'],
        },
    },
    {
        name: 'yt_studio_session_check',
        description: 'Check YouTube/Google session health. Reports if the browser session is authenticated, when it was last active, and whether re-login may be needed. Always call this before any YouTube Studio operation.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
];
//# sourceMappingURL=youtube-studio-tools.js.map