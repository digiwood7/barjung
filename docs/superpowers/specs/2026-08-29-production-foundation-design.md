# 바를정 운영 기반 설계

## 목적

현재 고객 확인용 단일 화면 목업을 새 Windows PC에서 독립 설치할 수 있는 운영 기반 저장소로 전환한다. 실제 플랫폼 게시 셀렉터와 고객 계정 연결은 현장 작업으로 남기되, 그 외 관리자 기능, 데이터 모델, 사진 파이프라인, 작업 실행기, 검증과 이식 절차는 저장소에 완성한다.

## 확정 범위

- Next.js 관리자: 대시보드, 매물·고객·직원 CRUD, 설정, 등록 마법사, 법정 고지, 배포 상태
- Supabase: 선언형 스키마, migration, seed, private Storage, RLS, Realtime, DB 테스트
- Windows 실행기: heartbeat, queue lease, idempotency, retry, 플랫폼 어댑터 계약
- Python: 사진 리사이즈, 품질 조정, EXIF 제거, checksum, 선택적 Supabase 업로드
- Playwright: 브라우저 프로필과 네 플랫폼의 안전한 빈 어댑터
- 설치: 빈 고객 Windows PC용 점검·설치·실행 문서와 PowerShell 보조 스크립트
- 배포: 고객 Supabase와 Vercel에 연결할 수 있는 설정과 명령
- GitHub: `digiwood7/barjung` 비공개 저장소

통화기록, 영상, 런타임 AI, Computer Use, 실제 플랫폼 셀렉터, 실제 고객 계정 연결은 제외한다.

## 구조 선택

### 채택: 웹·DB·로컬 실행기 분리

Next.js는 업무 UI, Supabase는 공유 상태, Windows 실행기는 로컬 전용 작업을 담당한다. 플랫폼 변화는 어댑터 하나에 격리되고 사진과 로그인 세션은 고객 PC를 벗어나지 않는다.

Next.js 서버에서 모든 자동화를 수행하는 안은 SNS 세션과 로컬 사진 요구에 맞지 않는다. Electron 단일 앱은 업데이트·서명·UI 중복 비용이 현재 규모에 과하다.

## 저장소 구조

```text
barjung/
├─ src/                         Next.js 관리자
│  ├─ app/                     App Router 페이지·Route Handler
│  ├─ components/              도메인별 UI
│  └─ lib/                     저장소, 검증, 템플릿, 환경설정
├─ runner/                      Windows 로컬 Playwright 실행기
│  ├─ src/adapters/             플랫폼별 어댑터
│  ├─ src/jobs/                 lease·실행·결과 처리
│  └─ tests/                    계약 테스트
├─ python/                      사진 파이프라인
│  ├─ barjung_media/            최적화·메타데이터·업로드
│  └─ tests/                    Python 단위 테스트
├─ supabase/
│  ├─ schemas/                 선언형 원본
│  ├─ migrations/              고객 프로젝트 적용 파일
│  ├─ tests/                   pgTAP DB 테스트
│  └─ seed.sql                 비식별 demo seed
├─ scripts/                    Windows 설치·실행·이식 보조
├─ docs/                       운영·설치·플랫폼 연결 문서
├─ .env.example               변수명과 빈 예제값
└─ README.md                  빈 PC 시작 안내
```

## 데이터 경계

웹 UI는 `Repository` 인터페이스만 사용한다.

- `DemoRepository`: 환경변수 없이 비식별 seed로 동작한다.
- `SupabaseRepository`: 고객 프로젝트 연결 시 실제 데이터를 사용한다.
- 실제 write는 인증 확정 전 로컬 신뢰 환경에서만 허용한다.
- 브라우저에는 publishable key만 허용하고 service role은 실행기 또는 서버 전용 코드에만 둔다.

Supabase public 테이블은 모두 RLS를 켜고 `anon` 정책을 만들지 않는다. 향후 인증은 `app_metadata.office_id`와 역할을 기준으로 정책을 추가할 수 있도록 업무 행에 `office_id`를 둔다. 2026년 Data API 변경에 대비해 필요한 grant는 migration에서 명시한다.

## 매물 등록 데이터 흐름

1. 사용자가 로컬 관리자에서 사진과 매물값을 입력한다.
2. 브라우저가 loopback 실행기에 사진 최적화를 요청한다.
3. Python이 EXIF를 제거하고 리사이즈·품질 조정한 파일과 manifest를 반환한다.
4. 실행기가 주소로 건축물대장을 조회한다.
5. 사용자가 후보를 선택하고 자동값을 확정한다.
6. 순수 TypeScript 검증기가 자동값과 수동값을 합쳐 필수 고지를 검증한다.
7. 사진은 고객 Storage로 직접 업로드하고 업무 레코드를 생성한다.
8. 직원 원고와 강제 법정 고지 블록으로 플랫폼 콘텐츠를 저장한다.
9. 검수 승인 또는 자동 모드에 따라 배포 작업을 생성한다.

외부 API 미연결 demo mode에서는 고정 fixture를 같은 인터페이스로 반환한다.

## 실행기와 Playwright

실행기는 플랫폼별 작업을 제한된 동시성으로 실행한다. DB 함수가 target에 lease 소유자와 만료시각을 기록하며, 동일 idempotency key의 중복 작업 생성을 거부한다.

플랫폼 어댑터 계약은 다음 책임을 가진다.

- `checkSession()`
- `publish(input)`
- `resolvePublishedUrl()`
- `classifyError(error)`

초기 어댑터는 `not_configured`를 반환해 실제 게시하지 않는다. 고객 PC에서 headed 브라우저로 한 플랫폼씩 locator와 단계를 구현하고 계약 테스트를 통과한 뒤 활성화한다. 브라우저 사용자 데이터 디렉터리는 저장소 밖 고객 지정 경로에 생성한다.

## 사진 파이프라인

Python 패키지는 Pillow 기반 CLI로 제공한다. 입력 파일을 덮어쓰지 않고 출력 폴더에 새 파일을 만든다. EXIF 방향을 적용한 뒤 메타데이터를 제거하며, 긴 변과 품질을 단계적으로 낮춰 목표 용량에 접근한다. manifest에는 원본명, 출력명, 크기, 해상도, MIME, SHA-256과 오류를 기록한다.

업로드는 선택 기능이며 키가 없으면 로컬 최적화만 수행한다. 비밀 키는 환경 파일에만 있고 CLI 출력에 표시하지 않는다.

## 관리자 UI

현재 승인된 시각 언어를 유지하면서 큰 단일 컴포넌트를 도메인별로 분리한다. 모든 버튼과 모달은 demo state를 실제 변경해야 한다.

- 대시보드: 핵심 수치와 최근 매물
- 매물: 검색·필터·정렬·CRUD·플랫폼 상태
- 등록 마법사: 사진, 주소, 고지, 거래조건, 원고, 검토
- 고객: CRUD와 다음 확인일
- 직원: CRUD와 재직 상태
- 설정: 게시 모드, 사진 설정, 플랫폼 상태

통화기록과 오늘의 배포 레일은 렌더링·데이터·문서에서 제거한다.

## 오류 처리

오류 코드는 network, auth expired, user action required, selector changed, validation, storage, external API, not configured로 분류한다. 사용자에게는 정제된 요약만 보여주고 원본 오류의 민감정보는 저장하지 않는다. 재시도 가능 여부는 오류 코드가 결정한다.

heartbeat가 끊기면 UI가 오프라인과 대기 건수를 표시한다. running lease가 만료되면 DB가 queued로 회수한다.

## 설치와 이식

README는 Windows 11 빈 PC를 기준으로 공식 설치 경로와 버전 확인 명령을 제공한다. `setup-windows.ps1`은 선행 프로그램을 검사하고 누락된 항목의 공식 `winget` 명령을 안내하거나 명시적 동의를 받아 실행한다.

클론 후 bootstrap 명령이 Node 패키지, Python 가상환경, Python 패키지와 Playwright Chromium을 설치한다. 환경 예제는 빈 값만 포함하며 고객이 직접 입력한다. 로컬 실행 명령은 관리자와 실행기를 함께 시작하고 브라우저를 연다.

Supabase는 `supabase link`와 `supabase db push`, Vercel은 `vercel link`, `vercel env`, `vercel deploy` 순서로 고객 계정에서 실행한다. 현재 개발 PC의 프로젝트 연결 파일과 계정 정보는 커밋하지 않는다.

## 테스트와 완료 조건

- TypeScript 단위·컴포넌트 테스트
- 웹 Playwright E2E
- Python pytest
- runner 어댑터 계약과 queue 테스트
- Supabase schema reset, pgTAP, RLS·advisor 검사
- production Next.js build
- 비밀·절대 경로·개인 계정 문자열 검사
- 새 디렉터리 clone smoke test

실제 SNS 게시 성공은 이번 완료 조건이 아니다. 미연결 어댑터가 실제 게시를 하지 않고 `not_configured`로 종료하는 것이 완료 조건이다.

## 후속 결정 격리

로그인 방식, 모바일 등록, 보존기간, 플랫폼 주소 기본값과 CAPTCHA 운영 절차는 독립 설정 또는 어댑터로 추가한다. 이 결정 때문에 핵심 스키마나 queue 계약을 다시 설계하지 않는다.
