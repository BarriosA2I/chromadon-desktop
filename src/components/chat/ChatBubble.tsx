import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ChatMessage } from '../../store/chatTypes'

function renderMarkdown(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="chat-code-block"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
}

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const [thinkingExpanded, setThinkingExpanded] = useState(false)
  const isUser = message.role === 'user'
  const isThinking = message.type === 'thinking'
  const isError = message.type === 'error'
  const isStatus = message.type === 'status'

  if (isStatus) {
    return (
      <div className="flex justify-center px-3 py-1">
        <span className="text-[10px] text-chroma-muted font-mono uppercase tracking-wider">
          {message.content}
        </span>
      </div>
    )
  }

  if (isThinking) {
    return (
      <div className="px-3 py-1">
        <button
          onClick={() => setThinkingExpanded(!thinkingExpanded)}
          className="flex items-center gap-1.5 text-[10px] text-chroma-purple/70 hover:text-chroma-purple font-mono transition-colors"
        >
          <span className={`transform transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`}>
            &#9654;
          </span>
          AI reasoning
        </button>
        {thinkingExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-1 pl-4 border-l border-chroma-purple/20 text-[11px] text-chroma-muted font-mono leading-relaxed"
          >
            {message.content}
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} px-3 py-1`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-chroma-teal/10 border border-chroma-teal/20 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
          <span className="text-[9px] font-display text-chroma-teal">C</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-chroma-teal/15 border border-chroma-teal/25 text-chroma-cyan font-mono'
            : isError
              ? 'bg-chroma-error/10 border border-chroma-error/25 text-chroma-error/90'
              : 'bg-white/[0.03] border border-white/[0.06] text-gray-300'
        }`}
      >
        {isUser ? (
          <span>{message.content}</span>
        ) : (
          <div
            className="chat-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] text-chroma-muted/50 font-mono">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {message.metadata?.confidence && (
            <span className="text-[9px] text-chroma-teal/50 font-mono">
              {Math.round(message.metadata.confidence * 100)}%
            </span>
          )}
          {message.metadata?.cognitiveMode && (
            <span className="text-[9px] text-chroma-purple/50 font-mono uppercase">
              {message.metadata.cognitiveMode}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
