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
// ─── Config (from env vars) ─────────────────────────────────
const OBS_HOST = process.env.OBS_WS_HOST || '127.0.0.1';
const OBS_PORT = parseInt(process.env.OBS_WS_PORT || '4455', 10);
const OBS_PASSWORD = process.env.OBS_WS_PASSWORD || '';
const OBS_WS_URL = `ws://${OBS_HOST}:${OBS_PORT}`;
const SAFE_MODE = (process.env.OBS_SAFE_MODE || 'true').toLowerCase() === 'true';
const SAFE_SCENES = (process.env.OBS_SAFE_SCENES || 'StartingSoon,Main')
    .split(',')
    .map((s) => s.trim());
// ─── Logger ─────────────────────────────────────────────────
function log(msg) {
    console.log(`[CHROMADON:OBS] ${msg}`);
}
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
            log('OBS WebSocket connection closed');
            this.scheduleReconnect();
        });
        this.obs.on('ConnectionError', (err) => {
            this.connected = false;
            log(`OBS WebSocket connection error: ${err.message || String(err)}`);
        });
    }
    async connect() {
        if (this.connected || this.connecting)
            return;
        this.connecting = true;
        while (this.retryCount <= this.maxRetries) {
            try {
                log(`Connecting to OBS WebSocket at ${OBS_HOST}:${OBS_PORT}` +
                    (this.retryCount > 0 ? ` (attempt ${this.retryCount + 1})` : ''));
                const { obsWebSocketVersion, negotiatedRpcVersion } = await this.obs.connect(OBS_WS_URL, OBS_PASSWORD, {
                    rpcVersion: 1,
                });
                this.connected = true;
                this.connecting = false;
                this.retryCount = 0;
                log(`Connected to OBS WebSocket (v${obsWebSocketVersion}, rpc=${negotiatedRpcVersion})`);
                return;
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.retryCount++;
                if (message.includes('ECONNREFUSED')) {
                    log('OBS is not running or WebSocket server is not enabled. ' +
                        'Open OBS → Tools → WebSocket Server Settings → Enable WebSocket server');
                }
                else if (message.includes('Authentication') ||
                    message.includes('auth')) {
                    log('OBS WebSocket authentication failed. Check OBS_WS_PASSWORD matches ' +
                        'OBS → Tools → WebSocket Server Settings → Server Password');
                    this.connecting = false;
                    throw new Error('AUTH_FAILED: OBS WebSocket password is incorrect');
                }
                else {
                    log(`Connection failed: ${message}`);
                }
                if (this.retryCount > this.maxRetries) {
                    this.connecting = false;
                    throw new Error(`Failed to connect after ${this.maxRetries} attempts. Last error: ${message}`);
                }
                const delay = Math.min(this.baseDelay * Math.pow(2, this.retryCount - 1), this.maxDelay);
                const jitter = delay * (0.7 + Math.random() * 0.6);
                log(`Retrying in ${Math.round(jitter / 1000)}s...`);
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
            await this.obs.call('StartStream');
            log('Stream started');
            return { success: true, message: 'Stream started' };
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
            log('Stream stopped');
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
            await this.obs.call('StartRecord');
            log('Recording started');
            return { success: true, message: 'Recording started' };
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
            log(`Recording stopped, output: ${result.outputPath}`);
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
            log(`Scene switched to: ${sceneName}`);
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
                    log(`${name} ${mute ? 'muted' : 'unmuted'}`);
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
                log(`Source "${sourceName}" in "${sceneName}" set to ${visible ? 'visible' : 'hidden'}`);
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
            log(`Failed to get OBS status: ${err instanceof Error ? err.message : String(err)}`);
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
    // ─── Connection State ─────────────────────────────────────
    isConnected() {
        return this.connected;
    }
    async disconnect() {
        if (this.connected) {
            await this.obs.disconnect();
            this.connected = false;
            log('Disconnected from OBS WebSocket');
        }
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.OBSClient = OBSClient;
//# sourceMappingURL=obs-client.js.map