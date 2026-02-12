/**
 * useStreamingChat - SSE streaming hook for the CHROMADON Agentic Orchestrator.
 * Consumes the POST /api/orchestrator/chat SSE stream and progressively updates
 * the Zustand store with text deltas and tool call events.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useChromadonStore } from '../store/chromadonStore'

const API_BASE = 'http://localhost:3001'

interface SSEEvent {
  event: string
  data: any
}

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = chunk.split('\n')
  let currentEvent = ''
  let currentData = ''

  for (const line of lines) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      currentData = line.slice(6).trim()
    } else if (line === '' && currentEvent && currentData) {
      try {
        events.push({ event: currentEvent, data: JSON.parse(currentData) })
      } catch {
        events.push({ event: currentEvent, data: currentData })
      }
      currentEvent = ''
      currentData = ''
    }
  }

  return events
}

export function useStreamingChat() {
  const {
    setOrchestratorSessionId,
    addChatMessage,
    addStreamingMessage,
    appendToStreamingMessage,
    addToolCallToMessage,
    updateToolCallInMessage,
    finalizeStreamingMessage,
    setIsProcessing,
  } = useChromadonStore()

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamingMsgIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    // Read isConnected at call time from store (not from closure)
    // to avoid stale closure issues that prevent messages from sending
    const currentIsConnected = useChromadonStore.getState().isConnected
    if (!text.trim() || !currentIsConnected) return

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Read sessionId at call time from store (not from closure)
    // to avoid stale closure issues that abort the stream
    const currentSessionId = useChromadonStore.getState().orchestratorSessionId

    // Add user message immediately
    addChatMessage({ role: 'user', type: 'text', content: text.trim() })
    setIsProcessing(true)

    // Create streaming assistant message placeholder
    const msgId = addStreamingMessage()
    streamingMsgIdRef.current = msgId

    const abort = new AbortController()
    abortControllerRef.current = abort

    try {
      // Wait for brain to be ready (up to 10 seconds)
      let brainReady = false
      for (let i = 0; i < 10; i++) {
        if (abort.signal.aborted) throw new DOMException('Aborted', 'AbortError')
        try {
          const healthRes = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(1000) })
          if (healthRes.ok) {
            const healthData = await healthRes.json()
            if (healthData.orchestrator) {
              brainReady = true
              break
            }
          }
        } catch { /* brain not ready yet */ }
        await new Promise(r => setTimeout(r, 1000))
      }

      if (!brainReady) {
        throw new Error('AI assistant is starting up. Please wait a moment and try again.')
      }

      const chatPayload = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          sessionId: currentSessionId,
        }),
        signal: abort.signal,
      }

      // Fetch with one retry on connection failure
      let response: Response
      try {
        response = await fetch(`${API_BASE}/api/orchestrator/chat`, chatPayload)
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw fetchErr
        // Retry once after 2 seconds
        await new Promise(r => setTimeout(r, 2000))
        response = await fetch(`${API_BASE}/api/orchestrator/chat`, chatPayload)
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse complete SSE events from buffer
        // Events are separated by double newlines
        const parts = buffer.split('\n\n')
        // Keep the last part as buffer (might be incomplete)
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const events = parseSSEChunk(part + '\n')

          for (const evt of events) {
            switch (evt.event) {
              case 'session_id':
                setOrchestratorSessionId(evt.data.sessionId)
                break

              case 'text_delta':
                if (streamingMsgIdRef.current) {
                  appendToStreamingMessage(streamingMsgIdRef.current, evt.data.text)
                }
                break

              case 'tool_start':
                if (streamingMsgIdRef.current) {
                  addToolCallToMessage(streamingMsgIdRef.current, {
                    id: evt.data.id,
                    name: evt.data.name,
                    status: 'calling',
                  })
                }
                break

              case 'tool_executing':
                if (streamingMsgIdRef.current) {
                  updateToolCallInMessage(streamingMsgIdRef.current, evt.data.id, {
                    status: 'executing',
                    input: evt.data.input,
                  })
                }
                break

              case 'tool_result':
                if (streamingMsgIdRef.current) {
                  updateToolCallInMessage(streamingMsgIdRef.current, evt.data.id, {
                    status: evt.data.success ? 'done' : 'error',
                    success: evt.data.success,
                    result: evt.data.result,
                    error: evt.data.error,
                    durationMs: evt.data.durationMs,
                  })
                }
                break

              case 'error':
                if (streamingMsgIdRef.current) {
                  appendToStreamingMessage(streamingMsgIdRef.current, `\n\nError: ${evt.data.message}`)
                }
                break

              case 'done':
                // Stream complete
                break
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return

      // Add error to streaming message or create error message
      if (streamingMsgIdRef.current) {
        const store = useChromadonStore.getState()
        const msg = store.chatMessages.find((m) => m.id === streamingMsgIdRef.current)
        if (msg && !msg.content) {
          // Empty streaming message - add error message instead
          addChatMessage({ role: 'assistant', type: 'error', content: err.message || 'Connection failed' })
        } else {
          appendToStreamingMessage(streamingMsgIdRef.current, `\n\nError: ${err.message}`)
        }
      } else {
        addChatMessage({ role: 'assistant', type: 'error', content: err.message || 'Connection failed' })
      }
    } finally {
      if (streamingMsgIdRef.current) {
        finalizeStreamingMessage(streamingMsgIdRef.current)
      }
      streamingMsgIdRef.current = null
      abortControllerRef.current = null
      setIsProcessing(false)
    }
  }, [
    setOrchestratorSessionId,
    addChatMessage,
    addStreamingMessage,
    appendToStreamingMessage,
    addToolCallToMessage,
    updateToolCallInMessage,
    finalizeStreamingMessage,
    setIsProcessing,
  ])

  const stopExecution = useCallback(async () => {
    // 1. Abort the client-side fetch stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    // 2. Tell the Brain to abort server-side execution (cancels Anthropic API call + tool loop)
    try {
      await fetch(`${API_BASE}/api/orchestrator/stop-all`, { method: 'POST' })
    } catch {
      // Even if request fails, UI state is already updated
    }
    // 3. Finalize any in-progress streaming message
    if (streamingMsgIdRef.current) {
      appendToStreamingMessage(streamingMsgIdRef.current, '\n\nStopped by user.')
      finalizeStreamingMessage(streamingMsgIdRef.current)
      streamingMsgIdRef.current = null
    }
    setIsProcessing(false)
  }, [appendToStreamingMessage, finalizeStreamingMessage, setIsProcessing])

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  // Listen for chat submit events from ChatPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      if (detail) sendMessage(detail)
    }

    window.addEventListener('chromadon-chat-submit', handler)
    return () => {
      window.removeEventListener('chromadon-chat-submit', handler)
      cancelRequest()
    }
  }, [sendMessage, cancelRequest])

  // Listen for stop events from ChatPanel
  useEffect(() => {
    const handler = () => { stopExecution() }
    window.addEventListener('chromadon-chat-stop', handler)
    return () => window.removeEventListener('chromadon-chat-stop', handler)
  }, [stopExecution])

  return { sendMessage, cancelRequest, stopExecution }
}
