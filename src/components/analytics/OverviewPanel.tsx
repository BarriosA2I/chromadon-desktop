import React from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { MetricCard } from './charts/MetricCard'
import { TrendChart } from './charts/TrendChart'
import { PLATFORM_COLORS, formatPercent } from './charts/chartTheme'

function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 rounded-full bg-[#00CED1]" />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</h3>
      {count && <span className="text-[10px] text-gray-600 font-mono">({count})</span>}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00CED1" strokeWidth="1.5" opacity="0.6">
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
      </div>
      <div className="text-sm font-medium text-gray-400">No analytics data yet</div>
      <div className="text-[11px] text-gray-600 mt-1 font-mono">Run data collection to start tracking</div>
    </div>
  )
}

export function OverviewPanel() {
  const { analyticsData } = useChromadonStore()
  const overview = analyticsData.overview

  if (!overview) return <EmptyState />

  const sparkData = overview.recentSnapshots
    .map(s => ({ value: s.total_followers }))
    .reverse()

  return (
    <div className="space-y-5">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Followers" value={overview.totalFollowers} change={overview.followerChange} index={0} />
        <MetricCard label="Total Posts" value={overview.totalPosts} color="#D4AF37" index={1} />
        <MetricCard label="Avg Engagement" value={overview.avgEngagement} format="percent" color="#8B5CF6" index={2} />
        <MetricCard label="Impressions" value={overview.totalImpressions} sparkData={sparkData} color="#10B981" index={3} />
      </div>

      {/* Platform Breakdown */}
      {overview.platformBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
          <SectionHeader title="Platform Breakdown" />
          <div className="space-y-2.5">
            {overview.platformBreakdown.map(p => (
              <div key={p.platform} className="flex items-center justify-between text-sm group">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-full ring-2 ring-opacity-20"
                    style={{ backgroundColor: PLATFORM_COLORS[p.platform] || '#888', '--tw-ring-color': PLATFORM_COLORS[p.platform] || '#888' } as React.CSSProperties}
                  />
                  <span className="text-gray-300 capitalize text-xs font-medium">{p.platform}</span>
                </div>
                <div className="flex gap-4 text-gray-500 text-[11px] font-mono">
                  <span>{p.followers.toLocaleString()} <span className="text-gray-600">flw</span></span>
                  <span>{p.posts} <span className="text-gray-600">posts</span></span>
                  <span className="text-[#00CED1]/60">{formatPercent(p.engagement)}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Top Post */}
      {overview.topPost && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
          <SectionHeader title="Top Performing Post" />
          <div className="text-[10px] text-gray-500 capitalize font-mono mb-1">{overview.topPost.platform}</div>
          <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{overview.topPost.content}</p>
          {overview.topPost.metrics && (
            <div className="flex gap-4 mt-3 text-[11px] text-gray-500 font-mono">
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                {overview.topPost.metrics.likes}
              </span>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {overview.topPost.metrics.comments}
              </span>
              <span className="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                {overview.topPost.metrics.shares}
              </span>
              <span className="flex items-center gap-1 text-[#00CED1]/60">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                {formatPercent(overview.topPost.metrics.engagement_rate)}
              </span>
            </div>
          )}
        </motion.div>
      )}

      {/* Follower Trend */}
      {overview.recentSnapshots.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#8B5CF6]/40 to-transparent" />
          <SectionHeader title="Follower Trend" />
          <TrendChart
            data={overview.recentSnapshots.map(s => ({
              date: s.date,
              followers: s.total_followers,
              engagement: s.avg_engagement_rate,
            })).reverse()}
            lines={[
              { dataKey: 'followers', name: 'Followers' },
              { dataKey: 'engagement', name: 'Engagement', color: '#D4AF37' },
            ]}
            height={200}
          />
        </motion.div>
      )}

      {/* Trinity Market Intelligence */}
      <TrinityInsightsSection />
    </div>
  )
}

function TrinityInsightsSection() {
  const { analyticsData } = useChromadonStore()
  const trinity = analyticsData.trinity
  const hasTrends = trinity?.trends && trinity.trends.length > 0
  const hasAudience = trinity?.audienceProfile?.usps?.length || trinity?.audienceProfile?.targetAudiences?.length

  if (!hasTrends && !hasAudience) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="relative rounded-xl border border-[#00CED1]/10 bg-[#00CED1]/[0.03] p-4 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
        <SectionHeader title="Market Intelligence" />
        <p className="text-[11px] text-gray-500 font-mono">
          Research industry sites in the AI chat to unlock market intelligence.
          Try: "Learn everything about [competitor-site].com"
        </p>
        <div className="text-[10px] text-[#00CED1]/40 mt-2 font-mono">Powered by Trinity Intelligence</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="relative rounded-xl border border-[#00CED1]/10 bg-[#00CED1]/[0.03] p-4 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
      <SectionHeader title="Market Intelligence" />

      {hasTrends && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00CED1]/60 mb-1.5">Trending in Your Industry</div>
          <div className="space-y-1">
            {trinity!.trends.slice(0, 3).map((trend, i) => (
              <div key={i} className="text-[11px] text-gray-400 line-clamp-2 pl-2 border-l border-[#00CED1]/20">
                {trend.length > 150 ? trend.substring(0, 150) + '...' : trend}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasAudience && trinity?.audienceProfile && (
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/60 mb-1.5">Your Positioning</div>
          <div className="flex flex-wrap gap-1.5">
            {trinity.audienceProfile.usps?.slice(0, 4).map((usp, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-[#D4AF37]/20 text-[#D4AF37]/70 font-mono">
                {typeof usp === 'string' ? usp : String(usp)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="text-[10px] text-[#00CED1]/40 mt-3 font-mono">Powered by Trinity Intelligence</div>
    </motion.div>
  )
}
