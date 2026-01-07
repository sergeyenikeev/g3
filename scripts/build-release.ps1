param(
  [ValidateSet("generic","crazygames","poki","yandex","vkplay","rustore")]
  [string]$Platform = "generic"
)

$ErrorActionPreference = "Stop"
$root = "C:\Users\s\Documents\g2"
Set-Location $root

$env:VITE_USE_PLATFORM_MOCK = "0"

Write-Host "Building platform: $Platform"
npm run "build:$Platform"

$dist = Join-Path $root "dist\$Platform"
$zip = Join-Path $root "dist\lumelines-$Platform.zip"
if (Test-Path $zip) { Remove-Item $zip }
Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip

Remove-Item Env:VITE_USE_PLATFORM_MOCK -ErrorAction SilentlyContinue
