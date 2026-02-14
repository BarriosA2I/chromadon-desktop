/**
 * CHROMADON Cost Router
 * =====================
 * Zero-latency keyword-based classifier that routes tasks to the cheapest
 * capable Gemini model. No LLM calls — pure regex matching.
 *
 * Tier distribution target:
 *   FAST      70% of traffic  ($0.10/M input)  — browser actions
 *   BALANCED  25% of traffic  ($0.30/M input)  — analysis, content
 *   REASONING  5% of traffic  ($1.25/M input)  — strategy, planning
 *
 * @author Barrios A2I
 */
export declare enum ModelTier {
    FAST = "gemini-2.0-flash",
    BALANCED = "gemini-2.5-flash",
    REASONING = "gemini-2.5-pro"
}
/**
 * Get the actual model ID, resolving env overrides.
 * Allows overriding via LLM_MODEL env var for when gemini-2.0-flash
 * isn't available (e.g. free tier with zero quota).
 */
export declare function resolveModel(tier: ModelTier): string;
/**
 * Select the cheapest model capable of handling the task.
 *
 * @param userMessage - The user's chat message
 * @param lastToolName - The last tool that was called (for continuation routing)
 * @returns The model ID to use
 */
export declare function selectModelForTask(userMessage: string, lastToolName?: string): ModelTier;
/**
 * Determine whether to use the compact or full system prompt.
 * FAST tasks don't need the 40K token prompt — a 500 token version works.
 */
export declare function shouldUseCompactPrompt(tier: ModelTier): boolean;
//# sourceMappingURL=cost-router.d.ts.map