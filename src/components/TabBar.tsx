import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface TabBarProps {
  tabs: TabInfo[]
  onTabCreate: () => void
  onTabClose: (id: number) => void
  onTabFocus: (id: number) => void
  onNavigate: (id: number, url: string) => void
  onBack: (id: number) => void
  onForward: (id: number) => void
  onReload: (id: number) => void
}

export default function TabBar({
  tabs,
  onTabCreate,
  onTabClose,
  onTabFocus,
  onNavigate,
  onBack,
  onForward,
  onReload,
}: TabBarProps) {
  const [urlInput, setUrlInput] = useState('')
  const [isEditingUrl, setIsEditingUrl] = useState(false)
  const [isUrlFocused, setIsUrlFocused] = useState(false)

  const activeTab = tabs.find((t) => t.isActive)

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (activeTab && urlInput.trim()) {
      onNavigate(activeTab.id, urlInput.trim())
      setIsEditingUrl(false)
    }
  }

  const handleUrlFocus = () => {
    setIsEditingUrl(true)
    setIsUrlFocused(true)
    setUrlInput(activeTab?.url || '')
  }

  const handleUrlBlur = () => {
    setIsUrlFocused(false)
    setTimeout(() => setIsEditingUrl(false), 200)
  }

  const getFaviconUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`
    } catch {
      return null
    }
  }

  const getHostname = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  const isSecure = (url: string) => {
    try {
      return new URL(url).protocol === 'https:'
    } catch {
      return false
    }
  }

  return (
    <div className="bg-gradient-to-b from-chroma-panel/80 to-chroma-black/60 border-b border-chroma-teal/20">
      {/* Tab Strip */}
      <div className="flex items-center gap-1 px-2 pt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-chroma-teal/30">
        <AnimatePresence mode="popLayout">
          {tabs.map((tab) => (
            <motion.div
              key={tab.id}
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ duration: 0.2 }}
              whileHover={{ y: -2 }}
              className={`
                group relative flex items-center gap-2 px-4 py-2.5
                rounded-t-xl cursor-pointer min-w-[140px] max-w-[220px]
                transition-all duration-200
                ${tab.isActive
                  ? 'bg-gradient-to-b from-chroma-teal/15 to-transparent'
                  : 'bg-chroma-black/30 hover:bg-chroma-dark/50'
                }
              `}
              onClick={() => onTabFocus(tab.id)}
            >
              {/* Active tab glow border */}
              {tab.isActive && (
                <motion.div
                  className="absolute inset-0 rounded-t-xl pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div
                    className="absolute inset-0 rounded-t-xl"
                    style={{
                      padding: '1px',
                      background: 'linear-gradient(180deg, rgba(0, 206, 209, 0.5) 0%, rgba(0, 206, 209, 0.1) 100%)',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
                  {/* Top glow */}
                  <div className="absolute -top-1 left-1/4 right-1/4 h-1 bg-chroma-teal/30 blur-sm rounded-full" />
                </motion.div>
              )}

              {/* Favicon with loading state */}
              <div className="w-5 h-5 flex-shrink-0 rounded overflow-hidden bg-chroma-panel/50">
                {tab.url && tab.url !== 'about:blank' ? (
                  <img
                    src={getFaviconUrl(tab.url) || ''}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-chroma-muted">
                    <GlobeIcon />
                  </div>
                )}
              </div>

              {/* Title */}
              <span className={`
                flex-1 text-sm font-ui truncate transition-colors
                ${tab.isActive ? 'text-white' : 'text-chroma-muted group-hover:text-chroma-teal'}
              `}>
                {tab.title || getHostname(tab.url) || 'New Tab'}
              </span>

              {/* Close Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.id)
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-chroma-error/20 hover:text-chroma-error text-chroma-muted transition-all"
              >
                <XIcon />
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* New Tab Button */}
        <motion.button
          onClick={onTabCreate}
          whileHover={{ scale: 1.1, backgroundColor: 'rgba(0, 206, 209, 0.2)' }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-9 h-9 rounded-xl text-chroma-muted hover:text-chroma-teal transition-colors"
          title="New Tab"
        >
          <PlusIcon />
        </motion.button>
      </div>

      {/* Navigation Bar */}
      {activeTab && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-3 px-3 py-2.5 bg-chroma-dark/30"
        >
          {/* Navigation Buttons Group */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-chroma-black/30">
            {/* Back */}
            <NavButton
              onClick={() => onBack(activeTab.id)}
              disabled={!activeTab.canGoBack}
              title="Back"
            >
              <ArrowLeftIcon />
            </NavButton>

            {/* Forward */}
            <NavButton
              onClick={() => onForward(activeTab.id)}
              disabled={!activeTab.canGoForward}
              title="Forward"
            >
              <ArrowRightIcon />
            </NavButton>

            {/* Reload */}
            <NavButton
              onClick={() => onReload(activeTab.id)}
              title="Reload"
            >
              <ReloadIcon />
            </NavButton>
          </div>

          {/* URL Bar */}
          <motion.form
            onSubmit={handleUrlSubmit}
            className="flex-1 relative"
            animate={isUrlFocused ? { scale: 1.01 } : { scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className={`
                relative flex items-center px-4 py-2 rounded-xl transition-all duration-300
                ${isUrlFocused
                  ? 'bg-chroma-black/80 shadow-[0_0_20px_rgba(0,206,209,0.15)]'
                  : 'bg-chroma-black/40 hover:bg-chroma-black/50'
                }
              `}
            >
              {/* Animated border on focus */}
              <AnimatePresence>
                {isUrlFocused && (
                  <motion.div
                    className="absolute inset-0 rounded-xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        padding: '1px',
                        background: 'linear-gradient(90deg, #00CED1, #8B5CF6, #00CED1)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient-shift 3s ease infinite',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Security indicator */}
              {activeTab.url && isSecure(activeTab.url) && (
                <div className="mr-2 text-chroma-success">
                  <LockIcon />
                </div>
              )}

              <input
                type="text"
                value={isEditingUrl ? urlInput : activeTab.url}
                onChange={(e) => setUrlInput(e.target.value)}
                onFocus={handleUrlFocus}
                onBlur={handleUrlBlur}
                placeholder="Enter URL or search..."
                className="flex-1 bg-transparent text-sm font-mono text-white placeholder-chroma-muted/50 focus:outline-none"
              />
            </div>
          </motion.form>
        </motion.div>
      )}

      {/* Empty State */}
      {tabs.length === 0 && (
        <div className="flex items-center justify-center py-4 text-chroma-muted">
          <span className="text-sm font-mono tracking-wide">Click + to open a new tab</span>
        </div>
      )}
    </div>
  )
}

function NavButton({
  onClick,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.1 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className={`
        p-2 rounded-lg transition-colors
        ${disabled
          ? 'text-chroma-muted/30 cursor-not-allowed'
          : 'text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10'
        }
      `}
      title={title}
    >
      {children}
    </motion.button>
  )
}

// Icons
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

function ReloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
