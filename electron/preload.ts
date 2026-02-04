import { contextBridge, ipcRenderer } from 'electron'

// Tab info type (matching browser-view-manager)
interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

// Vault status type
interface VaultStatus {
  exists: boolean
  isLocked: boolean
  isLockedOut: boolean
  lockoutRemaining?: number
  profileCount?: number
  credentialCount?: number
  currentProfileId?: string
}

// Profile type
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

// Credential type (sanitized - passwords masked)
interface SanitizedCredential {
  id: string
  profileId: string
  domain: string
  displayName: string
  type: 'password' | 'oauth' | 'api-key'
  username?: string
  password?: string // Will be '********' if exists
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount: number
}

// Login form detection result
interface LoginFormDetection {
  hasLoginForm: boolean
  forms: {
    formIndex: number
    formId: string | null
    formAction: string | null
    hasUsername: boolean
    domain: string
  }[]
  url: string
  domain: string
}

// Expose protected methods for window controls
contextBridge.exposeInMainWorld('electronAPI', {
  // ==================== WINDOW CONTROLS ====================
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Platform info
  platform: process.platform,

  // ==================== CLAUDE CODE CONTROL API ====================
  onExternalCommand: (callback: (command: string) => void) => {
    ipcRenderer.on('claude:executeCommand', (_event, command) => {
      callback(command)
    })
  },
  sendStateUpdate: (state: any) => {
    ipcRenderer.send('claude:stateUpdate', state)
  },

  // ==================== EMBEDDED TAB API ====================
  tabCreate: (url?: string) => ipcRenderer.invoke('tab:create', url),
  tabClose: (id: number) => ipcRenderer.invoke('tab:close', id),
  tabNavigate: (id: number, url: string) => ipcRenderer.invoke('tab:navigate', { id, url }),
  tabFocus: (id: number) => ipcRenderer.invoke('tab:focus', id),
  tabBack: (id: number) => ipcRenderer.invoke('tab:back', id),
  tabForward: (id: number) => ipcRenderer.invoke('tab:forward', id),
  tabReload: (id: number) => ipcRenderer.invoke('tab:reload', id),
  tabList: () => ipcRenderer.invoke('tab:list'),
  tabGetActive: () => ipcRenderer.invoke('tab:getActive'),
  tabExecute: (id: number, script: string) => ipcRenderer.invoke('tab:execute', { id, script }),
  tabScreenshot: (id: number) => ipcRenderer.invoke('tab:screenshot', id),

  // Tab update listener
  onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => {
    ipcRenderer.on('tabs:updated', (_event, tabs) => {
      callback(tabs)
    })
  },

  // ==================== SECURE VAULT API ====================
  vaultStatus: () => ipcRenderer.invoke('vault:status'),
  vaultExists: () => ipcRenderer.invoke('vault:exists'),
  vaultCreate: (masterPassword: string) => ipcRenderer.invoke('vault:create', masterPassword),
  vaultUnlock: (masterPassword: string) => ipcRenderer.invoke('vault:unlock', masterPassword),
  vaultLock: () => ipcRenderer.invoke('vault:lock'),
  vaultChangeMasterPassword: (currentPassword: string, newPassword: string) =>
    ipcRenderer.invoke('vault:changeMasterPassword', { currentPassword, newPassword }),
  vaultActivity: () => ipcRenderer.invoke('vault:activity'),

  // Vault event listeners
  onVaultUnlocked: (callback: () => void) => {
    ipcRenderer.on('vault:unlocked', () => callback())
  },
  onVaultLocked: (callback: () => void) => {
    ipcRenderer.on('vault:locked', () => callback())
  },

  // ==================== PROFILE API ====================
  profileList: () => ipcRenderer.invoke('profile:list'),
  profileCurrent: () => ipcRenderer.invoke('profile:current'),
  profileCreate: (name: string, avatar?: string) =>
    ipcRenderer.invoke('profile:create', { name, avatar }),
  profileUpdate: (id: string, updates: Partial<ChromadonProfile>) =>
    ipcRenderer.invoke('profile:update', { id, updates }),
  profileDelete: (id: string) => ipcRenderer.invoke('profile:delete', id),
  profileSwitch: (id: string) => ipcRenderer.invoke('profile:switch', id),

  // ==================== CREDENTIAL API ====================
  credentialList: () => ipcRenderer.invoke('credential:list'),
  credentialGetByDomain: (domain: string) => ipcRenderer.invoke('credential:getByDomain', domain),
  credentialAdd: (credential: {
    profileId: string
    domain: string
    displayName: string
    type: 'password' | 'oauth' | 'api-key'
    username?: string
    password?: string
    apiKey?: string
    notes?: string
    tags?: string[]
  }) => ipcRenderer.invoke('credential:add', credential),
  credentialUpdate: (id: string, updates: Partial<{
    domain: string
    displayName: string
    username: string
    password: string
    apiKey: string
    notes: string
    tags: string[]
  }>) => ipcRenderer.invoke('credential:update', { id, updates }),
  credentialDelete: (id: string) => ipcRenderer.invoke('credential:delete', id),

  // Auto-fill and clipboard
  credentialAutofill: (tabId: number, credentialId: string) =>
    ipcRenderer.invoke('credential:autofill', { tabId, credentialId }),
  credentialCopyPassword: (credentialId: string) =>
    ipcRenderer.invoke('credential:copyPassword', credentialId),
  credentialCopyUsername: (credentialId: string) =>
    ipcRenderer.invoke('credential:copyUsername', credentialId),

  // Login form detection
  credentialDetectLoginForm: (tabId: number) =>
    ipcRenderer.invoke('credential:detectLoginForm', tabId),
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      // Window controls
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      platform: string

      // Claude Code Control API
      onExternalCommand: (callback: (command: string) => void) => void
      sendStateUpdate: (state: any) => void

      // Embedded Tab API
      tabCreate: (url?: string) => Promise<{ success: boolean; id: number; tabs: TabInfo[] }>
      tabClose: (id: number) => Promise<{ success: boolean; tabs: TabInfo[] }>
      tabNavigate: (id: number, url: string) => Promise<{ success: boolean }>
      tabFocus: (id: number) => Promise<{ success: boolean }>
      tabBack: (id: number) => Promise<{ success: boolean }>
      tabForward: (id: number) => Promise<{ success: boolean }>
      tabReload: (id: number) => Promise<{ success: boolean }>
      tabList: () => Promise<{ success: boolean; tabs: TabInfo[] }>
      tabGetActive: () => Promise<{ success: boolean; activeTabId: number | null }>
      tabExecute: (id: number, script: string) => Promise<{ success: boolean; result?: any; error?: string }>
      tabScreenshot: (id: number) => Promise<{ success: boolean; screenshot?: string; error?: string }>
      onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => void

      // Secure Vault API
      vaultStatus: () => Promise<VaultStatus>
      vaultExists: () => Promise<boolean>
      vaultCreate: (masterPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultUnlock: (masterPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultLock: () => Promise<{ success: boolean }>
      vaultChangeMasterPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultActivity: () => Promise<{ success: boolean }>
      onVaultUnlocked: (callback: () => void) => void
      onVaultLocked: (callback: () => void) => void

      // Profile API
      profileList: () => Promise<{ success: boolean; profiles: ChromadonProfile[] }>
      profileCurrent: () => Promise<{ success: boolean; profile: ChromadonProfile | null }>
      profileCreate: (name: string, avatar?: string) => Promise<{ success: boolean; profile?: ChromadonProfile; error?: string }>
      profileUpdate: (id: string, updates: Partial<ChromadonProfile>) => Promise<{ success: boolean; error?: string }>
      profileDelete: (id: string) => Promise<{ success: boolean; error?: string }>
      profileSwitch: (id: string) => Promise<{ success: boolean; error?: string }>

      // Credential API
      credentialList: () => Promise<{ success: boolean; credentials: SanitizedCredential[] }>
      credentialGetByDomain: (domain: string) => Promise<{ success: boolean; credentials: SanitizedCredential[] }>
      credentialAdd: (credential: {
        profileId: string
        domain: string
        displayName: string
        type: 'password' | 'oauth' | 'api-key'
        username?: string
        password?: string
        apiKey?: string
        notes?: string
        tags?: string[]
      }) => Promise<{ success: boolean; credential?: SanitizedCredential; error?: string }>
      credentialUpdate: (id: string, updates: Partial<{
        domain: string
        displayName: string
        username: string
        password: string
        apiKey: string
        notes: string
        tags: string[]
      }>) => Promise<{ success: boolean; error?: string }>
      credentialDelete: (id: string) => Promise<{ success: boolean; error?: string }>
      credentialAutofill: (tabId: number, credentialId: string) => Promise<{ success: boolean; error?: string }>
      credentialCopyPassword: (credentialId: string) => Promise<{ success: boolean; clearAfterSeconds?: number; error?: string }>
      credentialCopyUsername: (credentialId: string) => Promise<{ success: boolean; error?: string }>
      credentialDetectLoginForm: (tabId: number) => Promise<{ success: boolean; hasLoginForm?: boolean; forms?: LoginFormDetection['forms']; domain?: string; error?: string }>
    }
  }
}
