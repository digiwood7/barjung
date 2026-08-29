# 플랫폼별 Playwright 연결 가이드

## 공통 원칙

- 고객 Windows PC와 고객 계정에서만 학습한다.
- 처음에는 `BARJUNG_HEADLESS=false`로 브라우저를 보이게 실행한다.
- CAPTCHA나 추가 인증은 우회하지 않고 사용자가 직접 처리한다.
- locator는 role, label, 안정된 test id 순으로 사용하고 화면 좌표에 의존하지 않는다.
- 게시 직전과 직후의 상태를 확인해 중복 게시를 막는다.
- 프로필 폴더, 쿠키와 세션은 저장소에 커밋하지 않는다.

## 연결 순서

1. `runner/src/adapters/naver.ts`
2. `runner/src/adapters/instagram.ts`
3. `runner/src/adapters/daangn.ts`
4. `runner/src/adapters/zigbang.ts`

각 adapter는 `checkSession`, `publish`, 게시 URL 확인과 오류 분류 계약을 지켜야 합니다. 한 플랫폼을 구현할 때마다 해당 사이트용 fixture·계약 테스트를 추가하고 headed 회귀 테스트를 통과한 뒤에만 활성화합니다.

## 오류 코드

- `adapter_not_configured`: 현장 연결 전
- `auth_expired`: 로그인 만료
- `user_action_required`: CAPTCHA·추가 인증
- `selector_changed`: 사이트 화면 변경
- `network`: 일시적 통신 장애
- `unexpected`: 정제되지 않은 원본 오류를 노출하지 않는 기타 오류

사이트 변경 시 해당 adapter만 수정하고 다른 플랫폼과 queue 계약은 변경하지 않습니다.
