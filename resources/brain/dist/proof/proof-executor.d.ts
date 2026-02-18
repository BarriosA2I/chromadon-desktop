/**
 * PROOF OF WORK — Tool Executor
 *
 * Factory pattern. proof_generate collects evidence, proof_get retrieves it.
 *
 * @author Barrios A2I
 */
import { ProofGenerator } from './proof-generator';
import { ActivityEntry } from '../activity/activity-types';
interface ActivityLogReader {
    getByMissionId(missionId: string): ActivityEntry[];
}
export declare function createProofExecutor(proofGen: ProofGenerator, activityLog: ActivityLogReader): (toolName: string, input: Record<string, unknown>) => Promise<string>;
export {};
//# sourceMappingURL=proof-executor.d.ts.map