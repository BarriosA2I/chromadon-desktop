import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../store/chromadonStore'
import { useChromadonAPI } from '../hooks/useChromadonAPI'

export default function CommandInput() {
  const inputRef = useRef<HTMLInputElement>(null)
  const { command, setCommand, isProcessing, isConnected } = useChromadonStore()
  const { executeCommand } = useChromadonAPI()
  const [isFocused, setIsFocused] = useState(false)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!command.trim() || isProcessing || !isConnected) return
    await executeCommand(command)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={`cyber-panel p-6 ${isFocused || isProcessing ? 'cyber-panel-active' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-ui font-semibold text-chroma-muted uppercase tracking-wider text-sm">
          Command Interface
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-chroma-muted">
            {isConnected ? 'READY' : 'OFFLINE'}
          </span>
          <div className={`led ${isConnected ? 'led-green' : 'led-red'}`} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          className={`relative p-4 rounded bg-chroma-black/50 border transition-all duration-300 ${
            isFocused
              ? 'border-chroma-teal shadow-neon-teal'
              : 'border-chroma-teal/20'
          } ${isProcessing ? 'border-chroma-purple shadow-neon-purple' : ''}`}
        >
          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Tell CHROMADON what to do..."
            disabled={isProcessing}
            className="input-cyber pr-12"
          />

          {/* Voice Button (placeholder) */}
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-chroma-muted hover:text-chroma-teal transition-colors"
            title="Voice input (coming soon)"
          >
            <WaveformIcon />
          </button>
        </div>

        {/* Bottom Row */}
        <div className="flex items-center justify-between">
          {/* Hints */}
          <div className="text-xs font-mono text-chroma-muted">
            <span className="text-chroma-teal">↵</span> to execute •{' '}
            <span className="text-chroma-purple">System 1</span> fast /{' '}
            <span className="text-chroma-purple">System 2</span> deep
          </div>

          {/* Execute Button */}
          <button
            type="submit"
            disabled={!command.trim() || isProcessing || !isConnected}
            className={`btn-cyber min-w-32 ${isProcessing ? 'btn-cyber-processing' : ''}`}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                PROCESSING
              </span>
            ) : (
              'EXECUTE'
            )}
          </button>
        </div>
      </form>
    </motion.div>
  )
}

function WaveformIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="4" y2="12" />
      <line x1="8" y1="8" x2="8" y2="16" />
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="16" y1="8" x2="16" y2="16" />
      <line x1="20" y1="12" x2="20" y2="12" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}
