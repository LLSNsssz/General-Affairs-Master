[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath,
  [ValidateSet("run", "preview", "list-windows", "list-child")]
  [string]$Mode = "run"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config file not found: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$backendPath = Join-Path $PSScriptRoot "run-enhance-macro.ps1"

if (-not (Test-Path -LiteralPath $backendPath)) {
  throw "Backend script not found: $backendPath"
}

function Get-ConfigProperty {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Object,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    $Fallback = $null
  )

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $Fallback
  }

  if ($null -eq $property.Value) {
    return $Fallback
  }

  return $property.Value
}

function Add-IfValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$Hashtable,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    $Value
  )

  if ($null -eq $Value) {
    return
  }

  if ($Value -is [string] -and [string]::IsNullOrWhiteSpace($Value)) {
    return
  }

  $Hashtable[$Name] = $Value
}

$splat = @{
  RegionLeft      = [int](Get-ConfigProperty -Object $config -Name "regionLeft" -Fallback 1)
  RegionTop       = [int](Get-ConfigProperty -Object $config -Name "regionTop" -Fallback 1)
  RegionWidth     = [int](Get-ConfigProperty -Object $config -Name "regionWidth" -Fallback 1)
  RegionHeight    = [int](Get-ConfigProperty -Object $config -Name "regionHeight" -Fallback 1)
  CaptureMode     = [string](Get-ConfigProperty -Object $config -Name "captureMode" -Fallback "screen")
  SendMode        = [string](Get-ConfigProperty -Object $config -Name "sendMode" -Fallback "background")
  CommandInputMode = [string](Get-ConfigProperty -Object $config -Name "commandInputMode" -Fallback "full-paste")
  RandomDelayMs   = [int](Get-ConfigProperty -Object $config -Name "randomDelayMs" -Fallback 900)
  ResponseDelayMs = [int](Get-ConfigProperty -Object $config -Name "responseDelayMs" -Fallback 2200)
  CountdownSeconds = [int](Get-ConfigProperty -Object $config -Name "countdownSeconds" -Fallback 0)
  GhostAlpha      = [int](Get-ConfigProperty -Object $config -Name "ghostAlpha" -Fallback 1)
}

Add-IfValue -Hashtable $splat -Name "WindowTitleKeyword" -Value (Get-ConfigProperty -Object $config -Name "windowTitleKeyword" -Fallback "")
Add-IfValue -Hashtable $splat -Name "ProcessNameKeyword" -Value (Get-ConfigProperty -Object $config -Name "processNameKeyword" -Fallback "KakaoTalk")
Add-IfValue -Hashtable $splat -Name "CommandText" -Value (Get-ConfigProperty -Object $config -Name "commandText" -Fallback "")
Add-IfValue -Hashtable $splat -Name "TargetLevel" -Value ([int](Get-ConfigProperty -Object $config -Name "targetLevel" -Fallback 25))
Add-IfValue -Hashtable $splat -Name "MaxAttempts" -Value ([int](Get-ConfigProperty -Object $config -Name "maxAttempts" -Fallback 500))
Add-IfValue -Hashtable $splat -Name "MaxMisses" -Value ([int](Get-ConfigProperty -Object $config -Name "maxMisses" -Fallback 8))

$inputClassHints = Get-ConfigProperty -Object $config -Name "inputClassHints" -Fallback @()
if ($inputClassHints) {
  $splat["InputClassHints"] = @($inputClassHints | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) })
}

if ([bool](Get-ConfigProperty -Object $config -Name "restoreClipboard" -Fallback $true)) {
  $splat["RestoreClipboard"] = $true
}

if ([bool](Get-ConfigProperty -Object $config -Name "ghostForeground" -Fallback $false)) {
  $splat["GhostForeground"] = $true
}

if ([bool](Get-ConfigProperty -Object $config -Name "autoChatScan" -Fallback $true)) {
  $splat["AutoChatScan"] = $true
}

switch ($Mode) {
  "preview" {
    $splat["PreviewOnly"] = $true
  }
  "list-windows" {
    $splat["ListWindows"] = $true
  }
  "list-child" {
    $splat["ListChildWindows"] = $true
  }
}

if ($Mode -eq "run" -and [bool](Get-ConfigProperty -Object $config -Name "sendOnly" -Fallback $false)) {
  $splat["SendOnly"] = $true
}

& $backendPath @splat
