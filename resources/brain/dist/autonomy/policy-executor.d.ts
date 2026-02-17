/**
 * Policy Check Executor — Pure regex risk classification
 *
 * No LLM calls. No external dependencies. Runs in microseconds.
 * FORBIDDEN: irreversible account/financial actions
 * RISKY: publishing, payments, terms acceptance
 * SAFE: everything else
 *
 * @author Barrios A2I
 */
export declare function createPolicyExecutor(): (toolName: string, input: Record<string, unknown>) => Promise<string>;
//# sourceMappingURL=policy-executor.d.ts.map