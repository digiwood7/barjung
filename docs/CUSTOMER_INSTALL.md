# 고객 Windows PC 설치

## 기준 환경

- Windows 11 64비트
- Git 최신 안정판
- Node.js 24 LTS
- Python 3.13 이상
- Supabase CLI 최신 안정판
- Chromium for Playwright
- Vercel CLI 최신판 — `setup-windows.ps1`이 `vercel@latest`로 설치·갱신

## 설치 순서

1. README의 `winget` 명령으로 Git, Node.js와 Python을 설치한다. `python --version` 이 스토어를 열면 앱 실행 별칭에서 `python.exe` 를 끈다.
2. Supabase 공식 문서대로 CLI를 설치한다(scoop 권장).
3. 저장소를 고객 PC의 원하는 작업 폴더에 클론한다.
4. `Set-ExecutionPolicy -Scope Process Bypass` 후 `setup-windows.ps1` 로 선행 프로그램을 점검하고 Vercel CLI를 최신판으로 설치·갱신한 다음, `bootstrap-windows.ps1` 로 프로젝트 의존성을 설치한다.
5. `start-local.ps1` 로 **데모 모드** 화면을 확인한다(상단 노란 배지 "데모 데이터").
6. 고객 Supabase 프로젝트를 만들고 `migrate-supabase.ps1 -ProjectRef <REF>` 로 migration + seed 를 적용한다.
7. `.env.local` 에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 를 입력한다.
8. `start-local.ps1 -WithRunner` 로 관리자와 실행기를 함께 켜고, 상단 배지가 **"고객 DB 연결"**, 왼쪽 실행기 카드가 **온라인**인지 확인한다.
9. 직원관리에서 seed 직원(정다혜·김민지, 전화 `010-0000-000x`)을 실제 직원으로 수정하거나 새로 등록한다.
10. 매물을 1건 등록하고 → 상세의 사진 업로드 명령으로 사진을 올리고 → 전체 배포를 눌러 4개 플랫폼이 `not_configured` 로 끝나는지 확인한다(어댑터 미연결 상태의 정상 결과).
11. 플랫폼별 Playwright adapter를 headed mode로 연결한다.

## 연결 여부 점검

```powershell
Invoke-RestMethod http://localhost:3000/api/workspace | Select-Object mode, readOnly
```

- `mode = live` → 고객 DB 연결됨
- HTTP 503 `NOT_CONFIGURED` → `.env.local` 값이 비어 있음 (데모 모드)
- HTTP 500 `WORKSPACE_FAILED` → URL·키가 틀렸거나 seed 미적용(`offices` 비어 있음). 메시지에 원인이 적힌다.

## 데이터와 설정 격리

- 이 저장소는 다른 프로젝트나 전역 Claude·Codex 설정을 변경하지 않는다.
- Python 패키지는 `python\.venv`에만 설치한다.
- runner 패키지는 `runner\node_modules`에만 설치한다.
- Playwright 로그인 profile은 고객이 `BARJUNG_PLAYWRIGHT_PROFILE_DIR`로 지정한 저장소 밖 폴더를 사용한다.
- 환경파일, profile, 원본 사진, 최적화 임시폴더는 Git에 포함하지 않는다.
- `SUPABASE_SERVICE_ROLE_KEY` 는 고객 PC 의 로컬 관리자 서버·실행기·Python 업로더만 사용하고 브라우저·Git 에 넣지 않는다.
- 관리자 인증 전에는 Vercel에 고객 Supabase·공공데이터 키를 넣지 않는다. Vercel의 관리자 API는 코드에서도 403으로 차단된다.

## 로컬 사진 최적화 예시

```powershell
python\.venv\Scripts\python.exe -m barjung_media.cli `
  "C:\매물사진\IMG_0001.jpg" `
  "C:\매물사진\IMG_0002.jpg" `
  --output ".\tmp\optimized" `
  --manifest ".\tmp\manifest.json"
```

원본 파일은 변경되지 않습니다. `"C:\매물사진\*.jpg"` 같은 와일드카드나 폴더 경로도 받습니다(CLI 가 직접 풀어 줍니다).

Supabase migration 뒤 실제 업로드까지 한 번에 실행할 때는 `.env.local` 값을 PowerShell 환경변수로 불러온 상태에서 아래 옵션을 추가합니다. 매물 상세 화면에 사업장 ID·매물 ID 가 채워진 명령이 그대로 표시됩니다.

```powershell
. .\scripts\import-project-env.ps1
python\.venv\Scripts\python.exe -m barjung_media.cli `
  "C:\매물사진\*.jpg" `
  --output ".\tmp\optimized" `
  --manifest ".\tmp\manifest.json" `
  --upload `
  --office-id "고객_OFFICE_UUID" `
  --property-id "등록된_PROPERTY_UUID"
```

성공한 최적화 사진만 private `property-media` 버킷에 올라가며, 크기·해상도·checksum 메타데이터가 `property_media` 테이블에 함께 저장됩니다. 화면의 매물 사진 수는 이 테이블의 행 수입니다.

## 주소와 건축물대장

`.env.local`에 고객이 발급한 `JUSO_API_KEY`와 `BUILDING_REGISTER_API_KEY`를 입력합니다. 사용자가 주소를 입력하면 도로명주소 API가 법정동코드·본번·부번을 해석하고, 국토교통부 건축HUB 표제부를 조회해 소재지·용도·총층·사용승인일·주차대수를 채웁니다. 키가 없으면 마법사가 자동 조회를 건너뛰고 직원이 대장 항목을 직접 입력합니다. 계약면적·해당 층·방향·관리비는 표제부만으로 단정하지 않고 직원이 확인합니다.
