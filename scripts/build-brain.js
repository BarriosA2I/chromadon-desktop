#!/usr/bin/env node
/**
 * build-brain.js — Compile CHROMADON Brain and bundle into Desktop's resources/
 *
 * Usage: node scripts/build-brain.js [--skip-compile]
 *
 * Steps:
 *   1. Compile Brain TypeScript (npm run build in chromadon-brain)
 *   2. Copy dist/ to resources/brain/dist/
 *   3. Copy package.json + npm ci --omit=dev
 *   4. Patch otplib ESM (remove "type": "module")
 *   5. Replace deprecated model strings in .js files
 *   6. Verify critical files exist
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DESKTOP_ROOT = path.resolve(__dirname, '..')
const BRAIN_ROOT = path.resolve(DESKTOP_ROOT, '..', 'chromadon-brain')
const RESOURCES_BRAIN = path.join(DESKTOP_ROOT, 'resources', 'brain')

const skipCompile = process.argv.includes('--skip-compile')

function log(msg) {
  console.log(`[build-brain] ${msg}`)
}

function run(cmd, opts = {}) {
  log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit', ...opts })
}

// ==================== Step 1: Compile Brain ====================
if (!skipCompile) {
  log('Step 1: Compiling Brain TypeScript...')
  if (!fs.existsSync(BRAIN_ROOT)) {
    console.error(`Brain repo not found at: ${BRAIN_ROOT}`)
    process.exit(1)
  }
  run('npm run build', { cwd: BRAIN_ROOT })
  log('Brain compiled successfully')
} else {
  log('Step 1: Skipping compile (--skip-compile)')
}

// Verify Brain dist exists
const brainDist = path.join(BRAIN_ROOT, 'dist')
if (!fs.existsSync(brainDist)) {
  console.error(`Brain dist/ not found at: ${brainDist}`)
  process.exit(1)
}

// ==================== Step 2: Copy dist/ ====================
log('Step 2: Copying Brain dist/ to resources/brain/dist/...')
const targetDist = path.join(RESOURCES_BRAIN, 'dist')

// Clean existing dist
if (fs.existsSync(targetDist)) {
  fs.rmSync(targetDist, { recursive: true, force: true })
}
fs.mkdirSync(targetDist, { recursive: true })

// Use robocopy on Windows, cp -r on Unix
if (process.platform === 'win32') {
  try {
    // robocopy returns 0-7 for success, 8+ for errors
    execSync(`robocopy "${brainDist}" "${targetDist}" /E /NFL /NDL /NJH /NJS`, {
      stdio: 'inherit',
    })
  } catch (err) {
    // robocopy exit code 1 = files copied, which is success
    if (err.status >= 8) {
      console.error('robocopy failed with exit code', err.status)
      process.exit(1)
    }
  }
} else {
  run(`cp -r "${brainDist}/." "${targetDist}/"`)
}
log('dist/ copied')

// ==================== Step 3: Copy package.json + install deps ====================
log('Step 3: Copying package.json + lockfile and installing production deps...')
const brainPkg = path.join(BRAIN_ROOT, 'package.json')
const targetPkg = path.join(RESOURCES_BRAIN, 'package.json')
fs.copyFileSync(brainPkg, targetPkg)

const brainLock = path.join(BRAIN_ROOT, 'package-lock.json')
const targetLock = path.join(RESOURCES_BRAIN, 'package-lock.json')
if (fs.existsSync(brainLock)) {
  fs.copyFileSync(brainLock, targetLock)
  run('npm ci --omit=dev', { cwd: RESOURCES_BRAIN })
} else {
  run('npm install --omit=dev', { cwd: RESOURCES_BRAIN })
}
log('Production dependencies installed')

// ==================== Step 4: Patch otplib ESM ====================
log('Step 4: Patching otplib ESM...')
const otplibPkg = path.join(RESOURCES_BRAIN, 'node_modules', 'otplib', 'package.json')
if (fs.existsSync(otplibPkg)) {
  const content = JSON.parse(fs.readFileSync(otplibPkg, 'utf8'))
  if (content.type === 'module') {
    delete content.type
    fs.writeFileSync(otplibPkg, JSON.stringify(content, null, 2), 'utf8')
    log('Removed "type": "module" from otplib/package.json')
  } else {
    log('otplib already patched (no "type": "module")')
  }
} else {
  log('otplib not found — skipping patch')
}

// ==================== Step 5: Replace deprecated model strings ====================
log('Step 5: Replacing deprecated model strings...')

const MODEL_REPLACEMENTS = [
  ['claude-3-haiku-20240307', 'claude-haiku-4-5-20251001'],
  ['claude-3-5-haiku-20241022', 'claude-haiku-4-5-20251001'],
  ['claude-3-sonnet-20240229', 'claude-sonnet-4-5-20250929'],
]

let patchCount = 0
function patchModelStrings(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      patchModelStrings(fullPath)
    } else if (entry.name.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      let changed = false
      for (const [old, replacement] of MODEL_REPLACEMENTS) {
        if (content.includes(old)) {
          content = content.replaceAll(old, replacement)
          changed = true
        }
      }
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8')
        patchCount++
      }
    }
  }
}

patchModelStrings(targetDist)
log(`Patched ${patchCount} file(s) with updated model strings`)

// ==================== Step 6: Verify critical files ====================
log('Step 6: Verifying critical files...')

const criticalFiles = [
  'dist/api/server.js',
  'dist/core/agentic-orchestrator.js',
  'dist/providers/gemini-provider.js',
  'dist/routing/cost-router.js',
  'package.json',
]

const nativeModule = path.join(RESOURCES_BRAIN, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
let allGood = true

for (const file of criticalFiles) {
  const fullPath = path.join(RESOURCES_BRAIN, file)
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath)
    log(`  OK: ${file} (${(stats.size / 1024).toFixed(1)}KB)`)
  } else {
    console.error(`  MISSING: ${file}`)
    allGood = false
  }
}

if (fs.existsSync(nativeModule)) {
  const stats = fs.statSync(nativeModule)
  log(`  OK: better-sqlite3 native module (${(stats.size / 1024).toFixed(1)}KB)`)
} else {
  console.error('  MISSING: better-sqlite3 native module')
  allGood = false
}

if (!allGood) {
  console.error('\nBuild verification FAILED — missing critical files!')
  process.exit(1)
}

log('\nAll critical files verified. Brain build complete.')
