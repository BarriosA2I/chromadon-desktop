/**
 * Session Warmup — Platform Session Preflight Checks
 *
 * Periodically validates social platform sessions are alive.
 * Stubs actual CDP validation for now — wired when browser module exposes health check.
 *
 * @author Barrios A2I
 */
import type { MissionRegistry } from '../mission';
export interface SessionStatus {
    platform: string;
    alive: boolean;
    lastChecked: number;
    error?: string;
}
export declare class SessionWarmup {
    private missionRegistry;
    private interval;
    private checkIntervalMs;
    private statuses;
    private running;
    constructor(missionRegistry: MissionRegistry | null, checkIntervalMs?: number);
    start(): void;
    stop(): void;
    checkAll(): Promise<void>;
    preflightCheck(platform: string): Promise<SessionStatus>;
    getStatuses(): Record<string, SessionStatus>;
}
//# sourceMappingURL=session-warmup.d.ts.map