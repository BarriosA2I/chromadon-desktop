import { BrowserView, BrowserWindow, session, shell } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import { app } from 'electron'

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

// Supported platforms for session sharing
export type Platform = 'google' | 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'youtube' | 'tiktok'

// Session mode determines how cookies/auth are shared
export type SessionMode = 'isolated' | 'platform-shared' | 'global-shared'

// Options for creating a new view
export interface CreateViewOptions {
  sessionMode?: SessionMode
  platform?: Platform
}

// Platform session state
export interface PlatformSession {
  platform: Platform
  partition: string
  isAuthenticated: boolean
  lastVerified: number
  accountName?: string
  accountEmail?: string
  accountAvatar?: string
}

// URL patterns to detect platform
const PLATFORM_URL_PATTERNS: Record<Platform, RegExp[]> = {
  google: [/google\.com/, /youtube\.com/, /gmail\.com/],
  twitter: [/twitter\.com/, /x\.com/],
  linkedin: [/linkedin\.com/],
  facebook: [/facebook\.com/, /fb\.com/],
  instagram: [/instagram\.com/],
  youtube: [/youtube\.com/],
  tiktok: [/tiktok\.com/],
}

export interface TabInfo {
  id: number
  url: string
  title: string
  isActive: boolean
  canGoBack: boolean
  canGoForward: boolean
  sessionMode?: SessionMode
  platform?: Platform
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

  // Platform session management
  private platformSessions: Map<Platform, PlatformSession> = new Map()
  private sessionsFilePath: string = ''

  constructor() {
    // Initialize sessions file path (will be set properly after app is ready)
    this.sessionsFilePath = path.join(app.getPath('userData'), 'platform-sessions.json')
    this.loadPlatformSessions()
  }

  /**
   * Load platform sessions from disk
   */
  private loadPlatformSessions() {
    try {
      if (fs.existsSync(this.sessionsFilePath)) {
        const data = JSON.parse(fs.readFileSync(this.sessionsFilePath, 'utf-8'))
        for (const [platform, sessionData] of Object.entries(data)) {
          this.platformSessions.set(platform as Platform, sessionData as PlatformSession)
        }
        console.log(`[BrowserViewManager] Loaded ${this.platformSessions.size} platform sessions`)
      }
    } catch (err) {
      console.error('[BrowserViewManager] Failed to load platform sessions:', err)
    }
  }

  /**
   * Save platform sessions to disk
   */
  private savePlatformSessions() {
    try {
      const data: Record<string, PlatformSession> = {}
      for (const [platform, session] of this.platformSessions.entries()) {
        data[platform] = session
      }
      fs.writeFileSync(this.sessionsFilePath, JSON.stringify(data, null, 2))
      console.log(`[BrowserViewManager] Saved ${this.platformSessions.size} platform sessions`)
    } catch (err) {
      console.error('[BrowserViewManager] Failed to save platform sessions:', err)
    }
  }

  /**
   * Get partition string for session mode
   */
  private getPartition(options: CreateViewOptions, tabId: number): string {
    const { sessionMode = 'isolated', platform } = options

    switch (sessionMode) {
      case 'platform-shared':
        if (!platform) {
          console.warn('[BrowserViewManager] Platform required for platform-shared mode, falling back to isolated')
          return `persist:tab-${tabId}`
        }
        return `persist:platform-${platform}`
      case 'global-shared':
        return 'persist:global'
      case 'isolated':
      default:
        return `persist:tab-${tabId}`
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): Platform | null {
    for (const [platform, patterns] of Object.entries(PLATFORM_URL_PATTERNS)) {
      if (patterns.some(pattern => pattern.test(url))) {
        return platform as Platform
      }
    }
    return null
  }

  /**
   * Get all platform sessions
   */
  getPlatformSessions(): PlatformSession[] {
    return Array.from(this.platformSessions.values())
  }

  /**
   * Get a specific platform session
   */
  getPlatformSession(platform: Platform): PlatformSession | null {
    return this.platformSessions.get(platform) || null
  }

  /**
   * Update platform session status
   */
  updatePlatformSession(platform: Platform, updates: Partial<PlatformSession>) {
    const existing = this.platformSessions.get(platform) || {
      platform,
      partition: `persist:platform-${platform}`,
      isAuthenticated: false,
      lastVerified: 0,
    }
    const updated = { ...existing, ...updates, lastVerified: Date.now() }
    this.platformSessions.set(platform, updated)
    this.savePlatformSessions()
    console.log(`[BrowserViewManager] Updated ${platform} session:`, updated)
  }

  /**
   * Check if a platform is authenticated (check cookies/session)
   */
  async verifyPlatformAuth(platform: Platform): Promise<boolean> {
    const partition = `persist:platform-${platform}`
    const ses = session.fromPartition(partition)

    // Check for auth cookies based on platform
    const cookiePatterns: Record<Platform, string[]> = {
      google: ['.google.com'],
      twitter: ['.twitter.com', '.x.com'],
      linkedin: ['.linkedin.com'],
      facebook: ['.facebook.com'],
      instagram: ['.instagram.com'],
      youtube: ['.youtube.com', '.google.com'],
      tiktok: ['.tiktok.com'],
    }

    const domains = cookiePatterns[platform] || []

    for (const domain of domains) {
      try {
        const cookies = await ses.cookies.get({ domain })
        // Look for session cookies that indicate auth
        const hasAuthCookie = cookies.some(c =>
          c.name.toLowerCase().includes('sid') ||
          c.name.toLowerCase().includes('session') ||
          c.name.toLowerCase().includes('auth') ||
          c.name.toLowerCase().includes('login') ||
          c.name.toLowerCase().includes('token')
        )
        if (hasAuthCookie) {
          this.updatePlatformSession(platform, { isAuthenticated: true })
          return true
        }
      } catch (err) {
        console.error(`[BrowserViewManager] Error checking cookies for ${platform}:`, err)
      }
    }

    this.updatePlatformSession(platform, { isAuthenticated: false })
    return false
  }

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
   * @param url - URL to navigate to
   * @param options - Session mode and platform options
   */
  createView(url: string = 'about:blank', options: CreateViewOptions = {}): number {
    if (!this.mainWindow) {
      throw new Error('Main window not set')
    }

    const id = this.nextId++
    const { sessionMode = 'isolated', platform } = options

    // Get partition based on session mode
    const partition = this.getPartition(options, id)
    const ses = session.fromPartition(partition)

    console.log(`[BrowserViewManager] Creating tab ${id} with partition: ${partition}, mode: ${sessionMode}, platform: ${platform || 'none'}`)

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
        // Use same partition as parent tab to share auth state
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
              partition: partition, // Share session with parent tab
            },
          },
        }
      }

      // Default: open in system browser
      shell.openExternal(url)
      return { action: 'deny' }
    })

    // Anti-detection for Google - inject scripts before navigation completes
    view.webContents.on('did-start-navigation', (_event, url) => {
      // Inject anti-detection for Google pages
      if (url.includes('google.com') || url.includes('youtube.com')) {
        view.webContents.executeJavaScript(`
          // Remove webdriver flag
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
          });

          // Add chrome object
          if (!window.chrome) {
            window.chrome = {
              runtime: {},
              loadTimes: function() {},
              csi: function() {},
              app: {}
            };
          }

          // Fix permissions API
          const originalQuery = window.navigator.permissions?.query;
          if (originalQuery) {
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
          }

          // Add plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ],
            configurable: true
          });

          // Set languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
            configurable: true
          });

          console.log('[CHROMADON] Anti-detection injected for Google');
        `).catch(() => {});
      }
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
      sessionMode,
      platform,
    })

    // Add to window
    this.mainWindow.addBrowserView(view)

    // Navigate to URL
    if (url !== 'about:blank') {
      // Set Chrome user agent for Google pages to bypass Electron detection
      if (url.includes('google.com') || url.includes('youtube.com')) {
        view.webContents.loadURL(url, {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
      } else {
        view.webContents.loadURL(url)
      }
    }

    // Focus this new tab
    this.focusView(id)

    console.log(`[BrowserViewManager] Created tab ${id} with URL: ${url}, partition: ${partition}`)
    return id
  }

  /**
   * Create a platform-specific tab with shared session
   * Convenience method for creating tabs that share auth with a platform
   */
  createPlatformView(url: string, platform: Platform): number {
    return this.createView(url, {
      sessionMode: 'platform-shared',
      platform,
    })
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
