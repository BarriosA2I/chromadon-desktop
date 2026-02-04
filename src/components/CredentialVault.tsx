import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Credential {
  id: string
  profileId: string
  domain: string
  displayName: string
  type: 'password' | 'oauth' | 'api-key'
  username?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount: number
}

interface CredentialVaultProps {
  isOpen: boolean
  credentials: Credential[]
  currentProfileId: string | null
  currentDomain?: string
  onClose: () => void
  onAdd: (credential: Omit<Credential, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => Promise<{ success: boolean; error?: string }>
  onEdit: (id: string, updates: Partial<Credential>) => Promise<{ success: boolean; error?: string }>
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  onAutofill: (credentialId: string) => Promise<{ success: boolean; error?: string }>
  onCopyUsername: (credentialId: string) => Promise<{ success: boolean }>
  onCopyPassword: (credentialId: string) => Promise<{ success: boolean; clearAfterSeconds?: number }>
}

export default function CredentialVault({
  isOpen,
  credentials,
  currentProfileId,
  currentDomain,
  onClose,
  onAdd,
  onEdit,
  onDelete,
  onAutofill,
  onCopyUsername,
  onCopyPassword,
}: CredentialVaultProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [copiedField, setCopiedField] = useState<{ id: string; field: 'username' | 'password' } | null>(null)

  // Filter credentials by search query
  const filteredCredentials = credentials.filter(c => {
    const query = searchQuery.toLowerCase()
    return (
      c.domain.toLowerCase().includes(query) ||
      c.displayName.toLowerCase().includes(query) ||
      c.username?.toLowerCase().includes(query) ||
      c.tags.some(t => t.toLowerCase().includes(query))
    )
  })

  // Sort: matching domain first, then by last used
  const sortedCredentials = [...filteredCredentials].sort((a, b) => {
    if (currentDomain) {
      const aMatches = a.domain.includes(currentDomain)
      const bMatches = b.domain.includes(currentDomain)
      if (aMatches && !bMatches) return -1
      if (!aMatches && bMatches) return 1
    }
    return (b.lastUsedAt || 0) - (a.lastUsedAt || 0)
  })

  const handleCopy = async (id: string, field: 'username' | 'password') => {
    const result = field === 'username'
      ? await onCopyUsername(id)
      : await onCopyPassword(id)

    if (result.success) {
      setCopiedField({ id, field })
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const getFaviconUrl = (domain: string) => {
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  }

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
            className="relative z-10 w-full max-w-2xl max-h-[80vh] mx-4 flex flex-col"
          >
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-chroma-teal/20 via-chroma-purple/10 to-chroma-gold/20 blur-xl" />

            {/* Container */}
            <div className="relative cyber-panel rounded-2xl flex flex-col overflow-hidden">
              {/* Gradient border */}
              <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  padding: '1px',
                  background: 'linear-gradient(135deg, rgba(0, 206, 209, 0.5), rgba(139, 92, 246, 0.3), rgba(212, 175, 55, 0.4))',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
              />

              {/* Header */}
              <div className="relative px-6 py-4 border-b border-chroma-teal/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <VaultIcon />
                    <div>
                      <h2 className="heading-cyber text-lg">CREDENTIAL VAULT</h2>
                      <p className="text-xs text-chroma-muted font-mono">
                        {credentials.length} credential{credentials.length !== 1 ? 's' : ''} stored
                      </p>
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

                {/* Search Bar */}
                <div className="mt-4 relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-chroma-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search credentials..."
                    className="w-full pl-10 pr-4 py-2.5 bg-chroma-black/50 border border-chroma-teal/20 rounded-xl text-sm text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50 transition-colors"
                  />
                </div>
              </div>

              {/* Credentials List */}
              <div className="relative flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {sortedCredentials.length === 0 ? (
                  <div className="text-center py-12">
                    <KeyIcon className="mx-auto mb-4 text-chroma-muted/50" />
                    <p className="text-chroma-muted text-sm">
                      {searchQuery ? 'No credentials match your search' : 'No credentials stored yet'}
                    </p>
                    <motion.button
                      onClick={() => setShowAddModal(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="mt-4 px-4 py-2 text-sm font-ui text-chroma-teal border border-chroma-teal/30 rounded-lg hover:bg-chroma-teal/10 transition-colors"
                    >
                      Add First Credential
                    </motion.button>
                  </div>
                ) : (
                  sortedCredentials.map((credential, index) => (
                    <motion.div
                      key={credential.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`group relative p-4 rounded-xl transition-all ${
                        currentDomain && credential.domain.includes(currentDomain)
                          ? 'bg-chroma-teal/10 border border-chroma-teal/30'
                          : 'bg-chroma-black/40 border border-chroma-teal/10 hover:border-chroma-teal/30'
                      }`}
                    >
                      {/* Domain match indicator */}
                      {currentDomain && credential.domain.includes(currentDomain) && (
                        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-chroma-teal text-chroma-black text-xs font-bold rounded-full">
                          MATCH
                        </div>
                      )}

                      <div className="flex items-center gap-4">
                        {/* Favicon */}
                        <div className="w-10 h-10 rounded-lg bg-chroma-panel flex items-center justify-center overflow-hidden">
                          <img
                            src={getFaviconUrl(credential.domain)}
                            alt=""
                            className="w-6 h-6"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-ui font-semibold text-white truncate">
                            {credential.displayName}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-chroma-muted font-mono truncate">
                              {credential.domain}
                            </span>
                            {credential.username && (
                              <>
                                <span className="text-chroma-teal/30">|</span>
                                <span className="text-xs text-chroma-teal font-mono truncate">
                                  {credential.username}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Copy Username */}
                          {credential.username && (
                            <motion.button
                              onClick={() => handleCopy(credential.id, 'username')}
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="p-2 rounded-lg text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10 transition-colors"
                              title="Copy username"
                            >
                              {copiedField?.id === credential.id && copiedField?.field === 'username' ? (
                                <CheckIcon />
                              ) : (
                                <UserIcon />
                              )}
                            </motion.button>
                          )}

                          {/* Copy Password */}
                          <motion.button
                            onClick={() => handleCopy(credential.id, 'password')}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 rounded-lg text-chroma-muted hover:text-chroma-purple hover:bg-chroma-purple/10 transition-colors"
                            title="Copy password"
                          >
                            {copiedField?.id === credential.id && copiedField?.field === 'password' ? (
                              <CheckIcon />
                            ) : (
                              <KeySmallIcon />
                            )}
                          </motion.button>

                          {/* Autofill */}
                          <motion.button
                            onClick={() => onAutofill(credential.id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 rounded-lg text-chroma-muted hover:text-chroma-gold hover:bg-chroma-gold/10 transition-colors"
                            title="Auto-fill"
                          >
                            <AutofillIcon />
                          </motion.button>

                          {/* Edit */}
                          <motion.button
                            onClick={() => setEditingCredential(credential)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 rounded-lg text-chroma-muted hover:text-white hover:bg-white/10 transition-colors"
                            title="Edit"
                          >
                            <EditIcon />
                          </motion.button>

                          {/* Delete */}
                          <motion.button
                            onClick={() => onDelete(credential.id)}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-2 rounded-lg text-chroma-muted hover:text-chroma-error hover:bg-chroma-error/10 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon />
                          </motion.button>
                        </div>
                      </div>

                      {/* Tags & Stats */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-chroma-teal/10">
                        <div className="flex items-center gap-2">
                          {credential.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs font-mono text-chroma-teal bg-chroma-teal/10 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-chroma-muted">
                          Used {credential.usageCount}x
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="relative px-6 py-4 border-t border-chroma-teal/20">
                <motion.button
                  onClick={() => setShowAddModal(true)}
                  whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(0, 206, 209, 0.3)' }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 rounded-xl font-display font-bold uppercase tracking-[0.15em] text-sm bg-gradient-to-r from-chroma-teal to-chroma-cyan text-chroma-black"
                >
                  + Add Credential
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Add/Edit Modal */}
          <AnimatePresence>
            {(showAddModal || editingCredential) && (
              <CredentialForm
                credential={editingCredential}
                profileId={currentProfileId!}
                onSubmit={async (data) => {
                  if (editingCredential) {
                    const result = await onEdit(editingCredential.id, data)
                    if (result.success) setEditingCredential(null)
                    return result
                  } else {
                    const result = await onAdd(data as any)
                    if (result.success) setShowAddModal(false)
                    return result
                  }
                }}
                onClose={() => {
                  setShowAddModal(false)
                  setEditingCredential(null)
                }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Credential Add/Edit Form
function CredentialForm({
  credential,
  profileId,
  onSubmit,
  onClose,
}: {
  credential: Credential | null
  profileId: string
  onSubmit: (data: any) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}) {
  const [domain, setDomain] = useState(credential?.domain || '')
  const [displayName, setDisplayName] = useState(credential?.displayName || '')
  const [username, setUsername] = useState(credential?.username || '')
  const [password, setPassword] = useState('')
  const [tags, setTags] = useState(credential?.tags.join(', ') || '')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!domain || !displayName) {
      setError('Domain and display name are required')
      return
    }

    setIsLoading(true)
    const result = await onSubmit({
      profileId,
      domain,
      displayName,
      type: 'password' as const,
      username: username || undefined,
      password: password || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Failed to save credential')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-60 flex items-center justify-center"
    >
      <div className="absolute inset-0 bg-chroma-black/50" onClick={onClose} />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative z-10 w-full max-w-md mx-4 cyber-panel rounded-xl p-6"
      >
        <h3 className="heading-cyber text-lg mb-6">
          {credential ? 'EDIT CREDENTIAL' : 'ADD CREDENTIAL'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted mb-1">
              Domain *
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-2.5 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
            />
          </div>

          <div>
            <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted mb-1">
              Display Name *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Account"
              className="w-full px-4 py-2.5 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
            />
          </div>

          <div>
            <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted mb-1">
              Username / Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
            />
          </div>

          <div>
            <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={credential ? '••••••••' : 'Enter password'}
                className="w-full px-4 py-2.5 pr-10 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-chroma-muted hover:text-chroma-teal"
              >
                {showPassword ? <EyeOffSmallIcon /> : <EyeSmallIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-ui uppercase tracking-wider text-chroma-muted mb-1">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="work, social, marketing"
              className="w-full px-4 py-2.5 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-chroma-error/10 border border-chroma-error/30 rounded-lg text-sm text-chroma-error">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-chroma-muted/30 rounded-lg text-chroma-muted hover:text-white hover:border-white/30 transition-colors"
            >
              Cancel
            </button>
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 bg-gradient-to-r from-chroma-teal to-chroma-cyan text-chroma-black font-bold rounded-lg disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Icons
function VaultIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#vaultGrad)" strokeWidth="2">
      <defs>
        <linearGradient id="vaultGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" />
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

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function KeyIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className}>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function KeySmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function AutofillIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function EyeSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
