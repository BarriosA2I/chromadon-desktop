import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChromadonStore, Platform, PlatformSession } from '../store/chromadonStore'

interface SessionSetupProps {
  isOpen: boolean
  onClose: () => void
}

// Platform configuration
const PLATFORMS: {
  id: Platform
  name: string
  icon: string
  color: string
  url: string
  description: string
}[] = [
  {
    id: 'google',
    name: 'Google',
    icon: 'G',
    color: '#4285F4',
    url: 'https://accounts.google.com',
    description: 'Gmail, YouTube, Drive, Google Ads',
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: 'X',
    color: '#1DA1F2',
    url: 'https://twitter.com/login',
    description: 'Tweets, DMs, Analytics',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'in',
    color: '#0077B5',
    url: 'https://linkedin.com/login',
    description: 'Posts, Connections, InMail',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'f',
    color: '#1877F2',
    url: 'https://facebook.com/login',
    description: 'Posts, Ads, Messenger',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'IG',
    color: '#E4405F',
    url: 'https://instagram.com/accounts/login',
    description: 'Posts, Stories, Reels',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'YT',
    color: '#FF0000',
    url: 'https://www.youtube.com',
    description: 'Uses Google session — Videos, Analytics',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'TT',
    color: '#000000',
    url: 'https://tiktok.com/login',
    description: 'Videos, Analytics, Ads',
  },
]

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function SessionSetup({
  isOpen,
  onClose,
}: SessionSetupProps) {
  const { platformSessions, setPlatformSessions, sessionBackups, setSessionBackups } = useChromadonStore()
  const [verifyingPlatform, setVerifyingPlatform] = useState<Platform | null>(null)
  const [verifyResult, setVerifyResult] = useState<Record<string, 'verified' | 'expired'>>({})

  // Backup state
  const [backupPrompt, setBackupPrompt] = useState<{ action: 'export' | 'import' | 'exportAll'; platform?: Platform } | null>(null)
  const [backupPassword, setBackupPassword] = useState('')
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupStatus, setBackupStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadBackups = useCallback(async () => {
    if (!window.electronAPI?.sessionListBackups) return
    try {
      const res = await window.electronAPI.sessionListBackups()
      if (res.success) setSessionBackups(res.backups)
    } catch {}
  }, [setSessionBackups])

  // Load sessions + backups on mount
  useEffect(() => {
    if (isOpen && window.electronAPI?.sessionList) {
      window.electronAPI.sessionList().then((result) => {
        if (result.success && result.sessions) {
          setPlatformSessions(result.sessions)
        }
      })
      loadBackups()
    }
  }, [isOpen, setPlatformSessions, loadBackups])

  // Clear status message after 3 seconds
  useEffect(() => {
    if (!backupStatus) return
    const t = setTimeout(() => setBackupStatus(null), 3000)
    return () => clearTimeout(t)
  }, [backupStatus])

  // Verify a platform's auth status (re-checks cookies)
  const verifyPlatform = async (platform: Platform) => {
    if (!window.electronAPI?.sessionVerify) return

    setVerifyingPlatform(platform)
    try {
      const result = await window.electronAPI.sessionVerify(platform)
      const status = result.isAuthenticated ? 'verified' : 'expired'
      setVerifyResult(prev => ({ ...prev, [platform]: status }))
      setTimeout(() => setVerifyResult(prev => {
        const next = { ...prev }
        delete next[platform]
        return next
      }), 3000)
      if (result.success) {
        const res = await window.electronAPI.sessionList()
        if (res.success && res.sessions) {
          setPlatformSessions(res.sessions)
        }
      }
    } catch (err) {
      console.error('Failed to verify platform:', err)
      setVerifyResult(prev => ({ ...prev, [platform]: 'expired' }))
      setTimeout(() => setVerifyResult(prev => {
        const next = { ...prev }
        delete next[platform]
        return next
      }), 3000)
    }
    setVerifyingPlatform(null)
  }

  // Disconnect a platform (clear cookies/session)
  const disconnectPlatform = async (platform: Platform) => {
    if (!window.electronAPI?.sessionClear) return

    setVerifyingPlatform(platform)
    try {
      await window.electronAPI.sessionClear(platform)
      const res = await window.electronAPI.sessionList()
      if (res.success && res.sessions) {
        setPlatformSessions(res.sessions)
      }
    } catch (err) {
      console.error('Failed to disconnect platform:', err)
    }
    setVerifyingPlatform(null)
  }

  // Open OAuth popup for sign-in
  const handleOpenPlatform = async (platform: Platform) => {
    if (!window.electronAPI?.oauthSignIn) {
      console.error('OAuth sign-in API not available')
      return
    }

    if (platform === 'youtube' && platformSessions['google']?.isAuthenticated) {
      if (window.electronAPI?.sessionUpdate) {
        await window.electronAPI.sessionUpdate('youtube', { isAuthenticated: true })
      }
      const sessions = await window.electronAPI.sessionList()
      if (sessions.success && sessions.sessions) {
        setPlatformSessions(sessions.sessions)
      }
      return
    }

    const effectivePlatform = platform === 'youtube' ? 'google' : platform

    setVerifyingPlatform(platform)
    try {
      const result = await window.electronAPI.oauthSignIn(effectivePlatform)
      if (result.success) {
        const sessions = await window.electronAPI.sessionList()
        if (sessions.success && sessions.sessions) {
          setPlatformSessions(sessions.sessions)
        }
      }
    } catch (err) {
      console.error('Failed to open OAuth popup:', err)
    }
    setVerifyingPlatform(null)
  }

  // Execute backup/restore action
  const executeBackupAction = async () => {
    if (!backupPrompt || !backupPassword.trim()) return
    setBackupLoading(true)

    try {
      if (backupPrompt.action === 'export' && backupPrompt.platform) {
        const res = await window.electronAPI.sessionExport(backupPrompt.platform, backupPassword)
        if (res.success) {
          setBackupStatus({ message: `Backed up ${res.cookieCount} cookies for ${backupPrompt.platform}`, type: 'success' })
        }
      } else if (backupPrompt.action === 'import' && backupPrompt.platform) {
        const res = await window.electronAPI.sessionImport(backupPrompt.platform, backupPassword)
        if (res.success) {
          setBackupStatus({ message: `Restored ${res.imported} cookies for ${backupPrompt.platform}`, type: 'success' })
          // Refresh sessions
          const sessions = await window.electronAPI.sessionList()
          if (sessions.success && sessions.sessions) setPlatformSessions(sessions.sessions)
        }
      } else if (backupPrompt.action === 'exportAll') {
        const res = await window.electronAPI.sessionExportAll(backupPassword)
        if (res.success) {
          const total = res.results.reduce((sum: number, r: { cookies: number }) => sum + r.cookies, 0)
          setBackupStatus({ message: `Backed up ${total} cookies across ${res.results.length} platforms`, type: 'success' })
        }
      }
      await loadBackups()
    } catch (err: any) {
      setBackupStatus({ message: err.message || 'Backup operation failed', type: 'error' })
    }

    setBackupLoading(false)
    setBackupPrompt(null)
    setBackupPassword('')
  }

  // Get session status for platform (YouTube inherits Google)
  const getSessionStatus = (platform: Platform): PlatformSession | null => {
    if (platform === 'youtube') {
      const ytSession = platformSessions['youtube']
      const googleSession = platformSessions['google']
      if (googleSession?.isAuthenticated) {
        return { ...googleSession, platform: 'youtube' } as PlatformSession
      }
      return ytSession || null
    }
    return platformSessions[platform] || null
  }

  // Get last backup time for a platform
  const getBackupInfo = (platform: Platform): { exportedAt: number; cookieCount: number } | null => {
    if (!sessionBackups?.backups) return null
    const entry = sessionBackups.backups.find(b => b.platform === platform)
    return entry ? { exportedAt: entry.exportedAt, cookieCount: entry.cookieCount } : null
  }

  const authenticatedCount = PLATFORMS.filter(
    (p) => getSessionStatus(p.id)?.isAuthenticated
  ).length

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
            animate={{ backdropFilter: 'blur(20px)' }}
            exit={{ backdropFilter: 'blur(0px)' }}
            className="absolute inset-0 bg-chroma-black/80"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-2xl mx-4"
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-chroma-teal/30 via-chroma-purple/20 to-chroma-gold/30 blur-xl opacity-50" />

            {/* Main container */}
            <div className="relative cyber-panel rounded-2xl overflow-hidden">
              {/* Animated gradient border */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  padding: '2px',
                  background: 'linear-gradient(135deg, #00CED1, #8B5CF6, #D4AF37, #00CED1)',
                  backgroundSize: '300% 300%',
                  animation: 'gradient-shift 4s ease infinite',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />

              {/* Content */}
              <div className="relative p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring' }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0, 206, 209, 0.2), rgba(139, 92, 246, 0.2))',
                      boxShadow: 'inset 0 0 30px rgba(0, 206, 209, 0.2), 0 0 40px rgba(0, 206, 209, 0.1)',
                    }}
                  >
                    <SessionIcon />
                  </motion.div>

                  <h2 className="heading-cyber text-2xl mb-2">SESSION SETUP</h2>
                  <p className="text-chroma-muted text-sm font-mono">
                    Sign in to your accounts to enable marketing automation.
                    <br />
                    Your sessions persist across app restarts.
                  </p>
                </div>

                {/* Status message */}
                <AnimatePresence>
                  {backupStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`mb-4 p-3 rounded-lg text-xs font-mono text-center ${
                        backupStatus.type === 'success'
                          ? 'bg-chroma-teal/10 text-chroma-teal border border-chroma-teal/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {backupStatus.message}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs font-mono text-chroma-muted mb-2">
                    <span>Authenticated Platforms</span>
                    <span>{authenticatedCount} / {PLATFORMS.length}</span>
                  </div>
                  <div className="h-2 rounded-full bg-chroma-black/60 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #00CED1, #8B5CF6)',
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(authenticatedCount / PLATFORMS.length) * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                {/* Platform Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {PLATFORMS.map((platform, index) => {
                    const session = getSessionStatus(platform.id)
                    const isAuthenticated = session?.isAuthenticated ?? false
                    const isVerifying = verifyingPlatform === platform.id
                    const vResult = verifyResult[platform.id]
                    const backup = getBackupInfo(platform.id)
                    // YouTube shares Google backup
                    const effectiveBackup = platform.id === 'youtube' ? getBackupInfo('google') : backup

                    return (
                      <motion.div
                        key={platform.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${
                          isAuthenticated
                            ? 'border-chroma-teal/50 bg-chroma-teal/5'
                            : 'border-chroma-teal/20 bg-chroma-black/40 hover:border-chroma-teal/40'
                        }`}
                        onClick={() => {
                          if (!isAuthenticated && !verifyingPlatform) {
                            handleOpenPlatform(platform.id)
                          }
                        }}
                      >
                        {/* Platform Icon */}
                        <div className="flex items-center gap-3 mb-2">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                            style={{ backgroundColor: platform.color }}
                          >
                            {platform.icon}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-display text-white">{platform.name}</span>
                              {isAuthenticated && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="text-chroma-teal"
                                >
                                  <CheckIcon />
                                </motion.span>
                              )}
                            </div>
                            <p className="text-xs text-chroma-muted">{platform.description}</p>
                          </div>
                        </div>

                        {/* Status / Account Info */}
                        <div className="mt-3 pt-3 border-t border-white/5">
                          {isAuthenticated ? (
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-chroma-teal font-mono">
                                  {session?.accountEmail || session?.accountName || 'Signed In'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  onClick={(e) => { e.stopPropagation(); verifyPlatform(platform.id) }}
                                  className={`text-xs transition-colors ${
                                    vResult === 'verified' ? 'text-chroma-teal font-semibold' :
                                    vResult === 'expired' ? 'text-red-400 font-semibold' :
                                    'text-chroma-muted hover:text-chroma-teal'
                                  }`}
                                  disabled={isVerifying || !!vResult}
                                >
                                  {isVerifying ? '...' : vResult === 'verified' ? 'OK' : vResult === 'expired' ? 'Expired!' : 'Verify'}
                                </button>
                                {platform.id !== 'youtube' && (
                                  <>
                                    <span className="text-white/10">|</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setBackupPrompt({ action: 'export', platform: platform.id }) }}
                                      className="text-xs text-chroma-muted hover:text-chroma-gold transition-colors"
                                    >
                                      Backup
                                    </button>
                                  </>
                                )}
                                {effectiveBackup && platform.id !== 'youtube' && (
                                  <>
                                    <span className="text-white/10">|</span>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setBackupPrompt({ action: 'import', platform: platform.id }) }}
                                      className="text-xs text-chroma-muted hover:text-chroma-teal transition-colors"
                                    >
                                      Restore
                                    </button>
                                  </>
                                )}
                                <span className="text-white/10">|</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); disconnectPlatform(platform.id) }}
                                  className="text-xs text-chroma-muted hover:text-chroma-error transition-colors"
                                  disabled={isVerifying}
                                >
                                  Disconnect
                                </button>
                              </div>
                              {/* Backup indicator */}
                              {effectiveBackup && (
                                <div className="mt-2 text-[10px] text-chroma-muted/60 font-mono">
                                  Backup: {timeAgo(effectiveBackup.exportedAt)} ({effectiveBackup.cookieCount} cookies)
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-chroma-muted font-mono">Not signed in</span>
                                <div className="flex items-center gap-2">
                                  {effectiveBackup && platform.id !== 'youtube' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setBackupPrompt({ action: 'import', platform: platform.id }) }}
                                      className="text-xs text-chroma-gold hover:text-chroma-gold/80 transition-colors"
                                    >
                                      Restore
                                    </button>
                                  )}
                                  <span className="text-xs text-chroma-teal group-hover:text-white transition-colors">
                                    Click to sign in
                                  </span>
                                </div>
                              </div>
                              {effectiveBackup && (
                                <div className="mt-1 text-[10px] text-chroma-muted/60 font-mono">
                                  Backup available: {timeAgo(effectiveBackup.exportedAt)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Glow effect on hover */}
                        {!isAuthenticated && (
                          <div
                            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            style={{
                              boxShadow: `0 0 30px ${platform.color}20`,
                            }}
                          />
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl border border-chroma-teal/20 text-chroma-muted hover:text-white hover:border-chroma-teal/40 transition-colors font-display uppercase tracking-wider text-sm"
                  >
                    Skip for now
                  </button>
                  {authenticatedCount > 0 && (
                    <motion.button
                      onClick={() => setBackupPrompt({ action: 'exportAll' })}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-3 rounded-xl border border-chroma-gold/30 text-chroma-gold hover:bg-chroma-gold/10 transition-colors font-display uppercase tracking-wider text-sm"
                    >
                      Backup All
                    </motion.button>
                  )}
                  <motion.button
                    onClick={onClose}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 py-3 rounded-xl font-display font-bold uppercase tracking-wider text-sm"
                    style={{
                      background: authenticatedCount > 0
                        ? 'linear-gradient(135deg, #00CED1, #00FFFF)'
                        : 'linear-gradient(135deg, #4a4a4a, #3a3a3a)',
                      color: authenticatedCount > 0 ? '#0A0A0F' : '#888',
                    }}
                  >
                    Continue
                  </motion.button>
                </div>

                {/* Info Notice */}
                <div className="mt-6 pt-4 border-t border-chroma-teal/10">
                  <div className="flex items-start gap-2 text-xs text-chroma-muted">
                    <InfoIcon />
                    <p>
                      Sign in manually to bypass bot detection. Once authenticated,
                      CHROMADON agents can work within your authenticated sessions.
                      Use <span className="text-chroma-gold">Backup</span> to save sessions for recovery.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Password Prompt Modal */}
          <AnimatePresence>
            {backupPrompt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center"
              >
                <div className="absolute inset-0 bg-black/60" onClick={() => { setBackupPrompt(null); setBackupPassword('') }} />
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative z-10 w-full max-w-sm mx-4 cyber-panel rounded-xl p-6 border border-chroma-teal/30"
                >
                  <h3 className="text-sm font-display text-white uppercase tracking-wider mb-1">
                    {backupPrompt.action === 'export' ? 'Backup Session' :
                     backupPrompt.action === 'import' ? 'Restore Session' :
                     'Backup All Sessions'}
                  </h3>
                  <p className="text-xs text-chroma-muted mb-4 font-mono">
                    {backupPrompt.action === 'import'
                      ? 'This will replace current cookies. Enter your backup password.'
                      : 'Enter a password to encrypt the backup.'}
                  </p>
                  <input
                    type="password"
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') executeBackupAction() }}
                    placeholder="Backup password"
                    autoFocus
                    className="w-full px-3 py-2 rounded-lg bg-chroma-black/60 border border-chroma-teal/20 text-white text-sm font-mono focus:border-chroma-teal/60 focus:outline-none mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setBackupPrompt(null); setBackupPassword('') }}
                      className="flex-1 py-2 rounded-lg border border-chroma-teal/20 text-chroma-muted text-xs hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeBackupAction}
                      disabled={backupLoading || !backupPassword.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                      style={{
                        background: backupPrompt.action === 'import'
                          ? 'linear-gradient(135deg, #D4AF37, #FFD700)'
                          : 'linear-gradient(135deg, #00CED1, #00FFFF)',
                        color: '#0A0A0F',
                      }}
                    >
                      {backupLoading ? 'Working...' : backupPrompt.action === 'import' ? 'Restore' : 'Backup'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Icons
function SessionIcon() {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#sessionGradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <linearGradient id="sessionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 11h6" />
      <path d="M19 8v6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}
