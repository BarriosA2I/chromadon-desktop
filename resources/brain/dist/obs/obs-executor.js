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
/**
 * Creates an executor function that routes OBS tool calls
 * to the OBSClient WebSocket connection.
 */
function createObsExecutor(obsClient) {
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