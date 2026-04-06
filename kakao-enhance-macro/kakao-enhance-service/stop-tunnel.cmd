@echo off
setlocal
powershell.exe -ExecutionPolicy Bypass -File "%~dp0stop-tunnel.ps1"
