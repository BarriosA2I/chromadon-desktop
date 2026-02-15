"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrinityIntelligence = void 0;
class TrinityIntelligence {
    storage;
    vault;
    constructor(storage, vault) {
        this.storage = storage;
        this.vault = vault;
    }
    getClientId() {
        return this.storage.getActiveClientId();
    }
    // =========================================================================
    // SOURCE FILTERING — Exclude client's own content from market analysis
    // =========================================================================
    extractDomain(url) {
        if (!url)
            return null;
        try {
            return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
        }
        catch {
            return null;
        }
    }
    isClientOwnContent(hit, clientDomain, businessName) {
        // Check sourceUrl in metadata (new chunks have this)
        const sourceUrl = hit.chunk.metadata.sourceUrl;
        if (sourceUrl && clientDomain) {
            const sourceDomain = this.extractDomain(sourceUrl);
            if (sourceDomain && sourceDomain === clientDomain)
                return true;
        }
        // Heuristic for legacy chunks without sourceUrl: check if documentFilename contains business name
        if (!sourceUrl && businessName) {
            const nameLower = businessName.toLowerCase();
            const filenameLower = hit.documentFilename.toLowerCase();
            if (filenameLower.includes(nameLower))
                return true;
        }
        return false;
    }
    filterExternalContent(hits, clientId) {
        const profile = this.storage.getProfile(clientId);
        const clientDomain = this.extractDomain(profile?.website);
        const businessName = profile?.businessName || null;
        return hits.filter(hit => !this.isClientOwnContent(hit, clientDomain, businessName));
    }
    // =========================================================================
    // AGENT 1: Competitor Analyst
    // =========================================================================
    async getCompetitorContent(platform, topic) {
        const clientId = this.getClientId();
        if (!clientId)
            return [];
        const queries = [
            `competitor ${topic}`,
            `${topic} pricing services`,
            `${topic} ${platform} content strategy`,
        ];
        const results = [];
        for (const q of queries) {
            const hits = this.vault.searchKnowledge(clientId, q, 10);
            const external = this.filterExternalContent(hits, clientId);
            for (const hit of external) {
                if (hit.chunk.content && !results.includes(hit.chunk.content)) {
                    results.push(hit.chunk.content);
                }
            }
        }
        return results.slice(0, 5);
    }
    // =========================================================================
    // AGENT 2: Trend Detector
    // =========================================================================
    async getTrendingTopics(platform) {
        const clientId = this.getClientId();
        if (!clientId)
            return [];
        const profile = this.storage.getProfile(clientId);
        const industry = profile?.industry || 'technology';
        const queries = [
            `${industry} trends`,
            `trending ${platform}`,
            `${industry} news updates`,
        ];
        const topics = [];
        for (const q of queries) {
            const hits = this.vault.searchKnowledge(clientId, q, 10);
            const external = this.filterExternalContent(hits, clientId);
            for (const hit of external) {
                if (hit.chunk.content && !topics.includes(hit.chunk.content)) {
                    topics.push(hit.chunk.content);
                }
            }
        }
        return topics.slice(0, 5);
    }
    async getOptimalPostingTime(platform) {
        const timings = {
            twitter: '9:00 AM EST',
            linkedin: '10:00 AM EST',
            facebook: '1:00 PM EST',
            instagram: '11:00 AM EST',
            tiktok: '7:00 PM EST',
            youtube: '2:00 PM EST',
        };
        return timings[platform.toLowerCase()] || '10:00 AM EST';
    }
    // =========================================================================
    // AGENT 3: Audience Profiler
    // =========================================================================
    async getAudienceInsights(platform) {
        const clientId = this.getClientId();
        if (!clientId)
            return {};
        const profile = this.storage.getProfile(clientId);
        const personas = this.storage.getPersonas(clientId);
        const voice = this.storage.getVoice(clientId);
        // Search vault for audience-related content (external sources only)
        const hits = this.vault.searchKnowledge(clientId, `target audience customers ${platform}`, 10);
        const external = this.filterExternalContent(hits, clientId);
        const vaultInsights = external.map(h => h.chunk.content).filter(Boolean);
        return {
            industry: profile?.industry || 'unknown',
            targetAudiences: personas.map(p => ({ name: p.name, demographics: p.demographics })),
            brandVoice: {
                tone: voice?.tone || [],
                personality: voice?.personality || [],
                formality: voice?.formalityLevel || 'professional',
            },
            products: profile?.products || [],
            services: profile?.services || [],
            usps: profile?.uniqueSellingPoints || [],
            vaultInsights: vaultInsights.slice(0, 3),
        };
    }
    // =========================================================================
    // COMBINED INTELLIGENCE (for content generation injection)
    // =========================================================================
    async getContentIntelligence(platform, topic) {
        const [competitors, trends, audience] = await Promise.all([
            this.getCompetitorContent(platform, topic),
            this.getTrendingTopics(platform),
            this.getAudienceInsights(platform),
        ]);
        const parts = [];
        if (competitors.length > 0) {
            parts.push(`COMPETITOR INTELLIGENCE:\n${competitors.slice(0, 2).join('\n---\n')}`);
        }
        if (trends.length > 0) {
            parts.push(`INDUSTRY TRENDS:\n${trends.slice(0, 2).join('\n---\n')}`);
        }
        if (audience.products?.length || audience.services?.length) {
            const offerings = [...(audience.products || []), ...(audience.services || [])];
            parts.push(`YOUR OFFERINGS: ${offerings.join(', ')}`);
        }
        if (audience.usps?.length) {
            parts.push(`UNIQUE SELLING POINTS: ${audience.usps.join(', ')}`);
        }
        if (audience.targetAudiences?.length) {
            parts.push(`TARGET AUDIENCES: ${audience.targetAudiences.map((a) => a.name).join(', ')}`);
        }
        if (audience.brandVoice?.tone?.length) {
            parts.push(`BRAND VOICE: ${audience.brandVoice.tone.join(', ')} | ${audience.brandVoice.formality}`);
        }
        return parts.length > 0
            ? `\n--- TRINITY MARKET INTELLIGENCE ---\n${parts.join('\n\n')}\n--- END INTELLIGENCE ---\n`
            : '';
    }
}
exports.TrinityIntelligence = TrinityIntelligence;
//# sourceMappingURL=trinity-intelligence.js.map