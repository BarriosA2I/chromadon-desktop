import axios, { CancelTokenSource } from 'axios'
import { useRef, useEffect, useCallback } from 'react'
import { useChromadonStore } from '../store/chromadonStore'
import type { ActionResult } from '../store/chatTypes'

const API_BASE = 'http://localhost:3001'

export function useChatAPI() {
  const {
    addChatMessage,
    setShowThinkingIndicator,
    setAIState,
    setConfidence,
    setCognitiveMode,
    setIsProcessing,
    setChatInput,
  } = useChromadonStore()

  const activeRequestRef = useRef<CancelTokenSource | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    // Cancel any in-flight request
    if (activeRequestRef.current) {
      activeRequestRef.current.cancel('New message supersedes previous')
    }

    const cancelSource = axios.CancelToken.source()
    activeRequestRef.current = cancelSource

    // Add user message to chat
    addChatMessage({ role: 'user', type: 'text', content: text })

    setIsProcessing(true)
    setAIState('thinking')
    setShowThinkingIndicator(true)

    try {
      const response = await axios.post(`${API_BASE}/api/mission/ai`, {
        command: text,
        minConfidence: 0.5,
      }, {
        timeout: 120000,
        cancelToken: cancelSource.token,
      })

      const data = response.data

      setShowThinkingIndicator(false)

      if (data.success) {
        setAIState('executing')
        setConfidence(data.data.confidence || 0.95)
        setCognitiveMode(data.data.cognitiveMode || 'hybrid')

        // Add thinking message if present
        if (data.data.thinking) {
          addChatMessage({
            role: 'assistant',
            type: 'thinking',
            content: data.data.thinking,
          })
        }

        // Add action card if actions were executed
        if (data.data.executionResults?.length > 0) {
          const actions: ActionResult[] = data.data.executionResults.map((r: any) => ({
            action: r.action,
            selector: r.selector,
            description: r.description || r.details,
            success: r.success,
            details: r.details,
            durationMs: r.durationMs,
          }))

          addChatMessage({
            role: 'assistant',
            type: 'action-card',
            content: `Executed ${data.data.actionsSucceeded}/${data.data.actionsExecuted} actions`,
            metadata: {
              actions,
              confidence: data.data.confidence,
              cognitiveMode: data.data.cognitiveMode,
              duration: data.data.duration,
              currentUrl: data.data.currentUrl,
              currentTitle: data.data.currentTitle,
            },
          })

          // Summary response
          const succeeded = data.data.actionsSucceeded || 0
          const total = data.data.actionsExecuted || 0
          const mode = data.data.cognitiveMode || 'hybrid'
          const conf = Math.round((data.data.confidence || 0.95) * 100)
          const dur = data.data.duration ? `${(data.data.duration / 1000).toFixed(1)}s` : ''

          addChatMessage({
            role: 'assistant',
            type: 'text',
            content: `Done. ${succeeded}/${total} actions completed${dur ? ` in ${dur}` : ''} (${mode}, ${conf}% confidence).`,
            metadata: {
              confidence: data.data.confidence,
              cognitiveMode: mode,
            },
          })
        }

        // Observation response (no actions, just description)
        if (data.data.response && (!data.data.executionResults || data.data.executionResults.length === 0)) {
          addChatMessage({
            role: 'assistant',
            type: 'text',
            content: data.data.response,
            metadata: {
              confidence: data.data.confidence,
              cognitiveMode: data.data.cognitiveMode,
            },
          })
        }

        // If no response and no actions, generic acknowledgment
        if (!data.data.response && (!data.data.executionResults || data.data.executionResults.length === 0)) {
          addChatMessage({
            role: 'assistant',
            type: 'text',
            content: 'Command processed, but no actions were needed.',
          })
        }

        setAIState('idle')
      } else {
        throw new Error(data.data?.error || 'Command execution failed')
      }
    } catch (error: any) {
      setShowThinkingIndicator(false)

      if (axios.isCancel(error)) {
        return
      }

      console.error('Chat command failed:', error)
      setAIState('error')

      addChatMessage({
        role: 'assistant',
        type: 'error',
        content: error.message || 'Something went wrong. Please try again.',
      })

      setTimeout(() => setAIState('idle'), 3000)
    } finally {
      activeRequestRef.current = null
      setIsProcessing(false)
    }
  }, [addChatMessage, setShowThinkingIndicator, setAIState, setConfidence, setCognitiveMode, setIsProcessing])

  // Listen for chat submit events from ChatPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail
      if (text) sendMessage(text)
    }
    window.addEventListener('chromadon-chat-submit', handler)
    return () => window.removeEventListener('chromadon-chat-submit', handler)
  }, [sendMessage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.cancel('Component unmounted')
        activeRequestRef.current = null
      }
    }
  }, [])

  return { sendMessage }
}
