@echo off
setlocal

set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe
set OUTDIR=%~dp0bin

if not exist "%OUTDIR%" mkdir "%OUTDIR%"

"%CSC%" /nologo /target:winexe /out:"%OUTDIR%\AccountingNumberKorean.exe" /r:System.Numerics.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll "%~dp0Program.cs"
if errorlevel 1 exit /b 1

"%CSC%" /nologo /target:winexe /out:"%OUTDIR%\AccountingNumberHotkey.exe" /r:System.Numerics.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll "%~dp0HotkeyProgram.cs"
if errorlevel 1 exit /b 1

echo Built: %OUTDIR%\AccountingNumberKorean.exe
echo Built: %OUTDIR%\AccountingNumberHotkey.exe
