"use strict";
/**
 * OBS Studio - Tool Executor
 *
 * Routes OBS tool calls to the OBSClient, returning
 * formatted text/JSON for the AI's consumption.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createObsExecutor = void 0;
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('obs-executor');
/**
 * Creates an executor function that routes OBS tool calls
 * to the OBSClient WebSocket connection.
 *
 * @param obsClient - WebSocket client for OBS
 * @param desktopUrl - Desktop control server URL (for obs_launch)
 */
function createObsExecutor(obsClient, desktopUrl) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'obs_stream_start': {
                    const result = await obsClient.startStream();
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_stream_stop': {
                    const result = await obsClient.stopStream();
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_record_start': {
                    const result = await obsClient.startRecording();
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_record_stop': {
                    const result = await obsClient.stopRecording();
                    if (!result.success)
                        return `Error: ${result.message}`;
                    return result.outputPath
                        ? `${result.message}. File saved to: ${result.outputPath}`
                        : result.message;
                }
                case 'obs_scene_set': {
                    const { sceneName } = input;
                    if (!sceneName)
                        return 'Error: sceneName is required.';
                    const result = await obsClient.setScene(sceneName);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_scene_list': {
                    const [current, scenes] = await Promise.all([
                        obsClient.getCurrentScene(),
                        obsClient.getSceneList(),
                    ]);
                    return JSON.stringify({ currentScene: current, scenes }, null, 2);
                }
                case 'obs_status': {
                    const status = await obsClient.getStatus();
                    return JSON.stringify(status, null, 2);
                }
                case 'obs_mic_mute': {
                    const { mute, inputName } = input;
                    if (typeof mute !== 'boolean')
                        return 'Error: mute (boolean) is required.';
                    const result = await obsClient.setMicMute(mute, inputName);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_source_visibility': {
                    const { sceneName, sourceName, visible } = input;
                    if (!sceneName || !sourceName || typeof visible !== 'boolean') {
                        return 'Error: sceneName, sourceName, and visible (boolean) are required.';
                    }
                    const result = await obsClient.setSourceVisibility(sceneName, sourceName, visible);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                // ─── Configuration Tools ─────────────────────────────
                case 'obs_configure_stream': {
                    const { service, server, key } = input;
                    if (!service || !server || !key) {
                        return 'Error: service, server, and key are all required.';
                    }
                    const result = await obsClient.configureStream(service, server, key);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_configure_video': {
                    const { baseWidth, baseHeight, outputWidth, outputHeight, fps } = input;
                    if (!baseWidth || !baseHeight || !outputWidth || !outputHeight || !fps) {
                        return 'Error: baseWidth, baseHeight, outputWidth, outputHeight, and fps are all required.';
                    }
                    const result = await obsClient.configureVideo(baseWidth, baseHeight, outputWidth, outputHeight, fps);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_configure_recording': {
                    const { path, format } = input;
                    if (!path)
                        return 'Error: path is required.';
                    const result = await obsClient.configureRecording(path, format);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                // ─── Scene Management Tools ──────────────────────────
                case 'obs_create_scene': {
                    const { sceneName } = input;
                    if (!sceneName)
                        return 'Error: sceneName is required.';
                    const result = await obsClient.createScene(sceneName);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_remove_scene': {
                    const { sceneName } = input;
                    if (!sceneName)
                        return 'Error: sceneName is required.';
                    const result = await obsClient.removeScene(sceneName);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                // ─── Source Management Tools ─────────────────────────
                case 'obs_add_source': {
                    const { sceneName, sourceName, sourceKind, settings } = input;
                    if (!sceneName || !sourceName || !sourceKind) {
                        return 'Error: sceneName, sourceName, and sourceKind are required.';
                    }
                    const result = await obsClient.addSource(sceneName, sourceName, sourceKind, settings);
                    return result.success
                        ? `${result.message} (sceneItemId: ${result.sceneItemId})`
                        : `Error: ${result.message}`;
                }
                case 'obs_remove_source': {
                    const { sceneName, sourceName } = input;
                    if (!sceneName || !sourceName) {
                        return 'Error: sceneName and sourceName are required.';
                    }
                    const result = await obsClient.removeSource(sceneName, sourceName);
                    return result.success
                        ? result.message
                        : `Error: ${result.message}`;
                }
                case 'obs_get_sources': {
                    const { sceneName } = input;
                    if (!sceneName)
                        return 'Error: sceneName is required.';
                    const result = await obsClient.getSources(sceneName);
                    if (!result.success)
                        return `Error: ${result.message}`;
                    return JSON.stringify({ scene: sceneName, sources: result.sources }, null, 2);
                }
                // ─── Info Tool ──────────────────────────────────────
                case 'obs_get_settings': {
                    const result = await obsClient.getSettings();
                    if (!result.success)
                        return `Error: ${result.message}`;
                    return JSON.stringify(result.settings, null, 2);
                }
                // ─── Desktop Launch Tool ────────────────────────────
                case 'obs_launch': {
                    if (!desktopUrl) {
                        return 'Error: Desktop URL not configured. Cannot launch OBS.';
                    }
                    try {
                        // Desktop verifies OBS stays alive for 5s before returning
                        const response = await fetch(`${desktopUrl}/obs/launch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: AbortSignal.timeout(30000), // 30s — Desktop waits 5s internally
                        });
                        const data = await response.json();
                        if (!data.success) {
                            return `Error: ${data.message}`;
                        }
                        // Wait for OBS WebSocket server to initialize, then connect
                        log.info('OBS launched, waiting 5s for WebSocket server...');
                        await new Promise(r => setTimeout(r, 5000));
                        try {
                            await obsClient.reconnectNow();
                            return data.message + ' WebSocket connected.';
                        }
                        catch {
                            return data.message + ' WebSocket not yet connected — OBS may still be loading. Try again in a few seconds.';
                        }
                    }
                    catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        log.error({ err: msg }, 'Failed to launch OBS via Desktop');
                        return `Error: Failed to reach Desktop to launch OBS: ${msg}`;
                    }
                }
                // ─── Streaming Preset Tools ──────────────────────
                case 'obs_apply_preset': {
                    const { preset_name, stream_key } = input;
                    if (!preset_name)
                        return 'Error: preset_name is required.';
                    const { findPreset } = require('./obs-presets');
                    const preset = findPreset(preset_name);
                    if (!preset) {
                        const { getAllPresets } = require('./obs-presets');
                        const names = getAllPresets().map((p) => p.name).join(', ');
                        return `Error: Unknown preset "${preset_name}". Available: ${names}`;
                    }
                    // Safety: refuse if stream or recording is active
                    const status = await obsClient.getStatus();
                    if (status.streaming) {
                        return 'Error: Cannot change video settings while streaming. Stop the stream first.';
                    }
                    if (status.recording) {
                        return 'Error: Cannot change video settings while recording. Stop the recording first.';
                    }
                    // Apply video settings
                    const v = preset.video;
                    const videoResult = await obsClient.configureVideo(v.baseWidth, v.baseHeight, v.outputWidth, v.outputHeight, v.fps);
                    if (!videoResult.success)
                        return `Error applying video settings: ${videoResult.message}`;
                    const lines = [
                        `Applied preset: ${preset.name} (${preset.platform})`,
                        `Video: ${v.baseWidth}x${v.baseHeight} → ${v.outputWidth}x${v.outputHeight} @ ${v.fps}fps`,
                    ];
                    // Apply stream settings if preset has them and key provided
                    if (preset.stream && stream_key) {
                        const streamResult = await obsClient.configureStream(preset.stream.service, preset.stream.server, stream_key);
                        if (streamResult.success) {
                            lines.push(`Stream: ${preset.stream.service} configured with key.`);
                        }
                        else {
                            lines.push(`Warning: Video set but stream config failed: ${streamResult.message}`);
                        }
                    }
                    else if (preset.stream && !stream_key) {
                        lines.push(`Stream service: ${preset.stream.service} (no stream key provided — set it with obs_configure_stream)`);
                    }
                    lines.push('');
                    lines.push(preset.description);
                    return lines.join('\n');
                }
                case 'obs_list_presets': {
                    const { getAllPresets } = require('./obs-presets');
                    const presets = getAllPresets();
                    const lines = ['OBS STREAMING PRESETS', ''];
                    for (const p of presets) {
                        const v = p.video;
                        lines.push(`${p.custom ? '[Custom] ' : ''}${p.name} (${p.platform})`);
                        lines.push(`  ${v.baseWidth}x${v.baseHeight} → ${v.outputWidth}x${v.outputHeight} @ ${v.fps}fps`);
                        if (p.stream)
                            lines.push(`  Service: ${p.stream.service}`);
                        lines.push(`  ${p.description}`);
                        lines.push('');
                    }
                    return lines.join('\n');
                }
                case 'obs_get_current_preset': {
                    const settings = await obsClient.getSettings();
                    if (!settings.success || !settings.settings) {
                        return 'Error: Could not read current OBS settings.';
                    }
                    const s = settings.settings;
                    const { findMatchingPreset } = require('./obs-presets');
                    const match = findMatchingPreset({
                        baseWidth: s.video?.baseWidth || 0,
                        baseHeight: s.video?.baseHeight || 0,
                        outputWidth: s.video?.outputWidth || 0,
                        outputHeight: s.video?.outputHeight || 0,
                        fps: s.video?.fps || 0,
                    });
                    if (match) {
                        return `Current preset: ${match.name} (${match.platform})\n${match.description}`;
                    }
                    return [
                        'Current preset: custom (no matching preset)',
                        `Video: ${s.video?.baseWidth}x${s.video?.baseHeight} → ${s.video?.outputWidth}x${s.video?.outputHeight} @ ${s.video?.fps}fps`,
                    ].join('\n');
                }
                case 'obs_create_custom_preset': {
                    const { name: presetName, platform, description: desc } = input;
                    if (!presetName || !platform)
                        return 'Error: name and platform are required.';
                    const settings = await obsClient.getSettings();
                    if (!settings.success || !settings.settings) {
                        return 'Error: Could not read current OBS settings to save preset.';
                    }
                    const s = settings.settings;
                    const { saveCustomPreset } = require('./obs-presets');
                    saveCustomPreset({
                        name: presetName,
                        platform,
                        description: desc || `Custom ${platform} preset`,
                        video: {
                            baseWidth: s.video?.baseWidth || 1920,
                            baseHeight: s.video?.baseHeight || 1080,
                            outputWidth: s.video?.outputWidth || 1920,
                            outputHeight: s.video?.outputHeight || 1080,
                            fps: s.video?.fps || 30,
                        },
                        stream: s.stream?.service ? {
                            service: s.stream.service,
                            server: s.stream.server || '',
                        } : undefined,
                    });
                    return `Custom preset "${presetName}" saved for ${platform}. Use obs_apply_preset to apply it later.`;
                }
                default:
                    return `Unknown OBS tool: ${toolName}`;
            }
        }
        catch (error) {
            return `OBS tool error: ${error.message}`;
        }
    };
}
exports.createObsExecutor = createObsExecutor;
//# sourceMappingURL=obs-executor.js.map