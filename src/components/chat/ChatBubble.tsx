import { useState, useCallback } from 'react'
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
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isThinking = message.type === 'thinking'
  const isError = message.type === 'error'
  const isStatus = message.type === 'status'

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [message.content])

  if (isStatus) {
    return (
      <div className="flex justify-center px-3 py-1">
        <span className="text-[10px] text-chroma-muted font-ui uppercase tracking-[0.2em]">
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
          <svg className={`w-3 h-3 transform transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
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
        <div className="w-7 h-7 rounded-lg bg-chroma-teal/10 border border-chroma-teal/20 shadow-crystal flex items-center justify-center flex-shrink-0 mr-2 mt-0.5" style={{ animation: 'crystal-breathe 3s ease-in-out infinite' }}>
          <span className="text-[9px] font-display text-chroma-teal">C</span>
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed select-text group/bubble ${
          isUser
            ? 'bg-gradient-to-br from-chroma-teal/15 to-chroma-teal/8 border border-chroma-teal/25 text-chroma-cyan font-mono user-bubble-accent'
            : isError
              ? 'bg-chroma-error/10 border border-chroma-error/25 text-chroma-error/90'
              : 'bg-chroma-surface/80 border border-chroma-teal/8 border-l-2 border-l-chroma-teal/30 text-gray-300'
        }`}
      >
        {isUser ? (
          <div>
            {message.attachedMedia && message.attachedMedia.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {message.attachedMedia.map((media) => (
                  <div key={media.id} className="relative">
                    {media.type === 'image' ? (
                      <img
                        src={media.previewUrl}
                        alt={media.name}
                        className="max-w-[120px] max-h-[80px] rounded-lg object-cover border border-chroma-teal/20 hover:border-chroma-teal/50 transition-colors"
                      />
                    ) : (
                      <div className="w-[120px] h-[80px] rounded-lg border border-chroma-purple/20 bg-black/30 flex flex-col items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" className="text-chroma-purple">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span className="text-[8px] text-chroma-muted font-mono mt-1 truncate max-w-[100px]">
                          {media.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <span>
              {message.attachedMedia && message.attachedMedia.length > 0
                ? message.content.replace(/\[ATTACHED (?:IMAGE|VIDEO): .+? \u2192 .+?\]\n?/g, '').trim()
                : message.content}
            </span>
          </div>
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
          {!isUser && (
            <button
              onClick={handleCopy}
              className="text-[9px] text-chroma-muted/30 hover:text-chroma-teal font-mono transition-colors opacity-0 group-hover/bubble:opacity-100 ml-auto select-none"
              title="Copy message"
            >
              {copied ? 'copied!' : 'copy'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
