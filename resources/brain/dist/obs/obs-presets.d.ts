/**
 * OBS Streaming Presets
 *
 * Platform-optimized encoding presets for OBS Studio.
 * Built-in presets for YouTube (VP9 1440p hack), Twitch, Kick, Facebook.
 * Custom presets persisted to disk.
 *
 * @author Barrios A2I
 */
import type { ToolDefinition } from '../core/browser-tools';
export interface StreamingPreset {
    name: string;
    platform: string;
    description: string;
    video: {
        baseWidth: number;
        baseHeight: number;
        outputWidth: number;
        outputHeight: number;
        fps: number;
    };
    stream?: {
        service: string;
        server: string;
    };
    custom?: boolean;
}
export declare const BUILT_IN_PRESETS: StreamingPreset[];
export declare function loadCustomPresets(): StreamingPreset[];
export declare function saveCustomPreset(preset: StreamingPreset): void;
/**
 * Get all presets (built-in + custom).
 */
export declare function getAllPresets(): StreamingPreset[];
/**
 * Find a preset by name (case-insensitive).
 */
export declare function findPreset(name: string): StreamingPreset | undefined;
/**
 * Match current OBS settings against known presets.
 */
export declare function findMatchingPreset(settings: {
    baseWidth: number;
    baseHeight: number;
    outputWidth: number;
    outputHeight: number;
    fps: number;
}): StreamingPreset | null;
export declare const OBS_PRESET_TOOLS: ToolDefinition[];
//# sourceMappingURL=obs-presets.d.ts.map