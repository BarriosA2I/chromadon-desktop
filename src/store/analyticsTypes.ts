/**
 * Analytics Dashboard - Frontend Type Definitions
 *
 * @author Barrios A2I
 */

export type AnalyticsPeriod = '24h' | '7d' | '30d' | '90d'
export type AnalyticsTab = 'overview' | 'platforms' | 'content' | 'audience' | 'competitors' | 'schedule'
export type AnalyticsPlatform = 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'youtube' | 'tiktok'

export interface PostMetrics {
  post_id: number
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  clicks: number
  engagement_rate: number
  collected_at: string
}

export interface Post {
  id: number
  platform: string
  post_type: string
  content: string
  hashtags: string
  media_urls: string
  published_at: string
  external_id: string
  status: string
  metrics?: PostMetrics
}

export interface AudienceMetrics {
  id: number
  platform: string
  followers: number
  following: number
  profile_views: number
  demographics: string
  active_hours: string
  growth_rate: number
  collected_at: string
}

export interface DailySnapshot {
  id: number
  platform: string
  date: string
  total_followers: number
  total_impressions: number
  avg_engagement_rate: number
  top_post_id: number | null
}

export interface OverviewData {
  totalFollowers: number
  followerChange: number
  totalPosts: number
  avgEngagement: number
  totalImpressions: number
  topPost: Post | null
  platformBreakdown: Array<{
    platform: string
    followers: number
    posts: number
    engagement: number
  }>
  recentSnapshots: DailySnapshot[]
}

export interface PlatformData {
  platform: string
  followers: number
  following: number
  growthRate: number
  posts: Post[]
  topPosts: Post[]
  worstPosts: Post[]
  audienceHistory: AudienceMetrics[]
}

export interface ContentData {
  postTypeBreakdown: Array<{ type: string; count: number; avgEngagement: number }>
  hashtagPerformance: Array<{ hashtag: string; uses: number; avgEngagement: number }>
  topPosts: Post[]
  totalPosts: number
}

export interface AudienceData {
  current: AudienceMetrics | null
  history: AudienceMetrics[]
  growthTrend: Array<{ date: string; followers: number }>
}

export interface CompetitorData {
  competitors: Array<{
    id: number
    name: string
    platform: string
    handle: string
    recentPosts: Array<{
      content: string
      likes: number
      comments: number
      shares: number
      engagement_rate: number
      published_at: string
    }>
  }>
  comparison: Array<{
    name: string
    followers: number
    avgEngagement: number
    postFrequency: number
  }>
}

export interface TimingData {
  heatmap: number[][]
  bestTimes: Array<{ day: number; hour: number; engagement: number }>
  worstTimes: Array<{ day: number; hour: number; engagement: number }>
}

export interface ScheduledPost {
  id: number
  platform: string
  content: string
  hashtags: string
  scheduled_for: string
  status: string
  post_id: number | null
}

export interface TrinityData {
  trends: string[]
  audienceProfile: {
    industry: string
    targetAudiences: Array<{ name: string; demographics: string }>
    brandVoice: { tone: string[]; personality: string[]; formality: string }
    products: any[]
    services: any[]
    usps: string[]
    vaultInsights: string[]
  } | null
  competitorInsights: string[]
}

export interface AnalyticsState {
  overview: OverviewData | null
  platforms: Record<string, PlatformData>
  content: ContentData | null
  audience: Record<string, AudienceData>
  competitors: CompetitorData | null
  schedule: ScheduledPost[]
  trinity: TrinityData | null
}
