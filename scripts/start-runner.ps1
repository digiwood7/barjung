$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
. "$PSScriptRoot\import-project-env.ps1"

$createdNew = $false
$runnerMutex = New-Object System.Threading.Mutex($true, "Global\BarjungWindowsRunner", [ref]$createdNew)
if (-not $createdNew) {
    Write-Host "바를정 Windows 실행기가 이미 실행 중입니다. 중복 실행을 종료합니다."
    $runnerMutex.Dispose()
    exit 0
}

try {
    Write-Host "바를정 Windows 실행기를 시작합니다. 웹서버는 실행하지 않습니다."
    npm.cmd --prefix runner run start
    $runnerExitCode = $LASTEXITCODE
} finally {
    try { $runnerMutex.ReleaseMutex() } catch { }
    $runnerMutex.Dispose()
}

exit $runnerExitCode
