@echo off
setlocal

set EXE=%~dp0bin\AccountingNumberHotkey.exe

if not exist "%EXE%" (
  call "%~dp0build.cmd" || exit /b 1
)

start "" "%EXE%"
