import { useRef, useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useChromadonStore } from '../store/chromadonStore'
import { ChatMessages } from './chat/ChatMessages'
import { MediaUploadButton } from './chat/MediaUploadButton'
import { MediaPreviewStrip } from './chat/MediaPreviewStrip'
import type { MediaAttachment } from '../store/chatTypes'

const ACCEPTED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
]

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

  // Media attachment state (local — transient input, not in Zustand)
  const [attachedMedia, setAttachedMedia] = useState<MediaAttachment[]>([])
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Convert File objects to MediaAttachment objects
  const processFiles = useCallback((files: File[]) => {
    const valid = files.filter(f => ACCEPTED_MIMES.includes(f.type))
    if (valid.length < files.length) {
      setMediaError(`${files.length - valid.length} file(s) skipped (unsupported type)`)
      setTimeout(() => setMediaError(null), 3000)
    }

    const newAttachments: MediaAttachment[] = valid.map((file, i) => ({
      id: `media-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
      name: file.name,
      path: (file as any).path || '',
      type: file.type.startsWith('video/') ? 'video' as const : 'image' as const,
      mimeType: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
    }))

    setAttachedMedia(prev => [...prev, ...newAttachments].slice(0, 10))
  }, [])

  const handleRemoveMedia = useCallback((id: string) => {
    setAttachedMedia(prev => {
      const removed = prev.find(a => a.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter(a => a.id !== id)
    })
  }, [])

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

  // Submit — builds attachment tags and dispatches structured event
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if ((!chatInput.trim() && attachedMedia.length === 0) || isProcessing || !isConnected) return

    let messageText = chatInput.trim()

    if (attachedMedia.length > 0) {
      const tags = attachedMedia.map(a => {
        const label = a.type === 'image' ? 'IMAGE' : 'VIDEO'
        return `[ATTACHED ${label}: ${a.name} \u2192 ${a.path}]`
      }).join('\n')
      messageText = tags + (messageText ? '\n' + messageText : '')
    }

    window.dispatchEvent(new CustomEvent('chromadon-chat-submit', {
      detail: { text: messageText, media: attachedMedia.length > 0 ? [...attachedMedia] : undefined },
    }))

    setChatInput('')
    setAttachedMedia([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [chatInput, attachedMedia, isProcessing, isConnected, setChatInput])

  // Stop execution handler
  const handleStop = useCallback(() => {
    window.dispatchEvent(new CustomEvent('chromadon-chat-stop'))
  }, [])

  // Escape key to stop execution
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProcessing) {
        handleStop()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isProcessing, handleStop])

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) processFiles(files)
  }, [processFiles])

  return (
    <div
      className={`cyber-panel flex-1 flex flex-col min-h-0 overflow-hidden crystal-grid ${isDragOver ? 'ring-2 ring-chroma-teal/50 ring-inset' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-chroma-teal/10 relative">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-chroma-success animate-pulse' : 'bg-chroma-error'}`} />
          <span className="text-[10px] font-display text-chroma-teal uppercase tracking-[0.2em]">
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
        {/* Energy line accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-chroma-teal/25 to-transparent" />
      </div>

      {/* Messages */}
      <ChatMessages messages={chatMessages} showThinking={showThinkingIndicator} onHintClick={setChatInput} />

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-chroma-teal/5 border-2 border-dashed border-chroma-teal/40 rounded-lg z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" className="text-chroma-teal mx-auto mb-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="text-sm text-chroma-teal font-mono">Drop files here</span>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-white/[0.06]">
        {/* Media preview strip — above input when files are attached */}
        <MediaPreviewStrip attachments={attachedMedia} onRemove={handleRemoveMedia} />

        {/* Media error */}
        {mediaError && (
          <div className="px-2 py-1 text-[10px] text-red-400 font-mono bg-red-500/5">
            {mediaError}
          </div>
        )}

        <div className="p-3">
          <div className="flex gap-1.5 items-end">
            {/* Upload button */}
            <MediaUploadButton
              disabled={!isConnected || isProcessing}
              currentFileCount={attachedMedia.length}
              onFilesSelected={processFiles}
              onError={(msg) => {
                setMediaError(msg)
                setTimeout(() => setMediaError(null), 3000)
              }}
            />

            <textarea
              ref={textareaRef}
              value={chatInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isConnected ? 'Tell CHROMADON what to do...' : 'Connecting...'}
              disabled={!isConnected || isProcessing}
              rows={1}
              className="flex-1 bg-chroma-obsidian/80 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-gray-200 font-mono placeholder-chroma-muted/40 resize-none hover:border-chroma-teal/20 focus:outline-none focus:border-chroma-teal/40 focus:bg-chroma-surface/50 focus:shadow-[0_0_20px_rgba(0,206,209,0.08)] transition-all disabled:opacity-40"
              style={{ minHeight: '36px', maxHeight: '96px' }}
            />
            {isProcessing ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex-shrink-0 h-9 px-3 rounded-lg font-display text-[10px] uppercase tracking-wider transition-all duration-200 bg-red-500/20 border border-red-500/40 text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/30 hover:border-red-500/60 hover:shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse"
                title="Stop execution (Esc)"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-red-400 rounded-sm" />
                  <span>Stop</span>
                </span>
              </button>
            ) : (
              <motion.button
                type="submit"
                disabled={(!chatInput.trim() && attachedMedia.length === 0) || !isConnected}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex-shrink-0 h-9 px-3 rounded-lg font-display text-[10px] uppercase tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed bg-chroma-teal/20 border border-chroma-teal/30 text-chroma-teal shadow-crystal hover:bg-chroma-teal/30 hover:border-chroma-teal/50 hover:shadow-crystal-hover"
              >
                Send
              </motion.button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[9px] text-chroma-muted/50 font-mono">
              {isProcessing ? 'Esc to stop' : 'Enter to send \u00B7 Shift+Enter for newline'}
            </span>
          </div>
        </div>
      </form>
    </div>
  )
}
