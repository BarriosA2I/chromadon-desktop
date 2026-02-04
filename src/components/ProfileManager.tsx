import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ChromadonProfile {
  id: string
  name: string
  avatar?: string
  createdAt: number
  lastUsedAt: number
  settings: {
    autoLockMinutes: number
    clipboardClearSeconds: number
  }
}

interface ProfileManagerProps {
  profiles: ChromadonProfile[]
  currentProfileId: string | null
  onSelect: (id: string) => void
  onCreate: (name: string) => Promise<{ success: boolean; error?: string }>
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>
  onClose: () => void
}

export default function ProfileManager({
  profiles,
  currentProfileId,
  onSelect,
  onCreate,
  onDelete,
  onClose,
}: ProfileManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProfileName.trim()) return

    setIsCreating(true)
    setError('')
    const result = await onCreate(newProfileName.trim())
    setIsCreating(false)

    if (result.success) {
      setNewProfileName('')
      setShowCreateForm(false)
    } else {
      setError(result.error || 'Failed to create profile')
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete profile "${name}"? All credentials in this profile will be lost.`)) {
      return
    }
    await onDelete(id)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const getAvatarColor = (id: string) => {
    const colors = [
      'from-chroma-teal to-chroma-cyan',
      'from-chroma-purple to-violet-500',
      'from-chroma-gold to-amber-400',
      'from-emerald-500 to-teal-400',
      'from-rose-500 to-pink-400',
    ]
    const index = id.charCodeAt(0) % colors.length
    return colors[index]
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute left-0 top-full mt-2 z-50"
    >
      {/* Dropdown panel */}
      <div className="relative w-72">
        {/* Glow */}
        <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-chroma-teal/20 to-chroma-purple/20 blur-lg" />

        {/* Container */}
        <div className="relative cyber-panel rounded-xl overflow-hidden">
          {/* Gradient border */}
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              padding: '1px',
              background: 'linear-gradient(135deg, rgba(0, 206, 209, 0.4), rgba(139, 92, 246, 0.3))',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
          />

          {/* Header */}
          <div className="relative px-4 py-3 border-b border-chroma-teal/20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-ui font-semibold text-chroma-muted uppercase tracking-wider">
                Profiles
              </h3>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 text-chroma-muted hover:text-white transition-colors"
              >
                <CloseIcon />
              </motion.button>
            </div>
          </div>

          {/* Profiles List */}
          <div className="relative max-h-64 overflow-y-auto">
            {profiles.map((profile, index) => (
              <motion.button
                key={profile.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  onSelect(profile.id)
                  onClose()
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                  profile.id === currentProfileId
                    ? 'bg-chroma-teal/10'
                    : 'hover:bg-white/5'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(profile.id)} flex items-center justify-center text-white font-bold text-sm`}>
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(profile.name)
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-ui font-medium text-white">{profile.name}</span>
                    {profile.id === currentProfileId && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase bg-chroma-teal text-chroma-black rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-chroma-muted">
                    Last used {formatTimeAgo(profile.lastUsedAt)}
                  </span>
                </div>

                {/* Delete (if not current and not the only profile) */}
                {profile.id !== currentProfileId && profiles.length > 1 && (
                  <motion.button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(profile.id, profile.name)
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-1.5 rounded-lg text-chroma-muted hover:text-chroma-error hover:bg-chroma-error/10 transition-colors"
                  >
                    <TrashIcon />
                  </motion.button>
                )}
              </motion.button>
            ))}
          </div>

          {/* Create New Profile */}
          <div className="relative px-4 py-3 border-t border-chroma-teal/20">
            <AnimatePresence mode="wait">
              {showCreateForm ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  onSubmit={handleCreate}
                  className="space-y-2"
                >
                  <input
                    type="text"
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    placeholder="Profile name"
                    autoFocus
                    className="w-full px-3 py-2 bg-chroma-black/50 border border-chroma-teal/20 rounded-lg text-sm text-white placeholder-chroma-muted/50 focus:outline-none focus:border-chroma-teal/50"
                  />
                  {error && (
                    <p className="text-xs text-chroma-error">{error}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false)
                        setNewProfileName('')
                        setError('')
                      }}
                      className="flex-1 py-1.5 text-xs text-chroma-muted hover:text-white border border-chroma-muted/30 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={isCreating || !newProfileName.trim()}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 py-1.5 text-xs font-semibold bg-chroma-teal text-chroma-black rounded-lg disabled:opacity-50"
                    >
                      {isCreating ? 'Creating...' : 'Create'}
                    </motion.button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCreateForm(true)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-ui text-chroma-teal hover:bg-chroma-teal/10 rounded-lg transition-colors"
                >
                  <PlusIcon />
                  New Profile
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Helper function
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

// Icons
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
