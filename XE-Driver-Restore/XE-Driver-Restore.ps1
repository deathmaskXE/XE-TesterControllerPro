$ErrorActionPreference = "Stop"
$Log = Join-Path $PSScriptRoot "XE-Driver-Restore.log"
Start-Transcript -Path $Log -Append
try {
  Write-Host "XE DRIVER RESTORE - XBOX SERIES 1914 - 045E:0B12" -ForegroundColor Cyan
  Write-Host "Este proceso NO modifica el restaurador Xbox One 1708." -ForegroundColor White
  $target = "VID_045E&PID_0B12"
  $all = @(Get-PnpDevice | Where-Object { $_.InstanceId -and $_.InstanceId.ToUpper().Contains($target) })
  if ($all.Count -eq 0) {
    Write-Host "Buscando nuevamente el control..." -ForegroundColor White
    & pnputil.exe /scan-devices | Out-Host
    Start-Sleep -Seconds 2
    $all = @(Get-PnpDevice | Where-Object { $_.InstanceId -and $_.InstanceId.ToUpper().Contains($target) })
  }
  if ($all.Count -eq 0) { throw "No se detecta 045E:0B12. Conecta SOLO el Xbox Series 1914 por USB." }
  $targets = @()
  $infs = @()
  foreach ($d in $all) {
    $svc = ""
    $inf = ""
    try { $svc = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_Service').Data } catch {}
    try { $inf = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath').Data } catch {}
    Write-Host "$($d.InstanceId) | Servicio=$svc | INF=$inf"
    if ([string]::Equals([string]$svc, "WinUSB", [System.StringComparison]::OrdinalIgnoreCase)) {
      $targets += $d
      if ($inf -match '^oem\d+\.inf$') { $infs += $inf }
    }
  }
  if ($targets.Count -eq 0) {
    Write-Host "El 1914 ya no usa WinUSB. Se forzara su deteccion con el driver original." -ForegroundColor Cyan
    & pnputil.exe /scan-devices | Out-Host
    Write-Host "RESTORE TERMINADO. Desconecta 5 segundos y reconecta el control." -ForegroundColor Green
    return
  }
  if ($infs.Count -eq 0) { throw "Se detecto WinUSB, pero Windows no informo un paquete OEM valido. Revisa el log." }
  $c = Read-Host "Escribe RESTAURAR para continuar"
  if ($c -ne "RESTAURAR") { Write-Host "Cancelado."; return }
  foreach ($d in $targets) { & pnputil.exe /remove-device "$($d.InstanceId)" | Out-Host }
  foreach ($inf in @($infs | Select-Object -Unique)) {
    & pnputil.exe /delete-driver "$inf" /uninstall /force | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "No se pudo eliminar $inf. Codigo $LASTEXITCODE" }
  }
  & pnputil.exe /scan-devices | Out-Host
  Write-Host "RESTORE TERMINADO. Desconecta 5 segundos y reconecta el Xbox Series 1914." -ForegroundColor Green
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
} finally {
  Stop-Transcript
  Write-Host ""
  Write-Host "Log guardado en: $Log" -ForegroundColor White
  Read-Host "PRESIONA ENTER PARA CERRAR"
}
