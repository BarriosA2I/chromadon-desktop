import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface MasterPasswordModalProps {
  isOpen: boolean
  mode: 'create' | 'unlock'
  failedAttempts?: number
  lockoutRemaining?: number
  onSubmit: (password: string, confirmPassword?: string) => Promise<{ success: boolean; error?: string }>
  onClose?: () => void
}

export default function MasterPasswordModal({
  isOpen,
  mode,
  failedAttempts = 0,
  lockoutRemaining = 0,
  onSubmit,
  onClose,
}: MasterPasswordModalProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Password is required')
      return
    }

    if (mode === 'create') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
    }

    setIsLoading(true)
    const result = await onSubmit(password, mode === 'create' ? confirmPassword : undefined)
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to unlock vault')
      setPassword('')
      setConfirmPassword('')
    }
  }

  const isLockedOut = lockoutRemaining > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop with blur */}
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
            className="relative z-10 w-full max-w-md mx-4"
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
                  {/* Lock Icon */}
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
                    <LockIcon locked={mode === 'unlock'} />
                  </motion.div>

                  <h2 className="heading-cyber text-2xl mb-2">
                    {mode === 'create' ? 'CREATE VAULT' : 'UNLOCK VAULT'}
                  </h2>
                  <p className="text-chroma-muted text-sm font-mono">
                    {mode === 'create'
                      ? 'Set a master password to secure your credentials'
                      : 'Enter your master password to access credentials'}
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Password Field */}
                  <div className="space-y-2">
                    <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted">
                      Master Password
                    </label>
                    <div className="relative group">
                      <input
                        ref={inputRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLockedOut || isLoading}
                        placeholder={isLockedOut ? 'Locked out...' : 'Enter master password'}
                        className="w-full px-4 py-3 bg-chroma-black/60 border border-chroma-teal/20 rounded-xl text-white font-mono placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 transition-colors disabled:opacity-50"
                        style={{ caretColor: '#00CED1' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-chroma-muted hover:text-chroma-teal transition-colors"
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                      {/* Focus glow */}
                      <div className="absolute inset-0 -z-10 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
                        style={{
                          boxShadow: '0 0 20px rgba(0, 206, 209, 0.3)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Confirm Password (create mode only) */}
                  {mode === 'create' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        placeholder="Confirm master password"
                        className="w-full px-4 py-3 bg-chroma-black/60 border border-chroma-teal/20 rounded-xl text-white font-mono placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 transition-colors"
                        style={{ caretColor: '#00CED1' }}
                      />
                    </motion.div>
                  )}

                  {/* Error Message */}
                  <AnimatePresence>
                    {(error || isLockedOut) && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 px-4 py-3 rounded-lg bg-chroma-error/10 border border-chroma-error/30"
                      >
                        <WarningIcon />
                        <span className="text-sm text-chroma-error">
                          {isLockedOut
                            ? `Locked out. Try again in ${lockoutRemaining}s`
                            : error}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Failed Attempts Warning */}
                  {failedAttempts > 0 && !isLockedOut && (
                    <div className="flex items-center gap-2 text-xs text-chroma-warning">
                      <WarningIcon size={14} />
                      <span>{5 - failedAttempts} attempts remaining before lockout</span>
                    </div>
                  )}

                  {/* Password Strength (create mode) */}
                  {mode === 'create' && password.length > 0 && (
                    <PasswordStrength password={password} />
                  )}

                  {/* Submit Button */}
                  <motion.button
                    type="submit"
                    disabled={isLoading || isLockedOut}
                    whileHover={!isLoading && !isLockedOut ? { scale: 1.02 } : {}}
                    whileTap={!isLoading && !isLockedOut ? { scale: 0.98 } : {}}
                    className="relative w-full py-4 rounded-xl font-display font-bold uppercase tracking-[0.2em] text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: isLoading
                        ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
                        : 'linear-gradient(135deg, #00CED1, #00FFFF)',
                      color: isLoading ? 'white' : '#0A0A0F',
                    }}
                  >
                    {/* Shine sweep */}
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    />

                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-white/30" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-white/30" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-white/30" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-white/30" />

                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isLoading ? (
                        <>
                          <LoadingSpinner />
                          {mode === 'create' ? 'CREATING...' : 'UNLOCKING...'}
                        </>
                      ) : (
                        mode === 'create' ? 'CREATE VAULT' : 'UNLOCK'
                      )}
                    </span>
                  </motion.button>
                </form>

                {/* Security Notice */}
                <div className="mt-6 pt-4 border-t border-chroma-teal/10">
                  <div className="flex items-start gap-2 text-xs text-chroma-muted">
                    <ShieldIcon />
                    <p>
                      Your credentials are encrypted with AES-256-GCM.
                      {mode === 'create'
                        ? ' Choose a strong password - it cannot be recovered if lost.'
                        : ' Never share your master password.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function PasswordStrength({ password }: { password: string }) {
  const getStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
    if (/\d/.test(pwd)) score++
    if (/[^a-zA-Z\d]/.test(pwd)) score++
    return score
  }

  const strength = getStrength(password)
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['#EF4444', '#F97316', '#FBBF24', '#10B981', '#00CED1']

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            className="h-1 flex-1 rounded-full bg-chroma-black"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: i < strength ? '100%' : '0%' }}
              style={{ backgroundColor: colors[strength - 1] || colors[0] }}
              transition={{ duration: 0.3 }}
            />
          </motion.div>
        ))}
      </div>
      <p className="text-xs font-mono" style={{ color: colors[strength - 1] || colors[0] }}>
        {labels[strength - 1] || 'Too Short'}
      </p>
    </div>
  )
}

// Icons
function LockIcon({ locked = true }: { locked?: boolean }) {
  return (
    <motion.svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#lockGradient)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={locked ? {} : { rotate: [0, -10, 10, 0] }}
      transition={{ duration: 0.5 }}
    >
      <defs>
        <linearGradient id="lockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      {locked ? (
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      ) : (
        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
      )}
    </motion.svg>
  )
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function WarningIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  )
}
