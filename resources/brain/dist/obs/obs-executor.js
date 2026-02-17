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
                        const response = await fetch(`${desktopUrl}/obs/launch`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: AbortSignal.timeout(10000),
                        });
                        const data = await response.json();
                        return data.success
                            ? data.message
                            : `Error: ${data.message}`;
                    }
                    catch (err) {
                        const msg = err instanceof Error ? err.message : String(err);
                        log.error({ err: msg }, 'Failed to launch OBS via Desktop');
                        return `Error: Failed to reach Desktop to launch OBS: ${msg}`;
                    }
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