import axios, { CancelTokenSource } from 'axios'
import { useRef } from 'react'
import { useChromadonStore, ActionType } from '../store/chromadonStore'

const API_BASE = 'http://localhost:3001'

export function useChromadonAPI() {
  const {
    setConnected,
    setBrainAvailable,
    setAIState,
    setConfidence,
    setCircuitState,
    setCognitiveMode,
    setIsProcessing,
    setTabs,
    addActionLog,
    setMemoryStats,
    setCommand,
  } = useChromadonStore()

  // Track if we've already warned about Brain API being unavailable
  const brainApiWarnedRef = useRef(false)

  // Track active requests for cancellation
  const activeCommandRef = useRef<CancelTokenSource | null>(null)

  const connect = async (): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 })
      const data = response.data

      if (data.status === 'healthy') {
        setConnected(true, data.mode)
        setBrainAvailable(true)
        addActionLog({
          type: 'success',
          description: `Connected to CHROMADON Brain (${data.mode} mode)`,
          success: true,
        })
        brainApiWarnedRef.current = false // Reset warning flag on successful connection
        return true
      }
      setBrainAvailable(false)
      return false
    } catch (error) {
      // Only warn once about Brain API being unavailable
      // Don't override connection state - embedded mode still works
      // Don't add action log - this is expected when Brain isn't running
      setBrainAvailable(false)
      if (!brainApiWarnedRef.current) {
        console.warn('[CHROMADON] Brain API not available at', API_BASE, '- AI features disabled')
        brainApiWarnedRef.current = true
      }
      return false
    }
  }

  const fetchTabs = async (): Promise<void> => {
    try {
      const response = await axios.get(`${API_BASE}/api/pages`)
      if (response.data.success) {
        const pages = response.data.data.pages.map((page: any) => ({
          id: page.index,
          url: page.url,
          title: page.title,
          active: page.selected,
        }))
        setTabs(pages)
      }
    } catch (error) {
      console.error('Failed to fetch tabs:', error)
    }
  }

  const fetchAIStatus = async (): Promise<void> => {
    try {
      const response = await axios.get(`${API_BASE}/api/ai/status`, { timeout: 3000 })
      if (response.data.success) {
        const data = response.data.data

        if (data.memoryStats) {
          setMemoryStats(data.memoryStats)
        }

        if (data.circuitBreakerState) {
          setCircuitState(data.circuitBreakerState.state)
        }
      }
    } catch (error) {
      // Silently ignore - Brain API not running is expected
      // AI status is optional when running in embedded mode
    }
  }

  const executeCommand = async (command: string): Promise<void> => {
    // Cancel any in-flight command
    if (activeCommandRef.current) {
      activeCommandRef.current.cancel('New command supersedes previous')
    }

    const cancelSource = axios.CancelToken.source()
    activeCommandRef.current = cancelSource

    setIsProcessing(true)
    setAIState('thinking')

    addActionLog({
      type: 'navigate',
      description: `Processing: "${command}"`,
      success: true,
    })

    try {
      const response = await axios.post(`${API_BASE}/api/mission/ai`, {
        command,
        minConfidence: 0.5,
      }, {
        timeout: 120000,
        cancelToken: cancelSource.token,
      })

      const data = response.data

      if (data.success) {
        setAIState('executing')
        setConfidence(data.data.confidence || data.confidence || 0.95)
        setCognitiveMode(data.data.cognitiveMode || data.data.processingMode || 'hybrid')

        // Log each executed action
        if (data.data.executionResults) {
          for (const result of data.data.executionResults) {
            const actionType = mapActionType(result.action)
            addActionLog({
              type: actionType,
              description: result.description || result.details || result.action,
              duration: result.durationMs,
              success: result.success,
            })
          }
        }

        // Log observation response if present
        if (data.data.response && data.data.actionsPlanned === 0) {
          addActionLog({
            type: 'success',
            description: `Observation: ${data.data.response.slice(0, 200)}`,
            success: true,
          })
        }

        // Final success log
        addActionLog({
          type: 'success',
          description: `Command completed (${data.data.cognitiveMode || data.data.processingMode || 'hybrid'}, ${Math.round((data.data.confidence || 0.95) * 100)}% confidence)`,
          duration: data.data.latencyMs || data.data.duration,
          success: true,
        })

        setAIState('idle')
        setCommand('')
      } else {
        throw new Error(data.data?.error || 'Command execution failed')
      }
    } catch (error: any) {
      // Don't log cancellation as an error
      if (axios.isCancel(error)) {
        return
      }

      console.error('Command execution failed:', error)
      setAIState('error')

      addActionLog({
        type: 'error',
        description: error.message || 'Command execution failed',
        success: false,
      })

      // Reset to idle after error display
      setTimeout(() => setAIState('idle'), 3000)
    } finally {
      activeCommandRef.current = null
      setIsProcessing(false)
      // Refresh tabs after execution
      fetchTabs()
    }
  }

  // Cancel any active command (call on unmount)
  const cancelActiveCommand = () => {
    if (activeCommandRef.current) {
      activeCommandRef.current.cancel('Component unmounted')
      activeCommandRef.current = null
    }
  }

  return {
    connect,
    fetchTabs,
    fetchAIStatus,
    executeCommand,
    cancelActiveCommand,
  }
}

function mapActionType(action: string): ActionType {
  switch (action?.toLowerCase()) {
    case 'navigate':
      return 'navigate'
    case 'click':
      return 'click'
    case 'type':
    case 'fill':
      return 'type'
    case 'scroll':
      return 'scroll'
    case 'wait':
      return 'wait'
    case 'screenshot':
      return 'screenshot'
    case 'extract':
      return 'extract'
    case 'hover':
      return 'hover'
    default:
      return 'success'
  }
}
