import { create } from 'zustand'

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

  // Actions
  setConnected: (connected: boolean, mode?: 'CDP' | 'FRESH' | 'EMBEDDED') => void
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
}

export const useChromadonStore = create<ChromadonState>((set) => ({
  // Initial state
  isConnected: false,
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

  // Actions
  setConnected: (connected, mode) => set({ isConnected: connected, connectionMode: mode ?? null }),
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
}))
