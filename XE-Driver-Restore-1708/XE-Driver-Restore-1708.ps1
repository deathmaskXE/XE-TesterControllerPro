$ErrorActionPreference="Stop"
$Log=Join-Path $PSScriptRoot "XE-Driver-Restore-1708.log"
Start-Transcript -Path $Log -Append
try{
 Write-Host "XE DRIVER RESTORE - XBOX ONE 1708 - 045E:02EA" -ForegroundColor Yellow
 $target="VID_045E&PID_02EA"
 $all=@(Get-PnpDevice | Where-Object {$_.InstanceId -and $_.InstanceId.ToUpper().Contains($target)})
 if($all.Count -eq 0){& pnputil.exe /scan-devices | Out-Host;Start-Sleep 2;$all=@(Get-PnpDevice | Where-Object {$_.InstanceId -and $_.InstanceId.ToUpper().Contains($target)})}
 if($all.Count -eq 0){throw "No se detecta 045E:02EA. Conecta SOLO el 1708 por USB."}
 $targets=@();$infs=@()
 foreach($d in $all){
  $svc="";$inf=""
  try{$svc=(Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_Service').Data}catch{}
  try{$inf=(Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath').Data}catch{}
  Write-Host "$($d.InstanceId) | Servicio=$svc | INF=$inf"
  if($svc -eq "WinUSB"){$targets+=$d;if($inf -match '^oem\d+\.inf$'){$infs+=$inf}}
 }
 if($targets.Count -eq 0){Write-Host "El 1708 ya no usa WinUSB. Forzando reenumeracion..." -ForegroundColor Yellow;& pnputil.exe /scan-devices | Out-Host;return}
 $c=Read-Host "Escribe RESTAURAR para continuar"
 if($c -ne "RESTAURAR"){Write-Host "Cancelado";return}
 foreach($d in $targets){& pnputil.exe /remove-device "$($d.InstanceId)" | Out-Host}
 foreach($inf in @($infs|Select-Object -Unique)){& pnputil.exe /delete-driver "$inf" /uninstall /force | Out-Host}
 & pnputil.exe /scan-devices | Out-Host
 Write-Host "RESTORE TERMINADO. Desconecta 5 segundos y reconecta el 1708." -ForegroundColor Green
}catch{Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red}
finally{Stop-Transcript;Write-Host "Log: $Log";Read-Host "PRESIONA ENTER PARA CERRAR"}
