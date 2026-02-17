/**
 * OBS Studio - Tool Executor
 *
 * Routes OBS tool calls to the OBSClient, returning
 * formatted text/JSON for the AI's consumption.
 *
 * @author Barrios A2I
 */
import { OBSClient } from './obs-client';
export type ObsExecutor = (toolName: string, input: Record<string, any>) => Promise<string>;
/**
 * Creates an executor function that routes OBS tool calls
 * to the OBSClient WebSocket connection.
 *
 * @param obsClient - WebSocket client for OBS
 * @param desktopUrl - Desktop control server URL (for obs_launch)
 */
export declare function createObsExecutor(obsClient: OBSClient, desktopUrl?: string): ObsExecutor;
//# sourceMappingURL=obs-executor.d.ts.map