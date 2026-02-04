import { BrowserView, BrowserWindow, session, shell } from 'electron'
import * as path from 'path'

// OAuth provider patterns - allow these as popup windows
const OAUTH_PATTERNS = [
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

export interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
}

export interface ViewBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Manages multiple BrowserView instances for embedded browser tabs
 */
export class BrowserViewManager {
  private views: Map<number, BrowserView> = new Map()
  private tabInfo: Map<number, TabInfo> = new Map()
  private activeViewId: number | null = null
  private mainWindow: BrowserWindow | null = null
  private nextId: number = 1
  private viewBounds: ViewBounds = { x: 0, y: 90, width: 1050, height: 700 }
  private onTabUpdateCallback: ((tabs: TabInfo[]) => void) | null = null

  constructor() {}

  /**
   * Set the main window reference
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window
  }

  /**
   * Set callback for tab updates
   */
  onTabUpdate(callback: (tabs: TabInfo[]) => void) {
    this.onTabUpdateCallback = callback
  }

  /**
   * Update the bounds where BrowserViews should render
   */
  setViewBounds(bounds: ViewBounds) {
    this.viewBounds = bounds
    // Update active view bounds
    if (this.activeViewId !== null) {
      const view = this.views.get(this.activeViewId)
      if (view) {
        view.setBounds(this.viewBounds)
      }
    }
  }

  /**
   * Create a new browser tab
   */
  createView(url: string = 'about:blank'): number {
    if (!this.mainWindow) {
      throw new Error('Main window not set')
    }

    const id = this.nextId++

    // Create persistent session for this tab (preserves cookies/logins)
    const partition = `persist:tab-${id}`
    const ses = session.fromPartition(partition)

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: partition,
        // Enable features needed for social media sites
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    })

    // Set bounds (initially hidden until focused)
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

    // Handle OAuth popups and external links
    view.webContents.setWindowOpenHandler(({ url }) => {
      const isOAuth = OAUTH_PATTERNS.some(pattern => pattern.test(url))

      if (isOAuth && this.mainWindow) {
        // Allow OAuth popups to open as modal windows
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 700,
            center: true,
            parent: this.mainWindow,
            modal: true,
            autoHideMenuBar: true,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              partition: `persist:oauth-tab-${id}`,
            },
          },
        }
      }

      // Default: open in system browser
      shell.openExternal(url)
      return { action: 'deny' }
    })

    // Track navigation events
    view.webContents.on('did-navigate', (_event, url) => {
      this.updateTabInfo(id, { url })
    })

    view.webContents.on('did-navigate-in-page', (_event, url) => {
      this.updateTabInfo(id, { url })
    })

    view.webContents.on('page-title-updated', (_event, title) => {
      this.updateTabInfo(id, { title })
    })

    view.webContents.on('did-start-loading', () => {
      this.notifyTabUpdate()
    })

    view.webContents.on('did-stop-loading', () => {
      const info = this.tabInfo.get(id)
      if (info) {
        info.canGoBack = view.webContents.canGoBack()
        info.canGoForward = view.webContents.canGoForward()
      }
      this.notifyTabUpdate()
    })

    // Store view and info
    this.views.set(id, view)
    this.tabInfo.set(id, {
      id,
      url: url,
      title: 'New Tab',
      isActive: false,
      canGoBack: false,
      canGoForward: false,
    })

    // Add to window
    this.mainWindow.addBrowserView(view)

    // Navigate to URL
    if (url !== 'about:blank') {
      view.webContents.loadURL(url)
    }

    // Focus this new tab
    this.focusView(id)

    console.log(`[BrowserViewManager] Created tab ${id} with URL: ${url}`)
    return id
  }

  /**
   * Remove a browser tab
   */
  removeView(id: number): boolean {
    const view = this.views.get(id)
    if (!view || !this.mainWindow) {
      return false
    }

    // Remove from window
    this.mainWindow.removeBrowserView(view)

    // Destroy the view
    ;(view.webContents as any).destroy?.()

    // Remove from maps
    this.views.delete(id)
    this.tabInfo.delete(id)

    // If this was the active view, focus another
    if (this.activeViewId === id) {
      this.activeViewId = null
      const remainingIds = Array.from(this.views.keys())
      if (remainingIds.length > 0) {
        this.focusView(remainingIds[0])
      }
    }

    this.notifyTabUpdate()
    console.log(`[BrowserViewManager] Removed tab ${id}`)
    return true
  }

  /**
   * Navigate a tab to a URL
   */
  navigateView(id: number, url: string): boolean {
    const view = this.views.get(id)
    if (!view) {
      return false
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url
    }

    view.webContents.loadURL(url)
    this.updateTabInfo(id, { url })
    console.log(`[BrowserViewManager] Navigating tab ${id} to: ${url}`)
    return true
  }

  /**
   * Focus a tab (show it and hide others)
   */
  focusView(id: number): boolean {
    const view = this.views.get(id)
    if (!view || !this.mainWindow) {
      return false
    }

    // Hide previous active view
    if (this.activeViewId !== null && this.activeViewId !== id) {
      const prevView = this.views.get(this.activeViewId)
      if (prevView) {
        prevView.setBounds({ x: 0, y: 0, width: 0, height: 0 })
        const prevInfo = this.tabInfo.get(this.activeViewId)
        if (prevInfo) {
          prevInfo.isActive = false
        }
      }
    }

    // Show and focus new view
    view.setBounds(this.viewBounds)
    this.mainWindow.setTopBrowserView(view)

    // Update active state
    this.activeViewId = id
    const info = this.tabInfo.get(id)
    if (info) {
      info.isActive = true
    }

    this.notifyTabUpdate()
    console.log(`[BrowserViewManager] Focused tab ${id}`)
    return true
  }

  /**
   * Go back in tab history
   */
  goBack(id: number): boolean {
    const view = this.views.get(id)
    if (!view || !view.webContents.canGoBack()) {
      return false
    }
    view.webContents.goBack()
    return true
  }

  /**
   * Go forward in tab history
   */
  goForward(id: number): boolean {
    const view = this.views.get(id)
    if (!view || !view.webContents.canGoForward()) {
      return false
    }
    view.webContents.goForward()
    return true
  }

  /**
   * Reload a tab
   */
  reload(id: number): boolean {
    const view = this.views.get(id)
    if (!view) {
      return false
    }
    view.webContents.reload()
    return true
  }

  /**
   * Get screenshot of a tab
   */
  async getScreenshot(id: number): Promise<Buffer | null> {
    const view = this.views.get(id)
    if (!view) {
      return null
    }

    const image = await view.webContents.capturePage()
    return image.toPNG()
  }

  /**
   * Execute JavaScript in a tab
   */
  async executeScript(id: number, script: string): Promise<any> {
    const view = this.views.get(id)
    if (!view) {
      throw new Error(`Tab ${id} not found`)
    }

    return view.webContents.executeJavaScript(script)
  }

  /**
   * Get all tabs info
   */
  getTabs(): TabInfo[] {
    return Array.from(this.tabInfo.values())
  }

  /**
   * Get active tab ID
   */
  getActiveTabId(): number | null {
    return this.activeViewId
  }

  /**
   * Get a specific tab's info
   */
  getTabInfo(id: number): TabInfo | null {
    return this.tabInfo.get(id) || null
  }

  /**
   * Get BrowserView by ID (for advanced operations)
   */
  getView(id: number): BrowserView | null {
    return this.views.get(id) || null
  }

  /**
   * Update tab info and notify
   */
  private updateTabInfo(id: number, updates: Partial<TabInfo>) {
    const info = this.tabInfo.get(id)
    if (info) {
      Object.assign(info, updates)
      this.notifyTabUpdate()
    }
  }

  /**
   * Notify listeners of tab updates
   */
  private notifyTabUpdate() {
    if (this.onTabUpdateCallback) {
      this.onTabUpdateCallback(this.getTabs())
    }
  }

  /**
   * Clean up all views
   */
  destroy() {
    for (const id of this.views.keys()) {
      this.removeView(id)
    }
  }
}

// Singleton instance
export const browserViewManager = new BrowserViewManager()
