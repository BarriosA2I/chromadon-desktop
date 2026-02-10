import React from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { RadarCompare } from './charts/RadarCompare'
import { formatPercent, PLATFORM_COLORS } from './charts/chartTheme'

export function CompetitorPanel() {
  const { analyticsData } = useChromadonStore()
  const competitors = analyticsData.competitors

  if (!competitors || competitors.competitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 7 7 7 7" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 17 7 17 7" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </div>
        <div className="text-sm font-medium text-gray-400">No competitors tracked yet</div>
        <div className="text-[11px] text-gray-600 mt-1 font-mono">Add competitors through the data collector</div>
      </div>
    )
  }

  const radarData = ['avgEngagement', 'postFrequency'].map(metric => {
    const point: Record<string, any> = { metric: metric === 'avgEngagement' ? 'Engagement' : 'Post Freq' }
    competitors.comparison.forEach(c => {
      point[c.name] = metric === 'avgEngagement' ? c.avgEngagement * 100 : c.postFrequency
    })
    return point
  })
  const subjects = competitors.comparison.map(c => c.name)

  return (
    <div className="space-y-5">
      {/* Radar Comparison */}
      {subjects.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#8B5CF6]/40 to-transparent" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3 rounded-full bg-[#8B5CF6]" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Competitor Comparison</h3>
          </div>
          <RadarCompare data={radarData} subjects={subjects} />
        </motion.div>
      )}

      {/* Competitor Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#D4AF37]/40 to-transparent" />
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-3 rounded-full bg-[#D4AF37]" />
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Tracked Competitors</h3>
          <span className="text-[10px] text-gray-600 font-mono">({competitors.competitors.length})</span>
        </div>
        <div className="space-y-3">
          {competitors.competitors.map((comp, i) => {
            const avgEng = comp.recentPosts.length > 0
              ? comp.recentPosts.reduce((s, p) => s + p.engagement_rate, 0) / comp.recentPosts.length
              : 0

            return (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-white/[0.04] pb-3"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: `${PLATFORM_COLORS[comp.platform] || '#888'}15`,
                        color: PLATFORM_COLORS[comp.platform] || '#888',
                      }}
                    >
                      {comp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm text-gray-200 font-medium">{comp.name}</span>
                      <span className="text-[11px] text-gray-600 ml-2 font-mono">@{comp.handle}</span>
                    </div>
                  </div>
                  <span
                    className="text-[10px] capitalize px-2 py-0.5 rounded font-mono"
                    style={{
                      color: PLATFORM_COLORS[comp.platform] || '#888',
                      backgroundColor: `${PLATFORM_COLORS[comp.platform] || '#888'}12`,
                    }}
                  >
                    {comp.platform}
                  </span>
                </div>
                <div className="flex gap-4 mt-1.5 text-[11px] text-gray-500 font-mono ml-8">
                  <span>{comp.recentPosts.length} <span className="text-gray-600">posts</span></span>
                  <span className="text-[#00CED1]/50">{formatPercent(avgEng)} <span className="text-gray-600">eng</span></span>
                </div>
                {comp.recentPosts.length > 0 && (
                  <p className="text-[11px] text-gray-500 mt-1 line-clamp-1 ml-8 italic">
                    "{comp.recentPosts[0].content.slice(0, 80)}..."
                  </p>
                )}
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
