import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InterviewPhaseIndicator from './InterviewPhaseIndicator'
import InterviewChat from './InterviewChat'
import { useClientContext } from '../../hooks/useClientContext'

const FILE_ICONS: Record<string, string> = {
  pdf: '📕', docx: '📘', doc: '📘', csv: '📊', xlsx: '📊',
  txt: '📝', md: '📝', json: '📋', xml: '📋',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
  mp3: '🎵', wav: '🎵', mp4: '🎬', webm: '🎬',
}

function getFileIcon(name: string) {
  return FILE_ICONS[name.split('.').pop()?.toLowerCase() || ''] || '📎'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

interface Props {
  onComplete: () => void
  onClose: () => void
}

export default function InterviewScreen({ onComplete, onClose }: Props) {
  const {
    activeClient,
    interviewMessages,
    interviewProgress,
    interviewLoading,
    error,
    startInterview,
    sendInterviewMessage,
    skipPhase,
    uploadDocument,
  } = useClientContext()

  const [clientName, setClientName] = useState('')
  const [inputMessage, setInputMessage] = useState('')
  const [started, setStarted] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleStart = useCallback(async () => {
    if (!clientName.trim()) return
    setStarted(true)
    await startInterview(clientName.trim())
  }, [clientName, startInterview])

  const handleRetry = useCallback(async () => {
    if (!clientName.trim()) return
    await startInterview(clientName.trim())
  }, [clientName, startInterview])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }, [])

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleUploadFiles = useCallback(async () => {
    if (!activeClient || pendingFiles.length === 0) return
    setUploading(true)
    let uploaded = 0
    for (const file of pendingFiles) {
      const result = await uploadDocument(activeClient.id, file)
      if (result) uploaded++
    }
    setPendingFiles([])
    setUploading(false)
    if (uploaded > 0) {
      await sendInterviewMessage(activeClient.id, `[Uploaded ${uploaded} file(s) to the knowledge vault]`)
    }
  }, [activeClient, pendingFiles, uploadDocument, sendInterviewMessage])

  const handleSend = useCallback(async () => {
    if (!activeClient || interviewLoading) return
    // Upload pending files first
    if (pendingFiles.length > 0) {
      await handleUploadFiles()
    }
    // Then send text message
    if (inputMessage.trim()) {
      const msg = inputMessage.trim()
      setInputMessage('')
      await sendInterviewMessage(activeClient.id, msg)
    }
  }, [inputMessage, activeClient, interviewLoading, pendingFiles, handleUploadFiles, sendInterviewMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (started) handleSend()
      else handleStart()
    }
  }, [started, handleSend, handleStart])

  const handleSkip = useCallback(async () => {
    if (!activeClient || !interviewProgress) return
    const phases = ['greeting', 'discovery', 'products', 'audience', 'competitors', 'voice_capture', 'document_upload', 'strategy_mapping', 'complete'] as const
    const currentIdx = phases.indexOf(interviewProgress.currentPhase)
    if (currentIdx < phases.length - 1) {
      await skipPhase(activeClient.id, phases[currentIdx + 1])
    }
  }, [activeClient, interviewProgress, skipPhase])

  // Check if complete
  if (interviewProgress?.isComplete) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-chroma-dark"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-chroma-teal mb-3">Interview Complete</h2>
          <p className="text-white/60 mb-8 max-w-md">Your business profile has been saved. CHROMADON's 27 agents will now use this knowledge for everything.</p>
          <motion.button
            onClick={onComplete}
            className="px-8 py-3 bg-chroma-teal/20 border border-chroma-teal/50 rounded-xl text-chroma-teal font-bold uppercase tracking-wider hover:bg-chroma-teal/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Continue to Dashboard
          </motion.button>
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-chroma-dark"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-chroma-panel/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-chroma-teal/20 border border-chroma-teal/40 flex items-center justify-center">
            <span className="text-chroma-teal text-sm font-bold">C</span>
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tight text-white">Client Onboarding</h1>
            <p className="text-[10px] text-white/40">{activeClient ? activeClient.name : 'New Client'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {started && interviewProgress && (
            <button
              onClick={handleSkip}
              className="text-xs text-white/30 hover:text-white/60 border border-white/10 px-3 py-1 rounded-lg transition-colors"
            >
              Skip Phase →
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Phase indicator */}
      {started && interviewProgress && (
        <InterviewPhaseIndicator
          currentPhase={interviewProgress.currentPhase}
          completedPhases={interviewProgress.completedPhases}
          percentComplete={interviewProgress.percentComplete}
        />
      )}

      {/* Chat area or start screen */}
      <AnimatePresence mode="wait">
        {!started ? (
          <motion.div
            key="start"
            className="flex-1 flex items-center justify-center px-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="max-w-md w-full text-center">
              <motion.div
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-chroma-teal/20 to-chroma-gold/10 border border-chroma-teal/30 flex items-center justify-center"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
              >
                <span className="text-3xl">🧠</span>
              </motion.div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mb-2">Tell Us About Your Business</h2>
              <p className="text-sm text-white/50 mb-8">CHROMADON will learn everything about your business through a quick AI conversation. This powers personalized content for all 27 agents.</p>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your business name..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-chroma-teal/50 focus:ring-1 focus:ring-chroma-teal/20"
                  autoFocus
                />
                <button
                  onClick={handleStart}
                  disabled={!clientName.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-sm font-medium disabled:opacity-30 hover:bg-chroma-teal/30 transition-colors"
                >
                  Start
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            className="flex-1 flex flex-col min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <InterviewChat
              messages={interviewMessages}
              isLoading={interviewLoading}
              error={error}
              onRetry={handleRetry}
              currentPhase={interviewProgress?.currentPhase}
              onUpload={() => fileInputRef.current?.click()}
            />

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.json,.xml,.yaml"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Input bar */}
            <div className="px-6 py-4 border-t border-white/10 bg-chroma-panel/30">
              {/* File preview strip */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-chroma-teal/20 rounded-lg text-xs">
                      <span>{getFileIcon(file.name)}</span>
                      <span className="text-white/70 max-w-[120px] truncate">{file.name}</span>
                      <span className="text-white/30">{formatSize(file.size)}</span>
                      <button
                        onClick={() => removePendingFile(i)}
                        className="text-white/20 hover:text-red-400 transition-colors ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || interviewLoading}
                  className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/40 hover:text-chroma-teal hover:border-chroma-teal/30 transition-colors disabled:opacity-30"
                  title="Attach documents"
                >
                  {uploading ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeDashoffset="10" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response..."
                  disabled={interviewLoading || uploading}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-chroma-teal/50 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={(!inputMessage.trim() && pendingFiles.length === 0) || interviewLoading || uploading}
                  className="px-5 py-2.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-xl text-chroma-teal text-sm font-medium disabled:opacity-30 hover:bg-chroma-teal/30 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Send'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
