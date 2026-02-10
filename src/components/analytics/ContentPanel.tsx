import React from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { DonutChart } from './charts/DonutChart'
import { formatPercent } from './charts/chartTheme'

function SectionHeader({ title, accent }: { title: string; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-3 rounded-full" style={{ backgroundColor: accent || '#00CED1' }} />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{title}</h3>
    </div>
  )
}

export function ContentPanel() {
  const { analyticsData } = useChromadonStore()
  const content = analyticsData.content

  if (!content || content.totalPosts === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00CED1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div className="text-sm font-medium text-gray-400">No content data yet</div>
        <div className="text-[11px] text-gray-600 mt-1 font-mono">Posts will appear after data collection</div>
      </div>
    )
  }

  const donutData = content.postTypeBreakdown.map(t => ({
    name: t.type,
    value: t.count,
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Post Type Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#8B5CF6]/40 to-transparent" />
          <SectionHeader title="Post Type Distribution" accent="#8B5CF6" />
          <DonutChart data={donutData} height={220} />
          <div className="mt-3 space-y-1.5">
            {content.postTypeBreakdown.map(t => (
              <div key={t.type} className="flex justify-between text-[11px]">
                <span className="capitalize text-gray-400 font-medium">{t.type}</span>
                <span className="text-gray-500 font-mono">{t.count} posts <span className="text-[#00CED1]/50">{formatPercent(t.avgEngagement)}</span></span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Hashtags */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
          <SectionHeader title="Top Hashtags" accent="#D4AF37" />
          {content.hashtagPerformance.length === 0 ? (
            <div className="text-[11px] text-gray-600 text-center py-8 font-mono">No hashtag data</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {content.hashtagPerformance.map((h, i) => (
                <div key={h.hashtag} className="flex justify-between items-center text-[11px] group">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 font-mono text-[10px] w-4">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-[#00CED1] font-medium">{h.hashtag}</span>
                  </div>
                  <span className="text-gray-500 font-mono">{h.uses} <span className="text-gray-600">uses</span> <span className="text-[#D4AF37]/50">{formatPercent(h.avgEngagement)}</span></span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Top Posts */}
      {content.topPosts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
          <SectionHeader title={`Top Content`} />
          <div className="text-[10px] text-gray-600 font-mono mb-3 -mt-2">{content.totalPosts} total posts analyzed</div>
          <div className="space-y-2">
            {content.topPosts.map((post, i) => (
              <div key={i} className="flex items-start gap-3 text-xs border-b border-white/[0.04] pb-2">
                <span className="text-gray-600 font-mono text-[10px] mt-0.5 w-4">{String(i + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 capitalize text-[10px] font-mono">{post.platform}</span>
                    <span className="text-gray-600 text-[10px]">{post.post_type}</span>
                  </div>
                  <p className="text-gray-300 line-clamp-1 mt-0.5">{post.content}</p>
                </div>
                <div className="text-gray-500 whitespace-nowrap font-mono text-[11px]">
                  {post.metrics ? (
                    <span className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        {post.metrics.likes}
                      </span>
                      <span className="text-[#00CED1]/60">{formatPercent(post.metrics.engagement_rate)}</span>
                    </span>
                  ) : <span className="text-gray-600">No metrics</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
