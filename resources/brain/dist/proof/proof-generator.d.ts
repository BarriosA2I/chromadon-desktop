/**
 * PROOF OF WORK — Evidence Generator (Fix #4: Retention)
 *
 * Generates proof packages for completed missions.
 * Screenshots stored at {dataDir}/proof/{missionId}/
 * 30-day / 1GB retention policy enforced on startup.
 *
 * @author Barrios A2I
 */
import { ProofPackage } from './proof-types';
import { ActivityEntry } from '../activity/activity-types';
interface ActivityLogReader {
    getByMissionId(missionId: string): ActivityEntry[];
}
export declare class ProofGenerator {
    private readonly proofDir;
    private readonly desktopUrl;
    constructor(desktopUrl?: string, dataDir?: string);
    /**
     * Generate a proof package for a completed mission.
     * Collects activity entries, takes a screenshot, writes proof.json.
     */
    generate(missionId: string, activityLog: ActivityLogReader, summary: string, status?: 'success' | 'partial' | 'failed'): Promise<ProofPackage>;
    /**
     * Retrieve a proof package by mission ID.
     */
    get(missionId: string): ProofPackage | null;
    /**
     * Fix #4: Retention policy — delete proof dirs >30 days, then enforce 1GB cap.
     * Called once on startup.
     */
    pruneOldProofs(): {
        deletedByAge: number;
        deletedBySize: number;
    };
    /**
     * Get total size of a directory in bytes.
     */
    private getDirSize;
}
export {};
//# sourceMappingURL=proof-generator.d.ts.map