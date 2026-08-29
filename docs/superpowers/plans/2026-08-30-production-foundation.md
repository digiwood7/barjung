# 바를정 Production Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 고객의 빈 Windows PC에서 클론·설치·로컬 실행할 수 있고, 고객 Supabase와 Vercel에 이식 가능한 바를정 관리자 및 안전한 로컬 게시 실행기 기반을 완성한다.

**Architecture:** Next.js 관리자는 demo/live repository 경계 위에서 업무 기능을 제공하고, Supabase가 영속 상태와 queue를 보관한다. Windows runner가 Python 사진 파이프라인과 플랫폼별 Playwright adapter를 실행하며 실제 adapter는 고객 PC에서 하나씩 활성화한다.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 5.9, Vitest 4, Playwright 1.62, Supabase CLI 2.116/Postgres, Python 3.13/Pillow/pytest.

**Spec:** `docs/superpowers/specs/2026-08-29-production-foundation-design.md`

## Global Constraints

- 정상 운영에 AI와 Computer Use를 사용하지 않는다.
- 통화기록과 오늘의 배포 레일을 포함하지 않는다.
- 실제 플랫폼 adapter는 안전한 `not_configured` 결과만 반환한다.
- 모든 키와 계정값은 고객이 입력하며 저장소에 실제 값을 넣지 않는다.
- 개발 PC의 사용자명, 홈 경로, 세션 또는 Vercel/Supabase 연결정보를 넣지 않는다.
- Supabase public 테이블 전체에 RLS를 활성화하고 익명 업무 데이터 접근을 허용하지 않는다.
- 사진 원본은 업로드하지 않고 최적화 결과만 업로드한다.
- 기존 승인 UI의 색상, 글자 크기와 정보 밀도를 유지한다.

---

### Task 1: Domain contracts and deterministic business rules

**Files:**
- Create: `src/lib/domain/types.ts`
- Create: `src/lib/domain/legal-disclosure.ts`
- Create: `src/lib/domain/distribution.ts`
- Create: `src/lib/domain/repository.ts`
- Create: `src/lib/domain/*.test.ts`
- Modify: `src/lib/mock/data.ts`

**Interfaces:**
- Produces: `validateDisclosure`, `formatDisclosureBlock`, `composePlatformCopy`, `transitionTarget`, `BarjungRepository`.

- [ ] Write tests proving an empty required disclosure is rejected, the legal block has all fixed labels, illegal distribution transitions fail, and demo CRUD persists through the repository interface.
- [ ] Run `npm test -- src/lib/domain` and confirm failures are missing modules or functions.
- [ ] Implement the minimum domain types, pure rules and in-memory repository to pass.
- [ ] Run the domain tests and the existing selector tests.

Expected legal formatter behavior:

```ts
expect(formatDisclosureBlock(validDisclosure)).toContain(
  "공인중개사법 시행령에 따른 명시사항",
);
```

### Task 2: Functional administrator UI

**Files:**
- Create: `src/components/app/*.tsx`
- Create: `src/components/properties/*.tsx`
- Create: `src/components/customers/*.tsx`
- Create: `src/components/employees/*.tsx`
- Create: `src/components/settings/*.tsx`
- Create: `src/components/app/barjung-app.test.tsx`
- Modify: `src/components/barjung-app.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: domain types and `BarjungRepository`.
- Produces: dashboard, CRUD views, property wizard, editable copy, retry/status interactions.

- [ ] Write component tests for creating/editing/deleting a customer, toggling employee status, property wizard disclosure blocking, user-authored copy, and individual retry.
- [ ] Run the component test and confirm each new interaction fails against the current mock.
- [ ] Split state and view components by domain while preserving the approved appearance.
- [ ] Connect all create/edit/delete buttons to demo repository state and add confirmation where delete is destructive.
- [ ] Keep mobile read-only for property creation and verify responsive layout.
- [ ] Run all Vitest tests.

### Task 3: Supabase declarative schema and one-command migration

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/schemas/01_types.sql`
- Create: `supabase/schemas/02_tables.sql`
- Create: `supabase/schemas/03_functions.sql`
- Create: `supabase/schemas/04_security.sql`
- Create: `supabase/migrations/*_production_foundation.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/database_test.sql`
- Create: `src/lib/supabase/database.types.ts`

**Interfaces:**
- Produces: office-scoped tables, private `property-media` bucket, queue lease/retry functions, RLS and generated TypeScript shape.

- [ ] Generate the migration filename with `supabase migration new production_foundation`.
- [ ] Define literal pgTAP assertions for required tables, RLS flags, idempotency uniqueness and lease behavior.
- [ ] Start/reset the local Supabase stack and confirm tests fail before schema exists when Docker is available.
- [ ] Add declarative schema and migration SQL including explicit Data API grants and Realtime publication.
- [ ] Reset the local DB, run `supabase test db`, `supabase db lint`, and advisors; if Docker is unavailable, run SQL static checks and document the unexecuted command.

Lease contract:

```sql
select * from private.claim_distribution_target(
  p_agent_id := '<uuid>', p_lease_seconds := 120
);
```

### Task 4: Windows runner and safe Playwright adapters

**Files:**
- Create: `runner/package.json`
- Create: `runner/tsconfig.json`
- Create: `runner/src/types.ts`
- Create: `runner/src/errors.ts`
- Create: `runner/src/adapters/base.ts`
- Create: `runner/src/adapters/{naver,instagram,daangn,zigbang}.ts`
- Create: `runner/src/jobs/worker.ts`
- Create: `runner/src/index.ts`
- Create: `runner/tests/*.test.ts`

**Interfaces:**
- Produces: `PlatformAdapter`, `NotConfiguredAdapter`, error classifier, `runTarget`, runner heartbeat loop.

- [ ] Write tests that every adapter refuses to publish with `not_configured`, one platform failure does not change another target, and retryability follows error code.
- [ ] Run runner tests and confirm missing modules fail.
- [ ] Implement the adapter contract, safe adapters and dependency-injected worker.
- [ ] Add headed/headless config and a browser profile path resolved from customer environment only.
- [ ] Run runner tests and TypeScript compilation.

### Task 5: Python photo optimization and manifest

**Files:**
- Create: `python/pyproject.toml`
- Create: `python/requirements.lock`
- Create: `python/barjung_media/__init__.py`
- Create: `python/barjung_media/optimizer.py`
- Create: `python/barjung_media/cli.py`
- Create: `python/tests/test_optimizer.py`

**Interfaces:**
- Produces: `optimize_image`, `optimize_batch`, JSON manifest CLI; optional uploader accepts customer-provided URL/key without logging them.

- [ ] Generate test images with EXIF and assert orientation, maximum edge, removed metadata, checksum and non-destructive output.
- [ ] Run pytest and confirm imports fail.
- [ ] Implement Pillow optimization with quality stepping and atomic output files.
- [ ] Implement batch CLI returning per-file success or sanitized error.
- [ ] Run pytest and a CLI smoke command against temporary fixtures.

### Task 6: Standalone Windows setup and customer handoff

**Files:**
- Create: `.env.example`
- Create: `README.md`
- Create: `scripts/setup-windows.ps1`
- Create: `scripts/bootstrap-windows.ps1`
- Create: `scripts/start-local.ps1`
- Create: `scripts/migrate-supabase.ps1`
- Create: `docs/CUSTOMER_INSTALL.md`
- Create: `docs/PLATFORM_ADAPTER_GUIDE.md`
- Create: `docs/DEPLOYMENT.md`
- Modify: `.gitignore`
- Modify: root `package.json`

**Interfaces:**
- Produces: version checks, dependency bootstrap, combined local start, Supabase push and Vercel deployment instructions.

- [ ] Add script behavior tests that run safe check/help modes without installing or reading secrets.
- [ ] Confirm checks fail when invoked before scripts exist.
- [ ] Implement PowerShell scripts with relative paths and explicit prompts for package installation.
- [ ] Document Git, Node 24, Python 3.13, Playwright Chromium, Supabase CLI and latest Vercel CLI installation.
- [ ] Document clone → bootstrap → local open → DB push → adapter learning → Preview → Production.
- [ ] Run PowerShell parser checks when `pwsh` is available and document Windows validation command otherwise.

### Task 7: End-to-end verification and private GitHub publication

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/admin.spec.ts`
- Modify: `README.md`
- Modify: implementation checklist in this file.

**Interfaces:**
- Consumes: completed web, runner, Python, Supabase and setup artifacts.
- Produces: verified `main` branch and private `digiwood7/barjung` remote.

- [ ] Run Vitest, runner tests, Python tests, Next production build and web Playwright E2E.
- [ ] Run `git diff --check`, dependency audit, secret/path scan and tracked-file review.
- [ ] Test a clean clone/install workflow in a temporary directory without copying local environment files.
- [ ] Commit completed implementation, fast-forward `main`, create private `digiwood7/barjung`, set remote and push `main`.
- [ ] Verify GitHub visibility is PRIVATE and the remote default branch is `main`.
