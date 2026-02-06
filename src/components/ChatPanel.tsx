import { useRef, useCallback } from 'react'
import { useChromadonStore } from '../store/chromadonStore'
import { ChatMessages } from './chat/ChatMessages'

export function ChatPanel() {
  const {
    chatMessages,
    chatInput,
    showThinkingIndicator,
    isConnected,
    isProcessing,
    setChatInput,
    clearChat,
  } = useChromadonStore()

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setChatInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'
  }, [setChatInput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const form = (e.target as HTMLElement).closest('form')
      if (form) form.requestSubmit()
    }
  }, [])

  // Submit is handled by the parent that wraps this in useChatAPI
  // We dispatch a custom event that useChatAPI listens for
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || isProcessing || !isConnected) return
    window.dispatchEvent(new CustomEvent('chromadon-chat-submit', { detail: chatInput.trim() }))
    setChatInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [chatInput, isProcessing, isConnected, setChatInput])

  return (
    <div className="cyber-panel flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-chroma-success animate-pulse' : 'bg-chroma-error'}`} />
          <span className="text-[10px] font-display text-chroma-teal uppercase tracking-[0.15em]">
            AI Assistant
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isConnected && (
            <span className="text-[9px] text-chroma-error font-mono uppercase">offline</span>
          )}
          {chatMessages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-[9px] text-chroma-muted hover:text-chroma-teal font-mono transition-colors px-1.5 py-0.5 rounded hover:bg-chroma-teal/10"
              title="Clear chat"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ChatMessages messages={chatMessages} showThinking={showThinkingIndicator} />

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/[0.06] p-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Tell CHROMADON what to do...' : 'Connecting...'}
            disabled={!isConnected || isProcessing}
            rows={1}
            className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-chroma-muted/40 resize-none focus:outline-none focus:border-chroma-teal/30 focus:bg-white/[0.05] transition-colors disabled:opacity-40"
            style={{ minHeight: '36px', maxHeight: '96px' }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isProcessing || !isConnected}
            className="flex-shrink-0 h-9 px-3 rounded-lg font-display text-[10px] uppercase tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-r from-chroma-teal/20 to-chroma-purple/20 border border-chroma-teal/25 text-chroma-teal hover:from-chroma-teal/30 hover:to-chroma-purple/30 hover:border-chroma-teal/40 hover:shadow-neon-teal"
          >
            {isProcessing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-chroma-purple animate-pulse" />
                <span>Working</span>
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[9px] text-chroma-muted/30 font-mono">
            Enter to send &middot; Shift+Enter for newline
          </span>
        </div>
      </form>
    </div>
  )
}
