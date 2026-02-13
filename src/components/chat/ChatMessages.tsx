import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ChatMessage } from '../../store/chatTypes'
import { ChatBubble } from './ChatBubble'
import { ActionCard } from './ActionCard'
import { ThinkingIndicator } from './ThinkingIndicator'
import StreamingMessage from './StreamingMessage'

interface ChatMessagesProps {
  messages: ChatMessage[]
  showThinking: boolean
  onHintClick?: (text: string) => void
}

export function ChatMessages({ messages, showThinking, onHintClick }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, showThinking])

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-chroma-teal/20"
    >
      {messages.length === 0 && !showThinking && (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4 relative">
          {/* Radial glow background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 rounded-full bg-chroma-teal/[0.04] blur-2xl" />
          </div>

          {/* Logo with breathing glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10"
          >
            <div
              className="w-14 h-14 rounded-xl bg-chroma-teal/10 border border-chroma-teal/20 shadow-crystal flex items-center justify-center"
              style={{ animation: 'crystal-breathe 3s ease-in-out infinite' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <defs>
                  <linearGradient id="emptyLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00CED1" />
                    <stop offset="50%" stopColor="#00FFFF" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
                <path d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z" stroke="url(#emptyLogoGrad)" strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="4" stroke="url(#emptyLogoGrad)" strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="1.5" fill="#00CED1" />
                <path d="M12 8V6M12 18V16M16 12H18M6 12H8" stroke="#00CED1" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>
          </motion.div>

          {/* Title + subtitle with staggered reveal */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative z-10"
          >
            <p className="text-sm font-display text-chroma-teal tracking-[0.2em] uppercase">CHROMADON AI</p>
            <p className="text-[11px] text-chroma-muted/70 mt-1.5 font-ui leading-relaxed max-w-[260px]">
              Autonomous browser assistant. Tell me what to do and I'll execute it.
            </p>
          </motion.div>

          {/* Clickable hint pills with staggered entrance */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-wrap gap-1.5 justify-center mt-1 relative z-10"
          >
            {['Open Twitter', 'Search Google for...', 'Describe this page', 'Fill out the form'].map((hint, i) => (
              <motion.button
                key={hint}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onHintClick?.(hint)}
                className="text-[10px] text-chroma-teal/60 border border-chroma-teal/15 bg-chroma-teal/[0.03] rounded-full px-2.5 py-1 font-mono cursor-pointer hover:text-chroma-teal hover:border-chroma-teal/35 hover:bg-chroma-teal/[0.08] hover:shadow-crystal transition-all duration-200"
              >
                {hint}
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, x: msg.role === 'user' ? 8 : -8, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {msg.type === 'streaming' ? (
              <StreamingMessage message={msg} />
            ) : msg.type === 'action-card' ? (
              <ActionCard message={msg} />
            ) : (
              <ChatBubble message={msg} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {showThinking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <ThinkingIndicator />
        </motion.div>
      )}
    </div>
  )
}
