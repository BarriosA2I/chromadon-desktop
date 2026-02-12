# ============================================================================
# CHROMADON Publish Release
# Runs pre-release health checks, then publishes to GitHub Releases.
# Usage: .\scripts\publish-release.ps1 [-Notes "Release notes here"]
# ============================================================================

param(
    [string]$Notes = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir

# Step 1: Run health check
Write-Host "`n>>> Running pre-release health check...`n" -ForegroundColor Cyan
& "$scriptDir\pre-release-check.ps1"
if ($LASTEXITCODE -ne 0) {
    Write-Host "`n>>> ABORTING RELEASE - Health check failed" -ForegroundColor Red
    exit 1
}

# Step 2: Get version
$pkg = Get-Content (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = $pkg.version
$tag = "v$version"

Write-Host "`n>>> Publishing $tag to GitHub Releases...`n" -ForegroundColor Cyan

# Step 3: Generate latest.yml
Write-Host "  Generating latest.yml..." -NoNewline
& "$projectRoot\gen-latest-yml.ps1"
Write-Host " Done" -ForegroundColor Green

# Step 4: Unset stale GITHUB_TOKEN (electron-builder PAT conflicts with gh CLI)
if ($env:GITHUB_TOKEN) {
    Remove-Item Env:GITHUB_TOKEN -ErrorAction SilentlyContinue
    Write-Host "  Cleared stale GITHUB_TOKEN" -ForegroundColor Yellow
}

# Step 5: Delete old release if exists
Write-Host "  Cleaning old release for $tag..." -NoNewline
gh release delete $tag --repo BarriosA2I/chromadon-desktop --yes --cleanup-tag 2>$null
Write-Host " Done" -ForegroundColor Green

# Step 6: Create release and upload
Write-Host "  Creating GitHub release..." -NoNewline
$releaseDir = Join-Path $projectRoot "release"
$exePath = Join-Path $releaseDir "CHROMADON-Setup-$version.exe"
$blockmapPath = Join-Path $releaseDir "CHROMADON-Setup-$version.exe.blockmap"
$ymlPath = Join-Path $releaseDir "latest.yml"

# Build asset list
$assets = @($exePath, $ymlPath)
if (Test-Path $blockmapPath) { $assets += $blockmapPath }

# Default release notes if none provided
if (-not $Notes) {
    $Notes = "CHROMADON Desktop $tag"
}

gh release create $tag @assets `
    --repo BarriosA2I/chromadon-desktop `
    --title "$tag" `
    --notes $Notes

if ($LASTEXITCODE -ne 0) {
    Write-Host " FAILED" -ForegroundColor Red
    exit 1
}
Write-Host " Done" -ForegroundColor Green

# Step 7: Verify
Write-Host ""
Write-Host ">>> $tag PUBLISHED SUCCESSFULLY" -ForegroundColor Green
Write-Host ">>> https://github.com/BarriosA2I/chromadon-desktop/releases/tag/$tag" -ForegroundColor Cyan
Write-Host ""
