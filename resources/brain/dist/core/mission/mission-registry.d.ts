/**
 * MissionRegistry — SQLite-backed Mission Tracker
 *
 * Persists all agent missions (scheduled posts, RALPH loops, chat sessions,
 * warmups, onboarding, cortex plans). Survives Brain restarts via zombie cleanup.
 *
 * @author Barrios A2I
 */
import type { IMissionRegistry, MissionContext, MissionRecord, MissionResult, MissionStats, MissionStatus, MissionType } from './types';
export declare class MissionRegistry implements IMissionRegistry {
    private db;
    constructor(dbPath: string);
    private initSchema;
    create(type: MissionType, context: MissionContext): string;
    updateStatus(id: string, status: MissionStatus, error?: string): void;
    updateResult(id: string, result: MissionResult): void;
    get(id: string): MissionRecord | undefined;
    listActive(clientId: string): MissionRecord[];
    listByClient(clientId: string, limit?: number): MissionRecord[];
    listByStatus(status: MissionStatus, limit?: number): MissionRecord[];
    listByType(type: MissionType, limit?: number): MissionRecord[];
    failZombies(): number;
    getStats(): MissionStats;
    getClientStats(clientId: string): MissionStats;
    close(): void;
    private mapRow;
}
//# sourceMappingURL=mission-registry.d.ts.map