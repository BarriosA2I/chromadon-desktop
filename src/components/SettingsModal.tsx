import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import barriosLogo from '@/assets/barrios-a2i-logo.png'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  apiKeyStatus: { hasKey: boolean; keyPreview: string | null }
  onApiKeyStatusChange: (status: { hasKey: boolean; keyPreview: string | null }) => void
  geminiKeyStatus: { hasKey: boolean; keyPreview: string | null }
  onGeminiKeyStatusChange: (status: { hasKey: boolean; keyPreview: string | null }) => void
}

export default function SettingsModal({
  isOpen,
  onClose,
  apiKeyStatus,
  onApiKeyStatusChange,
  geminiKeyStatus,
  onGeminiKeyStatusChange,
}: SettingsModalProps) {
  // Anthropic key state
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Gemini key state
  const [geminiKey, setGeminiKey] = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [isValidatingGemini, setIsValidatingGemini] = useState(false)
  const [isSavingGemini, setIsSavingGemini] = useState(false)
  const [geminiError, setGeminiError] = useState('')
  const [geminiSuccess, setGeminiSuccess] = useState('')

  // General state
  const [brainStatus, setBrainStatus] = useState<{ isRunning: boolean; pid: number | null }>({ isRunning: false, pid: null })
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updatePercent, setUpdatePercent] = useState(0)
  const [updateError, setUpdateError] = useState('')
  const geminiInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      refreshStatus()
      window.electronAPI?.getAppVersion?.().then((v: string) => setAppVersion(v || ''))
      window.electronAPI?.updaterGetStatus?.().then((s: any) => {
        if (s?.status === 'downloaded') {
          setUpdateStatus('downloaded')
          setUpdateVersion(s.version || '')
        } else if (s?.status === 'downloading') {
          setUpdateStatus('downloading')
          setUpdatePercent(s.percent || 0)
        } else if (s?.status === 'available') {
          setUpdateStatus('available')
          setUpdateVersion(s.version || '')
        } else if (s?.status === 'error') {
          setUpdateStatus('error')
          setUpdateError(s.error || 'Unknown error')
        }
      })
      setTimeout(() => geminiInputRef.current?.focus(), 100)
    } else {
      setApiKey('')
      setShowKey(false)
      setError('')
      setSuccessMessage('')
      setGeminiKey('')
      setShowGeminiKey(false)
      setGeminiError('')
      setGeminiSuccess('')
    }
  }, [isOpen])

  // Listen for updater events while modal is open
  useEffect(() => {
    if (!isOpen) return
    const cleanups: (() => void)[] = []
    if (window.electronAPI?.onUpdateAvailable) {
      cleanups.push(window.electronAPI.onUpdateAvailable((info) => {
        setUpdateStatus('available')
        setUpdateVersion(info.version)
      }))
    }
    if (window.electronAPI?.onUpdateNotAvailable) {
      cleanups.push(window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateStatus('up-to-date')
      }))
    }
    if (window.electronAPI?.onUpdateDownloadProgress) {
      cleanups.push(window.electronAPI.onUpdateDownloadProgress((p) => {
        setUpdateStatus('downloading')
        setUpdatePercent(p.percent)
      }))
    }
    if (window.electronAPI?.onUpdateDownloaded) {
      cleanups.push(window.electronAPI.onUpdateDownloaded((info) => {
        setUpdateStatus('downloaded')
        setUpdateVersion(info.version)
      }))
    }
    if (window.electronAPI?.onUpdateError) {
      cleanups.push(window.electronAPI.onUpdateError((info) => {
        setUpdateStatus('error')
        setUpdateError(info.message)
      }))
    }
    return () => cleanups.forEach(fn => fn())
  }, [isOpen])

  const refreshStatus = async () => {
    if (window.electronAPI?.settingsGetApiKeyStatus) {
      const status = await window.electronAPI.settingsGetApiKeyStatus()
      onApiKeyStatusChange(status)
    }
    if (window.electronAPI?.settingsGetGeminiKeyStatus) {
      const status = await window.electronAPI.settingsGetGeminiKeyStatus()
      onGeminiKeyStatusChange(status)
    }
    if (window.electronAPI?.settingsGetBrainStatus) {
      const status = await window.electronAPI.settingsGetBrainStatus()
      setBrainStatus(status)
    }
  }

  // ─── Gemini key handlers ───

  const handleValidateAndSaveGemini = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeminiError('')
    setGeminiSuccess('')

    if (!geminiKey.trim()) {
      setGeminiError('API key is required')
      return
    }

    if (!geminiKey.startsWith('AIza')) {
      setGeminiError('Invalid format. Google AI key must start with AIza')
      return
    }

    setIsValidatingGemini(true)
    const validateResult = await window.electronAPI.settingsValidateGeminiKey(geminiKey.trim())
    setIsValidatingGemini(false)

    if (!validateResult.success) {
      setGeminiError(validateResult.error || 'Validation failed')
      return
    }

    if (!validateResult.valid) {
      setGeminiError(validateResult.error || 'API key is invalid')
      return
    }

    setIsSavingGemini(true)
    const saveResult = await window.electronAPI.settingsSetGeminiKey(geminiKey.trim())
    setIsSavingGemini(false)

    if (!saveResult.success) {
      setGeminiError(saveResult.error || 'Failed to save API key')
      return
    }

    setGeminiKey('')
    const warning = validateResult.warning ? ` Note: ${validateResult.warning}` : ''
    setGeminiSuccess(`Gemini API key saved. Brain server restarting...${warning}`)
    setTimeout(refreshStatus, 3000)
  }

  const handleRemoveGeminiKey = async () => {
    setGeminiError('')
    setGeminiSuccess('')
    const result = await window.electronAPI.settingsRemoveGeminiKey()
    if (result.success) {
      setGeminiSuccess('Gemini API key removed. Brain will use Anthropic as fallback.')
      onGeminiKeyStatusChange({ hasKey: false, keyPreview: null })
      setTimeout(refreshStatus, 3000)
    } else {
      setGeminiError(result.error || 'Failed to remove API key')
    }
  }

  // ─── Anthropic key handlers ───

  const handleValidateAndSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    if (!apiKey.trim()) {
      setError('API key is required')
      return
    }

    if (!apiKey.startsWith('sk-ant-')) {
      setError('Invalid format. Key must start with sk-ant-')
      return
    }

    setIsValidating(true)
    const validateResult = await window.electronAPI.settingsValidateApiKey(apiKey.trim())
    setIsValidating(false)

    if (!validateResult.success) {
      setError(validateResult.error || 'Validation failed')
      return
    }

    if (!validateResult.valid) {
      setError(validateResult.error || 'API key is invalid')
      return
    }

    setIsSaving(true)
    const saveResult = await window.electronAPI.settingsSetApiKey(apiKey.trim())
    setIsSaving(false)

    if (!saveResult.success) {
      setError(saveResult.error || 'Failed to save API key')
      return
    }

    setApiKey('')
    const warning = validateResult.warning ? ` Note: ${validateResult.warning}` : ''
    setSuccessMessage(`Anthropic API key saved. Brain server restarting...${warning}`)
    setTimeout(refreshStatus, 3000)
  }

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    const result = await window.electronAPI?.updaterCheckForUpdates?.()
    if (result && !result.success) {
      if (result.error?.includes('dev mode')) {
        setUpdateStatus('up-to-date')
        return
      }
      setUpdateStatus('error')
      setUpdateError(result.error || 'Check failed')
    }
  }

  const handleRemoveKey = async () => {
    setError('')
    setSuccessMessage('')
    const result = await window.electronAPI.settingsRemoveApiKey()
    if (result.success) {
      setSuccessMessage('Anthropic API key removed.')
      onApiKeyStatusChange({ hasKey: false, keyPreview: null })
      setTimeout(refreshStatus, 3000)
    } else {
      setError(result.error || 'Failed to remove API key')
    }
  }

  // Determine provider display
  const providerLabel = geminiKeyStatus.hasKey
    ? 'Gemini (primary)'
    : apiKeyStatus.hasKey
      ? 'Anthropic only'
      : 'No API Key'
  const providerColor = geminiKeyStatus.hasKey
    ? 'bg-chroma-teal'
    : apiKeyStatus.hasKey
      ? 'bg-chroma-gold'
      : 'bg-chroma-error'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ backdropFilter: 'blur(0px)' }}
            animate={{ backdropFilter: 'blur(12px)' }}
            exit={{ backdropFilter: 'blur(0px)' }}
            className="absolute inset-0 bg-chroma-black/70"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-chroma-teal/20 via-chroma-purple/10 to-chroma-gold/20 blur-xl" />

            {/* Container */}
            <div className="relative cyber-panel rounded-2xl overflow-hidden">
              {/* Gradient border */}
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
                padding: '1px',
                background: 'linear-gradient(135deg, rgba(0, 206, 209, 0.5), rgba(139, 92, 246, 0.3), rgba(212, 175, 55, 0.4))',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }} />

              <div className="relative p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <SettingsGearIcon />
                    <div>
                      <h2 className="heading-cyber text-lg">SETTINGS</h2>
                      <p className="text-xs text-chroma-muted font-mono">Configure CHROMADON</p>
                    </div>
                  </div>
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 rounded-lg text-chroma-muted hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <CloseIcon />
                  </motion.button>
                </div>

                {/* Brain Status Indicator */}
                <div className="mb-6 p-3 rounded-xl bg-chroma-black/40 border border-chroma-teal/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-ui uppercase tracking-wider text-chroma-muted">Brain Server</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${brainStatus.isRunning ? 'bg-chroma-success animate-pulse' : 'bg-chroma-error'}`} />
                      <span className="text-xs font-mono text-chroma-muted">
                        {brainStatus.isRunning ? `Running (PID ${brainStatus.pid})` : 'Stopped'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-ui uppercase tracking-wider text-chroma-muted">AI Provider</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${providerColor}`} />
                      <span className="text-xs font-mono text-chroma-muted">{providerLabel}</span>
                    </div>
                  </div>
                  {geminiKeyStatus.hasKey && apiKeyStatus.hasKey && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-ui uppercase tracking-wider text-chroma-muted">Fallback</span>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-chroma-gold" />
                        <span className="text-xs font-mono text-chroma-muted">Anthropic ({apiKeyStatus.keyPreview})</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ─── Google AI API Key (Primary) ─── */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-sm font-ui font-semibold uppercase tracking-wider text-chroma-teal">
                    Google AI API Key (Primary)
                  </h3>
                  <p className="text-xs text-chroma-muted">
                    Powers all AI features via Gemini. Get your key from{' '}
                    <button
                      onClick={() => window.electronAPI?.tabCreate?.('https://aistudio.google.com/apikey')}
                      className="text-chroma-teal hover:underline"
                    >
                      aistudio.google.com
                    </button>
                  </p>

                  <form onSubmit={handleValidateAndSaveGemini} className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted">
                        {geminiKeyStatus.hasKey ? `Current: ${geminiKeyStatus.keyPreview}` : 'Enter Google AI Key'}
                      </label>
                      <div className="relative">
                        <input
                          ref={geminiInputRef}
                          type={showGeminiKey ? 'text' : 'password'}
                          value={geminiKey}
                          onChange={(e) => setGeminiKey(e.target.value)}
                          placeholder="AIza..."
                          disabled={isValidatingGemini || isSavingGemini}
                          className="w-full px-4 py-3 bg-chroma-black/60 border border-chroma-teal/20 rounded-xl text-white font-mono text-sm placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 transition-colors disabled:opacity-50"
                          style={{ caretColor: '#00CED1' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-chroma-muted hover:text-chroma-teal transition-colors"
                        >
                          {showGeminiKey ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>

                    {/* Gemini Error */}
                    <AnimatePresence>
                      {geminiError && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="px-4 py-3 rounded-lg bg-chroma-error/10 border border-chroma-error/30 text-sm text-chroma-error"
                        >
                          {geminiError}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Gemini Success */}
                    <AnimatePresence>
                      {geminiSuccess && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="px-4 py-3 rounded-lg bg-chroma-success/10 border border-chroma-success/30 text-sm text-chroma-success"
                        >
                          {geminiSuccess}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Gemini Buttons */}
                    <div className="flex gap-3">
                      {geminiKeyStatus.hasKey && (
                        <motion.button
                          type="button"
                          onClick={handleRemoveGeminiKey}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-3 border border-chroma-error/30 rounded-xl text-sm text-chroma-error hover:bg-chroma-error/10 transition-colors"
                        >
                          Remove Key
                        </motion.button>
                      )}
                      <motion.button
                        type="submit"
                        disabled={isValidatingGemini || isSavingGemini || !geminiKey.trim()}
                        whileHover={!(isValidatingGemini || isSavingGemini) ? { scale: 1.02 } : {}}
                        whileTap={!(isValidatingGemini || isSavingGemini) ? { scale: 0.98 } : {}}
                        className="flex-1 py-3 rounded-xl font-display font-bold uppercase tracking-[0.15em] text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-chroma-teal to-chroma-cyan text-chroma-black"
                      >
                        {isValidatingGemini ? 'Validating...' : isSavingGemini ? 'Saving...' : 'Validate & Save'}
                      </motion.button>
                    </div>
                  </form>
                </div>

                {/* ─── Anthropic API Key (Fallback) ─── */}
                <div className="space-y-4">
                  <h3 className="text-sm font-ui font-semibold uppercase tracking-wider text-chroma-gold">
                    Anthropic API Key (Fallback)
                  </h3>
                  <p className="text-xs text-chroma-muted">
                    Optional backup provider if Gemini is unavailable.
                    Get your key from{' '}
                    <button
                      onClick={() => window.electronAPI?.tabCreate?.('https://console.anthropic.com/settings/keys')}
                      className="text-chroma-gold hover:underline"
                    >
                      console.anthropic.com
                    </button>
                  </p>

                  <form onSubmit={handleValidateAndSave} className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted">
                        {apiKeyStatus.hasKey ? `Current: ${apiKeyStatus.keyPreview}` : 'Enter Anthropic Key'}
                      </label>
                      <div className="relative">
                        <input
                          type={showKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-ant-api03-..."
                          disabled={isValidating || isSaving}
                          className="w-full px-4 py-3 bg-chroma-black/60 border border-chroma-gold/20 rounded-xl text-white font-mono text-sm placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-gold/50 transition-colors disabled:opacity-50"
                          style={{ caretColor: '#D4AF37' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey(!showKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-chroma-muted hover:text-chroma-gold transition-colors"
                        >
                          {showKey ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      </div>
                    </div>

                    {/* Anthropic Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="px-4 py-3 rounded-lg bg-chroma-error/10 border border-chroma-error/30 text-sm text-chroma-error"
                        >
                          {error}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Anthropic Success */}
                    <AnimatePresence>
                      {successMessage && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="px-4 py-3 rounded-lg bg-chroma-success/10 border border-chroma-success/30 text-sm text-chroma-success"
                        >
                          {successMessage}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Anthropic Buttons */}
                    <div className="flex gap-3">
                      {apiKeyStatus.hasKey && (
                        <motion.button
                          type="button"
                          onClick={handleRemoveKey}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="px-4 py-3 border border-chroma-error/30 rounded-xl text-sm text-chroma-error hover:bg-chroma-error/10 transition-colors"
                        >
                          Remove Key
                        </motion.button>
                      )}
                      <motion.button
                        type="submit"
                        disabled={isValidating || isSaving || !apiKey.trim()}
                        whileHover={!(isValidating || isSaving) ? { scale: 1.02 } : {}}
                        whileTap={!(isValidating || isSaving) ? { scale: 0.98 } : {}}
                        className="flex-1 py-3 rounded-xl font-display font-bold uppercase tracking-[0.15em] text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-chroma-gold to-yellow-500 text-chroma-black"
                      >
                        {isValidating ? 'Validating...' : isSaving ? 'Saving...' : 'Validate & Save'}
                      </motion.button>
                    </div>
                  </form>
                </div>

                {/* Version & Updates */}
                <div className="mt-6 pt-4 border-t border-chroma-teal/10">
                  <h3 className="text-sm font-ui font-semibold uppercase tracking-wider text-chroma-teal mb-3">
                    Version & Updates
                  </h3>
                  <div className="p-3 rounded-xl bg-chroma-black/40 border border-chroma-teal/10 space-y-3">
                    {/* Current version */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-ui uppercase tracking-wider text-chroma-muted">Current Version</span>
                      <span className="text-xs font-mono text-chroma-teal">{appVersion ? `v${appVersion}` : '...'}</span>
                    </div>

                    {/* Update status */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-ui uppercase tracking-wider text-chroma-muted">Status</span>
                      <div className="flex items-center gap-2">
                        {updateStatus === 'checking' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-gold animate-pulse" />
                            <span className="text-xs font-mono text-chroma-gold">Checking...</span>
                          </>
                        )}
                        {updateStatus === 'up-to-date' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-success" />
                            <span className="text-xs font-mono text-chroma-success">Up to date</span>
                          </>
                        )}
                        {updateStatus === 'available' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-teal animate-pulse" />
                            <span className="text-xs font-mono text-chroma-teal">v{updateVersion} available</span>
                          </>
                        )}
                        {updateStatus === 'downloading' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-teal animate-pulse" />
                            <span className="text-xs font-mono text-chroma-teal">Downloading {updatePercent}%</span>
                          </>
                        )}
                        {updateStatus === 'downloaded' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-success animate-pulse" />
                            <span className="text-xs font-mono text-chroma-success">v{updateVersion} ready</span>
                          </>
                        )}
                        {updateStatus === 'error' && (
                          <>
                            <div className="w-2 h-2 rounded-full bg-chroma-error" />
                            <span className="text-xs font-mono text-chroma-error truncate max-w-[180px]" title={updateError}>Error</span>
                          </>
                        )}
                        {updateStatus === 'idle' && (
                          <span className="text-xs font-mono text-chroma-muted">Not checked</span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      {updateStatus === 'downloaded' ? (
                        <motion.button
                          onClick={() => window.electronAPI?.updaterQuitAndInstall?.()}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="flex-1 py-2 rounded-lg font-display font-bold uppercase tracking-[0.1em] text-xs bg-gradient-to-r from-chroma-success to-chroma-teal text-chroma-black"
                        >
                          Restart to Update
                        </motion.button>
                      ) : (
                        <motion.button
                          onClick={handleCheckForUpdates}
                          disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                          whileHover={updateStatus !== 'checking' ? { scale: 1.02 } : {}}
                          whileTap={updateStatus !== 'checking' ? { scale: 0.98 } : {}}
                          className="flex-1 py-2 rounded-lg font-display font-bold uppercase tracking-[0.1em] text-xs border border-chroma-teal/30 text-chroma-teal hover:bg-chroma-teal/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updateStatus === 'checking' ? 'Checking...' : updateStatus === 'downloading' ? `Downloading ${updatePercent}%` : 'Check for Updates'}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Security notice */}
                <div className="mt-6 pt-4 border-t border-chroma-teal/10">
                  <div className="flex items-start gap-2 text-xs text-chroma-muted">
                    <ShieldIcon />
                    <p>
                      Your API keys are encrypted with your operating system's credential store
                      (Windows DPAPI). They are never stored in plaintext or transmitted externally.
                    </p>
                  </div>
                </div>

                {/* Barrios A2I Branding */}
                <div className="mt-6 pt-4 border-t border-chroma-teal/10 text-center">
                  <img src={barriosLogo} alt="Barrios A2I" className="h-8 mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-chroma-muted">
                    Built by Barrios A2I &mdash; World-class AI systems
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Icons
function SettingsGearIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#settingsGrad)" strokeWidth="2">
      <defs>
        <linearGradient id="settingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
