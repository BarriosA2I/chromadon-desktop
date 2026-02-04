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
      className="h-10 flex items-center justify-between px-4 bg-gradient-to-r from-chroma-panel/80 via-chroma-dark/60 to-chroma-panel/80 border-b border-chroma-teal/20 drag-region backdrop-blur-sm"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 no-drag">
        <motion.div
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
        <span className="heading-cyber text-lg">
          CHROMADON
        </span>
        <span className="px-2 py-0.5 text-xs font-mono text-chroma-gold bg-chroma-gold/10 rounded border border-chroma-gold/30">
          v4.0
        </span>
      </div>

      {/* Center - Connection Status */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1 rounded-full bg-chroma-black/40 border border-chroma-teal/10">
        <div className="relative">
          <div className={`led ${isConnected ? 'led-green' : 'led-red'}`} />
          {/* Pulse ring */}
          <motion.div
            className={`absolute inset-0 rounded-full ${isConnected ? 'bg-chroma-success' : 'bg-chroma-error'}`}
            animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        </div>
        <span className={`text-sm font-ui font-semibold tracking-wide ${isConnected ? 'text-chroma-teal' : 'text-chroma-error'}`}>
          {isConnected ? `${connectionMode}` : 'DISCONNECTED'}
        </span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-1 no-drag">
        <WindowButton onClick={handleMinimize} hoverColor="chroma-cyan">
          <MinimizeIcon />
        </WindowButton>
        <WindowButton onClick={handleMaximize} hoverColor="chroma-cyan">
          <MaximizeIcon />
        </WindowButton>
        <WindowButton onClick={handleClose} hoverColor="red-500" isClose>
          <CloseIcon />
        </WindowButton>
      </div>
    </motion.header>
  )
}

function WindowButton({
  onClick,
  children,
  hoverColor,
  isClose = false,
}: {
  onClick: () => void
  children: React.ReactNode
  hoverColor: string
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
          : `hover:bg-${hoverColor}/20 hover:text-${hoverColor}`
        }
      `}
    >
      {children}
    </motion.button>
  )
}

function ChromadonLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="50%" stopColor="#00FFFF" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L21.5 7.5V16.5L12 22L2.5 16.5V7.5L12 2Z"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="4" stroke="url(#logoGradient)" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="12" r="1.5" fill="#00CED1" />
      <path d="M12 8V6M12 18V16M16 12H18M6 12H8" stroke="#00CED1" strokeWidth="1" strokeLinecap="round" />
    </svg>
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
