import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ChannelCard from './ChannelCard'
import ContentCalendar from './ContentCalendar'
import MetricsPanel from './MetricsPanel'
import { useClientContext } from '../../hooks/useClientContext'

interface Props {
  clientId: string
}

type Tab = 'overview' | 'channels' | 'calendar' | 'metrics'

export default function StrategyDashboard({ clientId }: Props) {
  const { strategy, strategyLoading, fetchStrategy, generateStrategy, generateCalendar } = useClientContext()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    fetchStrategy(clientId)
  }, [clientId, fetchStrategy])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'channels', label: 'Channels' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'metrics', label: 'Metrics' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm font-black uppercase tracking-tight text-white">Growth Strategy</h2>
          <p className="text-[10px] text-white/30">
            {strategy ? `v${strategy.version} · Generated ${new Date(strategy.generatedAt).toLocaleDateString()}` : 'Not generated yet'}
          </p>
        </div>
        <div className="flex gap-2">
          {strategy && (
            <button
              onClick={() => generateCalendar(clientId)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 text-xs hover:bg-white/10 transition-colors"
            >
              📅 Calendar
            </button>
          )}
          <button
            onClick={() => generateStrategy(clientId)}
            disabled={strategyLoading}
            className="px-3 py-1.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-xs font-medium hover:bg-chroma-teal/30 transition-colors disabled:opacity-50"
          >
            {strategyLoading ? 'Generating...' : strategy ? '↻ Regenerate' : '⚡ Generate'}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {strategyLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <motion.div
              className="w-12 h-12 mx-auto mb-4 rounded-xl bg-chroma-teal/20 border border-chroma-teal/40 flex items-center justify-center"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
            >
              <span className="text-xl">🧠</span>
            </motion.div>
            <p className="text-xs text-white/40">Analyzing your business and generating strategy...</p>
          </div>
        </div>
      )}

      {/* No strategy */}
      {!strategy && !strategyLoading && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-sm text-white/40 mb-2">No strategy generated yet</p>
            <p className="text-xs text-white/20">Complete the interview first, then generate your growth strategy</p>
          </div>
        </div>
      )}

      {/* Strategy content */}
      {strategy && !strategyLoading && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 px-5 py-2 border-b border-white/5">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeTab === tab.key
                    ? 'bg-chroma-teal/20 text-chroma-teal border border-chroma-teal/30'
                    : 'text-white/30 hover:text-white/50 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                    <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Strategy Overview</h3>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{strategy.overview}</p>
                  </div>

                  {strategy.competitiveAdvantages.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                      <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Competitive Advantages</h3>
                      <div className="space-y-1">
                        {strategy.competitiveAdvantages.map((adv, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-chroma-gold text-xs mt-0.5">◆</span>
                            <span className="text-xs text-white/60">{adv}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {strategy.shortTermGoals.length > 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h3 className="text-xs font-bold text-chroma-teal/60 uppercase tracking-wider mb-2">Short-Term Goals</h3>
                        {strategy.shortTermGoals.map((g, i) => (
                          <div key={i} className="mb-2">
                            <p className="text-xs text-white/60">{g.goal}</p>
                            <p className="text-[10px] text-white/20">{g.timeline}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {strategy.longTermGoals.length > 0 && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h3 className="text-xs font-bold text-chroma-gold/60 uppercase tracking-wider mb-2">Long-Term Goals</h3>
                        {strategy.longTermGoals.map((g, i) => (
                          <div key={i} className="mb-2">
                            <p className="text-xs text-white/60">{g.goal}</p>
                            <p className="text-[10px] text-white/20">{g.timeline}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'channels' && (
                <motion.div key="channels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid grid-cols-2 gap-3">
                    {strategy.channels.map((ch, i) => (
                      <ChannelCard key={ch.platform} channel={ch} index={i} />
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'calendar' && (
                <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ContentCalendar entries={strategy.contentCalendar} weeks={4} />
                </motion.div>
              )}

              {activeTab === 'metrics' && (
                <motion.div key="metrics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <MetricsPanel metrics={strategy.successMetrics} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  )
}
