import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
        <h2 className="subheading-cyber text-sm">
          Command Interface
        </h2>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono tracking-wider ${isConnected ? 'text-chroma-teal' : 'text-chroma-error'}`}>
            {isConnected ? 'READY' : 'OFFLINE'}
          </span>
          <div className="relative">
            <div className={`led ${isConnected ? 'led-green' : 'led-red'}`} />
            {isConnected && (
              <motion.div
                className="absolute inset-0 rounded-full bg-chroma-success"
                animate={{ scale: [1, 2], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <motion.div
          className="relative"
          animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Animated gradient border container */}
          <div
            className={`relative p-4 rounded-xl transition-all duration-300 ${
              isFocused || isProcessing
                ? 'bg-chroma-black/80'
                : 'bg-chroma-black/40'
            }`}
          >
            {/* Gradient border overlay */}
            <AnimatePresence>
              {(isFocused || isProcessing) && (
                <motion.div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      padding: '2px',
                      background: isProcessing
                        ? 'linear-gradient(135deg, #8B5CF6, #D4AF37, #8B5CF6)'
                        : 'linear-gradient(135deg, #00CED1, #8B5CF6, #D4AF37, #00CED1)',
                      backgroundSize: '300% 300%',
                      animation: 'gradient-shift 4s ease infinite',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Inner content with bg */}
            <div className="relative z-10 bg-chroma-black/60 rounded-lg -m-1 p-3">
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

              {/* Voice Button */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-lg text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10 transition-all"
                title="Voice input (coming soon)"
              >
                <WaveformIcon />
              </motion.button>
            </div>
          </div>

          {/* Glow effect underneath */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                className="absolute -bottom-3 left-1/4 right-1/4 h-6 rounded-full blur-xl pointer-events-none"
                initial={{ opacity: 0, scaleY: 0.5 }}
                animate={{ opacity: 0.4, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.5 }}
                style={{
                  background: 'linear-gradient(90deg, #00CED1, #8B5CF6)',
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Bottom Row */}
        <div className="flex items-center justify-between">
          {/* Hints */}
          <div className="text-xs font-mono text-chroma-muted">
            <span className="text-chroma-teal">↵</span> to execute •{' '}
            <span className="text-chroma-purple">System 1</span> fast /{' '}
            <span className="text-chroma-purple">System 2</span> deep
          </div>

          {/* Premium Execute Button */}
          <motion.button
            type="submit"
            disabled={!command.trim() || isProcessing || !isConnected}
            whileHover={!isProcessing ? { scale: 1.02, boxShadow: '0 0 40px rgba(0, 206, 209, 0.5)' } : {}}
            whileTap={!isProcessing ? { scale: 0.98 } : {}}
            className={`
              relative min-w-36 py-3 px-8 rounded-xl font-display font-bold uppercase tracking-[0.15em] text-sm
              overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              ${isProcessing
                ? 'bg-gradient-to-r from-chroma-purple to-violet-600 text-white'
                : 'bg-gradient-to-r from-chroma-teal to-chroma-cyan text-chroma-black'
              }
            `}
          >
            {/* Shine sweep effect */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                transform: 'translateX(-100%)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
            />

            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-white/30" />
            <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-white/30" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-white/30" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-white/30" />

            {/* Button text */}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isProcessing ? (
                <>
                  <LoadingSpinner />
                  PROCESSING
                </>
              ) : (
                'EXECUTE'
              )}
            </span>
          </motion.button>
        </div>
      </form>
    </motion.div>
  )
}

function WaveformIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
