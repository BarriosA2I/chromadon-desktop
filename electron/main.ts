import { app, BrowserWindow, ipcMain, shell, clipboard, session, safeStorage } from 'electron'
import path from 'path'
import express from 'express'
import type { Request, Response } from 'express'
import * as fs from 'fs'
import { fork, ChildProcess } from 'child_process'
import { browserViewManager, TabInfo, Platform, SessionMode, PlatformSession } from './browser-view-manager'
import { vault, ChromadonProfile, StoredCredential } from './security/vault'
import { StorageManager } from './storage-manager'

// Screenshot storage manager (initialized in startControlServer)
const storageManager = new StorageManager()

// ==================== API KEY MANAGER ====================
// Uses a JSON envelope so we always know the storage format on read-back.
const API_KEY_FILE = 'chromadon-api-key.json'

function getApiKeyPath(): string {
  return path.join(app.getPath('userData'), API_KEY_FILE)
}

function storeApiKey(key: string): void {
  const keyPath = getApiKeyPath()
  const logFile = path.join(app.getPath('userData'), 'brain-debug.log')
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] [ApiKey] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log('[ApiKey]', msg)
  }

  try {
    const useEncryption = safeStorage.isEncryptionAvailable()
    log(`storeApiKey: encryption=${useEncryption}, path=${keyPath}`)

    if (useEncryption) {
      const encrypted = safeStorage.encryptString(key)
      const envelope = JSON.stringify({
        format: 'dpapi',
        data: encrypted.toString('base64'),
        storedAt: Date.now(),
      })
      fs.writeFileSync(keyPath, envelope, 'utf8')
    } else {
      const envelope = JSON.stringify({
        format: 'base64',
        data: Buffer.from(key).toString('base64'),
        storedAt: Date.now(),
      })
      fs.writeFileSync(keyPath, envelope, 'utf8')
    }

    // Verify the write by reading back
    const verify = loadApiKey()
    if (verify && verify.startsWith('sk-ant-')) {
      log(`storeApiKey: verified OK (${verify.slice(0, 10)}...${verify.slice(-4)})`)
    } else {
      log(`storeApiKey: WARNING - read-back verification failed!`)
    }
  } catch (err: any) {
    log(`storeApiKey: ERROR - ${err.message}`)
    throw err
  }
}

function loadApiKey(): string | null {
  const keyPath = getApiKeyPath()
  if (!fs.existsSync(keyPath)) return null

  const logFile = path.join(app.getPath('userData'), 'brain-debug.log')
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] [ApiKey] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log('[ApiKey]', msg)
  }

  try {
    const raw = fs.readFileSync(keyPath, 'utf8')

    // New JSON envelope format
    if (raw.startsWith('{')) {
      const envelope = JSON.parse(raw)
      log(`loadApiKey: format=${envelope.format}, storedAt=${envelope.storedAt}`)

      if (envelope.format === 'dpapi') {
        const encrypted = Buffer.from(envelope.data, 'base64')
        const key = safeStorage.decryptString(encrypted)
        log(`loadApiKey: decrypted OK (${key.slice(0, 10)}...${key.slice(-4)})`)
        return key
      } else if (envelope.format === 'base64') {
        const key = Buffer.from(envelope.data, 'base64').toString('utf8')
        log(`loadApiKey: decoded OK (${key.slice(0, 10)}...${key.slice(-4)})`)
        return key
      }
    }

    // Legacy: try old encrypted binary format (from previous version)
    log('loadApiKey: attempting legacy format...')
    const data = fs.readFileSync(keyPath)
    if (safeStorage.isEncryptionAvailable()) {
      const key = safeStorage.decryptString(data)
      log(`loadApiKey: legacy decrypt OK (${key.slice(0, 10)}...${key.slice(-4)})`)
      return key
    }

    return null
  } catch (err: any) {
    log(`loadApiKey: ERROR - ${err.message}`)
    return null
  }
}

function deleteApiKey(): void {
  const keyPath = getApiKeyPath()
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath)
    console.log('[ApiKey] Deleted:', keyPath)
  }
  // Also clean up old format file
  const oldPath = path.join(app.getPath('userData'), 'anthropic-api-key.enc')
  if (fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath)
    console.log('[ApiKey] Deleted legacy:', oldPath)
  }
}

// Bundled Brain server child process
let brainProcess: ChildProcess | null = null

function startBrainServer(apiKey?: string): void {
  const logFile = path.join(app.getPath('userData'), 'brain-debug.log')
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log('[Brain]', msg)
  }

  log(`isPackaged=${app.isPackaged} resourcesPath=${process.resourcesPath}`)

  // In dev mode, Brain runs separately — skip
  if (!app.isPackaged) {
    log('Dev mode — Brain runs independently on :3001')
    return
  }

  const brainDir = path.join(process.resourcesPath, 'brain')
  const brainEntry = path.join(brainDir, 'dist', 'api', 'server.js')

  log(`brainDir=${brainDir}`)
  log(`brainEntry=${brainEntry}`)
  log(`exists=${fs.existsSync(brainEntry)}`)

  if (!fs.existsSync(brainEntry)) {
    log('Brain server not found at: ' + brainEntry)
    return
  }

  // Resolve API key: parameter > stored > env (blank)
  const resolvedKey = apiKey || loadApiKey() || ''
  log(`Starting bundled Brain server... (API key ${resolvedKey ? 'provided' : 'NOT set'})`)

  try {
    brainProcess = fork(brainEntry, [], {
      cwd: brainDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        CHROMADON_PORT: '3001',
        CHROMADON_DESKTOP_URL: 'http://127.0.0.1:3002',
        PREFER_DESKTOP: 'true',
        NODE_ENV: 'production',
        ...(resolvedKey ? { ANTHROPIC_API_KEY: resolvedKey } : {}),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    log(`fork() succeeded, pid=${brainProcess.pid}`)
  } catch (err: any) {
    log(`fork() FAILED: ${err.message}`)
    return
  }

  brainProcess.stdout?.on('data', (data: Buffer) => {
    log(data.toString().trim())
  })

  brainProcess.stderr?.on('data', (data: Buffer) => {
    log(`STDERR: ${data.toString().trim()}`)
  })

  brainProcess.on('error', (err) => {
    log(`Process error: ${err.message}`)
  })

  brainProcess.on('exit', (code, signal) => {
    log(`Exited: code=${code} signal=${signal}`)
    brainProcess = null
    // Auto-restart on crash (not on clean shutdown)
    if (code !== 0 && code !== null) {
      log('Restarting in 3s...')
      setTimeout(startBrainServer, 3000)
    }
  })
}

function restartBrainServer(apiKey?: string): void {
  console.log('[Desktop] Restarting Brain server with updated API key...')
  if (brainProcess) {
    brainProcess.removeAllListeners('exit')
    brainProcess.on('exit', () => {
      brainProcess = null
      startBrainServer(apiKey)
    })
    brainProcess.kill('SIGTERM')
    // Force kill after 5 seconds if it doesn't exit gracefully
    const forceKillTimer = setTimeout(() => {
      if (brainProcess) {
        brainProcess.kill('SIGKILL')
        brainProcess = null
        startBrainServer(apiKey)
      }
    }, 5000)
    brainProcess.on('exit', () => clearTimeout(forceKillTimer))
  } else {
    startBrainServer(apiKey)
  }
}

// CRITICAL: Anti-detection measures for Google sign-in
// Set app to look like Chrome
app.setName('Google Chrome')

// Override user agent at the app level
app.userAgentFallback = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Disable automation detection
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process,UserAgentClientHint')
app.commandLine.appendSwitch('enable-features', 'NetworkService,NetworkServiceInProcess')
app.commandLine.appendSwitch('no-first-run')
app.commandLine.appendSwitch('no-default-browser-check')
app.commandLine.appendSwitch('disable-infobars')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch('disable-client-side-phishing-detection')
app.commandLine.appendSwitch('disable-default-apps')
app.commandLine.appendSwitch('disable-extensions')
app.commandLine.appendSwitch('disable-hang-monitor')
app.commandLine.appendSwitch('disable-popup-blocking')
app.commandLine.appendSwitch('disable-prompt-on-repost')
app.commandLine.appendSwitch('disable-sync')
app.commandLine.appendSwitch('disable-translate')
app.commandLine.appendSwitch('metrics-recording-only')
app.commandLine.appendSwitch('safebrowsing-disable-auto-update')

// Marketing task queue types
export interface MarketingTask {
  id: string
  platform: Platform
  action: 'post' | 'comment' | 'like' | 'follow' | 'dm' | 'search' | 'scrape' | 'custom'
  content?: string
  targetUrl?: string
  priority: number
  status: 'queued' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  tabId?: number
}

// Marketing queue state
let marketingQueue: MarketingTask[] = []
let activeTasksByPlatform: Map<Platform, MarketingTask> = new Map()

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
  // - Right sidebar: 384px (w-96) + 24px padding
  // - No bottom CommandInput (chat is in sidebar now)
  const bounds = {
    x: 8, // Left margin (m-2 in React)
    y: 138, // TitleBar(40) + TabStrip(40) + NavBar(50) + margin(8)
    width: width - 408, // Full width - sidebar(384) - left margin(8) - right padding(16)
    height: height - 154, // Full height - top(138) - margin(16)
  }

  browserViewManager.setViewBounds(bounds)
}

// ==================== CLAUDE CODE CONTROL SERVER ====================

function startControlServer() {
  const server = express()
  server.use(express.json())

  // Initialize screenshot storage (non-blocking)
  storageManager.initialize().catch(err => {
    console.log(`[StorageManager] Init warning: ${err.message}`)
  })

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

  // ==================== DIRECT VAULT ENDPOINTS ====================

  // Direct vault unlock (bypasses UI, calls vault directly)
  server.post('/vault/unlock', async (req: Request, res: Response) => {
    try {
      const { password } = req.body
      if (!password) {
        res.status(400).json({ success: false, error: 'Password is required' })
        return
      }

      const result = await vault.unlock(password)
      if (result.success && mainWindow) {
        // Send event to renderer to update UI state
        mainWindow.webContents.send('vault:unlocked')
      }
      res.json(result)
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Direct vault status
  server.get('/vault/status', async (_req: Request, res: Response) => {
    try {
      const status = await vault.getStatus()
      res.json({ success: true, ...status })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Direct vault lock
  server.post('/vault/lock', async (_req: Request, res: Response) => {
    try {
      vault.lock()
      if (mainWindow) {
        mainWindow.webContents.send('vault:locked')
      }
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
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
      if (id === undefined || !script || typeof script !== 'string') {
        res.status(400).json({ success: false, error: 'id and script (string) are required' })
        return
      }
      if (script.length > 100000) {
        res.status(400).json({ success: false, error: 'Script exceeds maximum length (100KB)' })
        return
      }
      // Block access to Node.js internals that could escape sandbox
      const dangerousPatterns = [
        /require\s*\(/i,
        /process\.(env|exit|kill|binding)/i,
        /child_process/i,
        /__dirname|__filename/i,
        /global\.process/i,
      ]
      for (const pattern of dangerousPatterns) {
        if (pattern.test(script)) {
          res.status(400).json({ success: false, error: 'Script contains restricted patterns' })
          return
        }
      }
      const result = await browserViewManager.executeScript(id, script)
      res.json({ success: true, result })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Type text into focused element using Electron's insertText API
  // Works with contenteditable (LinkedIn, Twitter), inputs, textareas, Shadow DOM, etc.
  server.post('/tabs/type', async (req: Request, res: Response) => {
    try {
      const { id, selector, text, clearFirst } = req.body
      if (id === undefined || !text) {
        res.status(400).json({ success: false, error: 'id and text are required' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      // Step 1: Focus the target element
      const focusResult = await view.webContents.executeJavaScript(`
        (function() {
          var el = ${selector ? `document.querySelector('${selector.replace(/'/g, "\\'")}')` : 'null'};
          if (el) {
            el.scrollIntoView({block: 'center'});
            el.focus();
            el.click();
            return 'focused:' + el.tagName;
          }
          // Fallback: find contenteditable elements
          var editables = document.querySelectorAll('[contenteditable="true"]');
          if (editables.length > 0) {
            var target = editables[editables.length - 1];
            target.scrollIntoView({block: 'center'});
            target.focus();
            target.click();
            return 'focused:contenteditable';
          }
          return 'not_found';
        })()
      `)

      if (focusResult === 'not_found') {
        res.json({ success: false, error: `Element not found: ${selector}` })
        return
      }

      // Step 2: Wait for focus to settle
      await new Promise(r => setTimeout(r, 200))

      // Step 3: Clear existing text if requested
      if (clearFirst !== false) {
        const isStandardInput = await view.webContents.executeJavaScript(`
          (function() {
            var el = document.activeElement;
            return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
          })()
        `)

        if (isStandardInput) {
          // Standard inputs: set value + dispatch event
          await view.webContents.executeJavaScript(`
            (function() {
              var el = document.activeElement;
              el.value = '';
              el.dispatchEvent(new Event('input', {bubbles: true}));
            })()
          `)
        } else {
          // Contenteditable (Twitter, LinkedIn, etc.): use native Select All + Delete
          // Generates real InputEvents that React/Draft.js/ProseMirror respond to
          view.webContents.selectAll()
          await new Promise(r => setTimeout(r, 50))
          view.webContents.delete()
        }
        await new Promise(r => setTimeout(r, 100))
      }

      // Step 4: Use Electron's insertText - works like a real keyboard
      await view.webContents.insertText(text)

      console.log(`[CHROMADON] Typed ${text.length} chars via insertText into ${focusResult}`)
      res.json({ success: true, result: `Typed ${text.length} chars into ${focusResult}` })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Click element with 6-strategy fallback (social media optimized)
  server.post('/tabs/click', async (req: Request, res: Response) => {
    try {
      const { id, selector, text } = req.body
      if (id === undefined || (!selector && !text)) {
        res.status(400).json({ success: false, error: 'id and (selector or text) are required' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      // The target is the selector or text to match
      const target = selector || text

      const result = await view.webContents.executeJavaScript(`
        (function() {
          var target = ${JSON.stringify(target)};

          // Real click helper: fires full mouse event sequence (works with React/Twitter)
          function realClick(el) {
            el.scrollIntoView({block:'center'});
            var rect = el.getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var opts = {bubbles: true, cancelable: true, view: window, clientX: x, clientY: y};
            el.dispatchEvent(new MouseEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
          }

          // Strategy 1: Direct CSS selector
          try {
            var el = document.querySelector(target);
            if (el) { realClick(el); return { found: true, strategy: 'css', detail: el.tagName + ':' + (el.textContent || '').trim().slice(0, 50) }; }
          } catch(e) { /* selector might not be valid CSS, continue */ }

          // Strategy 2: role="button" with matching text
          var roleBtns = document.querySelectorAll('[role="button"]');
          for (var i = 0; i < roleBtns.length; i++) {
            var btnText = (roleBtns[i].textContent || '').trim();
            var btnInner = (roleBtns[i].innerText || '').trim();
            if (btnText === target || btnInner === target) {
              realClick(roleBtns[i]);
              return { found: true, strategy: 'role_text', detail: btnText.slice(0, 50) };
            }
          }

          // Strategy 3: aria-label match (case-insensitive)
          var ariaEls = document.querySelectorAll('[aria-label]');
          for (var j = 0; j < ariaEls.length; j++) {
            if (ariaEls[j].getAttribute('aria-label').toLowerCase() === target.toLowerCase()) {
              realClick(ariaEls[j]);
              return { found: true, strategy: 'aria', detail: ariaEls[j].getAttribute('aria-label') };
            }
          }

          // Strategy 4: data-testid (Twitter/X uses these)
          var testIdMap = {
            'Post': '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
            'Reply': '[data-testid="tweetReplyButton"]',
            'Tweet': '[data-testid="tweetButton"]'
          };
          if (testIdMap[target]) {
            el = document.querySelector(testIdMap[target]);
            if (el) { realClick(el); return { found: true, strategy: 'testid', detail: target }; }
          }

          // Strategy 5: Button/submit with matching text
          var allBtns = document.querySelectorAll('button, [type="submit"]');
          for (var k = 0; k < allBtns.length; k++) {
            if ((allBtns[k].textContent || '').trim() === target) {
              realClick(allBtns[k]);
              return { found: true, strategy: 'button_text', detail: allBtns[k].tagName + ':' + target };
            }
          }

          // Strategy 6: Deepest text node walk — find exact text, walk up to clickable ancestor
          var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if ((walker.currentNode.textContent || '').trim() === target) {
              var clickTarget = walker.currentNode.parentElement;
              while (clickTarget && !clickTarget.onclick &&
                     clickTarget.getAttribute && clickTarget.getAttribute('role') !== 'button' &&
                     clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A') {
                clickTarget = clickTarget.parentElement;
              }
              if (clickTarget && clickTarget !== document.body) {
                realClick(clickTarget);
                return { found: true, strategy: 'text_walk', detail: clickTarget.tagName + ':' + target };
              }
            }
          }

          // Strategy 7: Partial text match on buttons/role=button (fallback)
          var searchLower = target.toLowerCase();
          var partialCandidates = document.querySelectorAll('button, [role="button"], a, input[type="submit"], [tabindex]');
          for (var m = 0; m < partialCandidates.length; m++) {
            if (partialCandidates[m].textContent && partialCandidates[m].textContent.trim().toLowerCase().includes(searchLower)) {
              realClick(partialCandidates[m]);
              return { found: true, strategy: 'partial_text', detail: partialCandidates[m].textContent.trim().slice(0, 50) };
            }
          }

          return { found: false, strategy: 'none' };
        })()
      `)

      if (!result.found) {
        res.status(404).json({ success: false, error: `Element not found: ${target}`, strategies_tried: 7 })
        return
      }

      console.log(`[CHROMADON] Click: "${target}" → ${result.strategy} (${result.detail})`)
      res.json({ success: true, result: `clicked_${result.strategy}:${result.detail}`, strategy: result.strategy })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Upload file to a file input on the page using CDP DOM.setFileInputFiles
  server.post('/tabs/upload', async (req: Request, res: Response) => {
    try {
      const { id, selector, filePath } = req.body
      if (id === undefined || !filePath) {
        res.status(400).json({ success: false, error: 'id and filePath are required' })
        return
      }

      // Validate file exists
      if (!fs.existsSync(filePath)) {
        res.status(400).json({ success: false, error: `File not found: ${filePath}` })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      // If a selector is provided that's not a file input, click it first to reveal the file input
      if (selector && !selector.includes('type="file"') && !selector.includes("type='file'")) {
        await view.webContents.executeJavaScript(`
          (function() {
            var el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (el) { el.click(); return 'clicked'; }
            return 'not_found';
          })()
        `)
        // Wait for file input to appear
        await new Promise(r => setTimeout(r, 500))
      }

      // Attach CDP debugger to the webContents
      try {
        view.webContents.debugger.attach('1.3')
      } catch (e) {
        // Already attached, that's fine
      }

      // Find the file input element
      const fileInputSelector = selector && (selector.includes('type="file"') || selector.includes("type='file'"))
        ? selector
        : 'input[type="file"]'

      const { root } = await view.webContents.debugger.sendCommand('DOM.getDocument', {})
      const { nodeId } = await view.webContents.debugger.sendCommand('DOM.querySelector', {
        nodeId: root.nodeId,
        selector: fileInputSelector,
      })

      if (!nodeId) {
        view.webContents.debugger.detach()
        res.json({ success: false, error: `No file input found with selector: ${fileInputSelector}` })
        return
      }

      // Set the file on the input
      await view.webContents.debugger.sendCommand('DOM.setFileInputFiles', {
        nodeId,
        files: [filePath],
      })

      view.webContents.debugger.detach()

      const fileName = path.basename(filePath)
      console.log(`[CHROMADON] Uploaded file: ${fileName} to tab ${id}`)
      res.json({ success: true, result: `Uploaded ${fileName} to file input` })
    } catch (error) {
      try { browserViewManager.getView(req.body.id)?.webContents.debugger.detach() } catch (e) {}
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Hide/show BrowserViews (for modal overlays or external control)
  server.post('/views/visible', (req: Request, res: Response) => {
    const { visible } = req.body
    browserViewManager.setViewsVisible(visible !== false)
    res.json({ success: true, visible: visible !== false })
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

  // Native click endpoint - sends real mouse events that bypass bot detection
  server.post('/tabs/click/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const { x, y } = req.body
      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: 'Tab not found' })
        return
      }
      // Send native mouse events
      view.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
      view.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
      console.log(`[CHROMADON] Native click at (${x}, ${y}) on tab ${id}`)
      res.json({ success: true, x, y })
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) })
    }
  })

  // Native keyboard input endpoint
  server.post('/tabs/type/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const { text } = req.body
      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: 'Tab not found' })
        return
      }
      // Type each character
      for (const char of text) {
        view.webContents.sendInputEvent({ type: 'char', keyCode: char })
      }
      console.log(`[CHROMADON] Typed "${text}" on tab ${id}`)
      res.json({ success: true, text })
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) })
    }
  })

  // Native key press endpoint
  server.post('/tabs/key/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const { key } = req.body
      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: 'Tab not found' })
        return
      }
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key })
      view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key })
      console.log(`[CHROMADON] Key press "${key}" on tab ${id}`)
      res.json({ success: true, key })
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) })
    }
  })

  // Native scroll endpoint
  server.post('/tabs/scroll/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const { deltaX, deltaY } = req.body
      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: 'Tab not found' })
        return
      }
      // Execute scroll via JavaScript
      await view.webContents.executeJavaScript(`window.scrollBy(${deltaX || 0}, ${deltaY || 0})`)
      console.log(`[CHROMADON] Scroll by (${deltaX}, ${deltaY}) on tab ${id}`)
      res.json({ success: true, deltaX, deltaY })
    } catch (error) {
      res.status(500).json({ success: false, error: String(error) })
    }
  })

  // ==================== PLATFORM SESSION ENDPOINTS ====================

  // Get all platform sessions
  server.get('/sessions', (_req: Request, res: Response) => {
    res.json({
      success: true,
      sessions: browserViewManager.getPlatformSessions(),
    })
  })

  // Get specific platform session
  server.get('/sessions/:platform', (req: Request, res: Response) => {
    const platform = req.params.platform as Platform
    const session = browserViewManager.getPlatformSession(platform)
    res.json({ success: true, session })
  })

  // Verify platform authentication
  server.post('/sessions/:platform/verify', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform
      const isAuthenticated = await browserViewManager.verifyPlatformAuth(platform)
      res.json({ success: true, platform, isAuthenticated })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Update platform session
  server.post('/sessions/:platform', (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform
      const updates = req.body
      browserViewManager.updatePlatformSession(platform, updates)
      res.json({ success: true, session: browserViewManager.getPlatformSession(platform) })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Create platform-specific tab (uses shared session)
  server.post('/tabs/platform', (req: Request, res: Response) => {
    try {
      const { url, platform } = req.body
      if (!platform) {
        res.status(400).json({ success: false, error: 'Platform is required' })
        return
      }
      const id = browserViewManager.createPlatformView(url || 'about:blank', platform)
      res.json({ success: true, id, platform, tabs: browserViewManager.getTabs() })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // ==================== GOOGLE AUTH ENDPOINTS ====================

  // Import Google cookies from user's Chrome browser
  server.post('/auth/import-chrome-cookies', async (_req: Request, res: Response) => {
    try {
      console.log('[CHROMADON] Importing Google cookies from Chrome...')

      const path = require('path')
      const fs = require('fs')
      const { session } = require('electron')

      // Chrome cookies database path
      const chromeCookiesPath = path.join(
        require('os').homedir(),
        'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Network', 'Cookies'
      )

      if (!fs.existsSync(chromeCookiesPath)) {
        res.json({ success: false, error: 'Chrome cookies database not found. Make sure Chrome is installed.' })
        return
      }

      // Copy the database to temp location (Chrome locks it while running)
      const tempCookiesPath = path.join(require('os').tmpdir(), `chrome-cookies-${Date.now()}.db`)
      fs.copyFileSync(chromeCookiesPath, tempCookiesPath)

      // Read cookies using sql.js (pure JavaScript SQLite)
      const initSqlJs = require('sql.js')
      const SQL = await initSqlJs()
      const fileBuffer = fs.readFileSync(tempCookiesPath)
      const db = new SQL.Database(fileBuffer)

      // Get Google-related cookies
      const result = db.exec(`
        SELECT host_key, name, value, path, expires_utc, is_secure, is_httponly
        FROM cookies
        WHERE host_key LIKE '%google%' OR host_key LIKE '%youtube%' OR host_key LIKE '%gstatic%'
      `)

      const cookies = result.length > 0 ? result[0].values.map((row: any[]) => ({
        host_key: row[0],
        name: row[1],
        value: row[2],
        path: row[3],
        expires_utc: row[4],
        is_secure: row[5],
        is_httponly: row[6],
      })) : []

      db.close()

      console.log(`[CHROMADON] Found ${cookies.length} Google-related cookies`)

      // Import cookies into Electron's Google session
      const googleSession = session.fromPartition('persist:platform-google')
      let importedCount = 0
      let skippedCount = 0

      for (const cookie of cookies) {
        try {
          // Skip cookies without values (likely encrypted)
          if (!cookie.value) {
            skippedCount++
            continue
          }

          const domain = cookie.host_key.startsWith('.') ? cookie.host_key : cookie.host_key
          const url = `https://${domain.replace(/^\./, '')}`

          await googleSession.cookies.set({
            url,
            name: cookie.name,
            value: cookie.value || '',
            domain: domain,
            path: cookie.path || '/',
            secure: Boolean(cookie.is_secure),
            httpOnly: Boolean(cookie.is_httponly),
            expirationDate: cookie.expires_utc > 0 ? Math.floor(cookie.expires_utc / 1000000 - 11644473600) : undefined,
          })
          importedCount++
        } catch (e) {
          // Ignore individual cookie errors
          skippedCount++
        }
      }

      // Clean up temp file
      fs.unlinkSync(tempCookiesPath)

      console.log(`[CHROMADON] Imported ${importedCount} cookies, skipped ${skippedCount} (encrypted)`)

      res.json({
        success: true,
        message: `Imported ${importedCount} cookies from Chrome. ${skippedCount} encrypted cookies were skipped.`,
        imported: importedCount,
        skipped: skippedCount,
        note: 'Note: Chrome encrypts most cookies on Windows. You may need to use the browser-based sign-in.'
      })
    } catch (error) {
      console.error('[CHROMADON] Cookie import error:', error)
      res.json({ success: false, error: String(error) })
    }
  })

  // Open system browser for Google sign-in (manual but reliable)
  server.post('/auth/google-browser', async (_req: Request, res: Response) => {
    try {
      const { shell } = require('electron')
      await shell.openExternal('https://accounts.google.com')
      res.json({
        success: true,
        message: 'Opened Google sign-in in your system browser. Sign in there, then return to CHROMADON.'
      })
    } catch (error) {
      res.json({ success: false, error: String(error) })
    }
  })

  // Launch Chrome with debugging and extract cookies after sign-in
  server.post('/auth/google-debug-chrome', async (req: Request, res: Response) => {
    try {
      console.log('[CHROMADON] Launching Chrome for Google sign-in...')

      const path = require('path')
      const puppeteer = require('puppeteer-core')
      const { session } = require('electron')

      // Find Chrome executable
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(require('os').homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]

      let chromePath = ''
      for (const p of chromePaths) {
        if (require('fs').existsSync(p)) {
          chromePath = p
          break
        }
      }

      if (!chromePath) {
        res.json({ success: false, error: 'Chrome not found' })
        return
      }

      console.log('[CHROMADON] Found Chrome at:', chromePath)

      // Create temp user data dir
      const tempUserDataDir = path.join(require('os').tmpdir(), `chrome-debug-${Date.now()}`)
      require('fs').mkdirSync(tempUserDataDir, { recursive: true })

      // Launch Chrome directly via puppeteer-core
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: tempUserDataDir,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      const pages = await browser.pages()
      const page = pages[0] || await browser.newPage()

      // Navigate to Google sign-in
      await page.goto('https://accounts.google.com')

      // Wait for user to sign in (check every 2 seconds for 5 minutes)
      console.log('[CHROMADON] Navigated to Google. Please sign in...')

      let signedIn = false
      for (let i = 0; i < 150; i++) { // 5 minutes max
        await new Promise(r => setTimeout(r, 2000))

        const currentUrl = page.url()
        if (currentUrl.includes('myaccount.google.com') ||
            (currentUrl.includes('google.com') && !currentUrl.includes('signin') && !currentUrl.includes('accounts.google.com'))) {
          signedIn = true
          break
        }
      }

      if (!signedIn) {
        await browser.close()
        res.json({ success: false, error: 'Sign-in timed out after 5 minutes' })
        return
      }

      // Get cookies
      const cookies = await page.cookies()
      console.log(`[CHROMADON] Got ${cookies.length} cookies from Chrome`)

      // Import to Electron session
      const googleSession = session.fromPartition('persist:platform-google')
      let importedCount = 0

      for (const cookie of cookies) {
        try {
          await googleSession.cookies.set({
            url: `https://${cookie.domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires,
          })
          importedCount++
        } catch (e) {
          // Ignore errors
        }
      }

      await browser.close()

      // Clean up temp directory
      try {
        require('fs').rmSync(tempUserDataDir, { recursive: true, force: true })
      } catch (e) {
        // Ignore cleanup errors
      }

      res.json({
        success: true,
        message: `Sign-in successful! Imported ${importedCount} cookies.`,
        imported: importedCount
      })
    } catch (error) {
      console.error('[CHROMADON] Debug Chrome error:', error)
      res.json({ success: false, error: String(error) })
    }
  })

  // ==================== LINKEDIN AUTH ENDPOINT ====================

  // Launch Chrome for LinkedIn sign-in
  server.post('/auth/linkedin-browser', async (_req: Request, res: Response) => {
    try {
      console.log('[CHROMADON] Launching Chrome for LinkedIn sign-in...')

      const path = require('path')
      const puppeteer = require('puppeteer-core')

      // Find Chrome executable
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(require('os').homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]

      let chromePath = ''
      for (const p of chromePaths) {
        if (require('fs').existsSync(p)) {
          chromePath = p
          break
        }
      }

      if (!chromePath) {
        res.json({ success: false, error: 'Chrome not found. Please install Google Chrome.' })
        return
      }

      console.log('[CHROMADON] Found Chrome at:', chromePath)

      // Create temp user data dir
      const tempUserDataDir = path.join(require('os').tmpdir(), `chrome-linkedin-${Date.now()}`)
      require('fs').mkdirSync(tempUserDataDir, { recursive: true })

      // Launch Chrome
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: tempUserDataDir,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      const pages = await browser.pages()
      const page = pages[0] || await browser.newPage()

      // Navigate to LinkedIn login
      await page.goto('https://www.linkedin.com/login')

      console.log('[CHROMADON] Navigated to LinkedIn. Please sign in...')

      // Wait for user to sign in (check every 2 seconds for 5 minutes)
      let signedIn = false
      for (let i = 0; i < 150; i++) {
        await new Promise(r => setTimeout(r, 2000))

        try {
          const currentUrl = page.url()
          // User is signed in when redirected to feed or other authenticated page
          if (currentUrl.includes('linkedin.com/feed') ||
              currentUrl.includes('linkedin.com/in/') ||
              currentUrl.includes('linkedin.com/mynetwork') ||
              currentUrl.includes('linkedin.com/messaging')) {
            signedIn = true
            break
          }
        } catch (e) {
          // Browser was closed
          console.log('[CHROMADON] Browser closed by user')
          break
        }
      }

      if (!signedIn) {
        await browser.close()
        res.json({ success: false, error: 'Sign-in timed out or cancelled after 5 minutes' })
        return
      }

      // Get cookies
      const cookies = await page.cookies()
      console.log(`[CHROMADON] Got ${cookies.length} cookies from LinkedIn`)

      // Import to Electron session
      const linkedinSession = session.fromPartition('persist:platform-linkedin')
      let importedCount = 0

      for (const cookie of cookies) {
        try {
          await linkedinSession.cookies.set({
            url: `https://${cookie.domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires,
          })
          importedCount++
        } catch (e) {
          // Ignore cookie errors
        }
      }

      console.log(`[CHROMADON] Imported ${importedCount} LinkedIn cookies`)

      // Update platform session
      browserViewManager.updatePlatformSession('linkedin', {
        isAuthenticated: true,
        lastVerified: Date.now(),
      })

      await browser.close()

      res.json({
        success: true,
        platform: 'linkedin',
        message: 'LinkedIn sign-in successful',
        cookiesImported: importedCount
      })
    } catch (error) {
      console.error('[CHROMADON] LinkedIn Chrome error:', error)
      res.json({ success: false, error: String(error) })
    }
  })

  // ==================== TWITTER AUTH ENDPOINT ====================

  // Launch Chrome for Twitter sign-in
  server.post('/auth/twitter-browser', async (_req: Request, res: Response) => {
    try {
      console.log('[CHROMADON] Launching Chrome for Twitter sign-in...')

      const path = require('path')
      const puppeteer = require('puppeteer-core')

      // Find Chrome executable
      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(require('os').homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]

      let chromePath = ''
      for (const p of chromePaths) {
        if (require('fs').existsSync(p)) {
          chromePath = p
          break
        }
      }

      if (!chromePath) {
        res.json({ success: false, error: 'Chrome not found. Please install Google Chrome.' })
        return
      }

      console.log('[CHROMADON] Found Chrome at:', chromePath)

      // Create temp user data dir
      const tempUserDataDir = path.join(require('os').tmpdir(), `chrome-twitter-${Date.now()}`)
      require('fs').mkdirSync(tempUserDataDir, { recursive: true })

      // Launch Chrome
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        userDataDir: tempUserDataDir,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      const pages = await browser.pages()
      const page = pages[0] || await browser.newPage()

      // Navigate to Twitter login
      await page.goto('https://twitter.com/login')

      console.log('[CHROMADON] Navigated to Twitter. Please sign in...')

      // Wait for user to sign in (check every 2 seconds for 5 minutes)
      let signedIn = false
      for (let i = 0; i < 150; i++) {
        await new Promise(r => setTimeout(r, 2000))

        try {
          const currentUrl = page.url()
          // User is signed in when redirected to home or other authenticated page
          if (currentUrl.includes('twitter.com/home') ||
              currentUrl.includes('x.com/home') ||
              currentUrl.includes('twitter.com/i/') ||
              currentUrl.includes('x.com/i/') ||
              (currentUrl.match(/twitter\.com\/[a-zA-Z0-9_]+$/) && !currentUrl.includes('login')) ||
              (currentUrl.match(/x\.com\/[a-zA-Z0-9_]+$/) && !currentUrl.includes('login'))) {
            signedIn = true
            break
          }
        } catch (e) {
          // Browser was closed
          console.log('[CHROMADON] Browser closed by user')
          break
        }
      }

      if (!signedIn) {
        await browser.close()
        res.json({ success: false, error: 'Sign-in timed out or cancelled after 5 minutes' })
        return
      }

      // Get cookies
      const cookies = await page.cookies()
      console.log(`[CHROMADON] Got ${cookies.length} cookies from Twitter`)

      // Import to Electron session
      const twitterSession = session.fromPartition('persist:platform-twitter')
      let importedCount = 0

      for (const cookie of cookies) {
        try {
          await twitterSession.cookies.set({
            url: `https://${cookie.domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires,
          })
          importedCount++
        } catch (e) {
          // Ignore cookie errors
        }
      }

      console.log(`[CHROMADON] Imported ${importedCount} Twitter cookies`)

      // Update platform session
      browserViewManager.updatePlatformSession('twitter', {
        isAuthenticated: true,
        lastVerified: Date.now(),
      })

      await browser.close()

      res.json({
        success: true,
        platform: 'twitter',
        message: 'Twitter sign-in successful',
        cookiesImported: importedCount
      })
    } catch (error) {
      console.error('[CHROMADON] Twitter Chrome error:', error)
      res.json({ success: false, error: String(error) })
    }
  })

  // Automated Google sign-in using Puppeteer with stealth (may be blocked by Google)
  server.post('/auth/google', async (req: Request, res: Response) => {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password required' })
      return
    }

    try {
      console.log('[CHROMADON] Starting Puppeteer Google sign-in...')

      // Dynamic import of puppeteer-extra and stealth plugin
      const puppeteer = require('puppeteer-extra')
      const StealthPlugin = require('puppeteer-extra-plugin-stealth')
      puppeteer.use(StealthPlugin())

      // Create a temporary profile directory to avoid conflicts with running Chrome
      const tempProfileDir = require('path').join(require('os').tmpdir(), `chrome-puppeteer-${Date.now()}`)
      const browser = await puppeteer.launch({
        headless: false,
        channel: 'chrome', // Use installed Chrome instead of bundled Chromium
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          `--user-data-dir=${tempProfileDir}`,
          '--disable-extensions',
          '--disable-default-apps',
          '--no-first-run',
          '--start-maximized',
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      const page = await browser.newPage()

      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 720 })
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

      // Navigate to Google sign-in
      await page.goto('https://accounts.google.com', { waitUntil: 'networkidle2' })

      console.log('[CHROMADON] Typing email...')
      // Type email with human-like delay
      await page.waitForSelector('input[type="email"]', { visible: true })
      await page.type('input[type="email"]', email, { delay: 100 })

      // Small delay before clicking
      await new Promise(r => setTimeout(r, 1000))

      // Click Next
      await page.click('#identifierNext')

      // Wait longer for navigation
      await new Promise(r => setTimeout(r, 5000))

      // Wait for password field with multiple attempts
      console.log('[CHROMADON] Waiting for password field...')
      let passwordFound = false
      for (let i = 0; i < 3; i++) {
        try {
          await page.waitForSelector('input[type="password"]', { visible: true, timeout: 5000 })
          passwordFound = true
          break
        } catch {
          console.log(`[CHROMADON] Password field attempt ${i + 1} failed, checking for other elements...`)
          // Check if there's a CAPTCHA or verification
          const pageContent = await page.content()
          if (pageContent.includes('captcha') || pageContent.includes('verify')) {
            console.log('[CHROMADON] CAPTCHA or verification detected!')
          }
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      if (!passwordFound) {
        // Take screenshot for debugging
        const screenshotPath = require('path').join(require('electron').app.getPath('userData'), 'google-signin-debug.png')
        await page.screenshot({ path: screenshotPath })
        console.log(`[CHROMADON] Debug screenshot saved to: ${screenshotPath}`)
        throw new Error('Password field not found - Google may be blocking. Check debug screenshot.')
      }

      console.log('[CHROMADON] Typing password...')
      // Type password
      await page.type('input[type="password"]', password, { delay: 50 })

      // Click Next
      await page.click('#passwordNext')

      // Wait for sign-in to complete
      console.log('[CHROMADON] Waiting for sign-in to complete...')
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})

      // Check if we're signed in by looking at the URL
      const currentUrl = page.url()
      const isSignedIn = currentUrl.includes('myaccount.google.com') ||
                         currentUrl.includes('google.com') && !currentUrl.includes('signin')

      // Get cookies to transfer to Electron session
      const cookies = await page.cookies()

      console.log(`[CHROMADON] Sign-in ${isSignedIn ? 'successful' : 'may have failed'}. Got ${cookies.length} cookies.`)

      // Transfer cookies to Electron's Google session
      const { session } = require('electron')
      const googleSession = session.fromPartition('persist:platform-google')

      for (const cookie of cookies) {
        try {
          await googleSession.cookies.set({
            url: `https://${cookie.domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expires,
          })
        } catch (e) {
          // Ignore cookie errors
        }
      }

      await browser.close()

      res.json({
        success: isSignedIn,
        message: isSignedIn ? 'Signed in successfully' : 'Sign-in may require additional verification',
        cookiesTransferred: cookies.length
      })
    } catch (error) {
      console.error('[CHROMADON] Puppeteer sign-in error:', error)
      res.status(500).json({ success: false, error: String(error) })
    }
  })

  // ==================== MARKETING QUEUE ENDPOINTS ====================

  // Get queue status
  server.get('/queue', (_req: Request, res: Response) => {
    const activeTasks: Record<string, MarketingTask> = {}
    activeTasksByPlatform.forEach((task, platform) => {
      activeTasks[platform] = task
    })
    res.json({
      success: true,
      queue: marketingQueue,
      activeTasks,
      stats: {
        total: marketingQueue.length,
        queued: marketingQueue.filter(t => t.status === 'queued').length,
        running: marketingQueue.filter(t => t.status === 'running').length,
        completed: marketingQueue.filter(t => t.status === 'completed').length,
        failed: marketingQueue.filter(t => t.status === 'failed').length,
      },
    })
  })

  // Add task to queue
  server.post('/queue/add', (req: Request, res: Response) => {
    try {
      const { platform, action, content, targetUrl, priority = 0 } = req.body
      if (!platform || !action) {
        res.status(400).json({ success: false, error: 'Platform and action are required' })
        return
      }

      const task: MarketingTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        platform,
        action,
        content,
        targetUrl,
        priority,
        status: 'queued',
        createdAt: Date.now(),
      }

      marketingQueue.push(task)
      // Sort by priority (higher first)
      marketingQueue.sort((a, b) => b.priority - a.priority)

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
      }

      res.json({ success: true, task })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Process next available task for a platform
  server.post('/queue/process/:platform', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform

      // Check if platform already has active task
      if (activeTasksByPlatform.has(platform)) {
        res.status(409).json({
          success: false,
          error: `Platform ${platform} already has an active task`,
          activeTask: activeTasksByPlatform.get(platform),
        })
        return
      }

      // Find next queued task for this platform
      const taskIndex = marketingQueue.findIndex(
        t => t.platform === platform && t.status === 'queued'
      )

      if (taskIndex === -1) {
        res.json({ success: true, message: 'No queued tasks for this platform', task: null })
        return
      }

      const task = marketingQueue[taskIndex]
      task.status = 'running'
      task.startedAt = Date.now()
      activeTasksByPlatform.set(platform, task)

      // Create platform tab if needed
      const tabId = browserViewManager.createPlatformView(task.targetUrl || 'about:blank', platform)
      task.tabId = tabId

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
        mainWindow.webContents.send('queue:taskStarted', task)
      }

      res.json({ success: true, task })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Complete a task
  server.post('/queue/complete/:taskId', (req: Request, res: Response) => {
    try {
      const { taskId } = req.params
      const { result, error } = req.body

      const task = marketingQueue.find(t => t.id === taskId)
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' })
        return
      }

      task.status = error ? 'failed' : 'completed'
      task.completedAt = Date.now()
      task.result = result
      task.error = error

      // Remove from active tasks
      activeTasksByPlatform.delete(task.platform)

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
        mainWindow.webContents.send('queue:taskCompleted', task)
      }

      res.json({ success: true, task })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Remove task from queue
  server.delete('/queue/:taskId', (req: Request, res: Response) => {
    try {
      const { taskId } = req.params
      const taskIndex = marketingQueue.findIndex(t => t.id === taskId)
      if (taskIndex === -1) {
        res.status(404).json({ success: false, error: 'Task not found' })
        return
      }

      const task = marketingQueue[taskIndex]
      if (task.status === 'running') {
        activeTasksByPlatform.delete(task.platform)
      }

      marketingQueue.splice(taskIndex, 1)

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
      }

      res.json({ success: true })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Clear completed/failed tasks
  server.post('/queue/clear', (req: Request, res: Response) => {
    try {
      const { status } = req.body // 'completed', 'failed', or 'all'
      if (status === 'all') {
        marketingQueue = marketingQueue.filter(t => t.status === 'running')
      } else if (status) {
        marketingQueue = marketingQueue.filter(t => t.status !== status)
      } else {
        marketingQueue = marketingQueue.filter(t => t.status !== 'completed' && t.status !== 'failed')
      }

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
      }

      res.json({ success: true, remaining: marketingQueue.length })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // ==================== SCREENSHOT STORAGE ENDPOINTS ====================

  // Save screenshot from a BrowserView tab
  server.post('/storage/screenshot', async (req: Request, res: Response) => {
    try {
      const { tabId, sessionId, action, platform, url } = req.body
      if (!sessionId || !action) {
        res.status(400).json({ success: false, error: 'sessionId and action are required' })
        return
      }

      // Determine which view to screenshot
      const id = tabId ?? browserViewManager.getActiveTabId()
      if (id === null || id === undefined) {
        res.status(400).json({ success: false, error: 'No active tab to screenshot' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view || view.webContents.isDestroyed()) {
        res.status(404).json({ success: false, error: `Tab ${id} not found or destroyed` })
        return
      }

      // Capture the page as a NativeImage
      const image = await view.webContents.capturePage()
      const buffer = image.toJPEG(70) // JPEG at 70% quality
      const base64 = buffer.toString('base64')

      // Save via StorageManager
      const screenshot = await storageManager.saveScreenshot({
        buffer,
        sessionId,
        action,
        platform,
        url: url || view.webContents.getURL(),
      })

      // Return both file info AND base64 for AI verification
      res.json({ success: true, screenshot, base64 })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Get storage statistics
  server.get('/storage/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await storageManager.getStats()
      res.json({ success: true, ...stats })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Manual cleanup trigger
  server.post('/storage/cleanup', async (_req: Request, res: Response) => {
    try {
      const result = await storageManager.cleanup()
      res.json({ success: true, ...result })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  server.listen(CONTROL_PORT, '127.0.0.1', () => {
    console.log(`[CHROMADON Desktop] Control server running on http://127.0.0.1:${CONTROL_PORT}`)
    console.log(`[CHROMADON Desktop] Endpoints:`)
    console.log(`  GET  /health              - Health check`)
    console.log(`  GET  /state               - Get app state`)
    console.log(`  POST /command             - Send command to execute`)
    console.log(`  GET  /screenshot          - Capture window screenshot`)
    console.log(`  POST /design/css          - Inject CSS for design`)
    console.log(`  POST /execute             - Run JavaScript in renderer`)
    console.log(`  POST /focus               - Focus the window`)
    console.log(`  POST /debug/bounds        - Set BrowserView bounds`)
    console.log(`  GET  /debug/info          - Get window info`)
    console.log(`  POST /tabs/click/:id      - Native mouse click`)
    console.log(`  POST /tabs/type/:id       - Native keyboard input`)
    console.log(`  POST /tabs/key/:id        - Native key press`)
    console.log(`  POST /tabs/platform       - Create platform-shared tab`)
    console.log(`  GET  /sessions            - List platform sessions`)
    console.log(`  POST /sessions/:platform  - Update platform session`)
    console.log(`  GET  /queue               - Get marketing queue status`)
    console.log(`  POST /queue/add           - Add task to queue`)
    console.log(`  POST /queue/process/:plat - Process next task`)
    console.log(`  POST /storage/screenshot  - Save screenshot to disk`)
    console.log(`  GET  /storage/stats       - Screenshot storage stats`)
    console.log(`  POST /storage/cleanup     - Cleanup old screenshots`)
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
    // Input validation - reject dangerous patterns
    if (!script || typeof script !== 'string') {
      return { success: false, error: 'Script must be a non-empty string' }
    }
    if (script.length > 100000) {
      return { success: false, error: 'Script exceeds maximum length (100KB)' }
    }
    // Block access to Node.js internals that could escape sandbox
    const dangerousPatterns = [
      /require\s*\(/i,
      /process\.(env|exit|kill|binding)/i,
      /child_process/i,
      /__dirname|__filename/i,
      /global\.process/i,
    ]
    for (const pattern of dangerousPatterns) {
      if (pattern.test(script)) {
        return { success: false, error: 'Script contains restricted patterns' }
      }
    }
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

// ==================== PLATFORM SESSION IPC HANDLERS ====================

// Get all platform sessions
ipcMain.handle('session:list', () => {
  return { success: true, sessions: browserViewManager.getPlatformSessions() }
})

// Get specific platform session
ipcMain.handle('session:get', (_event, platform: Platform) => {
  return { success: true, session: browserViewManager.getPlatformSession(platform) }
})

// Verify platform authentication
ipcMain.handle('session:verify', async (_event, platform: Platform) => {
  const isAuthenticated = await browserViewManager.verifyPlatformAuth(platform)
  return { success: true, platform, isAuthenticated }
})

// Update platform session
ipcMain.handle('session:update', (_event, { platform, updates }: { platform: Platform; updates: Partial<PlatformSession> }) => {
  browserViewManager.updatePlatformSession(platform, updates)
  return { success: true, session: browserViewManager.getPlatformSession(platform) }
})

// Hide/show BrowserViews for modal overlays
ipcMain.handle('views:setVisible', (_event, visible: boolean) => {
  browserViewManager.setViewsVisible(visible)
  return { success: true }
})

// Create platform-specific tab
ipcMain.handle('tab:createPlatform', (_event, { url, platform }: { url?: string; platform: Platform }) => {
  const id = browserViewManager.createPlatformView(url || 'about:blank', platform)
  return { success: true, id, platform, tabs: browserViewManager.getTabs() }
})

// ==================== MARKETING QUEUE IPC HANDLERS ====================

// Get queue status
ipcMain.handle('queue:status', () => {
  const activeTasks: Record<string, MarketingTask> = {}
  activeTasksByPlatform.forEach((task, platform) => {
    activeTasks[platform] = task
  })
  return {
    success: true,
    queue: marketingQueue,
    activeTasks,
    stats: {
      total: marketingQueue.length,
      queued: marketingQueue.filter(t => t.status === 'queued').length,
      running: marketingQueue.filter(t => t.status === 'running').length,
      completed: marketingQueue.filter(t => t.status === 'completed').length,
      failed: marketingQueue.filter(t => t.status === 'failed').length,
    },
  }
})

// Add task to queue
ipcMain.handle('queue:add', (_event, task: Omit<MarketingTask, 'id' | 'status' | 'createdAt'>) => {
  const newTask: MarketingTask = {
    ...task,
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    status: 'queued',
    createdAt: Date.now(),
    priority: task.priority ?? 0,
  }

  marketingQueue.push(newTask)
  marketingQueue.sort((a, b) => b.priority - a.priority)

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
  }

  return { success: true, task: newTask }
})

// Process next task for platform
ipcMain.handle('queue:process', async (_event, platform: Platform) => {
  if (activeTasksByPlatform.has(platform)) {
    return {
      success: false,
      error: `Platform ${platform} already has an active task`,
      activeTask: activeTasksByPlatform.get(platform),
    }
  }

  const taskIndex = marketingQueue.findIndex(
    t => t.platform === platform && t.status === 'queued'
  )

  if (taskIndex === -1) {
    return { success: true, message: 'No queued tasks for this platform', task: null }
  }

  const task = marketingQueue[taskIndex]
  task.status = 'running'
  task.startedAt = Date.now()
  activeTasksByPlatform.set(platform, task)

  const tabId = browserViewManager.createPlatformView(task.targetUrl || 'about:blank', platform)
  task.tabId = tabId

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
    mainWindow.webContents.send('queue:taskStarted', task)
  }

  return { success: true, task }
})

// Complete task
ipcMain.handle('queue:complete', (_event, { taskId, result, error }: { taskId: string; result?: any; error?: string }) => {
  const task = marketingQueue.find(t => t.id === taskId)
  if (!task) {
    return { success: false, error: 'Task not found' }
  }

  task.status = error ? 'failed' : 'completed'
  task.completedAt = Date.now()
  task.result = result
  task.error = error

  activeTasksByPlatform.delete(task.platform)

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
    mainWindow.webContents.send('queue:taskCompleted', task)
  }

  return { success: true, task }
})

// Remove task
ipcMain.handle('queue:remove', (_event, taskId: string) => {
  const taskIndex = marketingQueue.findIndex(t => t.id === taskId)
  if (taskIndex === -1) {
    return { success: false, error: 'Task not found' }
  }

  const task = marketingQueue[taskIndex]
  if (task.status === 'running') {
    activeTasksByPlatform.delete(task.platform)
  }

  marketingQueue.splice(taskIndex, 1)

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
  }

  return { success: true }
})

// Clear queue
ipcMain.handle('queue:clear', (_event, status?: 'completed' | 'failed' | 'all') => {
  if (status === 'all') {
    marketingQueue = marketingQueue.filter(t => t.status === 'running')
  } else if (status) {
    marketingQueue = marketingQueue.filter(t => t.status !== status)
  } else {
    marketingQueue = marketingQueue.filter(t => t.status !== 'completed' && t.status !== 'failed')
  }

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
  }

  return { success: true, remaining: marketingQueue.length }
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

// ==================== SETTINGS / API KEY IPC HANDLERS ====================

ipcMain.handle('settings:getApiKeyStatus', () => {
  const key = loadApiKey()
  return {
    hasKey: !!key,
    keyPreview: key ? `sk-ant-...${key.slice(-4)}` : null,
  }
})

ipcMain.handle('settings:setApiKey', async (_event, apiKey: string) => {
  try {
    if (!apiKey.startsWith('sk-ant-')) {
      return { success: false, error: 'Invalid API key format. Must start with sk-ant-' }
    }
    storeApiKey(apiKey)
    restartBrainServer(apiKey)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('settings:validateApiKey', async (_event, apiKey: string) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    })

    if (response.ok || response.status === 429) {
      return { success: true, valid: true }
    }
    if (response.status === 401) {
      return { success: true, valid: false, error: 'Invalid API key' }
    }
    const errorData = await response.json().catch(() => ({})) as any
    return { success: true, valid: false, error: errorData.error?.message || `HTTP ${response.status}` }
  } catch (err: any) {
    return { success: false, error: `Network error: ${err.message}` }
  }
})

ipcMain.handle('settings:removeApiKey', () => {
  try {
    deleteApiKey()
    restartBrainServer()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('settings:getBrainStatus', () => {
  return {
    isRunning: brainProcess !== null,
    pid: brainProcess?.pid || null,
  }
})

// ==================== OAUTH POPUP WINDOW ====================

// Platform login URLs
const PLATFORM_LOGIN_URLS: Record<Platform, string> = {
  google: 'https://accounts.google.com',
  twitter: 'https://twitter.com/login',
  linkedin: 'https://linkedin.com/login',
  facebook: 'https://facebook.com/login',
  instagram: 'https://instagram.com/accounts/login',
  youtube: 'https://accounts.google.com', // Same as Google - YouTube uses Google auth
  tiktok: 'https://tiktok.com/login',
}

// Open OAuth for platform sign-in
ipcMain.handle('oauth:signIn', async (_event, platform: Platform) => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' }
  }

  const loginUrl = PLATFORM_LOGIN_URLS[platform]
  if (!loginUrl) {
    return { success: false, error: `Unknown platform: ${platform}` }
  }

  // For Google and YouTube, use puppeteer to open real Chrome visibly
  // and import cookies after sign-in. YouTube shares Google's partition.
  if (platform === 'google' || platform === 'youtube') {
    console.log(`[CHROMADON] Using Chrome for ${platform} sign-in`)

    const puppeteer = require('puppeteer-core')
    const fs = require('fs')

    // Find Chrome
    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]

    let chromePath = ''
    for (const p of chromePaths) {
      if (fs.existsSync(p)) {
        chromePath = p
        break
      }
    }

    if (!chromePath) {
      return { success: false, error: 'Chrome not found' }
    }

    try {
      // Launch Chrome with puppeteer (visible)
      const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: false,
        args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'],
      })

      const pages = await browser.pages()
      const page = pages[0] || await browser.newPage()
      // Both Google and YouTube go to accounts.google.com
      await page.goto(loginUrl)

      // Wait for sign-in (check every 2 seconds for 5 minutes)
      // Same detection for both: redirect to myaccount.google.com means signed in
      let signedIn = false
      for (let i = 0; i < 150; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const url = page.url()
          if (url.includes('myaccount.google.com') ||
              (url.includes('google.com') && !url.includes('signin') && !url.includes('accounts.google.com'))) {
            signedIn = true
            break
          }
        } catch (e) {
          // Browser was closed by user
          console.log('[CHROMADON] Browser closed by user')
          break
        }
      }

      if (signedIn) {
        // Navigate to YouTube to pick up .youtube.com cookies (Google auth only gives .google.com cookies)
        console.log('[CHROMADON] Navigating to YouTube to capture cookies...')
        await page.goto('https://www.youtube.com', { waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {})
        await new Promise(r => setTimeout(r, 2000))

        // Use CDP to get ALL browser cookies (all domains, not just current page)
        const client = await page.target().createCDPSession()
        const { cookies } = await client.send('Network.getAllCookies')

        const googleSession = session.fromPartition('persist:platform-google')
        let imported = 0
        for (const cookie of cookies) {
          try {
            await googleSession.cookies.set({
              url: `https://${cookie.domain.replace(/^\./, '')}`,
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path,
              secure: cookie.secure,
              httpOnly: cookie.httpOnly,
              expirationDate: cookie.expires,
            })
            imported++
          } catch (e) {}
        }
        console.log(`[CHROMADON] Imported ${imported} cookies (all domains) for ${platform} → persist:platform-google`)

        // Google and YouTube share a session - always mark both as authenticated
        browserViewManager.updatePlatformSession('google', { isAuthenticated: true })
        browserViewManager.updatePlatformSession('youtube', { isAuthenticated: true })

        await browser.close()
        return { success: true, platform, cookies: imported }
      }

      await browser.close()
      return { success: false, platform, error: 'Sign-in timed out or cancelled' }
    } catch (err: any) {
      console.error(`[CHROMADON] Chrome sign-in error:`, err)
      return { success: false, platform, error: err.message }
    }
  }

  console.log(`[CHROMADON] Opening OAuth popup for ${platform}`)

  // Create popup window with platform-specific partition
  // Use settings that make it look like a real browser
  const oauthWindow = new BrowserWindow({
    width: 500,
    height: 700,
    center: true,
    parent: mainWindow,
    modal: false,
    alwaysOnTop: true,
    show: false,
    autoHideMenuBar: true,
    title: `Sign in to ${platform}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:platform-${platform}`,
      webSecurity: true,
      allowRunningInsecureContent: false,
      // Make it look more like a real browser
      sandbox: false, // Allow more native behavior
      webgl: true,
      enableWebSQL: true,
      spellcheck: true,
      experimentalFeatures: false,
    }
  })

  // Show when ready (ensures proper rendering before display)
  oauthWindow.once('ready-to-show', () => {
    oauthWindow.show()
    oauthWindow.focus()
  })

  // Anti-detection: Inject scripts after page starts loading
  oauthWindow.webContents.on('dom-ready', () => {
    oauthWindow.webContents.executeJavaScript(`
      try {
        // Remove webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

        // Add chrome object
        if (!window.chrome) {
          window.chrome = {
            app: { isInstalled: false },
            runtime: { connect: function(){}, sendMessage: function(){} },
            csi: function() { return {}; },
            loadTimes: function() { return {}; }
          };
        }

        // Plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' }
          ]
        });

        // Languages
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

        // Hardware
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

        // WebGL spoofing
        if (typeof WebGLRenderingContext !== 'undefined') {
          const getParam = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(p) {
            if (p === 37445) return 'Google Inc. (NVIDIA)';
            if (p === 37446) return 'ANGLE (NVIDIA GeForce GTX 1660 Ti)';
            return getParam.call(this, p);
          };
        }

        // Remove Electron indicators
        delete window.process;
        delete window.require;
        delete window.module;

        // Intercept window.open calls - for Google, signal to open in real Chrome
        const originalOpen = window.open;
        window.open = function(url, target, features) {
          console.log('[CHROMADON] Intercepted window.open:', url);
          if (url && (url.includes('accounts.google.com') || url.includes('google.com/o/oauth'))) {
            console.log('[CHROMADON] Google detected - signaling to open in Chrome');
            // Signal to Electron to open in real Chrome
            window.postMessage({ type: 'CHROMADON_GOOGLE_AUTH', url: url }, '*');
            return null;
          }
          // For other URLs, redirect to same window
          if (url) {
            window.location.href = url;
            return null;
          }
          return originalOpen.call(this, url, target, features);
        };

        // Listen for Google auth signal response
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CHROMADON_GOOGLE_AUTH_COMPLETE') {
            console.log('[CHROMADON] Google auth complete, reloading...');
            window.location.reload();
          }
        });

        console.log('[CHROMADON] Anti-detection + window.open interceptor injected');
      } catch(e) { console.error('[CHROMADON] Anti-detection error:', e); }
    `).catch(() => {});
  });

  // Listen for Google auth signal from renderer and open real Chrome
  oauthWindow.webContents.on('console-message', async (_event, _level, message) => {
    if (message.includes('Google detected - signaling to open in Chrome')) {
      console.log('[CHROMADON] Detected Google auth request, launching Chrome...')

      const puppeteer = require('puppeteer-core')
      const fs = require('fs')

      const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      ]

      let chromePath = ''
      for (const p of chromePaths) {
        if (fs.existsSync(p)) {
          chromePath = p
          break
        }
      }

      if (!chromePath) {
        console.error('[CHROMADON] Chrome not found')
        return
      }

      try {
        const browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: false,
          args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
          ignoreDefaultArgs: ['--enable-automation'],
        })

        const pages = await browser.pages()
        const page = pages[0] || await browser.newPage()
        await page.goto('https://accounts.google.com')

        // Wait for sign-in
        let signedIn = false
        for (let i = 0; i < 150; i++) {
          await new Promise(r => setTimeout(r, 2000))
          try {
            const currentUrl = page.url()
            if (currentUrl.includes('myaccount.google.com') ||
                (currentUrl.includes('google.com') && !currentUrl.includes('signin') && !currentUrl.includes('accounts.google.com'))) {
              signedIn = true
              break
            }
          } catch (e) {
            break
          }
        }

        if (signedIn) {
          const cookies = await page.cookies()
          const googleSession = session.fromPartition(`persist:platform-${platform}`)
          let imported = 0
          for (const cookie of cookies) {
            try {
              await googleSession.cookies.set({
                url: `https://${cookie.domain.replace(/^\./, '')}`,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expires,
              })
              imported++
            } catch (e) {}
          }
          console.log(`[CHROMADON] Imported ${imported} ${platform} cookies`)

          // Notify renderer
          oauthWindow.webContents.executeJavaScript(`
            window.postMessage({ type: 'CHROMADON_GOOGLE_AUTH_COMPLETE' }, '*');
          `).catch(() => {})
        }

        await browser.close()
      } catch (err) {
        console.error('[CHROMADON] Chrome sign-in error:', err)
      }
    }
  })

  // Handle "Sign in with Google" or other OAuth provider clicks within the popup
  oauthWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[CHROMADON] OAuth popup trying to open: ${url}`)

    // If it's trying to open Google sign-in, open it in the same window
    if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth')) {
      oauthWindow.loadURL(url, {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      })
      return { action: 'deny' }
    }

    // Allow other URLs to open in same window
    oauthWindow.loadURL(url)
    return { action: 'deny' }
  })

  // Allow navigation within the OAuth popup (needed for OAuth redirects)
  oauthWindow.webContents.on('will-navigate', (event, url) => {
    console.log(`[CHROMADON] OAuth popup navigating to: ${url}`)
    // Allow navigation - OAuth flows require multiple redirects
  })

  // Load the login page
  // Use latest Chrome user agent to bypass Google's Electron detection
  oauthWindow.loadURL(loginUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  })

  // Return a promise that resolves when auth completes or window closes
  return new Promise((resolve) => {
    let authCheckInterval: NodeJS.Timeout | null = null
    let resolved = false

    // Check for auth completion every second
    const checkAuth = async () => {
      if (resolved) return

      try {
        const isAuth = await browserViewManager.verifyPlatformAuth(platform)
        if (isAuth) {
          console.log(`[CHROMADON] OAuth completed for ${platform}`)
          resolved = true
          if (authCheckInterval) clearInterval(authCheckInterval)
          oauthWindow.close()
          resolve({ success: true, platform })
        }
      } catch (error) {
        console.error(`[CHROMADON] Error checking auth for ${platform}:`, error)
      }
    }

    authCheckInterval = setInterval(checkAuth, 1000)

    // Handle window close (user closed manually)
    oauthWindow.on('closed', () => {
      if (!resolved) {
        resolved = true
        if (authCheckInterval) clearInterval(authCheckInterval)
        // Check one final time if they authenticated before closing
        browserViewManager.verifyPlatformAuth(platform).then(isAuth => {
          if (isAuth) {
            resolve({ success: true, platform })
          } else {
            resolve({ success: false, platform, userClosed: true })
          }
        }).catch(() => {
          resolve({ success: false, platform, userClosed: true })
        })
      }
    })
  })
})

// App lifecycle
app.whenReady().then(() => {
  // Spoof user-agent on Google session partition so Google/YouTube
  // don't detect Electron as "not secure browser"
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  const googleSession = session.fromPartition('persist:platform-google')
  googleSession.setUserAgent(CHROME_UA)
  googleSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.google.com/*', '*://*.youtube.com/*', '*://*.gstatic.com/*', '*://*.googleapis.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = CHROME_UA
      callback({ requestHeaders: details.requestHeaders })
    }
  )
  console.log('[CHROMADON] Google session UA spoofed to Chrome')

  createWindow()
  startControlServer()

  // Load stored API key and start brain
  const storedKey = loadApiKey()
  console.log(`[CHROMADON] Startup: API key ${storedKey ? 'found' : 'NOT found'}, userData=${app.getPath('userData')}`)
  startBrainServer(storedKey || undefined)
})

app.on('before-quit', () => {
  if (brainProcess) {
    console.log('[Desktop] Shutting down Brain server...')
    brainProcess.kill('SIGTERM')
    brainProcess = null
  }
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

// Security: Handle new windows and navigation for OAuth flows
// SKIP BrowserView webContents - they handle their own navigation in browser-view-manager.ts
app.on('web-contents-created', (_, contents) => {
  // BrowserViews are the embedded browser tabs - never intercept their navigation
  if (contents.getType() === 'browserView') {
    return
  }

  const allowedDomains = [
    'accounts.google.com',
    'google.com',
    'twitter.com',
    'x.com',
    'api.twitter.com',
    'facebook.com',
    'linkedin.com',
    'instagram.com',
    'tiktok.com',
    'youtube.com',
    'appleid.apple.com'
  ]

  // Handle new window requests (like "Sign in with Google" buttons)
  contents.setWindowOpenHandler(({ url }) => {
    console.log(`[CHROMADON] New window requested: ${url}`)

    // For Google sign-in URLs, use Chrome via puppeteer instead of Electron
    // Google blocks Electron with "This browser or app may not be secure"
    if (url.includes('accounts.google.com') || url.includes('google.com/o/oauth')) {
      console.log(`[CHROMADON] Google URL detected - launching Chrome instead`)

      // Launch Chrome for Google sign-in asynchronously
      ;(async () => {
        try {
          const puppeteer = require('puppeteer-core')
          const fs = require('fs')

          const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]

          let chromePath = ''
          for (const p of chromePaths) {
            if (fs.existsSync(p)) {
              chromePath = p
              break
            }
          }

          if (!chromePath) {
            console.error('[CHROMADON] Chrome not found')
            return
          }

          const browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
            ignoreDefaultArgs: ['--enable-automation'],
          })

          const pages = await browser.pages()
          const page = pages[0] || await browser.newPage()
          await page.goto(url)

          // Wait for sign-in completion
          let signedIn = false
          for (let i = 0; i < 150; i++) {
            await new Promise(r => setTimeout(r, 2000))
            try {
              const currentUrl = page.url()
              if (currentUrl.includes('myaccount.google.com') ||
                  (currentUrl.includes('google.com') && !currentUrl.includes('signin') && !currentUrl.includes('accounts.google.com'))) {
                signedIn = true
                break
              }
            } catch (e) {
              break
            }
          }

          if (signedIn) {
            const cookies = await page.cookies()
            const googleSession = session.fromPartition('persist:platform-google')
            let imported = 0
            for (const cookie of cookies) {
              try {
                await googleSession.cookies.set({
                  url: `https://${cookie.domain.replace(/^\./, '')}`,
                  name: cookie.name,
                  value: cookie.value,
                  domain: cookie.domain,
                  path: cookie.path,
                  secure: cookie.secure,
                  httpOnly: cookie.httpOnly,
                  expirationDate: cookie.expires,
                })
                imported++
              } catch (e) {}
            }
            console.log(`[CHROMADON] Imported ${imported} Google cookies from OAuth redirect`)
          }

          await browser.close()
        } catch (err) {
          console.error('[CHROMADON] Chrome sign-in error:', err)
        }
      })()

      return { action: 'deny' }
    }

    // For other OAuth URLs, load in the same window
    const isOAuthUrl = allowedDomains.some(domain => url.includes(domain))
    if (isOAuthUrl) {
      console.log(`[CHROMADON] Loading OAuth URL in same window: ${url}`)
      contents.loadURL(url)
      return { action: 'deny' }
    }

    // Block other new windows
    console.log(`[CHROMADON] Blocked new window: ${url}`)
    return { action: 'deny' }
  })

  // Allow navigation to OAuth domains, but redirect Google to Chrome
  contents.on('will-navigate', (event, url) => {
    // Allow Google auth navigation inline for OAuth popups
    if (url.includes('accounts.google.com/o/oauth') || url.includes('accounts.google.com/signin')) {
      // Allow Google auth navigation inline - don't open external browser
      console.log(`[CHROMADON] Google auth navigation allowed inline: ${url}`)
      return
    }

    const isAllowed = allowedDomains.some(domain => url.includes(domain))
    if (!isAllowed) {
      console.log(`[CHROMADON] Blocked navigation to: ${url}`)
      event.preventDefault()
    }
  })
})
