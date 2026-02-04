/**
 * CHROMADON Secure Vault
 *
 * Top-notch security for credential storage:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 key derivation with 600,000 iterations (OWASP recommended)
 * - Master password never stored (only key verification hash)
 * - Auto-lock on inactivity
 * - Brute-force protection
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

// Use Node's native crypto.randomUUID() instead of uuid package
// (uuid package uses crypto.getRandomValues() which isn't available in Node)
const uuidv4 = () => crypto.randomUUID()

// ==================== TYPES ====================

export interface ChromadonProfile {
  id: string
  name: string
  avatar?: string
  createdAt: number
  lastUsedAt: number
  settings: {
    autoLockMinutes: number
    clipboardClearSeconds: number
  }
}

export interface StoredCredential {
  id: string
  profileId: string
  domain: string
  displayName: string
  type: 'password' | 'oauth' | 'api-key'
  username?: string
  password?: string
  oauthProvider?: 'google' | 'github' | 'twitter' | 'facebook'
  oauthTokens?: {
    accessToken: string
    refreshToken: string
    expiresAt: number
  }
  apiKey?: string
  notes?: string
  tags: string[]
  createdAt: number
  updatedAt: number
  lastUsedAt?: number
  usageCount: number
}

export interface VaultSettings {
  version: number
  createdAt: number
  lastModifiedAt: number
  autoLockEnabled: boolean
  defaultAutoLockMinutes: number
  clipboardClearSeconds: number
}

export interface VaultData {
  profiles: ChromadonProfile[]
  credentials: StoredCredential[]
  settings: VaultSettings
}

export interface EncryptedVault {
  version: number
  salt: string        // Base64 - for key derivation
  iv: string          // Base64 - for AES-GCM
  authTag: string     // Base64 - GCM authentication tag
  encryptedData: string // Base64 - encrypted JSON
  keyCheck: string    // Hash to verify correct password
  failedAttempts: number
  lockoutUntil?: number
}

export interface VaultStatus {
  exists: boolean
  isLocked: boolean
  isLockedOut: boolean
  lockoutRemaining?: number
  profileCount?: number
  credentialCount?: number
  currentProfileId?: string
}

// ==================== CONSTANTS ====================

const VAULT_VERSION = 1
// PBKDF2 with 600,000 iterations (OWASP 2023 recommended minimum)
const PBKDF2_ITERATIONS = 600000
const PBKDF2_KEYLEN = 32 // 256-bit key
const PBKDF2_DIGEST = 'sha512'
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

// ==================== VAULT CLASS ====================

export class SecureVault {
  private vaultPath: string = ''
  private derivedKey: Buffer | null = null
  private currentSalt: Buffer | null = null  // Store salt to avoid mismatch between create and saveVault
  private vaultData: VaultData | null = null
  private currentProfileId: string | null = null
  private lockTimeout: NodeJS.Timeout | null = null
  private autoLockMinutes: number = 5
  private initialized: boolean = false

  constructor() {
    // Vault path will be initialized when app is ready
  }

  /**
   * Initialize the vault path (call after app is ready)
   */
  initialize(): void {
    if (this.initialized) return

    const userDataPath = app.getPath('userData')
    const vaultDir = path.join(userDataPath, 'vault')

    // Ensure vault directory exists
    if (!fs.existsSync(vaultDir)) {
      fs.mkdirSync(vaultDir, { recursive: true })
    }

    this.vaultPath = path.join(vaultDir, 'chromadon.vault')
    this.initialized = true
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize()
    }
  }

  // ==================== KEY DERIVATION ====================

  private async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password,
        salt,
        PBKDF2_ITERATIONS,
        PBKDF2_KEYLEN,
        PBKDF2_DIGEST,
        (err, derivedKey) => {
          if (err) reject(err)
          else resolve(derivedKey)
        }
      )
    })
  }

  private generateSalt(): Buffer {
    return crypto.randomBytes(32)
  }

  private generateKeyCheck(derivedKey: Buffer): string {
    // Hash the derived key to create a verification token
    // This allows us to verify the password without storing the key
    return crypto.createHash('sha256').update(derivedKey).digest('base64')
  }

  // ==================== ENCRYPTION ====================

  private encrypt(data: string, key: Buffer): { iv: string; authTag: string; encrypted: string } {
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    return {
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      encrypted,
    }
  }

  private decrypt(encrypted: string, key: Buffer, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(authTag, 'base64'))

    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  // ==================== VAULT FILE OPERATIONS ====================

  private readVaultFile(): EncryptedVault | null {
    try {
      if (!fs.existsSync(this.vaultPath)) {
        return null
      }
      const data = fs.readFileSync(this.vaultPath, 'utf8')
      return JSON.parse(data) as EncryptedVault
    } catch {
      return null
    }
  }

  private writeVaultFile(vault: EncryptedVault): void {
    // Write atomically by writing to temp file first
    const tempPath = this.vaultPath + '.tmp'
    fs.writeFileSync(tempPath, JSON.stringify(vault, null, 2), 'utf8')
    fs.renameSync(tempPath, this.vaultPath)
  }

  private async saveVault(): Promise<void> {
    if (!this.derivedKey || !this.vaultData) {
      throw new Error('Vault not unlocked')
    }

    const existingVault = this.readVaultFile()
    let salt: Buffer
    if (existingVault) {
      salt = Buffer.from(existingVault.salt, 'base64')
    } else if (this.currentSalt) {
      salt = this.currentSalt
    } else {
      throw new Error('No salt available - create() must be called first')
    }

    const dataJson = JSON.stringify(this.vaultData)
    const { iv, authTag, encrypted } = this.encrypt(dataJson, this.derivedKey)

    const vault: EncryptedVault = {
      version: VAULT_VERSION,
      salt: salt.toString('base64'),
      iv,
      authTag,
      encryptedData: encrypted,
      keyCheck: this.generateKeyCheck(this.derivedKey),
      failedAttempts: 0,
      lockoutUntil: undefined,
    }

    this.writeVaultFile(vault)
  }

  // ==================== PUBLIC API ====================

  /**
   * Check if vault exists
   */
  vaultExists(): boolean {
    this.ensureInitialized()
    return fs.existsSync(this.vaultPath)
  }

  /**
   * Get vault status
   */
  getStatus(): VaultStatus {
    this.ensureInitialized()
    const vault = this.readVaultFile()

    if (!vault) {
      return {
        exists: false,
        isLocked: true,
        isLockedOut: false,
      }
    }

    const isLockedOut = vault.lockoutUntil ? Date.now() < vault.lockoutUntil : false
    const lockoutRemaining = isLockedOut && vault.lockoutUntil
      ? Math.ceil((vault.lockoutUntil - Date.now()) / 1000)
      : undefined

    return {
      exists: true,
      isLocked: this.derivedKey === null,
      isLockedOut,
      lockoutRemaining,
      profileCount: this.vaultData?.profiles.length,
      credentialCount: this.vaultData?.credentials.length,
      currentProfileId: this.currentProfileId || undefined,
    }
  }

  /**
   * Create a new vault with master password
   */
  async create(masterPassword: string): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized()
    if (this.vaultExists()) {
      return { success: false, error: 'Vault already exists' }
    }

    if (masterPassword.length < 8) {
      return { success: false, error: 'Master password must be at least 8 characters' }
    }

    const salt = this.generateSalt()
    this.currentSalt = salt  // Store salt so saveVault uses the same one
    this.derivedKey = await this.deriveKey(masterPassword, salt)

    // Create default vault data
    const defaultProfile: ChromadonProfile = {
      id: uuidv4(),
      name: 'Default',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      settings: {
        autoLockMinutes: 5,
        clipboardClearSeconds: 30,
      },
    }

    this.vaultData = {
      profiles: [defaultProfile],
      credentials: [],
      settings: {
        version: VAULT_VERSION,
        createdAt: Date.now(),
        lastModifiedAt: Date.now(),
        autoLockEnabled: true,
        defaultAutoLockMinutes: 5,
        clipboardClearSeconds: 30,
      },
    }

    this.currentProfileId = defaultProfile.id

    await this.saveVault()
    this.startAutoLockTimer()

    return { success: true }
  }

  /**
   * Unlock the vault with master password
   */
  async unlock(masterPassword: string): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized()
    const vault = this.readVaultFile()

    if (!vault) {
      return { success: false, error: 'Vault does not exist' }
    }

    // Check lockout
    if (vault.lockoutUntil && Date.now() < vault.lockoutUntil) {
      const remaining = Math.ceil((vault.lockoutUntil - Date.now()) / 1000)
      return { success: false, error: `Locked out. Try again in ${remaining} seconds` }
    }

    const salt = Buffer.from(vault.salt, 'base64')
    this.currentSalt = salt  // Store salt for any subsequent saves
    const derivedKey = await this.deriveKey(masterPassword, salt)
    const keyCheck = this.generateKeyCheck(derivedKey)

    if (keyCheck !== vault.keyCheck) {
      // Wrong password - increment failed attempts
      vault.failedAttempts = (vault.failedAttempts || 0) + 1

      if (vault.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        vault.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS
        vault.failedAttempts = 0
        this.writeVaultFile(vault)
        return { success: false, error: 'Too many failed attempts. Locked for 5 minutes.' }
      }

      this.writeVaultFile(vault)
      const attemptsLeft = MAX_FAILED_ATTEMPTS - vault.failedAttempts
      return { success: false, error: `Invalid password. ${attemptsLeft} attempts remaining.` }
    }

    // Successful unlock - reset failed attempts
    vault.failedAttempts = 0
    vault.lockoutUntil = undefined
    this.writeVaultFile(vault)

    this.derivedKey = derivedKey

    try {
      const decrypted = this.decrypt(
        vault.encryptedData,
        derivedKey,
        vault.iv,
        vault.authTag
      )
      this.vaultData = JSON.parse(decrypted) as VaultData

      // Set current profile to most recently used
      if (this.vaultData.profiles.length > 0) {
        const sorted = [...this.vaultData.profiles].sort((a, b) => b.lastUsedAt - a.lastUsedAt)
        this.currentProfileId = sorted[0].id
      }

      this.autoLockMinutes = this.vaultData.settings.defaultAutoLockMinutes
      this.startAutoLockTimer()

      return { success: true }
    } catch {
      this.derivedKey = null
      return { success: false, error: 'Failed to decrypt vault' }
    }
  }

  /**
   * Lock the vault
   */
  lock(): void {
    this.derivedKey = null
    this.vaultData = null
    this.currentProfileId = null
    this.stopAutoLockTimer()
  }

  /**
   * Change master password
   */
  async changeMasterPassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    this.ensureInitialized()
    const vault = this.readVaultFile()

    if (!vault) {
      return { success: false, error: 'Vault does not exist' }
    }

    // Verify current password
    const salt = Buffer.from(vault.salt, 'base64')
    const currentKey = await this.deriveKey(currentPassword, salt)
    const keyCheck = this.generateKeyCheck(currentKey)

    if (keyCheck !== vault.keyCheck) {
      return { success: false, error: 'Current password is incorrect' }
    }

    if (newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters' }
    }

    // Generate new salt and key
    const newSalt = this.generateSalt()
    this.derivedKey = await this.deriveKey(newPassword, newSalt)

    await this.saveVault()

    return { success: true }
  }

  // ==================== AUTO-LOCK ====================

  private startAutoLockTimer(): void {
    this.stopAutoLockTimer()

    if (this.autoLockMinutes > 0) {
      this.lockTimeout = setTimeout(() => {
        this.lock()
      }, this.autoLockMinutes * 60 * 1000)
    }
  }

  private stopAutoLockTimer(): void {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }
  }

  /**
   * Reset the auto-lock timer (call on user activity)
   */
  resetAutoLockTimer(): void {
    if (this.derivedKey) {
      this.startAutoLockTimer()
    }
  }

  // ==================== PROFILE OPERATIONS ====================

  getProfiles(): ChromadonProfile[] {
    if (!this.vaultData) {
      return []
    }
    return this.vaultData.profiles
  }

  getCurrentProfile(): ChromadonProfile | null {
    if (!this.vaultData || !this.currentProfileId) {
      return null
    }
    return this.vaultData.profiles.find(p => p.id === this.currentProfileId) || null
  }

  async createProfile(name: string, avatar?: string): Promise<{ success: boolean; profile?: ChromadonProfile; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const profile: ChromadonProfile = {
      id: uuidv4(),
      name,
      avatar,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      settings: {
        autoLockMinutes: this.vaultData.settings.defaultAutoLockMinutes,
        clipboardClearSeconds: this.vaultData.settings.clipboardClearSeconds,
      },
    }

    this.vaultData.profiles.push(profile)
    this.vaultData.settings.lastModifiedAt = Date.now()
    await this.saveVault()

    return { success: true, profile }
  }

  async updateProfile(id: string, updates: Partial<Omit<ChromadonProfile, 'id' | 'createdAt'>>): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const index = this.vaultData.profiles.findIndex(p => p.id === id)
    if (index === -1) {
      return { success: false, error: 'Profile not found' }
    }

    this.vaultData.profiles[index] = {
      ...this.vaultData.profiles[index],
      ...updates,
    }
    this.vaultData.settings.lastModifiedAt = Date.now()
    await this.saveVault()

    return { success: true }
  }

  async deleteProfile(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    if (this.vaultData.profiles.length <= 1) {
      return { success: false, error: 'Cannot delete the last profile' }
    }

    const index = this.vaultData.profiles.findIndex(p => p.id === id)
    if (index === -1) {
      return { success: false, error: 'Profile not found' }
    }

    // Delete profile and its credentials
    this.vaultData.profiles.splice(index, 1)
    this.vaultData.credentials = this.vaultData.credentials.filter(c => c.profileId !== id)
    this.vaultData.settings.lastModifiedAt = Date.now()

    // Switch to another profile if current was deleted
    if (this.currentProfileId === id) {
      this.currentProfileId = this.vaultData.profiles[0].id
    }

    await this.saveVault()

    return { success: true }
  }

  async switchProfile(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const profile = this.vaultData.profiles.find(p => p.id === id)
    if (!profile) {
      return { success: false, error: 'Profile not found' }
    }

    this.currentProfileId = id
    profile.lastUsedAt = Date.now()
    await this.saveVault()

    return { success: true }
  }

  // ==================== CREDENTIAL OPERATIONS ====================

  getCredentials(profileId?: string): StoredCredential[] {
    if (!this.vaultData) {
      return []
    }

    const targetProfileId = profileId || this.currentProfileId
    if (!targetProfileId) {
      return []
    }

    return this.vaultData.credentials.filter(c => c.profileId === targetProfileId)
  }

  getCredentialsByDomain(domain: string): StoredCredential[] {
    if (!this.vaultData || !this.currentProfileId) {
      return []
    }

    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '')

    return this.vaultData.credentials.filter(c => {
      if (c.profileId !== this.currentProfileId) return false
      const credDomain = c.domain.toLowerCase().replace(/^www\./, '')
      return credDomain === normalizedDomain || credDomain.endsWith('.' + normalizedDomain)
    })
  }

  async addCredential(credential: Omit<StoredCredential, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<{ success: boolean; credential?: StoredCredential; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const newCredential: StoredCredential = {
      ...credential,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0,
    }

    this.vaultData.credentials.push(newCredential)
    this.vaultData.settings.lastModifiedAt = Date.now()
    await this.saveVault()

    return { success: true, credential: newCredential }
  }

  async updateCredential(id: string, updates: Partial<Omit<StoredCredential, 'id' | 'createdAt'>>): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const index = this.vaultData.credentials.findIndex(c => c.id === id)
    if (index === -1) {
      return { success: false, error: 'Credential not found' }
    }

    this.vaultData.credentials[index] = {
      ...this.vaultData.credentials[index],
      ...updates,
      updatedAt: Date.now(),
    }
    this.vaultData.settings.lastModifiedAt = Date.now()
    await this.saveVault()

    return { success: true }
  }

  async deleteCredential(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.vaultData) {
      return { success: false, error: 'Vault not unlocked' }
    }

    const index = this.vaultData.credentials.findIndex(c => c.id === id)
    if (index === -1) {
      return { success: false, error: 'Credential not found' }
    }

    this.vaultData.credentials.splice(index, 1)
    this.vaultData.settings.lastModifiedAt = Date.now()
    await this.saveVault()

    return { success: true }
  }

  async recordCredentialUsage(id: string): Promise<void> {
    if (!this.vaultData) return

    const credential = this.vaultData.credentials.find(c => c.id === id)
    if (credential) {
      credential.lastUsedAt = Date.now()
      credential.usageCount++
      await this.saveVault()
    }
  }

  /**
   * Get a credential by ID (for auto-fill)
   */
  getCredentialById(id: string): StoredCredential | null {
    if (!this.vaultData) {
      return null
    }
    return this.vaultData.credentials.find(c => c.id === id) || null
  }
}

// Export singleton instance
export const vault = new SecureVault()
