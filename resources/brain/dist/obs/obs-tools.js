"use strict";
/**
 * OBS Studio - Claude Tool Definitions
 *
 * 9 tools in Anthropic Tool[] schema format for controlling
 * OBS Studio via WebSocket from the AI assistant chat.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBS_TOOLS = void 0;
exports.OBS_TOOLS = [
    {
        name: 'obs_stream_start',
        description: 'Start the OBS live stream. Safe mode will block if the current scene is not in the approved list (StartingSoon, Main). Use obs_scene_set to switch to an approved scene first if needed.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_stream_stop',
        description: 'Stop the OBS live stream. Returns success even if the stream is already stopped.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_record_start',
        description: 'Start recording in OBS. The recording file will be saved to the configured OBS output directory.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_record_stop',
        description: 'Stop recording in OBS. Returns the output file path of the recording.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_scene_set',
        description: 'Switch the current OBS scene. Available scenes: StartingSoon, Main, BRB, Ending. Scene names are case-sensitive.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'The exact name of the scene to switch to (case-sensitive). Common scenes: StartingSoon, Main, BRB, Ending.',
                },
            },
            required: ['sceneName'],
        },
    },
    {
        name: 'obs_scene_list',
        description: 'List all available OBS scenes and the current active scene.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_status',
        description: 'Get full OBS status including: connection state, streaming/recording status, current scene, available scenes, FPS, CPU and memory usage.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_mic_mute',
        description: 'Mute or unmute a microphone input in OBS. If no inputName is specified, tries common mic names (Mic/Aux, Blue Yeti, Microphone, etc.).',
        input_schema: {
            type: 'object',
            properties: {
                mute: {
                    type: 'boolean',
                    description: 'true to mute, false to unmute',
                },
                inputName: {
                    type: 'string',
                    description: 'Exact name of the audio input in OBS (optional — auto-detects if omitted)',
                },
            },
            required: ['mute'],
        },
    },
    {
        name: 'obs_source_visibility',
        description: 'Show or hide a source within an OBS scene. Use this to toggle overlays, webcam, watermarks, etc.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'The scene containing the source (case-sensitive)',
                },
                sourceName: {
                    type: 'string',
                    description: 'The exact name of the source to show/hide (case-sensitive)',
                },
                visible: {
                    type: 'boolean',
                    description: 'true to show, false to hide',
                },
            },
            required: ['sceneName', 'sourceName', 'visible'],
        },
    },
    // ─── Configuration Tools ─────────────────────────────────
    {
        name: 'obs_configure_stream',
        description: 'Configure OBS streaming service settings (service type, server URL, stream key). Use this to set up Twitch, YouTube, or custom RTMP streaming.',
        input_schema: {
            type: 'object',
            properties: {
                service: {
                    type: 'string',
                    description: 'Streaming service name (e.g. "Twitch", "YouTube - RTMPS", "Custom"). For custom RTMP, use "rtmp_custom".',
                },
                server: {
                    type: 'string',
                    description: 'RTMP server URL (e.g. "rtmp://live.twitch.tv/app")',
                },
                key: {
                    type: 'string',
                    description: 'Stream key from the streaming platform. NEVER display this back to the user.',
                },
            },
            required: ['service', 'server', 'key'],
        },
    },
    {
        name: 'obs_configure_video',
        description: 'Set OBS video output settings: canvas resolution, output resolution, and FPS. Common presets: 1920x1080@60fps, 1280x720@30fps.',
        input_schema: {
            type: 'object',
            properties: {
                baseWidth: {
                    type: 'number',
                    description: 'Canvas (base) width in pixels (e.g. 1920)',
                },
                baseHeight: {
                    type: 'number',
                    description: 'Canvas (base) height in pixels (e.g. 1080)',
                },
                outputWidth: {
                    type: 'number',
                    description: 'Scaled output width in pixels (e.g. 1280 for 720p downscale)',
                },
                outputHeight: {
                    type: 'number',
                    description: 'Scaled output height in pixels (e.g. 720 for 720p downscale)',
                },
                fps: {
                    type: 'number',
                    description: 'Frames per second (common: 30 or 60)',
                },
            },
            required: ['baseWidth', 'baseHeight', 'outputWidth', 'outputHeight', 'fps'],
        },
    },
    {
        name: 'obs_configure_recording',
        description: 'Set OBS recording output path and format. Supports mkv, mp4, flv formats.',
        input_schema: {
            type: 'object',
            properties: {
                path: {
                    type: 'string',
                    description: 'Output directory for recordings (e.g. "C:/Videos/OBS")',
                },
                format: {
                    type: 'string',
                    description: 'Recording format: "mkv" (recommended, crash-safe), "mp4", or "flv"',
                },
            },
            required: ['path'],
        },
    },
    // ─── Scene Management Tools ──────────────────────────────
    {
        name: 'obs_create_scene',
        description: 'Create a new empty scene in OBS. Scene names are case-sensitive and must be unique.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'Name for the new scene (case-sensitive, must be unique)',
                },
            },
            required: ['sceneName'],
        },
    },
    {
        name: 'obs_remove_scene',
        description: 'Remove a scene from OBS. Cannot remove the last remaining scene.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'Exact name of the scene to remove (case-sensitive)',
                },
            },
            required: ['sceneName'],
        },
    },
    // ─── Source Management Tools ─────────────────────────────
    {
        name: 'obs_add_source',
        description: 'Add a new source to an OBS scene. Source kinds: "browser_source" (web page), "dshow_input" (webcam), "monitor_capture" (screen), "window_capture" (app window), "image_source" (image file), "text_gdiplus" (text overlay), "ffmpeg_source" (media file).',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'Scene to add the source to (case-sensitive)',
                },
                sourceName: {
                    type: 'string',
                    description: 'Name for the new source (case-sensitive, must be unique)',
                },
                sourceKind: {
                    type: 'string',
                    description: 'Source type: "browser_source", "dshow_input" (webcam), "monitor_capture", "window_capture", "image_source", "text_gdiplus", "ffmpeg_source"',
                },
                settings: {
                    type: 'object',
                    description: 'Kind-specific settings. browser_source: {url, width, height}. image_source: {file}. text_gdiplus: {text, font: {face, size}}. ffmpeg_source: {local_file}. dshow_input: {video_device_id} (optional, auto-selects first webcam).',
                },
            },
            required: ['sceneName', 'sourceName', 'sourceKind'],
        },
    },
    {
        name: 'obs_remove_source',
        description: 'Remove a source from an OBS scene.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'Scene containing the source (case-sensitive)',
                },
                sourceName: {
                    type: 'string',
                    description: 'Exact name of the source to remove (case-sensitive)',
                },
            },
            required: ['sceneName', 'sourceName'],
        },
    },
    {
        name: 'obs_get_sources',
        description: 'List all sources in an OBS scene with their type, settings, and enabled state.',
        input_schema: {
            type: 'object',
            properties: {
                sceneName: {
                    type: 'string',
                    description: 'Scene to list sources from (case-sensitive)',
                },
            },
            required: ['sceneName'],
        },
    },
    // ─── Info Tool ───────────────────────────────────────────
    {
        name: 'obs_get_settings',
        description: 'Get current OBS configuration including stream service settings, video resolution/FPS, and recording output path.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    // ─── Desktop Launch Tool ─────────────────────────────────
    {
        name: 'obs_launch',
        description: 'Launch OBS Studio on the desktop. Only works when OBS is installed but not running. If OBS is already running, returns success.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    // ─── Streaming Preset Tools ────────────────────────────
    {
        name: 'obs_apply_preset',
        description: 'Apply a streaming preset that configures OBS video settings optimized for a specific platform. YouTube preset uses the 1440p VP9 hack for better quality. Will refuse if a stream or recording is active. Use obs_list_presets to see available options.',
        input_schema: {
            type: 'object',
            properties: {
                preset_name: {
                    type: 'string',
                    description: 'Preset name: youtube_vp9_1440p, twitch_1080p60, kick_1080p60, facebook_1080p30, or a custom preset name',
                },
                stream_key: {
                    type: 'string',
                    description: 'Stream key for the platform (optional — only set if you have the key)',
                },
            },
            required: ['preset_name'],
        },
    },
    {
        name: 'obs_list_presets',
        description: 'List all available OBS streaming presets (built-in and custom) with their platform, resolution, FPS, and description.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_get_current_preset',
        description: 'Detect which streaming preset best matches the current OBS video settings. Returns the matching preset name or "custom" if no match.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'obs_create_custom_preset',
        description: 'Save the current OBS video and stream settings as a named custom preset for future use.',
        input_schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Custom preset name (lowercase, no spaces, use underscores)',
                },
                platform: {
                    type: 'string',
                    description: 'Target platform name (e.g. youtube, twitch, custom)',
                },
                description: {
                    type: 'string',
                    description: 'Description of what this preset is for',
                },
            },
            required: ['name', 'platform'],
        },
    },
];
//# sourceMappingURL=obs-tools.js.map