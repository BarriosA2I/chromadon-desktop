/**
 * HTTP Request Logger Middleware — pino-http for Express
 *
 * Logs every HTTP request/response with structured JSON.
 * Auto-generates correlationId per request.
 * Skips /health endpoint logging to reduce noise.
 *
 * @author Barrios A2I
 */
/// <reference types="node/http.js" />
import type { IncomingMessage, ServerResponse } from 'http';
export declare const requestLoggerMiddleware: import("pino-http").HttpLogger<IncomingMessage, ServerResponse<IncomingMessage>, "error" | "info" | "warn">;
//# sourceMappingURL=request-logger.d.ts.map