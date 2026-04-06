Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$storePath = Join-Path $root "bin\\data\\store.json"

if (Test-Path -LiteralPath $storePath) {
    Remove-Item -LiteralPath $storePath -Force
    Write-Output "store reset: $storePath"
} else {
    Write-Output "store not found: $storePath"
}
