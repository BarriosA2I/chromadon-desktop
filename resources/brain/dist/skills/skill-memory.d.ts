/**
 * CHROMADON Skill Memory Manager
 *
 * Reads/writes proven action sequences so the Brain gets faster on repeat visits.
 * Stores runtime skills in userData (writable), ships defaults in resources/brain/.
 *
 * v2.1: Drift detection, per-task stats, versioning, compact summary.
 *
 * @author Barrios A2I
 */
export interface SkillStep {
    order: number;
    action: string;
    selectors?: string[];
    params?: Record<string, unknown>;
    waitAfter?: number;
    note?: string;
    target?: string;
    repeat?: number;
}
export interface SelectorDriftRecord {
    selector: string;
    failedAt: string;
    error: string;
    replacedBy?: string;
    resolvedAt?: string;
}
export interface TaskDriftInfo {
    driftCount: number;
    lastDriftAt: string | null;
    driftedSelectors: SelectorDriftRecord[];
    stabilityScore: number;
}
export interface TaskExecutionStats {
    totalAttempts: number;
    totalSuccesses: number;
    totalFailures: number;
    lastAttempt: string | null;
    lastSuccess: string | null;
    lastFailure: string | null;
    averageDurationMs: number;
    successRate: number;
    recentHistory: Array<{
        timestamp: string;
        success: boolean;
        durationMs?: number;
        failedStep?: number;
        error?: string;
    }>;
}
export interface TaskVersion {
    steps: SkillStep[];
    savedAt: string;
    successRate: number;
    reason: string;
}
export interface TaskSkill {
    description: string;
    learned: string;
    lastUsed: string | null;
    successCount: number;
    failCount: number;
    steps: SkillStep[];
    rules: string[];
    clientNotes?: string;
    drift?: TaskDriftInfo;
    stats?: TaskExecutionStats;
    lastVerified?: string;
    previousVersions?: TaskVersion[];
}
export interface SiteSkills {
    domain: string;
    siteName: string;
    tasks: Record<string, TaskSkill>;
    siteRules: string[];
    knownSelectors: Record<string, string[]>;
}
export interface SkillData {
    version: string;
    skills: Record<string, SiteSkills>;
    globalRules: string[];
}
export declare class SkillMemory {
    private skillsPath;
    private defaultsPath;
    private cache;
    constructor(dataDir: string, defaultsPath: string);
    private loadSkills;
    private save;
    getSkillsForDomain(domain: string): SiteSkills | null;
    findMatchingTask(domain: string, intent?: string): {
        site: SiteSkills;
        taskName: string;
        task: TaskSkill;
    } | null;
    learnNewSkill(domain: string, taskName: string, steps: SkillStep[], options?: {
        siteName?: string;
        description?: string;
        rules?: string[];
        siteRules?: string[];
        clientNotes?: string;
        durationMs?: number;
    }): void;
    recordFailure(domain: string, taskName: string, failedStep: number, error: string, failedSelector?: string): void;
    addSelector(domain: string, elementType: string, selector: string): void;
    addSiteRule(domain: string, rule: string): void;
    saveClientNotes(domain: string, taskName: string, notes: string): void;
    recordExecution(domain: string, taskName: string, success: boolean, durationMs?: number, failedStep?: number, error?: string): void;
    recordSelectorDrift(domain: string, _taskName: string, _step: number, failedSelector: string, error: string): void;
    resolveSelectorDrift(domain: string, taskName: string, failedSelector: string, newSelector: string): void;
    private computeStabilityScore;
    getDriftedTasks(): Array<{
        domain: string;
        taskName: string;
        drift: TaskDriftInfo;
    }>;
    getReliabilityReport(): Array<{
        domain: string;
        taskName: string;
        successRate: number;
        totalAttempts: number;
        lastAttempt: string | null;
    }>;
    getTaskStats(domain: string, taskName: string): TaskExecutionStats | null;
    rollbackSkill(domain: string, taskName: string): boolean;
    getSkillsJson(): string;
    /** Compact summary for system prompt — no step details, just task names + stats */
    getSkillsSummary(): string;
    getStats(): {
        domains: number;
        totalTasks: number;
        totalSuccesses: number;
        totalFailures: number;
    };
}
//# sourceMappingURL=skill-memory.d.ts.map