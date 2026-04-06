@echo off
setlocal

set ROOT=%~dp0
set PREFIX=%~1
if "%PREFIX%"=="" set PREFIX=http://localhost:5088/

if not exist "%ROOT%bin\KakaoEnhanceService.exe" (
  call "%ROOT%build.cmd" || exit /b 1
)

"%ROOT%bin\KakaoEnhanceService.exe" "%PREFIX%"
