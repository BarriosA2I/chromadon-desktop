"use strict";
/**
 * Social Media Analytics - Data Collector
 *
 * Scheduled browser scraping via the Agentic Orchestrator.
 * Follows SocialOverlord pattern: orchestrator + contextFactory + db.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataCollector = void 0;
const collector_prompts_1 = require("./collector-prompts");
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('analytics');
// ============================================================================
// COLLECTOR WRITER (captures orchestrator output)
// ============================================================================
class CollectorWriter {
    chunks = [];
    closed = false;
    writeEvent(event, data) {
        if (event === 'text_delta' && data.text) {
            this.chunks.push(data.text);
        }
    }
    close() {
        this.closed = true;
    }
    isClosed() {
        return this.closed;
    }
    getText() {
        return this.chunks.join('');
    }
}
// ============================================================================
// DATA COLLECTOR
// ============================================================================
class DataCollector {
    orchestrator;
    contextFactory;
    db;
    collectInterval = null;
    isCollecting = false;
    constructor(orchestrator, contextFactory, db) {
        this.orchestrator = orchestrator;
        this.contextFactory = contextFactory;
        this.db = db;
    }
    /**
     * Start scheduled collection (every 6 hours by default).
     */
    startSchedule(intervalMs = 6 * 60 * 60 * 1000) {
        if (this.collectInterval)
            return;
        log.info(`[Analytics Collector] Scheduled every ${(intervalMs / 3600000).toFixed(1)}h`);
        this.collectInterval = setInterval(() => this.collectAll(), intervalMs);
    }
    stopSchedule() {
        if (this.collectInterval) {
            clearInterval(this.collectInterval);
            this.collectInterval = null;
        }
    }
    /**
     * Collect data from all supported platforms.
     */
    async collectAll() {
        if (this.isCollecting) {
            log.info('[Analytics Collector] Already collecting, skipping');
            return [];
        }
        this.isCollecting = true;
        const results = [];
        const platforms = (0, collector_prompts_1.getSupportedPlatforms)();
        log.info(`[Analytics Collector] Starting collection for ${platforms.length} platforms`);
        for (const platform of platforms) {
            try {
                const result = await this.collectPlatform(platform);
                results.push(result);
                // Rate limit: 5s between platforms
                await new Promise(r => setTimeout(r, 5000));
            }
            catch (error) {
                results.push({
                    platform,
                    success: false,
                    postsCollected: 0,
                    error: error.message,
                });
            }
        }
        this.isCollecting = false;
        log.info(`[Analytics Collector] Collection complete: ${results.filter(r => r.success).length}/${results.length} successful`);
        return results;
    }
    /**
     * Collect data from a single platform via the orchestrator.
     */
    async collectPlatform(platform) {
        log.info(`[Analytics Collector] Collecting ${platform}...`);
        const prompt = (0, collector_prompts_1.getCollectionPrompt)(platform);
        const writer = new CollectorWriter();
        try {
            const { context, pageContext } = await this.contextFactory();
            await this.orchestrator.chat(undefined, prompt, writer, context, pageContext);
            const responseText = writer.getText();
            return this.parseAndStore(platform, responseText);
        }
        catch (error) {
            const errMsg = error.message;
            log.error({ err: errMsg }, `[Analytics Collector] ${platform} collection failed:`);
            return { platform, success: false, postsCollected: 0, error: errMsg };
        }
    }
    /**
     * Parse orchestrator response JSON and store in database.
     */
    parseAndStore(platform, responseText) {
        // Extract JSON from response (may be wrapped in markdown code blocks)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { platform, success: false, postsCollected: 0, error: 'No JSON found in response' };
        }
        let data;
        try {
            data = JSON.parse(jsonMatch[0]);
        }
        catch {
            return { platform, success: false, postsCollected: 0, error: 'Invalid JSON in response' };
        }
        if (data.error) {
            return { platform, success: false, postsCollected: 0, error: data.error };
        }
        // Store audience metrics
        const now = new Date().toISOString();
        if (data.followers != null) {
            this.db.insertAudienceMetrics({
                platform,
                followers: data.followers || 0,
                following: data.following || 0,
                profile_views: data.profile_views || 0,
                demographics: JSON.stringify(data.demographics || {}),
                active_hours: JSON.stringify(data.active_hours || {}),
                growth_rate: 0, // Calculated later from history
                collected_at: now,
            });
        }
        // Store posts and their metrics
        let postsCollected = 0;
        if (Array.isArray(data.posts)) {
            for (const post of data.posts) {
                const postId = this.db.insertPost({
                    platform,
                    post_type: post.post_type || 'text',
                    content: post.content || '',
                    hashtags: JSON.stringify(this.extractHashtags(post.content || '')),
                    media_urls: '[]',
                    published_at: post.published_at || now,
                    external_id: post.external_id || '',
                    status: 'published',
                });
                this.db.insertPostMetrics({
                    post_id: postId,
                    impressions: post.impressions || 0,
                    reach: post.reach || 0,
                    likes: post.likes || 0,
                    comments: post.comments || 0,
                    shares: post.shares || 0,
                    saves: post.saves || 0,
                    clicks: post.clicks || 0,
                    engagement_rate: this.calculateEngagement(post),
                    collected_at: now,
                });
                postsCollected++;
            }
        }
        // Upsert daily snapshot
        const today = now.split('T')[0];
        const topPostRow = postsCollected > 0 ? data.posts.sort((a, b) => this.calculateEngagement(b) - this.calculateEngagement(a))[0] : null;
        this.db.upsertDailySnapshot({
            platform,
            date: today,
            total_followers: data.followers || 0,
            total_impressions: (data.posts || []).reduce((sum, p) => sum + (p.impressions || 0), 0),
            avg_engagement_rate: postsCollected > 0
                ? (data.posts || []).reduce((sum, p) => sum + this.calculateEngagement(p), 0) / postsCollected
                : 0,
            top_post_id: null, // We could track this but it complicates insert order
        });
        log.info(`[Analytics Collector] ${platform}: ${data.followers || 0} followers, ${postsCollected} posts stored`);
        return { platform, success: true, postsCollected };
    }
    calculateEngagement(post) {
        const interactions = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
        const impressions = post.impressions || post.reach || 0;
        if (impressions === 0)
            return 0;
        return interactions / impressions;
    }
    extractHashtags(text) {
        const matches = text.match(/#\w+/g);
        return matches || [];
    }
    destroy() {
        this.stopSchedule();
    }
}
exports.DataCollector = DataCollector;
//# sourceMappingURL=data-collector.js.map