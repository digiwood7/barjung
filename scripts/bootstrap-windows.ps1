$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js가 없습니다. setup-windows.ps1을 먼저 실행하세요." }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python이 없습니다. setup-windows.ps1을 먼저 실행하세요." }

npm ci
npm ci --prefix runner

if (-not (Test-Path "python\.venv")) { python -m venv "python\.venv" }
& "python\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "python\.venv\Scripts\python.exe" -m pip install -r "python\requirements.lock"
& "python\.venv\Scripts\python.exe" -m pip install --no-deps -e ".\python"
npx playwright install chromium

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host ".env.local 예제 파일을 만들었습니다. 고객 계정값은 배포 전에 직접 입력하세요."
}

Write-Host "설치 완료. .\scripts\start-local.ps1 을 실행하세요."
