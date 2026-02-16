import { EventEmitter } from 'events'
import { fork, execSync, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import type { BrainConfig, BrainStatusEvent, BrainCrashEvent } from './types'
import type { ApiKeyManager } from './api-key-manager'

// Crash alert config
const CRASH_ALERT_EMAIL = 'alienation2innovation@gmail.com'
const RESEND_API_KEY = 're_gbm8Sa3y_6DmCfT99mF8i9QgKk7oY2Ges'

export interface BrainLifecycleEvents {
  status: [BrainStatusEvent]
  crash: [BrainCrashEvent]
  exhausted: [{ restartCount: number; code: number | null; signal: string | null }]
  log: [string]
}

export class BrainLifecycleManager extends EventEmitter {
  // Process state
  private process: ChildProcess | null = null
  private restarting = false
  private crashRestartCount = 0
  private startTime = 0
  private lastStderr = ''

  // Health monitoring state
  private healthInterval: NodeJS.Timeout | null = null
  private healthCheckStartedAt = 0
  private healthRestartCount = 0
  private lastHealthRestart = 0
  private healthUnreachableCount = 0
  private consecutiveHealthyChecks = 0

  // Log file
  private logFilePath: string

  constructor(
    private readonly config: BrainConfig,
    private readonly keyManager: ApiKeyManager,
    private readonly appVersion: string = '0.0.0',
  ) {
    super()
    this.logFilePath = path.join(config.userDataPath, 'brain.log')
  }

  // ==================== Public API ====================

  get pid(): number | null {
    return this.process?.pid ?? null
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  getState() {
    return {
      running: this.isRunning,
      pid: this.pid,
      startCount: this.crashRestartCount,
      consecutiveCrashes: this.crashRestartCount,
      restarting: this.restarting,
    }
  }

  start(apiKey?: string): void {
    // Cache the key for crash recovery
    if (apiKey) {
      // The key manager already caches, but ensure it's set
    }

    this.rotateLogFile()

    const log = (msg: string) => this.log(msg)

    log(`isPackaged=${this.config.isPackaged} resourcesPath=${this.config.resourcesPath}`)

    // Resolve Brain paths
    const { brainDir, brainEntry } = this.resolveBrainPaths(log)

    // Dev mode: load Brain's .env for API keys
    if (!this.config.isPackaged) {
      this.loadDevEnv(brainDir, log)
    }

    log(`brainDir=${brainDir}`)
    log(`brainEntry=${brainEntry}`)
    log(`exists=${fs.existsSync(brainEntry)}`)

    if (!fs.existsSync(brainEntry)) {
      log('Brain server not found at: ' + brainEntry)
      this.restarting = false
      return
    }

    // Resolve API keys
    const keyEnv = this.keyManager.getEnvironmentKeys()
    const resolvedKey = apiKey || keyEnv.ANTHROPIC_API_KEY || ''
    const resolvedGeminiKey = keyEnv.GEMINI_API_KEY || ''
    log(`Starting bundled Brain server... (Anthropic key ${resolvedKey ? 'provided' : 'NOT set'}, Gemini key ${resolvedGeminiKey ? 'provided' : 'NOT set'})`)

    // Kill stale processes on port
    this.killStaleProcesses(log)

    // Pre-fork native module test
    if (!this.testNativeModules(brainDir, log)) {
      this.restarting = false
      return
    }

    // Fork Brain process
    try {
      this.process = fork(brainEntry, [], {
        cwd: brainDir,
        env: {
          ...process.env,
          ...(this.config.isPackaged ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
          CHROMADON_PORT: String(this.config.port),
          CHROMADON_DESKTOP_URL: this.config.desktopUrl,
          CHROMADON_DATA_DIR: this.config.userDataPath,
          PREFER_DESKTOP: 'true',
          NODE_ENV: this.config.isPackaged ? 'production' : 'development',
          ...(resolvedKey ? { ANTHROPIC_API_KEY: resolvedKey } : {}),
          ...(resolvedGeminiKey ? { GEMINI_API_KEY: resolvedGeminiKey } : {}),
          // OBS Studio env vars passthrough
          ...(process.env.OBS_WS_HOST ? { OBS_WS_HOST: process.env.OBS_WS_HOST } : {}),
          ...(process.env.OBS_WS_PORT ? { OBS_WS_PORT: process.env.OBS_WS_PORT } : {}),
          ...(process.env.OBS_WS_PASSWORD ? { OBS_WS_PASSWORD: process.env.OBS_WS_PASSWORD } : {}),
          ...(process.env.OBS_SAFE_MODE ? { OBS_SAFE_MODE: process.env.OBS_SAFE_MODE } : {}),
          ...(process.env.OBS_SAFE_SCENES ? { OBS_SAFE_SCENES: process.env.OBS_SAFE_SCENES } : {}),
        },
        stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
      })

      log(`fork() succeeded, pid=${this.process.pid}`)
      this.restarting = false
      this.startTime = Date.now()
      this.lastStderr = ''

      // Reset restart count after stability period
      setTimeout(() => {
        if (this.process && this.process.pid) {
          if (this.crashRestartCount > 0) log(`Brain stable for 60s — resetting restart count (was ${this.crashRestartCount})`)
          this.crashRestartCount = 0
        }
      }, this.config.stabilityResetMs)
    } catch (err: any) {
      log(`fork() FAILED: ${err.message}`)
      this.restarting = false
      return
    }

    // Attach stdio and event handlers
    this.attachProcessHandlers(apiKey, log)

    // Run staged startup verification
    this.runStartupVerification(apiKey, log)
  }

  async stop(): Promise<void> {
    this.stopHealthChecks()

    if (this.process && !this.process.killed) {
      this.log('Shutting down Brain server...')
      this.process.kill('SIGTERM')

      // Wait up to 5s for graceful exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
          }
          this.process = null
          resolve()
        }, 5000)

        this.process!.on('exit', () => {
          clearTimeout(timeout)
          this.process = null
          resolve()
        })
      })
    }

    this.process = null
  }

  restart(apiKey?: string): void {
    if (this.restarting) {
      console.log('[Brain] restart: already restarting, skipping')
      return
    }
    this.restarting = true

    // Safety timeout — auto-reset flag after 30s
    setTimeout(() => {
      if (this.restarting) {
        console.log('[Brain] restart: safety timeout — resetting restarting flag')
        this.restarting = false
      }
    }, 30_000)

    console.log('[Brain] Restarting Brain server...')
    if (this.process) {
      let started = false
      this.process.removeAllListeners('exit')
      this.process.on('exit', () => {
        this.process = null
        if (!started) {
          started = true
          this.start(apiKey)
        }
      })
      this.process.kill('SIGTERM')

      // Force kill after 5s
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
          this.process = null
        }
        if (!started) {
          started = true
          this.start(apiKey)
        }
      }, 5000)
    } else {
      this.start(apiKey)
    }
  }

  // ==================== Health Checks ====================

  startHealthChecks(): void {
    if (this.healthInterval) clearInterval(this.healthInterval)
    this.healthCheckStartedAt = Date.now()

    // Start with fast checks
    this.healthInterval = setInterval(() => {
      this.runHealthCheck()

      // After fast phase, switch to normal interval
      const elapsed = Date.now() - this.healthCheckStartedAt
      if (elapsed > this.config.fastHealthDurationMs && this.healthInterval) {
        clearInterval(this.healthInterval)
        this.healthInterval = setInterval(() => this.runHealthCheck(), this.config.normalHealthIntervalMs)
        console.log('[Brain] Health check switched to 30s interval (startup phase complete)')
      }
    }, this.config.fastHealthIntervalMs)
  }

  stopHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }
  }

  // ==================== Private: Path Resolution ====================

  private resolveBrainPaths(log: (msg: string) => void): { brainDir: string; brainEntry: string } {
    let brainDir: string
    let brainEntry: string

    if (!this.config.isPackaged) {
      // Dev mode: __dirname = dist-electron/ → up to Desktop root → up to parent → sibling chromadon-brain
      brainDir = path.resolve(__dirname, '..', '..', 'chromadon-brain')
      brainEntry = path.join(brainDir, 'dist', 'api', 'server.js')
      log(`Dev mode — forking Brain from source: ${brainDir}`)
    } else {
      brainDir = path.join(this.config.resourcesPath, 'brain')
      brainEntry = path.join(brainDir, 'dist', 'api', 'server.js')
    }

    return { brainDir, brainEntry }
  }

  private loadDevEnv(brainDir: string, log: (msg: string) => void): void {
    const brainEnvPath = path.join(brainDir, '.env')
    if (!fs.existsSync(brainEnvPath)) return

    const envContent = fs.readFileSync(brainEnvPath, 'utf-8')
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim()
        if (!process.env[key]) {
          process.env[key] = val
          if (key === 'GEMINI_API_KEY' && !this.keyManager.geminiKey) {
            this.keyManager.setCachedGeminiKey(val)
          }
        }
      }
    }
    log('Loaded Brain .env for dev mode')
  }

  // ==================== Private: Process Management ====================

  private killStaleProcesses(log: (msg: string) => void): void {
    try {
      const output = execSync(`netstat -ano | findstr :${this.config.port} | findstr LISTENING`, { encoding: 'utf8', timeout: 3000, windowsHide: true })
      const lines = output.trim().split('\n')
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop()
        if (pid && pid !== '0' && parseInt(pid) !== process.pid) {
          log(`Found stale process PID ${pid} on port ${this.config.port} — killing it`)
          try { execSync(`taskkill /PID ${pid} /F`, { timeout: 3000, windowsHide: true }) } catch {}
        }
      }
    } catch {
      // No process on port — good
    }
  }

  private testNativeModules(brainDir: string, log: (msg: string) => void): boolean {
    try {
      execSync(
        'node -e "try{require(\'better-sqlite3\');process.exit(0)}catch(e){process.stderr.write(e.message);process.exit(1)}"',
        { cwd: brainDir, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 5000, windowsHide: true }
      )
      log('Native module self-test: better-sqlite3 OK')
      return true
    } catch (err: any) {
      const errMsg = err.stderr?.toString() || err.message || 'unknown error'
      log(`Native module self-test FAILED: ${errMsg}`)
      this.emitStatus({
        running: false,
        error: 'Native module compatibility error. Please reinstall CHROMADON.',
      })
      return false
    }
  }

  private attachProcessHandlers(apiKey: string | undefined, log: (msg: string) => void): void {
    if (!this.process) return

    this.process.stdout?.on('data', (data: Buffer) => {
      log(data.toString().trim())
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      this.lastStderr = (this.lastStderr + '\n' + text).slice(-this.config.stderrBufferSize)
      log(`STDERR: ${text}`)
    })

    this.process.on('error', (err) => {
      log(`Process error: ${err.message}`)
      this.process = null
      this.restarting = false
      this.crashRestartCount++
      if (this.crashRestartCount <= this.config.maxCrashRestarts) {
        const backoffDelay = Math.min(3000 * Math.pow(2, this.crashRestartCount - 1), 30000)
        log(`Process error restart in ${backoffDelay / 1000}s (attempt ${this.crashRestartCount}/${this.config.maxCrashRestarts})`)
        setTimeout(() => this.start(this.keyManager.anthropicKey || undefined), backoffDelay)
      }
    })

    this.process.on('exit', (code, signal) => {
      log(`Exited: code=${code} signal=${signal}`)
      const uptimeMs = Date.now() - this.startTime
      this.process = null
      this.restarting = false

      // Crash diagnostics
      const crashInfo = { code, signal, restartCount: this.crashRestartCount, stderr: this.lastStderr.slice(-500), uptimeMs, timestamp: new Date().toISOString() }
      log(`Brain exit diagnostics: ${JSON.stringify(crashInfo)}`)

      // Clean exit = code 0 with no signal
      const isCleanExit = (code === 0 && !signal)
      if (!isCleanExit) {
        this.crashRestartCount++

        this.emitStatus({
          running: false,
          restarting: this.crashRestartCount <= this.config.maxCrashRestarts,
          attempt: this.crashRestartCount,
          maxAttempts: this.config.maxCrashRestarts,
          error: `Brain crashed (code=${code}, signal=${signal}). ${this.crashRestartCount <= this.config.maxCrashRestarts ? 'Restarting...' : 'Check logs.'}`,
        })

        this.emit('crash', { code, signal, restartCount: this.crashRestartCount, stderr: this.lastStderr.slice(-500), uptimeMs } as BrainCrashEvent)

        if (this.crashRestartCount <= this.config.maxCrashRestarts) {
          const backoffDelay = Math.min(3000 * Math.pow(2, this.crashRestartCount - 1), 30000)
          log(`Restarting in ${backoffDelay / 1000}s (attempt ${this.crashRestartCount}/${this.config.maxCrashRestarts})... (Anthropic key: ${this.keyManager.anthropicKey ? 'YES' : 'NO'}, Gemini key: ${this.keyManager.geminiKey ? 'YES' : 'NO'})`)
          setTimeout(() => this.start(this.keyManager.anthropicKey || undefined), backoffDelay)
        } else {
          log(`Brain crashed ${this.crashRestartCount} times — giving up.`)
          this.emit('exhausted', { restartCount: this.crashRestartCount, code, signal })
          this.sendCrashAlert(code, signal, this.crashRestartCount)
        }
      } else {
        this.emitStatus({ running: false, error: null })
      }
    })
  }

  // ==================== Private: Startup Verification ====================

  private runStartupVerification(apiKey: string | undefined, log: (msg: string) => void): void {
    ;(async () => {
      const startedAt = Date.now()
      let httpResponded = false
      let orchestratorReady = false

      // Stage 1: "Starting Brain..."
      this.emitStatus({ running: false, stage: 'starting', message: 'Starting Brain...' })

      // Stage 2: Wait for HTTP server (up to 30s)
      for (let i = 0; i < 30; i++) {
        if (!this.process) break
        if (Date.now() - startedAt > this.config.startupTimeoutMs) break
        await new Promise(r => setTimeout(r, 1000))
        try {
          const res = await fetch(`http://127.0.0.1:${this.config.port}/health`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            httpResponded = true
            const data = await res.json() as any
            if (data.orchestrator) {
              orchestratorReady = true
              log(`Brain fully ready (orchestrator: true)`)
              this.emitStatus({ running: true, orchestrator: true, stage: 'ready', message: 'Ready', error: null })
              break
            }
            log(`Brain HTTP alive but orchestrator not ready (attempt ${i + 1})`)
            this.emitStatus({ running: false, stage: 'connecting', message: 'Connecting to AI...' })
            break
          }
        } catch { /* still starting */ }
      }

      // Stage 3: Wait for orchestrator
      if (httpResponded && !orchestratorReady && this.process) {
        this.emitStatus({ running: false, stage: 'initializing', message: 'Initializing AI tools...' })

        for (let i = 0; i < 60; i++) {
          if (!this.process) break
          if (Date.now() - startedAt > this.config.startupTimeoutMs) break
          await new Promise(r => setTimeout(r, 1000))
          try {
            const res = await fetch(`http://127.0.0.1:${this.config.port}/health`, { signal: AbortSignal.timeout(2000) })
            if (res.ok) {
              const data = await res.json() as any
              if (data.orchestrator) {
                orchestratorReady = true
                log(`Brain orchestrator ready after ${Math.round((Date.now() - startedAt) / 1000)}s`)
                this.emitStatus({ running: true, orchestrator: true, stage: 'ready', message: 'Ready', error: null })
                break
              }
              if (data.orchestratorReason === 'init_error') {
                log(`Brain orchestrator init error: ${data.orchestratorError}`)
                this.emitStatus({
                  running: true, orchestrator: false, stage: 'error',
                  message: `Failed: ${data.orchestratorError || 'AI initialization failed'}`,
                  error: data.orchestratorError || 'AI initialization failed. Check your API key in Settings.',
                })
                return
              }
              if (data.orchestratorReason === 'no_api_key') {
                log('Brain running but no API key configured')
                this.emitStatus({
                  running: true, orchestrator: false, stage: 'error',
                  message: 'No API key configured',
                  error: 'No API key configured. Open Settings to add your Gemini or Anthropic API key.',
                })
                return
              }
            }
          } catch { /* retry */ }
        }
      }

      // Stage 4: Timeout or failure
      if (!orchestratorReady && this.process) {
        const elapsed = Math.round((Date.now() - startedAt) / 1000)
        if (!httpResponded) {
          log(`Brain HTTP server never started (${elapsed}s) — killing zombie`)
          try { this.process.kill('SIGKILL') } catch {}
          this.process = null
          this.emitStatus({
            running: false, stage: 'error',
            message: `Brain failed to start after ${elapsed}s`,
            error: 'Brain failed to start. Check brain.log for details, or restart the app.',
          })
          this.crashRestartCount++
          if (this.crashRestartCount <= this.config.maxCrashRestarts) {
            const backoffDelay = Math.min(3000 * Math.pow(2, this.crashRestartCount - 1), 30000)
            log(`Zombie killed — restarting in ${backoffDelay / 1000}s (attempt ${this.crashRestartCount}/${this.config.maxCrashRestarts})`)
            setTimeout(() => this.start(this.keyManager.anthropicKey || undefined), backoffDelay)
          }
        } else {
          log(`Brain orchestrator not ready after ${elapsed}s — sending error to UI`)
          this.emitStatus({
            running: true, orchestrator: false, stage: 'error',
            message: `AI failed to initialize after ${elapsed}s`,
            error: `Brain AI failed to initialize after ${elapsed}s. Check Settings for your API key, or restart the app.`,
          })
        }
      }
    })()
  }

  // ==================== Private: Health Check ====================

  private runHealthCheck(): void {
    if (!this.process) return
    if (!this.keyManager.hasAnyKey()) return

    ;(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${this.config.port}/health`, { signal: AbortSignal.timeout(5000) })
        const data = await res.json() as any
        this.healthUnreachableCount = 0
        this.consecutiveHealthyChecks++

        if (this.consecutiveHealthyChecks >= this.config.healthResetThreshold && this.healthRestartCount > 0) {
          console.log(`[Brain] Healthy for ${this.consecutiveHealthyChecks} consecutive checks — resetting healthRestartCount (was ${this.healthRestartCount})`)
          this.healthRestartCount = 0
        }

        if (!data.orchestrator && this.keyManager.hasAnyKey()) {
          const now = Date.now()
          if (now - this.lastHealthRestart < this.config.healthRestartCooldownMs) return
          if (this.healthRestartCount >= this.config.maxHealthRestarts) {
            console.log(`[Brain] Health-restart limit reached (${this.config.maxHealthRestarts}) — showing error to user`)
            this.emitStatus({
              running: false, stage: 'error',
              error: data.orchestratorError
                ? `Brain failed to start: ${data.orchestratorError}`
                : 'Brain failed to initialize. Check your API key in Settings.',
            })
            return
          }
          this.healthRestartCount++
          this.lastHealthRestart = now
          console.log(`[Brain] Lost orchestrator — health restart ${this.healthRestartCount}/${this.config.maxHealthRestarts}`)
          this.restart(this.keyManager.anthropicKey || undefined)
        }
      } catch {
        this.consecutiveHealthyChecks = 0
        this.healthUnreachableCount++
        if (this.healthUnreachableCount >= this.config.zombieDetectionThreshold && this.process) {
          console.log(`[Brain] Unreachable for ${this.healthUnreachableCount} consecutive checks — killing zombie`)
          try { this.process.kill('SIGKILL') } catch {}
          this.process = null
          this.healthUnreachableCount = 0

          if (this.healthRestartCount < this.config.maxHealthRestarts) {
            this.healthRestartCount++
            this.lastHealthRestart = Date.now()
            console.log(`[Brain] Zombie killed — restarting (health restart ${this.healthRestartCount}/${this.config.maxHealthRestarts})`)
            setTimeout(() => this.start(this.keyManager.anthropicKey || undefined), 3000)
          } else {
            console.log(`[Brain] Zombie killed but health-restart limit reached`)
            this.emitStatus({
              running: false, stage: 'error',
              error: 'Brain process is unresponsive. Please restart the application.',
            })
          }
        }
      }
    })()
  }

  // ==================== Private: Logging ====================

  private rotateLogFile(): void {
    const logFileOld = this.logFilePath + '.1'
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath)
        if (stats.size > this.config.logMaxSizeBytes || this.crashRestartCount === 0) {
          if (fs.existsSync(logFileOld)) fs.unlinkSync(logFileOld)
          fs.renameSync(this.logFilePath, logFileOld)
        }
      }
    } catch { /* best-effort */ }
  }

  private log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    try { fs.appendFileSync(this.logFilePath, line) } catch {}
    console.log('[Brain]', msg)
    this.emit('log', msg)
  }

  private emitStatus(status: BrainStatusEvent): void {
    this.emit('status', status)
  }

  private async sendCrashAlert(exitCode: number | null, signal: string | null, restartAttempts: number): Promise<void> {
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
            <p><b>Restart Attempts:</b> ${restartAttempts}/${this.config.maxCrashRestarts}</p>
            <p><b>Time:</b> ${new Date().toISOString()}</p>
            <p><b>App Version:</b> ${this.appVersion}</p>
            <p>The brain process has exhausted all restart attempts.</p>`,
        }),
      })
      console.log('[Brain] Crash alert email sent to ' + CRASH_ALERT_EMAIL)
    } catch (err: any) {
      console.log('[Brain] Failed to send crash alert: ' + err.message)
    }
  }
}
