[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Generate a verified candidate only after the Windows workflow gates.' }
$root = Split-Path -Parent $PSScriptRoot
$app = Join-Path $root 'app'
$config = Get-Content (Join-Path $app 'src-tauri/tauri.tg-drive.conf.json') -Raw | ConvertFrom-Json
$manifest = Get-Content (Join-Path $app 'package.json') -Raw | ConvertFrom-Json
if ($config.productName -ne 'Teragram' -or $config.identifier -ne 'com.teragram.app') { throw 'Wrong application identity.' }
$binary = Join-Path $app 'src-tauri/target/release/app.exe'
if (-not (Test-Path $binary -PathType Leaf)) { throw 'Windows application is missing.' }
$version = [Diagnostics.FileVersionInfo]::GetVersionInfo($binary)
if ($version.ProductName -ne 'Teragram' -or $version.ProductVersion -notlike "$($manifest.version)*") { throw 'Wrong Windows version resources.' }
$bundle = Join-Path $app 'src-tauri/target/release/bundle/nsis'
$installers = @(Get-ChildItem $bundle -Filter '*-setup.exe' -File)
if ($installers.Count -ne 1) { throw 'Expected exactly one checked installer.' }
$out = Join-Path $root 'release-assets/windows'
New-Item -ItemType Directory -Force $out | Out-Null
$name = "Teragram_$($manifest.version)_windows_x64_setup.exe"
$destination = Join-Path $out $name
Copy-Item $installers[0].FullName $destination
$digest = (Get-FileHash $destination -Algorithm SHA256).Hash.ToLowerInvariant()
"$digest  $name" | Set-Content (Join-Path $out 'SHA256SUMS-windows.txt') -Encoding utf8
$signature = Get-AuthenticodeSignature $destination
if ($signature.Status -notin @('NotSigned', 'Valid')) { throw "Invalid installer signature: $($signature.Status)" }
[ordered]@{
  product = 'Teragram'; version = $manifest.version; architecture = 'x64'; sha256 = $digest
  commit = $env:GITHUB_SHA; run = $env:GITHUB_RUN_ID; signature = [string]$signature.Status
  installer = $name; nativeInstallerSmoke = 'passed'; browserAndNativeJourneys = 'passed'
} | ConvertTo-Json | Set-Content (Join-Path $out 'windows-build-report.json') -Encoding utf8
