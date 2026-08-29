# Barjung Customer Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished, fully clickable Next.js customer-confirmation mockup for the Barjung real-estate admin system and open it locally for review before any Vercel deployment.

**Architecture:** Use one Next.js App Router application with client-side mock state and deterministic timers. Keep domain data, selectors, and simulation logic in focused modules so the UI demonstrates the future Supabase/Windows-agent flow without connecting external services. The deliverable is responsive, but property creation is desktop-only and mobile is read-only.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library, Playwright

**Spec:** `PRD.MD`

## Global Constraints

- No real public-data, AI, Supabase, phone, or SNS calls in the customer mockup.
- No authentication or role differences in the mockup.
- Property registration is desktop-only; mobile provides dashboard, listing, detail, and distribution status views.
- Legal disclosures must be represented as verified structured data and publication stays disabled while required fields are missing.
- Photo optimization, AI generation, and SNS distribution are deterministic simulations.
- SNS targets are Naver Blog, Instagram, Daangn, and Zigbang, one account each.
- Deployment must wait until the user approves the locally opened mockup.

---

### Task 1: Scaffold and visual foundation

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.mjs`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/ui/status-pill.tsx`
- Create: `src/components/ui/stat-card.tsx`
- Test: `src/components/ui/status-pill.test.tsx`

**Interfaces:**
- Produces: `AppShell({ children, activeNav })`, `StatusPill({ tone, children })`, and `StatCard({ label, value, hint, icon })`.
- Produces: design tokens for navy navigation, warm white canvas, blue action color, emerald success, amber warning, and coral error.

- [ ] Write a component test asserting each status tone renders its semantic label.
- [ ] Run the test and verify it fails before the component exists.
- [ ] Scaffold Next.js and implement the global tokens, typography, shell, status pill, and stat card.
- [ ] Run the test and verify it passes.
- [ ] Run `npm run build` and correct all scaffold/configuration errors.

### Task 2: Mock domain model and state engine

**Files:**
- Create: `src/lib/mock/types.ts`
- Create: `src/lib/mock/data.ts`
- Create: `src/lib/mock/selectors.ts`
- Create: `src/lib/mock/distribution-simulator.ts`
- Create: `src/lib/mock/store.tsx`
- Test: `src/lib/mock/selectors.test.ts`
- Test: `src/lib/mock/distribution-simulator.test.ts`

**Interfaces:**
- Produces: `Employee`, `Customer`, `CallLog`, `Property`, `LegalDisclosure`, `DistributionTarget`, and `LocalAgent` types.
- Produces: `filterProperties(properties, filters)` and `validateLegalDisclosure(disclosure)`.
- Produces: `runDistributionSimulation(propertyId, onUpdate)` with deterministic Naver/Instagram/Daangn/Zigbang state updates and one first-attempt Zigbang failure.
- Produces: `MockStoreProvider` and `useMockStore()` for CRUD, filtering, wizard state, and retry actions.

- [ ] Write failing tests for address/type/status/platform filters and legal disclosure missing-field validation.
- [ ] Write a failing fake-timer test for deterministic platform state transitions and Zigbang retry.
- [ ] Implement typed fixtures reflecting Kyungpook National University area studio, two-room, and officetel listings.
- [ ] Implement selectors, validation, store actions, and simulation engine.
- [ ] Run all unit tests and verify they pass.

### Task 3: Dashboard, staff, CRM, and call-log screens

**Files:**
- Create: `src/components/dashboard/dashboard-view.tsx`
- Create: `src/components/employees/employees-view.tsx`
- Create: `src/components/crm/customers-view.tsx`
- Create: `src/components/crm/call-logs-view.tsx`
- Create: `src/components/ui/data-table.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/crm/call-logs-view.test.tsx`

**Interfaces:**
- Consumes: `useMockStore()` employee/customer/call CRUD actions.
- Produces: navigation-addressable views for dashboard, employees, customers, and call logs.
- Produces: unknown-call `Register customer` flow that pre-fills phone and call time.

- [ ] Write a failing test that registers an unknown caller and verifies the new customer and attached call history.
- [ ] Implement the property-first dashboard with metrics, recent listings, platform failures, and Windows-agent heartbeat.
- [ ] Implement clickable employee and customer CRUD dialogs using mock state.
- [ ] Implement call-log filters and the unknown-caller registration flow.
- [ ] Run the CRM test and the complete unit test suite.

### Task 4: Property table, filters, detail, and registration wizard

**Files:**
- Create: `src/components/properties/properties-view.tsx`
- Create: `src/components/properties/property-filters.tsx`
- Create: `src/components/properties/property-detail.tsx`
- Create: `src/components/properties/property-wizard.tsx`
- Create: `src/components/properties/photo-optimizer-step.tsx`
- Create: `src/components/properties/building-register-step.tsx`
- Create: `src/components/properties/legal-disclosure-step.tsx`
- Create: `src/components/properties/channel-copy-step.tsx`
- Test: `src/components/properties/property-wizard.test.tsx`

**Interfaces:**
- Consumes: `filterProperties`, `validateLegalDisclosure`, and store property actions.
- Produces: desktop wizard steps `basic → photos → building register → disclosures → channel copy → review`.
- Produces: simulated local-Python progress per photo and building-register auto-fill.
- Produces: disabled publish action while legal disclosure validation reports missing fields.

- [ ] Write a failing wizard test asserting publish stays disabled when direction and maintenance-fee details are missing.
- [ ] Implement the filter header and responsive property table with platform status badges.
- [ ] Implement property detail with internal exact address, channel-specific public address, verified disclosures, and publication links.
- [ ] Implement the registration wizard, photo optimization simulation, building candidate selection, disclosure auto-fill, validation, and channel previews.
- [ ] Run wizard and selector tests and verify they pass.

### Task 5: Distribution progress, failures, settings, and mobile read-only behavior

**Files:**
- Create: `src/components/distribution/distribution-progress.tsx`
- Create: `src/components/distribution/platform-card.tsx`
- Create: `src/components/settings/settings-view.tsx`
- Modify: `src/components/properties/property-detail.tsx`
- Modify: `src/app/globals.css`
- Test: `src/components/distribution/distribution-progress.test.tsx`

**Interfaces:**
- Consumes: deterministic distribution simulator and retry action.
- Produces: overall progress, per-platform state, failure reason, single-platform retry, and completed-link action.
- Produces: review/automatic mode toggle, platform address privacy settings, connected account state, and Windows-agent status.

- [ ] Write a failing fake-timer test for overall progress, Zigbang failure, and Zigbang-only retry.
- [ ] Implement the distribution panel and platform cards.
- [ ] Implement settings for publication mode, per-channel address policy, and local-agent state.
- [ ] Add responsive rules that hide create/edit controls on narrow screens while keeping read-only navigation usable.
- [ ] Run the distribution test and complete unit test suite.

### Task 6: Full-story verification and local browser handoff

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mockup-flow.spec.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: all completed mock screens.
- Produces: one automated end-to-end proof of the primary customer demo.

- [ ] Write the Playwright flow for dashboard → property list → new property → local photo optimization → building-register lookup → missing legal-field block → channel previews → distribution → failure → retry → completed link.
- [ ] Run `npm test` and verify all unit tests pass.
- [ ] Run `npm run build` and verify the production build succeeds.
- [ ] Run the Playwright flow at desktop and one mobile read-only smoke test.
- [ ] Start the local production server and open the mockup in the user's browser.
- [ ] Wait for explicit user approval before installing/upgrading or invoking the Vercel CLI for deployment.

