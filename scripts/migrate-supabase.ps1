param([Parameter(Mandatory = $true)][string]$ProjectRef)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) { throw "Supabase CLI를 먼저 설치하세요." }
supabase login
supabase link --project-ref $ProjectRef
supabase db push --include-seed
supabase gen types typescript --linked --schema public | Set-Content -Encoding UTF8 "src\lib\supabase\database.generated.types.ts"
Write-Host "고객 Supabase migration과 타입 생성을 완료했습니다."
