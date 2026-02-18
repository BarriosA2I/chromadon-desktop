"use strict";
/**
 * Centralized Structured Logger — pino-based JSON logging for CHROMADON Brain
 *
 * Usage:
 *   import { createChildLogger } from '../lib/logger.js';
 *   const log = createChildLogger('api');
 *   log.info({ port: 3001 }, 'Server started');
 *
 * @author Barrios A2I
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = exports.createChildLogger = exports.rootLogger = void 0;
const pino_1 = __importDefault(require("pino"));
const uuid_1 = require("uuid");
const fs_1 = require("fs");
const path_1 = require("path");
// Read version from package.json at startup
let version = 'unknown';
try {
    const pkg = JSON.parse((0, fs_1.readFileSync)((0, path_1.resolve)(__dirname, '../../package.json'), 'utf-8'));
    version = pkg.version;
}
catch {
    // Fallback — version stays 'unknown'
}
const level = process.env.CHROMADON_LOG_LEVEL || 'info';
/**
 * Root pino logger — all child loggers inherit from this.
 * Redacts sensitive fields in logged objects.
 */
exports.rootLogger = (0, pino_1.default)({
    name: 'chromadon-brain',
    level,
    redact: {
        paths: [
            'apiKey',
            'token',
            'password',
            'secret',
            'cookie',
            'authorization',
            'req.headers.authorization',
            'req.headers.cookie',
            'headers.authorization',
            'headers.cookie',
        ],
        censor: '[REDACTED]',
    },
    base: {
        service: 'chromadon-brain',
        version,
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
});
/**
 * Create a domain-scoped child logger.
 *
 * @param domain - Logical domain name (e.g. 'api', 'orchestrator', 'scheduler')
 */
function createChildLogger(domain) {
    return exports.rootLogger.child({ domain });
}
exports.createChildLogger = createChildLogger;
/**
 * Generate a unique correlation ID for request tracing.
 */
function generateCorrelationId() {
    return (0, uuid_1.v4)();
}
exports.generateCorrelationId = generateCorrelationId;
//# sourceMappingURL=logger.js.map