"use strict";
/**
 * OBS WebSocket Client (adapted for CHROMADON Brain)
 *
 * Manages connection lifecycle with exponential backoff retry.
 * Exposes typed methods for all OBS operations.
 * Thread-safe: serializes commands to prevent race conditions.
 *
 * Ported from chromadon-mcp obs-client.
 * Changes: stderr logging → console.log, matches brain logging pattern.
 *
 * @author Barrios A2I
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OBSClient = void 0;
const obs_websocket_js_1 = __importDefault(require("obs-websocket-js"));
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('obs');
// ─── Config (from env vars) ─────────────────────────────────
const OBS_HOST = process.env.OBS_WS_HOST || '127.0.0.1';
const OBS_PORT = parseInt(process.env.OBS_WS_PORT || '4455', 10);
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD || '';
const OBS_WS_URL = `ws://${OBS_HOST}:${OBS_PORT}`;
const SAFE_MODE = (process.env.OBS_SAFE_MODE || 'true').toLowerCase() === 'true';
const SAFE_SCENES = (process.env.OBS_SAFE_SCENES || 'StartingSoon,Main')
    .split(',')
    .map((s) => s.trim());
// ─── OBS Client ─────────────────────────────────────────────
class OBSClient {
    obs;
    connected = false;
    connecting = false;
    retryCount = 0;
    maxRetries = 10;
    baseDelay = 1000;
    maxDelay = 30000;
    commandQueue = Promise.resolve();
    constructor() {
        this.obs = new obs_websocket_js_1.default();
        this.obs.on('ConnectionClosed', () => {
            this.connected = false;
            log.info('OBS WebSocket connection closed');
            this.scheduleReconnect();
        });
        this.obs.on('ConnectionError', (err) => {
            this.connected = false;
            log.error({ err: err.message || String(err) }, 'OBS WebSocket connection error');
        });
    }
    async connect() {
        if (this.connected || this.connecting)
            return;
        this.connecting = true;
        while (this.retryCount <= this.maxRetries) {
            try {
                log.info(`Connecting to OBS WebSocket at ${OBS_HOST}:${OBS_PORT}` +
                    (this.retryCount > 0 ? ` (attempt ${this.retryCount + 1})` : ''));
                const { obsWebSocketVersion, negotiatedRpcVersion } = await this.obs.connect(OBS_WS_URL, OBS_PASSWORD, {
                    rpcVersion: 1,
                });
                this.connected = true;
                this.connecting = false;
                this.retryCount = 0;
                log.info(`Connected to OBS WebSocket (v${obsWebSocketVersion}, rpc=${negotiatedRpcVersion})`);
                return;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.retryCount++;
                if (message.includes('ECONNREFUSED')) {
                    log.info('OBS is not running or WebSocket server is not enabled. ' +
                        'Open OBS → Tools → WebSocket Server Settings → Enable WebSocket server');
                }
                else if (message.includes('Authentication') ||
                    message.includes('auth')) {
                    log.info('OBS WebSocket authentication failed. Check OBS_WS_PASSWORD matches ' +
                        'OBS → Tools → WebSocket Server Settings → Server Password');
                    this.connecting = false;
                    throw new Error('AUTH_FAILED: OBS WebSocket password is incorrect');
                }
                else {
                    log.info(`Connection failed: ${message}`);
                }
                if (this.retryCount > this.maxRetries) {
                    this.connecting = false;
                    throw new Error(`Failed to connect after ${this.maxRetries} attempts. Last error: ${message}`);
                }
                const delay = Math.min(this.baseDelay * Math.pow(2, this.retryCount - 1), this.maxDelay);
                const jitter = delay * (0.7 + Math.random() * 0.6);
                log.info(`Retrying in ${Math.round(jitter / 1000)}s...`);
                await this.sleep(jitter);
            }
        }
    }
    scheduleReconnect() {
        if (!this.connecting) {
            setTimeout(() => this.connect().catch(() => { }), 3000);
        }
    }
    async serialize(fn) {
        const prev = this.commandQueue;
        let resolve;
        this.commandQueue = new Promise((r) => (resolve = r));
        await prev;
        try {
            return await fn();
        }
        finally {
            resolve(undefined);
        }
    }
    ensureConnected() {
        if (!this.connected) {
            throw new Error('NOT_CONNECTED: OBS WebSocket is not connected. Is OBS running with WebSocket enabled?');
        }
    }
    // ─── Stream Control ───────────────────────────────────────
    async startStream() {
        return this.serialize(async () => {
            this.ensureConnected();
            if (SAFE_MODE) {
                const scene = await this.getCurrentScene();
                if (!SAFE_SCENES.includes(scene)) {
                    return {
                        success: false,
                        message: `SAFE_MODE: Refusing to start stream. Current scene "${scene}" is not in safe list [${SAFE_SCENES.join(', ')}]. Switch to an approved scene first.`,
                    };
                }
            }
            const status = await this.obs.call('GetStreamStatus');
            if (status.outputActive) {
                return { success: true, message: 'Stream already active' };
            }
            // Pre-check: verify a stream key is configured
            try {
                const svc = await this.obs.call('GetStreamServiceSettings');
                const settings = svc.streamServiceSettings;
                if (!settings?.key) {
                    return {
                        success: false,
                        message: 'No stream key configured. Set your stream key in OBS Settings > Stream (or use obs_configure_stream) before starting.',
                    };
                }
            }
            catch {
                // GetStreamServiceSettings may fail on some OBS versions — continue anyway
            }
            try {
                await this.obs.call('StartStream');
            }
            catch (err) {
                return {
                    success: false,
                    message: `Failed to start stream: ${err.message || err}. Check OBS stream settings (stream key, server URL, encoder).`,
                };
            }
            // Wait for OBS to initialize encoder and connect
            await new Promise(r => setTimeout(r, 2500));
            // Verify stream actually started
            const postCheck = await this.obs.call('GetStreamStatus');
            if (!postCheck.outputActive) {
                log.warn('Stream start command sent but stream is not active after 2.5s');
                return {
                    success: false,
                    message: 'OBS stream start failed. The start command was sent but OBS failed to begin streaming. Common causes: invalid stream key, encoder error (NVENC/AMD not available), or streaming server unreachable.',
                };
            }
            log.info('Stream started and verified active');
            return { success: true, message: 'Stream started and verified active' };
        });
    }
    async stopStream() {
        return this.serialize(async () => {
            this.ensureConnected();
            const status = await this.obs.call('GetStreamStatus');
            if (!status.outputActive) {
                return { success: true, message: 'Stream already stopped' };
            }
            await this.obs.call('StopStream');
            log.info('Stream stopped');
            return { success: true, message: 'Stream stopped' };
        });
    }
    // ─── Recording Control ────────────────────────────────────
    async startRecording() {
        return this.serialize(async () => {
            this.ensureConnected();
            const status = await this.obs.call('GetRecordStatus');
            if (status.outputActive) {
                return { success: true, message: 'Recording already active' };
            }
            try {
                await this.obs.call('StartRecord');
            }
            catch (err) {
                return {
                    success: false,
                    message: `Failed to start recording: ${err.message || err}. Check OBS recording settings (output path, encoder).`,
                };
            }
            // Wait for OBS to initialize recording encoder
            await new Promise(r => setTimeout(r, 2500));
            // Verify recording actually started
            const postCheck = await this.obs.call('GetRecordStatus');
            if (!postCheck.outputActive) {
                log.warn('Record start command sent but recording is not active after 2.5s');
                return {
                    success: false,
                    message: 'OBS recording start failed. The start command was sent but OBS failed to begin recording. Common causes: invalid output path, disk full, or encoder error.',
                };
            }
            log.info('Recording started and verified active');
            return { success: true, message: 'Recording started and verified active' };
        });
    }
    async stopRecording() {
        return this.serialize(async () => {
            this.ensureConnected();
            const status = await this.obs.call('GetRecordStatus');
            if (!status.outputActive) {
                return { success: true, message: 'Recording already stopped' };
            }
            const result = await this.obs.call('StopRecord');
            log.info(`Recording stopped, output: ${result.outputPath}`);
            return {
                success: true,
                message: 'Recording stopped',
                outputPath: result.outputPath,
            };
        });
    }
    // ─── Scene Control ────────────────────────────────────────
    async getCurrentScene() {
        this.ensureConnected();
        const result = await this.obs.call('GetCurrentProgramScene');
        return result.currentProgramSceneName;
    }
    async getSceneList() {
        this.ensureConnected();
        const result = await this.obs.call('GetSceneList');
        return result.scenes.map((s) => s.sceneName);
    }
    async setScene(sceneName) {
        return this.serialize(async () => {
            this.ensureConnected();
            const scenes = await this.getSceneList();
            if (!scenes.includes(sceneName)) {
                return {
                    success: false,
                    message: `SCENE_NOT_FOUND: Scene "${sceneName}" does not exist. Available: [${scenes.join(', ')}]`,
                };
            }
            await this.obs.call('SetCurrentProgramScene', { sceneName });
            log.info(`Scene switched to: ${sceneName}`);
            return { success: true, message: `Switched to scene: ${sceneName}` };
        });
    }
    // ─── Audio Control ────────────────────────────────────────
    async setMicMute(mute, inputName) {
        return this.serialize(async () => {
            this.ensureConnected();
            const micNames = inputName
                ? [inputName]
                : [
                    'Mic/Aux',
                    'Blue Yeti',
                    'Microphone',
                    'Mic',
                    'Audio Input Capture',
                    'Desktop Audio',
                ];
            for (const name of micNames) {
                try {
                    await this.obs.call('SetInputMute', {
                        inputName: name,
                        inputMuted: mute,
                    });
                    log.info(`${name} ${mute ? 'muted' : 'unmuted'}`);
                    return {
                        success: true,
                        message: `${name} ${mute ? 'muted' : 'unmuted'}`,
                    };
                }
                catch {
                    continue;
                }
            }
            const inputs = await this.obs.call('GetInputList');
            const names = inputs.inputs.map((i) => i.inputName);
            return {
                success: false,
                message: `MIC_NOT_FOUND: Could not find mic input. Tried: [${micNames.join(', ')}]. Available inputs: [${names.join(', ')}]`,
            };
        });
    }
    // ─── Source Visibility ────────────────────────────────────
    async setSourceVisibility(sceneName, sourceName, visible) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                const { sceneItemId } = await this.obs.call('GetSceneItemId', {
                    sceneName,
                    sourceName,
                });
                await this.obs.call('SetSceneItemEnabled', {
                    sceneName,
                    sceneItemId,
                    sceneItemEnabled: visible,
                });
                log.info(`Source "${sourceName}" in "${sceneName}" set to ${visible ? 'visible' : 'hidden'}`);
                return {
                    success: true,
                    message: `${sourceName} in ${sceneName} set to ${visible ? 'visible' : 'hidden'}`,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('NotFound') || message.includes('600')) {
                    return {
                        success: false,
                        message: `SOURCE_NOT_FOUND: "${sourceName}" not found in scene "${sceneName}". Check exact source and scene names in OBS.`,
                    };
                }
                throw err;
            }
        });
    }
    // ─── Full Status ──────────────────────────────────────────
    async getStatus() {
        if (!this.connected) {
            return {
                connected: false,
                streaming: false,
                recording: false,
                currentScene: 'N/A',
                availableScenes: [],
                streamTimecode: null,
                recordTimecode: null,
                cpuUsage: null,
                memoryUsage: null,
                fps: null,
            };
        }
        try {
            const [streamStatus, recordStatus, sceneInfo, sceneList, stats] = await Promise.all([
                this.obs.call('GetStreamStatus'),
                this.obs.call('GetRecordStatus'),
                this.obs.call('GetCurrentProgramScene'),
                this.obs.call('GetSceneList'),
                this.obs.call('GetStats').catch(() => null),
            ]);
            return {
                connected: true,
                streaming: streamStatus.outputActive,
                recording: recordStatus.outputActive,
                currentScene: sceneInfo.currentProgramSceneName,
                availableScenes: sceneList.scenes.map((s) => s.sceneName),
                streamTimecode: streamStatus.outputTimecode || null,
                recordTimecode: recordStatus.outputTimecode || null,
                cpuUsage: stats ? stats.cpuUsage : null,
                memoryUsage: stats ? stats.memoryUsage : null,
                fps: stats ? stats.activeFps : null,
            };
        }
        catch (err) {
            log.info(`Failed to get OBS status: ${err instanceof Error ? err.message : String(err)}`);
            return {
                connected: false,
                streaming: false,
                recording: false,
                currentScene: 'ERROR',
                availableScenes: [],
                streamTimecode: null,
                recordTimecode: null,
                cpuUsage: null,
                memoryUsage: null,
                fps: null,
            };
        }
    }
    // ─── Stream Configuration ────────────────────────────────
    /**
     * Services that require OBS built-in rtmp_common (handles RTMPS internally).
     * rtmp_custom does NOT support rtmps:// reliably — use rtmp_common for TLS platforms.
     */
    static RTMP_COMMON_SERVICES = {
        'facebook live': 'Facebook Live',
    };
    async configureStream(service, server, key) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                const commonService = OBSClient.RTMP_COMMON_SERVICES[service.toLowerCase()];
                if (commonService) {
                    // Use OBS built-in service for platforms that need RTMPS
                    // rtmp_common handles TLS internally — rtmp_custom does NOT support rtmps://
                    await this.obs.call('SetStreamServiceSettings', {
                        streamServiceType: 'rtmp_common',
                        streamServiceSettings: {
                            service: commonService,
                            server,
                            key,
                        },
                    });
                    log.info({ service: commonService }, 'Stream configured via rtmp_common (RTMPS)');
                    return {
                        success: true,
                        message: `Stream configured: ${commonService} (RTMPS enabled)`,
                    };
                }
                // For all other services, use rtmp_custom with the provided server URL
                await this.obs.call('SetStreamServiceSettings', {
                    streamServiceType: 'rtmp_custom',
                    streamServiceSettings: {
                        server,
                        key,
                    },
                });
                log.info({ service, server: server.replace(/\/\/.+@/, '//***@') }, 'Stream service configured');
                return {
                    success: true,
                    message: `Stream configured: ${service} → ${server}`,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { success: false, message: `Failed to configure stream: ${message}` };
            }
        });
    }
    // ─── Video Configuration ───────────────────────────────────
    async configureVideo(baseWidth, baseHeight, outputWidth, outputHeight, fps) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                await this.obs.call('SetVideoSettings', {
                    fpsNumerator: fps,
                    fpsDenominator: 1,
                    baseWidth,
                    baseHeight,
                    outputWidth,
                    outputHeight,
                });
                log.info({ baseWidth, baseHeight, outputWidth, outputHeight, fps }, 'Video settings configured');
                return {
                    success: true,
                    message: `Video configured: ${baseWidth}x${baseHeight} canvas, ${outputWidth}x${outputHeight} output, ${fps} FPS`,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { success: false, message: `Failed to configure video: ${message}` };
            }
        });
    }
    // ─── Recording Configuration ───────────────────────────────
    async configureRecording(path, format) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                // Set recording output path via profile parameters
                const settings = { RecFilePath: path };
                if (format) {
                    settings.RecFormat2 = format;
                }
                await this.obs.call('SetProfileParameter', {
                    parameterCategory: 'SimpleOutput',
                    parameterName: 'FilePath',
                    parameterValue: path,
                });
                if (format) {
                    await this.obs.call('SetProfileParameter', {
                        parameterCategory: 'SimpleOutput',
                        parameterName: 'RecFormat2',
                        parameterValue: format,
                    });
                }
                log.info({ path, format }, 'Recording settings configured');
                return {
                    success: true,
                    message: `Recording configured: path=${path}${format ? `, format=${format}` : ''}`,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { success: false, message: `Failed to configure recording: ${message}` };
            }
        });
    }
    // ─── Scene Management ──────────────────────────────────────
    async createScene(sceneName) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                await this.obs.call('CreateScene', { sceneName });
                log.info({ sceneName }, 'Scene created');
                return { success: true, message: `Scene "${sceneName}" created` };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('already exists') || message.includes('601')) {
                    return { success: false, message: `Scene "${sceneName}" already exists` };
                }
                return { success: false, message: `Failed to create scene: ${message}` };
            }
        });
    }
    async removeScene(sceneName) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                await this.obs.call('RemoveScene', { sceneName });
                log.info({ sceneName }, 'Scene removed');
                return { success: true, message: `Scene "${sceneName}" removed` };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('NotFound') || message.includes('600')) {
                    return { success: false, message: `Scene "${sceneName}" not found` };
                }
                return { success: false, message: `Failed to remove scene: ${message}` };
            }
        });
    }
    // ─── Source Management ─────────────────────────────────────
    async addSource(sceneName, sourceName, sourceKind, settings) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                const result = await this.obs.call('CreateInput', {
                    sceneName,
                    inputName: sourceName,
                    inputKind: sourceKind,
                    inputSettings: (settings || {}),
                    sceneItemEnabled: true,
                });
                log.info({ sceneName, sourceName, sourceKind }, 'Source added to scene');
                return {
                    success: true,
                    message: `Source "${sourceName}" (${sourceKind}) added to scene "${sceneName}"`,
                    sceneItemId: result.sceneItemId,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { success: false, message: `Failed to add source: ${message}` };
            }
        });
    }
    async removeSource(sceneName, sourceName) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                const { sceneItemId } = await this.obs.call('GetSceneItemId', {
                    sceneName,
                    sourceName,
                });
                await this.obs.call('RemoveSceneItem', {
                    sceneName,
                    sceneItemId,
                });
                log.info({ sceneName, sourceName }, 'Source removed from scene');
                return {
                    success: true,
                    message: `Source "${sourceName}" removed from scene "${sceneName}"`,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                if (message.includes('NotFound') || message.includes('600')) {
                    return {
                        success: false,
                        message: `Source "${sourceName}" not found in scene "${sceneName}"`,
                    };
                }
                return { success: false, message: `Failed to remove source: ${message}` };
            }
        });
    }
    async getSources(sceneName) {
        return this.serialize(async () => {
            this.ensureConnected();
            try {
                const result = await this.obs.call('GetSceneItemList', { sceneName });
                const items = result.sceneItems;
                const sources = [];
                for (const item of items) {
                    let settings = {};
                    try {
                        const inputResult = await this.obs.call('GetInputSettings', {
                            inputName: item.sourceName,
                        });
                        settings = inputResult.inputSettings;
                    }
                    catch {
                        // Some items (like scenes nested as sources) may not have input settings
                    }
                    sources.push({
                        id: item.sceneItemId,
                        name: item.sourceName,
                        kind: item.inputKind,
                        enabled: item.sceneItemEnabled,
                        settings,
                    });
                }
                return {
                    success: true,
                    message: `Found ${sources.length} source(s) in scene "${sceneName}"`,
                    sources,
                };
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { success: false, message: `Failed to get sources: ${message}` };
            }
        });
    }
    // ─── Settings Info ─────────────────────────────────────────
    async getSettings() {
        if (!this.connected) {
            return {
                success: false,
                message: 'NOT_CONNECTED: OBS WebSocket is not connected. Is OBS running with WebSocket enabled?',
            };
        }
        try {
            const [streamService, videoSettings] = await Promise.all([
                this.obs.call('GetStreamServiceSettings').catch(() => null),
                this.obs.call('GetVideoSettings').catch(() => null),
            ]);
            // Get recording path from profile
            let recordingPath = null;
            try {
                const recPath = await this.obs.call('GetProfileParameter', {
                    parameterCategory: 'SimpleOutput',
                    parameterName: 'FilePath',
                });
                recordingPath = recPath.parameterValue;
            }
            catch {
                // Profile parameter may not exist
            }
            const settings = {};
            if (streamService) {
                settings.stream = {
                    serviceType: streamService.streamServiceType,
                    serviceSettings: streamService.streamServiceSettings,
                };
            }
            if (videoSettings) {
                const vs = videoSettings;
                settings.video = {
                    baseWidth: vs.baseWidth,
                    baseHeight: vs.baseHeight,
                    outputWidth: vs.outputWidth,
                    outputHeight: vs.outputHeight,
                    fps: vs.fpsNumerator,
                };
            }
            if (recordingPath) {
                settings.recording = { path: recordingPath };
            }
            return {
                success: true,
                message: 'OBS settings retrieved',
                settings,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { success: false, message: `Failed to get settings: ${message}` };
        }
    }
    // ─── Connection State ─────────────────────────────────────
    isConnected() {
        return this.connected;
    }
    /**
     * Trigger immediate reconnection (e.g. after obs_launch).
     * Resets retry state and tries up to 3 times.
     */
    async reconnectNow() {
        this.connected = false;
        this.connecting = false;
        this.retryCount = 0;
        const savedMax = this.maxRetries;
        this.maxRetries = 3;
        try {
            await this.connect();
        }
        finally {
            this.maxRetries = savedMax;
        }
    }
    async disconnect() {
        if (this.connected) {
            await this.obs.disconnect();
            this.connected = false;
            log.info('Disconnected from OBS WebSocket');
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.OBSClient = OBSClient;
//# sourceMappingURL=obs-client.js.map