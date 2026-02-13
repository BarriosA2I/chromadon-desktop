/**
 * Social Media Analytics - TypeScript Interfaces
 *
 * @author Barrios A2I
 */
export interface Post {
    id?: number;
    platform: string;
    post_type: string;
    content: string;
    hashtags: string;
    media_urls: string;
    published_at: string;
    external_id: string;
    status: 'draft' | 'published' | 'scheduled' | 'failed';
}
export interface PostMetrics {
    id?: number;
    post_id: number;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    engagement_rate: number;
    collected_at: string;
}
export interface AudienceMetrics {
    id?: number;
    platform: string;
    followers: number;
    following: number;
    profile_views: number;
    demographics: string;
    active_hours: string;
    growth_rate: number;
    collected_at: string;
}
export interface Competitor {
    id?: number;
    name: string;
    platform: string;
    handle: string;
    profile_url: string;
    is_active: number;
}
export interface CompetitorPost {
    id?: number;
    competitor_id: number;
    content: string;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
    published_at: string;
}
export interface ScheduledPost {
    id?: number;
    platform: string;
    content: string;
    hashtags: string;
    scheduled_for: string;
    status: 'pending' | 'published' | 'failed' | 'cancelled';
    post_id: number | null;
}
export interface DailySnapshot {
    id?: number;
    platform: string;
    date: string;
    total_followers: number;
    total_impressions: number;
    avg_engagement_rate: number;
    top_post_id: number | null;
}
export interface OverviewData {
    totalFollowers: number;
    followerChange: number;
    totalPosts: number;
    avgEngagement: number;
    totalImpressions: number;
    topPost: (Post & {
        metrics?: PostMetrics;
    }) | null;
    platformBreakdown: Array<{
        platform: string;
        followers: number;
        posts: number;
        engagement: number;
    }>;
    recentSnapshots: DailySnapshot[];
}
export interface PlatformData {
    platform: string;
    followers: number;
    following: number;
    growthRate: number;
    posts: Array<Post & {
        metrics?: PostMetrics;
    }>;
    topPosts: Array<Post & {
        metrics?: PostMetrics;
    }>;
    worstPosts: Array<Post & {
        metrics?: PostMetrics;
    }>;
    audienceHistory: AudienceMetrics[];
}
export interface ContentData {
    postTypeBreakdown: Array<{
        type: string;
        count: number;
        avgEngagement: number;
    }>;
    hashtagPerformance: Array<{
        hashtag: string;
        uses: number;
        avgEngagement: number;
    }>;
    topPosts: Array<Post & {
        metrics?: PostMetrics;
    }>;
    totalPosts: number;
}
export interface AudienceData {
    current: AudienceMetrics | null;
    history: AudienceMetrics[];
    growthTrend: Array<{
        date: string;
        followers: number;
    }>;
}
export interface CompetitorData {
    competitors: Array<Competitor & {
        recentPosts: CompetitorPost[];
    }>;
    comparison: Array<{
        name: string;
        followers: number;
        avgEngagement: number;
        postFrequency: number;
    }>;
}
export interface TimingData {
    heatmap: number[][];
    bestTimes: Array<{
        day: number;
        hour: number;
        engagement: number;
    }>;
    worstTimes: Array<{
        day: number;
        hour: number;
        engagement: number;
    }>;
}
export interface ROIData {
    totalSpend: number;
    totalEngagements: number;
    costPerEngagement: number;
    costPerFollower: number;
    platformROI: Array<{
        platform: string;
        spend: number;
        engagements: number;
        roi: number;
    }>;
}
export type SupportedPlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube' | 'tiktok';
//# sourceMappingURL=types.d.ts.map