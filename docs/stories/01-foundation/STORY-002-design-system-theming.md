# STORY-002: Design System & Theming

**Status:** Done
**Epic:** 01 — Foundation
**Priority:** High
**Persona(s):** Development Team / Platform (infrastructure story — consumed by every customer-facing and admin persona indirectly)

## User Story
As a developer on the Oristor platform team, I want the Oristor brand's colors, typography, and spacing encoded as reusable Tailwind v4 theme tokens and Shadcn UI theme configuration, so that every component built afterward is visually consistent with the brand without developers hand-picking hex values or font sizes.

## Description
This story turns the brand identity defined in `docs/blueprint.md` Section 2 into code: a single source of truth for color, type, and scale that all storefront and admin components consume. It builds directly on top of STORY-001 (Shadcn UI must be initialized first) and unblocks Epic 02 — Core UI, whose "done" criterion (responsive, complete homepage) is only achievable once the design tokens exist. Getting this right once, centrally, prevents drift between the storefront and admin console and keeps the platform's "premium, authentic, trustworthy" positioning consistent as described in Section 1.

## Acceptance Criteria
- [x] All ten brand colors from `docs/blueprint.md` Section 2 are defined as Tailwind v4 theme tokens in `src/app/globals.css`, each exposed as a semantic name:
  - [x] Ivory `#FAF7F2` → `--color-ivory` / `bg-ivory` (primary background)
  - [x] Charcoal `#2F2B2A` → `--color-charcoal` (primary text)
  - [x] Oristor Gold `#CDAF52` → `--color-gold` (premium accent)
  - [x] Chilli Red `#B22222` → `--color-chilli` (primary CTA)
  - [x] Leaf Green `#2E8B57` → `--color-leaf` (success)
  - [x] Cream `#FFFDF9` → `--color-cream` (supporting)
  - [x] Warm Beige `#F2ECE4` → `--color-beige` (supporting)
  - [x] Light Gold `#E8D9A8` → `--color-gold-light` (supporting)
  - [x] Stone Grey `#8A817C` → `--color-stone` (supporting)
  - [x] Soft Border `#E5DED5` → `--color-border-soft` (supporting)
- [x] Cormorant Garamond loaded via `next/font/google` for headings, Inter for body/numbers, both wired into `src/app/layout.tsx` as `--font-heading`/`--font-body` CSS variables
- [x] Type scale encoded exactly: Hero 64px, H1 48px, H2 36px, H3 30px, H4 24px, Body 16px, Small 14px, Caption 12px (as `text-hero`…`text-caption` Tailwind utilities, each with a matching line-height)
- [x] Numbers render in Inter SemiBold via the `.font-number` utility class (tabular figures), demoed on `/style-guide`
- [x] Shadcn's CSS variables (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--card`, `--popover`, `--sidebar*`, `--chart-1..5`) are all remapped to Oristor tokens — verified visually, no per-component overrides needed
- [x] Light-mode values defined; dark mode explicitly deferred — no `.dark` value block exists, `next-themes` was not installed, decision documented in `docs/architecture-decisions.md`
- [x] `/style-guide` route built and visually verified (screenshot) — color swatches, full type scale, themed Button (primary/secondary/success/outline), Badge, Card, Input
- [x] Radius/spacing: blueprint specifies none, Shadcn defaults kept deliberately (documented)
- [x] `npm run build` passes with zero TypeScript/ESLint errors; `/style-guide` renders correctly (verified via build output + Playwright test + manual screenshot)

**Additional finding (see Validation below):** contrast checking surfaced that Stone Grey-on-Warm-Beige (3.2:1) and Leaf Green-on-Ivory (4.0:1) fall short of the 4.5:1 AA threshold for normal body text, though both clear the 3.0:1 threshold for large text/UI components. This is a real constraint of the fixed 10-color brand palette, documented with usage guidance rather than silently ignored.

## Tasks

- [x] **Frontend:**
  - [x] Defined the `@theme inline` block in `src/app/globals.css` with all ten brand color tokens
  - [x] Configured `next/font/google` for Cormorant Garamond (headings) and Inter (body + numbers) in `src/app/layout.tsx`
  - [x] Encoded the type scale as Tailwind v4 custom font-size tokens (`--text-hero` etc.) with paired line-heights
  - [x] Remapped `:root`'s Shadcn CSS variables onto the Oristor palette (`components.json`'s `baseColor` left as `"neutral"` — doesn't affect rendering, see architecture-decisions.md)
  - [x] Verified existing Shadcn primitives (`Button`, `Input`, `Label` from STORY-001, plus `Card`/`Badge` added this story) pick up the new theme with zero per-component overrides
  - [x] Built the `/style-guide` route: color swatch grid, full type scale, themed Button variants (Chilli/Gold/Leaf/outline), Badge, Card, Input
  - [x] Added the `.font-number` utility class (Inter SemiBold, tabular-nums)

- [x] **Validation:**
  - [x] Computed WCAG contrast ratios for the key pairings (Charcoal/Ivory 13.1:1, Cream/Chilli 6.6:1, Charcoal/Gold 6.6:1, Stone/Beige 3.2:1, Leaf/Ivory 4.0:1) — full table and usage guidance in `docs/architecture-decisions.md`

- [x] **Testing:**
  - [x] Added `tests/e2e/style-guide.spec.ts` (Playwright) confirming all 10 color names, all 8 type-scale steps, and themed buttons render
  - [x] Manually verified all ten color tokens and eight type-scale steps against `docs/blueprint.md` Section 2 via a full-page screenshot of `/style-guide`

- [x] **Documentation:**
  - [x] Documented the token naming convention and consumption pattern in `docs/architecture-decisions.md`
  - [x] Documented the dark-mode deferral decision and how to revisit it in `docs/architecture-decisions.md`

## Dependencies
- STORY-001 (Project Foundation Setup) — Shadcn UI must be initialized and `src/components/ui/` scaffolded before its theme variables can be remapped; Next.js App Router and Tailwind v4 must already be in place.

## Out of Scope
- Dark mode / theme switching implementation (tokens are defined for light mode only in this story; dark-mode values can be layered on later without restructuring the token system)
- Per-page or per-section visual design (homepage layout, product card design, etc.) — this story only covers the underlying design tokens/system, not applying them to specific pages (that's Epic 02 — Core UI)
- Storybook or any dedicated component-documentation tool (the blueprint doesn't call for one; a lightweight `/style-guide` route is sufficient per this story's scope)
- Logo, iconography set, and imagery/photography guidelines beyond what's already specified (Lucide React icons are covered by STORY-001's library installation, not this story)

## References
- `docs/blueprint.md` Section 2 (Brand Identity — colors, typography, type scale)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — Accessibility, Premium Quality)
- `docs/folder-structure.md` (`src/components/ui/` location for Shadcn primitives)
- STORY-001-project-foundation-setup.md
