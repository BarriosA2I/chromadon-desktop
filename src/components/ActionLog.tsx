import { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChromadonStore, ActionLog as ActionLogType, ActionType } from '../store/chromadonStore'

export default function ActionLog() {
  const { actionLogs, clearLogs } = useChromadonStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [actionLogs])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 }}
      className="cyber-panel p-4 flex-1 flex flex-col min-h-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="font-ui font-semibold text-chroma-muted uppercase tracking-wider text-sm">
          Action Log
        </h2>
        <button
          onClick={clearLogs}
          className="text-xs font-ui text-chroma-muted hover:text-chroma-teal transition-colors"
          title="Clear logs"
        >
          CLEAR
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden space-y-1 font-mono text-xs"
      >
        <AnimatePresence initial={false}>
          {actionLogs.length === 0 ? (
            <div className="text-chroma-muted/50 text-center py-8">
              No actions yet. Execute a command to see logs.
            </div>
          ) : (
            actionLogs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function LogEntry({ log }: { log: ActionLogType }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-2 py-1.5 border-b border-chroma-teal/5 last:border-0"
    >
      {/* Timestamp */}
      <span className="text-chroma-muted flex-shrink-0 w-16">
        {formatTime(log.timestamp)}
      </span>

      {/* Badge */}
      <span className={`badge flex-shrink-0 ${getBadgeClass(log.type)}`}>
        {log.type}
      </span>

      {/* Description */}
      <span className={`flex-1 truncate ${log.success ? 'text-white' : 'text-chroma-error'}`}>
        {log.description}
      </span>

      {/* Duration */}
      {log.duration !== undefined && (
        <span className="text-chroma-muted flex-shrink-0">
          {log.duration}ms
        </span>
      )}

      {/* Status indicator */}
      <span className="flex-shrink-0">
        {log.success ? (
          <CheckIcon className="text-chroma-success" />
        ) : (
          <XIcon className="text-chroma-error" />
        )}
      </span>
    </motion.div>
  )
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getBadgeClass(type: ActionType): string {
  switch (type) {
    case 'navigate':
      return 'badge-navigate'
    case 'click':
      return 'badge-click'
    case 'type':
      return 'badge-type'
    case 'scroll':
      return 'badge-scroll'
    case 'wait':
      return 'badge-wait'
    case 'error':
      return 'badge-error'
    case 'success':
      return 'badge-success'
    default:
      return 'bg-chroma-panel text-chroma-muted'
  }
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className}>
      <path
        d="M3 7L6 10L11 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={className}>
      <path
        d="M4 4L10 10M10 4L4 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
