import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChromadonStore, Platform, MarketingTask } from '../store/chromadonStore'

interface MarketingQueueProps {
  isOpen: boolean
  onClose: () => void
}

// Platform colors
const PLATFORM_COLORS: Record<Platform, string> = {
  google: '#4285F4',
  twitter: '#1DA1F2',
  linkedin: '#0077B5',
  facebook: '#1877F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  tiktok: '#000000',
}

// Platform icons
const PLATFORM_ICONS: Record<Platform, string> = {
  google: 'G',
  twitter: 'X',
  linkedin: 'in',
  facebook: 'f',
  instagram: 'IG',
  youtube: 'YT',
  tiktok: 'TT',
}

// Action labels
const ACTION_LABELS: Record<MarketingTask['action'], string> = {
  post: 'Post Content',
  comment: 'Comment',
  like: 'Like',
  follow: 'Follow',
  dm: 'Direct Message',
  search: 'Search',
  scrape: 'Scrape Data',
  custom: 'Custom Action',
}

const BRAIN_API = 'http://localhost:3001'

export default function MarketingQueue({ isOpen, onClose }: MarketingQueueProps) {
  const {
    marketingQueue,
    queueStats,
    activeTasksByPlatform,
    setMarketingQueue,
    addMarketingTask,
    updateMarketingTask,
    removeMarketingTask,
  } = useChromadonStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'queued' | 'running' | 'completed' | 'failed'>('all')
  const [processingAll, setProcessingAll] = useState(false)

  // Load queue on mount
  useEffect(() => {
    if (isOpen && window.electronAPI?.queueStatus) {
      window.electronAPI.queueStatus().then((result) => {
        if (result.success) {
          setMarketingQueue(result.queue)
        }
      })
    }
  }, [isOpen, setMarketingQueue])

  // Listen for queue updates
  useEffect(() => {
    let cleanup: (() => void) | undefined
    if (window.electronAPI?.onQueueUpdated) {
      cleanup = window.electronAPI.onQueueUpdated((queue) => {
        setMarketingQueue(queue)
      })
    }
    return cleanup
  }, [setMarketingQueue])

  // Filter tasks
  const filteredTasks = marketingQueue.filter((task) => {
    if (filter === 'all') return true
    return task.status === filter
  })

  // Delete task
  const handleDeleteTask = async (taskId: string) => {
    if (window.electronAPI?.queueRemove) {
      await window.electronAPI.queueRemove(taskId)
      removeMarketingTask(taskId)
    }
  }

  // Clear completed/failed
  const handleClearTasks = async (status: 'completed' | 'failed' | 'all') => {
    if (window.electronAPI?.queueClear) {
      const result = await window.electronAPI.queueClear(status)
      if (result.success) {
        // Queue will be updated via listener
      }
    }
  }

  // Process a single task via Brain API
  const handleProcessTask = async (task: MarketingTask) => {
    if (task.status !== 'queued') return

    updateMarketingTask(task.id, { status: 'running', startedAt: Date.now() })

    try {
      const res = await fetch(`${BRAIN_API}/api/social/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task }),
      })

      const data = await res.json()

      if (data.success) {
        updateMarketingTask(task.id, {
          status: 'completed',
          completedAt: Date.now(),
          result: data.summary,
        })
      } else {
        updateMarketingTask(task.id, {
          status: 'failed',
          completedAt: Date.now(),
          error: data.error || 'Task failed',
        })
      }
    } catch (err: any) {
      updateMarketingTask(task.id, {
        status: 'failed',
        completedAt: Date.now(),
        error: err.message || 'Connection failed',
      })
    }
  }

  // Process all queued tasks via Brain API SSE endpoint
  const handleProcessAll = async () => {
    const queuedTasks = marketingQueue.filter((t) => t.status === 'queued')
    if (queuedTasks.length === 0 || processingAll) return

    setProcessingAll(true)

    // Mark all as running
    queuedTasks.forEach((t) =>
      updateMarketingTask(t.id, { status: 'running', startedAt: Date.now() })
    )

    try {
      const res = await fetch(`${BRAIN_API}/api/social/process-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: queuedTasks }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      // Consume SSE stream for progress updates
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split('\n')
          let eventType = ''
          let eventData: any = null

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim()
            else if (line.startsWith('data: ')) {
              try { eventData = JSON.parse(line.slice(6)) } catch { /* skip */ }
            }
          }

          if (!eventType || !eventData) continue

          if (eventType === 'task_complete') {
            updateMarketingTask(eventData.taskId, {
              status: eventData.success ? 'completed' : 'failed',
              completedAt: Date.now(),
              result: eventData.summary,
              error: eventData.error,
            })
          }
        }
      }
    } catch (err: any) {
      // Mark remaining running tasks as failed
      queuedTasks.forEach((t) => {
        const current = useChromadonStore.getState().marketingQueue.find((q) => q.id === t.id)
        if (current?.status === 'running') {
          updateMarketingTask(t.id, {
            status: 'failed',
            completedAt: Date.now(),
            error: err.message || 'Batch processing failed',
          })
        }
      })
    } finally {
      setProcessingAll(false)
    }
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
            className="relative z-10 w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col"
          >
            {/* Outer glow */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-chroma-teal/30 via-chroma-purple/20 to-chroma-gold/30 blur-xl opacity-50" />

            {/* Main container */}
            <div className="relative cyber-panel rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
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

              {/* Header */}
              <div className="relative p-6 border-b border-chroma-teal/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <QueueIcon />
                    <div>
                      <h2 className="heading-cyber text-xl">MARKETING QUEUE</h2>
                      <p className="text-xs text-chroma-muted font-mono">
                        One task per platform, all platforms in parallel
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <CloseIcon />
                  </button>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-4">
                  {[
                    { label: 'Total', value: queueStats.total, color: '#00CED1' },
                    { label: 'Scheduled', value: queueStats.scheduled, color: '#6366F1' },
                    { label: 'Queued', value: queueStats.queued, color: '#8B5CF6' },
                    { label: 'Running', value: queueStats.running, color: '#FBBF24' },
                    { label: 'Completed', value: queueStats.completed, color: '#10B981' },
                    { label: 'Failed', value: queueStats.failed, color: '#EF4444' },
                  ].map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="text-xs text-chroma-muted">{stat.label}:</span>
                      <span className="text-sm font-mono" style={{ color: stat.color }}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Active Tasks by Platform */}
                {Object.keys(activeTasksByPlatform).length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-chroma-teal/5 border border-chroma-teal/20">
                    <div className="text-xs text-chroma-muted mb-2">Active Tasks:</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(activeTasksByPlatform).map(([platform, task]) => {
                        if (!task) return null
                        return (
                          <div
                            key={platform}
                            className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: `${PLATFORM_COLORS[platform as Platform]}20`,
                              borderColor: PLATFORM_COLORS[platform as Platform],
                              borderWidth: 1,
                            }}
                          >
                            <span className="font-bold">{PLATFORM_ICONS[platform as Platform]}</span>
                            <span>{ACTION_LABELS[task.action]}</span>
                            <LoadingDots />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="relative px-6 py-3 border-b border-chroma-teal/10 flex items-center justify-between">
                {/* Filters */}
                <div className="flex gap-2">
                  {(['all', 'scheduled', 'queued', 'running', 'completed', 'failed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono uppercase transition-colors ${
                        filter === f
                          ? 'bg-chroma-teal/20 text-chroma-teal'
                          : 'text-chroma-muted hover:text-white'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleClearTasks('completed')}
                    className="px-3 py-1 rounded-lg text-xs text-chroma-muted hover:text-chroma-teal transition-colors"
                  >
                    Clear Completed
                  </button>
                  {queueStats.queued > 0 && (
                    <motion.button
                      onClick={handleProcessAll}
                      disabled={processingAll}
                      whileHover={{ scale: processingAll ? 1 : 1.05 }}
                      whileTap={{ scale: processingAll ? 1 : 0.95 }}
                      className="px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                      style={{
                        background: processingAll
                          ? 'linear-gradient(135deg, #FBBF24, #F59E0B)'
                          : 'linear-gradient(135deg, #D4AF37, #FFD700)',
                        color: '#0A0A0F',
                      }}
                    >
                      {processingAll ? (
                        <span className="flex items-center gap-1">
                          Processing <LoadingDots />
                        </span>
                      ) : (
                        `Process All (${queueStats.queued})`
                      )}
                    </motion.button>
                  )}
                  <motion.button
                    onClick={() => setShowAddModal(true)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: 'linear-gradient(135deg, #00CED1, #00FFFF)',
                      color: '#0A0A0F',
                    }}
                  >
                    + Add Task
                  </motion.button>
                </div>
              </div>

              {/* Task List */}
              <div className="relative flex-1 overflow-y-auto p-6 space-y-3">
                {filteredTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-chroma-muted">
                    <EmptyQueueIcon />
                    <p className="mt-4 text-sm">No tasks in queue</p>
                    <p className="text-xs">Click "Add Task" to create marketing automation tasks</p>
                  </div>
                ) : (
                  filteredTasks.map((task, index) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={`p-4 rounded-xl border transition-all ${
                        task.status === 'running'
                          ? 'border-yellow-500/50 bg-yellow-500/5'
                          : task.status === 'completed'
                          ? 'border-green-500/30 bg-green-500/5'
                          : task.status === 'failed'
                          ? 'border-red-500/30 bg-red-500/5'
                          : task.status === 'scheduled'
                          ? 'border-indigo-500/40 bg-indigo-500/5'
                          : 'border-chroma-teal/20 bg-chroma-black/40'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Platform Badge */}
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                          style={{ backgroundColor: PLATFORM_COLORS[task.platform] }}
                        >
                          {PLATFORM_ICONS[task.platform]}
                        </div>

                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-display text-white">
                              {ACTION_LABELS[task.action]}
                            </span>
                            <StatusBadge status={task.status} />
                            {task.priority > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs bg-chroma-gold/20 text-chroma-gold">
                                P{task.priority}
                              </span>
                            )}
                          </div>

                          {task.content && (
                            <p className="text-sm text-chroma-muted truncate">{task.content}</p>
                          )}

                          {task.targetUrl && (
                            <p className="text-xs text-chroma-teal/60 truncate font-mono">
                              {task.targetUrl}
                            </p>
                          )}

                          {/* Scheduled time */}
                          {task.scheduledTime && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-indigo-400 font-mono">
                                Scheduled: {new Date(task.scheduledTime).toLocaleString()}
                              </span>
                              {task.status === 'scheduled' && (
                                <ScheduleCountdown scheduledTime={task.scheduledTime} />
                              )}
                              {task.recurrence && task.recurrence.type !== 'none' && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 uppercase">
                                  {task.recurrence.type}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Batch / cross-post indicator */}
                          {task.batchId && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] text-chroma-teal/60 font-mono">
                                Cross-post: {task.batchId}
                              </span>
                            </div>
                          )}

                          {/* Hashtags */}
                          {task.hashtags && task.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {task.hashtags.map((tag) => (
                                <span key={tag} className="text-[10px] text-chroma-teal/70 font-mono">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="flex gap-4 mt-2 text-xs text-chroma-muted">
                            <span>Created: {new Date(task.createdAt).toLocaleTimeString()}</span>
                            {task.startedAt && (
                              <span>Started: {new Date(task.startedAt).toLocaleTimeString()}</span>
                            )}
                            {task.completedAt && (
                              <span>
                                {task.status === 'completed' ? 'Completed' : 'Failed'}:{' '}
                                {new Date(task.completedAt).toLocaleTimeString()}
                              </span>
                            )}
                          </div>

                          {/* Error message */}
                          {task.error && (
                            <p className="mt-2 text-xs text-red-400 font-mono">{task.error}</p>
                          )}

                          {/* Result summary for completed tasks */}
                          {task.status === 'completed' && task.result && (
                            <div className="mt-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                              <p className="text-xs text-green-300/80 line-clamp-3">{task.result}</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          {(task.status === 'queued' || task.status === 'scheduled') && (
                            <>
                              {task.status === 'queued' && (
                                <motion.button
                                  onClick={() => handleProcessTask(task)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider"
                                  style={{
                                    background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
                                    color: '#0A0A0F',
                                  }}
                                >
                                  Process
                                </motion.button>
                              )}
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-2 rounded-lg text-chroma-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              >
                                <TrashIcon />
                              </button>
                            </>
                          )}
                          {task.status === 'running' && (
                            <span className="px-3 py-1 text-xs text-yellow-400 flex items-center gap-1">
                              Executing <LoadingDots />
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>

          {/* Add Task Modal */}
          <AddTaskModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={async (task) => {
              if (window.electronAPI?.queueAdd) {
                const result = await window.electronAPI.queueAdd(task)
                if (result.success && result.task) {
                  addMarketingTask(result.task)
                }
              }
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Add Task Modal — supports multi-platform select + scheduling
function AddTaskModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  onAdd: (task: {
    platform: Platform
    action: MarketingTask['action']
    content?: string
    targetUrl?: string
    priority?: number
    scheduledTime?: string
    recurrence?: { type: 'none' | 'daily' | 'weekly' | 'custom' }
    batchId?: string
    hashtags?: string[]
  }) => void
}) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['twitter'])
  const [action, setAction] = useState<MarketingTask['action']>('post')
  const [content, setContent] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [priority, setPriority] = useState(5)
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledTime, setScheduledTime] = useState('')
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('none')
  const [hashtagInput, setHashtagInput] = useState('')

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const parsedHashtags = hashtagInput
    .split(/[,\s]+/)
    .map((h) => h.replace(/^#/, '').trim())
    .filter(Boolean)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedPlatforms.length === 0) return

    const batchId =
      selectedPlatforms.length > 1
        ? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : undefined

    for (const platform of selectedPlatforms) {
      onAdd({
        platform,
        action,
        content: content || undefined,
        targetUrl: targetUrl || undefined,
        priority,
        scheduledTime: scheduleEnabled && scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
        recurrence: scheduleEnabled && recurrence !== 'none' ? { type: recurrence } : undefined,
        batchId,
        hashtags: parsedHashtags.length > 0 ? parsedHashtags : undefined,
      })
    }

    // Reset form
    setContent('')
    setTargetUrl('')
    setPriority(5)
    setScheduleEnabled(false)
    setScheduledTime('')
    setRecurrence('none')
    setHashtagInput('')
    onClose()
  }

  if (!isOpen) return null

  const ALL_PLATFORMS: Platform[] = ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center z-20"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative bg-chroma-dark rounded-xl border border-chroma-teal/30 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
      >
        <h3 className="text-lg font-display text-white mb-4">Add Marketing Task</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Platform Multi-Select Grid */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Platforms {selectedPlatforms.length > 1 && `(${selectedPlatforms.length} selected - cross-post)`}
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_PLATFORMS.map((p) => {
                const selected = selectedPlatforms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      selected ? 'text-white shadow-lg' : 'text-white/40 border border-white/10 hover:border-white/30'
                    }`}
                    style={
                      selected
                        ? { backgroundColor: PLATFORM_COLORS[p], boxShadow: `0 0 12px ${PLATFORM_COLORS[p]}40` }
                        : {}
                    }
                  >
                    <span className="mr-1">{PLATFORM_ICONS[p]}</span> {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Select */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Action
            </label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as MarketingTask['action'])}
              className="w-full px-4 py-2 bg-chroma-black/60 border border-chroma-teal/20 rounded-lg text-white focus:outline-none focus:border-chroma-teal/50"
            >
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Post content, message text, etc."
              className="w-full px-4 py-2 bg-chroma-black/60 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 resize-none"
              rows={3}
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Hashtags (comma or space separated)
            </label>
            <input
              type="text"
              value={hashtagInput}
              onChange={(e) => setHashtagInput(e.target.value)}
              placeholder="#AI #marketing #automation"
              className="w-full px-4 py-2 bg-chroma-black/60 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 font-mono text-sm"
            />
            {parsedHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {parsedHashtags.map((h) => (
                  <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-chroma-teal/10 text-chroma-teal">
                    #{h}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={`w-10 h-5 rounded-full relative transition-colors ${
                  scheduleEnabled ? 'bg-indigo-500' : 'bg-white/10'
                }`}
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    scheduleEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </div>
              <span className="text-xs text-chroma-muted uppercase tracking-wider">
                Schedule for later
              </span>
            </label>
          </div>

          {scheduleEnabled && (
            <div className="space-y-3 p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5">
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-4 py-2 bg-chroma-black/60 border border-indigo-500/30 rounded-lg text-white focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Recurrence</label>
                <div className="flex gap-2">
                  {(['none', 'daily', 'weekly'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRecurrence(r)}
                      className={`px-3 py-1 rounded-lg text-xs uppercase transition-colors ${
                        recurrence === r
                          ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/50'
                          : 'text-chroma-muted border border-white/10 hover:border-white/30'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Target URL */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Target URL (optional)
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 bg-chroma-black/60 border border-chroma-teal/20 rounded-lg text-white placeholder-chroma-muted/40 focus:outline-none focus:border-chroma-teal/50 font-mono text-sm"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs text-chroma-muted mb-2 uppercase tracking-wider">
              Priority (0-10)
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={priority}
              onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-chroma-black/60 border border-chroma-teal/20 rounded-lg text-white focus:outline-none focus:border-chroma-teal/50"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-chroma-teal/20 text-chroma-muted hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedPlatforms.length === 0}
              className="flex-1 py-2 rounded-lg font-bold disabled:opacity-30"
              style={{
                background: scheduleEnabled
                  ? 'linear-gradient(135deg, #6366F1, #818CF8)'
                  : 'linear-gradient(135deg, #00CED1, #00FFFF)',
                color: '#0A0A0F',
              }}
            >
              {scheduleEnabled
                ? `Schedule${selectedPlatforms.length > 1 ? ` (${selectedPlatforms.length})` : ''}`
                : `Add Task${selectedPlatforms.length > 1 ? ` (${selectedPlatforms.length})` : ''}`}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// Status Badge Component
function StatusBadge({ status }: { status: MarketingTask['status'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    scheduled: { bg: '#6366F120', text: '#6366F1' },
    queued: { bg: '#8B5CF620', text: '#8B5CF6' },
    running: { bg: '#FBBF2420', text: '#FBBF24' },
    completed: { bg: '#10B98120', text: '#10B981' },
    failed: { bg: '#EF444420', text: '#EF4444' },
  }

  const c = colors[status] || colors.queued

  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-mono uppercase"
      style={{
        backgroundColor: c.bg,
        color: c.text,
      }}
    >
      {status}
    </span>
  )
}

// Schedule Countdown
function ScheduleCountdown({ scheduledTime }: { scheduledTime: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledTime).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('due now')
        return
      }
      const hours = Math.floor(diff / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      if (hours > 24) {
        const days = Math.floor(hours / 24)
        setTimeLeft(`in ${days}d ${hours % 24}h`)
      } else if (hours > 0) {
        setTimeLeft(`in ${hours}h ${mins}m`)
      } else {
        setTimeLeft(`in ${mins}m`)
      }
    }
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [scheduledTime])

  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
      {timeLeft}
    </span>
  )
}

// Loading Dots
function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  )
}

// Icons
function QueueIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#queueGradient)"
      strokeWidth="2"
    >
      <defs>
        <linearGradient id="queueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00CED1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function EmptyQueueIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-30">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="12" x2="17" y2="12" />
    </svg>
  )
}
