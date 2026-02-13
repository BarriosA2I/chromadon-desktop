import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { InterviewMessage } from '../../store/clientContextTypes'

interface Props {
  messages: InterviewMessage[]
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
  currentPhase?: string
  onUpload?: () => void
}

export default function InterviewChat({ messages, isLoading, error, onRetry, currentPhase, onUpload }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Error state */}
      {error && messages.length === 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center py-12"
        >
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <span className="text-red-400 text-2xl">!</span>
            </div>
            <p className="text-sm text-red-400 font-medium mb-1">Connection Failed</p>
            <p className="text-xs text-white/40 mb-4">Could not reach the Brain API. Make sure CHROMADON services are running.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-xs font-medium hover:bg-chroma-teal/30 transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
              ${msg.role === 'user'
                ? 'bg-chroma-teal/20 border border-chroma-teal/30 text-white'
                : 'bg-white/5 border border-white/10 text-white/90'
              }
            `}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full bg-chroma-teal/30 flex items-center justify-center text-[10px]">C</div>
                  <span className="text-chroma-teal text-xs font-medium">CHROMADON</span>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Upload prompt during document_upload phase */}
      {currentPhase === 'document_upload' && onUpload && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="max-w-[80%] px-4 py-4 bg-chroma-teal/5 border border-chroma-teal/20 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📄</span>
              <span className="text-chroma-teal text-xs font-bold uppercase tracking-wider">Knowledge Vault</span>
            </div>
            <p className="text-sm text-white/70 mb-3">Upload your business documents — logos, brochures, brand guides, product sheets, competitor analysis, or any files that help CHROMADON understand your business.</p>
            <button
              onClick={onUpload}
              className="px-4 py-2 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-xs font-medium hover:bg-chroma-teal/30 transition-colors"
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
          <div className="bg-white/5 border border-white/10 px-4 py-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-chroma-teal/30 flex items-center justify-center text-[10px]">C</div>
              <div className="flex gap-1">
                <motion.div className="w-2 h-2 rounded-full bg-chroma-teal/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} />
                <motion.div className="w-2 h-2 rounded-full bg-chroma-teal/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} />
                <motion.div className="w-2 h-2 rounded-full bg-chroma-teal/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
