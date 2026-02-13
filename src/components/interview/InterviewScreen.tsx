import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import InterviewPhaseIndicator from './InterviewPhaseIndicator'
import InterviewChat from './InterviewChat'
import { useClientContext } from '../../hooks/useClientContext'

interface Props {
  onComplete: () => void
}

export default function InterviewScreen({ onComplete }: Props) {
  const {
    activeClient,
    interviewMessages,
    interviewProgress,
    interviewLoading,
    startInterview,
    sendInterviewMessage,
    skipPhase,
  } = useClientContext()

  const [clientName, setClientName] = useState('')
  const [inputMessage, setInputMessage] = useState('')
  const [started, setStarted] = useState(false)

  const handleStart = useCallback(async () => {
    if (!clientName.trim()) return
    setStarted(true)
    await startInterview(clientName.trim())
  }, [clientName, startInterview])

  const handleSend = useCallback(async () => {
    if (!inputMessage.trim() || !activeClient || interviewLoading) return
    const msg = inputMessage.trim()
    setInputMessage('')
    await sendInterviewMessage(activeClient.id, msg)
  }, [inputMessage, activeClient, interviewLoading, sendInterviewMessage])

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
        {started && interviewProgress && (
          <button
            onClick={handleSkip}
            className="text-xs text-white/30 hover:text-white/60 border border-white/10 px-3 py-1 rounded-lg transition-colors"
          >
            Skip Phase →
          </button>
        )}
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
            <InterviewChat messages={interviewMessages} isLoading={interviewLoading} />

            {/* Input bar */}
            <div className="px-6 py-4 border-t border-white/10 bg-chroma-panel/30">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response..."
                  disabled={interviewLoading}
                  className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-chroma-teal/50 disabled:opacity-50"
                  autoFocus
                />
                <button
                  onClick={handleSend}
                  disabled={!inputMessage.trim() || interviewLoading}
                  className="px-5 py-2.5 bg-chroma-teal/20 border border-chroma-teal/40 rounded-xl text-chroma-teal text-sm font-medium disabled:opacity-30 hover:bg-chroma-teal/30 transition-colors"
                >
                  Send
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
