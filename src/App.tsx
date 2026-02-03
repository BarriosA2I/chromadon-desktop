import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChromadonStore } from './store/chromadonStore'
import { useChromadonAPI } from './hooks/useChromadonAPI'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import CommandInput from './components/CommandInput'
import AIStatusPanel from './components/AIStatusPanel'
import TabsGrid from './components/TabsGrid'
import ActionLog from './components/ActionLog'

function App() {
  const { showSplash, setShowSplash, isConnected } = useChromadonStore()
  const { connect, fetchTabs, fetchAIStatus } = useChromadonAPI()

  useEffect(() => {
    // Initialize connection after splash
    const timer = setTimeout(async () => {
      await connect()
      setShowSplash(false)
    }, 3500)

    return () => clearTimeout(timer)
  }, [])

  // Poll for updates when connected
  useEffect(() => {
    if (!isConnected) return

    const pollInterval = setInterval(() => {
      fetchTabs()
      fetchAIStatus()
    }, 5000)

    // Initial fetch
    fetchTabs()
    fetchAIStatus()

    return () => clearInterval(pollInterval)
  }, [isConnected])

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
  return (
    <>
      <TitleBar />
      <main className="flex-1 p-4 flex gap-4 overflow-hidden">
        {/* Left Column - Command & Tabs */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <CommandInput />
          <TabsGrid />
        </div>

        {/* Right Column - AI Status & Logs */}
        <div className="w-80 flex flex-col gap-4">
          <AIStatusPanel />
          <ActionLog />
        </div>
      </main>
    </>
  )
}

export default App
