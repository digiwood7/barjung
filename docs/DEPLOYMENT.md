# 고객 Supabase·Vercel 배포

## Supabase

1. 고객 계정으로 새 프로젝트를 만든다.
2. `scripts/migrate-supabase.ps1 -ProjectRef <REF>`를 실행한다. 스크립트가 `supabase login` → `link` → `db push --include-seed` → 타입 생성을 순서대로 실행한다. migration과 비식별 초기 office·직원·runner·설정 seed 가 함께 적용된다.
3. private `property-media` 버킷, RLS와 Realtime 상태를 확인한다.
4. (Docker 있을 때) `supabase test db`, lint와 advisors를 실행한다.
5. 생성된 고객 타입 파일(`src/lib/supabase/database.generated.types.ts`)을 검토한다. 현재 앱 코드는 이 파일을 import 하지 않는다(참고용).

service role key는 고객 PC 의 로컬 관리자 서버·runner·Python 업로더와 서버 전용 환경에만 저장합니다. 브라우저에는 publishable key만 사용합니다.

## Vercel (관리자 인증 도입 전 차단)

현재 버전은 Vercel 런타임(`VERCEL=1`)에서 관리자 API와 공공데이터 API를 읽기·쓰기 모두 403으로 차단합니다. 고객·직원 전화번호와 매물 정확 주소를 보호하기 위해 인증 도입 전에는 고객 실데이터를 원격으로 제공하지 않습니다.

1. 고객 PC의 `setup-windows.ps1`을 실행하거나 `npm install -g vercel@latest`로 CLI를 최신판으로 맞춘다.
2. 이 단계에서는 Vercel 프로젝트에 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JUSO_API_KEY`, `BUILDING_REGISTER_API_KEY`를 넣지 않는다.
3. 고객 실데이터 운영은 Windows PC의 `localhost`에서만 수행한다.
4. 관리자 인증 방식과 직원별 권한을 확정한다.
5. 인증·권한 검사를 모든 `/api/*` 데이터 경계에 적용하고 보안 테스트를 통과한 뒤에만 고객 Vercel 계정으로 Preview를 배포한다.
6. Preview에서 비로그인 401/403, 다른 사업장 접근 차단, 읽기·쓰기 권한을 검증한 뒤 Production으로 승격한다.

현재 개발 PC의 `.vercel` 연결정보를 고객 PC로 복사하지 않습니다.
