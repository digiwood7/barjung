# 고객 Supabase·Vercel 배포

## Supabase

1. 고객 계정으로 새 프로젝트를 만든다.
2. Supabase CLI로 로그인한다.
3. `scripts/migrate-supabase.ps1 -ProjectRef <REF>`를 실행한다. migration과 비식별 초기 office·runner seed가 함께 적용된다.
4. private `property-media` 버킷, RLS와 Realtime 상태를 확인한다.
5. `supabase test db`, lint와 advisors를 실행한다.
6. 생성된 고객 타입 파일을 검토한다.

service role key는 고객 PC runner와 서버 전용 환경에만 저장합니다. 브라우저에는 publishable key만 사용합니다.

## Vercel

1. `npm install -g vercel@latest`로 CLI를 갱신한다.
2. 고객 Vercel 계정으로 로그인한다.
3. 고객 GitHub 저장소와 새 Vercel 프로젝트를 연결한다.
4. `vercel env`로 브라우저용 Supabase publishable 값과 서버 전용 `JUSO_API_KEY`, `BUILDING_REGISTER_API_KEY`를 설정한다.
5. Preview에서 모바일·데스크톱 조회와 인증 정책을 검증한다.
6. 관리자 인증이 확정된 뒤 Production 쓰기를 활성화한다.
7. `vercel deploy --prod`로 정식 배포한다.

현재 개발 PC의 `.vercel` 연결정보를 고객 PC로 복사하지 않습니다.
