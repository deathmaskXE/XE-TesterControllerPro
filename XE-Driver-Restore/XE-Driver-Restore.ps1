$ErrorActionPreference = "Stop"
$Log = Join-Path $PSScriptRoot "XE-Driver-Restore.log"
Start-Transcript -Path $Log -Append
try {
  Write-Host "XE DRIVER RESTORE - XBOX SERIES 1914" -ForegroundColor Yellow
  $target = "VID_045E&PID_0B12"
  $dev = @(Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -and $_.InstanceId.ToUpper().Contains($target) })
  if ($dev.Count -ne 1) { throw "Se requiere exactamente un control 045E:0B12 conectado. Detectados: $($dev.Count)" }
  $d = $dev[0]
  $svc = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_Service').Data
  $inf = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath').Data
  Write-Host "Dispositivo: $($d.FriendlyName)"
  Write-Host "Servicio: $svc"
  Write-Host "INF: $inf"
  if ($svc -ne "WinUSB") { throw "El control objetivo no usa WinUSB. Servicio detectado: $svc" }
  if ($inf -notmatch '^oem\d+\.inf$') { throw "INF OEM no valido: $inf" }
  $c = Read-Host "Escribe RESTAURAR para continuar"
  if ($c -ne "RESTAURAR") { Write-Host "Cancelado."; return }
  & pnputil.exe /remove-device "$($d.InstanceId)"
  if ($LASTEXITCODE -ne 0) { throw "Fallo pnputil /remove-device. Codigo $LASTEXITCODE" }
  & pnputil.exe /delete-driver "$inf" /uninstall
  Write-Host "Codigo delete-driver: $LASTEXITCODE"
  & pnputil.exe /scan-devices
  Write-Host "Terminado. Desconecta el mando 5 segundos y vuelve a conectarlo." -ForegroundColor Green
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  Stop-Transcript
  Write-Host ""
  Write-Host "Log guardado en: $Log"
  Read-Host "PRESIONA ENTER PARA CERRAR"
}
