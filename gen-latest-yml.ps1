# Reads version from package.json so you never need to manually edit this file
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg = Get-Content (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$version = $pkg.version

$exePath = Join-Path $projectRoot "release\CHROMADON-Setup-$version.exe"
if (-not (Test-Path $exePath)) {
    Write-Error "Installer not found: $exePath"
    exit 1
}

$size = (Get-Item $exePath).Length
$hash = (Get-FileHash $exePath -Algorithm SHA512).Hash
$sha512Base64 = [Convert]::ToBase64String([byte[]] -split ($hash -replace '..', '0x$& '))
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$yml = "version: $version`nfiles:`n  - url: CHROMADON-Setup-$version.exe`n    sha512: $sha512Base64`n    size: $size`npath: CHROMADON-Setup-$version.exe`nsha512: $sha512Base64`nreleaseDate: '$date'`n"

$ymlPath = Join-Path $projectRoot "release\latest.yml"
[System.IO.File]::WriteAllText($ymlPath, $yml, [System.Text.UTF8Encoding]::new($false))
Write-Host "Generated latest.yml (no BOM) for v$version"
Write-Host "SHA512: $sha512Base64"
Write-Host "Size: $size"
