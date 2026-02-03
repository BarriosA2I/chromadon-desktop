import axios from 'axios'
import { useChromadonStore, ActionType } from '../store/chromadonStore'

const API_BASE = 'http://localhost:3001'

export function useChromadonAPI() {
  const {
    setConnected,
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

  const connect = async (): Promise<boolean> => {
    try {
      const response = await axios.get(`${API_BASE}/health`, { timeout: 5000 })
      const data = response.data

      if (data.status === 'healthy') {
        setConnected(true, data.mode)
        addActionLog({
          type: 'success',
          description: `Connected to CHROMADON (${data.mode} mode)`,
          success: true,
        })
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to connect to CHROMADON:', error)
      setConnected(false)
      addActionLog({
        type: 'error',
        description: 'Failed to connect to CHROMADON API',
        success: false,
      })
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
      const response = await axios.get(`${API_BASE}/api/ai/status`)
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
      console.error('Failed to fetch AI status:', error)
    }
  }

  const executeCommand = async (command: string): Promise<void> => {
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
      }, { timeout: 120000 })

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
      setIsProcessing(false)
      // Refresh tabs after execution
      fetchTabs()
    }
  }

  return {
    connect,
    fetchTabs,
    fetchAIStatus,
    executeCommand,
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
