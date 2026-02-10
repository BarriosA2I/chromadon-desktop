import React from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { PLATFORM_COLORS } from './charts/chartTheme'

export function SchedulePanel() {
  const { analyticsData } = useChromadonStore()
  const scheduled = analyticsData.schedule

  if (!scheduled || scheduled.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <div className="w-14 h-14 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00CED1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
          </svg>
        </div>
        <div className="text-sm font-medium text-gray-400">No scheduled posts</div>
        <div className="text-[11px] text-gray-600 mt-1 font-mono">Schedule posts through the Social Media Overlord</div>
      </div>
    )
  }

  // Group by date
  const grouped = new Map<string, typeof scheduled>()
  for (const post of scheduled) {
    const date = post.scheduled_for.split('T')[0]
    if (!grouped.has(date)) grouped.set(date, [])
    grouped.get(date)!.push(post)
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: '#D4AF37',
    published: '#10B981',
    failed: '#EF4444',
    cancelled: '#6B7280',
  }

  const STATUS_ICONS: Record<string, string> = {
    pending: 'M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.49 8.49l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.49-8.49l2.83-2.83',
    published: 'M20 6L9 17l-5-5',
    failed: 'M18 6L6 18M6 6l12 12',
    cancelled: 'M12 2a10 10 0 100 20 10 10 0 000-20zM4.93 4.93l14.14 14.14',
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([date, posts], gi) => (
        <motion.div
          key={date}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: gi * 0.08 }}
          className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-3 rounded-full bg-[#00CED1]" />
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'short', day: 'numeric',
              })}
            </div>
            <span className="text-[10px] text-gray-600 font-mono">{posts.length} post{posts.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {posts.map((post, pi) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: gi * 0.08 + pi * 0.04 }}
                className="flex items-start gap-3 text-xs border-b border-white/[0.04] pb-2 last:border-0"
              >
                <div className="flex flex-col items-center gap-1 w-12 pt-0.5">
                  <span className="text-gray-400 font-mono text-[11px]">
                    {new Date(post.scheduled_for).toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    stroke={STATUS_COLORS[post.status] || '#666'}
                  >
                    <path d={STATUS_ICONS[post.status] || STATUS_ICONS.pending} />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="capitalize text-[10px] px-1.5 py-0.5 rounded font-semibold"
                      style={{
                        color: PLATFORM_COLORS[post.platform] || '#888',
                        backgroundColor: `${PLATFORM_COLORS[post.platform] || '#888'}12`,
                      }}
                    >
                      {post.platform}
                    </span>
                    <span
                      className="text-[10px] capitalize font-mono"
                      style={{ color: STATUS_COLORS[post.status] || '#666' }}
                    >
                      {post.status}
                    </span>
                  </div>
                  <p className="text-gray-300 mt-1 line-clamp-2 leading-relaxed">{post.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
