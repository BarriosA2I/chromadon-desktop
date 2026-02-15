import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../../store/chromadonStore'
import { GrowthChart } from './charts/GrowthChart'
import { HeatmapGrid } from './charts/HeatmapGrid'
import { MetricCard } from './charts/MetricCard'
import { PLATFORM_COLORS } from './charts/chartTheme'
import type { AnalyticsPlatform } from '../../store/analyticsTypes'

const PLATFORMS: AnalyticsPlatform[] = ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok']

const PLATFORM_ICONS: Record<string, string> = {
  twitter: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
  linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z',
  instagram: 'M17.5 6.5H17.51M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm9 9a4 4 0 11-8 0 4 4 0 018 0z',
  facebook: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
  youtube: 'M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.35 29 29 0 00-.46-5.33zM9.75 15.02V8.48l5.75 3.27-5.75 3.27z',
  tiktok: 'M9 12a4 4 0 104 4V4a5 5 0 005 5',
}

export function AudiencePanel() {
  const { analyticsData } = useChromadonStore()
  const [selectedPlatform, setSelectedPlatform] = useState<AnalyticsPlatform>('twitter')
  const audience = analyticsData.audience[selectedPlatform]

  return (
    <div className="space-y-4">
      {/* Platform Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {PLATFORMS.map(p => {
          const isSelected = selectedPlatform === p
          return (
            <button
              key={p}
              onClick={() => setSelectedPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border capitalize flex items-center gap-1.5 ${
                isSelected
                  ? 'border-opacity-40'
                  : 'border-white/[0.06] text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]'
              }`}
              style={isSelected ? {
                borderColor: PLATFORM_COLORS[p],
                backgroundColor: `${PLATFORM_COLORS[p]}12`,
                color: PLATFORM_COLORS[p],
                boxShadow: `0 0 12px ${PLATFORM_COLORS[p]}15`,
              } : undefined}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={PLATFORM_ICONS[p] || ''} />
              </svg>
              {p}
            </button>
          )
        })}
      </div>

      {!audience || !audience.current ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-500">
          <div className="w-12 h-12 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={PLATFORM_COLORS[selectedPlatform] || '#666'} strokeWidth="1.5" opacity="0.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-400">No audience data for {selectedPlatform}</div>
          <div className="text-[11px] text-gray-600 mt-1 font-mono">Run data collection for this platform</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Followers" value={audience.current.followers} color={PLATFORM_COLORS[selectedPlatform]} index={0} />
            <MetricCard label="Following" value={audience.current.following} index={1} />
            <MetricCard label="Profile Views" value={audience.current.profile_views} color="#D4AF37" index={2} />
            <MetricCard label="Growth Rate" value={audience.current.growth_rate} format="percent" color="#10B981" index={3} />
          </div>

          {audience.growthTrend.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-6 h-[1px]" style={{ background: `linear-gradient(90deg, ${PLATFORM_COLORS[selectedPlatform]}60, transparent)` }} />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[selectedPlatform] }} />
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Follower Growth</h3>
              </div>
              <GrowthChart data={audience.growthTrend} color={PLATFORM_COLORS[selectedPlatform]} />
            </motion.div>
          )}
        </>
      )}

      {/* Trinity Audience Profile */}
      <TrinityAudienceProfile />
    </div>
  )
}

function TrinityAudienceProfile() {
  const { analyticsData } = useChromadonStore()
  const profile = analyticsData.trinity?.audienceProfile

  const hasData = profile && (
    profile.targetAudiences?.length > 0 ||
    profile.brandVoice?.tone?.length > 0 ||
    profile.products?.length > 0 ||
    profile.services?.length > 0
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="relative rounded-xl border border-[#00CED1]/10 bg-[#00CED1]/[0.03] p-4 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-6 h-[1px] bg-gradient-to-r from-[#00CED1]/40 to-transparent" />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 rounded-full bg-[#00CED1]" />
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Audience Profile</h3>
        {profile?.industry && profile.industry !== 'unknown' && (
          <span className="text-[10px] text-[#00CED1]/60 font-mono capitalize">{profile.industry}</span>
        )}
      </div>

      {!hasData ? (
        <p className="text-[11px] text-gray-500 font-mono">
          Complete client onboarding to build your audience profile. Target audiences, brand voice, and positioning will appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {profile!.targetAudiences.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]/60 mb-1">Target Audiences</div>
              <div className="flex flex-wrap gap-1.5">
                {profile!.targetAudiences.map((a, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-[#D4AF37]/20 text-[#D4AF37]/70 font-mono">
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile!.brandVoice?.tone?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8B5CF6]/60 mb-1">Brand Voice</div>
              <div className="flex flex-wrap gap-1.5">
                {profile!.brandVoice.tone.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded border border-[#8B5CF6]/20 text-[#8B5CF6]/70 font-mono">
                    {t}
                  </span>
                ))}
                <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-gray-500 font-mono capitalize">
                  {profile!.brandVoice.formality}
                </span>
              </div>
            </div>
          )}

          {(profile!.products?.length > 0 || profile!.services?.length > 0) && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#10B981]/60 mb-1">Products & Services</div>
              <div className="text-[11px] text-gray-400 font-mono">
                {[...(profile!.products || []), ...(profile!.services || [])].map(item =>
                  typeof item === 'string' ? item : (item as any)?.name || String(item)
                ).join(', ')}
              </div>
            </div>
          )}

          {profile!.usps?.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#EF4444]/60 mb-1">Unique Selling Points</div>
              <div className="space-y-1">
                {profile!.usps.slice(0, 3).map((usp, i) => (
                  <div key={i} className="text-[11px] text-gray-400 pl-2 border-l border-[#EF4444]/20">
                    {typeof usp === 'string' ? usp : String(usp)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-[10px] text-[#00CED1]/40 mt-3 font-mono">Powered by Trinity Intelligence</div>
    </motion.div>
  )
}
