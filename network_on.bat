@echo off
setlocal

set "STATE_FILE=%~dp0network_adapter_state.txt"

net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Enabling wired Ethernet adapters...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $stateFile = '%STATE_FILE%'; if (-not (Get-Command Get-NetAdapter -ErrorAction SilentlyContinue)) { Write-Host 'Get-NetAdapter is not available on this PC.'; exit 1 }; $patterns = 'Hyper-V|Virtual|VPN|Loopback|Bluetooth|Wireless|Wi-?Fi|WLAN'; $adapters = @(); if (Test-Path $stateFile) { $names = Get-Content -Path $stateFile | Where-Object { $_ -and $_.Trim() }; foreach ($name in $names) { $adapter = Get-NetAdapter -Name $name -ErrorAction SilentlyContinue; if ($adapter -and $adapter.Status -eq 'Disabled' -and $adapter.HardwareInterface -eq $true -and $adapter.Virtual -eq $false -and $adapter.PhysicalMediaType -eq '802.3' -and $adapter.InterfaceDescription -notmatch $patterns -and $adapter.Name -notmatch $patterns) { $adapters += $adapter } } } else { $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Disabled' -and $_.HardwareInterface -eq $true -and $_.Virtual -eq $false -and $_.PhysicalMediaType -eq '802.3' -and $_.InterfaceDescription -notmatch $patterns -and $_.Name -notmatch $patterns } }; if (-not $adapters) { Write-Host 'No wired Ethernet adapters to enable.'; if (Test-Path $stateFile) { Remove-Item $stateFile -Force }; exit 0 }; foreach ($adapter in $adapters) { Write-Host ('Enabling: ' + $adapter.Name); Enable-NetAdapter -Name $adapter.Name -Confirm:$false | Out-Null }; if (Test-Path $stateFile) { Remove-Item $stateFile -Force }; Write-Host ''; Write-Host 'Wired Ethernet adapters enabled.' }"

echo.
pause
