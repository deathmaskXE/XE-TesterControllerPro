# XE Controller Lab Pro v2

Diagnóstico web para mandos. La interfaz usa negro, cyan neón y plata.

## Xbox One 1708 · flujo DriftGuard

La calibración del 1708 pertenece a DriftGuard. XE Controller Lab Pro solo integra el flujo:

1. Selecciona **Abrir DriftGuard** y completa la calibración en su sitio.
2. Selecciona **He terminado la calibración**. XE descarga el restaurador incluido para el driver Xbox original.
3. Ejecuta `RESTAURAR-XBOX-1708.bat` como administrador y reconecta el control.
4. La aplicación detecta el control mediante Gamepad API e inicia el test de circularidad.

Una página web no puede ejecutar archivos `.bat`/PowerShell ni modificar drivers de Windows sin intervención del usuario; el restaurador sigue estando bloqueado al VID/PID `045E:02EA`.

## Xbox Series 1914

El flujo y la calibración existentes del Xbox Series 1914 (`045E:0B12`) se conservan sin cambios.
