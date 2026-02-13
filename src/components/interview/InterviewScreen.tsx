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
        className="fixed inset-0 z-50 flex items-center justify-center bg-chroma-obsidian crystal-grid"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="text-center"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-chroma-success/10 border border-chroma-success/30 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-display uppercase tracking-wider text-chroma-teal mb-3">Interview Complete</h2>
          <p className="text-white/60 font-ui mb-8 max-w-md">Your business profile has been saved. CHROMADON's 27 agents will now use this knowledge for everything.</p>
          <motion.button
            onClick={onComplete}
            className="px-8 py-3 bg-chroma-teal/20 border border-chroma-teal/50 rounded-xl text-chroma-teal font-display uppercase tracking-wider shadow-crystal hover:bg-chroma-teal/30 hover:shadow-crystal-hover transition-all"
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
      className="fixed inset-0 z-50 flex flex-col bg-chroma-obsidian crystal-grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-chroma-teal/10 bg-chroma-obsidian/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-chroma-teal/10 border border-chroma-teal/20 shadow-crystal flex items-center justify-center">
            <span className="text-chroma-teal text-sm font-display">C</span>
          </div>
          <div>
            <h1 className="text-sm font-display uppercase tracking-wider text-chroma-teal">Client Onboarding</h1>
            <p className="text-[10px] text-white/40">{activeClient ? activeClient.name : 'New Client'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {started && interviewProgress && (
            <button
              onClick={handleSkip}
              className="text-xs font-ui text-white/30 hover:text-chroma-teal/70 border border-white/[0.08] px-3 py-1 rounded-lg hover:border-chroma-teal/20 transition-all"
            >
              Skip {PHASE_LABELS[interviewProgress.currentPhase]?.label || 'Phase'} →
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-chroma-teal hover:bg-chroma-teal/10 transition-colors"
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
                className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-chroma-teal/10 border border-chroma-teal/25 shadow-crystal flex items-center justify-center"
                style={{ animation: 'crystal-breathe 3s ease-in-out infinite' }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="intLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00CED1" />
                      <stop offset="50%" stopColor="#00FFFF" />
                      <stop offset="100%" stopColor="#8B5CF6" />
                    </linearGradient>
                  </defs>
                  <path d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z" stroke="url(#intLogoGrad)" strokeWidth="1.5" fill="none" />
                  <circle cx="12" cy="12" r="4" stroke="url(#intLogoGrad)" strokeWidth="1.5" fill="none" />
                  <circle cx="12" cy="12" r="1.5" fill="#00CED1" />
                  <path d="M12 8V6M12 18V16M16 12H18M6 12H8" stroke="#00CED1" strokeWidth="1" strokeLinecap="round" />
                </svg>
              </motion.div>
              <h2 className="text-xl font-display uppercase tracking-wider text-chroma-teal mb-2">Tell Us About Your Business</h2>
              <p className="text-sm text-white/50 font-ui mb-8">CHROMADON will learn everything about your business through a quick AI conversation. This powers personalized content for all 27 agents.</p>
              <div className="relative">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your business name..."
                  className="w-full px-4 py-3 bg-chroma-obsidian/80 border border-white/[0.08] rounded-xl text-white font-ui placeholder-white/30 focus:outline-none focus:border-chroma-teal/40 focus:shadow-[0_0_20px_rgba(0,206,209,0.08)] transition-all"
                  autoFocus
                />
                <button
                  onClick={handleStart}
                  disabled={!clientName.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-lg text-chroma-teal text-sm font-display uppercase tracking-wider disabled:opacity-30 hover:bg-chroma-teal/30 hover:shadow-crystal transition-all"
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
              onSkip={handleSkip}
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
            <div className="flex-shrink-0 px-6 py-4 border-t border-chroma-teal/10 bg-chroma-obsidian/50">
              {/* File preview strip */}
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-chroma-surface/50 border border-chroma-teal/15 rounded-lg text-xs font-mono">
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
              {/* Inline skip strip */}
              {interviewProgress && !interviewLoading && !interviewProgress.isComplete && interviewProgress.currentPhase !== 'complete' && (
                <div className="flex items-center justify-between mb-3 px-3 py-2 bg-chroma-surface/30 border border-white/[0.05] rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PHASE_LABELS[interviewProgress.currentPhase]?.icon || '📋'}</span>
                    <span className="text-xs font-display uppercase tracking-wider text-white/40">{PHASE_LABELS[interviewProgress.currentPhase]?.label || 'Phase'}</span>
                  </div>
                  <button
                    onClick={handleSkip}
                    className="text-xs font-ui text-white/30 hover:text-chroma-teal transition-colors"
                  >
                    Don't have this? Skip →
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || interviewLoading}
                  className="px-3 py-2.5 bg-chroma-surface/50 border border-white/[0.08] rounded-xl text-white/40 hover:text-chroma-teal hover:border-chroma-teal/30 hover:shadow-crystal transition-all disabled:opacity-30"
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
                  className="flex-1 px-4 py-2.5 bg-chroma-obsidian/80 border border-white/[0.08] rounded-xl text-white text-sm font-ui placeholder-white/30 focus:outline-none focus:border-chroma-teal/40 focus:shadow-[0_0_20px_rgba(0,206,209,0.08)] transition-all disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={(!inputMessage.trim() && pendingFiles.length === 0) || interviewLoading || uploading}
                  className="px-5 py-2.5 bg-chroma-teal/20 border border-chroma-teal/30 rounded-xl text-chroma-teal text-sm font-display uppercase tracking-wider shadow-crystal disabled:opacity-30 hover:bg-chroma-teal/30 hover:shadow-crystal-hover transition-all"
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
