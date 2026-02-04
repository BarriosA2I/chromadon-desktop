import { app, BrowserWindow, ipcMain, shell, clipboard } from 'electron'
import path from 'path'
import express from 'express'
import type { Request, Response } from 'express'
import * as fs from 'fs'
import { browserViewManager, TabInfo, Platform, SessionMode, PlatformSession } from './browser-view-manager'
import { vault, ChromadonProfile, StoredCredential } from './security/vault'

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

// ==================== OAUTH POPUP WINDOW ====================

// Platform login URLs
const PLATFORM_LOGIN_URLS: Record<Platform, string> = {
  google: 'https://accounts.google.com',
  twitter: 'https://twitter.com/login',
  linkedin: 'https://linkedin.com/login',
  facebook: 'https://facebook.com/login',
  instagram: 'https://instagram.com/accounts/login',
  youtube: 'https://accounts.google.com', // Uses Google auth
  tiktok: 'https://tiktok.com/login',
}

// Open OAuth popup window for platform sign-in
ipcMain.handle('oauth:signIn', async (_event, platform: Platform) => {
  if (!mainWindow) {
    return { success: false, error: 'Main window not available' }
  }

  const loginUrl = PLATFORM_LOGIN_URLS[platform]
  if (!loginUrl) {
    return { success: false, error: `Unknown platform: ${platform}` }
  }

  console.log(`[CHROMADON] Opening OAuth popup for ${platform}`)

  // Create popup window with platform-specific partition
  const oauthWindow = new BrowserWindow({
    width: 500,
    height: 700,
    center: true,
    parent: mainWindow,
    modal: false,        // Don't use modal - it blocks input on Windows
    alwaysOnTop: true,   // Keep on top instead
    show: false,         // Wait for ready-to-show
    autoHideMenuBar: true,
    title: `Sign in to ${platform}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: `persist:platform-${platform}`, // Share session with BrowserViews!
    }
  })

  // Show when ready (ensures proper rendering before display)
  oauthWindow.once('ready-to-show', () => {
    oauthWindow.show()
    oauthWindow.focus()
  })

  // Load the login page
  oauthWindow.loadURL(loginUrl)

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
