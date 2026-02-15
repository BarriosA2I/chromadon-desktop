import { app, BrowserWindow, ipcMain, shell, clipboard, session, safeStorage, Menu, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import express from 'express'
import type { Request, Response } from 'express'
import * as fs from 'fs'
import { fork, ChildProcess } from 'child_process'
import { browserViewManager, TabInfo, Platform, SessionMode, PlatformSession } from './browser-view-manager'
import { vault, ChromadonProfile, StoredCredential } from './security/vault'
import { StorageManager } from './storage-manager'
import { sessionBackupManager } from './session-backup'

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
    cachedApiKey = key // Cache in memory for crash recovery
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
  // Return cached key if available (fast path, no disk I/O)
  if (cachedApiKey) return cachedApiKey

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
        cachedApiKey = key
        return key
      } else if (envelope.format === 'base64') {
        const key = Buffer.from(envelope.data, 'base64').toString('utf8')
        log(`loadApiKey: decoded OK (${key.slice(0, 10)}...${key.slice(-4)})`)
        cachedApiKey = key
        return key
      }
    }

    // Legacy: try old encrypted binary format (from previous version)
    log('loadApiKey: attempting legacy format...')
    const data = fs.readFileSync(keyPath)
    if (safeStorage.isEncryptionAvailable()) {
      const key = safeStorage.decryptString(data)
      log(`loadApiKey: legacy decrypt OK (${key.slice(0, 10)}...${key.slice(-4)})`)
      cachedApiKey = key
      return key
    }

    return null
  } catch (err: any) {
    log(`loadApiKey: ERROR - ${err.message}`)
    return null
  }
}

function deleteApiKey(): void {
  cachedApiKey = null
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

// ==================== GEMINI API KEY MANAGER ====================
const GEMINI_KEY_FILE = 'chromadon-gemini-key.json'
let cachedGeminiKey: string | null = null

function getGeminiKeyPath(): string {
  return path.join(app.getPath('userData'), GEMINI_KEY_FILE)
}

function storeGeminiKey(key: string): void {
  const keyPath = getGeminiKeyPath()
  const logFile = path.join(app.getPath('userData'), 'brain-debug.log')
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] [GeminiKey] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log('[GeminiKey]', msg)
  }

  try {
    cachedGeminiKey = key
    const useEncryption = safeStorage.isEncryptionAvailable()
    log(`storeGeminiKey: encryption=${useEncryption}, path=${keyPath}`)

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

    const verify = loadGeminiKey()
    if (verify && verify.startsWith('AIza')) {
      log(`storeGeminiKey: verified OK (${verify.slice(0, 8)}...${verify.slice(-4)})`)
    } else {
      log(`storeGeminiKey: WARNING - read-back verification failed!`)
    }
  } catch (err: any) {
    log(`storeGeminiKey: ERROR - ${err.message}`)
    throw err
  }
}

function loadGeminiKey(): string | null {
  if (cachedGeminiKey) return cachedGeminiKey

  const keyPath = getGeminiKeyPath()
  if (!fs.existsSync(keyPath)) return null

  const logFile = path.join(app.getPath('userData'), 'brain-debug.log')
  const log = (msg: string) => {
    const line = `[${new Date().toISOString()}] [GeminiKey] ${msg}\n`
    fs.appendFileSync(logFile, line)
    console.log('[GeminiKey]', msg)
  }

  try {
    const raw = fs.readFileSync(keyPath, 'utf8')
    if (raw.startsWith('{')) {
      const envelope = JSON.parse(raw)
      log(`loadGeminiKey: format=${envelope.format}, storedAt=${envelope.storedAt}`)

      if (envelope.format === 'dpapi') {
        const encrypted = Buffer.from(envelope.data, 'base64')
        const key = safeStorage.decryptString(encrypted)
        log(`loadGeminiKey: decrypted OK (${key.slice(0, 8)}...${key.slice(-4)})`)
        cachedGeminiKey = key
        return key
      } else if (envelope.format === 'base64') {
        const key = Buffer.from(envelope.data, 'base64').toString('utf8')
        log(`loadGeminiKey: decoded OK (${key.slice(0, 8)}...${key.slice(-4)})`)
        cachedGeminiKey = key
        return key
      }
    }
    return null
  } catch (err: any) {
    log(`loadGeminiKey: ERROR - ${err.message}`)
    return null
  }
}

function deleteGeminiKey(): void {
  cachedGeminiKey = null
  const keyPath = getGeminiKeyPath()
  if (fs.existsSync(keyPath)) {
    fs.unlinkSync(keyPath)
    console.log('[GeminiKey] Deleted:', keyPath)
  }
}

// Bundled Brain server child process
let brainProcess: ChildProcess | null = null
// In-memory API key cache — survives Brain crashes (only child process dies, not Electron)
let cachedApiKey: string | null = null
let brainRestarting = false
let brainRestartCount = 0
const BRAIN_MAX_RESTARTS = 10

// Health-check-triggered restart tracking (separate from crash restarts)
let healthRestartCount = 0
const MAX_HEALTH_RESTARTS = 3
let lastHealthRestart = 0
const HEALTH_RESTART_COOLDOWN = 60_000 // 1 minute between health-triggered restarts
let healthUnreachableCount = 0 // Consecutive health check failures (zombie detection)

// Crash alert via Resend.com — notify Gary when a client's brain is down
const CRASH_ALERT_EMAIL = 'alienation2innovation@gmail.com'
const RESEND_API_KEY = 're_gbm8Sa3y_6DmCfT99mF8i9QgKk7oY2Ges'

async function sendCrashAlert(exitCode: number | null, signal: string | null, restartAttempts: number): Promise<void> {
  if (!RESEND_API_KEY) return
  try {
    const hostname = require('os').hostname()
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CHROMADON Alerts <onboarding@resend.dev>',
        to: CRASH_ALERT_EMAIL,
        subject: `CHROMADON Brain DOWN - ${hostname}`,
        html: `<h2>CHROMADON Brain Crash Report</h2>
          <p><b>Machine:</b> ${hostname}</p>
          <p><b>Exit Code:</b> ${exitCode}</p>
          <p><b>Signal:</b> ${signal || 'none'}</p>
          <p><b>Restart Attempts:</b> ${restartAttempts}/${BRAIN_MAX_RESTARTS}</p>
          <p><b>Time:</b> ${new Date().toISOString()}</p>
          <p><b>App Version:</b> ${app.getVersion()}</p>
          <p>The brain process has exhausted all restart attempts.</p>`,
      }),
    })
    console.log('[Desktop] Crash alert email sent to ' + CRASH_ALERT_EMAIL)
  } catch (err: any) {
    console.log('[Desktop] Failed to send crash alert: ' + (err as Error).message)
  }
}

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
    brainRestarting = false
    return
  }

  // Resolve API keys: parameter > stored > env (blank)
  const resolvedKey = apiKey || loadApiKey() || ''
  const resolvedGeminiKey = loadGeminiKey() || ''
  log(`Starting bundled Brain server... (Anthropic key ${resolvedKey ? 'provided' : 'NOT set'}, Gemini key ${resolvedGeminiKey ? 'provided' : 'NOT set'})`)

  // Kill any stale Brain process from a previous crash (EADDRINUSE prevention)
  try {
    const { execSync } = require('child_process')
    const output = execSync('netstat -ano | findstr :3001 | findstr LISTENING', { encoding: 'utf8', timeout: 3000 })
    const lines = output.trim().split('\n')
    for (const line of lines) {
      const pid = line.trim().split(/\s+/).pop()
      if (pid && pid !== '0' && parseInt(pid) !== process.pid) {
        log(`Found stale process PID ${pid} on port 3001 — killing it`)
        try { execSync(`taskkill /PID ${pid} /F`, { timeout: 3000 }) } catch {}
      }
    }
  } catch {
    // No process on port 3001 — good, proceed normally
  }

  try {
    brainProcess = fork(brainEntry, [], {
      cwd: brainDir,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        CHROMADON_PORT: '3001',
        CHROMADON_DESKTOP_URL: 'http://127.0.0.1:3002',
        CHROMADON_DATA_DIR: app.getPath('userData'),
        PREFER_DESKTOP: 'true',
        NODE_ENV: 'production',
        ...(resolvedKey ? { ANTHROPIC_API_KEY: resolvedKey } : {}),
        ...(resolvedGeminiKey ? { GEMINI_API_KEY: resolvedGeminiKey } : {}),
        // OBS Studio WebSocket connection
        OBS_WS_HOST: process.env.OBS_WS_HOST || '127.0.0.1',
        OBS_WS_PORT: process.env.OBS_WS_PORT || '4455',
        OBS_WS_PASSWORD: process.env.OBS_WS_PASSWORD || '',
        OBS_SAFE_MODE: process.env.OBS_SAFE_MODE || 'true',
        OBS_SAFE_SCENES: process.env.OBS_SAFE_SCENES || 'StartingSoon,Main',
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    log(`fork() succeeded, pid=${brainProcess.pid}`)
    brainRestarting = false
    brainRestartCount = 0
  } catch (err: any) {
    log(`fork() FAILED: ${err.message}`)
    brainRestarting = false
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
    brainProcess = null
    brainRestarting = false
    // Treat like a crash — restart with backoff
    brainRestartCount++
    if (brainRestartCount <= BRAIN_MAX_RESTARTS) {
      const backoffDelay = Math.min(3000 * Math.pow(2, brainRestartCount - 1), 30000)
      log(`Process error restart in ${backoffDelay / 1000}s (attempt ${brainRestartCount}/${BRAIN_MAX_RESTARTS})`)
      setTimeout(() => startBrainServer(cachedApiKey || undefined), backoffDelay)
    }
  })

  brainProcess.on('exit', (code, signal) => {
    log(`Exited: code=${code} signal=${signal}`)
    brainProcess = null
    brainRestarting = false // Always reset — process has exited
    // Auto-restart on crash (not on clean shutdown), with limit to prevent infinite loops
    if (code !== 0 && code !== null) {
      brainRestartCount++
      // Notify UI of crash status
      mainWindow?.webContents.send('brain-status', {
        running: false,
        restarting: brainRestartCount <= BRAIN_MAX_RESTARTS,
        attempt: brainRestartCount,
        maxAttempts: BRAIN_MAX_RESTARTS,
        error: `Brain crashed (exit code ${code}). ${brainRestartCount <= BRAIN_MAX_RESTARTS ? 'Restarting...' : 'Check logs.'}`,
      })
      if (brainRestartCount <= BRAIN_MAX_RESTARTS) {
        // Exponential backoff: 3s, 6s, 12s, 24s, 30s (capped), ...
        const backoffDelay = Math.min(3000 * Math.pow(2, brainRestartCount - 1), 30000)
        log(`Restarting in ${backoffDelay / 1000}s (attempt ${brainRestartCount}/${BRAIN_MAX_RESTARTS})... (Anthropic key: ${cachedApiKey ? 'YES' : 'NO'}, Gemini key: ${cachedGeminiKey ? 'YES' : 'NO'})`)
        setTimeout(() => startBrainServer(cachedApiKey || undefined), backoffDelay)
      } else {
        log(`Brain crashed ${brainRestartCount} times — giving up. Check brain-debug.log for errors.`)
        sendCrashAlert(code, signal, brainRestartCount)
      }
    } else {
      // Clean exit (code 0) or signal kill — notify UI
      mainWindow?.webContents.send('brain-status', { running: false, error: null })
    }
  })

  // Verify Brain HTTP server actually starts listening (async, non-blocking)
  ;(async () => {
    let verified = false
    for (let i = 0; i < 25; i++) { // 25 attempts × 1s = 25s max wait
      if (!brainProcess) break // Process already exited
      await new Promise(r => setTimeout(r, 1000))
      try {
        const res = await fetch('http://127.0.0.1:3001/health', { signal: AbortSignal.timeout(2000) })
        if (res.ok) {
          const data = await res.json() as any
          verified = true
          log(`Brain HTTP server verified (orchestrator: ${data.orchestrator})`)
          mainWindow?.webContents.send('brain-status', {
            running: true,
            orchestrator: data.orchestrator,
            error: data.orchestratorError || null,
          })
          break
        }
      } catch { /* still starting */ }
    }
    if (!verified && brainProcess) {
      log('Brain fork succeeded but HTTP server never started (25s timeout) — killing zombie')
      try { brainProcess.kill('SIGKILL') } catch {}
      brainProcess = null
      // Trigger restart via crash path
      brainRestartCount++
      if (brainRestartCount <= BRAIN_MAX_RESTARTS) {
        const backoffDelay = Math.min(3000 * Math.pow(2, brainRestartCount - 1), 30000)
        log(`Zombie killed — restarting in ${backoffDelay / 1000}s (attempt ${brainRestartCount}/${BRAIN_MAX_RESTARTS})`)
        setTimeout(() => startBrainServer(cachedApiKey || undefined), backoffDelay)
      } else {
        log(`Brain zombie killed but restart limit reached (${brainRestartCount}/${BRAIN_MAX_RESTARTS})`)
        mainWindow?.webContents.send('brain-status', {
          running: false,
          error: 'Brain failed to start after multiple attempts. Check brain-debug.log.',
        })
      }
    }
  })()
}

function restartBrainServer(apiKey?: string): void {
  if (brainRestarting) return // Prevent concurrent restarts
  brainRestarting = true
  console.log('[Desktop] Restarting Brain server with updated API key...')
  if (brainProcess) {
    let started = false
    brainProcess.removeAllListeners('exit')
    brainProcess.on('exit', () => {
      brainProcess = null
      if (!started) {
        started = true
        startBrainServer(apiKey)
      }
    })
    brainProcess.kill('SIGTERM')
    // Force kill after 5 seconds if it doesn't exit gracefully
    setTimeout(() => {
      if (brainProcess) {
        brainProcess.kill('SIGKILL')
        brainProcess = null
      }
      if (!started) {
        started = true
        startBrainServer(apiKey)
      }
    }, 5000)
  } else {
    startBrainServer(apiKey)
  }
}

// Periodic health check: detect if Brain lost orchestrator and re-inject API key
let brainHealthInterval: NodeJS.Timeout | null = null

function startBrainHealthCheck(): void {
  if (brainHealthInterval) clearInterval(brainHealthInterval)
  brainHealthInterval = setInterval(async () => {
    if (!brainProcess) return
    // Support Gemini-only clients (cachedApiKey is Anthropic only)
    const hasAnyKey = cachedApiKey || cachedGeminiKey
    if (!hasAnyKey) return
    try {
      const res = await fetch('http://127.0.0.1:3001/health', { signal: AbortSignal.timeout(5000) })
      const data = await res.json() as any
      healthUnreachableCount = 0 // Reset — Brain is reachable
      if (!data.orchestrator && hasAnyKey) {
        // Cooldown: don't restart more than once per minute
        const now = Date.now()
        if (now - lastHealthRestart < HEALTH_RESTART_COOLDOWN) return
        // Max health-triggered restarts per session
        if (healthRestartCount >= MAX_HEALTH_RESTARTS) {
          console.log(`[Desktop] Brain health-restart limit reached (${MAX_HEALTH_RESTARTS}) — showing error to user`)
          mainWindow?.webContents.send('brain-status', {
            running: false,
            error: data.orchestratorError
              ? `Brain failed to start: ${data.orchestratorError}`
              : 'Brain failed to initialize. Check your API key in Settings.',
          })
          return
        }
        healthRestartCount++
        lastHealthRestart = now
        console.log(`[Desktop] Brain lost orchestrator — health restart ${healthRestartCount}/${MAX_HEALTH_RESTARTS}`)
        restartBrainServer(cachedApiKey || undefined)
      }
    } catch {
      // Brain unreachable — detect zombie process and kill/restart
      healthUnreachableCount++
      if (healthUnreachableCount >= 3 && brainProcess) {
        console.log(`[Desktop] Brain unreachable for ${healthUnreachableCount} consecutive checks — killing zombie process`)
        try { brainProcess.kill('SIGKILL') } catch {}
        brainProcess = null
        healthUnreachableCount = 0
        // Trigger restart if within limits
        if (healthRestartCount < MAX_HEALTH_RESTARTS) {
          healthRestartCount++
          lastHealthRestart = Date.now()
          console.log(`[Desktop] Zombie killed — restarting Brain (health restart ${healthRestartCount}/${MAX_HEALTH_RESTARTS})`)
          setTimeout(() => startBrainServer(cachedApiKey || undefined), 3000)
        } else {
          console.log(`[Desktop] Zombie killed but health-restart limit reached — showing error`)
          mainWindow?.webContents.send('brain-status', {
            running: false,
            error: 'Brain process is unresponsive. Please restart the application.',
          })
        }
      }
    }
  }, 30_000)
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
  status: 'queued' | 'running' | 'completed' | 'failed' | 'scheduled'
  result?: any
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  tabId?: number
  // Scheduling
  scheduledTime?: string
  recurrence?: { type: 'none' | 'daily' | 'weekly' | 'custom'; intervalMs?: number; endAfter?: number; occurrenceCount?: number }
  // Cross-posting
  batchId?: string
  hashtags?: string[]
  // Media attachments
  mediaUrls?: string[]
  // Analytics linkage
  analyticsPostId?: number
}

// Queue persistence
const QUEUE_FILE = 'marketing-queue.json'

function getQueuePath(): string {
  return path.join(app.getPath('userData'), QUEUE_FILE)
}

function saveQueue(): void {
  try {
    fs.writeFileSync(getQueuePath(), JSON.stringify(marketingQueue, null, 2), 'utf8')
  } catch (err) {
    console.error('[Queue] Save failed:', err)
  }
}

function loadQueue(): MarketingTask[] {
  try {
    const queuePath = getQueuePath()
    if (!fs.existsSync(queuePath)) return []
    const raw = fs.readFileSync(queuePath, 'utf8')
    const tasks = JSON.parse(raw) as MarketingTask[]
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return tasks
      .filter(t => !((t.status === 'completed' || t.status === 'failed') && t.completedAt && t.completedAt < sevenDaysAgo))
      .map(t => t.status === 'running' ? { ...t, status: 'queued' as const } : t)
  } catch (err) {
    console.error('[Queue] Load failed:', err)
    return []
  }
}

// Marketing queue state
let marketingQueue: MarketingTask[] = loadQueue()
let activeTasksByPlatform: Map<Platform, MarketingTask> = new Map()

let mainWindow: BrowserWindow | null = null
const CONTROL_PORT = 3002

// ==================== AUTO-UPDATER ====================
// Cache update state so renderer can query on mount (solves race condition)
let updaterState: {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error'
  version?: string
  releaseDate?: string
  percent?: number
  error?: string
} = { status: 'idle' }

function initAutoUpdater() {
  // Always register IPC handlers (even in dev) so renderer doesn't throw
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('updater:getStatus', () => updaterState)
  ipcMain.handle('updater:checkForUpdates', async () => {
    if (!app.isPackaged) return { success: false, error: 'Updates disabled in dev mode' }
    try {
      const result = await autoUpdater.checkForUpdates()
      return { success: true, version: result?.updateInfo?.version }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  if (!app.isPackaged) {
    console.log('[AutoUpdate] Skipping - dev mode')
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdate] Checking for update...')
    updaterState = { status: 'checking' }
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`[AutoUpdate] Update available: v${info.version}`)
    updaterState = { status: 'available', version: info.version, releaseDate: info.releaseDate }
    mainWindow?.webContents.send('updater:update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdate] Already on latest version')
    updaterState = { status: 'idle' }
    mainWindow?.webContents.send('updater:update-not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdate] Download: ${Math.round(progress.percent)}%`)
    updaterState = { ...updaterState, status: 'downloading', percent: Math.round(progress.percent) }
    mainWindow?.webContents.send('updater:download-progress', {
      percent: Math.round(progress.percent),
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[AutoUpdate] Downloaded v${info.version} - ready to install`)
    updaterState = { status: 'downloaded', version: info.version, releaseDate: info.releaseDate }
    mainWindow?.webContents.send('updater:update-downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
    })

    // Show native dialog so the user can't miss the update
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'CHROMADON Update Ready',
      message: `Version ${info.version} has been downloaded.`,
      detail: 'Restart now to apply the update. Your sessions will be preserved.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
    }).then((result: { response: number }) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdate] Error:', err.message)
    updaterState = { status: 'error', error: err.message }
    mainWindow?.webContents.send('updater:error', { message: err.message })
  })

  // Wait for renderer to be ready, then check for updates
  mainWindow?.webContents.on('did-finish-load', () => {
    console.log('[AutoUpdate] Renderer loaded — checking for updates...')
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdate] Check failed:', err.message)
      mainWindow?.webContents.send('updater:error', { message: err.message })
    })
  })

  // Also check periodically (every 1 hour)
  setInterval(() => {
    console.log('[AutoUpdate] Periodic check...')
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[AutoUpdate] Periodic check failed:', err.message)
    })
  }, 1 * 60 * 60 * 1000)
}

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
    icon: app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'icon.png')
      : path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    show: false, // Don't show until ready
  })

  // Enable Ctrl+C/V/X/A keyboard shortcuts (frameless window has no default menu)
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ]))

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

// Track user activity for social monitoring idle detection
let lastUserActivity = Date.now()
let isProcessingChat = false

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

  // Send a message through the AI chat panel
  server.post('/chat/send', async (req: Request, res: Response) => {
    try {
      const { text } = req.body
      if (!text || typeof text !== 'string') {
        res.status(400).json({ success: false, error: 'text is required' })
        return
      }
      if (!mainWindow) {
        res.status(503).json({ success: false, error: 'Window not ready' })
        return
      }

      // Track user activity for social monitoring
      lastUserActivity = Date.now()
      isProcessingChat = true

      // Dispatch the same CustomEvent that ChatPanel.tsx listens for
      await mainWindow.webContents.executeJavaScript(`
        window.dispatchEvent(new CustomEvent('chromadon-chat-submit', {
          detail: { text: ${JSON.stringify(text)} }
        }));
        true;
      `)

      // Clear processing flag after a short delay (message queued, not fully processed yet)
      setTimeout(() => { isProcessingChat = false }, 30000)

      res.json({ success: true, message: 'Chat message sent', text: text.slice(0, 100) })
    } catch (error) {
      isProcessingChat = false
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Social monitoring idle status (Brain checks this before monitoring cycles)
  server.get('/monitoring/idle-status', (_req: Request, res: Response) => {
    const idleMs = Date.now() - lastUserActivity
    res.json({ idleMs, isProcessing: isProcessingChat })
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

  // ════════════════════════════════════════════════════════════
  // SHARED: Native click via Electron sendInputEvent
  // Uses real OS-level mouse events — works on ALL frameworks
  // (Polymer, React, Angular, Shadow DOM, etc.)
  // ════════════════════════════════════════════════════════════
  async function nativeClick(view: any, x: number, y: number) {
    const wc = view.webContents || view
    wc.sendInputEvent({ type: 'mouseMove', x, y } as any)
    await new Promise(r => setTimeout(r, 30))
    wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 } as any)
    await new Promise(r => setTimeout(r, 50))
    wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 } as any)
    await new Promise(r => setTimeout(r, 100))
  }

  // ════════════════════════════════════════════════════════════
  // SHARED: Deep search script injected into pages
  // Pierces Shadow DOM for querySelector and text-based search
  // ════════════════════════════════════════════════════════════
  const DEEP_SEARCH_SCRIPT = `
(function() {
  window.deepQuerySelector = function(selector, root) {
    root = root || document;
    try {
      var result = root.querySelector(selector);
      if (result) return result;
    } catch(e) {}
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = window.deepQuerySelector(selector, all[i].shadowRoot);
        if (found) return found;
      }
    }
    return null;
  };

  window.deepFindByText = function(searchText, root) {
    root = root || document;
    var results = [];
    var tags = 'a,button,span,div,li,td,th,label,h1,h2,h3,h4,p,' +
      '[role="tab"],[role="button"],[role="link"],[role="menuitem"],[role="option"],[role="checkbox"],' +
      'tp-yt-paper-tab,ytcp-button,tp-yt-paper-item,ytcp-checkbox-lit,yt-formatted-string,' +
      'tp-yt-paper-radio-button,ytcp-dropdown-trigger,[tabindex]';

    function search(node) {
      var els;
      try { els = node.querySelectorAll(tags); } catch(e) { return; }
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        // Get DIRECT text content (not nested children's text)
        var text = '';
        for (var c = 0; c < el.childNodes.length; c++) {
          if (el.childNodes[c].nodeType === 3) text += el.childNodes[c].textContent;
        }
        text = text.trim();
        // Fallback to full textContent for short elements
        if (!text) text = (el.textContent || '').trim();

        var searchLower = searchText.toLowerCase();
        if (text && (text === searchText || text.toLowerCase() === searchLower ||
            text.toLowerCase().indexOf(searchLower) >= 0)) {
          try {
            var rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top >= -10 && rect.top < window.innerHeight + 100) {
              results.push({
                el: el, rect: rect, text: text.substring(0, 80),
                tagName: el.tagName, exact: text === searchText || text.toLowerCase() === searchLower
              });
            }
          } catch(e) {}
        }
        // Recurse into shadow roots
        if (el.shadowRoot) search(el.shadowRoot);
      }
      // Also check shadow roots of all elements
      try {
        var allEls = node.querySelectorAll('*');
        for (var j = 0; j < allEls.length; j++) {
          if (allEls[j].shadowRoot) search(allEls[j].shadowRoot);
        }
      } catch(e) {}
    }
    search(root);
    return results;
  };

  window.deepFindLinks = function(pattern, root) {
    root = root || document;
    var links = [];
    function search(node) {
      try {
        var anchors = node.querySelectorAll('a[href]');
        for (var i = 0; i < anchors.length; i++) {
          if (anchors[i].href && anchors[i].href.match(pattern)) {
            var rect = anchors[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              links.push({ el: anchors[i], rect: rect, href: anchors[i].href, text: (anchors[i].textContent||'').trim().substring(0,80) });
            }
          }
        }
        var allEls = node.querySelectorAll('*');
        for (var j = 0; j < allEls.length; j++) {
          if (allEls[j].shadowRoot) search(allEls[j].shadowRoot);
        }
      } catch(e) {}
    }
    search(root);
    return links;
  };
})();
`

  // ════════════════════════════════════════════════════════════
  // CLICK — Shadow DOM piercing + native sendInputEvent
  // No dispatchEvent (causes double-click on Polymer/YouTube)
  // ════════════════════════════════════════════════════════════
  server.post('/tabs/click', async (req: Request, res: Response) => {
    try {
      const { id, selector, text } = req.body
      if (id === undefined || (!selector && !text)) {
        res.status(400).json({ success: false, error: 'click requires either selector or text' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view || view.webContents.isDestroyed()) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      // Inject deep search utilities (always re-inject, no guard)
      await view.webContents.executeJavaScript(DEEP_SEARCH_SCRIPT).catch((e: any) => {
        console.error('[CHROMADON] DEEP_SEARCH_SCRIPT injection failed:', e?.message || e)
      })

      // Helper: executeJavaScript with 5s timeout to prevent hanging
      const execWithTimeout = (script: string, label: string) =>
        Promise.race([
          view.webContents.executeJavaScript(script),
          new Promise<null>(resolve => setTimeout(() => {
            console.log(`[CHROMADON] ${label} timed out after 5s`)
            resolve(null)
          }, 5000))
        ]).catch((e: any) => {
          console.log(`[CHROMADON] ${label} error: ${e?.message || e}`)
          return null
        })

      // ── Strategy 1: CSS Selector (light + shadow DOM) ──
      if (selector) {
        const result = await execWithTimeout(`
          (function() {
            var sel = ${JSON.stringify(selector)};
            var el = document.querySelector(sel) || window.deepQuerySelector(sel);
            if (!el) return null;
            el.scrollIntoView({block:'center'});
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return null;
            return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), tag: el.tagName, text: (el.textContent||'').trim().substring(0,50) };
          })()
        `, 'Strategy1:css_deep')

        if (result) {
          await nativeClick(view, result.x, result.y)
          console.log(`[CHROMADON] Click: "${selector}" → css_deep (${result.tag}:${result.text})`)
          return res.json({ success: true, result: `clicked_css_deep:${result.tag}:${result.text}`, strategy: 'css_deep' })
        }
      }

      // ── Strategy 2: Text match (light + shadow DOM, direct text nodes) ──
      if (text) {
        const result = await execWithTimeout(`
          (function() {
            if (typeof window.deepFindByText !== 'function') return { error: 'deepFindByText not injected' };
            var matches = window.deepFindByText(${JSON.stringify(text)});
            if (matches.length === 0) return null;
            matches.sort(function(a,b) {
              if (a.exact && !b.exact) return -1;
              if (b.exact && !a.exact) return 1;
              var interactive = ['A','BUTTON','TP-YT-PAPER-TAB','YTCP-BUTTON','TP-YT-PAPER-ITEM','YTCP-CHECKBOX-LIT','TP-YT-PAPER-RADIO-BUTTON'];
              var aI = interactive.indexOf(a.tagName) >= 0 || (a.el && a.el.getAttribute && a.el.getAttribute('role'));
              var bI = interactive.indexOf(b.tagName) >= 0 || (b.el && b.el.getAttribute && b.el.getAttribute('role'));
              if (aI && !bI) return -1;
              if (bI && !aI) return 1;
              return a.text.length - b.text.length;
            });
            var t = matches[0];
            if (t.el && t.el.scrollIntoView) t.el.scrollIntoView({block:'center'});
            var rect = t.el ? t.el.getBoundingClientRect() : t.rect;
            return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), tag: t.tagName, text: t.text, candidates: matches.length, exact: t.exact };
          })()
        `, 'Strategy2:text_deep')

        if (result && !result.error) {
          await nativeClick(view, result.x, result.y)
          console.log(`[CHROMADON] Click: "${text}" → text_deep (${result.tag}:${result.text}) [${result.candidates} candidates, exact=${result.exact}]`)
          return res.json({ success: true, result: `clicked_text_deep:${result.tag}:${result.text}`, strategy: 'text_deep', candidates: result.candidates })
        }
        if (result?.error) {
          console.log(`[CHROMADON] Strategy2 skipped: ${result.error}`)
        }
      }

      // ── Strategy 3: data-testid shortcuts (Twitter/X) ──
      if (text) {
        const testIdMap: Record<string, string> = {
          'Post': '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
          'Reply': '[data-testid="tweetReplyButton"]',
          'Tweet': '[data-testid="tweetButton"]',
        }
        const testIdSelector = testIdMap[text]
        if (testIdSelector) {
          const result = await execWithTimeout(`
            (function() {
              var selectors = ${JSON.stringify(testIdSelector)}.split(', ');
              for (var i = 0; i < selectors.length; i++) {
                var el = document.querySelector(selectors[i]) || window.deepQuerySelector(selectors[i]);
                if (el) {
                  el.scrollIntoView({block:'center'});
                  var rect = el.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), tag: el.tagName };
                  }
                }
              }
              return null;
            })()
          `, 'Strategy3:testid')

          if (result) {
            await nativeClick(view, result.x, result.y)
            console.log(`[CHROMADON] Click: "${text}" → testid (${result.tag})`)
            return res.json({ success: true, result: `clicked_testid:${text}`, strategy: 'testid' })
          }
        }
      }

      // ── Strategy 4: Partial text match on interactive elements (self-contained shadow DOM search) ──
      if (text) {
        const result = await execWithTimeout(`
          (function() {
            var searchLower = ${JSON.stringify(text)}.toLowerCase();
            var tags = 'button,[role="button"],[role="tab"],[role="link"],a,input[type="submit"],[tabindex],tp-yt-paper-tab,tp-yt-paper-item,ytcp-button,ytcp-checkbox-lit,yt-formatted-string';
            function searchPartial(node) {
              var els;
              try { els = node.querySelectorAll(tags); } catch(e) { return null; }
              for (var i = 0; i < els.length; i++) {
                var t = (els[i].textContent || '').trim();
                if (t.toLowerCase().indexOf(searchLower) >= 0) {
                  var rect = els[i].getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    els[i].scrollIntoView({block:'center'});
                    rect = els[i].getBoundingClientRect();
                    return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), tag: els[i].tagName, text: t.substring(0,50) };
                  }
                }
                if (els[i].shadowRoot) {
                  var found = searchPartial(els[i].shadowRoot);
                  if (found) return found;
                }
              }
              var allEls;
              try { allEls = node.querySelectorAll('*'); } catch(e) { return null; }
              for (var j = 0; j < allEls.length; j++) {
                if (allEls[j].shadowRoot) {
                  var found = searchPartial(allEls[j].shadowRoot);
                  if (found) return found;
                }
              }
              return null;
            }
            return searchPartial(document);
          })()
        `, 'Strategy4:partial_text')

        if (result) {
          await nativeClick(view, result.x, result.y)
          console.log(`[CHROMADON] Click: "${text}" → partial_text (${result.tag}:${result.text})`)
          return res.json({ success: true, result: `clicked_partial:${result.tag}:${result.text}`, strategy: 'partial_text' })
        }
      }

      console.log(`[CHROMADON] Click FAILED: "${selector || text}" — all 4 strategies exhausted (css_deep, text_deep, testid, partial_text)`)
      res.status(404).json({
        success: false,
        error: `Element not found (searched light DOM + shadow DOM): ${text || selector}`,
        hint: 'Try using get_interactive_elements to see what elements are actually on the page'
      })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Hover over element with Shadow DOM piercing + sendInputEvent (real mouse)
  server.post('/tabs/hover', async (req: Request, res: Response) => {
    try {
      const { id, selector, text } = req.body
      if (id === undefined || (!selector && !text)) {
        res.status(400).json({ success: false, error: 'id and (selector or text) are required' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view || view.webContents.isDestroyed()) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      // Inject deep search utilities (always re-inject, no guard)
      await view.webContents.executeJavaScript(DEEP_SEARCH_SCRIPT).catch((e: any) => {
        console.error('[CHROMADON] DEEP_SEARCH_SCRIPT injection failed:', e?.message || e)
      })

      const coords = await view.webContents.executeJavaScript(`
        (function() {
          var el = null;
          ${selector ? `el = document.querySelector(${JSON.stringify(selector)}) || window.deepQuerySelector(${JSON.stringify(selector)});` : ''}
          ${text ? `if (!el) { var m = window.deepFindByText(${JSON.stringify(text)}); if (m.length) { m.sort(function(a,b) { if (a.exact && !b.exact) return -1; if (b.exact && !a.exact) return 1; return a.text.length - b.text.length; }); el = m[0].el; } }` : ''}
          if (!el) return null;
          el.scrollIntoView({block:'center'});
          var rect = el.getBoundingClientRect();
          if (rect.width === 0) return null;
          return { x: Math.round(rect.left + rect.width/2), y: Math.round(rect.top + rect.height/2), tag: el.tagName, text: (el.textContent || '').trim().slice(0, 50) };
        })()
      `).catch(() => null)

      if (!coords) {
        res.json({ success: false, error: `Hover target not found: ${selector || text}` })
        return
      }

      const wc = view.webContents
      wc.sendInputEvent({ type: 'mouseMove', x: coords.x, y: coords.y } as any)
      await new Promise(r => setTimeout(r, 400))
      wc.sendInputEvent({ type: 'mouseMove', x: coords.x + 1, y: coords.y } as any)
      await new Promise(r => setTimeout(r, 200))

      console.log(`[CHROMADON] Hover: "${selector || text}" → (${coords.x}, ${coords.y}) ${coords.tag}`)
      res.json({ success: true, result: `Hovered over ${coords.tag}:${coords.text} at (${coords.x},${coords.y}). Tooltip should be visible.` })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Combined hover → wait → click tooltip button (single round trip, prevents rate limiting)
  server.post('/tabs/hover-and-click', async (req: Request, res: Response) => {
    try {
      const { id, hoverSelector, hoverText, clickText, waitMs } = req.body
      if (id === undefined || (!hoverSelector && !hoverText) || !clickText) {
        res.status(400).json({ success: false, error: 'id, (hoverSelector or hoverText), and clickText are required' })
        return
      }

      const view = browserViewManager.getView(id)
      if (!view || view.webContents.isDestroyed()) {
        res.status(404).json({ success: false, error: `Tab ${id} not found` })
        return
      }

      const hoverTarget = hoverSelector || hoverText

      // Step 1: Find hover target (piercing Shadow DOM)
      const hoverCoords = await view.webContents.executeJavaScript(`
        (function() {
          var target = ${JSON.stringify(hoverTarget)};
          function deepQuery(sel, root) {
            if (!root) root = document;
            try { var r = root.querySelector(sel); if (r) return r; } catch(e) {}
            var all = root.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              if (all[i].shadowRoot) { var f = deepQuery(sel, all[i].shadowRoot); if (f) return f; }
            }
            return null;
          }
          function deepFindByText(searchText, root) {
            if (!root) root = document;
            var results = [];
            function search(node) {
              var els = node.querySelectorAll('*');
              for (var i = 0; i < els.length; i++) {
                var t = (els[i].textContent || '').trim();
                if (t === searchText || t.toLowerCase() === searchText.toLowerCase()) {
                  var rect = els[i].getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) results.push(els[i]);
                }
                if (els[i].shadowRoot) search(els[i].shadowRoot);
              }
            }
            search(root);
            return results;
          }
          var el = null;
          try { el = document.querySelector(target); } catch(e) {}
          if (!el) el = deepQuery(target);
          if (!el) {
            var matches = deepFindByText(target);
            if (matches.length > 0) el = matches[0];
          }
          if (!el) return null;
          el.scrollIntoView({block:'center'});
          var rect = el.getBoundingClientRect();
          return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
        })()
      `)

      if (!hoverCoords) {
        res.json({ success: false, error: `Hover target not found: ${hoverTarget}` })
        return
      }

      // Step 2: Hover using real mouse event
      view.webContents.sendInputEvent({ type: 'mouseMove', x: hoverCoords.x, y: hoverCoords.y })
      await new Promise(resolve => setTimeout(resolve, waitMs || 800))
      view.webContents.sendInputEvent({ type: 'mouseMove', x: hoverCoords.x + 1, y: hoverCoords.y })
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 3: Find click target in tooltip (piercing Shadow DOM)
      const clickCoords = await view.webContents.executeJavaScript(`
        (function() {
          var searchText = ${JSON.stringify(clickText)};
          var hoverX = ${hoverCoords.x}, hoverY = ${hoverCoords.y};
          var results = [];
          function search(node) {
            var els = node.querySelectorAll('a, button, [role="button"], [role="link"], span, div');
            for (var i = 0; i < els.length; i++) {
              var t = (els[i].textContent || '').trim();
              if (t === searchText || t.toLowerCase() === searchText.toLowerCase()) {
                var rect = els[i].getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
                  var dist = Math.abs(rect.top - hoverY) + Math.abs(rect.left - hoverX);
                  results.push({ x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2), tag: els[i].tagName, text: t, dist: dist });
                }
              }
              if (els[i].shadowRoot) search(els[i].shadowRoot);
            }
            var allEls = node.querySelectorAll('*');
            for (var j = 0; j < allEls.length; j++) {
              if (allEls[j].shadowRoot) search(allEls[j].shadowRoot);
            }
          }
          search(document);
          if (results.length === 0) return null;
          results.sort(function(a, b) { return a.dist - b.dist; });
          return results[0];
        })()
      `)

      if (!clickCoords) {
        res.json({ success: false, error: `Tooltip appeared but "${clickText}" not found inside it. Tooltip may have disappeared or uses different text.`, hoverSucceeded: true })
        return
      }

      // Step 4: Click inside tooltip using sendInputEvent (keeps mouse in tooltip area)
      view.webContents.sendInputEvent({ type: 'mouseMove', x: clickCoords.x, y: clickCoords.y })
      await new Promise(resolve => setTimeout(resolve, 50))
      view.webContents.sendInputEvent({ type: 'mouseDown', x: clickCoords.x, y: clickCoords.y, button: 'left', clickCount: 1 })
      await new Promise(resolve => setTimeout(resolve, 50))
      view.webContents.sendInputEvent({ type: 'mouseUp', x: clickCoords.x, y: clickCoords.y, button: 'left', clickCount: 1 })

      console.log(`[CHROMADON] Hover+Click: hovered (${hoverCoords.x},${hoverCoords.y}) → clicked "${clickCoords.text}" at (${clickCoords.x},${clickCoords.y})`)
      res.json({
        success: true,
        result: `Hovered, then clicked "${clickCoords.text}" (${clickCoords.tag}) inside tooltip`,
        hoverCoords,
        clickCoords: { x: clickCoords.x, y: clickCoords.y },
        clickedText: clickCoords.text,
      })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Extract all video IDs from a YouTube Studio content page
  server.post('/tabs/get-video-ids', async (req: Request, res: Response) => {
    try {
      const { id } = req.body
      const tabId = id !== undefined ? id : browserViewManager.getActiveTabId()
      const view = browserViewManager.getView(tabId)
      if (!view) { res.status(404).json({ success: false, error: 'Tab not found' }); return }

      const result = await view.webContents.executeJavaScript(`
        (function() {
          var ids = [];
          var seen = {};

          // Find the closest row container for a video link
          function getRow(el) {
            var node = el;
            for (var i = 0; i < 15 && node; i++) {
              if (node.tagName === 'YTCP-VIDEO-ROW' || node.tagName === 'TR' ||
                  (node.getAttribute && (node.getAttribute('class') || '').match(/video-row|row-container/i))) {
                return node;
              }
              node = node.parentElement || (node.getRootNode && node.getRootNode().host) || null;
            }
            return null;
          }

          // Check if a row has a copyright/warning indicator
          function hasCopyrightFlag(row) {
            if (!row) return false;
            var html = row.innerHTML || '';
            // Check for warning icons, copyright text, restriction indicators
            if (html.match(/copyright|claim|warning|restriction|⚠/i)) return true;
            // Check for warning icon SVGs or icon elements
            var icons = row.querySelectorAll('iron-icon, yt-icon, svg, [icon], [class*="warning"], [class*="copyright"], [class*="claim"]');
            for (var i = 0; i < icons.length; i++) {
              var iconName = icons[i].getAttribute('icon') || icons[i].getAttribute('class') || '';
              if (iconName.match(/warning|copyright|claim|error|alert/i)) return true;
            }
            // Check for tooltip text about copyright
            var tooltips = row.querySelectorAll('[tooltip], [title], [aria-label]');
            for (var j = 0; j < tooltips.length; j++) {
              var tip = (tooltips[j].getAttribute('tooltip') || tooltips[j].getAttribute('title') || tooltips[j].getAttribute('aria-label') || '');
              if (tip.match(/copyright|claim|restriction/i)) return true;
            }
            return false;
          }

          // Extract from links with /video/ pattern — only from rows with copyright flags
          var links = document.querySelectorAll('a[href]');
          var allIds = [];
          var flaggedIds = [];
          for (var i = 0; i < links.length; i++) {
            var m = links[i].href.match(/\\/video\\/([a-zA-Z0-9_-]{6,})/);
            if (m && !seen[m[1]]) {
              seen[m[1]] = true;
              allIds.push(m[1]);
              var row = getRow(links[i]);
              if (row && hasCopyrightFlag(row)) {
                flaggedIds.push(m[1]);
              }
            }
          }

          // If copyright filter is applied (flaggedIds found), return ONLY flagged ones.
          // If no flags detected (filter not applied or different page structure), return all as fallback.
          if (flaggedIds.length > 0) {
            return { ids: flaggedIds, copyrightOnly: true, total: allIds.length };
          }
          return { ids: allIds, copyrightOnly: false, total: allIds.length };
        })()
      `).catch(() => ({ ids: [], copyrightOnly: false, total: 0 }))

      res.json({
        success: true,
        videoIds: result.ids || result,
        count: (result.ids || result).length,
        copyrightOnly: result.copyrightOnly || false,
        totalOnPage: result.total || (result.ids || result).length,
      })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // Click the Nth visible video row in a YouTube Studio content list
  server.post('/tabs/click-table-row', async (req: Request, res: Response) => {
    try {
      const { id, rowIndex = 0 } = req.body
      const tabId = id !== undefined ? id : browserViewManager.getActiveTabId()
      const view = browserViewManager.getView(tabId)
      if (!view) { res.status(404).json({ success: false, error: 'Tab not found' }); return }

      const coords = await view.webContents.executeJavaScript(`
        (function() {
          // Find video links by URL pattern (most reliable)
          var links = [];
          var allLinks = document.querySelectorAll('a[href]');
          for (var i = 0; i < allLinks.length; i++) {
            if (/\\/video\\//.test(allLinks[i].href)) {
              var rect = allLinks[i].getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
                links.push({ el: allLinks[i], rect: rect, href: allLinks[i].href, text: (allLinks[i].textContent||'').trim().substring(0, 80) });
              }
            }
          }
          // Also search shadow DOM
          function searchShadow(root) {
            var els = root.querySelectorAll('*');
            for (var j = 0; j < els.length; j++) {
              if (els[j].shadowRoot) {
                var sLinks = els[j].shadowRoot.querySelectorAll('a[href]');
                for (var k = 0; k < sLinks.length; k++) {
                  if (/\\/video\\//.test(sLinks[k].href)) {
                    var r = sLinks[k].getBoundingClientRect();
                    if (r.width > 0 && r.height > 0 && r.top >= 0 && r.top < window.innerHeight) {
                      links.push({ el: sLinks[k], rect: r, href: sLinks[k].href, text: (sLinks[k].textContent||'').trim().substring(0, 80) });
                    }
                  }
                }
                searchShadow(els[j].shadowRoot);
              }
            }
          }
          searchShadow(document);
          if (links.length === 0) return null;
          var idx = Math.min(${rowIndex}, links.length - 1);
          var target = links[idx];
          return {
            x: Math.round(target.rect.left + target.rect.width/2),
            y: Math.round(target.rect.top + target.rect.height/2),
            href: target.href,
            text: target.text,
            totalRows: links.length,
            clickedIndex: idx
          };
        })()
      `).catch(() => null)

      if (!coords) { res.json({ success: false, error: 'No video rows found on page' }); return }

      // Native click via sendInputEvent
      view.webContents.sendInputEvent({ type: 'mouseMove', x: coords.x, y: coords.y } as any)
      await new Promise(r => setTimeout(r, 50))
      view.webContents.sendInputEvent({ type: 'mouseDown', x: coords.x, y: coords.y, button: 'left', clickCount: 1 } as any)
      await new Promise(r => setTimeout(r, 50))
      view.webContents.sendInputEvent({ type: 'mouseUp', x: coords.x, y: coords.y, button: 'left', clickCount: 1 } as any)

      res.json({ success: true, strategy: 'row_by_index', ...coords })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  // ════════════════════════════════════════════════════════════
  // GET INTERACTIVE ELEMENTS — List all clickable elements including Shadow DOM
  // ════════════════════════════════════════════════════════════
  server.post('/tabs/get-interactive-elements', async (req: Request, res: Response) => {
    try {
      const { id } = req.body
      const tabId = id !== undefined ? id : browserViewManager.getActiveTabId()
      const view = browserViewManager.getView(tabId)
      if (!view) { res.status(404).json({ success: false, error: 'Tab not found' }); return }

      await view.webContents.executeJavaScript(DEEP_SEARCH_SCRIPT).catch((e: any) => {
        console.error('[CHROMADON] DEEP_SEARCH_SCRIPT injection failed:', e?.message || e)
      })

      const result = await Promise.race([
        view.webContents.executeJavaScript(`
          (function() {
            var elements = [];
            var tags = 'a,button,span,div,li,label,' +
              '[role="tab"],[role="button"],[role="link"],[role="menuitem"],[role="option"],[role="checkbox"],' +
              'tp-yt-paper-tab,ytcp-button,tp-yt-paper-item,ytcp-checkbox-lit,yt-formatted-string,' +
              'tp-yt-paper-radio-button,ytcp-dropdown-trigger,input[type="submit"],select,[tabindex]';

            function search(node, depth) {
              if (depth > 15) return;
              var els;
              try { els = node.querySelectorAll(tags); } catch(e) { return; }
              for (var i = 0; i < els.length; i++) {
                var el = els[i];
                var rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
                  var text = '';
                  for (var c = 0; c < el.childNodes.length; c++) {
                    if (el.childNodes[c].nodeType === 3) text += el.childNodes[c].textContent;
                  }
                  text = text.trim();
                  if (!text) text = (el.textContent || '').trim().substring(0, 60);
                  if (text) {
                    elements.push({
                      text: text.substring(0, 60),
                      tag: el.tagName.toLowerCase(),
                      role: el.getAttribute('role') || '',
                      ariaLabel: el.getAttribute('aria-label') || '',
                      href: el.getAttribute('href') || '',
                      x: Math.round(rect.left + rect.width/2),
                      y: Math.round(rect.top + rect.height/2)
                    });
                  }
                }
              }
              var allEls;
              try { allEls = node.querySelectorAll('*'); } catch(e) { return; }
              for (var j = 0; j < allEls.length; j++) {
                if (allEls[j].shadowRoot) search(allEls[j].shadowRoot, depth + 1);
              }
            }
            search(document, 0);

            var seen = {};
            return elements.filter(function(e) {
              var key = e.text + '|' + e.tag;
              if (seen[key]) return false;
              seen[key] = true;
              return true;
            }).slice(0, 50);
          })()
        `),
        new Promise<any[]>(resolve => setTimeout(() => {
          console.log('[CHROMADON] get_interactive_elements timed out after 8s')
          resolve([])
        }, 8000))
      ]).catch(() => [])

      res.json({ success: true, elements: result, count: result.length })
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

  // Native scroll endpoint — verified JS scroll + keyboard fallback
  server.post('/tabs/scroll/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10)
      const { deltaX, deltaY, direction, amount } = req.body
      const view = browserViewManager.getView(id)
      if (!view) {
        res.status(404).json({ success: false, error: 'Tab not found' })
        return
      }

      const scrollY = deltaY || (direction === 'up' ? -(amount || 500) : (amount || 500))

      // Try JS scroll with INSTANT behavior and VERIFIED position change
      const result = await view.webContents.executeJavaScript(`
        (function() {
          var scrollAmount = ${scrollY};
          function findScrollable() {
            var candidates = document.querySelectorAll('[style*="overflow"],[class*="scroll"],[class*="content"],main,[role="main"],#contents,.style-scope');
            for (var i = 0; i < candidates.length; i++) {
              var style = window.getComputedStyle(candidates[i]);
              if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && candidates[i].scrollHeight > candidates[i].clientHeight) {
                return candidates[i];
              }
            }
            var all = document.querySelectorAll('*');
            for (var j = 0; j < all.length; j++) {
              if (all[j].scrollHeight > all[j].clientHeight + 10) {
                var s = window.getComputedStyle(all[j]);
                if (s.overflowY !== 'hidden' && s.overflowY !== 'visible') return all[j];
              }
            }
            return null;
          }
          // Strategy 1: Container scroll with instant behavior + verification
          var scrollable = findScrollable();
          if (scrollable) {
            var beforeY = scrollable.scrollTop;
            scrollable.scrollBy({ top: scrollAmount, behavior: 'instant' });
            var afterY = scrollable.scrollTop;
            if (Math.abs(afterY - beforeY) > 2) {
              return { success: true, strategy: 'container_scroll', element: scrollable.tagName };
            }
          }
          // Strategy 2: Window scroll with instant behavior + verification
          var beforeWinY = window.scrollY;
          window.scrollBy({ top: scrollAmount, behavior: 'instant' });
          if (Math.abs(window.scrollY - beforeWinY) > 2) {
            return { success: true, strategy: 'window_scroll' };
          }
          return { success: false };
        })()
      `).catch(() => ({ success: false }))

      if (result.success) {
        res.json({ success: true, strategy: result.strategy, element: result.element })
        return
      }

      // Keyboard fallback — sendInputEvent is native and always works
      const key = scrollY < 0 ? 'PageUp' : 'PageDown'
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode: key } as any)
      await new Promise(r => setTimeout(r, 50))
      view.webContents.sendInputEvent({ type: 'keyUp', keyCode: key } as any)
      console.log(`[CHROMADON] Scroll via keyboard fallback (${key}) on tab ${id}`)
      res.json({ success: true, strategy: 'keyboard_fallback' })
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

  // Session backup list (must be before :platform wildcard)
  server.get('/sessions/backups', (_req: Request, res: Response) => {
    res.json({ success: true, backups: sessionBackupManager.listBackups() })
  })

  // Export all sessions (must be before :platform wildcard)
  server.post('/sessions/backups/export-all', async (req: Request, res: Response) => {
    try {
      const { password } = req.body
      if (!password) { res.status(400).json({ success: false, error: 'Password required' }); return }
      const results = await sessionBackupManager.exportAll(password)
      res.json({ success: true, results })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
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

  // ==================== SESSION BACKUP ENDPOINTS ====================

  server.post('/sessions/:platform/export', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform
      const { password } = req.body
      if (!password) { res.status(400).json({ success: false, error: 'Password required' }); return }
      const result = await sessionBackupManager.exportSession(platform, password)
      res.json({ success: true, platform, cookieCount: result.cookieCount })
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message })
    }
  })

  server.post('/sessions/:platform/restore', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform
      const { password } = req.body
      if (!password) { res.status(400).json({ success: false, error: 'Password required' }); return }
      const result = await sessionBackupManager.importSession(platform, password)
      await browserViewManager.verifyPlatformAuth(platform)
      res.json({ success: true, platform, imported: result.imported, skipped: result.skipped })
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
        scheduled: marketingQueue.filter(t => t.status === 'scheduled').length,
        running: marketingQueue.filter(t => t.status === 'running').length,
        completed: marketingQueue.filter(t => t.status === 'completed').length,
        failed: marketingQueue.filter(t => t.status === 'failed').length,
      },
    })
  })

  // Add task to queue
  server.post('/queue/add', (req: Request, res: Response) => {
    try {
      const { platform, action, content, targetUrl, priority = 0, scheduledTime, recurrence, batchId, hashtags, mediaUrls } = req.body
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
        status: scheduledTime ? 'scheduled' : 'queued',
        createdAt: Date.now(),
        scheduledTime,
        recurrence,
        batchId,
        hashtags,
        mediaUrls,
      }

      marketingQueue.push(task)
      // Sort by priority (higher first)
      marketingQueue.sort((a, b) => b.priority - a.priority)

      // Notify renderer
      if (mainWindow) {
        mainWindow.webContents.send('queue:updated', marketingQueue)
      }

      saveQueue()
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

      saveQueue()
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

      saveQueue()
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

      saveQueue()
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

      saveQueue()
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
      const buffer = image.toJPEG(85) // JPEG at 85% quality — sharper for AI vision
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
    console.log(`  POST /sessions/:p/export  - Export session backup`)
    console.log(`  POST /sessions/:p/restore - Restore session backup`)
    console.log(`  GET  /sessions/backups    - List session backups`)
    console.log(`  POST /sessions/backups/export-all - Export all sessions`)
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

// Get all platform sessions (re-verifies cookies so stale data is never returned)
ipcMain.handle('session:list', async () => {
  const platforms: Platform[] = ['google', 'twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok']
  for (const platform of platforms) {
    await browserViewManager.verifyPlatformAuth(platform)
  }
  return { success: true, sessions: browserViewManager.getPlatformSessions() }
})

// Get specific platform session
ipcMain.handle('session:get', (_event, platform: Platform) => {
  return { success: true, session: browserViewManager.getPlatformSession(platform) }
})

// Verify platform authentication
ipcMain.handle('session:verify', async (_event, platform: Platform) => {
  // First: quick cookie check
  const hasCookies = await browserViewManager.verifyPlatformAuth(platform)
  if (!hasCookies) {
    browserViewManager.updatePlatformSession(platform, { isAuthenticated: false, lastVerified: Date.now() })
    return { success: true, platform, isAuthenticated: false }
  }

  const authPlatform = platform === 'youtube' ? 'google' : platform
  const partition = `persist:platform-${authPlatform}`
  const ses = session.fromPartition(partition)

  // ─── Google/YouTube: Cookie-based verification (no HTTP request) ───
  // session.fetch() triggers Google's bot detection, causing valid sessions
  // to be falsely reported as expired. Use cookie inspection instead.
  if (authPlatform === 'google') {
    try {
      const cookies = await ses.cookies.get({ domain: '.google.com' })
      const authCookieNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID', '__Secure-1PSID', '__Secure-3PSID']
      const foundAuthCookies = cookies.filter(c => authCookieNames.includes(c.name))

      if (foundAuthCookies.length === 0) {
        browserViewManager.updatePlatformSession(platform, { isAuthenticated: false, lastVerified: Date.now() })
        return { success: true, platform, isAuthenticated: false }
      }

      // Check if the main auth cookie is expired
      const mainCookie = foundAuthCookies.find(c => c.name === 'SID' || c.name === '__Secure-1PSID')
      if (mainCookie?.expirationDate && mainCookie.expirationDate < Date.now() / 1000) {
        browserViewManager.updatePlatformSession(platform, { isAuthenticated: false, lastVerified: Date.now() })
        return { success: true, platform, isAuthenticated: false }
      }

      browserViewManager.updatePlatformSession(platform, { isAuthenticated: true, lastVerified: Date.now() })
      return { success: true, platform, isAuthenticated: true }
    } catch (err) {
      console.error('[Verify] Google cookie check failed:', err)
      return { success: true, platform, isAuthenticated: hasCookies }
    }
  }

  // ─── Other platforms: HTTP navigation check ───
  const verifyUrls: Record<string, { url: string; loginPatterns: string[] }> = {
    twitter:   { url: 'https://x.com/home', loginPatterns: ['/login', '/i/flow/login'] },
    linkedin:  { url: 'https://www.linkedin.com/feed/', loginPatterns: ['/login', '/authwall', '/checkpoint'] },
    facebook:  { url: 'https://www.facebook.com/me', loginPatterns: ['/login', 'checkpoint'] },
    instagram: { url: 'https://www.instagram.com/accounts/edit/', loginPatterns: ['/accounts/login'] },
    tiktok:    { url: 'https://www.tiktok.com/setting', loginPatterns: ['/login'] },
  }

  const check = verifyUrls[authPlatform]
  if (!check) {
    return { success: true, platform, isAuthenticated: hasCookies }
  }

  try {
    const response = await ses.fetch(check.url, { redirect: 'follow' })
    const finalUrl = response.url
    const redirectedToLogin = check.loginPatterns.some(p => finalUrl.includes(p))
    const isAuthenticated = !redirectedToLogin && response.ok
    browserViewManager.updatePlatformSession(platform, { isAuthenticated, lastVerified: Date.now() })
    return { success: true, platform, isAuthenticated }
  } catch (err) {
    console.error(`[Verify] ${platform} network check failed:`, err)
    return { success: true, platform, isAuthenticated: hasCookies }
  }
})

// Update platform session
ipcMain.handle('session:update', (_event, { platform, updates }: { platform: Platform; updates: Partial<PlatformSession> }) => {
  browserViewManager.updatePlatformSession(platform, updates)
  return { success: true, session: browserViewManager.getPlatformSession(platform) }
})

// Clear platform session (sign out)
ipcMain.handle('session:clear', async (_event, platform: Platform) => {
  const authPlatform = platform === 'youtube' ? 'google' : platform
  const partition = `persist:platform-${authPlatform}`
  const ses = session.fromPartition(partition)
  await ses.clearStorageData()
  browserViewManager.updatePlatformSession(platform, { isAuthenticated: false, accountName: undefined, accountEmail: undefined })
  // If clearing google, also clear youtube
  if (authPlatform === 'google') {
    browserViewManager.updatePlatformSession('youtube', { isAuthenticated: false, accountName: undefined, accountEmail: undefined })
  }
  return { success: true }
})

// ==================== SESSION BACKUP IPC HANDLERS ====================

ipcMain.handle('session:export', async (_event, { platform, password }: { platform: Platform; password: string }) => {
  const result = await sessionBackupManager.exportSession(platform, password)
  return { success: true, platform, cookieCount: result.cookieCount }
})

ipcMain.handle('session:import', async (_event, { platform, password }: { platform: Platform; password: string }) => {
  const result = await sessionBackupManager.importSession(platform, password)
  await browserViewManager.verifyPlatformAuth(platform)
  return { success: true, platform, imported: result.imported, skipped: result.skipped }
})

ipcMain.handle('session:exportAll', async (_event, { password }: { password: string }) => {
  const results = await sessionBackupManager.exportAll(password)
  return { success: true, results }
})

ipcMain.handle('session:importAll', async (_event, { password }: { password: string }) => {
  const results = await sessionBackupManager.importAll(password)
  const platforms: Platform[] = ['google', 'twitter', 'linkedin', 'facebook', 'instagram', 'tiktok']
  for (const p of platforms) {
    try { await browserViewManager.verifyPlatformAuth(p) } catch {}
  }
  return { success: true, results }
})

ipcMain.handle('session:listBackups', () => {
  return { success: true, backups: sessionBackupManager.listBackups() }
})

ipcMain.handle('session:deleteBackup', (_event, platform: Platform) => {
  sessionBackupManager.deleteBackup(platform)
  return { success: true }
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
    status: task.scheduledTime ? 'scheduled' : 'queued',
    createdAt: Date.now(),
    priority: task.priority ?? 0,
  }

  marketingQueue.push(newTask)
  marketingQueue.sort((a, b) => b.priority - a.priority)

  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
  }

  saveQueue()
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

  saveQueue()
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

  saveQueue()
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

  saveQueue()
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

  saveQueue()
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
    const errorMsg = errorData.error?.message || `HTTP ${response.status}`
    // Key is valid but account has no credits - still accept the key
    if (response.status === 400 && errorMsg.includes('credit balance')) {
      return { success: true, valid: true, warning: 'API key is valid but your account has no credits. Add credits at console.anthropic.com' }
    }
    return { success: true, valid: false, error: errorMsg }
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

// ==================== GEMINI KEY IPC HANDLERS ====================

ipcMain.handle('settings:getGeminiKeyStatus', () => {
  const key = loadGeminiKey()
  return {
    hasKey: !!key,
    keyPreview: key ? `AIza...${key.slice(-4)}` : null,
  }
})

ipcMain.handle('settings:setGeminiKey', async (_event: any, apiKey: string) => {
  try {
    if (!apiKey.startsWith('AIza')) {
      return { success: false, error: 'Invalid format. Google AI key must start with AIza' }
    }
    storeGeminiKey(apiKey)
    restartBrainServer()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('settings:validateGeminiKey', async (_event: any, apiKey: string) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
        }),
      }
    )

    if (response.ok || response.status === 429) {
      return { success: true, valid: true }
    }
    if (response.status === 400) {
      const errorData = await response.json().catch(() => ({})) as any
      const errorMsg = errorData.error?.message || ''
      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
        return { success: true, valid: false, error: 'Invalid API key' }
      }
      // Other 400 errors might be quota-related — key is still valid
      return { success: true, valid: true, warning: errorMsg }
    }
    if (response.status === 403) {
      return { success: true, valid: false, error: 'API key does not have access to Gemini API. Enable it at console.cloud.google.com' }
    }
    const errorData = await response.json().catch(() => ({})) as any
    const errorMsg = errorData.error?.message || `HTTP ${response.status}`
    return { success: true, valid: false, error: errorMsg }
  } catch (err: any) {
    return { success: false, error: `Network error: ${err.message}` }
  }
})

ipcMain.handle('settings:removeGeminiKey', () => {
  try {
    deleteGeminiKey()
    restartBrainServer()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('settings:getBrainStatus', async () => {
  // In packaged mode, check the managed child process
  if (brainProcess) {
    return { isRunning: true, pid: brainProcess.pid || null }
  }
  // In dev mode (or if brainProcess is null), probe the health endpoint directly
  try {
    const res = await fetch('http://127.0.0.1:3001/health', { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      return { isRunning: true, pid: null }
    }
  } catch {
    // Brain not reachable
  }
  return { isRunning: false, pid: null }
})

// ==================== SOCIAL MONITORING IPC HANDLERS ====================

ipcMain.handle('monitoring:getStatus', async () => {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/monitoring/status', { signal: AbortSignal.timeout(3000) })
    return await res.json()
  } catch {
    return { success: false, enabled: false, error: 'Brain not reachable' }
  }
})

ipcMain.handle('monitoring:toggle', async (_event: any, enabled: boolean, config?: any) => {
  try {
    const res = await fetch('http://127.0.0.1:3001/api/monitoring/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, ...config }),
      signal: AbortSignal.timeout(3000),
    })
    return await res.json()
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('monitoring:getLog', async (_event: any, platform?: string, limit?: number) => {
  try {
    const params = new URLSearchParams()
    if (platform) params.set('platform', platform)
    if (limit) params.set('limit', String(limit))
    const url = `http://127.0.0.1:3001/api/monitoring/log${params.toString() ? '?' + params : ''}`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    return await res.json()
  } catch {
    return { success: false, entries: [], error: 'Brain not reachable' }
  }
})

// Auto-updater: quit and install
ipcMain.handle('updater:quitAndInstall', () => {
  autoUpdater.quitAndInstall()
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

  // Create popup window with platform-specific partition.
  // contextIsolation MUST be false so login-preload.js patches the page's
  // real navigator/window objects (not an isolated copy). nodeIntegration
  // stays false for security — login windows only load trusted URLs.
  const loginPreloadPath = path.join(__dirname, 'login-preload.js')
  const oauthWindow = new BrowserWindow({
    width: 520,
    height: 750,
    center: true,
    parent: mainWindow,
    modal: false,
    alwaysOnTop: true,
    show: false,
    autoHideMenuBar: true,
    title: `Sign in to ${platform}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false,
      preload: loginPreloadPath,
      partition: `persist:platform-${platform}`,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webgl: true,
      spellcheck: true,
    }
  })

  // Show when ready (ensures proper rendering before display)
  oauthWindow.once('ready-to-show', () => {
    oauthWindow.show()
    oauthWindow.focus()
  })

  // Anti-detection is now handled by login-preload.js (runs BEFORE page JS).
  // No dom-ready executeJavaScript needed — preload patches are in the page context.

  // Handle "Sign in with Google" or other OAuth provider clicks within the popup
  // Allow OAuth provider popups to open as real child windows so OAuth flows work
  oauthWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log(`[CHROMADON] OAuth popup trying to open: ${url}`)

    const oauthDomains = [
      'accounts.google.com', 'www.facebook.com', 'facebook.com',
      'appleid.apple.com', 'api.twitter.com', 'twitter.com', 'x.com',
    ]

    try {
      const urlObj = new URL(url)
      if (oauthDomains.some(d => urlObj.hostname.includes(d))) {
        console.log(`[CHROMADON] Allowing OAuth popup for: ${urlObj.hostname}`)
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            width: 500,
            height: 700,
            parent: mainWindow || undefined,
            autoHideMenuBar: true,
            webPreferences: {
              partition: `persist:platform-${platform}`,
              nodeIntegration: false,
              contextIsolation: false,
              sandbox: false,
              preload: loginPreloadPath,
            },
          },
        }
      }
    } catch {}

    // For non-OAuth URLs, load in the same window
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
// ==================== MARKETING QUEUE SCHEDULER ====================
let schedulerInterval: ReturnType<typeof setInterval> | null = null

function calculateNextScheduleTime(task: MarketingTask): string | null {
  if (!task.recurrence || task.recurrence.type === 'none') return null
  if (!task.scheduledTime) return null

  // Check endAfter limit
  if (task.recurrence.endAfter && task.recurrence.occurrenceCount && task.recurrence.occurrenceCount >= task.recurrence.endAfter) {
    return null
  }

  const current = new Date(task.scheduledTime)
  let next: Date

  switch (task.recurrence.type) {
    case 'daily':
      next = new Date(current.getTime() + 24 * 60 * 60 * 1000)
      break
    case 'weekly':
      next = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
      break
    case 'custom':
      if (!task.recurrence.intervalMs) return null
      next = new Date(current.getTime() + task.recurrence.intervalMs)
      break
    default:
      return null
  }

  return next.toISOString()
}

async function checkScheduledTasks(): Promise<void> {
  const now = Date.now()
  const scheduledTasks = marketingQueue.filter(t => t.status === 'scheduled' && t.scheduledTime)
  const dueTasks = scheduledTasks.filter(t => new Date(t.scheduledTime!).getTime() <= now)

  if (dueTasks.length === 0) {
    // Log next upcoming task for debugging (only every 10th check to avoid spam)
    if (scheduledTasks.length > 0 && Math.random() < 0.1) {
      const nextTask = scheduledTasks.sort((a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime())[0]
      const minsUntil = Math.round((new Date(nextTask.scheduledTime!).getTime() - now) / 60000)
      console.log(`[Scheduler] ${scheduledTasks.length} scheduled, next in ${minsUntil}min (${nextTask.platform})`)
    }
    return
  }

  console.log(`[Scheduler] Found ${dueTasks.length} due task(s) out of ${scheduledTasks.length} scheduled`)

  for (const task of dueTasks) {
    // Handle recurrence — clone task for next occurrence before we transition this one
    const nextTime = calculateNextScheduleTime(task)
    if (nextTime) {
      const recurringTask: MarketingTask = {
        ...task,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'scheduled',
        scheduledTime: nextTime,
        recurrence: {
          ...task.recurrence!,
          occurrenceCount: (task.recurrence!.occurrenceCount || 1) + 1,
        },
        createdAt: Date.now(),
        startedAt: undefined,
        completedAt: undefined,
        result: undefined,
        error: undefined,
      }
      marketingQueue.push(recurringTask)
      console.log(`[Scheduler] Created recurring task ${recurringTask.id} for ${nextTime}`)
    }

    // Transition to queued
    task.status = 'queued'

    // Auto-execute via AI assistant chat (same path clients use)
    log(`[Scheduler] Executing task ${task.id}: ${task.platform} — ${task.action} — "${(task.content || '').slice(0, 50)}..."`)
    try {
      const chatPrompt = `Execute this scheduled social media task NOW:\nPlatform: ${task.platform}\nAction: ${task.action}\nContent: ${task.content}${task.hashtags?.length ? `\nHashtags: ${task.hashtags.join(' ')}` : ''}${task.mediaUrls?.length ? `\nMedia files: ${task.mediaUrls.join(', ')}` : ''}${task.targetUrl ? `\nTarget URL: ${task.targetUrl}` : ''}`

      if (mainWindow) {
        await mainWindow.webContents.executeJavaScript(`
          window.dispatchEvent(new CustomEvent('chromadon-chat-submit', {
            detail: { text: ${JSON.stringify(chatPrompt)} }
          }));
          true;
        `)
        task.status = 'completed'
        task.completedAt = Date.now()
        task.result = 'Sent to AI assistant for execution'
        console.log(`[Scheduler] Task ${task.id} sent to AI assistant chat`)
      } else {
        task.status = 'failed'
        task.completedAt = Date.now()
        task.error = 'Desktop window not ready'
        console.error(`[Scheduler] Task ${task.id} failed: window not ready`)
      }
    } catch (err) {
      task.status = 'failed'
      task.completedAt = Date.now()
      task.error = `Scheduler execution failed: ${(err as Error).message}`
      console.error(`[Scheduler] Task ${task.id} failed:`, err)
    }
  }

  // Persist and notify
  saveQueue()
  if (mainWindow) {
    mainWindow.webContents.send('queue:updated', marketingQueue)
  }
}

function startScheduler(): void {
  if (schedulerInterval) return
  const scheduledCount = marketingQueue.filter(t => t.status === 'scheduled').length
  console.log(`[Scheduler] Started (30s interval) — ${scheduledCount} scheduled task(s) in queue`)
  // Check for overdue tasks after 5s delay (wait for renderer to mount event listeners)
  setTimeout(() => {
    checkScheduledTasks().catch(err => console.error('[Scheduler] Initial check failed:', err))
  }, 5000)
  schedulerInterval = setInterval(checkScheduledTasks, 30_000)
}

function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Scheduler] Stopped')
  }
}

app.whenReady().then(() => {
  // Spoof User-Agent AND Sec-CH-UA Client Hints headers on ALL platform
  // session partitions. Sec-CH-UA is the #1 detection vector — Chromium
  // sends "Electron" in these headers by default, independent of setUserAgent().
  const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  const SEC_CH_UA = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
  const SEC_CH_UA_FULL = '"Google Chrome";v="131.0.6778.86", "Chromium";v="131.0.6778.86", "Not_A Brand";v="24.0.0.0"'
  const platformPartitions = ['google', 'twitter', 'linkedin', 'facebook', 'instagram', 'tiktok']
  for (const plat of platformPartitions) {
    const ses = session.fromPartition(`persist:platform-${plat}`)
    ses.setUserAgent(CHROME_UA)
    ses.webRequest.onBeforeSendHeaders(
      { urls: ['*://*/*'] },
      (details, callback) => {
        const headers = { ...details.requestHeaders }
        headers['User-Agent'] = CHROME_UA
        headers['Sec-CH-UA'] = SEC_CH_UA
        headers['Sec-CH-UA-Full-Version-List'] = SEC_CH_UA_FULL
        headers['Sec-CH-UA-Platform'] = '"Windows"'
        headers['Sec-CH-UA-Platform-Version'] = '"15.0.0"'
        headers['Sec-CH-UA-Mobile'] = '?0'
        delete headers['Sec-CH-UA-Model']
        callback({ requestHeaders: headers })
      }
    )
  }
  // Also apply to default session
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders }
      headers['Sec-CH-UA'] = SEC_CH_UA
      headers['Sec-CH-UA-Full-Version-List'] = SEC_CH_UA_FULL
      callback({ requestHeaders: headers })
    }
  )
  console.log(`[CHROMADON] UA + Sec-CH-UA spoofed on ${platformPartitions.length} platform sessions`)

  createWindow()
  startControlServer()
  initAutoUpdater()

  // Initialize session backup manager + hourly auto-backup
  sessionBackupManager.initialize()
  setInterval(async () => {
    if (sessionBackupManager.hasAutoBackupKey()) {
      try {
        await sessionBackupManager.autoBackup()
      } catch (err) {
        console.error('[SessionBackup] Auto-backup failed:', err)
      }
    }
  }, 60 * 60 * 1000)

  // Load stored API key and start brain
  const storedKey = loadApiKey()
  console.log(`[CHROMADON] Startup: API key ${storedKey ? 'found' : 'NOT found'}, userData=${app.getPath('userData')}`)
  startBrainServer(storedKey || undefined)
  startBrainHealthCheck()
  startScheduler()
})

app.on('before-quit', () => {
  stopScheduler()
  sessionBackupManager.clearAutoBackupKey()
  if (brainHealthInterval) clearInterval(brainHealthInterval)
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
