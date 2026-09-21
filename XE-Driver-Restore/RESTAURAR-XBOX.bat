@echo off
setlocal
cd /d "%~dp0"
title XE DRIVER RESTORE - XBOX SERIES 1914

if not exist "%~dp0XE-Driver-Restore.ps1" (
  echo ERROR: No se encontro XE-Driver-Restore.ps1 en esta carpeta.
  echo Descomprime todos los archivos del ZIP antes de ejecutar el restaurador.
  echo.
  pause
  exit /b 2
)

rem Comprobar elevacion sin ejecutar ninguna operacion de drivers.
powershell.exe -NoLogo -NoProfile -Command "$p=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); if($p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){exit 0}else{exit 1}"
if errorlevel 1 (
  echo Solicitando permiso de administrador...
  set "XE_RESTORE_LAUNCHER=%~f0"
  powershell.exe -NoLogo -NoProfile -Command "try { Start-Process -FilePath $env:ComSpec -Verb RunAs -ArgumentList '/d','/c',('^"^"'+$env:XE_RESTORE_LAUNCHER+'^" elevated^"'); exit 0 } catch { Write-Host ('ERROR AL SOLICITAR ADMINISTRADOR: '+$_.Exception.Message) -ForegroundColor Red; exit 1 }"
  if errorlevel 1 (
    echo.
    echo No se pudo abrir la consola administrativa. No se realizaron cambios.
    pause
    exit /b 3
  )
  exit /b 0
)

echo Iniciando restaurador en consola administrativa...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0XE-Driver-Restore.ps1"
set "XE_RESTORE_EXIT=%ERRORLEVEL%"
echo.
if not "%XE_RESTORE_EXIT%"=="0" echo El restaurador termino con codigo %XE_RESTORE_EXIT%.
echo Log: %~dp0XE-Driver-Restore.log
pause
exit /b %XE_RESTORE_EXIT%
