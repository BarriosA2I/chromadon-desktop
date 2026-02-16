/**
 * Error Channel — Centralized Error Event Bus
 *
 * Singleton that captures errors across all Brain subsystems.
 * Supports SSE streaming to Desktop and ring buffer for recent history.
 *
 * @author Barrios A2I
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';
export interface BrainError {
    id: string;
    timestamp: string;
    severity: ErrorSeverity;
    source: string;
    message: string;
    details?: Record<string, unknown>;
    clientId?: string;
    missionId?: string;
}
declare class ErrorChannelImpl extends EventEmitter {
    private buffer;
    private maxBuffer;
    report(severity: ErrorSeverity, source: string, message: string, extra?: {
        clientId?: string;
        missionId?: string;
        details?: Record<string, unknown>;
    }): BrainError;
    getRecent(limit?: number): BrainError[];
}
/** Singleton error channel */
export declare const errorChannel: ErrorChannelImpl;
export {};
//# sourceMappingURL=error-channel.d.ts.map