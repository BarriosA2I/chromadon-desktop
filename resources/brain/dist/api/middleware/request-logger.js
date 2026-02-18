"use strict";
/**
 * HTTP Request Logger Middleware — pino-http for Express
 *
 * Logs every HTTP request/response with structured JSON.
 * Auto-generates correlationId per request.
 * Skips /health endpoint logging to reduce noise.
 *
 * @author Barrios A2I
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = void 0;
const pino_http_1 = __importDefault(require("pino-http"));
const logger_js_1 = require("../../lib/logger.js");
exports.requestLoggerMiddleware = (0, pino_http_1.default)({
    logger: logger_js_1.rootLogger,
    genReqId: (req) => {
        return req.requestId || req.headers['x-request-id'] || (0, logger_js_1.generateCorrelationId)();
    },
    autoLogging: {
        ignore: (req) => {
            return req.url === '/health';
        },
    },
    customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, _res, err) => {
        return `${req.method} ${req.url} failed: ${err.message}`;
    },
});
//# sourceMappingURL=request-logger.js.map