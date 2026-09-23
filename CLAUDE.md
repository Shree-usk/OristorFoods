# CLAUDE.md

This file is read automatically by Claude Code every time it works in this
project. It tells Claude what the project is, how to build it, and what
rules to follow. Keep it accurate — if something here is wrong, Claude will
follow the wrong instructions.

## Project

Oristor Digital Experience Platform (ODEP) — an enterprise e-commerce and
brand experience platform for Oristor Food Products (Pvt) Ltd, a premium
Sri Lankan food brand. Combines e-commerce, recipes/food education, a
loyalty & referral program, and a full no-code admin console for the
business team.

**Full requirements:** see `docs/blueprint.md` for the condensed spec
(vision, brand identity, tech stack, IA, feature set, admin console, build
order). That file is the source of truth for scope and priorities — read it
before starting a new module.

## Tech Stack

- Framework: Next.js 16.2.10 (App Router), Server Components by default,
  Client Components only where interactivity is required
- Language: TypeScript, strict mode — no `any`, no implicit types
- Styling: Tailwind CSS v4
- Components: Shadcn UI
- Animation: Framer Motion
- Icons: Lucide React
- Forms: React Hook Form + Zod
- State: TanStack Query (server state), Zustand (client state)
- ORM: Prisma → PostgreSQL, via the `@prisma/adapter-pg` driver adapter
  (Prisma 7 requires passing an `adapter` to `PrismaClient` — see
  `src/lib/db.ts` and `docs/architecture-decisions.md`). `DATABASE_URL`
  must be a plain `postgresql://` string, not `prisma+postgres://`.
- Auth: NextAuth (Auth.js v5 / `next-auth@beta`) — env var is
  `AUTH_SECRET`, not the v4-era `NEXTAUTH_SECRET`
- Testing: Vitest (unit), Playwright (e2e)

**Note on Next.js 16:** this is a newer major than what's in most training
data — APIs, conventions, and file structure may differ from what you'd
expect. Check `node_modules/next/dist/docs/` or `AGENTS.md` before relying
on remembered Next.js behavior, especially for routing, caching, and config.

## Commands

```bash
npm run dev          # start local dev server
npm run build         # production build
npm run lint           # lint
npm run test            # unit tests (Vitest)
npm run test:watch       # unit tests, watch mode
npm run test:e2e          # e2e tests (Playwright; spins up the dev server)
npx prisma studio       # inspect the database
npx prisma migrate dev   # run a new migration
```

Vitest and Playwright are installed and configured as of STORY-001
(`vitest.config.ts`, `playwright.config.ts`, `tests/unit/`, `tests/e2e/`).

**Local DB workflow:** `npx prisma dev` runs a PGlite-backed local Postgres
server, which has an upstream bug that breaks `prisma migrate dev` on
repeated calls (see `docs/architecture-decisions.md` for root cause and
fix). Use `npx prisma db push` for day-to-day schema iteration; only use
`migrate dev` (against a freshly restarted server) when deliberately
producing a migration file to commit. **`npm run test` now requires a
running `prisma dev` server** — the Vitest global setup runs `db push`
against it before every test run; start `npx prisma dev` first if tests
fail with a connection error. Set `DATABASE_POOL_MAX=1` in your local `.env`: PGlite supports only one connection, and without the cap concurrent queries crash it (see `docs/architecture-decisions.md`, STORY-015 entry).

## Conventions

- **Architecture:** Service Layer pattern. Database access lives only in a
  Repository layer — never call Prisma directly from a component or route
  handler. Route handlers call Services; Services call Repositories.
- **No duplicate logic** — if you're about to write something similar to
  existing code, extract a shared component/hook/service instead.
- **No placeholder code** unless explicitly asked for — generate real,
  working implementations.
- **Every feature ships with:** requirements understood → database →
  API → backend → frontend → validation → tests → docs. Don't skip steps.
- **Commit style:** Conventional Commits — `feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `style:`, `perf:`, `build:`, `ci:`, `security:`,
  `chore:`
- **Branches:** `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`
- **Accessibility & SEO** are not optional — every page needs semantic
  HTML, alt text, proper meta/schema fields.

## Admin Console Principle

Almost nothing on this site should be hardcoded. Products, recipes, blog
posts, homepage sections, banners/pop-ups, reviews, Q&A, navigation, and
delivery-zone pricing must all be manageable through the admin console
without a developer touching code. When building a feature, ask: "could a
non-technical admin change this later without redeploying?" If not, it
probably needs a CMS-backed field instead of a hardcoded value.

## Build Order

Follow the sprint order in `docs/blueprint.md` Section 9 unless told
otherwise: Foundation → Core UI → Product Platform → Recipes & Food
Academy → Commerce Platform → Customer Platform → Enterprise/Admin
Platform → AI Platform → Quality & Security → Production Launch.

## Known Open Questions

See `docs/blueprint.md` Section 10 — payment gateway provider, ERP system,
and shipping carriers are not yet finalized. Don't guess at these; ask
before implementing anything that depends on them.

Delivery-zone rate structure is now confirmed — see
`.claude/skills/delivery-zone-pricing/SKILL.md`.

## Skills

This project uses Claude Code skills in `.claude/skills/` for recurring
workflows (adding a product page, adding a recipe, building an admin
console module, delivery-zone pricing). Claude should use these
automatically when the task matches; you can also invoke one directly,
e.g. `/add-product-page`.
