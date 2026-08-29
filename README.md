# 바를정 부동산 매물 배포 시스템

경북대 인근 원룸·투룸·오피스텔을 관리하고, 법정 고지사항과 플랫폼별 Playwright 게시 상태를 한 화면에서 관리하는 프로젝트입니다.

현재 저장소는 고객 계정이나 비밀값 없이 실행되는 demo mode와 고객 Supabase 이식용 전체 migration을 포함합니다. 네이버·인스타그램·당근·직방의 실제 게시 단계는 고객 Windows PC에서 headed Playwright로 하나씩 연결합니다.

## 빈 Windows PC에서 시작

PowerShell을 일반 사용자 권한으로 열어 아래 프로그램을 설치합니다.

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Python.Python.3.13 --exact
npm install -g vercel@latest
```

Supabase CLI는 [공식 CLI 설치 문서](https://supabase.com/docs/guides/local-development/cli/getting-started)를 따라 설치합니다. 로컬 Supabase 전체 스택과 DB 테스트까지 실행하려면 Docker Desktop도 필요하지만, 고객 원격 프로젝트에 `db push`만 할 때는 로컬 DB 실행이 필수는 아닙니다.

새 PowerShell을 열고 버전을 확인합니다.

```powershell
git --version
node --version
npm --version
python --version
supabase --version
vercel --version
```

저장소를 클론하고 프로젝트 전용 라이브러리를 설치합니다.

```powershell
git clone https://github.com/digiwood7/barjung.git
cd barjung
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
.\scripts\bootstrap-windows.ps1
```

`bootstrap-windows.ps1`은 이 프로젝트 안의 Node 패키지, `python\.venv`, Python 고정 의존성과 Playwright Chromium만 준비합니다. 고객이 명시적으로 실행하기 전에는 전역 Claude·Codex 설정이나 다른 프로젝트를 변경하지 않습니다.

`start-local.ps1`은 저장소 안 `.env.local`의 값만 현재 실행 프로세스에 불러오며 값을 화면에 출력하지 않습니다. 전역 환경변수나 다른 프로젝트 설정은 변경하지 않습니다.

로컬 관리자 화면을 엽니다.

```powershell
.\scripts\start-local.ps1
```

브라우저가 `http://localhost:3000`을 엽니다. 환경변수가 비어 있으면 비식별 demo data로 동작합니다.

## 고객 Supabase 연결

`.env.local`에 고객이 발급한 값만 입력합니다. 값을 Git에 올리지 않습니다.

```powershell
.\scripts\migrate-supabase.ps1 -ProjectRef "고객_프로젝트_REF"
```

이 명령은 `supabase link`, seed를 포함한 `supabase db push`, TypeScript 타입 생성을 순서대로 실행합니다. migration에는 전체 테이블, private Storage, RLS, Realtime과 queue lease가 포함됩니다.

## 로컬 실행기

고객 Supabase migration 후 `.env.local`에 실행기 전용 값을 넣고 실행합니다.

```powershell
.\scripts\start-local.ps1 -WithRunner
```

초기 네 플랫폼 어댑터는 실제 게시를 하지 않고 `not_configured`를 반환합니다. 자세한 현장 연결 순서는 [플랫폼 어댑터 가이드](docs/PLATFORM_ADAPTER_GUIDE.md)를 따릅니다.

## 테스트

```powershell
npm test
npm run build
npm --prefix runner test
npm --prefix runner run typecheck
python\.venv\Scripts\python.exe -m pytest python\tests -q
npx playwright test
```

Docker Desktop이 실행 중이면 다음 DB 검증도 수행합니다.

```powershell
supabase start
supabase db reset
supabase test db
supabase db lint --level error
supabase db advisors
```

## Vercel 배포

Vercel CLI는 오래된 버전을 사용하지 말고 항상 최신판으로 갱신합니다.

```powershell
npm install -g vercel@latest
vercel login
vercel link
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
vercel env add JUSO_API_KEY
vercel env add BUILDING_REGISTER_API_KEY
vercel deploy
vercel deploy --prod
```

인증 방식이 확정되기 전 Vercel 화면은 조회 용도로만 사용합니다. service role key는 브라우저용 `NEXT_PUBLIC_` 변수에 절대 넣지 않습니다. 상세 절차는 [배포 가이드](docs/DEPLOYMENT.md)를 확인합니다.

## 문서

- [제품 요구사항](PRD.MD)
- [고객 PC 설치](docs/CUSTOMER_INSTALL.md)
- [플랫폼 연결](docs/PLATFORM_ADAPTER_GUIDE.md)
- [Supabase·Vercel 배포](docs/DEPLOYMENT.md)
