@echo off
setlocal

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe

if not exist "%CSC%" (
  echo csc.exe not found.
  exit /b 1
)

set ROOT=%~dp0
set SRC=%ROOT%src\KakaoEnhanceService
set OUT=%ROOT%bin\KakaoEnhanceService.exe
set UIBIN=%ROOT%bin\ui

"%CSC%" /nologo /target:exe /out:"%OUT%" /r:System.Web.Extensions.dll /recurse:"%SRC%\*.cs"
if errorlevel 1 exit /b 1

if exist "%UIBIN%" rmdir /s /q "%UIBIN%"
mkdir "%UIBIN%" >nul 2>nul
xcopy /y /i "%ROOT%ui\*" "%UIBIN%\" >nul
