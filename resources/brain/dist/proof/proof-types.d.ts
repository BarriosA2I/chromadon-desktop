/**
 * PROOF OF WORK — Type Definitions
 *
 * Evidence packages proving what CHROMADON did during missions.
 * Screenshots + activity trail + AI summary.
 *
 * @author Barrios A2I
 */
import { ActivityEntry } from '../activity/activity-types';
export interface ProofPackage {
    /** Mission ID this proof belongs to */
    missionId: string;
    /** ISO 8601 when this proof was generated */
    generatedAt: string;
    /** AI-generated summary of what was accomplished */
    summary: string;
    /** Filtered activity entries for this mission */
    activities: ActivityEntry[];
    /** File paths to screenshots taken during/after mission */
    screenshots: string[];
    /** Total mission duration in milliseconds (optional) */
    durationMs?: number;
    /** Platforms involved (e.g., ['instagram', 'twitter']) */
    platforms: string[];
    /** Overall mission outcome */
    status: 'success' | 'partial' | 'failed';
}
//# sourceMappingURL=proof-types.d.ts.map