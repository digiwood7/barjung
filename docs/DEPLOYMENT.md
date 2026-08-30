# 고객 Supabase·Vercel 배포

## Supabase

1. 고객 계정으로 새 프로젝트를 만든다.
2. `scripts/migrate-supabase.ps1 -ProjectRef <REF>`를 실행한다. 스크립트가 `supabase login` → `link` → `db push --include-seed` → 타입 생성을 순서대로 실행한다. migration과 비식별 초기 office·직원·runner·설정 seed 가 함께 적용된다.
3. private `property-media` 버킷, RLS와 Realtime 상태를 확인한다.
4. (Docker 있을 때) `supabase test db`, lint와 advisors를 실행한다.
5. 생성된 고객 타입 파일(`src/lib/supabase/database.generated.types.ts`)을 검토한다. 현재 앱 코드는 이 파일을 import 하지 않는다(참고용).

service role key는 고객 PC 의 로컬 관리자 서버·runner·Python 업로더와 서버 전용 환경에만 저장합니다. 브라우저에는 publishable key만 사용합니다.

## Vercel (조회 전용)

관리자 로그인이 확정되기 전에는 Vercel 배포를 조회 용도로만 씁니다.

1. `npm install -g vercel@latest`로 CLI를 갱신한다.
2. 고객 Vercel 계정으로 로그인한다.
3. 고객 GitHub 저장소와 새 Vercel 프로젝트를 연결한다.
4. 환경변수를 넣는다.
   - `SUPABASE_URL` — 고객 프로젝트 URL
   - `SUPABASE_SERVICE_ROLE_KEY` — **sensitive 로** (서버 전용, 브라우저에 노출되지 않음)
   - `BARJUNG_READ_ONLY=true` — 저장 요청을 403 으로 막는다
   - `JUSO_API_KEY`, `BUILDING_REGISTER_API_KEY` — 서버 전용(선택)
   - `SUPABASE_URL`/`SERVICE_ROLE_KEY` 를 넣지 않으면 Vercel 화면은 데모 모드로 뜬다.
5. Preview에서 모바일·데스크톱 조회와 "조회 전용" 배지, 저장 시 403 메시지를 검증한다.
6. 관리자 인증이 확정된 뒤 `BARJUNG_READ_ONLY` 를 내리고 Production 쓰기를 활성화한다.
7. `vercel deploy --prod`로 정식 배포한다.

현재 개발 PC의 `.vercel` 연결정보를 고객 PC로 복사하지 않습니다.
