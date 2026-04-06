@echo off
setlocal
set "NODE_DIR=%~dp0.tools\node-v25.8.1-win-x64"
if not exist "%NODE_DIR%\npm.cmd" (
  echo Portable Node.js was not found in "%NODE_DIR%".
  exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
call "%NODE_DIR%\npm.cmd" run dist:win
