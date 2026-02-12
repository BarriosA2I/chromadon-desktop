import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type UpdateState = 'idle' | 'downloading' | 'ready' | 'error'

export default function UpdateNotifier() {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const cleanups: (() => void)[] = []

    if (window.electronAPI?.onUpdateAvailable) {
      cleanups.push(window.electronAPI.onUpdateAvailable((info) => {
        setVersion(info.version)
        setState('downloading')
        setDismissed(false)
        setErrorMsg('')
      }))
    }

    if (window.electronAPI?.onUpdateDownloadProgress) {
      cleanups.push(window.electronAPI.onUpdateDownloadProgress((prog) => {
        setProgress(prog.percent)
      }))
    }

    if (window.electronAPI?.onUpdateDownloaded) {
      cleanups.push(window.electronAPI.onUpdateDownloaded((info) => {
        setVersion(info.version)
        setState('ready')
        setDismissed(false)
        setErrorMsg('')
      }))
    }

    if (window.electronAPI?.onUpdateError) {
      cleanups.push(window.electronAPI.onUpdateError((info) => {
        setState('error')
        setErrorMsg(info.message)
        setDismissed(false)
        setChecking(false)
      }))
    }

    // Query cached update status on mount (catches events that fired before React mounted)
    if (window.electronAPI?.updaterGetStatus) {
      window.electronAPI.updaterGetStatus().then((status) => {
        if (status.status === 'downloaded' && status.version) {
          setVersion(status.version)
          setState('ready')
        } else if (status.status === 'downloading' || status.status === 'available') {
          if (status.version) setVersion(status.version)
          setState('downloading')
          if (status.percent) setProgress(status.percent)
        } else if (status.status === 'error') {
          setState('error')
          setErrorMsg(status.error || 'Update check failed')
        }
      })
    }

    return () => cleanups.forEach(fn => fn())
  }, [])

  const handleRetry = async () => {
    if (!window.electronAPI?.updaterCheckForUpdates) return
    setChecking(true)
    setErrorMsg('')
    const result = await window.electronAPI.updaterCheckForUpdates()
    setChecking(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Check failed')
      setState('error')
    }
    // If successful, the update-available or update-not-available events will fire
  }

  const visible = !dismissed && (state === 'downloading' || state === 'ready' || state === 'error')

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative z-50 flex items-center justify-between px-4 py-1.5 border-b"
          style={{
            background: state === 'ready'
              ? 'linear-gradient(90deg, rgba(212,175,55,0.12) 0%, rgba(0,206,209,0.06) 100%)'
              : state === 'error'
              ? 'linear-gradient(90deg, rgba(239,68,68,0.10) 0%, rgba(139,92,246,0.06) 100%)'
              : 'linear-gradient(90deg, rgba(0,206,209,0.08) 0%, rgba(139,92,246,0.06) 100%)',
            borderColor: state === 'ready'
              ? 'rgba(212,175,55,0.3)'
              : state === 'error'
              ? 'rgba(239,68,68,0.25)'
              : 'rgba(0,206,209,0.15)',
          }}
        >
          {/* Download progress background */}
          {state === 'downloading' && (
            <div
              className="absolute inset-0 bg-chroma-teal/5 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          )}

          <div className="relative flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${
              state === 'ready' ? 'bg-chroma-gold animate-pulse'
              : state === 'error' ? 'bg-red-500'
              : 'bg-chroma-teal animate-pulse'
            }`} />
            <span className="text-xs font-mono">
              {state === 'downloading' && (
                <span className="text-chroma-teal">
                  Downloading v{version}... <span className="text-chroma-muted">{progress}%</span>
                </span>
              )}
              {state === 'ready' && (
                <span className="text-chroma-gold">
                  Update v{version} ready
                </span>
              )}
              {state === 'error' && (
                <span className="text-red-400">
                  Update check failed
                </span>
              )}
            </span>
          </div>

          <div className="relative flex items-center gap-2">
            {state === 'ready' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => window.electronAPI?.updaterQuitAndInstall()}
                className="px-2.5 py-0.5 text-[10px] font-ui font-semibold uppercase tracking-wider
                           bg-chroma-gold/20 border border-chroma-gold/40 text-chroma-gold
                           hover:bg-chroma-gold/30 transition-all rounded"
              >
                Restart to Apply
              </motion.button>
            )}
            {state === 'error' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRetry}
                disabled={checking}
                className="px-2.5 py-0.5 text-[10px] font-ui font-semibold uppercase tracking-wider
                           bg-red-500/20 border border-red-500/40 text-red-400
                           hover:bg-red-500/30 transition-all rounded disabled:opacity-50"
              >
                {checking ? 'Checking...' : 'Retry'}
              </motion.button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-0.5 text-chroma-muted hover:text-white transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
