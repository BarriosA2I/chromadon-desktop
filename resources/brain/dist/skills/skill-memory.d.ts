/**
 * CHROMADON Skill Memory Manager
 *
 * Reads/writes proven action sequences so the Brain gets faster on repeat visits.
 * Stores runtime skills in userData (writable), ships defaults in resources/brain/.
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
export interface TaskSkill {
    description: string;
    learned: string;
    lastUsed: string | null;
    successCount: number;
    failCount: number;
    steps: SkillStep[];
    rules: string[];
    clientNotes?: string;
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
    }): void;
    recordFailure(domain: string, taskName: string, failedStep: number, error: string): void;
    addSelector(domain: string, elementType: string, selector: string): void;
    addSiteRule(domain: string, rule: string): void;
    saveClientNotes(domain: string, taskName: string, notes: string): void;
    getSkillsJson(): string;
    getStats(): {
        domains: number;
        totalTasks: number;
        totalSuccesses: number;
        totalFailures: number;
    };
}
//# sourceMappingURL=skill-memory.d.ts.map