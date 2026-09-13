@echo off
cd /d "%~dp0"
net session >nul 2>&1
if %errorlevel% neq 0 (
 powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
 exit /b
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0XE-Driver-Restore-1708.ps1"
pause
