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

// Platform types
type Platform = 'google' | 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'tiktok'

// Platform session type
interface PlatformSession {
  platform: Platform
  partition: string
  isAuthenticated: boolean
  lastVerified: number
  accountName?: string
  accountEmail?: string
  accountAvatar?: string
}

// Marketing task type
interface MarketingTask {
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
  scheduledTime?: string
  recurrence?: { type: 'none' | 'daily' | 'weekly' | 'custom'; intervalMs?: number; endAfter?: number; occurrenceCount?: number }
  batchId?: string
  hashtags?: string[]
  mediaUrls?: string[]
  analyticsPostId?: number
}

// Queue stats type
interface QueueStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  scheduled: number
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
    const handler = (_event: any, command: string) => {
      callback(command)
    }
    ipcRenderer.on('claude:executeCommand', handler)
    // Return cleanup function to remove listener
    return () => {
      ipcRenderer.removeListener('claude:executeCommand', handler)
    }
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
    const handler = (_event: any, tabs: TabInfo[]) => {
      callback(tabs)
    }
    ipcRenderer.on('tabs:updated', handler)
    return () => {
      ipcRenderer.removeListener('tabs:updated', handler)
    }
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
    const handler = () => callback()
    ipcRenderer.on('vault:unlocked', handler)
    return () => {
      ipcRenderer.removeListener('vault:unlocked', handler)
    }
  },
  onVaultLocked: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('vault:locked', handler)
    return () => {
      ipcRenderer.removeListener('vault:locked', handler)
    }
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

  // ==================== PLATFORM SESSION API ====================
  sessionList: () => ipcRenderer.invoke('session:list'),
  sessionGet: (platform: Platform) => ipcRenderer.invoke('session:get', platform),
  sessionVerify: (platform: Platform) => ipcRenderer.invoke('session:verify', platform),
  sessionUpdate: (platform: Platform, updates: Partial<PlatformSession>) =>
    ipcRenderer.invoke('session:update', { platform, updates }),

  // Clear platform session (sign out)
  sessionClear: (platform: Platform) => ipcRenderer.invoke('session:clear', platform),

  // Session backup/restore
  sessionExport: (platform: Platform, password: string) =>
    ipcRenderer.invoke('session:export', { platform, password }),
  sessionImport: (platform: Platform, password: string) =>
    ipcRenderer.invoke('session:import', { platform, password }),
  sessionExportAll: (password: string) =>
    ipcRenderer.invoke('session:exportAll', { password }),
  sessionImportAll: (password: string) =>
    ipcRenderer.invoke('session:importAll', { password }),
  sessionListBackups: () =>
    ipcRenderer.invoke('session:listBackups'),
  sessionDeleteBackup: (platform: Platform) =>
    ipcRenderer.invoke('session:deleteBackup', platform),

  // OAuth popup sign-in (opens separate window for manual sign-in)
  oauthSignIn: (platform: Platform) => ipcRenderer.invoke('oauth:signIn', platform),

  // Create platform-shared tab
  tabCreatePlatform: (platform: Platform, url?: string) =>
    ipcRenderer.invoke('tab:createPlatform', { platform, url }),

  // Hide/show BrowserViews for modal overlays
  viewsSetVisible: (visible: boolean) => ipcRenderer.invoke('views:setVisible', visible),

  // ==================== MARKETING QUEUE API ====================
  queueStatus: () => ipcRenderer.invoke('queue:status'),
  queueAdd: (task: {
    platform: Platform
    action: MarketingTask['action']
    content?: string
    targetUrl?: string
    priority?: number
    scheduledTime?: string
    recurrence?: { type: 'none' | 'daily' | 'weekly' | 'custom'; intervalMs?: number; endAfter?: number; occurrenceCount?: number }
    batchId?: string
    hashtags?: string[]
  }) => ipcRenderer.invoke('queue:add', task),
  queueProcess: (platform: Platform) => ipcRenderer.invoke('queue:process', platform),
  queueComplete: (taskId: string, result?: any, error?: string) =>
    ipcRenderer.invoke('queue:complete', { taskId, result, error }),
  queueRemove: (taskId: string) => ipcRenderer.invoke('queue:remove', taskId),
  queueClear: (status?: 'completed' | 'failed' | 'all') => ipcRenderer.invoke('queue:clear', status),

  // Queue event listeners
  onQueueUpdated: (callback: (queue: MarketingTask[]) => void) => {
    const handler = (_event: any, queue: MarketingTask[]) => callback(queue)
    ipcRenderer.on('queue:updated', handler)
    return () => {
      ipcRenderer.removeListener('queue:updated', handler)
    }
  },
  onTaskStarted: (callback: (task: MarketingTask) => void) => {
    const handler = (_event: any, task: MarketingTask) => callback(task)
    ipcRenderer.on('queue:taskStarted', handler)
    return () => {
      ipcRenderer.removeListener('queue:taskStarted', handler)
    }
  },
  onTaskCompleted: (callback: (task: MarketingTask) => void) => {
    const handler = (_event: any, task: MarketingTask) => callback(task)
    ipcRenderer.on('queue:taskCompleted', handler)
    return () => {
      ipcRenderer.removeListener('queue:taskCompleted', handler)
    }
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Settings API
  settingsGetApiKeyStatus: () => ipcRenderer.invoke('settings:getApiKeyStatus'),
  settingsSetApiKey: (apiKey: string) => ipcRenderer.invoke('settings:setApiKey', apiKey),
  settingsValidateApiKey: (apiKey: string) => ipcRenderer.invoke('settings:validateApiKey', apiKey),
  settingsRemoveApiKey: () => ipcRenderer.invoke('settings:removeApiKey'),
  settingsGetBrainStatus: () => ipcRenderer.invoke('settings:getBrainStatus'),

  // ==================== AUTO-UPDATER API ====================
  onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => {
    const handler = (_event: any, info: { version: string; releaseDate: string }) => callback(info)
    ipcRenderer.on('updater:update-available', handler)
    return () => { ipcRenderer.removeListener('updater:update-available', handler) }
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void) => {
    const handler = (_event: any, progress: { percent: number }) => callback(progress)
    ipcRenderer.on('updater:download-progress', handler)
    return () => { ipcRenderer.removeListener('updater:download-progress', handler) }
  },
  onUpdateDownloaded: (callback: (info: { version: string; releaseDate: string }) => void) => {
    const handler = (_event: any, info: { version: string; releaseDate: string }) => callback(info)
    ipcRenderer.on('updater:update-downloaded', handler)
    return () => { ipcRenderer.removeListener('updater:update-downloaded', handler) }
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('updater:update-not-available', handler)
    return () => { ipcRenderer.removeListener('updater:update-not-available', handler) }
  },
  onUpdateError: (callback: (info: { message: string }) => void) => {
    const handler = (_event: any, info: { message: string }) => callback(info)
    ipcRenderer.on('updater:error', handler)
    return () => { ipcRenderer.removeListener('updater:error', handler) }
  },
  updaterCheckForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  updaterGetStatus: () => ipcRenderer.invoke('updater:getStatus'),
  updaterQuitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
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
      onExternalCommand: (callback: (command: string) => void) => (() => void)
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
      onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => (() => void)

      // Secure Vault API
      vaultStatus: () => Promise<VaultStatus>
      vaultExists: () => Promise<boolean>
      vaultCreate: (masterPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultUnlock: (masterPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultLock: () => Promise<{ success: boolean }>
      vaultChangeMasterPassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
      vaultActivity: () => Promise<{ success: boolean }>
      onVaultUnlocked: (callback: () => void) => (() => void)
      onVaultLocked: (callback: () => void) => (() => void)

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

      // Platform Session API
      sessionList: () => Promise<{ success: boolean; sessions: PlatformSession[] }>
      sessionGet: (platform: Platform) => Promise<{ success: boolean; session: PlatformSession | null }>
      sessionVerify: (platform: Platform) => Promise<{ success: boolean; platform: Platform; isAuthenticated: boolean }>
      sessionUpdate: (platform: Platform, updates: Partial<PlatformSession>) => Promise<{ success: boolean; session: PlatformSession | null }>
      sessionClear: (platform: Platform) => Promise<{ success: boolean }>
      sessionExport: (platform: Platform, password: string) => Promise<{ success: boolean; platform: Platform; cookieCount: number }>
      sessionImport: (platform: Platform, password: string) => Promise<{ success: boolean; platform: Platform; imported: number; skipped: number }>
      sessionExportAll: (password: string) => Promise<{ success: boolean; results: { platform: string; cookies: number }[] }>
      sessionImportAll: (password: string) => Promise<{ success: boolean; results: { platform: string; imported: number }[] }>
      sessionListBackups: () => Promise<{ success: boolean; backups: { version: number; lastBackupAt: number; backups: { platform: string; file: string; exportedAt: number; cookieCount: number }[] } }>
      sessionDeleteBackup: (platform: Platform) => Promise<{ success: boolean }>
      oauthSignIn: (platform: Platform) => Promise<{ success: boolean; platform: Platform; userClosed?: boolean; error?: string }>
      tabCreatePlatform: (platform: Platform, url?: string) => Promise<{ success: boolean; id: number; platform: Platform; tabs: TabInfo[] }>

      // View visibility (for modal overlays)
      viewsSetVisible: (visible: boolean) => Promise<{ success: boolean }>

      // Marketing Queue API
      queueStatus: () => Promise<{ success: boolean; queue: MarketingTask[]; activeTasks: Record<string, MarketingTask>; stats: QueueStats }>
      queueAdd: (task: { platform: Platform; action: MarketingTask['action']; content?: string; targetUrl?: string; priority?: number }) => Promise<{ success: boolean; task: MarketingTask }>
      queueProcess: (platform: Platform) => Promise<{ success: boolean; task: MarketingTask | null; error?: string }>
      queueComplete: (taskId: string, result?: any, error?: string) => Promise<{ success: boolean; task?: MarketingTask; error?: string }>
      queueRemove: (taskId: string) => Promise<{ success: boolean; error?: string }>
      queueClear: (status?: 'completed' | 'failed' | 'all') => Promise<{ success: boolean; remaining: number }>
      onQueueUpdated: (callback: (queue: MarketingTask[]) => void) => (() => void)
      onTaskStarted: (callback: (task: MarketingTask) => void) => (() => void)
      onTaskCompleted: (callback: (task: MarketingTask) => void) => (() => void)

      // App info
      getAppVersion: () => Promise<string>

      // Settings API
      settingsGetApiKeyStatus: () => Promise<{ hasKey: boolean; keyPreview: string | null }>
      settingsSetApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>
      settingsValidateApiKey: (apiKey: string) => Promise<{ success: boolean; valid?: boolean; error?: string }>
      settingsRemoveApiKey: () => Promise<{ success: boolean; error?: string }>
      settingsGetBrainStatus: () => Promise<{ isRunning: boolean; pid: number | null }>

      // Auto-updater API
      onUpdateAvailable: (callback: (info: { version: string; releaseDate: string }) => void) => (() => void)
      onUpdateDownloadProgress: (callback: (progress: { percent: number }) => void) => (() => void)
      onUpdateDownloaded: (callback: (info: { version: string; releaseDate: string }) => void) => (() => void)
      onUpdateNotAvailable: (callback: () => void) => (() => void)
      onUpdateError: (callback: (info: { message: string }) => void) => (() => void)
      updaterCheckForUpdates: () => Promise<{ success: boolean; version?: string; error?: string }>
      updaterGetStatus: () => Promise<{ status: string; version?: string; releaseDate?: string; percent?: number; error?: string }>
      updaterQuitAndInstall: () => Promise<void>
    }
  }
}
