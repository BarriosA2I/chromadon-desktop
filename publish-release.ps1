# Generate latest.yml for v1.2.9
$exePath = "C:\Users\gary\chromadon-desktop\release\CHROMADON-Setup-1.2.9.exe"
$size = (Get-Item $exePath).Length
$hash = (Get-FileHash $exePath -Algorithm SHA512).Hash
$sha512Base64 = [Convert]::ToBase64String([byte[]] -split ($hash -replace '..', '0x$& '))
$date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$yml = @"
version: 1.2.9
files:
  - url: CHROMADON-Setup-1.2.9.exe
    sha512: $sha512Base64
    size: $size
path: CHROMADON-Setup-1.2.9.exe
sha512: $sha512Base64
releaseDate: '$date'
"@

$yml | Out-File -FilePath "C:\Users\gary\chromadon-desktop\release\latest.yml" -Encoding UTF8 -NoNewline
Write-Host "Generated latest.yml"
Write-Host "SHA512: $sha512Base64"
Write-Host "Size: $size"
