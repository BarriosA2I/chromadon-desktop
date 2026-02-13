import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ToolCallInfo } from '../../store/chatTypes'

const TOOL_BADGES: Record<string, { label: string; color: string }> = {
  navigate: { label: 'NAV', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  click: { label: 'CLK', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  type_text: { label: 'TYP', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  scroll: { label: 'SCR', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  press_key: { label: 'KEY', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  wait: { label: 'WAI', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
  take_screenshot: { label: 'IMG', color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  extract_text: { label: 'EXT', color: 'text-chroma-teal bg-chroma-teal/10 border-chroma-teal/20' },
  select_option: { label: 'SEL', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' },
  hover: { label: 'HOV', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  get_page_context: { label: 'CTX', color: 'text-chroma-teal bg-chroma-teal/10 border-chroma-teal/20' },
  list_tabs: { label: 'TAB', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  switch_tab: { label: 'TAB', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  create_tab: { label: 'TAB', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
}

function StatusIcon({ status }: { status: ToolCallInfo['status'] }) {
  switch (status) {
    case 'calling':
    case 'executing':
      return (
        <span className="inline-block w-3 h-3 rounded-full bg-chroma-teal animate-pulse" />
      )
    case 'done':
      return <span className="text-chroma-success text-xs font-mono" style={{ textShadow: '0 0 8px rgba(16, 185, 129, 0.5)' }}>OK</span>
    case 'error':
      return <span className="text-chroma-error text-xs font-mono" style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}>ERR</span>
  }
}

export default function ToolCallCard({ toolCall }: { toolCall: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(false)
  const badge = TOOL_BADGES[toolCall.name] || { label: toolCall.name.slice(0, 3).toUpperCase(), color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' }

  const isActive = toolCall.status === 'calling' || toolCall.status === 'executing'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`my-1 rounded-lg border ${isActive ? 'border-chroma-teal/30 bg-chroma-teal/5 shadow-crystal energy-line' : 'border-white/[0.06] bg-chroma-surface/40'}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2 py-1 text-left"
      >
        <span className={`px-1.5 py-0.5 text-[10px] font-ui font-bold uppercase tracking-wider rounded border ${badge.color}`}>
          {badge.label}
        </span>
        <span className="flex-1 text-xs text-chroma-muted font-mono truncate">
          {toolCall.name}
          {toolCall.input && Object.keys(toolCall.input).length > 0 && (
            <span className="text-white/30 ml-1">
              ({Object.entries(toolCall.input).map(([k, v]) => {
                const val = typeof v === 'string' ? v.slice(0, 30) : JSON.stringify(v)
                return `${k}: ${val}`
              }).join(', ')})
            </span>
          )}
        </span>
        <StatusIcon status={toolCall.status} />
        {toolCall.durationMs !== undefined && (
          <span className="text-[10px] text-white/20 font-mono">{toolCall.durationMs >= 1000 ? `${(toolCall.durationMs / 1000).toFixed(1)}s` : `${toolCall.durationMs}ms`}</span>
        )}
        <span className="text-white/20 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (toolCall.result || toolCall.error) && (
        <div className="px-2 pb-1.5 border-t border-chroma-teal/10">
          <pre className="text-[10px] font-mono text-chroma-muted whitespace-pre-wrap max-h-32 overflow-y-auto mt-1">
            {toolCall.error ? `Error: ${toolCall.error}` : toolCall.result}
          </pre>
        </div>
      )}
    </motion.div>
  )
}
