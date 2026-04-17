@echo off
setlocal

set "STATE_FILE=%~dp0network_adapter_state.txt"

net session >nul 2>&1
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo Disabling wired Ethernet adapters...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $stateFile = '%STATE_FILE%'; if (-not (Get-Command Get-NetAdapter -ErrorAction SilentlyContinue)) { Write-Host 'Get-NetAdapter is not available on this PC.'; exit 1 }; $patterns = 'Hyper-V|Virtual|VPN|Loopback|Bluetooth|Wireless|Wi-?Fi|WLAN'; $adapters = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Disabled' -and $_.HardwareInterface -eq $true -and $_.Virtual -eq $false -and $_.PhysicalMediaType -eq '802.3' -and $_.InterfaceDescription -notmatch $patterns -and $_.Name -notmatch $patterns }; if (-not $adapters) { Write-Host 'No enabled wired Ethernet adapters found.'; if (Test-Path $stateFile) { Remove-Item $stateFile -Force }; exit 0 }; $adapters.Name | Set-Content -Path $stateFile -Encoding UTF8; foreach ($adapter in $adapters) { Write-Host ('Disabling: ' + $adapter.Name); Disable-NetAdapter -Name $adapter.Name -Confirm:$false | Out-Null }; Write-Host ''; Write-Host 'Saved disabled adapter list to:' $stateFile; Write-Host 'Wired Ethernet adapters disabled.' }"

echo.
pause
