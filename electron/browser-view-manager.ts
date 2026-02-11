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
  google: [/google\.com/, /gmail\.com/],
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
   * Hide or show the active BrowserView. Used when UI modals need to overlay the browser area.
   * BrowserViews are native OS-level overlays that render above all web content,
   * so they must be hidden for React modals to be visible.
   */
  setViewsVisible(visible: boolean) {
    if (this.activeViewId === null) return
    const view = this.views.get(this.activeViewId)
    if (!view || view.webContents.isDestroyed()) return
    if (visible) {
      view.setBounds(this.viewBounds)
      console.log(`[BrowserViewManager] Views shown (modal closed)`)
    } else {
      view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
      console.log(`[BrowserViewManager] Views hidden (modal opened)`)
    }
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
   * Attach all necessary event handlers to a BrowserView.
   * Extracted from createView() for reuse during partition swaps.
   */
  private attachViewHandlers(view: BrowserView, id: number, partition: string): void {
    // Handle OAuth popups and external links
    view.webContents.setWindowOpenHandler(({ url }) => {
      const isOAuth = OAUTH_PATTERNS.some(pattern => pattern.test(url))

      if (isOAuth && this.mainWindow) {
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
              partition: partition,
            },
          },
        }
      }

      shell.openExternal(url)
      return { action: 'deny' }
    })

    // Anti-detection for Google - inject scripts before navigation completes
    view.webContents.on('did-start-navigation', (_event, url) => {
      if (url.includes('google.com') || url.includes('youtube.com')) {
        view.webContents.executeJavaScript(`
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
            configurable: true
          });
          if (!window.chrome) {
            window.chrome = {
              runtime: {},
              loadTimes: function() {},
              csi: function() {},
              app: {}
            };
          }
          const originalQuery = window.navigator.permissions?.query;
          if (originalQuery) {
            window.navigator.permissions.query = (parameters) => (
              parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
            );
          }
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ],
            configurable: true
          });
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
  }

  /**
   * Replace a value in a Map while preserving insertion order.
   * JavaScript Maps iterate in insertion order; deleting and re-setting
   * a key moves it to the end. This rebuilds the Map to keep order.
   */
  private rebuildMapEntry<K, V>(map: Map<K, V>, targetKey: K, newValue: V): void {
    const entries = Array.from(map.entries())
    map.clear()
    for (const [key, value] of entries) {
      map.set(key, key === targetKey ? newValue : value)
    }
  }

  /**
   * Swap the partition of an existing tab by destroying and recreating its BrowserView.
   * The tab ID is preserved so all external references (Brain API, Zustand, queue) remain valid.
   * Returns the new BrowserView.
   */
  private swapPartition(id: number, newPartition: string, platform: Platform): BrowserView {
    if (!this.mainWindow) {
      throw new Error('Main window not set')
    }

    const oldView = this.views.get(id)
    if (!oldView) {
      throw new Error(`Tab ${id} not found for partition swap`)
    }

    const wasActive = this.activeViewId === id

    // 1. Remove old BrowserView from window and destroy it
    try {
      if (!oldView.webContents.isDestroyed()) {
        this.mainWindow.removeBrowserView(oldView)
        ;(oldView.webContents as any).destroy?.()
      }
    } catch (_) { /* already destroyed */ }

    // 2. Create new BrowserView with correct partition
    const newView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: newPartition,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    })

    // 3. Apply Chrome user agent spoofing
    const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    newView.webContents.setUserAgent(chromeUserAgent)

    // 4. Set bounds (hidden initially)
    newView.setBounds({ x: 0, y: 0, width: 0, height: 0 })

    // 5. Attach all event handlers with new partition
    this.attachViewHandlers(newView, id, newPartition)

    // 6. Replace in views Map preserving insertion order
    this.rebuildMapEntry(this.views, id, newView)

    // 7. Update tabInfo metadata
    const info = this.tabInfo.get(id)
    if (info) {
      info.sessionMode = 'platform-shared'
      info.platform = platform
    }

    // 8. Add to window
    this.mainWindow.addBrowserView(newView)

    // 9. Restore active state
    if (wasActive) {
      newView.setBounds(this.viewBounds)
      this.mainWindow.setTopBrowserView(newView)
    }

    console.log(`[BrowserViewManager] Swapped partition for tab ${id}: ${newPartition} (platform: ${platform})`)
    return newView
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

    // Auto-detect platform if no explicit session mode was specified
    if (!options.sessionMode && !options.platform && url !== 'about:blank') {
      const detectedPlatform = this.detectPlatform(url)
      if (detectedPlatform) {
        options = {
          ...options,
          sessionMode: 'platform-shared',
          platform: detectedPlatform,
        }
        console.log(`[BrowserViewManager] Auto-detected platform '${detectedPlatform}' for URL: ${url}`)
      }
    }

    const id = this.nextId++
    const { sessionMode = 'isolated', platform } = options

    // Get partition based on session mode
    const partition = this.getPartition(options, id)

    console.log(`[BrowserViewManager] Creating tab ${id} with partition: ${partition}, mode: ${sessionMode}, platform: ${platform || 'none'}`)

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: partition,
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    })

    // Spoof user agent for Google to allow sign-in (Google blocks Electron's default UA)
    const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    view.webContents.setUserAgent(chromeUserAgent)

    // Set bounds (initially hidden until focused)
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 })

    // Attach event handlers (OAuth, anti-detection, navigation tracking)
    this.attachViewHandlers(view, id, partition)

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

    // Guard against already-destroyed views (race condition on window close)
    if (view.webContents.isDestroyed()) {
      this.views.delete(id)
      this.tabInfo.delete(id)
      if (this.activeViewId === id) this.activeViewId = null
      return true
    }

    // Remove from window
    try {
      this.mainWindow.removeBrowserView(view)
    } catch (_) { /* view may already be detached */ }

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
   * Navigate a tab to a URL (partition-aware: swaps session if navigating to a platform URL)
   */
  navigateView(id: number, url: string): boolean {
    const view = this.views.get(id)
    if (!view || view.webContents.isDestroyed()) {
      return false
    }

    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      url = 'https://' + url
    }

    // Check if this URL requires a platform partition
    const targetPlatform = this.detectPlatform(url)
    const currentInfo = this.tabInfo.get(id)

    if (targetPlatform) {
      // Check if tab is already on the correct platform partition
      const needsSwap = currentInfo?.sessionMode !== 'platform-shared'
                      || currentInfo?.platform !== targetPlatform

      if (needsSwap) {
        const requiredPartition = `persist:platform-${targetPlatform}`
        console.log(`[BrowserViewManager] Partition swap needed for tab ${id}: navigating to ${targetPlatform} URL but tab has ${currentInfo?.sessionMode || 'isolated'}/${currentInfo?.platform || 'none'} session`)

        try {
          const newView = this.swapPartition(id, requiredPartition, targetPlatform)

          // Navigate the new view
          if (url.includes('google.com') || url.includes('youtube.com')) {
            newView.webContents.loadURL(url, {
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            })
          } else {
            newView.webContents.loadURL(url)
          }

          this.updateTabInfo(id, { url })
          this.notifyTabUpdate()
          console.log(`[BrowserViewManager] Tab ${id} swapped to partition ${requiredPartition} and navigating to: ${url}`)
          return true
        } catch (err) {
          console.error(`[BrowserViewManager] Partition swap failed for tab ${id}:`, err)
          return false
        }
      }
    }

    // Normal navigation (no partition swap needed)
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
    for (const [id, view] of this.views.entries()) {
      try {
        if (view && !view.webContents.isDestroyed()) {
          this.mainWindow?.removeBrowserView(view)
          ;(view.webContents as any).destroy?.()
        }
      } catch (_) { /* already destroyed */ }
      this.tabInfo.delete(id)
    }
    this.views.clear()
    this.activeViewId = null
  }
}

// Singleton instance
export const browserViewManager = new BrowserViewManager()
