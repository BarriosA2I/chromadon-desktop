// Brain lifecycle shared types and constants

export type BrainStage = 'stopped' | 'starting' | 'connecting' | 'initializing' | 'ready' | 'error'

export interface BrainStatusEvent {
  running: boolean
  orchestrator?: boolean
  stage?: BrainStage
  message?: string
  error?: string | null
  restarting?: boolean
  attempt?: number
  maxAttempts?: number
}

export interface BrainCrashEvent {
  code: number | null
  signal: string | null
  restartCount: number
  stderr: string
  uptimeMs: number
}

export interface BrainConfig {
  port: number
  desktopUrl: string
  maxCrashRestarts: number
  maxHealthRestarts: number
  healthRestartCooldownMs: number
  healthResetThreshold: number
  zombieDetectionThreshold: number
  startupTimeoutMs: number
  fastHealthIntervalMs: number
  normalHealthIntervalMs: number
  fastHealthDurationMs: number
  stabilityResetMs: number
  stderrBufferSize: number
  logMaxSizeBytes: number
  isPackaged: boolean
  userDataPath: string
  resourcesPath: string
}

export const DEFAULT_BRAIN_CONFIG: Omit<BrainConfig, 'isPackaged' | 'userDataPath' | 'resourcesPath'> = {
  port: 3001,
  desktopUrl: 'http://127.0.0.1:3002',
  maxCrashRestarts: 10,
  maxHealthRestarts: 3,
  healthRestartCooldownMs: 60_000,
  healthResetThreshold: 5,
  zombieDetectionThreshold: 3,
  startupTimeoutMs: 90_000,
  fastHealthIntervalMs: 5_000,
  normalHealthIntervalMs: 30_000,
  fastHealthDurationMs: 120_000,
  stabilityResetMs: 60_000,
  stderrBufferSize: 2000,
  logMaxSizeBytes: 5 * 1024 * 1024,
}

export interface ApiKeyEnvelope {
  format: 'dpapi' | 'base64'
  data: string
  storedAt: number
}
