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
export interface OBSStatus {
    connected: boolean;
    streaming: boolean;
    recording: boolean;
    currentScene: string;
    availableScenes: string[];
    streamTimecode: string | null;
    recordTimecode: string | null;
    cpuUsage: number | null;
    memoryUsage: number | null;
    fps: number | null;
}
export declare class OBSClient {
    private obs;
    private connected;
    private connecting;
    private retryCount;
    private maxRetries;
    private baseDelay;
    private maxDelay;
    private commandQueue;
    constructor();
    connect(): Promise<void>;
    private scheduleReconnect;
    private serialize;
    private ensureConnected;
    startStream(): Promise<{
        success: boolean;
        message: string;
    }>;
    stopStream(): Promise<{
        success: boolean;
        message: string;
    }>;
    startRecording(): Promise<{
        success: boolean;
        message: string;
    }>;
    stopRecording(): Promise<{
        success: boolean;
        message: string;
        outputPath?: string;
    }>;
    getCurrentScene(): Promise<string>;
    getSceneList(): Promise<string[]>;
    setScene(sceneName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    setMicMute(mute: boolean, inputName?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    setSourceVisibility(sceneName: string, sourceName: string, visible: boolean): Promise<{
        success: boolean;
        message: string;
    }>;
    getStatus(): Promise<OBSStatus>;
    /**
     * Known OBS built-in service names that require rtmp_common.
     * Using rtmp_common lets OBS handle RTMPS and correct server URLs automatically.
     */
    private static readonly KNOWN_OBS_SERVICES;
    configureStream(service: string, server: string, key: string): Promise<{
        success: boolean;
        message: string;
    }>;
    configureVideo(baseWidth: number, baseHeight: number, outputWidth: number, outputHeight: number, fps: number): Promise<{
        success: boolean;
        message: string;
    }>;
    configureRecording(path: string, format?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    createScene(sceneName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    removeScene(sceneName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    addSource(sceneName: string, sourceName: string, sourceKind: string, settings?: Record<string, unknown>): Promise<{
        success: boolean;
        message: string;
        sceneItemId?: number;
    }>;
    removeSource(sceneName: string, sourceName: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getSources(sceneName: string): Promise<{
        success: boolean;
        message: string;
        sources?: Array<Record<string, unknown>>;
    }>;
    getSettings(): Promise<{
        success: boolean;
        message: string;
        settings?: Record<string, unknown>;
    }>;
    isConnected(): boolean;
    /**
     * Trigger immediate reconnection (e.g. after obs_launch).
     * Resets retry state and tries up to 3 times.
     */
    reconnectNow(): Promise<void>;
    disconnect(): Promise<void>;
    private sleep;
}
//# sourceMappingURL=obs-client.d.ts.map