# STORY-003: Global Layout & Responsive Framework

**Status:** Done
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** site visitor (all personas — Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor, Executive)

## User Story
As a site visitor, I want the Oristor site to lay out consistently and correctly on my phone, tablet, or desktop, so that I can browse and shop comfortably no matter what device I use.

As a developer building any future page or module, I want a shared, documented layout shell and responsive/grid system, so that I don't have to reinvent container widths, breakpoints, or spacing rules for every new route.

## Description
This story establishes the foundational app shell that every storefront page builds on: the root and storefront layout files, the breakpoint system, container/grid primitives, and the responsive behavior rules referenced throughout `docs/blueprint.md` Section 6 (Performance, Accessibility, Scalability) and Section 9 item 2 ("Core UI ... responsive framework. Done when homepage is responsive and complete"). It does not include the header, footer, or homepage content itself (those are STORY-004, STORY-005, STORY-006) — only the structural scaffold, spacing/grid tokens, and layout primitives those stories will be composed into. This is a prerequisite for every subsequent Core UI and Product Platform story.

## Acceptance Criteria
- [x] `src/app/layout.tsx` applies Cormorant Garamond + Inter via `next/font`, sets `<html lang="en">`, wires a title template (`%s | Oristor`), description, `metadataBase`, and a generated `src/app/icon.png` favicon
- [x] `src/app/(storefront)/layout.tsx` renders the shared storefront shell (header slot, `<main id="main-content">`, footer slot). TanStack Query provider intentionally stays at the root layout rather than being duplicated here — see Acceptance Criteria deviation note in `docs/architecture-decisions.md`; no Zustand hydration boundary needed (documented why)
- [x] `Container` primitive (`src/components/storefront/layout/container.tsx`) enforces max content width (`narrow`/`default`/`wide`) + gutter, now used by the homepage and style guide instead of ad-hoc classes
- [x] Breakpoint scale documented: Tailwind v4 defaults kept (`sm`/`md`/`lg`/`xl`/`2xl`), mobile-first, deliberate non-customization documented in `docs/architecture-decisions.md`
- [x] `Section` primitive (`src/components/storefront/layout/section.tsx`) provides the vertical rhythm scale (`sm`/`default`/`lg`/`xl` spacing) for STORY-006 onward
- [x] Sticky-header offset handled via a single `--header-height` CSS variable driving `scroll-padding-top`
- [x] Root layout avoids known FOUC/CLS causes (next/font size-adjust, no client-JS-dependent initial paint) — **numeric Lighthouse CLS score not measured in this environment; that's explicitly STORY-066's job**, documented as a caveat rather than silently claimed
- [x] Verified at 375px/768px/1024px/1440px via Playwright (`tests/e2e/layout.spec.ts`, all passing) and manual screenshots — no horizontal overflow at any width
- [x] `prefers-reduced-motion` and `prefers-color-scheme` exposed via `src/hooks/use-prefers-reduced-motion.ts` / `use-prefers-color-scheme.ts` (built on a shared SSR-safe `use-media-query.ts`), plus a global reduced-motion CSS safety net

## Tasks
- [x] **Frontend:** Built `src/app/layout.tsx` with font loading, metadata (title template, metadataBase), favicon
- [x] **Frontend:** Built `src/app/(storefront)/layout.tsx` with header/main/footer composition slots (documented provider-placement decision)
- [x] **Frontend:** Created `container.tsx` and `section.tsx` layout primitives; adopted them in the homepage and style guide pages
- [x] **Frontend:** Defined `--header-height` and the reduced-motion CSS safety net in `src/app/globals.css`; breakpoints deliberately left at Tailwind defaults (documented)
- [x] **Frontend:** Added `src/hooks/use-media-query.ts`, `use-prefers-reduced-motion.ts`, `use-prefers-color-scheme.ts`
- [x] **Validation:** `npx tsc --noEmit` passes with zero errors; route-group layouts correctly type `children: React.ReactNode`
- [x] **Testing:** `tests/e2e/layout.spec.ts` — 4 viewport overflow checks + container max-width check + single-`<main>`-landmark check, all passing
- [x] **Testing:** `tests/unit/layout-primitives.test.tsx` — Vitest tests for `Container` size variants and `Section` spacing/containerSize props, all passing. (Along the way, fixed a real RTL test-isolation bug affecting every future unit test — see architecture-decisions.md.)
- [x] **Documentation:** Full breakpoint/container/rhythm/provider-placement/favicon/CLS decisions logged in `docs/architecture-decisions.md`

## Dependencies
- STORY-001 (Project Foundation Setup) — Next.js/TypeScript/Tailwind/folder structure must exist first.
- STORY-002 (Design System & Theming) — color tokens, typography scale, and Shadcn theme must be defined before layout consumes them.

## Out of Scope
- Header/navigation content (STORY-004).
- Footer content (STORY-005).
- Homepage section content (STORY-006).
- Page transition/scroll animation behavior (STORY-008), beyond exposing `prefers-reduced-motion` at the layout level.

## References
- `docs/blueprint.md` Section 2 (Brand Identity / Typography)
- `docs/blueprint.md` Section 6 (Non-Functional Principles)
- `docs/blueprint.md` Section 9 item 2 (Core UI)
- `docs/folder-structure.md` (`src/app/(storefront)/`, `src/components/storefront/`)
