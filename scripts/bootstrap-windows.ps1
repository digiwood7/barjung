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

& "$PSScriptRoot\install-runner-autostart.ps1"
. "$PSScriptRoot\import-project-env.ps1"
if ($env:SUPABASE_URL -and $env:SUPABASE_SERVICE_ROLE_KEY -and $env:BARJUNG_AGENT_ID) {
  Start-ScheduledTask -TaskName "Barjung Windows Runner"
  Write-Host "설치 완료. Windows 실행기를 백그라운드로 시작했습니다. barjeong.vercel.app을 사용하세요."
} else {
  Write-Host "설치 완료. .env.local 값을 채운 뒤 .\scripts\start-runner.ps1 을 한 번 실행하세요."
}
Write-Host "localhost 웹서버는 필요하지 않습니다."
