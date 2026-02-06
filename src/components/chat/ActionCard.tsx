import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatMessage } from '../../store/chatTypes'

const ACTION_BADGES: Record<string, { label: string; color: string }> = {
  navigate: { label: 'NAV', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  click: { label: 'CLK', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  type: { label: 'TYP', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  fill: { label: 'TYP', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  scroll: { label: 'SCR', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  extract: { label: 'EXT', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  wait: { label: 'WAI', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  screenshot: { label: 'IMG', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
}

interface ActionCardProps {
  message: ChatMessage
}

export function ActionCard({ message }: ActionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const actions = message.metadata?.actions || []
  const succeeded = actions.filter((a) => a.success).length
  const total = actions.length
  const confidence = message.metadata?.confidence
  const duration = message.metadata?.duration

  return (
    <div className="px-3 py-1">
      <div className="rounded-lg border border-chroma-teal/15 bg-chroma-teal/[0.03] overflow-hidden">
        {/* Summary header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-chroma-teal/[0.05] transition-colors"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${succeeded === total ? 'bg-chroma-success' : 'bg-chroma-warning'}`} />
          <span className="text-[11px] font-display text-chroma-teal uppercase tracking-wider">
            {succeeded === total ? 'Mission Complete' : 'Partial Success'}
          </span>
          <div className="flex-1" />
          <span className="text-[10px] text-chroma-muted font-mono">{succeeded}/{total}</span>
          {duration && (
            <span className="text-[10px] text-chroma-muted font-mono">{(duration / 1000).toFixed(1)}s</span>
          )}
          {confidence && (
            <span className="text-[10px] text-chroma-teal/60 font-mono">{Math.round(confidence * 100)}%</span>
          )}
          <span className={`text-[10px] text-chroma-muted transform transition-transform ${expanded ? 'rotate-180' : ''}`}>
            &#9660;
          </span>
        </button>

        {/* Expanded action list */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-chroma-teal/10 px-3 py-1.5 space-y-1">
                {actions.map((action, i) => {
                  const badge = ACTION_BADGES[action.action?.toLowerCase()] || ACTION_BADGES.extract
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-gray-400 flex-1 truncate">
                        {action.description || action.details || action.action}
                      </span>
                      {action.success ? (
                        <span className="text-chroma-success text-[10px]">&#10003;</span>
                      ) : (
                        <span className="text-chroma-error text-[10px]">&#10007;</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
