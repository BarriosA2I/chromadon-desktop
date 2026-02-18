/**
 * YouTube Studio Browser Automation — Executor
 *
 * Routes yt_studio_* tool calls to Desktop HTTP API,
 * using Shadow DOM piercing helpers for YouTube Studio's Lit/Polymer UI.
 *
 * @author Barrios A2I
 */
export declare function createYouTubeStudioExecutor(desktopUrl: string): (toolName: string, input: Record<string, any>) => Promise<string>;
//# sourceMappingURL=youtube-studio-executor.d.ts.map