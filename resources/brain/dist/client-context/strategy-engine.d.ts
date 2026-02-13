/**
 * Business Strategy Engine — AI-Driven Growth Planning
 *
 * Generates comprehensive business growth strategies from client
 * profiles, documents, and competitive analysis. Uses Claude Sonnet
 * for complex strategic reasoning.
 *
 * @author Barrios A2I
 */
import { ClientStorage } from './client-storage';
import { KnowledgeVault } from './knowledge-vault';
import type { GrowthStrategy, ContentCalendarEntry } from './types';
export declare class StrategyEngine {
    private readonly anthropic;
    private readonly storage;
    private readonly vault;
    private readonly model;
    constructor(storage: ClientStorage, vault: KnowledgeVault);
    generateStrategy(clientId: string): Promise<GrowthStrategy>;
    updateStrategy(clientId: string, feedback: string): Promise<GrowthStrategy>;
    generateContentCalendar(clientId: string, weeks?: number): Promise<ContentCalendarEntry[]>;
    weeklyReview(clientId: string): Promise<{
        assessment: string;
        working: string[];
        improvements: string[];
        newTactics: string[];
    }>;
}
//# sourceMappingURL=strategy-engine.d.ts.map