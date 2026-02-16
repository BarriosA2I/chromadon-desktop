/**
 * MissionRegistry — Type Definitions
 *
 * Strict typing for mission tracking across Brain, Desktop, and Analytics.
 *
 * @author Barrios A2I
 */
export type MissionStatus = 'QUEUED' | 'APPROVED' | 'EXECUTING' | 'CHECKPOINT' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type MissionType = 'POST_SCHEDULE' | 'RALPH_LOOP' | 'AGENT_CHAT' | 'SESSION_WARMUP' | 'ONBOARDING' | 'CORTEX_PLAN' | 'CONTENT_PREVIEW' | 'ANALYTICS_EXPORT';
export interface MissionContext {
    clientId: string;
    agentId?: string;
    targetPlatform?: string;
    workflowId?: string;
    requiresApproval?: boolean;
    metadata?: Record<string, unknown>;
}
export interface MissionResult {
    success: boolean;
    outputSummary?: string;
    artifacts?: string[];
    costUsd?: number;
    tokensUsed?: number;
    error?: string;
}
export interface MissionRecord {
    id: string;
    type: MissionType;
    status: MissionStatus;
    clientId: string;
    context: MissionContext;
    result?: MissionResult;
    error?: string;
    createdAt: number;
    updatedAt: number;
    completedAt?: number;
}
export interface MissionStats {
    total: number;
    active: number;
    completed: number;
    failed: number;
    cancelled: number;
}
export interface IMissionRegistry {
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
}
//# sourceMappingURL=types.d.ts.map