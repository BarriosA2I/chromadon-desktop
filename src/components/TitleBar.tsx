import { motion } from 'framer-motion'
import { useChromadonStore } from '../store/chromadonStore'

export default function TitleBar() {
  const { isConnected, connectionMode } = useChromadonStore()

  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-10 flex items-center justify-between px-4 bg-chroma-panel/50 border-b border-chroma-teal/20 drag-region"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 no-drag">
        <ChromadonLogo />
        <span className="font-display font-bold text-chroma-teal text-lg tracking-wider">
          CHROMADON
        </span>
        <span className="text-xs font-mono text-chroma-muted">v4.0</span>
      </div>

      {/* Center - Connection Status */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div className={`led ${isConnected ? 'led-green' : 'led-red'}`} />
        <span className="text-sm font-ui text-chroma-muted">
          {isConnected ? `${connectionMode} CONNECTED` : 'DISCONNECTED'}
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1 no-drag">
        <WindowButton onClick={handleMinimize} className="hover:text-chroma-cyan">
          <span className="text-lg leading-none">—</span>
        </WindowButton>
        <WindowButton onClick={handleMaximize} className="hover:text-chroma-cyan">
          <span className="text-sm">□</span>
        </WindowButton>
        <WindowButton onClick={handleClose} className="hover:bg-red-500 hover:text-white">
          <span className="text-lg leading-none">×</span>
        </WindowButton>
      </div>
    </motion.header>
  )
}

function WindowButton({
  onClick,
  children,
  className = '',
}: {
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-8 flex items-center justify-center text-chroma-muted transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

function ChromadonLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-chroma-teal">
      <path
        d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path d="M12 8V6M12 18V16M16 12H18M6 12H8" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
