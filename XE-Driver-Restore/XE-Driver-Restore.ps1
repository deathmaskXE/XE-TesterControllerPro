$ErrorActionPreference = "Stop"
$Log = Join-Path $PSScriptRoot "XE-Driver-Restore.log"
$TargetHardwareId = "VID_045E&PID_0B12"
$TranscriptStarted = $false

function Get-DevicePropertyData {
  param([string]$InstanceId, [string]$KeyName, [switch]$AllowMissing)
  try {
    return (Get-PnpDeviceProperty -InstanceId $InstanceId -KeyName $KeyName -ErrorAction Stop).Data
  } catch {
    if ($AllowMissing) { return $null }
    throw "No se pudo leer $KeyName para '$InstanceId': $($_.Exception.Message)"
  }
}

function Format-CommandArgument {
  param([string]$Value)
  if ($Value -match '[\s&()]') { return '"' + $Value.Replace('"', '\"') + '"' }
  return $Value
}

function Invoke-PnpUtil {
  param([Parameter(Mandatory=$true)][string[]]$Arguments, [switch]$AllowFailure)
  $shown = (@("pnputil.exe") + @($Arguments | ForEach-Object { Format-CommandArgument $_ })) -join " "
  Write-Host "COMANDO: $shown" -ForegroundColor Cyan
  $output = @(& "$env:SystemRoot\System32\pnputil.exe" @Arguments 2>&1 | ForEach-Object { $_.ToString() })
  $code = $LASTEXITCODE
  foreach ($line in $output) { Write-Host "  $line" }
  Write-Host "CODIGO DE SALIDA: $code"
  if (($code -ne 0) -and -not $AllowFailure) {
    throw "PnPUtil fallo con codigo $code al ejecutar: $shown"
  }
  return [pscustomobject]@{ ExitCode = $code; Output = ($output -join [Environment]::NewLine) }
}

function Get-Xbox1914Devices {
  param([switch]$PresentOnly)
  $parameters = @{}
  if ($PresentOnly) { $parameters.PresentOnly = $true }
  $matches = @()
  foreach ($device in @(Get-PnpDevice @parameters -ErrorAction SilentlyContinue)) {
    if (-not $device.InstanceId) { continue }
    $hardwareIds = @(Get-DevicePropertyData -InstanceId $device.InstanceId -KeyName 'DEVPKEY_Device_HardwareIds' -AllowMissing)
    if (@($hardwareIds | Where-Object { $_ -and $_.ToUpperInvariant().Contains($TargetHardwareId) }).Count -gt 0) {
      $matches += [pscustomobject]@{ Device = $device; HardwareIds = $hardwareIds }
    }
  }
  return @($matches)
}

function Get-DriverState {
  param([string]$InstanceId)
  $device = Get-PnpDevice -InstanceId $InstanceId -ErrorAction SilentlyContinue
  if (-not $device) { return $null }
  return [pscustomobject]@{
    Device = $device
    Service = Get-DevicePropertyData -InstanceId $InstanceId -KeyName 'DEVPKEY_Device_Service' -AllowMissing
    Inf = Get-DevicePropertyData -InstanceId $InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath' -AllowMissing
    HardwareIds = @(Get-DevicePropertyData -InstanceId $InstanceId -KeyName 'DEVPKEY_Device_HardwareIds' -AllowMissing)
  }
}

function Write-DriverState {
  param([string]$Title, $State)
  Write-Host $Title -ForegroundColor Cyan
  if (-not $State) { Write-Host "  Dispositivo no presente"; return }
  Write-Host "  Nombre: $($State.Device.FriendlyName)"
  Write-Host "  Instance ID: $($State.Device.InstanceId)"
  Write-Host "  Hardware ID(s): $(@($State.HardwareIds) -join '; ')"
  Write-Host "  Estado PnP: $($State.Device.Status)"
  Write-Host "  Servicio: $($State.Service)"
  Write-Host "  INF: $($State.Inf)"
}

try {
  try {
    Start-Transcript -Path $Log -Append -ErrorAction Stop | Out-Null
    $TranscriptStarted = $true
  } catch {
    Write-Host "AVISO: No se pudo abrir el log '$Log': $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "El diagnostico continuara visible en esta ventana."
  }
  Write-Host "XE DRIVER RESTORE - XBOX SERIES 1914" -ForegroundColor Yellow
  Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
  Write-Host "Windows: $([Environment]::OSVersion.VersionString)"

  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "El restaurador debe ejecutarse como administrador."
  }

  $present = @(Get-Xbox1914Devices -PresentOnly)
  if ($present.Count -ne 1) {
    throw "No se puede identificar el control con seguridad: se requiere exactamente un dispositivo presente con Hardware ID USB VID_045E&PID_0B12. Detectados: $($present.Count)."
  }

  $instanceId = $present[0].Device.InstanceId
  if ($instanceId -notmatch '^USB\\') {
    throw "El dispositivo coincide en VID/PID pero su Instance ID no es una instancia USB directa: $instanceId. No se realizaran cambios."
  }
  $before = Get-DriverState -InstanceId $instanceId
  Write-DriverState -Title "CONTROL XBOX SERIES 1914 DETECTADO" -State $before

  if (-not $before.Service -or $before.Service -ine "WinUSB") {
    throw "El control seleccionado no usa WinUSB. Servicio detectado: '$($before.Service)'. No es necesario ni seguro retirar un paquete."
  }
  $winUsbInf = [string]$before.Inf
  if ($winUsbInf -notmatch '^oem\d+\.inf$') {
    throw "El INF asociado a WinUSB no es un paquete OEM valido: '$winUsbInf'. No se realizaran cambios."
  }

  # Un paquete OEM puede estar asignado a instancias no presentes. Se revisan todas antes de borrarlo.
  $packageUsers = @()
  foreach ($candidate in @(Get-PnpDevice -ErrorAction SilentlyContinue)) {
    if (-not $candidate.InstanceId) { continue }
    $candidateInf = Get-DevicePropertyData -InstanceId $candidate.InstanceId -KeyName 'DEVPKEY_Device_DriverInfPath' -AllowMissing
    if ([string]$candidateInf -ine $winUsbInf) { continue }
    $ids = @(Get-DevicePropertyData -InstanceId $candidate.InstanceId -KeyName 'DEVPKEY_Device_HardwareIds' -AllowMissing)
    $isTarget = @($ids | Where-Object { $_ -and $_.ToUpperInvariant().Contains($TargetHardwareId) }).Count -gt 0
    $packageUsers += [pscustomobject]@{ InstanceId = $candidate.InstanceId; HardwareIds = $ids; IsTarget = $isTarget }
  }
  Write-Host "Instancias asociadas a ${winUsbInf}: $($packageUsers.Count)"
  foreach ($user in $packageUsers) {
    Write-Host "  $($user.InstanceId) | HWID: $(@($user.HardwareIds) -join '; ') | Es1914: $($user.IsTarget)"
  }
  $foreignUsers = @($packageUsers | Where-Object { -not $_.IsTarget })
  if ($foreignUsers.Count -gt 0) {
    throw "El paquete $winUsbInf tambien esta asignado a $($foreignUsers.Count) dispositivo(s) que no son Xbox Series 1914. Se detiene para no afectar otros dispositivos USB."
  }
  if (@($packageUsers | Where-Object IsTarget).Count -eq 0) {
    throw "No se pudo demostrar que $winUsbInf pertenece al control seleccionado. No se realizaran cambios."
  }

  $help = Invoke-PnpUtil -Arguments @('/?') -AllowFailure
  $supportsScan = $help.Output -match '(?i)/scan-devices'
  Write-Host "PnPUtil soporta /scan-devices: $supportsScan"
  Write-Host "Preparado para restaurar driver original." -ForegroundColor Yellow
  $confirmation = Read-Host "Escribe RESTAURAR para continuar"
  if ($confirmation -cne "RESTAURAR") { Write-Host "Operacion cancelada. No se realizaron cambios."; return }

  # /delete-driver con /uninstall desvincula el paquete de sus dispositivos antes de borrarlo.
  # No se usa /remove-device: no existe en varias versiones de Windows y era la causa de la ayuda de PnPUtil.
  Invoke-PnpUtil -Arguments @('/delete-driver', $winUsbInf, '/uninstall', '/force') | Out-Null
  if ($supportsScan) {
    Invoke-PnpUtil -Arguments @('/scan-devices') | Out-Null
  } else {
    Write-Host "Esta version de PnPUtil no incluye /scan-devices; se usara la reenumeracion automatica de Plug and Play."
  }

  $final = $null
  for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Seconds 1
    $final = Get-DriverState -InstanceId $instanceId
    if ($final -and $final.Service -and $final.Service -ine 'WinUSB') { break }
  }
  if (-not $final -or -not $final.Service -or $final.Service -ieq 'WinUSB') {
    Write-Host "Windows aun no termino de enumerar el control. Desconectalo, espera 5 segundos, vuelve a conectarlo y presiona ENTER." -ForegroundColor Yellow
    Read-Host | Out-Null
    $reconnected = @(Get-Xbox1914Devices -PresentOnly)
    if ($reconnected.Count -ne 1) {
      throw "Tras la reconexion no se detecto exactamente un Xbox Series 1914. Detectados: $($reconnected.Count)."
    }
    $instanceId = $reconnected[0].Device.InstanceId
    $final = Get-DriverState -InstanceId $instanceId
  }

  Write-DriverState -Title "DRIVER FINAL" -State $final
  if (-not $final) { throw "El control no esta presente despues de la restauracion." }
  if (-not $final.Service) { throw "Windows detecta el control, pero no informa un servicio de driver final." }
  if ($final.Service -ieq 'WinUSB') { throw "El control continua usando WinUSB ($($final.Inf)). Windows no reasocio el driver oficial." }

  Write-Host "DRIVER RESTAURADO CORRECTAMENTE" -ForegroundColor Green
  Write-Host "Control Xbox listo para utilizarse normalmente."
  Write-Host "Driver final: servicio '$($final.Service)', INF '$($final.Inf)'."
} catch {
  Write-Host "FALLO DE RESTAURACION: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "No se eliminaran otros paquetes ni dispositivos. Revisa este log para el diagnostico completo." -ForegroundColor Red
} finally {
  if ($TranscriptStarted) { Stop-Transcript | Out-Null }
  Write-Host ""
  if ($TranscriptStarted) { Write-Host "Log guardado en: $Log" }
  Read-Host "PRESIONA ENTER PARA CERRAR"
}
