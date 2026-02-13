import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { InterviewMessage } from '../../store/clientContextTypes'

const PHASE_LABELS: Record<string, { label: string; icon: string }> = {
  greeting: { label: 'Welcome', icon: '👋' },
  discovery: { label: 'Discovery', icon: '🔍' },
  products: { label: 'Products', icon: '📦' },
  audience: { label: 'Audience', icon: '👥' },
  competitors: { label: 'Competitors', icon: '⚔️' },
  voice_capture: { label: 'Brand Voice', icon: '🎙️' },
  document_upload: { label: 'Documents', icon: '📄' },
  strategy_mapping: { label: 'Strategy', icon: '🎯' },
  complete: { label: 'Complete', icon: '✅' },
}

interface Props {
  messages: InterviewMessage[]
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
  currentPhase?: string
  onUpload?: () => void
  onSkip?: () => void
}

export default function InterviewChat({ messages, isLoading, error, onRetry, currentPhase, onUpload, onSkip }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevPhaseRef = useRef<string | undefined>(currentPhase)
  const [phaseTransitions, setPhaseTransitions] = useState<string[]>([])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, phaseTransitions])

  useEffect(() => {
    if (currentPhase && currentPhase !== prevPhaseRef.current && currentPhase !== 'greeting' && currentPhase !== 'complete') {
      setPhaseTransitions(prev => [...prev, currentPhase])
    }
    prevPhaseRef.current = currentPhase
  }, [currentPhase])

  return (
    <div ref={scrollRef} className="flex-1 h-0 overflow-y-auto px-6 py-4 space-y-4 crystal-grid">
      {/* Error state */}
      {error && messages.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center py-12"
        >
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-chroma-error/10 border border-chroma-error/20 shadow-[0_0_20px_rgba(239,68,68,0.1)] flex items-center justify-center">
              <span className="text-chroma-error text-2xl font-display">!</span>
            </div>
            <p className="text-sm text-red-400 font-medium mb-1">Connection Failed</p>
            <p className="text-xs text-white/40 mb-4">Could not reach the Brain API. Make sure CHROMADON services are running.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-chroma-teal/20 border border-chroma-teal/30 rounded-lg text-chroma-teal text-xs font-display uppercase tracking-wider shadow-crystal hover:bg-chroma-teal/30 hover:shadow-crystal-hover transition-all"
              >
                Retry Connection
              </button>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          // Check if a phase transition should appear before this message
          const transitionBefore = msg.role === 'assistant' && phaseTransitions.length > 0
            ? (() => {
                // Show next unconsumed transition before the first assistant message after it was added
                const assistantIdx = messages.slice(0, i + 1).filter(m => m.role === 'assistant').length
                const transition = phaseTransitions[assistantIdx - 1]
                // Only show if this is the first assistant message for this transition index
                if (transition && messages.slice(0, i).filter(m => m.role === 'assistant').length === assistantIdx - 1) {
                  return transition
                }
                return null
              })()
            : null

          return (
            <div key={i}>
              {/* Phase transition divider */}
              {transitionBefore && PHASE_LABELS[transitionBefore] && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0.8 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex items-center gap-3 py-2 my-2"
                >
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-chroma-teal/20 to-transparent" />
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-chroma-surface/50 border border-chroma-teal/15 rounded-full">
                    <span className="text-sm">{PHASE_LABELS[transitionBefore].icon}</span>
                    <span className="text-xs font-display uppercase tracking-wider text-chroma-teal/70">{PHASE_LABELS[transitionBefore].label}</span>
                    {onSkip && (
                      <>
                        <span className="text-white/10">|</span>
                        <button
                          onClick={onSkip}
                          className="text-[10px] font-ui text-white/30 hover:text-chroma-teal transition-colors"
                        >
                          Don't have this? Skip
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-chroma-teal/20 to-transparent" />
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`
                  max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-gradient-to-br from-chroma-teal/15 to-chroma-teal/8 border border-chroma-teal/25 text-white user-bubble-accent'
                    : 'bg-chroma-surface/80 border border-chroma-teal/8 border-l-2 border-l-chroma-teal/30 text-white/90'
                  }
                `}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-5 h-5 rounded-lg bg-chroma-teal/10 border border-chroma-teal/20 shadow-crystal flex items-center justify-center text-[9px] font-display text-chroma-teal">C</div>
                      <span className="text-chroma-teal text-xs font-display tracking-wider">CHROMADON</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </motion.div>
            </div>
          )
        })}
      </AnimatePresence>

      {/* Upload prompt during document_upload phase */}
      {currentPhase === 'document_upload' && onUpload && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="max-w-[80%] px-4 py-4 bg-chroma-teal/5 border border-chroma-teal/20 rounded-2xl energy-line backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📄</span>
              <span className="text-chroma-teal text-xs font-display uppercase tracking-[0.2em]">Knowledge Vault</span>
            </div>
            <p className="text-sm text-white/70 mb-3">Upload your business documents — logos, brochures, brand guides, product sheets, competitor analysis, or any files that help CHROMADON understand your business.</p>
            <button
              onClick={onUpload}
              className="px-4 py-2 bg-chroma-teal/20 border border-chroma-teal/30 rounded-lg text-chroma-teal text-xs font-display uppercase tracking-wider shadow-crystal hover:bg-chroma-teal/30 hover:shadow-crystal-hover transition-all"
            >
              Upload Documents
            </button>
          </div>
        </motion.div>
      )}

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-start"
        >
          <div className="bg-chroma-surface/80 border border-chroma-teal/8 px-4 py-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-chroma-teal/10 border border-chroma-teal/20 shadow-crystal flex items-center justify-center text-[9px] font-display text-chroma-teal">C</div>
              <div className="flex gap-1">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-chroma-teal" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0, ease: 'easeInOut' }} />
                <motion.div className="w-1.5 h-1.5 rounded-full bg-chroma-teal" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2, ease: 'easeInOut' }} />
                <motion.div className="w-1.5 h-1.5 rounded-full bg-chroma-teal" animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4, ease: 'easeInOut' }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
