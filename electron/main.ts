import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import express from 'express'
import type { Request, Response } from 'express'
import * as fs from 'fs'
import { browserViewManager, TabInfo } from './browser-view-manager'

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

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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
