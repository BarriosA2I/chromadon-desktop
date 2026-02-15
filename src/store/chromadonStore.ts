import { create } from 'zustand'
import type { ChatMessage, StreamingPart, ToolCallInfo } from './chatTypes'
import type { AnalyticsState, AnalyticsPeriod, AnalyticsTab, AnalyticsPlatform } from './analyticsTypes'

export type ActionType = 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'extract' | 'hover' | 'error' | 'success'
export type AIState = 'idle' | 'thinking' | 'executing' | 'error'
export type CircuitState = 'closed' | 'open' | 'half-open'

// Vault types
export interface VaultStatus {
  exists: boolean
  isLocked: boolean
  isLockedOut: boolean
  lockoutRemaining?: number
  profileCount?: number
  credentialCount?: number
  currentProfileId?: string
}

export interface ChromadonProfile {
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

export interface StoredCredential {
  id: string
  profileId: string
  domain: string
  displayName: string
  type: 'password' | 'oauth' | 'api-key'
  username?: string
  password?: string // Will be '********' if exists (sanitized)
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount: number
}

// Platform types
export type Platform = 'google' | 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'tiktok'

// Platform session state
export interface PlatformSession {
  platform: Platform
  partition: string
  isAuthenticated: boolean
  lastVerified: number
  accountName?: string
  accountEmail?: string
  accountAvatar?: string
}

// Marketing task type
export interface MarketingTask {
  id: string
  platform: Platform
  action: 'post' | 'comment' | 'like' | 'follow' | 'dm' | 'search' | 'scrape' | 'custom'
  content?: string
  targetUrl?: string
  priority: number
  status: 'queued' | 'running' | 'completed' | 'failed' | 'scheduled'
  result?: any
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  tabId?: number
  // Scheduling
  scheduledTime?: string
  recurrence?: { type: 'none' | 'daily' | 'weekly' | 'custom'; intervalMs?: number; endAfter?: number; occurrenceCount?: number }
  // Cross-posting
  batchId?: string
  hashtags?: string[]
  // Media attachments
  mediaUrls?: string[]
  // Analytics linkage
  analyticsPostId?: number
}

// Queue stats
export interface QueueStats {
  total: number
  queued: number
  scheduled: number
  running: number
  completed: number
  failed: number
}

export interface ActionLog {
  id: string
  timestamp: Date
  type: ActionType
  description: string
  duration?: number
  success: boolean
}

export interface BrowserTab {
  id: number
  url: string
  title: string
  active: boolean
  screenshot?: string
}

// Embedded tab info (from BrowserViewManager)
export interface EmbeddedTab {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface ChromadonState {
  // Connection state
  isConnected: boolean
  brainAvailable: boolean
  connectionMode: 'CDP' | 'FRESH' | 'EMBEDDED' | null
  chromadonUrl: string

  // AI state
  aiState: AIState
  confidence: number
  circuitState: CircuitState
  cognitiveMode: 'system1' | 'system2' | 'hybrid' | null

  // UI state
  showSplash: boolean
  command: string
  isProcessing: boolean

  // Data
  tabs: BrowserTab[]
  embeddedTabs: EmbeddedTab[]
  activeEmbeddedTabId: number | null
  actionLogs: ActionLog[]
  memoryStats: { working: number; episodic: number; semantic: number; procedural: number }

  // Vault state
  vaultStatus: VaultStatus
  profiles: ChromadonProfile[]
  currentProfile: ChromadonProfile | null
  credentials: StoredCredential[]
  showVaultModal: boolean
  vaultModalMode: 'create' | 'unlock'  // Track mode explicitly to avoid race conditions
  showCredentialVault: boolean
  showProfileManager: boolean

  // Platform session state
  platformSessions: Record<Platform, PlatformSession>
  sessionBackups: { version: number; lastBackupAt: number; backups: { platform: string; file: string; exportedAt: number; cookieCount: number }[] } | null
  showSessionSetup: boolean

  // Marketing queue state
  marketingQueue: MarketingTask[]
  activeTasksByPlatform: Record<Platform, MarketingTask | null>
  queueStats: QueueStats
  showMarketingQueue: boolean

  // Chat state
  chatMessages: ChatMessage[]
  chatInput: string
  showThinkingIndicator: boolean

  // Orchestrator state
  orchestratorSessionId: string | null

  // Analytics state
  analyticsData: AnalyticsState
  analyticsLoading: boolean
  analyticsError: string | null
  selectedPeriod: AnalyticsPeriod
  selectedPlatforms: AnalyticsPlatform[]
  activeAnalyticsTab: AnalyticsTab
  showAnalyticsDashboard: boolean

  // Client Context state
  showInterviewScreen: boolean
  showDocumentVault: boolean
  showStrategyDashboard: boolean

  // Settings state
  showSettings: boolean
  apiKeyStatus: { hasKey: boolean; keyPreview: string | null }
  geminiKeyStatus: { hasKey: boolean; keyPreview: string | null }

  // Actions
  setConnected: (connected: boolean, mode?: 'CDP' | 'FRESH' | 'EMBEDDED') => void
  setBrainAvailable: (available: boolean) => void
  setAIState: (state: AIState) => void
  setConfidence: (confidence: number) => void
  setCircuitState: (state: CircuitState) => void
  setCognitiveMode: (mode: 'system1' | 'system2' | 'hybrid' | null) => void
  setShowSplash: (show: boolean) => void
  setCommand: (command: string) => void
  setIsProcessing: (processing: boolean) => void
  setTabs: (tabs: BrowserTab[]) => void
  setEmbeddedTabs: (tabs: EmbeddedTab[]) => void
  setActiveEmbeddedTabId: (id: number | null) => void
  addActionLog: (log: Omit<ActionLog, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  setMemoryStats: (stats: { working: number; episodic: number; semantic: number; procedural: number }) => void

  // Vault actions
  setVaultStatus: (status: VaultStatus) => void
  setProfiles: (profiles: ChromadonProfile[]) => void
  setCurrentProfile: (profile: ChromadonProfile | null) => void
  setCredentials: (credentials: StoredCredential[]) => void
  setShowVaultModal: (show: boolean, mode?: 'create' | 'unlock') => void
  setShowCredentialVault: (show: boolean) => void
  setShowProfileManager: (show: boolean) => void

  // Platform session actions
  setPlatformSessions: (sessions: PlatformSession[]) => void
  updatePlatformSession: (platform: Platform, updates: Partial<PlatformSession>) => void
  setSessionBackups: (backups: { version: number; lastBackupAt: number; backups: { platform: string; file: string; exportedAt: number; cookieCount: number }[] } | null) => void
  setShowSessionSetup: (show: boolean) => void

  // Marketing queue actions
  setMarketingQueue: (queue: MarketingTask[]) => void
  addMarketingTask: (task: MarketingTask) => void
  updateMarketingTask: (taskId: string, updates: Partial<MarketingTask>) => void
  removeMarketingTask: (taskId: string) => void
  setActiveTaskForPlatform: (platform: Platform, task: MarketingTask | null) => void
  setQueueStats: (stats: QueueStats) => void
  setShowMarketingQueue: (show: boolean) => void

  // Chat actions
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  setChatInput: (input: string) => void
  clearChat: () => void
  setShowThinkingIndicator: (show: boolean) => void

  // Analytics actions
  setAnalyticsData: (data: Partial<AnalyticsState>) => void
  setAnalyticsLoading: (loading: boolean) => void
  setAnalyticsError: (error: string | null) => void
  setSelectedPeriod: (period: AnalyticsPeriod) => void
  setSelectedPlatforms: (platforms: AnalyticsPlatform[]) => void
  setActiveAnalyticsTab: (tab: AnalyticsTab) => void
  setShowAnalyticsDashboard: (show: boolean) => void

  // Client Context actions
  setShowInterviewScreen: (show: boolean) => void
  setShowDocumentVault: (show: boolean) => void
  setShowStrategyDashboard: (show: boolean) => void

  // Settings actions
  setShowSettings: (show: boolean) => void
  setApiKeyStatus: (status: { hasKey: boolean; keyPreview: string | null }) => void
  setGeminiKeyStatus: (status: { hasKey: boolean; keyPreview: string | null }) => void

  // Orchestrator/streaming actions
  setOrchestratorSessionId: (id: string | null) => void
  addStreamingMessage: () => string  // returns message ID
  appendToStreamingMessage: (msgId: string, text: string) => void
  addToolCallToMessage: (msgId: string, toolCall: ToolCallInfo) => void
  updateToolCallInMessage: (msgId: string, toolId: string, updates: Partial<ToolCallInfo>) => void
  finalizeStreamingMessage: (msgId: string) => void
}

export const useChromadonStore = create<ChromadonState>((set) => ({
  // Initial state
  isConnected: false,
  brainAvailable: false,
  connectionMode: null,
  chromadonUrl: 'http://localhost:3001',

  aiState: 'idle',
  confidence: 0,
  circuitState: 'closed',
  cognitiveMode: null,

  showSplash: true,
  command: '',
  isProcessing: false,

  tabs: [],
  embeddedTabs: [],
  activeEmbeddedTabId: null,
  actionLogs: [],
  memoryStats: { working: 0, episodic: 0, semantic: 0, procedural: 0 },

  // Vault initial state
  vaultStatus: {
    exists: false,
    isLocked: true,
    isLockedOut: false,
  },
  profiles: [],
  currentProfile: null,
  credentials: [],
  showVaultModal: false,
  vaultModalMode: 'create',  // Default to create, will be set properly when showing modal
  showCredentialVault: false,
  showProfileManager: false,

  // Platform session initial state
  platformSessions: {} as Record<Platform, PlatformSession>,
  sessionBackups: null,
  showSessionSetup: false,

  // Marketing queue initial state
  marketingQueue: [],
  activeTasksByPlatform: {} as Record<Platform, MarketingTask | null>,
  queueStats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0, scheduled: 0 },
  showMarketingQueue: false,

  // Chat initial state
  chatMessages: [],
  chatInput: '',
  showThinkingIndicator: false,

  // Orchestrator initial state
  orchestratorSessionId: null,

  // Analytics initial state
  analyticsData: {
    overview: null,
    platforms: {},
    content: null,
    audience: {},
    competitors: null,
    schedule: [],
    trinity: null,
  },
  analyticsLoading: false,
  analyticsError: null,
  selectedPeriod: '30d',
  selectedPlatforms: [],
  activeAnalyticsTab: 'overview',
  showAnalyticsDashboard: false,

  // Client Context initial state
  showInterviewScreen: false,
  showDocumentVault: false,
  showStrategyDashboard: false,

  // Settings initial state
  showSettings: false,
  apiKeyStatus: { hasKey: false, keyPreview: null },
  geminiKeyStatus: { hasKey: false, keyPreview: null },

  // Actions
  setConnected: (connected, mode) => set({ isConnected: connected, connectionMode: mode ?? null }),
  setBrainAvailable: (available) => set({ brainAvailable: available }),
  setAIState: (state) => set({ aiState: state }),
  setConfidence: (confidence) => set({ confidence }),
  setCircuitState: (state) => set({ circuitState: state }),
  setCognitiveMode: (mode) => set({ cognitiveMode: mode }),
  setShowSplash: (show) => set({ showSplash: show }),
  setCommand: (command) => set({ command }),
  setIsProcessing: (processing) => set({ isProcessing: processing }),
  setTabs: (tabs) => set({ tabs }),
  setEmbeddedTabs: (tabs) => set((state) => ({
    embeddedTabs: tabs,
    activeEmbeddedTabId: tabs.find((t) => t.isActive)?.id ?? state.activeEmbeddedTabId,
  })),
  setActiveEmbeddedTabId: (id) => set({ activeEmbeddedTabId: id }),
  addActionLog: (log) => set((state) => ({
    actionLogs: [
      ...state.actionLogs,
      {
        ...log,
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      },
    ].slice(-100), // Keep last 100 logs
  })),
  clearLogs: () => set({ actionLogs: [] }),
  setMemoryStats: (stats) => set({ memoryStats: stats }),

  // Vault actions
  setVaultStatus: (status) => set({ vaultStatus: status }),
  setProfiles: (profiles) => set({ profiles }),
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  setCredentials: (credentials) => set({ credentials }),
  setShowVaultModal: (show, mode) => set((state) => ({
    showVaultModal: show,
    vaultModalMode: mode ?? state.vaultModalMode,
  })),
  setShowCredentialVault: (show) => set({ showCredentialVault: show }),
  setShowProfileManager: (show) => set({ showProfileManager: show }),

  // Platform session actions
  setPlatformSessions: (sessions) => set(() => {
    const sessionsMap: Record<Platform, PlatformSession> = {} as Record<Platform, PlatformSession>
    sessions.forEach((s) => {
      sessionsMap[s.platform] = s
    })
    return { platformSessions: sessionsMap }
  }),
  updatePlatformSession: (platform, updates) => set((state) => ({
    platformSessions: {
      ...state.platformSessions,
      [platform]: {
        ...state.platformSessions[platform],
        ...updates,
        platform,
      },
    },
  })),
  setSessionBackups: (backups) => set({ sessionBackups: backups }),
  setShowSessionSetup: (show) => set({ showSessionSetup: show }),

  // Marketing queue actions
  setMarketingQueue: (queue) => set(() => {
    const stats: QueueStats = {
      total: queue.length,
      queued: queue.filter((t) => t.status === 'queued').length,
      scheduled: queue.filter((t) => t.status === 'scheduled').length,
      running: queue.filter((t) => t.status === 'running').length,
      completed: queue.filter((t) => t.status === 'completed').length,
      failed: queue.filter((t) => t.status === 'failed').length,
    }
    return { marketingQueue: queue, queueStats: stats }
  }),
  addMarketingTask: (task) => set((state) => {
    const newQueue = [...state.marketingQueue, task].sort((a, b) => b.priority - a.priority)
    const stats: QueueStats = {
      total: newQueue.length,
      queued: newQueue.filter((t) => t.status === 'queued').length,
      scheduled: newQueue.filter((t) => t.status === 'scheduled').length,
      running: newQueue.filter((t) => t.status === 'running').length,
      completed: newQueue.filter((t) => t.status === 'completed').length,
      failed: newQueue.filter((t) => t.status === 'failed').length,
    }
    return { marketingQueue: newQueue, queueStats: stats }
  }),
  updateMarketingTask: (taskId, updates) => set((state) => {
    const newQueue = state.marketingQueue.map((t) =>
      t.id === taskId ? { ...t, ...updates } : t
    )
    const stats: QueueStats = {
      total: newQueue.length,
      queued: newQueue.filter((t) => t.status === 'queued').length,
      scheduled: newQueue.filter((t) => t.status === 'scheduled').length,
      running: newQueue.filter((t) => t.status === 'running').length,
      completed: newQueue.filter((t) => t.status === 'completed').length,
      failed: newQueue.filter((t) => t.status === 'failed').length,
    }
    return { marketingQueue: newQueue, queueStats: stats }
  }),
  removeMarketingTask: (taskId) => set((state) => {
    const newQueue = state.marketingQueue.filter((t) => t.id !== taskId)
    const stats: QueueStats = {
      total: newQueue.length,
      queued: newQueue.filter((t) => t.status === 'queued').length,
      scheduled: newQueue.filter((t) => t.status === 'scheduled').length,
      running: newQueue.filter((t) => t.status === 'running').length,
      completed: newQueue.filter((t) => t.status === 'completed').length,
      failed: newQueue.filter((t) => t.status === 'failed').length,
    }
    return { marketingQueue: newQueue, queueStats: stats }
  }),
  setActiveTaskForPlatform: (platform, task) => set((state) => ({
    activeTasksByPlatform: {
      ...state.activeTasksByPlatform,
      [platform]: task,
    },
  })),
  setQueueStats: (stats) => set({ queueStats: stats }),
  setShowMarketingQueue: (show) => set({ showMarketingQueue: show }),

  // Chat actions
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [
      ...state.chatMessages,
      {
        ...msg,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      },
    ].slice(-200),
  })),
  setChatInput: (input) => set({ chatInput: input }),
  clearChat: () => set({ chatMessages: [], orchestratorSessionId: null }),
  setShowThinkingIndicator: (show) => set({ showThinkingIndicator: show }),

  // Analytics actions
  setAnalyticsData: (data) => set((state) => ({
    analyticsData: { ...state.analyticsData, ...data },
  })),
  setAnalyticsLoading: (loading) => set({ analyticsLoading: loading }),
  setAnalyticsError: (error) => set({ analyticsError: error }),
  setSelectedPeriod: (period) => set({ selectedPeriod: period }),
  setSelectedPlatforms: (platforms) => set({ selectedPlatforms: platforms }),
  setActiveAnalyticsTab: (tab) => set({ activeAnalyticsTab: tab }),
  setShowAnalyticsDashboard: (show) => set({ showAnalyticsDashboard: show }),

  // Client Context actions
  setShowInterviewScreen: (show) => set({ showInterviewScreen: show }),
  setShowDocumentVault: (show) => set({ showDocumentVault: show }),
  setShowStrategyDashboard: (show) => set({ showStrategyDashboard: show }),

  // Settings actions
  setShowSettings: (show) => set({ showSettings: show }),
  setApiKeyStatus: (status) => set({ apiKeyStatus: status }),
  setGeminiKeyStatus: (status) => set({ geminiKeyStatus: status }),

  // Orchestrator/streaming actions
  setOrchestratorSessionId: (id) => set({ orchestratorSessionId: id }),

  addStreamingMessage: () => {
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    set((state) => ({
      chatMessages: [
        ...state.chatMessages,
        {
          id: msgId,
          role: 'assistant' as const,
          type: 'streaming' as const,
          content: '',
          timestamp: new Date(),
          streamingParts: [],
          isStreaming: true,
        },
      ].slice(-200),
    }))
    return msgId
  },

  appendToStreamingMessage: (msgId, text) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) => {
      if (msg.id !== msgId) return msg
      const parts = [...(msg.streamingParts || [])]
      // Append to last text part or create new one
      const lastPart = parts[parts.length - 1]
      if (lastPart && lastPart.type === 'text') {
        parts[parts.length - 1] = { ...lastPart, content: (lastPart.content || '') + text }
      } else {
        parts.push({ type: 'text', content: text })
      }
      return { ...msg, content: msg.content + text, streamingParts: parts }
    }),
  })),

  addToolCallToMessage: (msgId, toolCall) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) => {
      if (msg.id !== msgId) return msg
      const parts = [...(msg.streamingParts || [])]
      parts.push({ type: 'tool-call', toolCall })
      return { ...msg, streamingParts: parts }
    }),
  })),

  updateToolCallInMessage: (msgId, toolId, updates) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) => {
      if (msg.id !== msgId) return msg
      const parts = (msg.streamingParts || []).map((part) => {
        if (part.type === 'tool-call' && part.toolCall?.id === toolId) {
          return { ...part, toolCall: { ...part.toolCall!, ...updates } }
        }
        return part
      })
      return { ...msg, streamingParts: parts }
    }),
  })),

  finalizeStreamingMessage: (msgId) => set((state) => ({
    chatMessages: state.chatMessages.map((msg) => {
      if (msg.id !== msgId) return msg
      return { ...msg, isStreaming: false, type: 'streaming' as const }
    }),
  })),
}))

// Expose store for external test access (e.g. Desktop Control Server /execute)
if (typeof window !== 'undefined') {
  (window as any).__CHROMADON_STORE__ = useChromadonStore
}
