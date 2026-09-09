<#
.SYNOPSIS
  Install MSIGN on an Android TV / box over Wi-Fi (ADB), then launch it. No app needed on the TV.

.DESCRIPTION
  One-time on each TV: Settings > About > tap "Build" 7 times, then Developer options > enable
  "USB debugging" / "Network debugging" (wording varies by brand). TV and this PC must be on the
  same network. The first connection shows an "Allow USB debugging?" prompt on the TV — tick
  "Always allow" and OK, then re-run if the install did not go through.

.PARAMETER Ip
  One or more TV IP addresses (e.g. 192.168.1.50, optionally with :port). Prompted for when
  omitted. Separate several with spaces or commas to do a whole store in one go.

.PARAMETER Apk
  Path to the APK. Defaults to the MSIGN APK sitting next to this script, else ..\dist\msign-tv.apk.

.EXAMPLE
  .\install-to-tv.ps1 192.168.1.50
  .\install-to-tv.ps1 192.168.1.50,192.168.1.51,192.168.1.52
#>
param(
  [string[]] $Ip,
  [string] $Apk
)

$ErrorActionPreference = 'Stop'
$package = 'com.mtech.msign'
$activity = "$package/.MainActivity"

function Find-Adb {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $PSScriptRoot 'platform-tools\adb.exe'),
    'adb.exe'
  )
  foreach ($c in $candidates) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
  }
  return $null
}

function Find-Apk {
  if ($Apk) {
    if (Test-Path $Apk) { return (Resolve-Path $Apk).Path }
    throw "APK not found: $Apk"
  }
  $here = Get-ChildItem -Path $PSScriptRoot -Filter '*.apk' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '(?i)msign' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($here) { return $here.FullName }
  $dist = Join-Path $PSScriptRoot '..\dist\msign-tv.apk'
  if (Test-Path $dist) { return (Resolve-Path $dist).Path }
  throw 'No MSIGN APK found. Put msign-tv.apk (or MSIGN-TV-x.y.apk) in the same folder as this script.'
}

$adb = Find-Adb
if (-not $adb) {
  Write-Host ''
  Write-Host 'ADB (Android platform-tools) was not found on this PC.' -ForegroundColor Red
  Write-Host 'Download https://developer.android.com/tools/releases/platform-tools and unzip the'
  Write-Host "'platform-tools' folder next to this script, then run it again."
  exit 1
}
$apkPath = Find-Apk

# Runs adb and returns everything it printed (stdout + stderr) as plain text. Windows PowerShell
# turns a native command's stderr into error records, which would abort the script under
# ErrorActionPreference=Stop even for harmless notices like "no such device" on disconnect.
function Invoke-Adb {
  param([string[]] $AdbArgs)
  $ErrorActionPreference = 'Continue'
  $lines = & $adb @AdbArgs 2>&1 | ForEach-Object {
    if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
  }
  return (($lines | Out-String).Trim())
}

if (-not $Ip -or $Ip.Count -eq 0) {
  Write-Host ''
  Write-Host 'MSIGN - Install to TV' -ForegroundColor Cyan
  Write-Host 'On the TV: Settings > About > tap Build 7 times, then Developer options > enable USB/Network debugging.'
  Write-Host 'Find the TV''s IP under Settings > Network (or About > Status).'
  Write-Host ''
  $answer = Read-Host 'TV IP address(es) - separate several with spaces or commas'
  $Ip = @($answer)
}
$targets = @($Ip -join ' ' -split '[\s,;]+' | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}(:\d+)?$' })
if ($targets.Count -eq 0) { Write-Host 'No valid IP address given.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host "APK: $apkPath"
Write-Host "ADB: $adb"
Invoke-Adb @('start-server') | Out-Null

$results = @()
foreach ($target in $targets) {
  $serial = if ($target -match ':\d+$') { $target } else { "$target`:5555" }
  Write-Host ''
  Write-Host "=== $target ===" -ForegroundColor Cyan

  Invoke-Adb @('disconnect', $serial) | Out-Null
  $connect = Invoke-Adb @('connect', $serial)
  Write-Host "  connect: $connect"
  if ($connect -notmatch '(?i)connected to') {
    Write-Host '  Could not reach the TV. Check it is on the same Wi-Fi and Network/USB debugging is ON.' -ForegroundColor Yellow
    $results += [pscustomobject]@{ TV = $target; Result = 'unreachable' }
    continue
  }

  # Give the TV a moment to show the "Allow USB debugging?" prompt on first contact.
  $state = ''
  for ($i = 0; $i -lt 30; $i++) {
    $state = Invoke-Adb @('-s', $serial, 'get-state')
    if ($state -eq 'device') { break }
    if ($i -eq 0) { Write-Host '  Waiting for the TV to allow debugging - accept the prompt on the screen (tick "Always allow")...' -ForegroundColor Yellow }
    Start-Sleep -Seconds 2
  }
  if ($state -ne 'device') {
    Write-Host "  TV did not authorise this PC (state: $state). Accept the prompt on the TV and run again." -ForegroundColor Yellow
    $results += [pscustomobject]@{ TV = $target; Result = 'not authorised' }
    continue
  }

  $model = Invoke-Adb @('-s', $serial, 'shell', 'getprop', 'ro.product.model')
  $release = Invoke-Adb @('-s', $serial, 'shell', 'getprop', 'ro.build.version.release')
  Write-Host "  device: $model (Android $release)"

  Write-Host '  installing MSIGN...'
  $install = Invoke-Adb @('-s', $serial, 'install', '-r', $apkPath)
  if ($install -notmatch 'Success') {
    Write-Host "  Install failed: $install" -ForegroundColor Red
    $results += [pscustomobject]@{ TV = $target; Result = 'install failed' }
    continue
  }
  Write-Host '  installed.' -ForegroundColor Green

  Invoke-Adb @('-s', $serial, 'shell', 'am', 'start', '-n', $activity) | Out-Null
  Write-Host '  MSIGN launched - type the TV''s code from the MSIGN website (TVs > Show code).' -ForegroundColor Green
  $results += [pscustomobject]@{ TV = $target; Result = "installed on $model" }
}

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
if ($results | Where-Object { $_.Result -notmatch '^installed' }) { exit 1 }
