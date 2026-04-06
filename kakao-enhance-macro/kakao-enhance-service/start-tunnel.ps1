param(
    [string]$LocalUrl = "http://localhost:5088"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDir = Join-Path $root "tools"
$exe = Join-Path $toolsDir "cloudflared.exe"
$binDir = Join-Path $root "bin"
$pidPath = Join-Path $binDir "cloudflared.pid"
$urlPath = Join-Path $binDir "cloudflared-url.txt"
$stdoutPath = Join-Path $binDir "cloudflared-stdout.log"
$stderrPath = Join-Path $binDir "cloudflared-stderr.log"

if (-not (Test-Path -LiteralPath $exe)) {
    throw "cloudflared.exe not found at $exe"
}

$localUri = [Uri]$LocalUrl
$hostHeader = $localUri.Authority

if (Test-Path -LiteralPath $pidPath) {
    $oldPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
    if ($oldPid) {
        Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

$arguments = @(
    "tunnel",
    "--url", $LocalUrl,
    "--http-host-header", $hostHeader,
    "--no-autoupdate"
)

$process = Start-Process -FilePath $exe `
    -ArgumentList $arguments `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath

$process.Id | Set-Content -LiteralPath $pidPath -Encoding ASCII

$url = $null
for ($index = 0; $index -lt 60; $index++) {
    Start-Sleep -Milliseconds 500

    foreach ($path in @($stdoutPath, $stderrPath)) {
        if (-not (Test-Path -LiteralPath $path)) {
            continue
        }

        $content = Get-Content -LiteralPath $path -Raw -ErrorAction SilentlyContinue
        if (-not $content) {
            continue
        }

        $match = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($match.Success) {
            $url = $match.Value
            break
        }
    }

    if ($url) {
        break
    }

    if ($process.HasExited) {
        throw "cloudflared exited before a public URL was assigned."
    }
}

if (-not $url) {
    throw "Could not find the public trycloudflare URL in the logs."
}

$url | Set-Content -LiteralPath $urlPath -Encoding ASCII

[pscustomobject]@{
    Pid = $process.Id
    LocalUrl = $LocalUrl
    HostHeader = $hostHeader
    PublicUrl = $url
    UrlFile = $urlPath
    StdoutLog = $stdoutPath
    StderrLog = $stderrPath
} | ConvertTo-Json -Depth 4
