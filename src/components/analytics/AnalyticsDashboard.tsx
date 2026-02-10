import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { useAnalytics } from '../../hooks/useAnalytics'
import { DateRangePicker } from './charts/DateRangePicker'
import { PlatformFilter } from './charts/PlatformFilter'
import { OverviewPanel } from './OverviewPanel'
import { PlatformPanel } from './PlatformPanel'
import { ContentPanel } from './ContentPanel'
import { AudiencePanel } from './AudiencePanel'
import { CompetitorPanel } from './CompetitorPanel'
import { SchedulePanel } from './SchedulePanel'
import type { AnalyticsTab, AnalyticsPlatform } from '../../store/analyticsTypes'

const TABS: Array<{ id: AnalyticsTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4' },
  { id: 'platforms', label: 'Platforms', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
  { id: 'content', label: 'Content', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'audience', label: 'Audience', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'competitors', label: 'Competitors', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  { id: 'schedule', label: 'Schedule', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

const TAB_COMPONENTS: Record<AnalyticsTab, React.FC> = {
  overview: OverviewPanel,
  platforms: PlatformPanel,
  content: ContentPanel,
  audience: AudiencePanel,
  competitors: CompetitorPanel,
  schedule: SchedulePanel,
}

export function AnalyticsDashboard() {
  const {
    showAnalyticsDashboard,
    setShowAnalyticsDashboard,
    activeAnalyticsTab,
    setActiveAnalyticsTab,
    selectedPeriod,
    setSelectedPeriod,
    selectedPlatforms,
    setSelectedPlatforms,
    analyticsData,
    analyticsLoading,
    analyticsError,
  } = useChromadonStore()

  const { fetchAnalytics } = useAnalytics()

  if (!showAnalyticsDashboard) return null

  const availablePlatforms = (analyticsData.overview?.platformBreakdown?.map(p => p.platform) || []) as AnalyticsPlatform[]
  const ActivePanel = TAB_COMPONENTS[activeAnalyticsTab]

  return (
    <AnimatePresence>
      <motion.div
        key="analytics-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md"
        onClick={(e) => { if (e.target === e.currentTarget) setShowAnalyticsDashboard(false) }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-6xl max-h-[90vh] mx-4 flex flex-col overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, rgba(10,10,15,0.97), rgba(15,15,25,0.97))',
            borderRadius: '16px',
            border: '1px solid rgba(0,206,209,0.15)',
            boxShadow: '0 0 60px rgba(0,206,209,0.08), 0 0 120px rgba(0,206,209,0.04), 0 25px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-8 h-[1px] bg-gradient-to-r from-[#00CED1] to-transparent" />
          <div className="absolute top-0 left-0 w-[1px] h-8 bg-gradient-to-b from-[#00CED1] to-transparent" />
          <div className="absolute top-0 right-0 w-8 h-[1px] bg-gradient-to-l from-[#00CED1] to-transparent" />
          <div className="absolute top-0 right-0 w-[1px] h-8 bg-gradient-to-b from-[#00CED1] to-transparent" />
          <div className="absolute bottom-0 left-0 w-8 h-[1px] bg-gradient-to-r from-[#D4AF37]/50 to-transparent" />
          <div className="absolute bottom-0 left-0 w-[1px] h-8 bg-gradient-to-t from-[#D4AF37]/50 to-transparent" />
          <div className="absolute bottom-0 right-0 w-8 h-[1px] bg-gradient-to-l from-[#D4AF37]/50 to-transparent" />
          <div className="absolute bottom-0 right-0 w-[1px] h-8 bg-gradient-to-t from-[#D4AF37]/50 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00CED1]/10 border border-[#00CED1]/20 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00CED1" strokeWidth="2">
                  <rect x="3" y="12" width="4" height="9" rx="1" />
                  <rect x="10" y="7" width="4" height="14" rx="1" />
                  <rect x="17" y="3" width="4" height="18" rx="1" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-[#00CED1]">Analytics</h2>
                <div className="text-[10px] text-gray-500 font-mono tracking-widest">SOCIAL MEDIA OVERLORD</div>
              </div>
              {analyticsLoading && (
                <div className="ml-2 w-4 h-4 border-2 border-[#00CED1]/20 border-t-[#00CED1] rounded-full animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-3">
              <PlatformFilter
                available={availablePlatforms}
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
              <DateRangePicker selected={selectedPeriod} onChange={setSelectedPeriod} />
              <button
                onClick={fetchAnalytics}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#00CED1]/10 text-[#00CED1] border border-[#00CED1]/20 hover:bg-[#00CED1]/20 hover:border-[#00CED1]/40 transition-all"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowAnalyticsDashboard(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 px-6 pt-2 pb-0 border-b border-white/[0.04]">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveAnalyticsTab(tab.id)}
                className={`relative px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-2 ${
                  activeAnalyticsTab === tab.id
                    ? 'text-[#00CED1] bg-[#00CED1]/[0.06]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
                {activeAnalyticsTab === tab.id && (
                  <motion.div
                    layoutId="analytics-tab-indicator"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, transparent, #00CED1, transparent)' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {analyticsError && (
              <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/[0.06] border border-red-500/15 text-red-400 text-xs font-mono flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {analyticsError}
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeAnalyticsTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ActivePanel />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer status bar */}
          <div className="px-6 py-2 border-t border-white/[0.04] flex items-center justify-between text-[9px] font-mono text-gray-600 uppercase tracking-widest">
            <span>Chromadon Analytics v1.0</span>
            <span>SQLite Local</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
