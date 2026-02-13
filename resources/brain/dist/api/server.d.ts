/**
 * CHROMADON HTTP API Server v4.0.0 - CDP ENABLED
 *
 * Connects to EXISTING Chrome via CDP to preserve login sessions (Vercel, GitHub, Render, etc.)
 * Falls back to launching fresh Chromium if CDP connection fails.
 *
 * START CHROME WITH: chrome.exe --remote-debugging-port=9222
 */
declare const app: import("express-serve-static-core").Express;
export declare function startServer(): Promise<void>;
export { app };
//# sourceMappingURL=server.d.ts.map