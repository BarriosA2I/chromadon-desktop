# CHROMADON Desktop — Full Release Pipeline
# Usage: .\publish.ps1 [-BumpType minor|patch|major]
# Builds, packages, and publishes a complete GitHub release with all required assets.

param(
    [ValidateSet('patch','minor','major')]
    [string]$BumpType = 'patch'
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "`n=== CHROMADON Release Pipeline ===" -ForegroundColor Cyan

# 1. Bump version
Write-Host "`n[1/6] Bumping version ($BumpType)..." -ForegroundColor Yellow
$oldVersion = (Get-Content package.json | ConvertFrom-Json).version
npm version $BumpType --no-git-tag-version | Out-Null
$newVersion = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "  $oldVersion -> $newVersion" -ForegroundColor Green

# 2. Kill running CHROMADON if needed
$procs = Get-Process -Name 'CHROMADON' -ErrorAction SilentlyContinue
if ($procs) {
    Write-Host "`n[2/6] Closing running CHROMADON..." -ForegroundColor Yellow
    $procs | Stop-Process -Force
    Start-Sleep -Seconds 2
    Write-Host "  Closed" -ForegroundColor Green
} else {
    Write-Host "`n[2/6] No running CHROMADON found" -ForegroundColor Green
}

# 3. Build
Write-Host "`n[3/6] Building (tsc + vite + electron-builder)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
Write-Host "  Build complete" -ForegroundColor Green

# 4. Build NSIS installer
Write-Host "`n[4/6] Building NSIS installer..." -ForegroundColor Yellow
npx electron-builder --win nsis
if ($LASTEXITCODE -ne 0) { throw "Installer build failed" }
Write-Host "  Installer ready" -ForegroundColor Green

# 5. Copy better-sqlite3 native binary
$src = "node_modules\better-sqlite3\build\Release\better_sqlite3.node"
$dst = "release\win-unpacked\resources\brain\node_modules\better-sqlite3\build\Release\better_sqlite3.node"
if (Test-Path $src) {
    Write-Host "`n[5/6] Copying better-sqlite3 native binary..." -ForegroundColor Yellow
    Copy-Item $src $dst -Force
    Write-Host "  Copied" -ForegroundColor Green
} else {
    Write-Host "`n[5/6] Skipping better-sqlite3 copy (source not found)" -ForegroundColor DarkYellow
}

# 6. Publish to GitHub
Write-Host "`n[6/6] Publishing v$newVersion to GitHub..." -ForegroundColor Yellow
$exe = "release\CHROMADON-Setup-$newVersion.exe"
$blockmap = "release\CHROMADON-Setup-$newVersion.exe.blockmap"
$yml = "release\latest.yml"

# Verify all 3 required files exist
foreach ($f in @($exe, $blockmap, $yml)) {
    if (-not (Test-Path $f)) { throw "Missing required file: $f" }
}

$size = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host "  Installer: ${size}MB"

# Commit and push
git add package.json package-lock.json
git commit -m "v$newVersion"
git push origin master

# Create GitHub release with ALL 3 required assets
gh release create "v$newVersion" $exe $blockmap $yml `
    --title "CHROMADON v$newVersion" `
    --generate-notes

Write-Host "`n=== Published CHROMADON v$newVersion ===" -ForegroundColor Green
Write-Host "Release: https://github.com/BarriosA2I/chromadon-desktop/releases/tag/v$newVersion" -ForegroundColor Cyan
