@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0XE-Driver-Restore.ps1""'"
echo.
echo Si la ventana anterior se cerro, revisa XE-Driver-Restore.log.
pause
