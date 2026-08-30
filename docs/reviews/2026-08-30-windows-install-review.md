---
요청: 코덱스가 만든 바를정 SNS 관리 페이지를 검토해 고객 윈도우 PC에 바로 설치 가능한지 확인 (2026-08-30 대표 지시)
status: resolved (같은 날 조치 — PRD 21절 참고)
---

# 바를정 — 고객 윈도우 PC 설치 가능성 검토 (2026-08-30)

## 결론 한 줄
**설치 자체는 된다. 단, 그대로 주면 고객은 저장소를 받지 못하고(비공개), 설치 안내문 한글이 깨질 수 있으며, 설치 후 보이는 화면은 데모 데이터이고 실제 SNS 게시는 아직 한 곳도 안 된다.**

## 실측 결과 (맥에서 대리 검증)
| 항목 | 결과 |
|---|---|
| 단위 테스트 `npm test` | 16/16 통과 |
| 러너 테스트·타입검사 | 5/5 통과, 타입 오류 0 |
| 파이썬 테스트 | 3/3 통과 |
| 프로덕션 빌드 `npm run build` | 성공 (Next 16.3.3) |
| e2e `playwright test` | 4/4 통과 (※ 3000번 포트를 다른 프로젝트가 점유해 처음엔 실패 → 3100번으로 격리하니 통과) |
| 잠금파일 윈도우 바이너리 | `@next/swc-win32-x64-msvc`, `lightningcss-win32-x64-msvc`, `@tailwindcss/oxide-win32-x64-msvc`, `@esbuild/win32-x64`, `sharp-win32-x64` 모두 포함 → 윈도우 `npm ci` 가능 |
| Pillow 12.3.0 윈도우 휠 | `cp313-win_amd64` 휠 실제 다운로드 확인 |
| Node 요구 | Next 16.3.3은 Node ≥ 20.9 → 안내대로 24 LTS면 충분 |
| 비밀값 유출 | `.env.local`·`.vercel` 미추적(gitignore) 확인 |
| RLS | 전 테이블 RLS 활성 + anon 권한 회수 + service_role 전용 RPC → 규칙 충족 |

## 설치를 막는 것 (반드시 고쳐야 함)
1. **저장소가 비공개(PRIVATE)** — `git clone https://github.com/digiwood7/barjung.git` 이 고객 PC에서 안 된다. 공개 전환하거나, 고객 깃허브 계정을 협력자로 초대하거나, zip으로 전달해야 한다.
2. **파워셸 스크립트 5개가 BOM 없는 UTF-8** — 윈도우11 기본 "Windows PowerShell 5.1"은 BOM 없는 파일을 ANSI(CP949)로 읽어 한글 메시지가 깨지고, 경우에 따라 따옴표를 삼켜 구문 오류가 난다. `scripts/*.ps1` 을 UTF-8 BOM으로 저장하면 끝.

## 설치는 되지만 기대와 다른 것 (고객 설명 필요)
3. **웹 관리 화면은 Supabase를 전혀 안 쓴다** — `src/` 에 `@supabase/supabase-js` 도, `NEXT_PUBLIC_*` 사용처도 없다. 메모리 데모 저장소(`createDemoRepository`)만 있어서 새로고침하면 입력한 매물이 사라진다. README의 "환경변수가 비어 있으면 demo data" 문구는 사실과 다르다(있어도 demo).
4. **4개 플랫폼 어댑터가 전부 빈 껍데기** — 네이버·인스타·당근·직방 모두 `NotConfiguredAdapter` 로 `not_configured` 만 반환. 러너는 Playwright를 아예 호출하지 않는다(`BARJUNG_PLAYWRIGHT_PROFILE_DIR`·`BARJUNG_HEADLESS` 도 코드에서 미사용). **실제 SNS 게시 기능은 0개.**
5. 실제로 동작하는 건 ①러너의 큐 폴링·하트비트 ②파이썬 사진 최적화·Supabase 업로드 ③건축물대장 API 라우트(키 있을 때) 뿐.

## 설치 마찰 (있으면 좋은 개선)
6. Supabase CLI는 윈도우에서 scoop 설치가 필요한데 자동화 안 됨 + `supabase login` 은 브라우저 대화형. 고객이 직접 하기엔 무겁다.
7. Vercel CLI 설치를 필수로 안내하지만 로컬 설치엔 불필요 — 안내에서 빼도 된다.
8. `start-local.ps1` 이 개발 서버(`next dev`)를 띄운다. 고객용이면 `next build && next start` 가 맞다.
9. 윈도우11의 `python` 스토어 별칭(App Execution Alias) 때문에 `Get-Command python` 이 가짜 python을 잡을 수 있다. `py -3.13` 또는 전체 경로 확인 권장.
10. `playwright.config.ts` 가 3000번 포트 기존 서버를 재사용(`reuseExistingServer`) — 다른 앱이 3000번을 쓰면 엉뚱한 페이지를 검사한다. 전용 포트 지정 권장.

## 조치 결과 (2026-08-30 같은 날)
| 번호 | 조치 |
|---|---|
| 1 저장소 비공개 | 대표가 직접 처리(공개 전환 또는 고객 초대) |
| 2 파워셸 BOM | `scripts/*.ps1` 5개 UTF-8 BOM 저장 완료 |
| 3 Supabase 미연결 | 로컬 서버 경유 라이브 모드 구현 — 매물·고객·직원·설정·배포 요청이 고객 DB 에 저장됨. 상세 = PRD 21절 |
| 4 어댑터 빈 껍데기 | 대표 결정대로 유지(고객 PC 에서 Playwright 로 연결) |
| 6 Supabase CLI 수동 설치 | 유지(README 에 scoop 안내). `migrate-supabase.ps1` 이 login→link→push 를 묶음 |
| 7 Vercel CLI 필수 안내 | README 에서 "배포 때만" 으로 정정 |
| 8 `next dev` 로 실행 | 유지(고객이 코드를 만지지 않으므로 dev 서버로도 충분, 후속 검토) |
| 9 python 스토어 별칭 | README 에 해제 방법 안내 |
| 10 e2e 포트 재사용 | `playwright.config.ts` 전용 포트 3100 + 재사용 금지 |
