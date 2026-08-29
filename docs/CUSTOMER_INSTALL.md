# 고객 Windows PC 설치

## 기준 환경

- Windows 11 64비트
- Git 최신 안정판
- Node.js 24 LTS
- Python 3.13 이상
- Supabase CLI 최신 안정판
- Vercel CLI 최신판
- Chromium for Playwright

## 설치 순서

1. README의 `winget` 명령으로 Git, Node.js와 Python을 설치한다.
2. Supabase 공식 문서대로 CLI를 설치한다.
3. `npm install -g vercel@latest`로 Vercel CLI를 설치한다.
4. 저장소를 고객 PC의 원하는 작업 폴더에 클론한다.
5. `bootstrap-windows.ps1`로 프로젝트 의존성을 설치한다.
6. `start-local.ps1`로 demo mode를 확인한다.
7. 고객 Supabase 프로젝트를 만들고 migration을 적용한다.
8. 고객 키를 `.env.local`에 직접 입력한다.
9. runner를 함께 실행해 heartbeat를 확인한다.
10. 플랫폼별 Playwright adapter를 headed mode로 연결한다.

## 데이터와 설정 격리

- 이 저장소는 다른 프로젝트나 전역 Claude·Codex 설정을 변경하지 않는다.
- Python 패키지는 `python\.venv`에만 설치한다.
- runner 패키지는 `runner\node_modules`에만 설치한다.
- Playwright 로그인 profile은 고객이 `BARJUNG_PLAYWRIGHT_PROFILE_DIR`로 지정한 저장소 밖 폴더를 사용한다.
- 환경파일, profile, 원본 사진, 최적화 임시폴더는 Git에 포함하지 않는다.

## 로컬 사진 최적화 예시

```powershell
python\.venv\Scripts\python.exe -m barjung_media.cli `
  "C:\매물사진\IMG_0001.jpg" `
  "C:\매물사진\IMG_0002.jpg" `
  --output ".\tmp\optimized" `
  --manifest ".\tmp\manifest.json"
```

원본 파일은 변경되지 않습니다. manifest의 성공 결과만 고객 Supabase Storage에 올립니다.

Supabase migration 뒤 실제 업로드까지 한 번에 실행할 때는 고객 PC의 `.env.local` 값을 PowerShell 환경변수로 불러온 상태에서 아래 옵션을 추가합니다.

```powershell
. .\scripts\import-project-env.ps1
python\.venv\Scripts\python.exe -m barjung_media.cli `
  "C:\매물사진\IMG_0001.jpg" `
  --output ".\tmp\optimized" `
  --manifest ".\tmp\manifest.json" `
  --upload `
  --office-id "고객_OFFICE_UUID" `
  --property-id "등록된_PROPERTY_UUID"
```

성공한 최적화 사진만 private `property-media` 버킷에 올라가며, 크기·해상도·checksum 메타데이터가 `property_media` 테이블에 함께 저장됩니다. service role key는 고객 Windows PC 안에서만 사용하고 브라우저나 Git에 넣지 않습니다.

## 주소와 건축물대장

`.env.local`에 고객이 발급한 `JUSO_API_KEY`와 `BUILDING_REGISTER_API_KEY`를 입력합니다. 사용자가 주소를 입력하면 도로명주소 API가 법정동코드·본번·부번을 해석하고, 국토교통부 건축HUB 표제부를 조회해 소재지·용도·총층·사용승인일·주차대수를 채웁니다. 계약면적·해당 층·방향·관리비는 표제부만으로 단정하지 않고 직원이 확인합니다.
