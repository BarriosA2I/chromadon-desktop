/**
 * CHROMADON Session Backup Manager
 *
 * Encrypted save/restore of browser session cookies per platform partition.
 * Uses AES-256-GCM + PBKDF2 600K (same security level as vault.ts).
 * Cookies are the source of truth for authenticated platform sessions.
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { app, session } from 'electron'

// ==================== TYPES ====================

type Platform = 'google' | 'twitter' | 'linkedin' | 'facebook' | 'instagram' | 'tiktok'

interface SessionBackup {
  version: 1
  platform: Platform
  partition: string
  exportedAt: number
  cookieCount: number
  cookies: Electron.CookiesGetFilter[] & { name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; expirationDate?: number; sameSite: string }[]
}

interface BackupEntry {
  platform: Platform
  file: string
  exportedAt: number
  cookieCount: number
}

export interface BackupManifest {
  version: 1
  lastBackupAt: number
  backups: BackupEntry[]
}

interface EncryptedPayload {
  salt: string
  iv: string
  authTag: string
  data: string
}

// ==================== CONSTANTS ====================

const PBKDF2_ITERATIONS = 600000
const PBKDF2_KEYLEN = 32
const PBKDF2_DIGEST = 'sha512'
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const BACKUP_VERSION = 1

const ALL_PLATFORMS: Platform[] = ['google', 'twitter', 'linkedin', 'facebook', 'instagram', 'tiktok']

// YouTube shares Google's partition — not a separate backup target
function resolvePartition(platform: Platform): string {
  return `persist:platform-${platform}`
}

// ==================== ENCRYPTION ====================

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

function encrypt(plaintext: string, key: Buffer): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  return {
    salt: '', // set by caller
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    data: encrypted,
  }
}

function decrypt(payload: EncryptedPayload, key: Buffer): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'))
  let decrypted = decipher.update(payload.data, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// ==================== SESSION BACKUP MANAGER ====================

export class SessionBackupManager {
  private backupDir: string = ''
  private manifestPath: string = ''
  private manifest: BackupManifest = { version: 1, lastBackupAt: 0, backups: [] }
  private autoBackupKey: Buffer | null = null
  private autoBackupSalt: Buffer | null = null

  initialize(): void {
    this.backupDir = path.join(app.getPath('userData'), 'session-backups')
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true })
    }
    this.manifestPath = path.join(this.backupDir, 'manifest.json')
    this.loadManifest()
  }

  private loadManifest(): void {
    try {
      if (fs.existsSync(this.manifestPath)) {
        this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf8'))
      }
    } catch {
      this.manifest = { version: 1, lastBackupAt: 0, backups: [] }
    }
  }

  private saveManifest(): void {
    const tmp = this.manifestPath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(this.manifest, null, 2), 'utf8')
    fs.renameSync(tmp, this.manifestPath)
  }

  // ==================== EXPORT ====================

  async exportSession(platform: Platform, password: string): Promise<{ cookieCount: number }> {
    const partition = resolvePartition(platform)
    const ses = session.fromPartition(partition)
    const cookies = await ses.cookies.get({})

    const backup: SessionBackup = {
      version: BACKUP_VERSION,
      platform,
      partition,
      exportedAt: Date.now(),
      cookieCount: cookies.length,
      cookies: cookies as any,
    }

    const salt = crypto.randomBytes(32)
    const key = await deriveKey(password, salt)
    const payload = encrypt(JSON.stringify(backup), key)
    payload.salt = salt.toString('base64')

    // Store derived key for auto-backup
    this.autoBackupKey = key
    this.autoBackupSalt = salt

    const filePath = path.join(this.backupDir, `${platform}-backup.enc`)
    const tmp = filePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8')
    fs.renameSync(tmp, filePath)

    // Update manifest
    const existing = this.manifest.backups.findIndex(b => b.platform === platform)
    const entry: BackupEntry = {
      platform,
      file: `${platform}-backup.enc`,
      exportedAt: Date.now(),
      cookieCount: cookies.length,
    }
    if (existing >= 0) {
      this.manifest.backups[existing] = entry
    } else {
      this.manifest.backups.push(entry)
    }
    this.manifest.lastBackupAt = Date.now()
    this.saveManifest()

    console.log(`[SessionBackup] Exported ${cookies.length} cookies for ${platform}`)
    return { cookieCount: cookies.length }
  }

  // ==================== IMPORT ====================

  async importSession(platform: Platform, password: string): Promise<{ imported: number; skipped: number }> {
    const filePath = path.join(this.backupDir, `${platform}-backup.enc`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`No backup found for ${platform}`)
    }

    const payload: EncryptedPayload = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const salt = Buffer.from(payload.salt, 'base64')
    const key = await deriveKey(password, salt)

    let backup: SessionBackup
    try {
      backup = JSON.parse(decrypt(payload, key))
    } catch {
      throw new Error('Invalid password or corrupted backup')
    }

    const partition = resolvePartition(platform)
    const ses = session.fromPartition(partition)

    // Clear existing cookies before restoring
    await ses.clearStorageData({ storages: ['cookies'] })

    let imported = 0
    let skipped = 0
    const now = Date.now() / 1000

    for (const cookie of backup.cookies) {
      // Skip expired cookies
      if (cookie.expirationDate && cookie.expirationDate < now) {
        skipped++
        continue
      }

      try {
        const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
        await ses.cookies.set({
          url: `${cookie.secure ? 'https' : 'http'}://${domain}${cookie.path || '/'}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate,
          sameSite: cookie.sameSite as any,
        })
        imported++
      } catch {
        skipped++
      }
    }

    console.log(`[SessionBackup] Imported ${imported} cookies for ${platform} (${skipped} skipped)`)
    return { imported, skipped }
  }

  // ==================== BULK OPERATIONS ====================

  async exportAll(password: string): Promise<{ platform: string; cookies: number }[]> {
    const results: { platform: string; cookies: number }[] = []
    for (const platform of ALL_PLATFORMS) {
      try {
        const { cookieCount } = await this.exportSession(platform, password)
        results.push({ platform, cookies: cookieCount })
      } catch (err) {
        console.error(`[SessionBackup] Failed to export ${platform}:`, err)
        results.push({ platform, cookies: 0 })
      }
    }
    return results
  }

  async importAll(password: string): Promise<{ platform: string; imported: number }[]> {
    const results: { platform: string; imported: number }[] = []
    for (const platform of ALL_PLATFORMS) {
      try {
        const { imported } = await this.importSession(platform, password)
        results.push({ platform, imported })
      } catch {
        // No backup for this platform — skip silently
        results.push({ platform, imported: 0 })
      }
    }
    return results
  }

  // ==================== MANIFEST ====================

  listBackups(): BackupManifest {
    this.loadManifest()
    return this.manifest
  }

  deleteBackup(platform: Platform): void {
    const filePath = path.join(this.backupDir, `${platform}-backup.enc`)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    this.manifest.backups = this.manifest.backups.filter(b => b.platform !== platform)
    this.saveManifest()
    console.log(`[SessionBackup] Deleted backup for ${platform}`)
  }

  // ==================== AUTO-BACKUP ====================

  hasAutoBackupKey(): boolean {
    return this.autoBackupKey !== null
  }

  async autoBackup(): Promise<void> {
    if (!this.autoBackupKey || !this.autoBackupSalt) return

    for (const platform of ALL_PLATFORMS) {
      try {
        const partition = resolvePartition(platform)
        const ses = session.fromPartition(partition)
        const cookies = await ses.cookies.get({})
        if (cookies.length === 0) continue

        const backup: SessionBackup = {
          version: BACKUP_VERSION,
          platform,
          partition,
          exportedAt: Date.now(),
          cookieCount: cookies.length,
          cookies: cookies as any,
        }

        const payload = encrypt(JSON.stringify(backup), this.autoBackupKey)
        payload.salt = this.autoBackupSalt.toString('base64')

        const filePath = path.join(this.backupDir, `${platform}-backup.enc`)
        const tmp = filePath + '.tmp'
        fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8')
        fs.renameSync(tmp, filePath)

        const existing = this.manifest.backups.findIndex(b => b.platform === platform)
        const entry: BackupEntry = {
          platform,
          file: `${platform}-backup.enc`,
          exportedAt: Date.now(),
          cookieCount: cookies.length,
        }
        if (existing >= 0) {
          this.manifest.backups[existing] = entry
        } else {
          this.manifest.backups.push(entry)
        }
      } catch (err) {
        console.error(`[SessionBackup] Auto-backup failed for ${platform}:`, err)
      }
    }

    this.manifest.lastBackupAt = Date.now()
    this.saveManifest()
    console.log('[SessionBackup] Auto-backup completed')
  }

  clearAutoBackupKey(): void {
    if (this.autoBackupKey) {
      this.autoBackupKey.fill(0)
      this.autoBackupKey = null
    }
    this.autoBackupSalt = null
  }
}

export const sessionBackupManager = new SessionBackupManager()
