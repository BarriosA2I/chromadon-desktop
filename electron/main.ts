import { app, BrowserWindow, ipcMain, shell, clipboard } from 'electron'
import path from 'path'
import express from 'express'
import type { Request, Response } from 'express'
import * as fs from 'fs'
import { browserViewManager, TabInfo } from './browser-view-manager'
import { vault, ChromadonProfile, StoredCredential } from './security/vault'

let mainWindow: BrowserWindow | null = null
const CONTROL_PORT = 3002

// Store for renderer state (updated via IPC)
let rendererState: any = {
  isConnected: false,
  connectionMode: 'EMBEDDED',
  aiState: 'idle',
  confidence: 0,
  command: '',
  tabs: [],
  actionLogs: [],
}

// Embedded browser tabs state
let embeddedTabs: TabInfo[] = []

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    frame: false, // Frameless for custom title bar
    transparent: false,
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false, // Don't show until ready
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the app
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Handle external links and OAuth popups
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // OAuth provider patterns - allow these as popup windows
    const oauthPatterns = [
      /accounts\.google\.com/,
      /github\.com\/login\/oauth/,
      /github\.com\/sessions/,
      /api\.twitter\.com\/oauth/,
      /twitter\.com\/i\/oauth/,
      /facebook\.com.*oauth/,
      /login\.microsoftonline\.com/,
      /appleid\.apple\.com/,
      /discord\.com\/api\/oauth/,
    ]

    const isOAuth = oauthPatterns.some(pattern => pattern.test(url))

    if (isOAuth) {
      // Allow OAuth popups to open as modal windows
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 700,
          center: true,
          parent: mainWindow!,
          modal: true,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            partition: 'persist:oauth-flow',
          },
        },
      }
    }

    // Default: open in system browser
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    browserViewManager.destroy()
    mainWindow = null
  })

  // Initialize BrowserViewManager with main window
  browserViewManager.setMainWindow(mainWindow)

  // Set up tab update notifications to renderer
  browserViewManager.onTabUpdate((tabs) => {
    embeddedTabs = tabs
    if (mainWindow) {
      mainWindow.webContents.send('tabs:updated', tabs)
      // Update bounds when tabs change (nav bar visibility changes)
      updateViewBounds()
    }
  })

  // Update view bounds when window resizes
  mainWindow.on('resize', () => {
    updateViewBounds()
  })

  // Initial bounds calculation
  setTimeout(updateViewBounds, 100)
}

/**
 * Calculate and update BrowserView bounds based on window size
 */
function updateViewBounds() {
  if (!mainWindow) return

  const [width, height] = mainWindow.getContentSize()

  // Layout measurements (in pixels):
  // - TitleBar: 40px
  // - TabBar (tabs strip): 40px
  // - Navigation bar (URL, back/forward): 50px
  // - Content margin: 8px (m-2 = 0.5rem)
  // - Right sidebar: 320px + 8px padding
  // - Bottom CommandInput area: 80px
  const bounds = {
    x: 8, // Left margin (m-2 in React)
    y: 138, // TitleBar(40) + TabStrip(40) + NavBar(50) + margin(8)
    width: width - 344, // Full width - sidebar(320) - left margin(8) - right padding(16)
    height: height - 226, // Full height - top(138) - bottom command area(80) - margin(8)
  }

  browserViewManager.setViewBounds(bounds)
}

// ==================== CLAUDE CODE CONTROL SERVER ====================

function startControlServer() {
  const server = express()
  server.use(express.json())

  // CORS for local development
  server.use((_req: Request, res: Response, next: Function) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (_req.method === 'OPTIONS') {
      res.sendStatus(200)
      return
    }
    next()
  })

  // Health check
  server.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'chromadon-desktop-control',
      port: CONTROL_PORT,
      windowReady: mainWindow !== null,
    })
  })

  // Get app state from renderer
  server.get('/state', (_req: Request, res: Response) => {
    res.json(rendererState)
  })

  // Send command to renderer
  server.post('/command', async (req: Request, res: Response) => {
    try {
      const { command } = req.body
      if (!command) {
        res.status(400).json({ success: false, error: 'Command is required' })
        return
      }

      if (!mainWindow) {
        res.status(503).json({ success: false, error: 'Window not ready' })
        return
      }

      // Send command to renderer via IPC
      mainWindow.webContents.send('claude:executeCommand', command)

      res.json({ success: true, message: 'Command sent to UI', command })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Take screenshot of the window
  server.get('/screenshot', async (req: Request, res: Response) => {
    try {
      if (!mainWindow) {
        res.status(503).json({ success: false, error: 'Window not ready' })
        return
      }

      const image = await mainWindow.webContents.capturePage()
      const pngBuffer = image.toPNG()

      // If path query param provided, save to file
      const savePath = req.query.path as string
      if (savePath) {
        fs.writeFileSync(savePath, pngBuffer)
        res.json({ success: true, path: savePath, size: pngBuffer.length })
      } else {
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Content-Length', pngBuffer.length)
        res.send(pngBuffer)
      }
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Inject CSS for design iteration
  server.post('/design/css', async (req: Request, res: Response) => {
    try {
      const { css } = req.body
      if (!css) {
        res.status(400).json({ success: false, error: 'CSS is required' })
        return
      }

      if (!mainWindow) {
        res.status(503).json({ success: false, error: 'Window not ready' })
        return
      }

      await mainWindow.webContents.insertCSS(css)
      res.json({ success: true, message: 'CSS injected' })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Execute JavaScript in renderer
  server.post('/execute', async (req: Request, res: Response) => {
    try {
      const { script } = req.body
      if (!script) {
        res.status(400).json({ success: false, error: 'Script is required' })
        return
      }

      if (!mainWindow) {
        res.status(503).json({ success: false, error: 'Window not ready' })
        return
      }

      const result = await mainWindow.webContents.executeJavaScript(script)
      res.json({ success: true, result })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Focus the window
  server.post('/focus', (_req: Request, res: Response) => {
    if (mainWindow) {
      mainWindow.focus()
      mainWindow.show()
      res.json({ success: true, message: 'Window focused' })
    } else {
      res.status(503).json({ success: false, error: 'Window not ready' })
    }
  })

  // ==================== EMBEDDED TAB ENDPOINTS ====================

  // List all embedded tabs
  server.get('/tabs', (_req: Request, res: Response) => {
    res.json({
      success: true,
      tabs: browserViewManager.getTabs(),
      activeTabId: browserViewManager.getActiveTabId(),
    })
  })

  // Create new embedded tab
  server.post('/tabs/create', (req: Request, res: Response) => {
    try {
      const { url } = req.body
      const id = browserViewManager.createView(url || 'about:blank')
      res.json({ success: true, id, tabs: browserViewManager.getTabs() })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Navigate embedded tab
  server.post('/tabs/navigate', (req: Request, res: Response) => {
    try {
      const { id, url } = req.body
      if (id === undefined || !url) {
        res.status(400).json({ success: false, error: 'id and url are required' })
        return
      }
      const success = browserViewManager.navigateView(id, url)
      res.json({ success })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Focus embedded tab
  server.post('/tabs/focus', (req: Request, res: Response) => {
    try {
      const { id } = req.body
      if (id === undefined) {
        res.status(400).json({ success: false, error: 'id is required' })
        return
      }
      const success = browserViewManager.focusView(id)
      res.json({ success })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Close embedded tab
  server.post('/tabs/close', (req: Request, res: Response) => {
    try {
      const { id } = req.body
      if (id === undefined) {
        res.status(400).json({ success: false, error: 'id is required' })
        return
      }
      const success = browserViewManager.removeView(id)
      res.json({ success, tabs: browserViewManager.getTabs() })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Screenshot embedded tab
  server.get('/tabs/screenshot/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const buffer = await browserViewManager.getScreenshot(id)
      if (buffer) {
        const savePath = req.query.path as string
        if (savePath) {
          fs.writeFileSync(savePath, buffer)
          res.json({ success: true, path: savePath, size: buffer.length })
        } else {
          res.setHeader('Content-Type', 'image/png')
          res.setHeader('Content-Length', buffer.length)
          res.send(buffer)
        }
      } else {
        res.status(404).json({ success: false, error: 'Tab not found' })
      }
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Execute script in embedded tab
  server.post('/tabs/execute', async (req: Request, res: Response) => {
    try {
      const { id, script } = req.body
      if (id === undefined || !script) {
        res.status(400).json({ success: false, error: 'id and script are required' })
        return
      }
      const result = await browserViewManager.executeScript(id, script)
      res.json({ success: true, result })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Debug endpoint: set bounds manually
  server.post('/debug/bounds', (req: Request, res: Response) => {
    const { x, y, width, height } = req.body
    const bounds = { x: x ?? 0, y: y ?? 0, width: width ?? 800, height: height ?? 600 }
    browserViewManager.setViewBounds(bounds)
    console.log('[DEBUG] Set bounds to:', bounds)
    res.json({ success: true, bounds })
  })

  // Debug endpoint: get current window info
  server.get('/debug/info', (_req: Request, res: Response) => {
    const contentSize = mainWindow?.getContentSize() || [0, 0]
    const size = mainWindow?.getSize() || [0, 0]
    // Check how many BrowserViews are attached
    const browserViews = mainWindow?.getBrowserViews() || []
    const viewInfo = browserViews.map((view, idx) => ({
      index: idx,
      bounds: view.getBounds(),
      url: view.webContents?.getURL(),
    }))
    res.json({
      contentSize,
      size,
      tabs: browserViewManager.getTabs(),
      activeTabId: browserViewManager.getActiveTabId(),
      attachedViews: viewInfo,
    })
  })

  server.listen(CONTROL_PORT, '127.0.0.1', () => {
    console.log(`[CHROMADON Desktop] Control server running on http://127.0.0.1:${CONTROL_PORT}`)
    console.log(`[CHROMADON Desktop] Endpoints:`)
    console.log(`  GET  /health     - Health check`)
    console.log(`  GET  /state      - Get app state`)
    console.log(`  POST /command    - Send command to execute`)
    console.log(`  GET  /screenshot - Capture window screenshot`)
    console.log(`  POST /design/css - Inject CSS for design`)
    console.log(`  POST /execute    - Run JavaScript in renderer`)
    console.log(`  POST /focus      - Focus the window`)
    console.log(`  POST /debug/bounds - Set BrowserView bounds`)
    console.log(`  GET  /debug/info   - Get window info`)
  })
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false
})

// Claude Code Control: Receive state updates from renderer
ipcMain.on('claude:stateUpdate', (_event, state) => {
  rendererState = state
})

// ==================== EMBEDDED TAB IPC HANDLERS ====================

// Create new embedded tab
ipcMain.handle('tab:create', (_event, url?: string) => {
  const id = browserViewManager.createView(url || 'about:blank')
  return { success: true, id, tabs: browserViewManager.getTabs() }
})

// Close embedded tab
ipcMain.handle('tab:close', (_event, id: number) => {
  const success = browserViewManager.removeView(id)
  return { success, tabs: browserViewManager.getTabs() }
})

// Navigate embedded tab
ipcMain.handle('tab:navigate', (_event, { id, url }: { id: number; url: string }) => {
  const success = browserViewManager.navigateView(id, url)
  return { success }
})

// Focus embedded tab
ipcMain.handle('tab:focus', (_event, id: number) => {
  const success = browserViewManager.focusView(id)
  return { success }
})

// Go back in tab history
ipcMain.handle('tab:back', (_event, id: number) => {
  const success = browserViewManager.goBack(id)
  return { success }
})

// Go forward in tab history
ipcMain.handle('tab:forward', (_event, id: number) => {
  const success = browserViewManager.goForward(id)
  return { success }
})

// Reload tab
ipcMain.handle('tab:reload', (_event, id: number) => {
  const success = browserViewManager.reload(id)
  return { success }
})

// Get all tabs
ipcMain.handle('tab:list', () => {
  return { success: true, tabs: browserViewManager.getTabs() }
})

// Get active tab ID
ipcMain.handle('tab:getActive', () => {
  return { success: true, activeTabId: browserViewManager.getActiveTabId() }
})

// Execute script in tab
ipcMain.handle('tab:execute', async (_event, { id, script }: { id: number; script: string }) => {
  try {
    const result = await browserViewManager.executeScript(id, script)
    return { success: true, result }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Take screenshot of specific tab
ipcMain.handle('tab:screenshot', async (_event, id: number) => {
  const buffer = await browserViewManager.getScreenshot(id)
  if (buffer) {
    return { success: true, screenshot: buffer.toString('base64') }
  }
  return { success: false, error: 'Tab not found' }
})

// ==================== SECURE VAULT IPC HANDLERS ====================

// Get vault status
ipcMain.handle('vault:status', () => {
  return vault.getStatus()
})

// Check if vault exists
ipcMain.handle('vault:exists', () => {
  return vault.vaultExists()
})

// Create new vault with master password
ipcMain.handle('vault:create', async (_event, masterPassword: string) => {
  return vault.create(masterPassword)
})

// Unlock vault with master password
ipcMain.handle('vault:unlock', async (_event, masterPassword: string) => {
  const result = await vault.unlock(masterPassword)
  // Notify renderer of vault state change
  if (result.success && mainWindow) {
    mainWindow.webContents.send('vault:unlocked')
  }
  return result
})

// Lock vault
ipcMain.handle('vault:lock', () => {
  vault.lock()
  if (mainWindow) {
    mainWindow.webContents.send('vault:locked')
  }
  return { success: true }
})

// Change master password
ipcMain.handle('vault:changeMasterPassword', async (_event, { currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
  return vault.changeMasterPassword(currentPassword, newPassword)
})

// Reset activity timer (call on user interaction)
ipcMain.handle('vault:activity', () => {
  vault.resetAutoLockTimer()
  return { success: true }
})

// ==================== PROFILE IPC HANDLERS ====================

// Get all profiles
ipcMain.handle('profile:list', () => {
  return { success: true, profiles: vault.getProfiles() }
})

// Get current profile
ipcMain.handle('profile:current', () => {
  const profile = vault.getCurrentProfile()
  return { success: true, profile }
})

// Create new profile
ipcMain.handle('profile:create', async (_event, { name, avatar }: { name: string; avatar?: string }) => {
  return vault.createProfile(name, avatar)
})

// Update profile
ipcMain.handle('profile:update', async (_event, { id, updates }: { id: string; updates: Partial<ChromadonProfile> }) => {
  return vault.updateProfile(id, updates)
})

// Delete profile
ipcMain.handle('profile:delete', async (_event, id: string) => {
  return vault.deleteProfile(id)
})

// Switch to profile
ipcMain.handle('profile:switch', async (_event, id: string) => {
  return vault.switchProfile(id)
})

// ==================== CREDENTIAL IPC HANDLERS ====================

// Get all credentials for current profile
ipcMain.handle('credential:list', () => {
  // Return sanitized credentials (no passwords in plain response)
  const credentials = vault.getCredentials()
  const sanitized = credentials.map(c => ({
    ...c,
    password: c.password ? '********' : undefined,
    apiKey: c.apiKey ? '********' : undefined,
    oauthTokens: c.oauthTokens ? { ...c.oauthTokens, accessToken: '********', refreshToken: '********' } : undefined,
  }))
  return { success: true, credentials: sanitized }
})

// Get credentials by domain
ipcMain.handle('credential:getByDomain', (_event, domain: string) => {
  const credentials = vault.getCredentialsByDomain(domain)
  const sanitized = credentials.map(c => ({
    ...c,
    password: c.password ? '********' : undefined,
    apiKey: c.apiKey ? '********' : undefined,
  }))
  return { success: true, credentials: sanitized }
})

// Add new credential
ipcMain.handle('credential:add', async (_event, credential: Omit<StoredCredential, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
  return vault.addCredential(credential)
})

// Update credential
ipcMain.handle('credential:update', async (_event, { id, updates }: { id: string; updates: Partial<StoredCredential> }) => {
  return vault.updateCredential(id, updates)
})

// Delete credential
ipcMain.handle('credential:delete', async (_event, id: string) => {
  return vault.deleteCredential(id)
})

// Auto-fill credential into tab
ipcMain.handle('credential:autofill', async (_event, { tabId, credentialId }: { tabId: number; credentialId: string }) => {
  const credential = vault.getCredentialById(credentialId)
  if (!credential) {
    return { success: false, error: 'Credential not found' }
  }

  if (!credential.username || !credential.password) {
    return { success: false, error: 'Credential has no username/password' }
  }

  // Login form auto-fill script
  const fillScript = `
    (function() {
      // Find password field
      const passwordField = document.querySelector('input[type="password"]');
      if (!passwordField) return { success: false, error: 'No password field found' };

      // Find username field (usually before password in DOM or in same form)
      const form = passwordField.closest('form');
      const usernameSelectors = [
        'input[type="email"]',
        'input[type="text"][name*="user"]',
        'input[type="text"][name*="email"]',
        'input[type="text"][name*="login"]',
        'input[id*="user"]',
        'input[id*="email"]',
        'input[id*="login"]',
        'input[autocomplete="username"]',
        'input[autocomplete="email"]',
        'input[type="text"]',
      ];

      let usernameField = null;
      for (const selector of usernameSelectors) {
        const field = form ? form.querySelector(selector) : document.querySelector(selector);
        if (field && field !== passwordField) {
          usernameField = field;
          break;
        }
      }

      if (!usernameField) return { success: false, error: 'No username field found' };

      // Fill credentials
      usernameField.value = ${JSON.stringify(credential.username)};
      passwordField.value = ${JSON.stringify(credential.password)};

      // Dispatch events to trigger any validation
      usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      usernameField.dispatchEvent(new Event('change', { bubbles: true }));
      passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      passwordField.dispatchEvent(new Event('change', { bubbles: true }));

      return { success: true };
    })()
  `

  try {
    const result = await browserViewManager.executeScript(tabId, fillScript)
    if (result?.success) {
      // Record usage
      await vault.recordCredentialUsage(credentialId)
    }
    return result || { success: false, error: 'Script execution failed' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// Copy password to clipboard (with auto-clear)
ipcMain.handle('credential:copyPassword', async (_event, credentialId: string) => {
  const credential = vault.getCredentialById(credentialId)
  if (!credential || !credential.password) {
    return { success: false, error: 'Credential not found or has no password' }
  }

  clipboard.writeText(credential.password)

  // Get clipboard clear timeout from current profile settings
  const profile = vault.getCurrentProfile()
  const clearSeconds = profile?.settings.clipboardClearSeconds || 30

  // Auto-clear clipboard after timeout
  setTimeout(() => {
    // Only clear if clipboard still contains the password
    if (clipboard.readText() === credential.password) {
      clipboard.clear()
    }
  }, clearSeconds * 1000)

  await vault.recordCredentialUsage(credentialId)

  return { success: true, clearAfterSeconds: clearSeconds }
})

// Copy username to clipboard
ipcMain.handle('credential:copyUsername', async (_event, credentialId: string) => {
  const credential = vault.getCredentialById(credentialId)
  if (!credential || !credential.username) {
    return { success: false, error: 'Credential not found or has no username' }
  }

  clipboard.writeText(credential.username)
  return { success: true }
})

// Detect login form on current tab
ipcMain.handle('credential:detectLoginForm', async (_event, tabId: number) => {
  const detectScript = `
    (function() {
      const forms = [];
      const passwordFields = document.querySelectorAll('input[type="password"]');

      passwordFields.forEach((pwField, idx) => {
        const form = pwField.closest('form');
        const formInfo = {
          formIndex: idx,
          formId: form?.id || null,
          formAction: form?.action || null,
          hasUsername: false,
          domain: window.location.hostname,
        };

        // Check for username field
        const usernameSelectors = [
          'input[type="email"]',
          'input[type="text"][name*="user"]',
          'input[type="text"][name*="email"]',
          'input[autocomplete="username"]',
          'input[autocomplete="email"]',
        ];

        for (const selector of usernameSelectors) {
          const field = form ? form.querySelector(selector) : document.querySelector(selector);
          if (field && field !== pwField) {
            formInfo.hasUsername = true;
            break;
          }
        }

        forms.push(formInfo);
      });

      return {
        hasLoginForm: forms.length > 0,
        forms: forms,
        url: window.location.href,
        domain: window.location.hostname,
      };
    })()
  `

  try {
    const result = await browserViewManager.executeScript(tabId, detectScript)
    return { success: true, ...result }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  startControlServer()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Security: Prevent new windows
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})
