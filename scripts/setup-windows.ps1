param([switch]$InstallMissing)
$ErrorActionPreference = "Stop"

$requirements = @(
  @{ Name = "Git"; Command = "git"; Winget = "Git.Git" },
  @{ Name = "Node.js 24 LTS"; Command = "node"; Winget = "OpenJS.NodeJS.LTS" },
  @{ Name = "Python 3.13+"; Command = "python"; Winget = "Python.Python.3.13" }
)

foreach ($item in $requirements) {
  if (Get-Command $item.Command -ErrorAction SilentlyContinue) {
    Write-Host "[OK] $($item.Name)"
  } elseif ($InstallMissing) {
    winget install --id $item.Winget --exact --accept-package-agreements --accept-source-agreements
  } else {
    Write-Host "[필요] $($item.Name): winget install --id $($item.Winget) --exact"
  }
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "[필요] Supabase CLI: scoop install supabase 또는 공식 문서의 Windows 설치 방법을 사용하세요."
} else { Write-Host "[OK] Supabase CLI $(supabase --version)" }

if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
  Write-Host "[설치] Vercel CLI를 최신판으로 맞춥니다."
  npm.cmd install --global vercel@latest
  if (-not (Get-Command vercel.cmd -ErrorAction SilentlyContinue)) { throw "Vercel CLI 설치 후 명령을 찾을 수 없습니다. 새 PowerShell에서 다시 실행하세요." }
  Write-Host "[OK] Vercel CLI $(vercel.cmd --version)"
} else {
  Write-Host "[보류] Node.js 설치 후 새 PowerShell에서 이 스크립트를 다시 실행하면 Vercel CLI 최신판을 설치합니다."
}

Write-Host "설치 후 새 PowerShell을 열고 .\scripts\bootstrap-windows.ps1 을 실행하세요."
