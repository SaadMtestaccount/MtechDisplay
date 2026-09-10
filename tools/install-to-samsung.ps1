<#
.SYNOPSIS
  Build, sign, and install the MSIGN Tizen app on a Samsung TV over Wi-Fi (sdb), then launch it.

.DESCRIPTION
  Needs Tizen Studio (free) with the TV extension and a signing profile created once in its
  Certificate Manager (see tizen\README.md). The TV must have Developer Mode ON with this PC's IP
  as the host, and be on the same network.

.PARAMETER Ip
  TV IP address(es). Prompted for when omitted. Several: separate with spaces or commas.

.PARAMETER Profile
  Name of the Tizen Studio certificate profile to sign with (default: MSIGN).

.PARAMETER Source
  The Tizen app source folder (default: ..\tizen next to this script).

.EXAMPLE
  .\install-to-samsung.ps1 192.168.1.60
  .\install-to-samsung.ps1 192.168.1.60,192.168.1.61 -Profile MSIGN
#>
param(
  [string[]] $Ip,
  [string] $Profile = 'MSIGN',
  [string] $Source
)

$ErrorActionPreference = 'Stop'
$appId = 'MSIGNtvApp.MSIGN'

function Find-Tool([string[]] $candidates) {
  foreach ($c in $candidates) { $cmd = Get-Command $c -ErrorAction SilentlyContinue; if ($cmd) { return $cmd.Source } }
  return $null
}
$studio = @("$env:USERPROFILE\tizen-studio", 'C:\tizen-studio', "$env:LOCALAPPDATA\tizen-studio")
$tizen = Find-Tool (@($studio | ForEach-Object { "$_\tools\ide\bin\tizen.bat" }) + @('tizen.bat', 'tizen'))
$sdb = Find-Tool (@($studio | ForEach-Object { "$_\tools\sdb.exe" }) + @('sdb.exe', 'sdb'))
if (-not $tizen -or -not $sdb) {
  Write-Host ''
  Write-Host 'Tizen Studio was not found (looked for tools\ide\bin\tizen.bat and tools\sdb.exe).' -ForegroundColor Red
  Write-Host 'Install it from https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html'
  Write-Host 'and add the "TV Extensions" + "Samsung Certificate Extension" in its Package Manager.'
  exit 1
}
if (-not $Source) { $Source = Join-Path $PSScriptRoot '..\tizen' }
$Source = (Resolve-Path $Source).Path
if (-not (Test-Path (Join-Path $Source 'config.xml'))) { throw "No config.xml in $Source" }

# Runs a native tool and returns its text without letting stderr abort the script (PowerShell 5.1).
function Invoke-Tool([string] $exe, [string[]] $toolArgs) {
  $ErrorActionPreference = 'Continue'
  $lines = & $exe @toolArgs 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
  }
  return (($lines | Out-String).Trim())
}

if (-not $Ip -or $Ip.Count -eq 0) {
  Write-Host ''
  Write-Host 'MSIGN - Install to Samsung TV' -ForegroundColor Cyan
  Write-Host 'On the TV: Apps > type 1 2 3 4 5 on the remote > Developer mode ON > Host PC IP = this PC > restart the TV.'
  Write-Host 'Find the TV''s IP under Settings > General > Network > Network Status > IP Settings.'
  Write-Host ''
  $answer = Read-Host 'TV IP address(es) - separate several with spaces or commas'
  $Ip = @($answer)
}
$targets = @($Ip -join ' ' -split '[\s,;]+' | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
if ($targets.Count -eq 0) { Write-Host 'No valid IP address given.' -ForegroundColor Red; exit 1 }

# --- Build + sign once ---
Write-Host ''
Write-Host "Source:  $Source"
Write-Host "Profile: $Profile"
$build = Join-Path $Source '.buildResult'
if (Test-Path $build) { [System.IO.Directory]::Delete($build, $true) }
Write-Host 'building...'
$out = Invoke-Tool $tizen @('build-web', '-out', '.buildResult', '--', $Source)
if ($LASTEXITCODE -ne 0) { Write-Host $out -ForegroundColor Red; exit 1 }
Write-Host 'signing + packaging...'
$out = Invoke-Tool $tizen @('package', '-t', 'wgt', '-s', $Profile, '--', $build)
if ($LASTEXITCODE -ne 0 -or $out -notmatch '\.wgt') {
  Write-Host $out -ForegroundColor Red
  Write-Host ''
  Write-Host "Packaging failed. Does a certificate profile named '$Profile' exist in Tizen Studio > Tools > Certificate Manager," -ForegroundColor Yellow
  Write-Host 'and does its distributor certificate include this TV''s DUID? See tizen\README.md.' -ForegroundColor Yellow
  exit 1
}
$wgt = Get-ChildItem $build -Filter *.wgt | Select-Object -First 1
if (-not $wgt) { Write-Host 'No .wgt produced.' -ForegroundColor Red; exit 1 }
Write-Host "package: $($wgt.FullName)" -ForegroundColor Green

# --- Install on each TV ---
$results = @()
foreach ($target in $targets) {
  Write-Host ''
  Write-Host "=== $target ===" -ForegroundColor Cyan
  $connect = Invoke-Tool $sdb @('connect', "$target`:26101")
  Write-Host "  connect: $connect"
  if ($connect -notmatch '(?i)connected') {
    Write-Host '  Could not reach the TV. Same Wi-Fi? Developer mode ON with THIS PC''s IP as host? TV restarted after enabling it?' -ForegroundColor Yellow
    $results += [pscustomobject]@{ TV = $target; Result = 'unreachable' }
    continue
  }
  $serial = "$target`:26101"
  $model = Invoke-Tool $sdb @('-s', $serial, 'shell', '0', 'getprop', 'ro.product.model')
  Write-Host "  installing MSIGN..."
  $install = Invoke-Tool $sdb @('-s', $serial, 'install', $wgt.FullName)
  if ($install -notmatch '(?i)ok|success|install completed') {
    Write-Host "  Install failed: $install" -ForegroundColor Red
    Write-Host '  A signature/DUID error means this TV''s DUID is not in the distributor certificate yet.' -ForegroundColor Yellow
    $results += [pscustomobject]@{ TV = $target; Result = 'install failed' }
    continue
  }
  Write-Host '  installed.' -ForegroundColor Green
  Invoke-Tool $sdb @('-s', $serial, 'shell', '0', 'was_execute', $appId) | Out-Null
  Write-Host '  MSIGN launched - type the TV''s code from the MSIGN website (TVs > Show code).' -ForegroundColor Green
  $results += [pscustomobject]@{ TV = $target; Result = 'installed' }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
if ($results | Where-Object { $_.Result -ne 'installed' }) { exit 1 }
