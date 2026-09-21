@echo off
setlocal
cd /d "%~dp0"
title XE DRIVER RESTORE - XBOX SERIES 1914
echo Iniciando XE Driver Restore...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0XE-Driver-Restore.ps1"
set "XE_RESTORE_EXIT=%ERRORLEVEL%"
echo.
if not "%XE_RESTORE_EXIT%"=="0" echo El restaurador termino con codigo %XE_RESTORE_EXIT%.
echo Log: %~dp0XE-Driver-Restore.log
pause
exit /b %XE_RESTORE_EXIT%
