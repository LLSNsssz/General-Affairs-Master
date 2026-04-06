$scriptPath = Join-Path $PSScriptRoot "..\run-enhance-macro.ps1"

& $scriptPath `
  -RegionLeft 1 `
  -RegionTop 1 `
  -RegionWidth 1 `
  -RegionHeight 1 `
  -ListWindows
