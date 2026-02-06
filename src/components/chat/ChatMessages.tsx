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
}

export function ChatMessages({ messages, showThinking }: ChatMessagesProps) {
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
        <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
          <div className="w-12 h-12 rounded-xl bg-chroma-teal/10 border border-chroma-teal/20 flex items-center justify-center">
            <span className="text-xl font-display text-chroma-teal">C</span>
          </div>
          <div>
            <p className="text-sm font-display text-chroma-teal tracking-wide">CHROMADON AI</p>
            <p className="text-[11px] text-chroma-muted mt-1 font-mono leading-relaxed">
              I'm your autonomous browser assistant. Tell me what to do and I'll execute it.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center mt-2">
            {['Open Twitter', 'Search Google for...', 'Describe this page', 'Fill out the form'].map((hint) => (
              <span
                key={hint}
                className="text-[10px] text-chroma-teal/50 border border-chroma-teal/15 rounded-full px-2.5 py-1 font-mono"
              >
                {hint}
              </span>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
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
