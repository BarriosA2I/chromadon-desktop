/**
 * Client Context Hook — Brain API Integration
 *
 * Provides functions for interview, document vault, strategy,
 * and client management via the Brain API on :3001.
 *
 * @author Barrios A2I
 */

import { useState, useCallback, useRef } from 'react'
import type {
  ClientInfo,
  InterviewMessage,
  InterviewProgress,
  KnowledgeDocument,
  SearchResult,
  GrowthStrategy,
} from '../store/clientContextTypes'

const BRAIN_URL = 'http://127.0.0.1:3001'

// ============================================================================
// HOOK
// ============================================================================

export function useClientContext() {
  const [clients, setClients] = useState<ClientInfo[]>([])
  const [activeClient, setActiveClient] = useState<ClientInfo | null>(null)
  const [interviewMessages, setInterviewMessages] = useState<InterviewMessage[]>([])
  const [interviewProgress, setInterviewProgress] = useState<InterviewProgress | null>(null)
  const [interviewLoading, setInterviewLoading] = useState(false)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [strategy, setStrategy] = useState<GrowthStrategy | null>(null)
  const [strategyLoading, setStrategyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const brainWarnedRef = useRef(false)

  // =========================================================================
  // CLIENT MANAGEMENT
  // =========================================================================

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/clients`)
      const data = await res.json()
      if (data.success) {
        setClients(data.data)
        brainWarnedRef.current = false
      }
    } catch (e) {
      if (!brainWarnedRef.current) {
        console.warn('[useClientContext] Brain API not available - client features disabled')
        brainWarnedRef.current = true
      }
    }
  }, [])

  const fetchActiveClient = useCallback(async () => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/clients/active`)
      const data = await res.json()
      if (data.success && data.data) {
        setActiveClient(data.data)
      } else {
        setActiveClient(null)
      }
      brainWarnedRef.current = false
    } catch (e) {
      if (!brainWarnedRef.current) {
        console.warn('[useClientContext] Brain API not available - client features disabled')
        brainWarnedRef.current = true
      }
    }
  }, [])

  const switchClient = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/clients/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      const data = await res.json()
      if (data.success) {
        setActiveClient(data.data)
        return true
      }
      return false
    } catch (e) {
      console.error('[useClientContext] switchClient failed:', e)
      return false
    }
  }, [])

  const deleteClient = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/clients/${clientId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        await fetchClients()
        if (activeClient?.id === clientId) setActiveClient(null)
      }
      return data.success
    } catch (e) {
      console.error('[useClientContext] deleteClient failed:', e)
      return false
    }
  }, [fetchClients, activeClient])

  // =========================================================================
  // INTERVIEW
  // =========================================================================

  const startInterview = useCallback(async (clientName: string) => {
    setInterviewLoading(true)
    setInterviewMessages([])
    setError(null)
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/interview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'error') {
              setError(event.error || 'Interview failed')
            } else if (event.type === 'client_created') {
              await fetchClients()
              setActiveClient({ id: event.clientId, name: clientName, createdAt: new Date().toISOString(), lastActiveAt: new Date().toISOString(), interviewComplete: false, documentCount: 0, hasStrategy: false })
            } else if (event.type === 'message') {
              setInterviewMessages(prev => [...prev, { role: event.role, content: event.content, phase: 'greeting', timestamp: new Date().toISOString() }])
            } else if (event.type === 'phase') {
              setInterviewProgress(prev => prev ? { ...prev, currentPhase: event.phase } : { currentPhase: event.phase, completedPhases: [], totalPhases: 9, percentComplete: 0, isComplete: false })
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setInterviewLoading(false)
    }
  }, [fetchClients])

  const sendInterviewMessage = useCallback(async (clientId: string, message: string) => {
    setInterviewLoading(true)
    setError(null)
    setInterviewMessages(prev => [...prev, { role: 'user', content: message, phase: interviewProgress?.currentPhase || 'greeting', timestamp: new Date().toISOString() }])

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/interview/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, message }),
        signal: abortRef.current.signal,
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'error') {
              setError(event.error || 'Interview chat failed')
            } else if (event.type === 'message') {
              setInterviewMessages(prev => [...prev, { role: event.role, content: event.content, phase: interviewProgress?.currentPhase || 'greeting', timestamp: new Date().toISOString() }])
            } else if (event.type === 'phase_change') {
              setInterviewProgress(prev => prev ? { ...prev, currentPhase: event.phase, completedPhases: event.completedPhases } : null)
            } else if (event.type === 'progress') {
              setInterviewProgress(event)
            } else if (event.type === 'interview_complete') {
              setInterviewProgress(prev => prev ? { ...prev, isComplete: true, percentComplete: 100 } : null)
              await fetchClients()
            }
          } catch {}
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setError(e.message)
    } finally {
      setInterviewLoading(false)
    }
  }, [interviewProgress, fetchClients])

  const skipPhase = useCallback(async (clientId: string, phase: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/interview/skip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, phase }),
      })
      const data = await res.json()
      if (data.success) {
        setInterviewProgress({ currentPhase: data.data.currentPhase, completedPhases: data.data.completedPhases, totalPhases: 9, percentComplete: Math.round((data.data.completedPhases.length / 8) * 100), isComplete: data.data.isComplete })
      }
    } catch (e) {
      console.error('[useClientContext] skipPhase failed:', e)
    }
  }, [])

  // =========================================================================
  // DOCUMENTS
  // =========================================================================

  const fetchDocuments = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/documents/list?clientId=${clientId}`)
      const data = await res.json()
      if (data.success) setDocuments(data.data)
    } catch (e) {
      console.error('[useClientContext] fetchDocuments failed:', e)
    }
  }, [])

  const uploadDocument = useCallback(async (clientId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      const res = await fetch(`${BRAIN_URL}/api/client-context/documents/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        await fetchDocuments(clientId)
        return data.data
      }
      return null
    } catch (e) {
      console.error('[useClientContext] uploadDocument failed:', e)
      return null
    }
  }, [fetchDocuments])

  const deleteDocument = useCallback(async (clientId: string, docId: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/documents/${docId}?clientId=${clientId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) await fetchDocuments(clientId)
      return data.success
    } catch (e) {
      console.error('[useClientContext] deleteDocument failed:', e)
      return false
    }
  }, [fetchDocuments])

  const searchKnowledge = useCallback(async (clientId: string, query: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, query, topK: 10 }),
      })
      const data = await res.json()
      if (data.success) setSearchResults(data.data.results || data.data)
    } catch (e) {
      console.error('[useClientContext] searchKnowledge failed:', e)
    }
  }, [])

  // =========================================================================
  // STRATEGY
  // =========================================================================

  const generateStrategy = useCallback(async (clientId: string) => {
    setStrategyLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/strategy/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })

      const reader = res.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'strategy') {
              setStrategy(event.data)
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStrategyLoading(false)
    }
  }, [])

  const fetchStrategy = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/strategy?clientId=${clientId}`)
      const data = await res.json()
      if (data.success && data.data) setStrategy(data.data)
    } catch (e) {
      console.error('[useClientContext] fetchStrategy failed:', e)
    }
  }, [])

  const generateCalendar = useCallback(async (clientId: string, weeks: number = 4) => {
    try {
      const res = await fetch(`${BRAIN_URL}/api/client-context/strategy/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, weeks }),
      })
      const data = await res.json()
      if (data.success) {
        setStrategy(prev => prev ? { ...prev, contentCalendar: data.data } : null)
      }
    } catch (e) {
      console.error('[useClientContext] generateCalendar failed:', e)
    }
  }, [])

  return {
    // State
    clients,
    activeClient,
    interviewMessages,
    interviewProgress,
    interviewLoading,
    documents,
    searchResults,
    strategy,
    strategyLoading,
    error,

    // Client management
    fetchClients,
    fetchActiveClient,
    switchClient,
    deleteClient,

    // Interview
    startInterview,
    sendInterviewMessage,
    skipPhase,

    // Documents
    fetchDocuments,
    uploadDocument,
    deleteDocument,
    searchKnowledge,

    // Strategy
    generateStrategy,
    fetchStrategy,
    generateCalendar,
  }
}
