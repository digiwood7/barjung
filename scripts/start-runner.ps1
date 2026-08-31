$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
. "$PSScriptRoot\import-project-env.ps1"

Write-Host "바를정 Windows 실행기를 시작합니다. 웹서버는 실행하지 않습니다."
npm.cmd --prefix runner run start
