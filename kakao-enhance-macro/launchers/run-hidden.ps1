[CmdletBinding()]
param(
  [int]$TargetLevel = 25,
  [int]$RegionLeft = 1200,
  [int]$RegionTop = 180,
  [int]$RegionWidth = 180,
  [int]$RegionHeight = 70,
  [int]$ResponseDelayMs = 2200,
  [string]$ProcessNameKeyword = "KakaoTalk",
  [string]$CommandText = ([string]::Concat([char]0xAC15, [char]0xD654))
)

$scriptPath = Join-Path $PSScriptRoot "..\run-enhance-macro.ps1"

& $scriptPath `
  -ProcessNameKeyword $ProcessNameKeyword `
  -CommandText $CommandText `
  -TargetLevel $TargetLevel `
  -RegionLeft $RegionLeft `
  -RegionTop $RegionTop `
  -RegionWidth $RegionWidth `
  -RegionHeight $RegionHeight `
  -CaptureMode window `
  -SendMode background `
  -ResponseDelayMs $ResponseDelayMs `
  -RestoreClipboard
