# 바를정 부동산 매물 배포 시스템

경북대 인근 원룸·투룸·오피스텔을 관리하고, 법정 고지사항과 플랫폼별 Playwright 게시 상태를 한 화면에서 관리하는 프로젝트입니다.

관리자 화면은 두 가지 모드로 동작합니다.

| 모드 | 조건 | 저장 위치 | 화면 표시 |
|---|---|---|---|
| **데모** | `.env.local` 에 Supabase 값이 없음 | 브라우저 메모리 (새로고침하면 사라짐) | 상단 노란 배지 "데모 데이터" |
| **고객 DB 연결** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` 있음 | 고객 Supabase (매물·고객·직원·법정 고지·원고·배포 작업) | 상단 초록 배지 "고객 DB 연결" |

고객 DB 연결 모드에서는 브라우저가 Supabase 에 직접 붙지 않고, 고객 PC 의 로컬 Next 서버(`/api/*`)가 서버 전용 키로 Supabase 를 읽고 씁니다. 관리자 로그인 방식이 확정되기 전에는 `VERCEL=1` 환경의 모든 관리자 API를 403으로 차단하므로 고객 실데이터는 Windows PC의 `localhost`에서만 사용할 수 있습니다.

네이버·인스타그램·당근·직방의 실제 게시 단계는 아직 빈 어댑터(`not_configured`)이며, 고객 Windows PC에서 headed Playwright 로 하나씩 연결합니다.

## 빈 Windows PC에서 시작

PowerShell(윈도우 기본 5.1 또는 PowerShell 7)을 일반 사용자 권한으로 열어 아래 프로그램을 설치합니다.

```powershell
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
winget install --id Python.Python.3.13 --exact
```

Supabase CLI는 [공식 CLI 설치 문서](https://supabase.com/docs/guides/local-development/cli/getting-started)를 따라 설치합니다(Windows 는 scoop 방식이 가장 간단합니다). `setup-windows.ps1`은 나중의 고객 Vercel 배포를 위해 Vercel CLI를 `vercel@latest`로 설치하거나 갱신합니다. Docker Desktop 은 로컬 Supabase 스택을 띄워 DB 테스트를 할 때만 필요하고, 고객 원격 프로젝트에 `db push` 만 할 때는 필요 없습니다.

새 PowerShell을 열고 버전을 확인합니다.

```powershell
git --version
node --version
npm --version
python --version
supabase --version
```

> 윈도우 11 은 `python` 이 Microsoft Store 별칭(가짜 실행 파일)으로 잡힐 수 있습니다. `python --version` 이 스토어를 열거나 아무것도 출력하지 않으면 **설정 → 앱 → 고급 앱 설정 → 앱 실행 별칭** 에서 `python.exe` 를 끄고 새 창을 엽니다.

저장소를 클론하고 프로젝트 전용 라이브러리를 설치합니다.

```powershell
git clone https://github.com/digiwood7/barjung.git
cd barjung
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\setup-windows.ps1
.\scripts\bootstrap-windows.ps1
```

`setup-windows.ps1`은 선행 프로그램을 확인하고 Vercel CLI 최신판을 전역 설치·갱신합니다. `bootstrap-windows.ps1`은 이 프로젝트 안의 Node 패키지, `python\.venv`, Python 고정 의존성과 Playwright Chromium만 준비합니다. 전역 Claude·Codex 설정이나 다른 프로젝트는 변경하지 않습니다. `scripts\*.ps1` 은 UTF-8 BOM 으로 저장돼 있어 윈도우 기본 PowerShell 5.1 에서도 한글 안내가 깨지지 않습니다.

로컬 관리자 화면을 엽니다.

```powershell
.\scripts\start-local.ps1
```

브라우저가 `http://localhost:3000`을 엽니다. 환경변수가 비어 있으면 **데모 모드**로 동작하므로 이 단계에서는 화면 구성만 확인합니다.

## 고객 Supabase 연결 (한 번에)

1. 고객 계정으로 [Supabase](https://supabase.com) 에 새 프로젝트를 만듭니다. 프로젝트 REF(대시보드 URL 의 `xxxxxxxx` 부분)를 확인합니다.
2. 스키마·RLS·Storage·seed 를 한 번에 적용합니다. 이 명령이 `supabase login`(브라우저 로그인) → `link` → `db push --include-seed` → 타입 생성을 순서대로 실행합니다.

   ```powershell
   .\scripts\migrate-supabase.ps1 -ProjectRef "고객_프로젝트_REF"
   ```

   seed 는 비식별 사업장 1곳, 직원 2명(전화번호 `010-0000-000x`), 실행기 1대, 플랫폼 연결 4건, 기본 설정을 넣습니다. 매물·고객은 넣지 않습니다.
3. `.env.local` 에 아래 두 값을 넣습니다 (Supabase 대시보드 → Project Settings → API).

   ```
   SUPABASE_URL=https://고객_프로젝트_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=service_role 키
   ```

   나머지 값은 `.env.example` 설명대로 두면 됩니다. 값을 Git 에 올리지 않습니다.
4. 관리자와 실행기를 함께 다시 켭니다.

   ```powershell
   .\scripts\start-local.ps1 -WithRunner
   ```

   화면 상단 배지가 **"고객 DB 연결"** 로 바뀌고, 왼쪽 실행기 카드가 **온라인**(실행기가 5초마다 heartbeat) 이면 연결 완료입니다. 이때부터 매물·고객·직원·설정은 모두 고객 Supabase 에 저장됩니다.

연결 상태 점검 명령 (값은 출력하지 않음):

```powershell
Invoke-RestMethod http://localhost:3000/api/workspace | Select-Object mode, readOnly
```

`mode` 가 `live` 면 연결된 것이고, 503 이면 `.env.local` 값이 비어 있는 것입니다.

## 매물 사진 올리기

사진은 브라우저가 아니라 고객 PC 의 Python 이 최적화해서 올립니다. 매물을 등록하면 매물 상세 화면에 아래 형태의 명령이 표시됩니다(사업장 ID·매물 ID 가 채워진 상태). 원본은 그대로 두고 EXIF 를 지운 최적화본만 private `property-media` 버킷에 올라가며, `property_media` 테이블에 크기·해상도·checksum 이 기록돼 화면의 사진 수에 반영됩니다.

```powershell
. .\scripts\import-project-env.ps1
python\.venv\Scripts\python.exe -m barjung_media.cli "C:\매물사진\*.jpg" `
  --output ".\tmp\optimized" --manifest ".\tmp\manifest.json" `
  --upload --office-id "<사업장 UUID>" --property-id "<매물 UUID>"
```

`*.jpg` 같은 와일드카드와 폴더 경로는 CLI 가 직접 풀어 줍니다(PowerShell 은 풀어 주지 않음).

## 배포 흐름

1. 매물 상세에서 법정 고지 13개가 모두 채워져야 **전체 배포** 버튼이 켜집니다.
2. 누르면 `distribution_jobs` 1건과 플랫폼별 `distribution_targets` 4건이 `queued` 로 생성됩니다(같은 매물을 1분 안에 다시 요청하면 거부).
3. Windows 실행기가 큐를 가져가 어댑터를 실행하고 결과(`succeeded`/`failed`/`not_configured`, 게시 URL, 오류 요약)를 기록합니다. 화면은 2초마다 결과를 읽어 보여 줍니다.
4. 실패·미연결 플랫폼은 "다시 확인" 으로 그 플랫폼만 재요청할 수 있습니다.
5. 네이버 블로그 어댑터는 이식돼 있고(`BARJUNG_NAVER_ENABLED=true` 로 켬, 기본은 임시저장 모드), 인스타·당근·직방은 아직 `not_configured` 입니다. 현장 연결 순서는 [플랫폼 어댑터 가이드](docs/PLATFORM_ADAPTER_GUIDE.md)를 따릅니다.

## 네이버 블로그 게시

DGagent 의 네이버 블로그 Playwright 코드에서 **글 작성·사진 업로드·발행 부분만** 옮겼습니다(글감·상위글 분석·AI 없음). 기존 바를정 블로그 글 형식대로 인사 → 매물번호·조건 → 대표가 올린 사진 순서대로 → 직원 원고 → 문의 줄 → `* 공인중개사법 시행령에 따른 명시사항 *` → 해시태그 순으로 씁니다.

```powershell
npm --prefix runner run naver:login      # 최초 1회, '로그인 상태 유지' 체크
# .env.local: BARJUNG_NAVER_ENABLED=true, BARJUNG_NAVER_MODE=draft (임시저장) → 검증 후 publish
.\scripts\start-local.ps1 -WithRunner
```

## 테스트

```powershell
npm test                      # 단위·컴포넌트 (데모/라이브 모드, 가짜 Supabase 로 데이터 서비스 왕복)
npm run build
npm --prefix runner test
npm --prefix runner run typecheck
python\.venv\Scripts\python.exe -m pytest python\tests -q
npx playwright test           # 127.0.0.1:3100 에 전용 서버를 띄워 데모 모드로 검사
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

관리자 인증이 확정되기 전에는 Vercel에 고객 Supabase·공공데이터 키를 넣지 않습니다. Vercel 런타임의 관리자 API는 읽기와 쓰기 모두 403으로 차단되어 고객 개인정보가 공개되지 않습니다. 현재 고객 실데이터 운영은 Windows PC의 `localhost`만 사용하고, 인증 도입 후 Vercel 배포를 다시 엽니다. 상세 절차는 [배포 가이드](docs/DEPLOYMENT.md)를 확인합니다.

## 문서

- [제품 요구사항](PRD.MD) — 21절에 2026-08-30 변경 기록
- [고객 PC 설치](docs/CUSTOMER_INSTALL.md)
- [플랫폼 연결](docs/PLATFORM_ADAPTER_GUIDE.md)
- [Supabase·Vercel 배포](docs/DEPLOYMENT.md)
- [윈도우 설치 검토 (2026-08-30)](docs/reviews/2026-08-30-windows-install-review.md)
