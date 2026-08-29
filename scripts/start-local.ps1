param([switch]$WithRunner)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
. "$PSScriptRoot\import-project-env.ps1"

$web = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $ProjectRoot -PassThru
if ($WithRunner) {
  Start-Process -FilePath "npm.cmd" -ArgumentList "--prefix", "runner", "run", "start" -WorkingDirectory $ProjectRoot | Out-Null
}
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
Write-Host "바를정 로컬 관리자 PID: $($web.Id)"
Write-Host "종료하려면 열린 개발 서버 창에서 Ctrl+C를 누르세요."
