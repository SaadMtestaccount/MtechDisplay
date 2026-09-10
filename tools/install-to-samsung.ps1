<#
.SYNOPSIS
  MSIGN on Samsung TVs over Wi-Fi (sdb): read device IDs, or install a signed package, or (with
  Tizen Studio) build + sign + install. Then launch it.

.DESCRIPTION
  Three ways to run it — see tizen\README.md:
    -GetDuid          Print each TV's DUID (for the signing certificate). Needs only sdb.
    -Wgt <file.wgt>   Install a package that was ALREADY signed (e.g. sent by the office). Needs only sdb.
    (neither)         Build + sign here with Tizen Studio (profile -Profile, default MSIGN), then install.
  sdb is a small standalone tool: copy Tizen Studio's tools\sdb.exe next to this script for a
  laptop without Tizen Studio. The TV must have Developer Mode ON with THIS PC's IP as the host.

.PARAMETER Ip
  TV IP address(es). Prompted for when omitted. Several: separate with spaces or commas.
#>
param(
  [string[]] $Ip,
  [string] $Profile = 'MSIGN',
  [string] $Source,
  [string] $Wgt,
  [switch] $GetDuid
)

$ErrorActionPreference = 'Stop'
$appId = 'MSIGNtvApp.MSIGN'

function Find-Tool([string[]] $candidates) {
  foreach ($c in $candidates) { $cmd = Get-Command $c -ErrorAction SilentlyContinue; if ($cmd) { return $cmd.Source } }
  return $null
}
$studio = @("$env:USERPROFILE\tizen-studio", 'C:\tizen-studio', "$env:LOCALAPPDATA\tizen-studio")
$sdb = Find-Tool (@((Join-Path $PSScriptRoot 'sdb.exe')) + @($studio | ForEach-Object { "$_\tools\sdb.exe" }) + @('sdb.exe', 'sdb'))
$tizen = Find-Tool (@($studio | ForEach-Object { "$_\tools\ide\bin\tizen.bat" }) + @('tizen.bat', 'tizen'))
if (-not $sdb) {
  Write-Host ''
  Write-Host 'sdb was not found. Either install Tizen Studio (https://developer.samsung.com/smarttv) or copy its' -ForegroundColor Red
  Write-Host 'tools\sdb.exe next to this script (that is all a store laptop needs for -GetDuid and -Wgt).' -ForegroundColor Red
  exit 1
}

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
  Write-Host 'MSIGN - Samsung TV (sdb)' -ForegroundColor Cyan
  Write-Host 'On the TV: Apps > type 1 2 3 4 5 on the remote > Developer mode ON > Host PC IP = this PC > restart the TV.'
  Write-Host 'Find the TV''s IP under Settings > General > Network > Network Status > IP Settings.'
  Write-Host ''
  $answer = Read-Host 'TV IP address(es) - separate several with spaces or commas'
  $Ip = @($answer)
}
$targets = @($Ip -join ' ' -split '[\s,;]+' | Where-Object { $_ -match '^\d{1,3}(\.\d{1,3}){3}$' })
if ($targets.Count -eq 0) { Write-Host 'No valid IP address given.' -ForegroundColor Red; exit 1 }

function Connect-Tv([string] $target) {
  $serial = "$target`:26101"
  $connect = Invoke-Tool $sdb @('connect', $serial)
  Write-Host "  connect: $connect"
  if ($connect -notmatch '(?i)connected') {
    Write-Host '  Could not reach the TV. Same Wi-Fi? Developer mode ON with THIS PC''s IP as host? TV restarted after enabling it?' -ForegroundColor Yellow
    return $null
  }
  return $serial
}

# --- Mode 1: read DUIDs (for the certificate) ---
if ($GetDuid) {
  $rows = @()
  foreach ($target in $targets) {
    Write-Host ''
    Write-Host "=== $target ===" -ForegroundColor Cyan
    $serial = Connect-Tv $target
    if (-not $serial) { $rows += [pscustomobject]@{ TV = $target; DUID = 'unreachable' }; continue }
    $duid = Invoke-Tool $sdb @('-s', $serial, 'shell', '0', 'getduid')
    $model = Invoke-Tool $sdb @('-s', $serial, 'shell', '0', 'getprop', 'ro.product.model')
    Write-Host "  model: $model"
    Write-Host "  DUID:  $duid" -ForegroundColor Green
    $rows += [pscustomobject]@{ TV = $target; DUID = $duid }
  }
  Write-Host ''
  Write-Host 'Send these DUIDs to the office. They go into the MSIGN distributor certificate (Tizen Studio > Certificate Manager).' -ForegroundColor Cyan
  $rows | Format-Table -AutoSize | Out-String | Write-Host
  $out = Join-Path $PSScriptRoot 'duids.txt'
  ($rows | ForEach-Object { "$($_.TV)`t$($_.DUID)" }) | Out-File -Encoding ascii $out
  Write-Host "Also saved to $out"
  exit 0
}

# --- Package: given (already signed) or built + signed here ---
if ($Wgt) {
  if (-not (Test-Path $Wgt)) { Write-Host "Package not found: $Wgt" -ForegroundColor Red; exit 1 }
  $wgtFile = Get-Item $Wgt
  Write-Host ''
  Write-Host "package: $($wgtFile.FullName) (pre-signed)"
} else {
  if (-not $tizen) {
    Write-Host ''
    Write-Host 'Tizen Studio was not found, so the package cannot be built here. Either install it (office PC),' -ForegroundColor Red
    Write-Host 'or run with -Wgt <file.wgt> using a package signed at the office, or -GetDuid to collect device IDs.' -ForegroundColor Red
    exit 1
  }
  if (-not $Source) { $Source = Join-Path $PSScriptRoot '..\tizen' }
  if (-not (Test-Path $Source)) { $Source = Join-Path $PSScriptRoot 'tizen' }
  $Source = (Resolve-Path $Source).Path
  if (-not (Test-Path (Join-Path $Source 'config.xml'))) { throw "No config.xml in $Source" }
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
  $wgtFile = Get-ChildItem $build -Filter *.wgt -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($LASTEXITCODE -ne 0 -or -not $wgtFile) {
    Write-Host $out -ForegroundColor Red
    Write-Host ''
    Write-Host "Packaging failed. Does a certificate profile named '$Profile' exist in Tizen Studio > Tools > Certificate Manager," -ForegroundColor Yellow
    Write-Host 'and does its distributor certificate include this TV''s DUID? See tizen\README.md.' -ForegroundColor Yellow
    exit 1
  }
  $keep = Join-Path $PSScriptRoot 'msign.wgt'
  Copy-Item $wgtFile.FullName $keep -Force
  Write-Host "package: $keep (signed; send this file to a store laptop for -Wgt installs)" -ForegroundColor Green
  $wgtFile = Get-Item $keep
}

# --- Install on each TV ---
$results = @()
foreach ($target in $targets) {
  Write-Host ''
  Write-Host "=== $target ===" -ForegroundColor Cyan
  $serial = Connect-Tv $target
  if (-not $serial) { $results += [pscustomobject]@{ TV = $target; Result = 'unreachable' }; continue }
  Write-Host '  installing MSIGN...'
  $install = Invoke-Tool $sdb @('-s', $serial, 'install', $wgtFile.FullName)
  if ($install -notmatch '(?i)ok|success|install completed') {
    Write-Host "  Install failed: $install" -ForegroundColor Red
    Write-Host '  A signature / DUID error means this TV''s DUID is not in the distributor certificate the package was signed with.' -ForegroundColor Yellow
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
