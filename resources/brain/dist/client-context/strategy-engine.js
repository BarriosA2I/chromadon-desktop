"use strict";
/**
 * Business Strategy Engine — AI-Driven Growth Planning
 *
 * Generates comprehensive business growth strategies from client
 * profiles, documents, and competitive analysis. Uses Claude Sonnet
 * for complex strategic reasoning.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyEngine = void 0;
const llm_helper_1 = require("./llm-helper");
const strategy_prompts_1 = require("./strategy-prompts");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('client');
// ============================================================================
// STRATEGY ENGINE
// ============================================================================
class StrategyEngine {
    storage;
    vault;
    constructor(storage, vault) {
        this.storage = storage;
        this.vault = vault;
    }
    // =========================================================================
    // GENERATE STRATEGY
    // =========================================================================
    async generateStrategy(clientId) {
        const profile = this.storage.getProfile(clientId);
        if (!profile)
            throw new Error(`No profile found for client: ${clientId}`);
        const voice = this.storage.getVoice(clientId);
        const personas = this.storage.getPersonas(clientId);
        const competitors = this.storage.getCompetitors(clientId);
        // Search knowledge vault for relevant business context
        const relevantDocs = this.vault.searchKnowledge(clientId, `${profile.businessName} ${profile.industry} strategy growth marketing`, 10);
        const prompt = (0, strategy_prompts_1.buildStrategyPrompt)(profile, voice, personas, competitors, relevantDocs);
        const rawText = await (0, llm_helper_1.callLLM)('You are a world-class digital marketing strategist. Return ONLY valid JSON. No markdown, no explanation.', prompt, 8000);
        if (!rawText)
            throw new Error('No response from strategy generation');
        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const strategyData = JSON.parse(jsonStr);
        const now = new Date().toISOString();
        const strategy = {
            clientId,
            overview: strategyData.overview || '',
            targetMarketAnalysis: strategyData.targetMarketAnalysis || '',
            competitiveAdvantages: strategyData.competitiveAdvantages || [],
            channels: (strategyData.channels || []),
            contentCalendar: [],
            successMetrics: strategyData.successMetrics || [],
            budgetAllocation: strategyData.budgetAllocation || [],
            shortTermGoals: strategyData.shortTermGoals || [],
            longTermGoals: strategyData.longTermGoals || [],
            risks: strategyData.risks || [],
            generatedAt: now,
            updatedAt: now,
            version: 1,
        };
        this.storage.updateStrategy(clientId, strategy);
        log.info(`[StrategyEngine] Generated strategy for client: ${clientId} (${strategy.channels.length} channels)`);
        return strategy;
    }
    // =========================================================================
    // UPDATE STRATEGY WITH FEEDBACK
    // =========================================================================
    async updateStrategy(clientId, feedback) {
        const profile = this.storage.getProfile(clientId);
        if (!profile)
            throw new Error(`No profile found for client: ${clientId}`);
        const existing = this.storage.getStrategy(clientId);
        if (!existing)
            throw new Error(`No existing strategy for client: ${clientId}`);
        const reviewPrompt = (0, strategy_prompts_1.buildReviewPrompt)(profile, JSON.stringify(existing, null, 2), feedback);
        const rawText = await (0, llm_helper_1.callLLM)('You are a world-class digital marketing strategist. Return ONLY valid JSON. No markdown, no explanation.', reviewPrompt, 4000);
        if (!rawText)
            throw new Error('No response from strategy update');
        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const reviewData = JSON.parse(jsonStr);
        // Apply updates to existing strategy
        if (reviewData.updatedOverview) {
            existing.overview = reviewData.updatedOverview;
        }
        existing.updatedAt = new Date().toISOString();
        existing.version += 1;
        this.storage.updateStrategy(clientId, existing);
        log.info(`[StrategyEngine] Updated strategy for client: ${clientId} (v${existing.version})`);
        return existing;
    }
    // =========================================================================
    // CONTENT CALENDAR
    // =========================================================================
    async generateContentCalendar(clientId, weeks = 4) {
        const profile = this.storage.getProfile(clientId);
        if (!profile)
            throw new Error(`No profile found for client: ${clientId}`);
        const voice = this.storage.getVoice(clientId);
        const strategy = this.storage.getStrategy(clientId);
        const channels = strategy?.channels.map(c => ({
            platform: c.platform,
            postingFrequency: c.postingFrequency,
            contentTypes: c.contentTypes,
        })) || [
            { platform: 'twitter', postingFrequency: '3x per week', contentTypes: ['educational', 'promotional'] },
            { platform: 'linkedin', postingFrequency: '2x per week', contentTypes: ['thought leadership', 'case study'] },
        ];
        const prompt = (0, strategy_prompts_1.buildCalendarPrompt)(profile, voice, channels, weeks);
        const rawText = await (0, llm_helper_1.callLLM)('You are a social media content strategist. Return ONLY a valid JSON array. No markdown, no explanation.', prompt, 8000);
        if (!rawText)
            throw new Error('No response from calendar generation');
        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const calendarData = JSON.parse(jsonStr);
        // Update strategy with calendar
        if (strategy) {
            strategy.contentCalendar = calendarData;
            strategy.updatedAt = new Date().toISOString();
            this.storage.updateStrategy(clientId, strategy);
        }
        log.info(`[StrategyEngine] Generated ${calendarData.length} calendar entries for ${weeks} weeks`);
        return calendarData;
    }
    // =========================================================================
    // WEEKLY REVIEW
    // =========================================================================
    async weeklyReview(clientId) {
        const profile = this.storage.getProfile(clientId);
        if (!profile)
            throw new Error(`No profile found for client: ${clientId}`);
        const strategy = this.storage.getStrategy(clientId);
        if (!strategy)
            throw new Error(`No strategy found for client: ${clientId}`);
        const reviewPrompt = (0, strategy_prompts_1.buildReviewPrompt)(profile, JSON.stringify(strategy, null, 2));
        const rawText = await (0, llm_helper_1.callLLM)('You are a world-class digital marketing strategist. Return ONLY valid JSON. No markdown, no explanation.', reviewPrompt, 4000);
        if (!rawText)
            throw new Error('No response from weekly review');
        let jsonStr = rawText.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
        }
        const reviewData = JSON.parse(jsonStr);
        log.info(`[StrategyEngine] Weekly review completed for client: ${clientId}`);
        return {
            assessment: reviewData.assessment || '',
            working: reviewData.working || [],
            improvements: reviewData.improvements || [],
            newTactics: reviewData.newTactics || [],
        };
    }
}
exports.StrategyEngine = StrategyEngine;
//# sourceMappingURL=strategy-engine.js.map