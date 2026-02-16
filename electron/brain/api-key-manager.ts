import * as fs from 'fs'
import * as path from 'path'
import type { ApiKeyEnvelope } from './types'

interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export class ApiKeyManager {
  private cachedAnthropicKey: string | null = null
  private cachedGeminiKey: string | null = null

  private readonly anthropicKeyFile = 'chromadon-api-key.json'
  private readonly geminiKeyFile = 'chromadon-gemini-key.json'

  constructor(
    private readonly userDataPath: string,
    private readonly safeStorage: SafeStorageAdapter,
    private readonly logFn: (msg: string) => void = console.log,
  ) {}

  // ==================== Anthropic Key ====================

  get anthropicKey(): string | null {
    return this.cachedAnthropicKey
  }

  storeAnthropicKey(key: string): void {
    this.cachedAnthropicKey = key
    this.storeKey(this.anthropicKeyFile, key, 'ApiKey')

    // Verify
    const verify = this.loadAnthropicKey()
    if (verify && verify.startsWith('sk-ant-')) {
      this.log('ApiKey', `storeApiKey: verified OK (${verify.slice(0, 10)}...${verify.slice(-4)})`)
    } else {
      this.log('ApiKey', 'storeApiKey: WARNING - read-back verification failed!')
    }
  }

  loadAnthropicKey(): string | null {
    if (this.cachedAnthropicKey) return this.cachedAnthropicKey
    const key = this.loadKey(this.anthropicKeyFile, 'ApiKey')
    if (key) this.cachedAnthropicKey = key
    return key
  }

  deleteAnthropicKey(): void {
    this.cachedAnthropicKey = null
    const keyPath = path.join(this.userDataPath, this.anthropicKeyFile)
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath)
      this.log('ApiKey', 'Deleted: ' + keyPath)
    }
    // Clean up legacy format
    const oldPath = path.join(this.userDataPath, 'anthropic-api-key.enc')
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath)
      this.log('ApiKey', 'Deleted legacy: ' + oldPath)
    }
  }

  // ==================== Gemini Key ====================

  get geminiKey(): string | null {
    return this.cachedGeminiKey
  }

  setCachedGeminiKey(key: string): void {
    this.cachedGeminiKey = key
  }

  storeGeminiKey(key: string): void {
    this.cachedGeminiKey = key
    this.storeKey(this.geminiKeyFile, key, 'GeminiKey')

    const verify = this.loadGeminiKey()
    if (verify && verify.startsWith('AIza')) {
      this.log('GeminiKey', `storeGeminiKey: verified OK (${verify.slice(0, 8)}...${verify.slice(-4)})`)
    } else {
      this.log('GeminiKey', 'storeGeminiKey: WARNING - read-back verification failed!')
    }
  }

  loadGeminiKey(): string | null {
    if (this.cachedGeminiKey) return this.cachedGeminiKey
    const key = this.loadKey(this.geminiKeyFile, 'GeminiKey')
    if (key) this.cachedGeminiKey = key
    return key
  }

  deleteGeminiKey(): void {
    this.cachedGeminiKey = null
    const keyPath = path.join(this.userDataPath, this.geminiKeyFile)
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath)
      this.log('GeminiKey', 'Deleted: ' + keyPath)
    }
  }

  // ==================== Composite Helpers ====================

  hasAnyKey(): boolean {
    return !!(this.cachedAnthropicKey || this.cachedGeminiKey)
  }

  getEnvironmentKeys(): Record<string, string> {
    const env: Record<string, string> = {}
    const anthropic = this.cachedAnthropicKey || this.loadAnthropicKey()
    const gemini = this.cachedGeminiKey || this.loadGeminiKey()
    if (anthropic) env.ANTHROPIC_API_KEY = anthropic
    if (gemini) env.GEMINI_API_KEY = gemini
    return env
  }

  // ==================== Private Helpers ====================

  private storeKey(fileName: string, key: string, label: string): void {
    const keyPath = path.join(this.userDataPath, fileName)
    try {
      const useEncryption = this.safeStorage.isEncryptionAvailable()
      this.log(label, `store: encryption=${useEncryption}, path=${keyPath}`)

      if (useEncryption) {
        const encrypted = this.safeStorage.encryptString(key)
        const envelope: ApiKeyEnvelope = {
          format: 'dpapi',
          data: encrypted.toString('base64'),
          storedAt: Date.now(),
        }
        fs.writeFileSync(keyPath, JSON.stringify(envelope), 'utf8')
      } else {
        const envelope: ApiKeyEnvelope = {
          format: 'base64',
          data: Buffer.from(key).toString('base64'),
          storedAt: Date.now(),
        }
        fs.writeFileSync(keyPath, JSON.stringify(envelope), 'utf8')
      }
    } catch (err: any) {
      this.log(label, `store ERROR: ${err.message}`)
      throw err
    }
  }

  private loadKey(fileName: string, label: string): string | null {
    const keyPath = path.join(this.userDataPath, fileName)
    if (!fs.existsSync(keyPath)) return null

    try {
      const raw = fs.readFileSync(keyPath, 'utf8')

      // New JSON envelope format
      if (raw.startsWith('{')) {
        const envelope = JSON.parse(raw) as ApiKeyEnvelope
        this.log(label, `load: format=${envelope.format}, storedAt=${envelope.storedAt}`)

        if (envelope.format === 'dpapi') {
          const encrypted = Buffer.from(envelope.data, 'base64')
          const key = this.safeStorage.decryptString(encrypted)
          this.log(label, `load: decrypted OK (${key.slice(0, 8)}...${key.slice(-4)})`)
          return key
        } else if (envelope.format === 'base64') {
          const key = Buffer.from(envelope.data, 'base64').toString('utf8')
          this.log(label, `load: decoded OK (${key.slice(0, 8)}...${key.slice(-4)})`)
          return key
        }
      }

      // Legacy: old encrypted binary format (Anthropic only)
      if (fileName === this.anthropicKeyFile) {
        this.log(label, 'load: attempting legacy format...')
        const data = fs.readFileSync(keyPath)
        if (this.safeStorage.isEncryptionAvailable()) {
          const key = this.safeStorage.decryptString(data)
          this.log(label, `load: legacy decrypt OK (${key.slice(0, 10)}...${key.slice(-4)})`)
          return key
        }
      }

      return null
    } catch (err: any) {
      this.log(label, `load ERROR: ${err.message}`)
      return null
    }
  }

  private log(label: string, msg: string): void {
    this.logFn(`[${label}] ${msg}`)
  }
}
