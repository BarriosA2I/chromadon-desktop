import { motion } from 'framer-motion'
import { useChromadonStore } from '../store/chromadonStore'

export default function TabsGrid() {
  const { tabs } = useChromadonStore()

  // Always show 4 slots, fill empty ones with placeholders
  const displayTabs = [...tabs.slice(0, 4)]
  while (displayTabs.length < 4) {
    displayTabs.push({ id: -displayTabs.length, url: '', title: 'No Page', active: false })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="cyber-panel p-4 flex-1 min-h-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-ui font-semibold text-chroma-muted uppercase tracking-wider text-sm">
          Connected Tabs
        </h2>
        <span className="text-xs font-mono text-chroma-muted">
          {tabs.length} page{tabs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 h-[calc(100%-2rem)]">
        {displayTabs.map((tab, index) => (
          <TabCard key={tab.id} tab={tab} index={index} />
        ))}
      </div>
    </motion.div>
  )
}

function TabCard({ tab, index }: { tab: { id: number; url: string; title: string; active: boolean; screenshot?: string }; index: number }) {
  const isEmpty = tab.id < 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 * index }}
      className={`tab-card relative aspect-video rounded overflow-hidden group ${
        tab.active ? 'neon-border-active' : 'neon-border'
      } ${isEmpty ? 'opacity-30' : ''}`}
    >
      {/* Screenshot or placeholder */}
      <div className="absolute inset-0 bg-chroma-panel">
        {tab.screenshot ? (
          <img
            src={`data:image/png;base64,${tab.screenshot}`}
            alt={tab.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlaceholderIcon isEmpty={isEmpty} />
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-chroma-black via-transparent to-transparent" />

      {/* Scanline effect */}
      {!isEmpty && (
        <div className="scanline-overlay">
          <div className="absolute left-0 right-0 h-px bg-white/30 animate-scanline" />
        </div>
      )}

      {/* Live badge */}
      {tab.active && (
        <div className="absolute top-2 right-2">
          <span className="live-badge">LIVE</span>
        </div>
      )}

      {/* Tab index */}
      <div className="absolute top-2 left-2">
        <span className="text-xs font-mono text-chroma-muted bg-chroma-black/50 px-1.5 py-0.5 rounded">
          #{index + 1}
        </span>
      </div>

      {/* Info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <h3 className="font-ui font-semibold text-white text-sm truncate mb-0.5">
          {tab.title || 'Untitled'}
        </h3>
        <p className="font-mono text-xs text-chroma-muted truncate">
          {tab.url ? new URL(tab.url).hostname : '—'}
        </p>
      </div>

      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute inset-0 bg-chroma-teal/5" />
      </div>
    </motion.div>
  )
}

function PlaceholderIcon({ isEmpty }: { isEmpty: boolean }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      className={isEmpty ? 'text-chroma-muted/20' : 'text-chroma-teal/30'}
    >
      <rect
        x="6"
        y="10"
        width="36"
        height="28"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line x1="6" y1="18" x2="42" y2="18" stroke="currentColor" strokeWidth="2" />
      <circle cx="11" cy="14" r="1.5" fill="currentColor" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
      <circle cx="21" cy="14" r="1.5" fill="currentColor" />
    </svg>
  )
}
