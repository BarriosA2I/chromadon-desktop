/**
 * Social Media Analytics - Database Layer
 *
 * Synchronous SQLite via better-sqlite3. All methods return data directly.
 *
 * @author Barrios A2I
 */
import type { Post, PostMetrics, AudienceMetrics, Competitor, CompetitorPost, ScheduledPost, DailySnapshot, OverviewData, PlatformData, ContentData, AudienceData, CompetitorData, TimingData, ROIData } from './types';
export declare class AnalyticsDatabase {
    private db;
    constructor(dbPath?: string);
    private getDefaultPath;
    close(): void;
    insertPost(post: Omit<Post, 'id'>): number;
    insertPostMetrics(metrics: Omit<PostMetrics, 'id'>): number;
    insertAudienceMetrics(metrics: Omit<AudienceMetrics, 'id'>): number;
    insertCompetitor(competitor: Omit<Competitor, 'id'>): number;
    insertCompetitorPost(post: Omit<CompetitorPost, 'id'>): number;
    insertScheduledPost(post: Omit<ScheduledPost, 'id'>): number;
    upsertDailySnapshot(snapshot: Omit<DailySnapshot, 'id'>): number;
    getOverview(days?: number): OverviewData;
    getPlatformAnalytics(platform: string, days?: number): PlatformData;
    getContentAnalytics(platform?: string, days?: number, postType?: string): ContentData;
    getAudienceHistory(platform: string, days?: number): AudienceData;
    getCompetitorAnalytics(platform?: string, competitorId?: number): CompetitorData;
    getTimingHeatmap(platform: string): TimingData;
    getROIAnalytics(days?: number): ROIData;
    getScheduledPosts(platform?: string): ScheduledPost[];
    updateScheduledPostStatus(id: number, status: string, postId?: number): void;
    private daysAgo;
    private extractPost;
    private extractMetrics;
}
//# sourceMappingURL=database.d.ts.map