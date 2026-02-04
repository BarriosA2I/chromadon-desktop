import { useEffect, useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useChromadonStore, EmbeddedTab, VaultStatus, ChromadonProfile, StoredCredential, Platform } from './store/chromadonStore'
import { useChromadonAPI } from './hooks/useChromadonAPI'
import SplashScreen from './components/SplashScreen'
import TitleBar from './components/TitleBar'
import CommandInput from './components/CommandInput'
import AIStatusPanel from './components/AIStatusPanel'
import TabBar from './components/TabBar'
import ActionLog from './components/ActionLog'
import MasterPasswordModal from './components/MasterPasswordModal'
import CredentialVault from './components/CredentialVault'
import ProfileManager from './components/ProfileManager'
import SessionSetup from './components/SessionSetup'
import MarketingQueue from './components/MarketingQueue'

function App() {
  const store = useChromadonStore()
  const {
    showSplash,
    setShowSplash,
    isConnected,
    setCommand,
    setEmbeddedTabs,
    setConnected,
    addActionLog,
    vaultStatus,
    setVaultStatus,
    setProfiles,
    setCurrentProfile,
    setCredentials,
    showVaultModal,
    vaultModalMode,
    setShowVaultModal,
  } = store
  const { connect, fetchAIStatus, executeCommand } = useChromadonAPI()

  // Check vault status on mount
  useEffect(() => {
    const checkVault = async () => {
      if (window.electronAPI?.vaultStatus) {
        const status = await window.electronAPI.vaultStatus()
        setVaultStatus(status)

        // If vault exists and is locked, show unlock modal
        if (status.exists && status.isLocked) {
          setShowVaultModal(true, 'unlock')
        }
        // If vault doesn't exist, show create modal
        else if (!status.exists) {
          setShowVaultModal(true, 'create')
        }
        // If vault is unlocked, hide modal and load data
        else if (status.exists && !status.isLocked) {
          setShowVaultModal(false)
          await loadVaultData()
        }
      }
    }

    checkVault()

    // Listen for vault lock/unlock events
    if (window.electronAPI?.onVaultLocked) {
      window.electronAPI.onVaultLocked(() => {
        setVaultStatus({ ...vaultStatus, isLocked: true })
        setShowVaultModal(true, 'unlock')
        setProfiles([])
        setCurrentProfile(null)
        setCredentials([])
      })
    }

    if (window.electronAPI?.onVaultUnlocked) {
      window.electronAPI.onVaultUnlocked(async () => {
        const status = await window.electronAPI.vaultStatus()
        setVaultStatus(status)
        setShowVaultModal(false) // Close the vault modal
        await loadVaultData()
      })
    }
  }, [])

  // Load profiles and credentials from vault
  const loadVaultData = async () => {
    if (window.electronAPI?.profileList) {
      const profileResult = await window.electronAPI.profileList()
      if (profileResult.success) {
        setProfiles(profileResult.profiles)
      }
    }

    if (window.electronAPI?.profileCurrent) {
      const currentResult = await window.electronAPI.profileCurrent()
      if (currentResult.success && currentResult.profile) {
        setCurrentProfile(currentResult.profile)
      }
    }

    if (window.electronAPI?.credentialList) {
      const credResult = await window.electronAPI.credentialList()
      if (credResult.success) {
        setCredentials(credResult.credentials)
      }
    }
  }

  useEffect(() => {
    // Initialize connection after splash - use embedded mode
    const timer = setTimeout(async () => {
      // Set connected in embedded mode (no external Brain API needed for basic browsing)
      setConnected(true, 'EMBEDDED')
      setShowSplash(false)

      // Also try to connect to Brain API for AI features
      await connect()

      addActionLog({
        type: 'success',
        description: 'CHROMADON Desktop Browser ready (Embedded Mode)',
        success: true,
      })
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  // Poll for AI status updates when connected to Brain API
  useEffect(() => {
    if (!isConnected) return

    const pollInterval = setInterval(() => {
      fetchAIStatus()
    }, 5000)

    // Initial fetch
    fetchAIStatus()

    return () => clearInterval(pollInterval)
  }, [isConnected])

  // Listen for embedded tab updates from Electron
  useEffect(() => {
    if (window.electronAPI?.onTabsUpdated) {
      window.electronAPI.onTabsUpdated((tabs: EmbeddedTab[]) => {
        setEmbeddedTabs(tabs)
      })
    }

    // Initial tab list fetch
    if (window.electronAPI?.tabList) {
      window.electronAPI.tabList().then((result) => {
        if (result.success) {
          setEmbeddedTabs(result.tabs as EmbeddedTab[])
        }
      })
    }
  }, [setEmbeddedTabs])

  // Claude Code Control: Listen for external commands
  useEffect(() => {
    if (window.electronAPI?.onExternalCommand) {
      window.electronAPI.onExternalCommand(async (command: string) => {
        console.log('[CHROMADON] External command received:', command)
        setCommand(command)
        // Small delay to let UI update, then execute
        setTimeout(async () => {
          await executeCommand(command)
        }, 100)
      })
    }
  }, [executeCommand, setCommand])

  // Claude Code Control: Send state updates to main process
  useEffect(() => {
    if (window.electronAPI?.sendStateUpdate) {
      const stateToSend = {
        isConnected: store.isConnected,
        connectionMode: store.connectionMode,
        aiState: store.aiState,
        confidence: store.confidence,
        circuitState: store.circuitState,
        cognitiveMode: store.cognitiveMode,
        command: store.command,
        isProcessing: store.isProcessing,
        tabs: store.embeddedTabs, // Use embedded tabs
        actionLogs: store.actionLogs.slice(-20), // Last 20 logs
        memoryStats: store.memoryStats,
      }
      window.electronAPI.sendStateUpdate(stateToSend)
    }
  }, [
    store.isConnected,
    store.connectionMode,
    store.aiState,
    store.confidence,
    store.circuitState,
    store.cognitiveMode,
    store.command,
    store.isProcessing,
    store.embeddedTabs,
    store.actionLogs,
    store.memoryStats,
  ])

  // Handle vault create/unlock
  const handleVaultSubmit = async (password: string, confirmPassword?: string) => {
    if (!vaultStatus.exists) {
      // Create new vault
      if (window.electronAPI?.vaultCreate) {
        const result = await window.electronAPI.vaultCreate(password)
        if (result.success) {
          setShowVaultModal(false)
          const status = await window.electronAPI.vaultStatus()
          setVaultStatus(status)
          await loadVaultData()
          addActionLog({
            type: 'success',
            description: 'Secure vault created successfully',
            success: true,
          })
        }
        return result
      }
    } else {
      // Unlock existing vault
      if (window.electronAPI?.vaultUnlock) {
        const result = await window.electronAPI.vaultUnlock(password)
        if (result.success) {
          setShowVaultModal(false)
          const status = await window.electronAPI.vaultStatus()
          setVaultStatus(status)
          await loadVaultData()
          addActionLog({
            type: 'success',
            description: 'Vault unlocked',
            success: true,
          })
        }
        return result
      }
    }
    return { success: false, error: 'Vault API not available' }
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-chroma-black">
      <AnimatePresence mode="wait">
        {showSplash ? (
          <SplashScreen key="splash" />
        ) : (
          <MainUI key="main" onVaultSubmit={handleVaultSubmit} loadVaultData={loadVaultData} />
        )}
      </AnimatePresence>

      {/* Master Password Modal - shown over everything */}
      <MasterPasswordModal
        isOpen={showVaultModal && !showSplash}
        mode={vaultModalMode}
        failedAttempts={0}
        lockoutRemaining={vaultStatus.lockoutRemaining}
        onSubmit={handleVaultSubmit}
      />
    </div>
  )
}

interface MainUIProps {
  onVaultSubmit: (password: string, confirmPassword?: string) => Promise<{ success: boolean; error?: string }>
  loadVaultData: () => Promise<void>
}

function MainUI({ onVaultSubmit, loadVaultData }: MainUIProps) {
  const {
    embeddedTabs,
    addActionLog,
    vaultStatus,
    profiles,
    currentProfile,
    credentials,
    setCredentials,
    showCredentialVault,
    setShowCredentialVault,
    showProfileManager,
    setShowProfileManager,
    showSessionSetup,
    setShowSessionSetup,
    showMarketingQueue,
    setShowMarketingQueue,
    setPlatformSessions,
    setMarketingQueue,
  } = useChromadonStore()

  const [currentDomain, setCurrentDomain] = useState<string | undefined>()

  // Load platform sessions on mount
  useEffect(() => {
    if (window.electronAPI?.sessionList) {
      window.electronAPI.sessionList().then((result) => {
        if (result.success && result.sessions) {
          setPlatformSessions(result.sessions)
        }
      })
    }
  }, [setPlatformSessions])

  // Listen for queue updates
  useEffect(() => {
    if (window.electronAPI?.onQueueUpdated) {
      window.electronAPI.onQueueUpdated((queue) => {
        setMarketingQueue(queue)
      })
    }
  }, [setMarketingQueue])

  // Get current domain from active tab
  useEffect(() => {
    const activeTab = embeddedTabs.find(t => t.isActive)
    if (activeTab?.url) {
      try {
        const url = new URL(activeTab.url)
        setCurrentDomain(url.hostname)
      } catch {
        setCurrentDomain(undefined)
      }
    }
  }, [embeddedTabs])

  // Tab management handlers
  const handleTabCreate = useCallback(async () => {
    if (window.electronAPI?.tabCreate) {
      const result = await window.electronAPI.tabCreate('about:blank')
      if (result.success) {
        addActionLog({
          type: 'success',
          description: `Created new tab #${result.id}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleTabClose = useCallback(async (id: number) => {
    if (window.electronAPI?.tabClose) {
      const result = await window.electronAPI.tabClose(id)
      if (result.success) {
        addActionLog({
          type: 'success',
          description: `Closed tab #${id}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleTabFocus = useCallback(async (id: number) => {
    if (window.electronAPI?.tabFocus) {
      await window.electronAPI.tabFocus(id)
    }
  }, [])

  const handleNavigate = useCallback(async (id: number, url: string) => {
    if (window.electronAPI?.tabNavigate) {
      const result = await window.electronAPI.tabNavigate(id, url)
      if (result.success) {
        addActionLog({
          type: 'navigate',
          description: `Navigating to ${url}`,
          success: true,
        })
      }
    }
  }, [addActionLog])

  const handleBack = useCallback(async (id: number) => {
    if (window.electronAPI?.tabBack) {
      await window.electronAPI.tabBack(id)
    }
  }, [])

  const handleForward = useCallback(async (id: number) => {
    if (window.electronAPI?.tabForward) {
      await window.electronAPI.tabForward(id)
    }
  }, [])

  const handleReload = useCallback(async (id: number) => {
    if (window.electronAPI?.tabReload) {
      await window.electronAPI.tabReload(id)
    }
  }, [])

  // Credential handlers
  const handleAddCredential = async (credential: any) => {
    if (window.electronAPI?.credentialAdd) {
      const result = await window.electronAPI.credentialAdd(credential)
      if (result.success) {
        await loadVaultData()
        addActionLog({
          type: 'success',
          description: `Added credential for ${credential.domain}`,
          success: true,
        })
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  const handleEditCredential = async (id: string, updates: any) => {
    if (window.electronAPI?.credentialUpdate) {
      const result = await window.electronAPI.credentialUpdate(id, updates)
      if (result.success) {
        await loadVaultData()
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  const handleDeleteCredential = async (id: string) => {
    if (window.electronAPI?.credentialDelete) {
      const result = await window.electronAPI.credentialDelete(id)
      if (result.success) {
        await loadVaultData()
        addActionLog({
          type: 'success',
          description: 'Credential deleted',
          success: true,
        })
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  const handleAutofill = async (credentialId: string) => {
    const activeTab = embeddedTabs.find(t => t.isActive)
    if (!activeTab) {
      return { success: false, error: 'No active tab' }
    }

    if (window.electronAPI?.credentialAutofill) {
      const result = await window.electronAPI.credentialAutofill(activeTab.id, credentialId)
      if (result.success) {
        addActionLog({
          type: 'success',
          description: 'Credentials auto-filled',
          success: true,
        })
        setShowCredentialVault(false)
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  const handleCopyUsername = async (credentialId: string) => {
    if (window.electronAPI?.credentialCopyUsername) {
      return window.electronAPI.credentialCopyUsername(credentialId)
    }
    return { success: false }
  }

  const handleCopyPassword = async (credentialId: string) => {
    if (window.electronAPI?.credentialCopyPassword) {
      const result = await window.electronAPI.credentialCopyPassword(credentialId)
      if (result.success) {
        addActionLog({
          type: 'success',
          description: `Password copied (clears in ${result.clearAfterSeconds}s)`,
          success: true,
        })
      }
      return result
    }
    return { success: false }
  }

  // Profile handlers
  const handleSelectProfile = async (id: string) => {
    if (window.electronAPI?.profileSwitch) {
      const result = await window.electronAPI.profileSwitch(id)
      if (result.success) {
        await loadVaultData()
        addActionLog({
          type: 'success',
          description: 'Switched profile',
          success: true,
        })
      }
    }
  }

  const handleCreateProfile = async (name: string) => {
    if (window.electronAPI?.profileCreate) {
      const result = await window.electronAPI.profileCreate(name)
      if (result.success) {
        await loadVaultData()
        addActionLog({
          type: 'success',
          description: `Created profile "${name}"`,
          success: true,
        })
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  const handleDeleteProfile = async (id: string) => {
    if (window.electronAPI?.profileDelete) {
      const result = await window.electronAPI.profileDelete(id)
      if (result.success) {
        await loadVaultData()
      }
      return result
    }
    return { success: false, error: 'API not available' }
  }

  // Lock vault handler
  const handleLockVault = async () => {
    if (window.electronAPI?.vaultLock) {
      await window.electronAPI.vaultLock()
    }
  }

  return (
    <>
      <TitleBar />
      <TabBar
        tabs={embeddedTabs}
        onTabCreate={handleTabCreate}
        onTabClose={handleTabClose}
        onTabFocus={handleTabFocus}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
      />
      <main className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Column - Browser View Area (BrowserView renders here via Electron) */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Placeholder when no tabs */}
          {embeddedTabs.length === 0 && (
            <div className="flex-1 flex items-center justify-center bg-chroma-dark/30 m-2 rounded-lg border border-chroma-teal/20">
              <div className="text-center">
                <div className="text-6xl mb-4">🌐</div>
                <h2 className="text-xl font-bold text-chroma-teal mb-2">Welcome to CHROMADON</h2>
                <p className="text-chroma-muted mb-4">Click + to open a new tab and start browsing</p>
                <button
                  onClick={handleTabCreate}
                  className="px-6 py-2 bg-chroma-teal/20 border border-chroma-teal rounded-lg text-chroma-teal hover:bg-chroma-teal/30 transition-colors"
                >
                  Open New Tab
                </button>
              </div>
            </div>
          )}
          {/* BrowserView renders in this space (managed by Electron main process) */}
          {embeddedTabs.length > 0 && (
            <div className="flex-1 m-2 rounded-lg border border-chroma-teal/10 pointer-events-none">
              {/* BrowserView is positioned here by Electron - this div is transparent overlay for border only */}
            </div>
          )}
          {/* Command Input at bottom */}
          <div className="p-2">
            <CommandInput />
          </div>
        </div>

        {/* Right Column - AI Status & Logs */}
        <div className="w-80 flex flex-col gap-2 p-2">
          {/* Vault Quick Access */}
          <div className="cyber-panel p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${vaultStatus.isLocked ? 'bg-chroma-error' : 'bg-chroma-success'}`} />
              <span className="text-sm font-mono text-chroma-muted">
                {vaultStatus.isLocked ? 'Vault Locked' : currentProfile?.name || 'Default'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!vaultStatus.isLocked && (
                <>
                  {/* Profile Switcher */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileManager(!showProfileManager)}
                      className="p-2 rounded-lg text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10 transition-colors"
                      title="Switch Profile"
                    >
                      <UserIcon />
                    </button>
                    <AnimatePresence>
                      {showProfileManager && (
                        <ProfileManager
                          profiles={profiles}
                          currentProfileId={currentProfile?.id || null}
                          onSelect={handleSelectProfile}
                          onCreate={handleCreateProfile}
                          onDelete={handleDeleteProfile}
                          onClose={() => setShowProfileManager(false)}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Credential Vault */}
                  <button
                    onClick={() => setShowCredentialVault(true)}
                    className="p-2 rounded-lg text-chroma-muted hover:text-chroma-purple hover:bg-chroma-purple/10 transition-colors"
                    title="Credential Vault"
                  >
                    <KeyIcon />
                  </button>

                  {/* Lock Vault */}
                  <button
                    onClick={handleLockVault}
                    className="p-2 rounded-lg text-chroma-muted hover:text-chroma-gold hover:bg-chroma-gold/10 transition-colors"
                    title="Lock Vault"
                  >
                    <LockIcon />
                  </button>
                </>
              )}
              {/* Session Setup - always visible */}
              <button
                onClick={() => setShowSessionSetup(true)}
                className="p-2 rounded-lg text-chroma-muted hover:text-chroma-teal hover:bg-chroma-teal/10 transition-colors"
                title="Platform Sessions"
              >
                <SessionIcon />
              </button>
              {/* Marketing Queue */}
              <button
                onClick={() => setShowMarketingQueue(true)}
                className="p-2 rounded-lg text-chroma-muted hover:text-chroma-purple hover:bg-chroma-purple/10 transition-colors"
                title="Marketing Queue"
              >
                <QueueIcon />
              </button>
            </div>
          </div>

          <AIStatusPanel />
          <ActionLog />
        </div>
      </main>

      {/* Credential Vault Modal */}
      <CredentialVault
        isOpen={showCredentialVault}
        credentials={credentials}
        currentProfileId={currentProfile?.id || null}
        currentDomain={currentDomain}
        onClose={() => setShowCredentialVault(false)}
        onAdd={handleAddCredential}
        onEdit={handleEditCredential}
        onDelete={handleDeleteCredential}
        onAutofill={handleAutofill}
        onCopyUsername={handleCopyUsername}
        onCopyPassword={handleCopyPassword}
      />

      {/* Session Setup Modal */}
      <SessionSetup
        isOpen={showSessionSetup}
        onClose={() => setShowSessionSetup(false)}
      />

      {/* Marketing Queue Modal */}
      <MarketingQueue
        isOpen={showMarketingQueue}
        onClose={() => setShowMarketingQueue(false)}
      />
    </>
  )
}

// Icons
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function SessionIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <path d="M16 11h6" />
      <path d="M19 8v6" />
    </svg>
  )
}

function QueueIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
    </svg>
  )
}

export default App
