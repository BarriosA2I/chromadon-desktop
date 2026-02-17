export interface CostEntry {
    clientId: string;
    missionId?: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    provider: 'gemini' | 'anthropic';
}
export interface GlobalCostStats {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    costByModel: Record<string, number>;
    costByClient: Record<string, number>;
}
export interface FallbackStats {
    geminiCalls: number;
    geminiCost: number;
    anthropicCalls: number;
    anthropicCost: number;
    fallbackRate: number;
}
export declare class BudgetMonitor {
    private db;
    private taskLimitUsd;
    constructor(dbPath: string, taskLimitUsd?: number);
    private initSchema;
    calculateCost(model: string, inputTokens: number, outputTokens: number): number;
    recordUsage(entry: CostEntry): void;
    getMissionCost(missionId: string): number;
    getClientCost(clientId: string, sinceMs?: number): number;
    isOverBudget(missionId: string): boolean;
    getGlobalStats(sinceMs?: number): GlobalCostStats;
    getFallbackStats(sinceMs?: number): FallbackStats;
    close(): void;
}
//# sourceMappingURL=budget-monitor.d.ts.map