/**
 * Visual Verify Executor — AI vision verification of browser actions
 *
 * Takes a screenshot + DOM text, sends to Gemini vision (haiku tier = $0.10/M)
 * to classify whether the last action succeeded.
 *
 * @author Barrios A2I
 */
export declare function createVisualVerifyExecutor(desktopUrl: string, activeTabRef: {
    tabId: number | null;
}): (toolName: string, input: Record<string, unknown>) => Promise<string>;
//# sourceMappingURL=visual-verify-executor.d.ts.map