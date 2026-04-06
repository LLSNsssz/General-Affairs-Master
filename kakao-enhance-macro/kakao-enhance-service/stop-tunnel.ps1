Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidPath = Join-Path $root "bin\\cloudflared.pid"

if (-not (Test-Path -LiteralPath $pidPath)) {
    Write-Output "cloudflared pid file not found."
    exit 0
}

$pid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
if ($pid) {
    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Output "cloudflared stopped."
