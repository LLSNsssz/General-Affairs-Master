param(
    [string]$BaseUrl = "http://localhost:5088",
    [ValidateSet("register", "status", "enhance")]
    [string]$Scenario = "status"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$samplePath = Join-Path $root ("samples\\openbuilder-{0}.json" -f $Scenario)

if (-not (Test-Path -LiteralPath $samplePath)) {
    throw "Sample payload not found: $samplePath"
}

$payload = Get-Content -LiteralPath $samplePath -Raw -Encoding UTF8
$uri = $BaseUrl.TrimEnd("/") + "/kakao/openbuilder/skill"

$response = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json; charset=utf-8" -Body $payload
$response | ConvertTo-Json -Depth 8
