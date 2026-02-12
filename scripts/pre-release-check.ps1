# ============================================================================
# CHROMADON Pre-Release Health Check
# Verifies Brain server starts and responds before publishing a release.
# Run this BEFORE gh release create.
# ============================================================================

param(
    [int]$Port = 3001,
    [int]$TimeoutSeconds = 30,
    [switch]$SkipBrainStart
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$brainDir = Join-Path $projectRoot "resources\brain"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  CHROMADON Pre-Release Health Check" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$checks = @()
$allPassed = $true

# ──────────────────────────────────────────────
# CHECK 1: package.json version exists
# ──────────────────────────────────────────────
Write-Host "[1/7] Checking package.json version..." -NoNewline
$pkg = Get-Content (Join-Path $projectRoot "package.json") | ConvertFrom-Json
if ($pkg.version) {
    Write-Host " v$($pkg.version)" -ForegroundColor Green
    $checks += @{name="Version"; status="PASS"; detail="v$($pkg.version)"}
} else {
    Write-Host " MISSING" -ForegroundColor Red
    $checks += @{name="Version"; status="FAIL"; detail="No version in package.json"}
    $allPassed = $false
}

# ──────────────────────────────────────────────
# CHECK 2: Brain .env exists and has required keys
# ──────────────────────────────────────────────
Write-Host "[2/7] Checking Brain .env..." -NoNewline
$envFile = Join-Path $brainDir ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    $issues = @()

    # ANTHROPIC_API_KEY can be empty in shipped .env (clients set their own)
    # But YOUTUBE keys should be present
    if ($envContent -notmatch "YOUTUBE_API_KEY=AIza") {
        $issues += "Missing YOUTUBE_API_KEY"
    }
    if ($envContent -notmatch "YOUTUBE_CLIENT_ID=\d") {
        $issues += "Missing YOUTUBE_CLIENT_ID"
    }
    if ($envContent -notmatch "CHROMADON_PORT=") {
        $issues += "Missing CHROMADON_PORT"
    }

    if ($issues.Count -eq 0) {
        Write-Host " OK" -ForegroundColor Green
        $checks += @{name="Brain .env"; status="PASS"; detail="Required keys present"}
    } else {
        Write-Host " ISSUES: $($issues -join ', ')" -ForegroundColor Red
        $checks += @{name="Brain .env"; status="FAIL"; detail=($issues -join ', ')}
        $allPassed = $false
    }
} else {
    Write-Host " .env FILE MISSING" -ForegroundColor Red
    $checks += @{name="Brain .env"; status="FAIL"; detail="$envFile not found"}
    $allPassed = $false
}

# ──────────────────────────────────────────────
# CHECK 3: Brain dist/ exists and is recent
# ──────────────────────────────────────────────
Write-Host "[3/7] Checking Brain dist/..." -NoNewline
$brainDist = Join-Path $brainDir "dist\api\server.js"
if (Test-Path $brainDist) {
    $age = (Get-Date) - (Get-Item $brainDist).LastWriteTime
    if ($age.TotalHours -lt 24) {
        Write-Host " Built $([math]::Round($age.TotalMinutes)) min ago" -ForegroundColor Green
        $checks += @{name="Brain dist"; status="PASS"; detail="Recent build"}
    } else {
        Write-Host " STALE ($([math]::Round($age.TotalHours))h old)" -ForegroundColor Yellow
        $checks += @{name="Brain dist"; status="WARN"; detail="Build is $([math]::Round($age.TotalHours))h old"}
    }
} else {
    Write-Host " NOT FOUND" -ForegroundColor Red
    $checks += @{name="Brain dist"; status="FAIL"; detail="dist/api/server.js not found"}
    $allPassed = $false
}

# ──────────────────────────────────────────────
# CHECK 4: Desktop TypeScript compiles clean
# ──────────────────────────────────────────────
Write-Host "[4/7] Checking Desktop compiles..." -NoNewline
$tscBin = Join-Path $projectRoot "node_modules\.bin\tsc.cmd"
if (Test-Path $tscBin) {
    Push-Location $projectRoot
    $tscOutput = & $tscBin --noEmit 2>&1
    $tscExit = $LASTEXITCODE
    Pop-Location
} else {
    Push-Location $projectRoot
    $tscOutput = & npx tsc --noEmit 2>&1
    $tscExit = $LASTEXITCODE
    Pop-Location
}
if ($tscExit -eq 0) {
    Write-Host " Clean" -ForegroundColor Green
    $checks += @{name="TypeScript"; status="PASS"; detail="No errors"}
} else {
    $errorCount = ($tscOutput | Select-String "error TS").Count
    Write-Host " $errorCount errors" -ForegroundColor Red
    $checks += @{name="TypeScript"; status="FAIL"; detail="$errorCount compile errors"}
    $allPassed = $false
}

# ──────────────────────────────────────────────
# CHECK 5: Brain source and bundled dist match
# ──────────────────────────────────────────────
Write-Host "[5/7] Checking Brain source/bundle sync..." -NoNewline
$brainSrcServer = "C:\Users\gary\chromadon-brain\dist\api\server.js"
$brainBundledServer = Join-Path $brainDir "dist\api\server.js"
if ((Test-Path $brainSrcServer) -and (Test-Path $brainBundledServer)) {
    $srcSize = (Get-Item $brainSrcServer).Length
    $bundledSize = (Get-Item $brainBundledServer).Length
    if ($srcSize -eq $bundledSize) {
        Write-Host " In sync ($srcSize bytes)" -ForegroundColor Green
        $checks += @{name="Brain sync"; status="PASS"; detail="Source and bundle match"}
    } else {
        Write-Host " OUT OF SYNC (src=$srcSize, bundle=$bundledSize)" -ForegroundColor Red
        $checks += @{name="Brain sync"; status="FAIL"; detail="Source ($srcSize) != bundle ($bundledSize) - copy dist to resources/brain/dist"}
        $allPassed = $false
    }
} else {
    Write-Host " SKIP (source or bundle missing)" -ForegroundColor Yellow
    $checks += @{name="Brain sync"; status="SKIP"; detail="Cannot compare"}
}

# ──────────────────────────────────────────────
# CHECK 6: Brain health endpoint (if running)
# ──────────────────────────────────────────────
Write-Host "[6/7] Checking Brain health..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        $health = $response.Content | ConvertFrom-Json
        Write-Host " Healthy (mode=$($health.mode), uptime=$($health.uptime)s)" -ForegroundColor Green
        $checks += @{name="Brain health"; status="PASS"; detail="mode=$($health.mode), uptime=$($health.uptime)s"}
    } else {
        Write-Host " Status $($response.StatusCode)" -ForegroundColor Yellow
        $checks += @{name="Brain health"; status="WARN"; detail="HTTP $($response.StatusCode)"}
    }
} catch {
    Write-Host " Not running (port $Port)" -ForegroundColor Yellow
    $checks += @{name="Brain health"; status="WARN"; detail="Brain not running on port $Port - OK if testing bundled version"}
}

# ──────────────────────────────────────────────
# CHECK 7: Installer exists
# ──────────────────────────────────────────────
Write-Host "[7/7] Checking installer..." -NoNewline
$version = $pkg.version
$installer = Join-Path $projectRoot "release\CHROMADON-Setup-$version.exe"
if (Test-Path $installer) {
    $size = [math]::Round((Get-Item $installer).Length / 1MB, 1)
    Write-Host " ${size}MB" -ForegroundColor Green
    $checks += @{name="Installer"; status="PASS"; detail="CHROMADON-Setup-$version.exe (${size}MB)"}
} else {
    Write-Host " NOT FOUND" -ForegroundColor Red
    $checks += @{name="Installer"; status="FAIL"; detail="$installer not found"}
    $allPassed = $false
}

# ──────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RESULTS" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

foreach ($check in $checks) {
    $color = switch ($check.status) {
        "PASS" { "Green" }
        "WARN" { "Yellow" }
        "FAIL" { "Red" }
        "SKIP" { "DarkGray" }
    }
    $icon = switch ($check.status) {
        "PASS" { "[PASS]" }
        "WARN" { "[WARN]" }
        "FAIL" { "[FAIL]" }
        "SKIP" { "[SKIP]" }
    }
    Write-Host "  $icon $($check.name): $($check.detail)" -ForegroundColor $color
}

Write-Host ""
if ($allPassed) {
    Write-Host "  ALL CHECKS PASSED - Safe to publish v$version" -ForegroundColor Green
    Write-Host ""
    exit 0
} else {
    Write-Host "  CHECKS FAILED - DO NOT PUBLISH until issues are resolved" -ForegroundColor Red
    Write-Host ""
    exit 1
}
