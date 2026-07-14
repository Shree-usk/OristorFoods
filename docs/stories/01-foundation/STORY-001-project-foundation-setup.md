# STORY-001: Project Foundation Setup

**Status:** Blocked (everything except live DB connectivity is done — see Acceptance Criteria)
**Epic:** 01 — Foundation
**Priority:** High
**Persona(s):** Development Team / Platform (infrastructure story — no direct end-user persona)

## User Story
As a developer on the Oristor platform team, I want a fully configured Next.js + TypeScript + Tailwind + Prisma + auth foundation, so that feature teams can start building on a consistent, production-ready base.

## Description
This story covers the base scaffolding for the entire ODEP codebase: framework setup, core libraries, database connectivity, authentication scaffolding, environment configuration, the target folder structure, and the CI/CD pipeline. It corresponds to Build Order item 1, "Foundation," in `docs/blueprint.md` Section 9, which is explicitly "done when the app builds successfully." Everything else in the platform (Sections 4–8) depends on this scaffolding being in place before feature work starts.

`create-next-app` (Next.js 16.2.10, App Router, TypeScript, React 19), Tailwind CSS v4, and a bare `prisma init` were already in place. As of this session, Shadcn UI, Auth.js v5, Zod, TanStack Query, Zustand, Framer Motion, React Hook Form, Vitest, Playwright, the full `docs/folder-structure.md` folder layout, `.env.example`, and the CI/CD workflow are all installed/configured/verified (`npm run lint`, `npx tsc --noEmit`, `npm run test`, and `npm run build` all pass clean). The one unmet criterion is a **live PostgreSQL connection** — see the "Blocked" item below and `docs/architecture-decisions.md` for the full investigation and unblock options. This story stays `Blocked` rather than `Done` until that's resolved.

## Acceptance Criteria

**Already satisfied (do not re-do — verify only):**
- [x] `create-next-app` scaffold exists with Next.js `16.2.10`, App Router, TypeScript, React `19.2.4` / `react-dom` `19.2.4` (per `package.json`)
- [x] Tailwind CSS v4 installed via `@tailwindcss/postcss` (per `package.json`)
- [x] Prisma CLI installed (`prisma@^7.8.0`) and `prisma/schema.prisma` initialized with `provider = "postgresql"` and client `output = "../src/generated/prisma"`
- [x] ESLint + `eslint-config-next` configured, `npm run lint` script present

**Done:**
- [x] Shadcn UI is initialized (`components.json` present) and `Button` renders correctly from `src/components/ui/` (used on the homepage)
- [x] NextAuth (Auth.js v5) is installed and configured with a working Credentials provider stub, `jwt` session strategy, and `src/lib/auth.ts` exporting `handlers`/`auth`/`signIn`/`signOut`
- [x] Zod is installed and sample schemas exist in `src/validation/` (`auth.schema.ts`, `example.schema.ts`) demonstrating the pattern feature teams will follow
- [x] TanStack Query is installed with a `QueryClientProvider` wired into the root layout via `src/app/providers.tsx`
- [x] Zustand is installed with one example store (`useUiStore`) under `src/lib/stores/`
- [x] Framer Motion is installed and importable without build errors (`src/components/ui/fade-in.tsx`)
- [x] React Hook Form is installed and integrates with the Zod sample schema via `@hookform/resolvers` (`newsletter-signup-form.tsx`)
- [x] Vitest is installed and configured (`vitest.config.ts`), with passing tests under `tests/unit/`
- [x] Playwright is installed and configured (`playwright.config.ts`), with a passing e2e test under `tests/e2e/`
- [x] `.env.example` exists at the project root listing every required environment variable with no real secrets committed
- [x] The `src/app/(storefront)/` and `src/app/(admin)/` route groups exist, each with a `layout.tsx`
- [x] `src/services/`, `src/repositories/`, `src/lib/`, `src/hooks/`, `src/types/`, and `src/validation/` folders exist per `docs/folder-structure.md`
- [x] `src/components/ui/`, `src/components/storefront/`, and `src/components/admin/` folders exist per `docs/folder-structure.md`
- [x] A CI/CD pipeline (GitHub Actions, `.github/workflows/ci.yml`) runs install/generate/lint/typecheck/test/build on every PR to `main`/`develop`
- [x] `npm run build` completes with zero TypeScript errors and zero ESLint errors — the Section 9 "done" criterion for this story
- [x] `tsconfig.json` has `strict: true` per the blueprint's mandatory strict TypeScript standard

**Blocked (not done — see `docs/architecture-decisions.md`):**
- [ ] `prisma/schema.prisma` connects to a real PostgreSQL instance (local or hosted) and `npx prisma migrate dev` runs successfully against it. The local `npx prisma dev` server starts and listens, but every connection attempt fails with P1017 ("server has closed the connection") in this environment — suspected Windows Firewall/AV interference. `npx prisma generate` (schema-only) was verified instead. Needs a hosted dev DB, Docker, or a firewall fix to complete.

## Tasks

- [ ] **Database:**
  - [x] Attempted: local `npx prisma dev` Postgres server provisioned; `DATABASE_URL`/`SHADOW_DATABASE_URL` set in `.env`
  - [ ] Verify `prisma/schema.prisma` connects and `npx prisma migrate dev --name init` runs cleanly — **blocked, P1017, see Acceptance Criteria and `docs/architecture-decisions.md`**
  - [x] Documented the local DB setup + blocker + unblock options in `docs/architecture-decisions.md`

- [x] **Backend/Service Layer scaffolding:**
  - [x] Created `src/repositories/README.md` enforcing "Prisma is only ever imported here"
  - [x] Created `src/services/README.md` enforcing "route handlers and components call services, never repositories or Prisma directly"
  - [x] Added `src/lib/auth.ts` with Auth.js v5 configuration (Credentials provider, `jwt` session strategy, `PrismaAdapter` wiring)
  - [x] Added `src/lib/db.ts` exporting a singleton `PrismaClient` (via `@prisma/adapter-pg`) following the Next.js recommended singleton pattern

- [x] **Frontend:**
  - [x] Ran `npx shadcn@latest init`; configured `components.json` (Tailwind v4 aware, `base-nova` style, path aliases matching `tsconfig.json`)
  - [x] Installed and verified `Button` renders on the homepage
  - [x] Installed Framer Motion; `src/components/ui/fade-in.tsx` confirms it builds and runs client-side
  - [x] Installed TanStack Query; wrapped root layout in a `QueryClientProvider` via `src/app/providers.tsx`
  - [x] Installed Zustand; added `useUiStore` under `src/lib/stores/`
  - [x] Scaffolded `src/app/(storefront)/layout.tsx` and `src/app/(admin)/layout.tsx` route groups; moved the homepage into `(storefront)/`
  - [x] Scaffolded `src/components/ui/`, `src/components/storefront/`, `src/components/admin/` folders

- [x] **Validation:**
  - [x] Installed Zod
  - [x] Added sample schemas under `src/validation/` (`auth.schema.ts`, `example.schema.ts`)
  - [x] Installed React Hook Form + `@hookform/resolvers`; wired into `newsletter-signup-form.tsx` end to end

- [x] **Testing:**
  - [x] Installed Vitest, `@testing-library/react`, `jsdom`; added `vitest.config.ts`
  - [x] Added passing tests under `tests/unit/`; wired `npm run test` / `npm run test:watch`
  - [x] Installed Playwright + Chromium; added `playwright.config.ts`
  - [x] Added a passing e2e test under `tests/e2e/`; wired `npm run test:e2e`

- [x] **CI/CD:**
  - [x] Added `.github/workflows/ci.yml` running on PR: `npm ci`, `prisma generate`, `npm run lint`, `tsc --noEmit`, `npm run test`, `npm run build`
  - [x] Documented branch protection expectations in `docs/architecture-decisions.md` (actual GitHub Settings config is outside repo code)

- [x] **Documentation:**
  - [x] Added `.env.example` at project root with every required variable and a comment per section
  - [x] Created `docs/architecture-decisions.md` recording the choices made in this story and the DB blocker
  - [x] Updated `CLAUDE.md` to reflect the finalized test commands, the Auth.js v5 env var naming, and the Prisma driver-adapter requirement

## Dependencies
None — this is the root story all other stories depend on.

## Out of Scope
- Redis caching and BullMQ queueing (blueprint marks these "planned/future," not part of foundation)
- Any actual database models/schema beyond the empty `datasource`/`generator` block (belongs to feature-specific stories, e.g. Product Platform, Customer Platform)
- Production hosting/domain/SSL setup (belongs to Epic 10 — Production Launch)
- Real NextAuth providers beyond a working stub (e.g. final choice of OAuth providers is a product decision, not a foundation blocker)

## References
- `docs/blueprint.md` Section 1 (Project Overview), Section 3 (Technology Stack), Section 9 item 1 (Foundation)
- `docs/folder-structure.md` (target repo layout)
- `package.json`, `prisma/schema.prisma` (current scaffold state)
