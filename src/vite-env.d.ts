/// <reference types="vite/client" />

interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

interface VaultStatus {
  exists: boolean
  isLocked: boolean
  isLockedOut: boolean
  lockoutRemaining?: number
  profileCount?: number
  credentialCount?: number
  currentProfileId?: string
}

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

interface SanitizedCredential {
  id: string
  profileId: string
  domain: string
  displayName: string
  type: 'password' | 'oauth' | 'api-key'
  username?: string
  password?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount: number
}

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
    onTabsUpdated: (callback: (tabs: TabInfo[]) => void) => void

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
  }
}
