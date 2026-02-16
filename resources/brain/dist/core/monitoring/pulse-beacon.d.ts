/**
 * Pulse Beacon — Telemetry Heartbeat
 *
 * Periodically sends Brain health data to a remote endpoint (if configured).
 * In local mode (no PULSE_ENDPOINT), only logs to console.
 *
 * @author Barrios A2I
 */
import type { MissionRegistry } from '../mission';
import type { BudgetMonitor } from '../budget';
export interface PulsePayload {
    timestamp: string;
    uptimeMs: number;
    memoryMb: {
        heapUsed: number;
        rss: number;
    };
    missions: {
        total: number;
        active: number;
        completed: number;
        failed: number;
    };
    cost24h: number;
    errorCount: number;
}
export declare class PulseBeacon {
    private missionRegistry;
    private budgetMonitor;
    private interval;
    private endpoint;
    private intervalMs;
    private startTime;
    private errorCount;
    private consecutiveFailures;
    private running;
    constructor(missionRegistry: MissionRegistry | null, budgetMonitor: BudgetMonitor | null, intervalMs?: number);
    start(): void;
    stop(): void;
    recordError(): void;
    getStatus(): {
        running: boolean;
        endpoint: string | null;
        failures: number;
        errors: number;
    };
    private buildPayload;
    private send;
}
//# sourceMappingURL=pulse-beacon.d.ts.map