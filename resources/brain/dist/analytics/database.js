"use strict";
/**
 * Social Media Analytics - Database Layer
 *
 * Synchronous SQLite via better-sqlite3. All methods return data directly.
 *
 * @author Barrios A2I
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsDatabase = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const schema_1 = require("./schema");
// Lazy-load better-sqlite3 to prevent native module crash from killing the Brain process.
// If the native binding is compiled for a different Node.js ABI (e.g., system Node vs Electron),
// the require() will throw inside the constructor's try/catch instead of crashing on import.
let Database = null;
function getDatabase() {
    if (!Database) {
        Database = require('better-sqlite3');
    }
    return Database;
}
const logger_1 = require("../lib/logger");
const log = (0, logger_1.createChildLogger)('analytics');
// ============================================================================
// DATABASE CLASS
// ============================================================================
class AnalyticsDatabase {
    db;
    constructor(dbPath) {
        const Db = getDatabase();
        const resolvedPath = dbPath || this.getDefaultPath();
        const dir = path.dirname(resolvedPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Db(resolvedPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        (0, schema_1.runMigrations)(this.db);
        log.info(`[Analytics DB] Opened: ${resolvedPath}`);
    }
    getDefaultPath() {
        const appData = process.env.APPDATA || process.env.HOME || '.';
        return path.join(appData, '.chromadon', 'analytics.db');
    }
    close() {
        this.db.close();
    }
    // =========================================================================
    // INSERT METHODS
    // =========================================================================
    insertPost(post) {
        const stmt = this.db.prepare(`
      INSERT INTO posts (platform, post_type, content, hashtags, media_urls, published_at, external_id, status)
      VALUES (@platform, @post_type, @content, @hashtags, @media_urls, @published_at, @external_id, @status)
    `);
        const result = stmt.run(post);
        return result.lastInsertRowid;
    }
    insertPostMetrics(metrics) {
        const stmt = this.db.prepare(`
      INSERT INTO post_metrics (post_id, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate, collected_at)
      VALUES (@post_id, @impressions, @reach, @likes, @comments, @shares, @saves, @clicks, @engagement_rate, @collected_at)
    `);
        const result = stmt.run(metrics);
        return result.lastInsertRowid;
    }
    insertAudienceMetrics(metrics) {
        const stmt = this.db.prepare(`
      INSERT INTO audience_metrics (platform, followers, following, profile_views, demographics, active_hours, growth_rate, collected_at)
      VALUES (@platform, @followers, @following, @profile_views, @demographics, @active_hours, @growth_rate, @collected_at)
    `);
        const result = stmt.run(metrics);
        return result.lastInsertRowid;
    }
    insertCompetitor(competitor) {
        const stmt = this.db.prepare(`
      INSERT INTO competitors (name, platform, handle, profile_url, is_active)
      VALUES (@name, @platform, @handle, @profile_url, @is_active)
    `);
        const result = stmt.run(competitor);
        return result.lastInsertRowid;
    }
    insertCompetitorPost(post) {
        const stmt = this.db.prepare(`
      INSERT INTO competitor_posts (competitor_id, content, likes, comments, shares, engagement_rate, published_at)
      VALUES (@competitor_id, @content, @likes, @comments, @shares, @engagement_rate, @published_at)
    `);
        const result = stmt.run(post);
        return result.lastInsertRowid;
    }
    insertScheduledPost(post) {
        const stmt = this.db.prepare(`
      INSERT INTO scheduled_posts (platform, content, hashtags, scheduled_for, status, post_id)
      VALUES (@platform, @content, @hashtags, @scheduled_for, @status, @post_id)
    `);
        const result = stmt.run(post);
        return result.lastInsertRowid;
    }
    upsertDailySnapshot(snapshot) {
        const stmt = this.db.prepare(`
      INSERT INTO daily_snapshots (platform, date, total_followers, total_impressions, avg_engagement_rate, top_post_id)
      VALUES (@platform, @date, @total_followers, @total_impressions, @avg_engagement_rate, @top_post_id)
      ON CONFLICT(platform, date) DO UPDATE SET
        total_followers = @total_followers,
        total_impressions = @total_impressions,
        avg_engagement_rate = @avg_engagement_rate,
        top_post_id = @top_post_id
    `);
        const result = stmt.run(snapshot);
        return result.lastInsertRowid;
    }
    // =========================================================================
    // QUERY METHODS - Overview
    // =========================================================================
    getOverview(days = 30) {
        const since = this.daysAgo(days);
        // Total followers (latest per platform)
        const followerRows = this.db.prepare(`
      SELECT platform, followers FROM audience_metrics
      WHERE id IN (SELECT MAX(id) FROM audience_metrics GROUP BY platform)
    `).all();
        const totalFollowers = followerRows.reduce((sum, r) => sum + r.followers, 0);
        // Follower change (compare latest to oldest in period)
        const oldFollowerRows = this.db.prepare(`
      SELECT platform, followers FROM audience_metrics
      WHERE collected_at >= ? AND id IN (
        SELECT MIN(id) FROM audience_metrics WHERE collected_at >= ? GROUP BY platform
      )
    `).all(since, since);
        const oldTotal = oldFollowerRows.reduce((sum, r) => sum + r.followers, 0);
        const followerChange = totalFollowers - oldTotal;
        // Total posts in period
        const postCount = this.db.prepare(`
      SELECT COUNT(*) as count FROM posts WHERE published_at >= ?
    `).get(since);
        // Average engagement
        const avgEng = this.db.prepare(`
      SELECT AVG(pm.engagement_rate) as avg FROM post_metrics pm
      JOIN posts p ON pm.post_id = p.id
      WHERE p.published_at >= ?
    `).get(since);
        // Total impressions
        const totalImp = this.db.prepare(`
      SELECT SUM(pm.impressions) as total FROM post_metrics pm
      JOIN posts p ON pm.post_id = p.id
      WHERE p.published_at >= ?
    `).get(since);
        // Top post by engagement
        const topPostRow = this.db.prepare(`
      SELECT p.*, pm.impressions, pm.reach, pm.likes, pm.comments, pm.shares,
             pm.saves, pm.clicks, pm.engagement_rate as metric_engagement_rate, pm.collected_at as metric_collected_at
      FROM posts p
      JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.published_at >= ?
      ORDER BY pm.engagement_rate DESC
      LIMIT 1
    `).get(since);
        let topPost = null;
        if (topPostRow) {
            topPost = {
                id: topPostRow.id,
                platform: topPostRow.platform,
                post_type: topPostRow.post_type,
                content: topPostRow.content,
                hashtags: topPostRow.hashtags,
                media_urls: topPostRow.media_urls,
                published_at: topPostRow.published_at,
                external_id: topPostRow.external_id,
                status: topPostRow.status,
                metrics: {
                    post_id: topPostRow.id,
                    impressions: topPostRow.impressions,
                    reach: topPostRow.reach,
                    likes: topPostRow.likes,
                    comments: topPostRow.comments,
                    shares: topPostRow.shares,
                    saves: topPostRow.saves,
                    clicks: topPostRow.clicks,
                    engagement_rate: topPostRow.metric_engagement_rate,
                    collected_at: topPostRow.metric_collected_at,
                },
            };
        }
        // Platform breakdown
        const platformBreakdown = followerRows.map(fr => {
            const pPosts = this.db.prepare(`
        SELECT COUNT(*) as count FROM posts WHERE platform = ? AND published_at >= ?
      `).get(fr.platform, since);
            const pEng = this.db.prepare(`
        SELECT AVG(pm.engagement_rate) as avg FROM post_metrics pm
        JOIN posts p ON pm.post_id = p.id
        WHERE p.platform = ? AND p.published_at >= ?
      `).get(fr.platform, since);
            return {
                platform: fr.platform,
                followers: fr.followers,
                posts: pPosts.count,
                engagement: pEng.avg || 0,
            };
        });
        // Recent snapshots
        const recentSnapshots = this.db.prepare(`
      SELECT * FROM daily_snapshots WHERE date >= ? ORDER BY date DESC LIMIT 30
    `).all(since);
        return {
            totalFollowers,
            followerChange,
            totalPosts: postCount.count,
            avgEngagement: avgEng.avg || 0,
            totalImpressions: totalImp.total || 0,
            topPost,
            platformBreakdown,
            recentSnapshots,
        };
    }
    // =========================================================================
    // QUERY METHODS - Platform
    // =========================================================================
    getPlatformAnalytics(platform, days = 30) {
        const since = this.daysAgo(days);
        const latestAudience = this.db.prepare(`
      SELECT * FROM audience_metrics WHERE platform = ? ORDER BY collected_at DESC LIMIT 1
    `).get(platform);
        const posts = this.db.prepare(`
      SELECT p.*, pm.impressions, pm.reach, pm.likes, pm.comments, pm.shares,
             pm.saves, pm.clicks, pm.engagement_rate as metric_engagement_rate
      FROM posts p LEFT JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.platform = ? AND p.published_at >= ?
      ORDER BY p.published_at DESC
    `).all(platform, since);
        const mapped = posts.map(r => ({
            ...this.extractPost(r),
            metrics: r.impressions != null ? this.extractMetrics(r) : undefined,
        }));
        const withMetrics = mapped.filter(p => p.metrics);
        const sorted = [...withMetrics].sort((a, b) => (b.metrics?.engagement_rate || 0) - (a.metrics?.engagement_rate || 0));
        const audienceHistory = this.db.prepare(`
      SELECT * FROM audience_metrics WHERE platform = ? AND collected_at >= ? ORDER BY collected_at ASC
    `).all(platform, since);
        return {
            platform,
            followers: latestAudience?.followers || 0,
            following: latestAudience?.following || 0,
            growthRate: latestAudience?.growth_rate || 0,
            posts: mapped,
            topPosts: sorted.slice(0, 5),
            worstPosts: sorted.slice(-5).reverse(),
            audienceHistory,
        };
    }
    // =========================================================================
    // QUERY METHODS - Content
    // =========================================================================
    getContentAnalytics(platform, days = 30, postType) {
        const since = this.daysAgo(days);
        const params = [since];
        let platformClause = '';
        let typeClause = '';
        if (platform) {
            platformClause = ' AND p.platform = ?';
            params.push(platform);
        }
        if (postType) {
            typeClause = ' AND p.post_type = ?';
            params.push(postType);
        }
        // Post type breakdown
        const typeRows = this.db.prepare(`
      SELECT p.post_type as type, COUNT(*) as count, AVG(pm.engagement_rate) as avgEngagement
      FROM posts p LEFT JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.published_at >= ?${platformClause}${typeClause}
      GROUP BY p.post_type
    `).all(...params);
        // Hashtag performance - extract from JSON arrays
        const allPosts = this.db.prepare(`
      SELECT p.hashtags, pm.engagement_rate FROM posts p
      LEFT JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.published_at >= ?${platformClause}${typeClause}
    `).all(...params);
        const hashtagMap = new Map();
        for (const row of allPosts) {
            try {
                const tags = JSON.parse(row.hashtags);
                for (const tag of tags) {
                    const existing = hashtagMap.get(tag) || { uses: 0, totalEng: 0 };
                    existing.uses++;
                    existing.totalEng += row.engagement_rate || 0;
                    hashtagMap.set(tag, existing);
                }
            }
            catch { /* skip bad JSON */ }
        }
        const hashtagPerformance = Array.from(hashtagMap.entries())
            .map(([hashtag, data]) => ({
            hashtag,
            uses: data.uses,
            avgEngagement: data.uses > 0 ? data.totalEng / data.uses : 0,
        }))
            .sort((a, b) => b.avgEngagement - a.avgEngagement)
            .slice(0, 20);
        // Top posts
        const topPosts = this.db.prepare(`
      SELECT p.*, pm.impressions, pm.reach, pm.likes, pm.comments, pm.shares,
             pm.saves, pm.clicks, pm.engagement_rate as metric_engagement_rate
      FROM posts p JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.published_at >= ?${platformClause}${typeClause}
      ORDER BY pm.engagement_rate DESC
      LIMIT 10
    `).all(...params);
        const totalPosts = this.db.prepare(`
      SELECT COUNT(*) as count FROM posts p WHERE p.published_at >= ?${platformClause}${typeClause}
    `).get(...params);
        return {
            postTypeBreakdown: typeRows.map(r => ({
                type: r.type,
                count: r.count,
                avgEngagement: r.avgEngagement || 0,
            })),
            hashtagPerformance,
            topPosts: topPosts.map(r => ({
                ...this.extractPost(r),
                metrics: this.extractMetrics(r),
            })),
            totalPosts: totalPosts.count,
        };
    }
    // =========================================================================
    // QUERY METHODS - Audience
    // =========================================================================
    getAudienceHistory(platform, days = 30) {
        const since = this.daysAgo(days);
        const current = this.db.prepare(`
      SELECT * FROM audience_metrics WHERE platform = ? ORDER BY collected_at DESC LIMIT 1
    `).get(platform);
        const history = this.db.prepare(`
      SELECT * FROM audience_metrics WHERE platform = ? AND collected_at >= ? ORDER BY collected_at ASC
    `).all(platform, since);
        const growthTrend = history.map(h => ({
            date: h.collected_at,
            followers: h.followers,
        }));
        return { current: current || null, history, growthTrend };
    }
    // =========================================================================
    // QUERY METHODS - Competitors
    // =========================================================================
    getCompetitorAnalytics(platform, competitorId) {
        let competitors;
        if (competitorId) {
            competitors = this.db.prepare(`SELECT * FROM competitors WHERE id = ? AND is_active = 1`).all(competitorId);
        }
        else if (platform) {
            competitors = this.db.prepare(`SELECT * FROM competitors WHERE platform = ? AND is_active = 1`).all(platform);
        }
        else {
            competitors = this.db.prepare(`SELECT * FROM competitors WHERE is_active = 1`).all();
        }
        const enriched = competitors.map(c => {
            const recentPosts = this.db.prepare(`
        SELECT * FROM competitor_posts WHERE competitor_id = ? ORDER BY published_at DESC LIMIT 10
      `).all(c.id);
            return { ...c, recentPosts };
        });
        const comparison = enriched.map(c => {
            const avgEng = c.recentPosts.length > 0
                ? c.recentPosts.reduce((sum, p) => sum + p.engagement_rate, 0) / c.recentPosts.length
                : 0;
            return {
                name: c.name,
                followers: 0, // Would need separate scraping
                avgEngagement: avgEng,
                postFrequency: c.recentPosts.length,
            };
        });
        return { competitors: enriched, comparison };
    }
    // =========================================================================
    // QUERY METHODS - Timing
    // =========================================================================
    getTimingHeatmap(platform) {
        // Build 7x24 heatmap from post engagement by day-of-week and hour
        const rows = this.db.prepare(`
      SELECT
        CAST(strftime('%w', p.published_at) AS INTEGER) as day,
        CAST(strftime('%H', p.published_at) AS INTEGER) as hour,
        AVG(pm.engagement_rate) as avg_engagement,
        COUNT(*) as post_count
      FROM posts p
      JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.platform = ?
      GROUP BY day, hour
    `).all(platform);
        // Initialize 7x24 grid
        const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
        const entries = [];
        for (const row of rows) {
            heatmap[row.day][row.hour] = row.avg_engagement;
            entries.push({ day: row.day, hour: row.hour, engagement: row.avg_engagement });
        }
        const sorted = [...entries].sort((a, b) => b.engagement - a.engagement);
        return {
            heatmap,
            bestTimes: sorted.slice(0, 5),
            worstTimes: sorted.slice(-5).reverse(),
        };
    }
    // =========================================================================
    // QUERY METHODS - ROI
    // =========================================================================
    getROIAnalytics(days = 30) {
        // ROI data would come from ad spend tracking; for now return engagement-based proxy
        const since = this.daysAgo(days);
        const platformEngagement = this.db.prepare(`
      SELECT p.platform,
             SUM(pm.likes + pm.comments + pm.shares + pm.saves + pm.clicks) as total_engagements,
             COUNT(DISTINCT p.id) as post_count
      FROM posts p JOIN post_metrics pm ON pm.post_id = p.id
      WHERE p.published_at >= ?
      GROUP BY p.platform
    `).all(since);
        const totalEngagements = platformEngagement.reduce((sum, r) => sum + r.total_engagements, 0);
        return {
            totalSpend: 0, // No spend tracking yet
            totalEngagements,
            costPerEngagement: 0,
            costPerFollower: 0,
            platformROI: platformEngagement.map(r => ({
                platform: r.platform,
                spend: 0,
                engagements: r.total_engagements,
                roi: 0,
            })),
        };
    }
    // =========================================================================
    // QUERY METHODS - Scheduled Posts
    // =========================================================================
    getScheduledPosts(platform) {
        if (platform) {
            return this.db.prepare(`
        SELECT * FROM scheduled_posts WHERE platform = ? AND status = 'pending' ORDER BY scheduled_for ASC
      `).all(platform);
        }
        return this.db.prepare(`
      SELECT * FROM scheduled_posts WHERE status = 'pending' ORDER BY scheduled_for ASC
    `).all();
    }
    updateScheduledPostStatus(id, status, postId) {
        if (postId) {
            this.db.prepare(`UPDATE scheduled_posts SET status = ?, post_id = ? WHERE id = ?`).run(status, postId, id);
        }
        else {
            this.db.prepare(`UPDATE scheduled_posts SET status = ? WHERE id = ?`).run(status, id);
        }
    }
    // =========================================================================
    // LEAD MANAGEMENT (v1.4.0)
    // =========================================================================
    insertLead(lead) {
        const stmt = this.db.prepare(`
      INSERT INTO leads (name, platform, handle, interest, source, notes, status)
      VALUES (@name, @platform, @handle, @interest, @source, @notes, @status)
    `);
        return stmt.run(lead).lastInsertRowid;
    }
    getLeads(status, platform) {
        let sql = 'SELECT * FROM leads WHERE 1=1';
        const params = [];
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }
        sql += ' ORDER BY created_at DESC';
        return this.db.prepare(sql).all(...params);
    }
    updateLeadStatus(id, status, notes) {
        if (notes) {
            this.db.prepare('UPDATE leads SET status = ?, notes = ? WHERE id = ?').run(status, notes, id);
        }
        else {
            this.db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
        }
    }
    // =========================================================================
    // CAMPAIGN MANAGEMENT (v1.4.0)
    // =========================================================================
    insertCampaign(campaign) {
        const stmt = this.db.prepare(`
      INSERT INTO campaigns (name, description, platforms, start_date, end_date, status)
      VALUES (@name, @description, @platforms, @start_date, @end_date, @status)
    `);
        return stmt.run(campaign).lastInsertRowid;
    }
    getCampaigns(status) {
        if (status) {
            return this.db.prepare('SELECT * FROM campaigns WHERE status = ? ORDER BY created_at DESC').all(status);
        }
        return this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
    }
    getCampaignWithPosts(campaignId) {
        const campaign = this.db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
        if (!campaign)
            return null;
        const posts = this.db.prepare(`
      SELECT p.*, pm.impressions, pm.reach, pm.likes, pm.comments, pm.shares,
             pm.saves, pm.clicks, pm.engagement_rate as metric_engagement_rate
      FROM campaign_posts cp
      JOIN posts p ON cp.post_id = p.id
      LEFT JOIN post_metrics pm ON pm.post_id = p.id
      WHERE cp.campaign_id = ?
      ORDER BY p.published_at DESC
    `).all(campaignId);
        return {
            campaign,
            posts: posts.map(r => ({
                ...this.extractPost(r),
                metrics: r.impressions != null ? this.extractMetrics(r) : undefined,
            })),
        };
    }
    linkPostToCampaign(campaignId, postId) {
        this.db.prepare('INSERT OR IGNORE INTO campaign_posts (campaign_id, post_id) VALUES (?, ?)').run(campaignId, postId);
    }
    updateCampaignStatus(id, status) {
        this.db.prepare('UPDATE campaigns SET status = ? WHERE id = ?').run(status, id);
    }
    // =========================================================================
    // AUTO-REPLY RULES (v1.4.0)
    // =========================================================================
    insertAutoReplyRule(rule) {
        const stmt = this.db.prepare(`
      INSERT INTO auto_reply_rules (platform, trigger_type, trigger_value, reply_template, is_active)
      VALUES (@platform, @trigger_type, @trigger_value, @reply_template, @is_active)
    `);
        return stmt.run(rule).lastInsertRowid;
    }
    getAutoReplyRules(platform, activeOnly) {
        let sql = 'SELECT * FROM auto_reply_rules WHERE 1=1';
        const params = [];
        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }
        if (activeOnly) {
            sql += ' AND is_active = 1';
        }
        sql += ' ORDER BY created_at DESC';
        return this.db.prepare(sql).all(...params);
    }
    deleteAutoReplyRule(id) {
        this.db.prepare('DELETE FROM auto_reply_rules WHERE id = ?').run(id);
    }
    incrementRuleUses(id) {
        this.db.prepare('UPDATE auto_reply_rules SET uses = uses + 1 WHERE id = ?').run(id);
    }
    // =========================================================================
    // COMPETITOR UPDATE (v1.4.0)
    // =========================================================================
    deactivateCompetitor(id) {
        this.db.prepare('UPDATE competitors SET is_active = 0 WHERE id = ?').run(id);
    }
    // =========================================================================
    // MONITORING (v1.7.0)
    // =========================================================================
    insertMonitoringLog(entry) {
        const stmt = this.db.prepare(`
      INSERT INTO monitoring_log (platform, action_type, comment_author, comment_text, reply_text, rule_id)
      VALUES (@platform, @action_type, @comment_author, @comment_text, @reply_text, @rule_id)
    `);
        return stmt.run({
            platform: entry.platform,
            action_type: entry.action_type,
            comment_author: entry.comment_author || null,
            comment_text: entry.comment_text || null,
            reply_text: entry.reply_text || null,
            rule_id: entry.rule_id || null,
        }).lastInsertRowid;
    }
    getMonitoringLog(platform, limit = 20) {
        let sql = 'SELECT * FROM monitoring_log WHERE 1=1';
        const params = [];
        if (platform) {
            sql += ' AND platform = ?';
            params.push(platform);
        }
        sql += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        try {
            return this.db.prepare(sql).all(...params);
        }
        catch {
            return []; // Table might not exist yet
        }
    }
    getMonitoringConfig() {
        try {
            const row = this.db.prepare('SELECT * FROM monitoring_config WHERE id = 1').get();
            if (!row)
                return null;
            return {
                enabled: !!row.enabled,
                interval_minutes: row.interval_minutes,
                platforms: JSON.parse(row.platforms),
                max_replies_per_cycle: row.max_replies_per_cycle,
            };
        }
        catch {
            return null; // Table might not exist yet
        }
    }
    setMonitoringConfig(config) {
        const sets = [];
        const params = {};
        if (config.enabled !== undefined) {
            sets.push('enabled = @enabled');
            params.enabled = config.enabled ? 1 : 0;
        }
        if (config.interval_minutes) {
            sets.push('interval_minutes = @interval_minutes');
            params.interval_minutes = config.interval_minutes;
        }
        if (config.platforms) {
            sets.push('platforms = @platforms');
            params.platforms = JSON.stringify(config.platforms);
        }
        if (config.max_replies_per_cycle) {
            sets.push('max_replies_per_cycle = @max_replies_per_cycle');
            params.max_replies_per_cycle = config.max_replies_per_cycle;
        }
        if (sets.length === 0)
            return;
        sets.push("updated_at = datetime('now')");
        try {
            this.db.prepare(`UPDATE monitoring_config SET ${sets.join(', ')} WHERE id = 1`).run(params);
        }
        catch { /* Table might not exist yet */ }
    }
    // =========================================================================
    // HELPERS
    // =========================================================================
    daysAgo(days) {
        const d = new Date();
        d.setDate(d.getDate() - days);
        return d.toISOString();
    }
    extractPost(row) {
        return {
            id: row.id,
            platform: row.platform,
            post_type: row.post_type,
            content: row.content,
            hashtags: row.hashtags,
            media_urls: row.media_urls,
            published_at: row.published_at,
            external_id: row.external_id,
            status: row.status,
        };
    }
    extractMetrics(row) {
        return {
            post_id: row.id || row.post_id,
            impressions: row.impressions || 0,
            reach: row.reach || 0,
            likes: row.likes || 0,
            comments: row.comments || 0,
            shares: row.shares || 0,
            saves: row.saves || 0,
            clicks: row.clicks || 0,
            engagement_rate: row.metric_engagement_rate || row.engagement_rate || 0,
            collected_at: row.metric_collected_at || row.collected_at || '',
        };
    }
}
exports.AnalyticsDatabase = AnalyticsDatabase;
//# sourceMappingURL=database.js.map