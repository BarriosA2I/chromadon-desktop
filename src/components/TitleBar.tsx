import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useChromadonStore } from '../store/chromadonStore'
import ClientSwitcher from './ClientSwitcher'
import chromadonLogo from '@/assets/chromadon-logo-32.png'

export default function TitleBar() {
  const { isConnected, connectionMode, setShowInterviewScreen } = useChromadonStore()
  const [monitoringEnabled, setMonitoringEnabled] = useState(false)

  // Poll monitoring status every 30s
  useEffect(() => {
    if (!isConnected) return
    let mounted = true
    const check = async () => {
      try {
        const status = await window.electronAPI?.monitoringGetStatus()
        if (mounted && status?.enabled !== undefined) setMonitoringEnabled(status.enabled)
      } catch { /* ignore */ }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => { mounted = false; clearInterval(interval) }
  }, [isConnected])

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-10 flex items-center px-4 bg-gradient-to-r from-chroma-panel/80 via-chroma-dark/60 to-chroma-panel/80 border-b border-chroma-teal/10 drag-region backdrop-blur-sm relative"
    >
      {/* Left — Logo */}
      <div className="flex-1 flex items-center gap-3 no-drag min-w-0">
        <motion.div
          className="flex-shrink-0"
          animate={{
            filter: [
              'drop-shadow(0 0 3px #00CED1)',
              'drop-shadow(0 0 8px #00CED1) drop-shadow(0 0 15px rgba(0, 206, 209, 0.5))',
              'drop-shadow(0 0 3px #00CED1)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChromadonLogo />
        </motion.div>
        <span className="heading-cyber text-lg hidden sm:inline">
          CHROMADON
        </span>
        <span className="px-2 py-0.5 text-xs font-mono text-chroma-gold bg-chroma-gold/10 rounded border border-chroma-gold/30 flex-shrink-0">
          v4.0
        </span>
      </div>

      {/* Center — Connection Status + Monitoring */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-1 mx-3 rounded-full bg-chroma-black/40 border border-chroma-teal/10">
        <div className="relative">
          <div className={`led ${isConnected ? 'led-green' : 'led-red'}`} />
          <motion.div
            className={`absolute inset-0 rounded-full ${isConnected ? 'bg-chroma-success' : 'bg-chroma-error'}`}
            animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-sm font-ui font-semibold tracking-wider ${isConnected ? 'text-chroma-teal' : 'text-chroma-error'}`}>
          {isConnected ? connectionMode : 'DISCONNECTED'}
        </span>
        {monitoringEnabled && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <div className="relative" title="Social Monitoring Active">
              <div className="w-2 h-2 rounded-full bg-chroma-gold" />
              <motion.div
                className="absolute inset-0 rounded-full bg-chroma-gold"
                animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' }}
              />
            </div>
            <span className="text-xs font-mono text-chroma-gold/80 tracking-wider">MON</span>
          </>
        )}
      </div>

      {/* Right — Client Switcher + Window Controls */}
      <div className="flex-1 flex items-center justify-end gap-2 no-drag min-w-0">
        <ClientSwitcher onNewClient={() => setShowInterviewScreen(true)} />
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        <WindowButton onClick={handleMinimize} isClose={false}>
          <MinimizeIcon />
        </WindowButton>
        <WindowButton onClick={handleMaximize} isClose={false}>
          <MaximizeIcon />
        </WindowButton>
        <WindowButton onClick={handleClose} isClose>
          <CloseIcon />
        </WindowButton>
      </div>
      {/* Bottom energy line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-chroma-teal/30 to-transparent" />
    </motion.header>
  )
}

function WindowButton({
  onClick,
  children,
  isClose = false,
}: {
  onClick: () => void
  children: React.ReactNode
  isClose?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`
        w-10 h-8 flex items-center justify-center rounded-lg text-chroma-muted
        transition-all duration-200 backdrop-blur-sm
        ${isClose
          ? 'hover:bg-red-500/80 hover:text-white'
          : 'hover:bg-chroma-cyan/20 hover:text-chroma-cyan'
        }
      `}
    >
      {children}
    </motion.button>
  )
}

function ChromadonLogo() {
  return (
    <img
      src={chromadonLogo}
      alt="CHROMADON"
      width={28}
      height={28}
      className="rounded-sm"
    />
  )
}

function MinimizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="6" x2="10" y2="6" />
    </svg>
  )
}

function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  )
}
