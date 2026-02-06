import { motion } from 'framer-motion'
import type { ChatMessage } from '../../store/chatTypes'
import ToolCallCard from './ToolCallCard'

// Lightweight markdown: bold, italic, code blocks, inline code, line breaks
function renderMarkdown(text: string): JSX.Element[] {
  const parts: JSX.Element[] = []
  const lines = text.split('\n')
  let inCodeBlock = false
  let codeContent = ''
  let codeLang = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        parts.push(<pre key={`code-${i}`} className="chat-code-block">{codeContent.trimEnd()}</pre>)
        codeContent = ''
        inCodeBlock = false
      } else {
        inCodeBlock = true
        codeLang = line.slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += (codeContent ? '\n' : '') + line
      continue
    }

    // Process inline formatting
    let processed = line
      .replace(/\*\*(.+?)\*\*/g, '<strong class="chat-markdown">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="chat-markdown">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>')

    if (processed.trim()) {
      parts.push(
        <span key={`line-${i}`} dangerouslySetInnerHTML={{ __html: processed }} />
      )
    }

    if (i < lines.length - 1 && !inCodeBlock) {
      parts.push(<br key={`br-${i}`} />)
    }
  }

  if (inCodeBlock && codeContent) {
    parts.push(<pre key="code-last" className="chat-code-block">{codeContent.trimEnd()}</pre>)
  }

  return parts
}

export default function StreamingMessage({ message }: { message: ChatMessage }) {
  const parts = message.streamingParts || []
  const isStreaming = message.isStreaming

  if (parts.length === 0 && isStreaming) {
    // Show thinking indicator while waiting for first content
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-2 px-3 py-2"
      >
        <div className="w-6 h-6 rounded bg-chroma-teal/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-chroma-teal text-xs font-bold">C</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-chroma-teal animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-chroma-teal animate-pulse" style={{ animationDelay: '200ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-chroma-teal animate-pulse" style={{ animationDelay: '400ms' }} />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-2 px-3 py-2"
    >
      {/* Avatar */}
      <div className="w-6 h-6 rounded bg-chroma-teal/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-chroma-teal text-xs font-bold">C</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        {parts.map((part, idx) => {
          if (part.type === 'text' && part.content) {
            return (
              <div key={idx} className="text-sm text-white/90 leading-relaxed font-mono">
                {renderMarkdown(part.content)}
                {/* Blinking cursor on the last text part while streaming */}
                {isStreaming && idx === parts.length - 1 && (
                  <span className="inline-block w-2 h-4 bg-chroma-teal ml-0.5 animate-pulse" />
                )}
              </div>
            )
          }

          if (part.type === 'tool-call' && part.toolCall) {
            return <ToolCallCard key={idx} toolCall={part.toolCall} />
          }

          return null
        })}
      </div>
    </motion.div>
  )
}
