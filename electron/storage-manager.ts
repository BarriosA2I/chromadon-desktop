/**
 * CHROMADON Screenshot Storage Manager
 * =====================================
 * Manages screenshot storage on the client's machine.
 * Auto-creates directory structure on first launch.
 * Organizes screenshots by date / platform / session.
 *
 * Directory structure:
 *   Documents/CHROMADON/
 *   ├── screenshots/
 *   │   └── 2026-02-10/
 *   │       ├── twitter/
 *   │       │   └── session-abc12345/
 *   │       │       ├── 001-navigate.jpg
 *   │       │       ├── 002-click.jpg
 *   │       │       └── session.json
 *   │       └── general/
 *   └── config/
 *       └── storage.json
 *
 * @author Barrios A2I
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// ============================================================================
// TYPES
// ============================================================================

export interface StorageConfig {
  enabled: boolean
  compressionQuality: number   // 0-100 JPEG quality
  maxDaysToKeep: number
  maxTotalSizeMB: number
}

export interface SaveScreenshotOptions {
  buffer: Buffer
  sessionId: string
  action: string               // 'navigate', 'click', 'type_text', etc.
  platform?: string            // 'twitter', 'linkedin', etc. or null → 'general'
  url?: string
}

export interface ScreenshotInfo {
  path: string
  filename: string
  size: number
}

export interface SessionMetadata {
  sessionId: string
  platform: string
  startedAt: string
  screenshots: Array<{
    seq: number
    file: string
    action: string
    url?: string
    ts: number
  }>
}

export interface StorageStats {
  totalMB: number
  screenshotCount: number
  oldestDate: string | null
  rootDir: string
}

export interface CleanupResult {
  deleted: number
  freedMB: number
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_CONFIG: StorageConfig = {
  enabled: true,
  compressionQuality: 70,
  maxDaysToKeep: 30,
  maxTotalSizeMB: 500,
}

// ============================================================================
// STORAGE MANAGER
// ============================================================================

export class StorageManager {
  private rootDir: string
  private screenshotDir: string
  private configDir: string
  private config: StorageConfig = { ...DEFAULT_CONFIG }
  private sessionCounters: Map<string, number> = new Map()

  constructor() {
    // Documents/CHROMADON/ — visible, user-friendly, syncs with cloud backup
    const documentsDir = app.getPath('documents')
    this.rootDir = path.join(documentsDir, 'CHROMADON')
    this.screenshotDir = path.join(this.rootDir, 'screenshots')
    this.configDir = path.join(this.rootDir, 'config')
  }

  /**
   * Initialize directory structure and load config.
   * Called once on app startup.
   */
  async initialize(): Promise<void> {
    // Create directory tree
    this.ensureDir(this.rootDir)
    this.ensureDir(this.screenshotDir)
    this.ensureDir(this.configDir)

    // Load or create config
    const configPath = path.join(this.configDir, 'storage.json')
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8')
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
      } catch {
        this.config = { ...DEFAULT_CONFIG }
      }
    } else {
      fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8')
    }

    // Run cleanup in background (non-blocking)
    this.cleanup().catch(() => {})

    console.log(`[StorageManager] Initialized: ${this.rootDir}`)
  }

  /**
   * Save a screenshot to the organized directory structure.
   */
  async saveScreenshot(opts: SaveScreenshotOptions): Promise<ScreenshotInfo> {
    if (!this.config.enabled) {
      throw new Error('Screenshot storage is disabled')
    }

    const { buffer, sessionId, action, platform, url } = opts

    // Build directory path: screenshots/<date>/<platform>/session-<id>/
    const today = new Date().toISOString().slice(0, 10) // 2026-02-10
    const platformDir = platform || 'general'
    const sessionDir = `session-${sessionId.slice(0, 8)}`

    const targetDir = path.join(this.screenshotDir, today, platformDir, sessionDir)
    this.ensureDir(targetDir)

    // Get next sequence number for this session
    const counterKey = `${today}/${platformDir}/${sessionDir}`
    const seq = (this.sessionCounters.get(counterKey) || 0) + 1
    this.sessionCounters.set(counterKey, seq)

    // Build filename: 001-navigate.jpg
    const seqStr = String(seq).padStart(3, '0')
    const sanitizedAction = action.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30)
    const filename = `${seqStr}-${sanitizedAction}.jpg`
    const filePath = path.join(targetDir, filename)

    // Write the screenshot
    fs.writeFileSync(filePath, buffer)
    const fileSize = buffer.length

    // Update session metadata
    this.updateSessionMetadata(targetDir, {
      sessionId,
      platform: platformDir,
      seq,
      filename,
      action,
      url,
    })

    console.log(`[StorageManager] Saved: ${today}/${platformDir}/${sessionDir}/${filename} (${Math.round(fileSize / 1024)}KB)`)

    return { path: filePath, filename, size: fileSize }
  }

  /**
   * Clean up old screenshots based on retention policy.
   */
  async cleanup(): Promise<CleanupResult> {
    let deleted = 0
    let freedBytes = 0

    if (!fs.existsSync(this.screenshotDir)) {
      return { deleted: 0, freedMB: 0 }
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxDaysToKeep)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    // Delete date folders older than retention period
    const dateFolders = this.listDateFolders()
    for (const folder of dateFolders) {
      if (folder.name < cutoffStr) {
        const folderSize = this.getDirSize(folder.path)
        this.rmDir(folder.path)
        deleted++
        freedBytes += folderSize
      }
    }

    // If still over size limit, delete oldest remaining folders
    let totalSize = this.getTotalSize()
    const maxBytes = this.config.maxTotalSizeMB * 1024 * 1024
    const remainingFolders = this.listDateFolders()

    for (const folder of remainingFolders) {
      if (totalSize <= maxBytes) break
      const folderSize = this.getDirSize(folder.path)
      this.rmDir(folder.path)
      totalSize -= folderSize
      freedBytes += folderSize
      deleted++
    }

    if (deleted > 0) {
      console.log(`[StorageManager] Cleanup: removed ${deleted} folders, freed ${Math.round(freedBytes / 1024 / 1024)}MB`)
    }

    return { deleted, freedMB: Math.round(freedBytes / 1024 / 1024) }
  }

  /**
   * Get storage usage statistics.
   */
  async getStats(): Promise<StorageStats> {
    const totalBytes = this.getTotalSize()
    const dateFolders = this.listDateFolders()
    let screenshotCount = 0

    for (const folder of dateFolders) {
      screenshotCount += this.countFiles(folder.path, '.jpg')
    }

    return {
      totalMB: Math.round((totalBytes / 1024 / 1024) * 10) / 10,
      screenshotCount,
      oldestDate: dateFolders.length > 0 ? dateFolders[0].name : null,
      rootDir: this.rootDir,
    }
  }

  /**
   * Get the root directory path.
   */
  getRootDir(): string {
    return this.rootDir
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
  }

  private updateSessionMetadata(sessionDir: string, entry: {
    sessionId: string
    platform: string
    seq: number
    filename: string
    action: string
    url?: string
  }): void {
    const metaPath = path.join(sessionDir, 'session.json')
    let metadata: SessionMetadata

    if (fs.existsSync(metaPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      } catch {
        metadata = {
          sessionId: entry.sessionId,
          platform: entry.platform,
          startedAt: new Date().toISOString(),
          screenshots: [],
        }
      }
    } else {
      metadata = {
        sessionId: entry.sessionId,
        platform: entry.platform,
        startedAt: new Date().toISOString(),
        screenshots: [],
      }
    }

    metadata.screenshots.push({
      seq: entry.seq,
      file: entry.filename,
      action: entry.action,
      url: entry.url,
      ts: Date.now(),
    })

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8')
  }

  private listDateFolders(): Array<{ name: string; path: string }> {
    if (!fs.existsSync(this.screenshotDir)) return []

    return fs.readdirSync(this.screenshotDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map(d => ({ name: d.name, path: path.join(this.screenshotDir, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private getDirSize(dirPath: string): number {
    let total = 0
    if (!fs.existsSync(dirPath)) return 0

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += this.getDirSize(fullPath)
      } else {
        try {
          total += fs.statSync(fullPath).size
        } catch { /* skip */ }
      }
    }
    return total
  }

  private getTotalSize(): number {
    return this.getDirSize(this.screenshotDir)
  }

  private countFiles(dirPath: string, ext: string): number {
    let count = 0
    if (!fs.existsSync(dirPath)) return 0

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        count += this.countFiles(fullPath, ext)
      } else if (entry.name.endsWith(ext)) {
        count++
      }
    }
    return count
  }

  private rmDir(dirPath: string): void {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true })
    } catch {
      console.log(`[StorageManager] Warning: could not delete ${dirPath}`)
    }
  }
}
