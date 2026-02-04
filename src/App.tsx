import { useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChromadonStore, EmbeddedTab } from './store/chromadonStore'
import { useChromadonAPI } from './hooks/useChromadonAPI'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import CommandInput from './components/CommandInput'
import AIStatusPanel from './components/AIStatusPanel'
import TabBar from './components/TabBar'
import ActionLog from './components/ActionLog'

function App() {
  const store = useChromadonStore()
  const { showSplash, setShowSplash, isConnected, setCommand, setEmbeddedTabs, setConnected, addActionLog } = store
  const { connect, fetchAIStatus, executeCommand } = useChromadonAPI()

  useEffect(() => {
    // Initialize connection after splash - use embedded mode
    const timer = setTimeout(async () => {
      // Set connected in embedded mode (no external Brain API needed for basic browsing)
      setConnected(true, 'EMBEDDED')
      setShowSplash(false)

      // Also try to connect to Brain API for AI features
      await connect()

      addActionLog({
        type: 'success',
        description: 'CHROMADON Desktop Browser ready (Embedded Mode)',
        success: true,
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  // Poll for AI status updates when connected to Brain API
  useEffect(() => {
    if (!isConnected) return

    const pollInterval = setInterval(() => {
      fetchAIStatus()
    }, 5000)

    // Initial fetch
    fetchAIStatus()

    return () => clearInterval(pollInterval)
  }, [isConnected])

  // Listen for embedded tab updates from Electron
  useEffect(() => {
    if (window.electronAPI?.onTabsUpdated) {
      window.electronAPI.onTabsUpdated((tabs: EmbeddedTab[]) => {
        setEmbeddedTabs(tabs)
      })
    }

    // Initial tab list fetch
    if (window.electronAPI?.tabList) {
      window.electronAPI.tabList().then((result) => {
        if (result.success) {
          setEmbeddedTabs(result.tabs as EmbeddedTab[])
        }
      })
    }
  }, [setEmbeddedTabs])

  // Claude Code Control: Listen for external commands
  useEffect(() => {
    if (window.electronAPI?.onExternalCommand) {
      window.electronAPI.onExternalCommand(async (command: string) => {
        console.log('[CHROMADON] External command received:', command)
        setCommand(command)
        // Small delay to let UI update, then execute
        setTimeout(async () => {
          await executeCommand(command)
        }, 100)
      })
    }
  }, [executeCommand, setCommand])

  // Claude Code Control: Send state updates to main process
  useEffect(() => {
    if (window.electronAPI?.sendStateUpdate) {
      const stateToSend = {
        isConnected: store.isConnected,
        connectionMode: store.connectionMode,
        aiState: store.aiState,
        confidence: store.confidence,
        circuitState: store.circuitState,
        cognitiveMode: store.cognitiveMode,
        command: store.command,
        isProcessing: store.isProcessing,
        tabs: store.embeddedTabs, // Use embedded tabs
        actionLogs: store.actionLogs.slice(-20), // Last 20 logs
        memoryStats: store.memoryStats,
      }
      window.electronAPI.sendStateUpdate(stateToSend)
    }
  }, [
    store.isConnected,
    store.connectionMode,
    store.aiState,
    store.confidence,
    store.circuitState,
    store.cognitiveMode,
    store.command,
    store.isProcessing,
    store.embeddedTabs,
    store.actionLogs,
    store.memoryStats,
  ])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-chroma-black">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" />
        ) : (
          <MainUI key="main" />
        )}
      </AnimatePresence>
    </div>
  )
}

function MainUI() {
  const { embeddedTabs, addActionLog } = useChromadonStore()

  // Tab management handlers
  const handleTabCreate = useCallback(async () => {
    if (window.electronAPI?.tabCreate) {
      const result = await window.electronAPI.tabCreate('about:blank')
      if (result.success) {
        addActionLog({
          type: 'success',
          description: `Created new tab #${result.id}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleTabClose = useCallback(async (id: number) => {
    if (window.electronAPI?.tabClose) {
      const result = await window.electronAPI.tabClose(id)
      if (result.success) {
        addActionLog({
          type: 'success',
          description: `Closed tab #${id}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleTabFocus = useCallback(async (id: number) => {
    if (window.electronAPI?.tabFocus) {
      await window.electronAPI.tabFocus(id)
    }
  }, [])

  const handleNavigate = useCallback(async (id: number, url: string) => {
    if (window.electronAPI?.tabNavigate) {
      const result = await window.electronAPI.tabNavigate(id, url)
      if (result.success) {
        addActionLog({
          type: 'navigate',
          description: `Navigating to ${url}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleBack = useCallback(async (id: number) => {
    if (window.electronAPI?.tabBack) {
      await window.electronAPI.tabBack(id)
    }
  }, [])

  const handleForward = useCallback(async (id: number) => {
    if (window.electronAPI?.tabForward) {
      await window.electronAPI.tabForward(id)
    }
  }, [])

  const handleReload = useCallback(async (id: number) => {
    if (window.electronAPI?.tabReload) {
      await window.electronAPI.tabReload(id)
    }
  }, [])

  return (
    <>
      <TitleBar />
      <TabBar
        tabs={embeddedTabs}
        onTabCreate={handleTabCreate}
        onTabClose={handleTabClose}
        onTabFocus={handleTabFocus}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
      />
      <main className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Column - Browser View Area (BrowserView renders here via Electron) */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Placeholder when no tabs */}
          {embeddedTabs.length === 0 && (
            <div className="flex-1 flex items-center justify-center bg-chroma-dark/30 m-2 rounded-lg border border-chroma-teal/20">
              <div className="text-center">
                <div className="text-6xl mb-4">🌐</div>
                <h2 className="text-xl font-bold text-chroma-teal mb-2">Welcome to CHROMADON</h2>
                <p className="text-chroma-muted mb-4">Click + to open a new tab and start browsing</p>
                <button
                  onClick={handleTabCreate}
                  className="px-6 py-2 bg-chroma-teal/20 border border-chroma-teal rounded-lg text-chroma-teal hover:bg-chroma-teal/30 transition-colors"
                >
                  Open New Tab
                </button>
              </div>
            </div>
          )}
          {/* BrowserView renders in this space (managed by Electron main process) */}
          {embeddedTabs.length > 0 && (
            <div className="flex-1 bg-chroma-dark/20 m-2 rounded-lg border border-chroma-teal/10">
              {/* BrowserView is positioned here by Electron */}
            </div>
          )}
          {/* Command Input at bottom */}
          <div className="p-2">
            <CommandInput />
          </div>
        </div>

        {/* Right Column - AI Status & Logs */}
        <div className="w-80 flex flex-col gap-2 p-2">
          <AIStatusPanel />
          <ActionLog />
        </div>
      </main>
    </>
  )
}

export default App
