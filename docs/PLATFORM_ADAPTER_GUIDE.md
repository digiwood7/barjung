# 플랫폼별 Playwright 연결 가이드

## 공통 원칙

- 고객 Windows PC와 고객 계정에서만 학습한다.
- 처음에는 `BARJUNG_HEADLESS=false`로 브라우저를 보이게 실행한다.
- CAPTCHA나 추가 인증은 우회하지 않고 사용자가 직접 처리한다.
- locator는 role, label, 안정된 test id 순으로 사용하고 화면 좌표에 의존하지 않는다.
- 게시 직전과 직후의 상태를 확인해 중복 게시를 막는다.
- 프로필 폴더, 쿠키와 세션은 저장소에 커밋하지 않는다.

## 네이버 블로그 (2026-08-30 이식 완료 — 고객 PC headed 검증 대기)

DGagent `tools/skill-naver-blog-write/scripts/{_browser,_naver_editor}.py` 의 **글 작성·업로드·발행 부분만** TypeScript 로 옮겼다(`runner/src/adapters/naver/`). 글감 발굴·상위글 분석·AI 작성·서식 꾸미기는 뺐다.

| 파일 | 역할 |
|---|---|
| `naver/browser.ts` | 영구 프로필 크롬(채널 chrome → 내장 Chromium 폴백), 락 파일 정리, 로그인 3단계 검증(NID_AUT+NID_SES · 영구 쿠키 · 글쓰기 페이지 진입) |
| `naver/editor.ts` | SmartEditor 조작: iframe#mainFrame 스코프, 로그인 만료 즉시 판별, '이어서 작성' 팝업, 단어 단위 사람형 타이핑, '사진' 버튼→파일 선택기 업로드(순서 보장)·캡션, 해시태그(Space 로 칩 확정), 임시저장, 발행 레이어(`[class*='publish_btn']` 등 접두어 매칭)·카테고리(nbsp 정규화)·확정 |
| `naver/compose.ts` | 기존 블로그 글 형식 고정 템플릿: 인사 → 매물번호·보증금·월차임·관리비 → 사진 순서대로 → 직원 원고 → 문의 줄 → `* 공인중개사법 시행령에 따른 명시사항 *` → 해시태그 |
| `naver/adapter.ts` | `PlatformAdapter` 구현. 기본 **임시저장 모드**(`not_configured`/`draft_saved` 로 보고), `BARJUNG_NAVER_MODE=publish` 면 발행 후 RSS 최상단 글로 URL 확인 |
| `src/naver-login.ts` | 최초 1회 로그인 저장 (`npm --prefix runner run naver:login`) |

### 고객 PC 연결 순서

1. `.env.local` 에 `BARJUNG_PLAYWRIGHT_PROFILE_DIR`(저장소 밖 폴더), `BARJUNG_NAVER_CONTACT`, `BARJUNG_NAVER_HASHTAGS`, `BARJUNG_NAVER_BLOG_ID` 를 넣는다.
2. `npm --prefix runner run naver:login` → 크롬 창에서 **'로그인 상태 유지' 체크** 후 로그인(2단계 인증까지). `LOGIN_OK` 가 찍혀야 한다.
3. `BARJUNG_NAVER_ENABLED=true`, `BARJUNG_NAVER_MODE=draft`, `BARJUNG_HEADLESS=false` 로 실행기를 켜고 매물 하나를 배포한다. 브라우저 창에서 제목·사진 순서·원고·명시사항·해시태그가 들어가는지 눈으로 확인하고, 네이버 '저장된 글' 에서 결과를 본다.
   - 확인 포인트: 사진 뒤 원고가 사진 **아래** 새 단락에 들어가는지(에디터가 이미지 뒤에 새 문단을 만들어 준다는 전제). 위로 새면 `adapter.ts` 의 `caretToDocumentEnd` 호출 순서를 조정한다.
4. 문제없으면 `BARJUNG_NAVER_CATEGORY` 를 정하고 `BARJUNG_NAVER_MODE=publish` 로 바꾼다. 카테고리를 못 고르면 발행하지 않는다.
5. 안정화 뒤 `BARJUNG_HEADLESS=true`.

로그인이 만료되면 target 이 `auth_expired` 로 실패한다 → 2번을 다시 한다(2단계 인증이라 자동 복구 없음).

## 세로 영상 채널 (인스타 릴스·틱톡·유튜브 쇼츠)

운영 계정의 최근 게시물 10개에서 확인한 형식을 템플릿으로 사용한다.

`한 줄 훅 → 보증금/월세 → 문의 블록 → 공인중개사법 명시사항 → 사무소 등록정보 → 지역 해시태그`

- `runner/src/adapters/instagram/compose.ts`: 2,200자 제한 안에서 위 순서로 캡션을 만들며 법정 명시사항은 자르지 않는다.
- 매물별 세로 영상은 `property-videos` 비공개 버킷에 정확히 1개만 저장한다. 사진은 네이버·당근에서만 사용한다.
- `runner/src/adapters/instagram/editor.ts`: 만들기 → 세로 영상 1개 선택 → 다음 2회 → 문구 입력 → 릴스 임시 저장/공유를 role 기반으로 조작한다.
- `runner/src/adapters/instagram/adapter.ts`: 별도 영구 프로필, 중복 제목 확인, draft/publish 모드, 새 게시물 URL 확인을 담당한다.
- CAPTCHA·로그인·추가 인증은 우회하지 않고 `npm --prefix runner run instagram:login` 으로 사용자가 직접 완료한다.

### 고객 PC 연결 순서

1. `.env.local` 에 `BARJUNG_INSTAGRAM_USERNAME`, 문의 줄, 사무소 등록정보, 해시태그를 입력한다.
2. `npm --prefix runner run instagram:login` 을 실행하고 열린 Chrome에서 로그인·추가 인증을 완료한다.
3. `BARJUNG_INSTAGRAM_ENABLED=true`, `BARJUNG_INSTAGRAM_MODE=draft`, `BARJUNG_HEADLESS=false` 로 매물 하나를 배포해 세로 영상과 캡션을 확인한다.
4. 확인 후 `BARJUNG_INSTAGRAM_MODE=publish` 로 바꾼다. 안정화 뒤 공통 `BARJUNG_HEADLESS=true` 로 전환할 수 있다.

## 연결 순서

1. `runner/src/adapters/naver.ts` — 위 절 참고
2. `runner/src/adapters/instagram.ts` — 위 절 참고
3. `runner/src/adapters/daangn.ts`
4. `runner/src/adapters/tiktok.ts` (세로 영상, 연결 예정)
5. `runner/src/adapters/youtube.ts` (쇼츠, 연결 예정)

각 adapter는 `checkSession`, `publish`, 게시 URL 확인과 오류 분류 계약을 지켜야 합니다. 한 플랫폼을 구현할 때마다 해당 사이트용 fixture·계약 테스트를 추가하고 headed 회귀 테스트를 통과한 뒤에만 활성화합니다.

## 오류 코드

- `adapter_not_configured`: 현장 연결 전
- `auth_expired`: 로그인 만료
- `user_action_required`: CAPTCHA·추가 인증
- `selector_changed`: 사이트 화면 변경
- `network`: 일시적 통신 장애
- `unexpected`: 정제되지 않은 원본 오류를 노출하지 않는 기타 오류

사이트 변경 시 해당 adapter만 수정하고 다른 플랫폼과 queue 계약은 변경하지 않습니다.
