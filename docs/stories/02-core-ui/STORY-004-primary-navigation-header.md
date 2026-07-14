# STORY-004: Primary Navigation & Header

**Status:** Done
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor, Executive (all site visitors)

## User Story
As a site visitor, I want a clear, sticky header with navigation to every major section of the site, so that I can quickly get to Products, Recipes, my Cart, or my Account from anywhere on the site.

As a Busy Professional shopping on my phone, I want a compact mobile navigation bar with the essentials (Home, Products, Recipes, Search, Rewards, Account, Menu, Cart), so that I can shop one-handed without a cluttered screen.

As a returning customer, I want to see live badge counts on my Cart and Wishlist icons, so that I always know what's already in them without opening them.

## Description
This story implements the site-wide primary navigation exactly as specified in `docs/blueprint.md` Section 4: desktop nav items (Home, Products, Recipes, Food Academy, Export, Blog, About, Contact, Search, Wishlist, Rewards, Account, Cart) and the reduced mobile nav (Home, Products, Recipes, Search, Rewards, Account, Menu, Cart). It sits inside the storefront shell built in STORY-003 and is the primary wayfinding mechanism for every persona's customer journey (Visitor → Homepage → Browse Products → ... per blueprint Section 4). Cart/Wishlist state is read from Zustand client state; Account state is read from the auth session.

## Acceptance Criteria
- [x] Desktop header renders, in order, the logo, primary nav links, and right-aligned action cluster (Search, Wishlist, Rewards, Account, Cart) — exact 13-item match verified by `tests/e2e/header.spec.ts`. **Deviation:** full desktop nav only renders from `lg` (1024px), not `md` (768px) — all 13 items genuinely don't fit at 768px (a real overflow test caught this); tablet-portrait uses the mobile nav pattern instead. Documented in `docs/architecture-decisions.md`.
- [x] Mobile nav renders exactly the 8 blueprint items; "Menu" opens an off-canvas drawer (shadcn `Sheet`) with the 5 desktop-only links
- [x] Header is sticky on both desktop and mobile; uses `min-h-(--header-height)` (not fixed `h-*`) so wrapped text at edge-case widths grows the header instead of clipping — see architecture-decisions.md for why
- [x] Products/Recipes mega-menus (shadcn `NavigationMenu`, built on `@base-ui/react`) open on hover/click, close on outside click/Escape/selection, fully keyboard-navigable — all via the underlying primitive, not hand-rolled
- [x] Cart badge sourced from `src/lib/stores/cart-store.ts` (Zustand); unit-tested increment/decrement/clamp-at-zero logic
- [x] Wishlist badge sourced from `src/lib/stores/wishlist-store.ts`; hidden when count is 0 (verified by e2e test)
- [x] Account menu reflects auth state via `next-auth/react`'s `useSession`: "Sign In" link when logged out, avatar + dropdown (Orders, Profile, Sign Out) when logged in
- [x] Search is a wired-but-inert trigger button (STORY-007 owns the real overlay), positioned correctly in the action cluster
- [x] Header passes an automated axe scan with **zero critical/serious violations** at both desktop and mobile viewports (`tests/e2e/header.spec.ts`) — this caught a real bug, see Tasks/Testing below
- [x] Mobile drawer closes on route change, outside click, Escape, and link selection; traps focus (verified via a Tab-cycling e2e test) — focus trap comes from the underlying base-ui Dialog primitive
- [x] Active route indicated via `aria-current="page"` (desktop, `NavigationMenuLink`'s `active` prop) and a color change (mobile bottom nav)
- [x] Header is a Server Component (`header.tsx`) wrapping minimal Client Component boundaries (`StickyHeaderShell` for scroll state, `NavLinks` for active-route, `HeaderActions`/badges/`AccountMenu` for session/store state)

## Tasks
- [x] **Frontend:** Built `header.tsx` composing `Logo`, `NavLinks`, `HeaderActions` inside `StickyHeaderShell`
- [x] **Frontend:** Built `mobile-nav.tsx` (bottom bar) and `mobile-menu-drawer.tsx` (off-canvas, shadcn `Sheet`)
- [x] **Frontend:** Built `mega-menu.tsx` (`MegaMenuPanel`, consumed by `nav-links.tsx` via `NavigationMenuContent`)
- [x] **Frontend:** Built `cart-badge.tsx` and `wishlist-badge.tsx` reading from Zustand stores
- [x] **Frontend:** Built `account-menu.tsx` reading `next-auth/react` session state; added `SessionProvider` to `src/app/providers.tsx`
- [x] **Frontend:** Created `cart-store.ts` and `wishlist-store.ts` (count-only, as scoped)
- [x] **Frontend:** Wired `Header` + `MobileNav` into `src/app/(storefront)/layout.tsx`
- [x] **Validation:** `src/lib/nav-config.ts` is the single source of truth (`primaryNavItems`, `actionNavItems`, `mobileNavItems`, `mobileDrawerItems`); both desktop and mobile components import from it, no duplicated arrays
- [x] **Testing:** `tests/unit/nav-stores.test.ts` — 6 Vitest tests for cart/wishlist store logic, all passing
- [x] **Testing:** `tests/e2e/header.spec.ts` — 10 Playwright tests: 13-item desktop nav, active-route, mega-menu open/close/select, badge hidden-at-zero, 8-item mobile nav, drawer open/focus-trap/close/select
- [x] **Testing:** `@axe-core/playwright` scans on both desktop and mobile header — **found and fixed a real WCAG AA violation** (mobile nav label contrast, see below), not just a clean pass
- [x] **Documentation:** Nav config schema, all API/behavior deviations, and the contrast bug documented in `docs/architecture-decisions.md`

**Bugs found and fixed during this story (not just built-then-passed):**
1. Desktop nav overflowed horizontally at 768px (tablet) — fixed by moving the full-nav breakpoint to `lg` (1024px).
2. Mobile nav labels (Stone Grey on Ivory, 10px) failed WCAG AA contrast (3.56:1 vs required 4.5:1) — caught by the automated axe scan, fixed by using Charcoal for label text (icons keep Stone Grey, which only needs the 3:1 non-text ratio).
3. A `setState`-in-`useEffect` lint error surfaced a real anti-pattern in the drawer's route-change-close logic — fixed using React's blessed "adjust state during render" pattern instead.

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming) — icons, color tokens, focus states
- STORY-003 (Global Layout & Responsive Framework) — provides the shell/sticky-offset the header mounts into
- STORY-007 (Global Search) — header search trigger opens this story's overlay (soft dependency; header can stub the trigger until STORY-007 lands)

## Out of Scope
- Full cart/wishlist page content and business logic (STORY-024, STORY-013) — this story only shows counts.
- Search input, suggestions, and results UX (STORY-007).
- AI-powered smart search (Epic 08 — AI Platform).
- Admin-driven/CMS-editable navigation (STORY-052) — nav items are hardcoded/config-driven for now.

## References
- `docs/blueprint.md` Section 4 (Site Structure / Information Architecture — nav lists, customer journey)
- `docs/blueprint.md` Section 3 (Technology Stack — Server/Client Component split)
- `docs/blueprint.md` Section 6 (Accessibility)
- `docs/folder-structure.md` (`src/components/storefront/`, `src/lib/`)
