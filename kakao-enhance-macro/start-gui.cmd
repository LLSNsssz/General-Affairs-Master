@echo off
setlocal
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%CSC%" (
  echo C# compiler not found.
  pause
  exit /b 1
)

"%CSC%" /nologo /target:winexe /out:"%~dp0KakaoEnhanceStudio.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll "%~dp0KakaoEnhanceStudio.cs"
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

start "" "%~dp0KakaoEnhanceStudio.exe"
