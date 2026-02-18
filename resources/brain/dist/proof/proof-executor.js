"use strict";
/**
 * PROOF OF WORK — Tool Executor
 *
 * Factory pattern. proof_generate collects evidence, proof_get retrieves it.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProofExecutor = void 0;
function createProofExecutor(proofGen, activityLog) {
    return async (toolName, input) => {
        try {
            switch (toolName) {
                case 'proof_generate': {
                    const missionId = input.mission_id;
                    if (!missionId)
                        return JSON.stringify({ error: 'mission_id is required' });
                    const summary = input.summary;
                    if (!summary)
                        return JSON.stringify({ error: 'summary is required' });
                    const status = input.status || 'success';
                    const proof = await proofGen.generate(missionId, activityLog, summary, status);
                    return JSON.stringify({
                        generated: true,
                        missionId: proof.missionId,
                        summary: proof.summary,
                        activityCount: proof.activities.length,
                        screenshotCount: proof.screenshots.length,
                        platforms: proof.platforms,
                        durationMs: proof.durationMs,
                        status: proof.status,
                        message: `Proof package generated for mission "${missionId}" with ${proof.activities.length} activities and ${proof.screenshots.length} screenshots.`,
                    });
                }
                case 'proof_get': {
                    const missionId = input.mission_id;
                    if (!missionId)
                        return JSON.stringify({ error: 'mission_id is required' });
                    const proof = proofGen.get(missionId);
                    if (!proof) {
                        return JSON.stringify({ error: `No proof found for mission "${missionId}".` });
                    }
                    return JSON.stringify({
                        missionId: proof.missionId,
                        generatedAt: proof.generatedAt,
                        summary: proof.summary,
                        activityCount: proof.activities.length,
                        activities: proof.activities.slice(0, 20), // Cap at 20 for context safety
                        screenshotCount: proof.screenshots.length,
                        screenshots: proof.screenshots,
                        durationMs: proof.durationMs,
                        platforms: proof.platforms,
                        status: proof.status,
                    });
                }
                default:
                    return JSON.stringify({ error: `Unknown proof tool: ${toolName}` });
            }
        }
        catch (err) {
            return JSON.stringify({ error: err.message });
        }
    };
}
exports.createProofExecutor = createProofExecutor;
//# sourceMappingURL=proof-executor.js.map