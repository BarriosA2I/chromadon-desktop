/**
 * TrinityIntelligence — Vault-Backed Market Intelligence
 *
 * Replaces TrinityStub with real implementations that query the
 * client's knowledge vault for competitor data, trends, and audience insights.
 *
 * 3 Agents:
 *   1. Competitor Analyst — searches vault for competitor content/positioning
 *   2. Trend Detector — searches vault for industry trends
 *   3. Audience Profiler — combines vault + client profile for audience data
 *
 * @author Barrios A2I
 */
import type { TrinityInsights } from '../agents/social-tool-bridge';
import type { KnowledgeVault } from '../client-context/knowledge-vault';
import type { ClientStorage } from '../client-context/client-storage';
import type { SocialPlatform } from '../core/social-prompts';
export declare class TrinityIntelligence implements TrinityInsights {
    private storage;
    private vault;
    constructor(storage: ClientStorage, vault: KnowledgeVault);
    private getClientId;
    private extractDomain;
    /** Parse "Source: <url>" from chunk text content (research_website always embeds this) */
    private extractSourceUrlFromContent;
    private isClientOwnContent;
    private filterExternalContent;
    getCompetitorContent(platform: SocialPlatform, topic: string): Promise<string[]>;
    getTrendingTopics(platform: SocialPlatform): Promise<string[]>;
    getOptimalPostingTime(platform: SocialPlatform): Promise<string>;
    getAudienceInsights(platform: SocialPlatform): Promise<Record<string, any>>;
    getContentIntelligence(platform: SocialPlatform, topic: string): Promise<string>;
}
//# sourceMappingURL=trinity-intelligence.d.ts.map