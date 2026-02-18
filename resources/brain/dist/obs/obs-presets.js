"use strict";
/**
 * OBS Streaming Presets
 *
 * Platform-optimized encoding presets for OBS Studio.
 * Built-in presets for YouTube (VP9 1440p hack), Twitch, Kick, Facebook.
 * Custom presets persisted to disk.
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
exports.OBS_PRESET_TOOLS = exports.findMatchingPreset = exports.findPreset = exports.getAllPresets = exports.saveCustomPreset = exports.loadCustomPresets = exports.BUILT_IN_PRESETS = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('obs-presets');
// ============================================================================
// BUILT-IN PRESETS
// ============================================================================
exports.BUILT_IN_PRESETS = [
    {
        name: 'youtube_vp9_1440p',
        platform: 'youtube',
        description: 'YouTube VP9/AV1 hack — upscale output to 1440p to force VP9 codec instead of H.264. Results in significantly better quality at the same bitrate.',
        video: {
            baseWidth: 1920,
            baseHeight: 1080,
            outputWidth: 2560,
            outputHeight: 1440,
            fps: 60,
        },
        stream: {
            service: 'YouTube - RTMPS',
            server: 'rtmps://a.rtmp.youtube.com/live2',
        },
    },
    {
        name: 'twitch_1080p60',
        platform: 'twitch',
        description: 'Twitch optimized — 1080p60 at 8500kbps (Partner/Affiliate max).',
        video: {
            baseWidth: 1920,
            baseHeight: 1080,
            outputWidth: 1920,
            outputHeight: 1080,
            fps: 60,
        },
        stream: {
            service: 'Twitch',
            server: 'rtmp://live.twitch.tv/app',
        },
    },
    {
        name: 'kick_1080p60',
        platform: 'kick',
        description: 'Kick optimized — 1080p60 at 8000kbps.',
        video: {
            baseWidth: 1920,
            baseHeight: 1080,
            outputWidth: 1920,
            outputHeight: 1080,
            fps: 60,
        },
    },
    {
        name: 'facebook_1080p30',
        platform: 'facebook',
        description: 'Facebook Gaming optimized — 1080p30 at 4000kbps (Facebook max).',
        video: {
            baseWidth: 1920,
            baseHeight: 1080,
            outputWidth: 1920,
            outputHeight: 1080,
            fps: 30,
        },
        stream: {
            service: 'Facebook Live',
            server: 'rtmps://live-api-s.facebook.com:443/rtmp/',
        },
    },
];
// ============================================================================
// CUSTOM PRESET PERSISTENCE
// ============================================================================
function getPresetsFilePath() {
    const dataDir = process.env.CHROMADON_DATA_DIR || process.cwd();
    return path.join(dataDir, 'obs-presets.json');
}
function loadCustomPresets() {
    try {
        const filePath = getPresetsFilePath();
        if (!fs.existsSync(filePath))
            return [];
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Array.isArray(data) ? data.map((p) => ({ ...p, custom: true })) : [];
    }
    catch (err) {
        log.warn({ err }, 'Failed to load custom OBS presets');
        return [];
    }
}
exports.loadCustomPresets = loadCustomPresets;
function saveCustomPreset(preset) {
    const existing = loadCustomPresets();
    const idx = existing.findIndex((p) => p.name === preset.name);
    if (idx >= 0) {
        existing[idx] = { ...preset, custom: true };
    }
    else {
        existing.push({ ...preset, custom: true });
    }
    const filePath = getPresetsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
    log.info({ preset: preset.name }, 'Saved custom OBS preset');
}
exports.saveCustomPreset = saveCustomPreset;
/**
 * Get all presets (built-in + custom).
 */
function getAllPresets() {
    return [...exports.BUILT_IN_PRESETS, ...loadCustomPresets()];
}
exports.getAllPresets = getAllPresets;
/**
 * Find a preset by name (case-insensitive).
 */
function findPreset(name) {
    return getAllPresets().find((p) => p.name.toLowerCase() === name.toLowerCase());
}
exports.findPreset = findPreset;
/**
 * Match current OBS settings against known presets.
 */
function findMatchingPreset(settings) {
    for (const preset of getAllPresets()) {
        const v = preset.video;
        if (v.baseWidth === settings.baseWidth &&
            v.baseHeight === settings.baseHeight &&
            v.outputWidth === settings.outputWidth &&
            v.outputHeight === settings.outputHeight &&
            v.fps === settings.fps) {
            return preset;
        }
    }
    return null;
}
exports.findMatchingPreset = findMatchingPreset;
// ============================================================================
// TOOL DEFINITIONS (4 preset tools)
// ============================================================================
exports.OBS_PRESET_TOOLS = [
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
//# sourceMappingURL=obs-presets.js.map