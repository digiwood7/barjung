param([switch]$StartNow)
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RunnerScript = Join-Path $PSScriptRoot "start-runner.ps1"
$TaskName = "Barjung Windows Runner"
$CurrentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name

if (-not (Test-Path -LiteralPath $RunnerScript)) {
  throw "Runner start script was not found: $RunnerScript"
}

$PowerShellPath = Join-Path $PSHOME "powershell.exe"
$Action = New-ScheduledTaskAction `
  -Execute $PowerShellPath `
  -Argument "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RunnerScript`"" `
  -WorkingDirectory $ProjectRoot
$Trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $Action `
  -Trigger $Trigger `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Barjung media optimization and platform publishing runner" `
  -Force | Out-Null

if ($StartNow) {
  Start-ScheduledTask -TaskName $TaskName
}

$Task = Get-ScheduledTask -TaskName $TaskName
Write-Host "[OK] $TaskName autostart registered (state: $($Task.State))"
Write-Host "The runner will start in the background at Windows logon without a localhost web server."
