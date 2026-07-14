# STORY-008: Animation Framework

**Status:** Done
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** site visitor (all personas); developer building any future page/module

## User Story
As a Gourmet Food Enthusiast browsing the site, I want smooth, tasteful transitions and micro-interactions, so that the site feels premium and considered rather than static or cheap.

As a site visitor with motion sensitivity, I want animations to respect my system's reduced-motion preference, so that the site doesn't trigger discomfort while I browse.

As a developer building any future page or component, I want a small set of documented, reusable animation primitives and hooks, so that I don't hand-roll Framer Motion variants differently in every component.

## Description
This story establishes the Framer Motion conventions and reusable primitives that every other UI story (STORY-006 Homepage, and all future Product/Recipe/Commerce pages) will use: page transition behavior, scroll-reveal patterns, micro-interaction primitives (hover/tap feedback on cards and buttons), and `prefers-reduced-motion` handling, per `docs/blueprint.md` Section 3 (Animation: Framer Motion) and Section 6 (Accessibility, Performance). It does not implement animation for any specific page's content — it provides the toolkit that STORY-006 and later stories consume.

## Acceptance Criteria
- [x] `src/components/motion/variants.ts` exports `fadeInUp`, `fadeIn`, `scaleIn`, `staggerContainer`, `hoverLift`, `tapScale` with documented durations/easing (`DEFAULT_DURATION`/`DEFAULT_EASE`)
- [x] `ScrollReveal` (`scroll-reveal.tsx`) reveals children via `whileInView`, configurable via `variant`/`delay`/`repeat`/`amount`
- [x] `PageTransition` wired into `(storefront)/layout.tsx` around `{children}`. **Deviation:** entrance-only fade, not full `AnimatePresence` enter/exit — documented reasoning (App Router streaming/Suspense risk) in `docs/architecture-decisions.md`
- [x] `hoverLift`/`tapScale` micro-interaction prop bundles exported for spreading onto `motion.*` elements
- [x] `useReducedMotion` hook available (thin re-export of STORY-003's `usePrefersReducedMotion` — no duplicate logic); `ScrollReveal` and `PageTransition` both check it and render a plain wrapper (zero Framer Motion involvement) when true
- [x] All primitives documented with TSDoc in the module itself
- [x] No CLS: every variant only ever animates `opacity`/`transform` (`y`, `scale`), never layout-affecting properties
- [x] Real consumer: `PageTransition` is live in the actual storefront layout today (not just built-in-isolation); `ScrollReveal`'s full real-world proof is STORY-006 landing immediately after this story in the same session — see that story
- [x] Reduced-motion verified via Playwright (`test.use({ contextOptions: { reducedMotion: "reduce" } })`) — note the correct nesting, `reducedMotion` isn't a top-level `test.use()` field
- [x] All motion exports available from `src/components/motion/index.ts`

## Tasks
- [x] **Frontend:** Created `variants.ts`
- [x] **Frontend:** Created `scroll-reveal.tsx`
- [x] **Frontend:** Created `page-transition.tsx`, wired into `(storefront)/layout.tsx`
- [x] **Frontend:** Created `src/hooks/use-reduced-motion.ts`
- [x] **Frontend:** Created `src/components/motion/index.ts` barrel
- [x] **Frontend:** `PageTransition` applied to the real storefront layout; `ScrollReveal` gets its full reference application in STORY-006 (built immediately after)
- [x] **Validation:** `npx tsc --noEmit` passes with zero errors; all motion files strictly typed, `"use client"` only on the three files that need it
- [x] **Testing:** `tests/unit/use-reduced-motion.test.ts` (3 tests) + `tests/unit/scroll-reveal.test.tsx` (2 tests) — required adding `matchMedia`/`IntersectionObserver` stubs to `tests/unit/setup.ts` (jsdom has neither)
- [x] **Testing:** `tests/e2e/motion.spec.ts` — reduced-motion emulation + 2 navigation/focus tests, all passing
- [x] **Testing:** Navigation test confirms URL updates correctly and focus isn't stranded on route change
- [x] **Documentation:** "Animation conventions" section written in `docs/architecture-decisions.md`, including the reduced-motion contract, the out-of-order build note, and two test-infrastructure gotchas (jsdom API stubs, Playwright's `reducedMotion` fixture nesting, and pre-existing mega-menu hover flakiness found while stress-testing)

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming) — motion timing/easing should feel consistent with the visual design language
- STORY-003 (Global Layout & Responsive Framework) — `PageTransition` wires into the storefront layout and reuses the `prefers-reduced-motion` signal exposed there

## Out of Scope
- Section-specific animation content/choreography for the homepage (owned by STORY-006, which consumes these primitives).
- Complex scroll-driven/parallax storytelling animations beyond basic scroll-reveal (can be added later as a follow-up story if the design calls for it).
- Lottie or other non-Framer-Motion animation libraries.

## References
- `docs/blueprint.md` Section 3 (Technology Stack — Animation: Framer Motion)
- `docs/blueprint.md` Section 2 (Brand tone — warm, professional, confident)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — Accessibility, Performance)
- `docs/folder-structure.md` (`src/components/`, `src/hooks/`)
