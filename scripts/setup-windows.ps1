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

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
  Write-Host "[필요] Vercel CLI 최신판: npm install -g vercel@latest"
} else { Write-Host "[OK] Vercel CLI $(vercel --version)" }

Write-Host "설치 후 새 PowerShell을 열고 .\scripts\bootstrap-windows.ps1 을 실행하세요."
