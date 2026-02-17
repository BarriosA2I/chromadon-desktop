"use strict";
/**
 * Error Channel — Centralized Error Event Bus
 *
 * Singleton that captures errors across all Brain subsystems.
 * Supports SSE streaming to Desktop and ring buffer for recent history.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorChannel = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('error');
class ErrorChannelImpl extends events_1.EventEmitter {
    buffer = [];
    maxBuffer = 100;
    report(severity, source, message, extra) {
        const error = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            severity,
            source,
            message,
            details: extra?.details,
            clientId: extra?.clientId,
            missionId: extra?.missionId,
        };
        // Ring buffer
        this.buffer.push(error);
        if (this.buffer.length > this.maxBuffer) {
            this.buffer.shift();
        }
        // Emit for SSE listeners
        this.emit('brain-error', error);
        // Console output for error/critical
        if (severity === 'error' || severity === 'critical') {
            log.error(`[ErrorChannel] [${severity.toUpperCase()}] ${source}: ${message}`);
        }
        return error;
    }
    getRecent(limit = 20) {
        return this.buffer.slice(-limit);
    }
}
/** Singleton error channel */
exports.errorChannel = new ErrorChannelImpl();
//# sourceMappingURL=error-channel.js.map