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
];
//# sourceMappingURL=obs-tools.js.map