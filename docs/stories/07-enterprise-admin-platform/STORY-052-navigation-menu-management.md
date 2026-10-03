# STORY-052: Navigation & Menu Management

**Status:** Done (core scope)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Low
**Persona(s):** Content Editor, Marketing Manager, Super Administrator

## User Story
As a Content Editor, I want to manage the header, mega menu, footer, and mobile menu with drag-to-reorder, so that site navigation can change without a code deployment.

## Description
This story delivers the Navigation & Menus console module from `docs/blueprint.md` Section 7: "header/mega menu/footer/mobile menu, drag-to-reorder." It is the admin authoring tool for the navigation structures rendered on the storefront by STORY-004 (Primary Navigation & Header) and STORY-005 (Footer), which must consume the same menu data contract this console produces.

## Acceptance Criteria
- [x] The menu manager supports four distinct menu locations: Header (primary nav), Mega Menu (nested columns/sections per top-level item), Footer (multi-column link groups), and Mobile Menu — Mega Menu is a 4th *admin tab*, not a 4th backend `MenuLocation`: it's nested `MenuItem` children under a Header item (matching `nav-config.ts`'s existing `NavItem.megaMenu?` shape). 3 real `MenuLocation` values (`Header`/`Footer`/`Mobile`).
- [x] Each menu item has: label, link target (an internal path or an external URL, or neither for a pure grouping node), an open-in-new-tab flag, an optional icon, a visibility rule (Always / signed-in only / a specific customer group), and an active/inactive toggle
- [x] Items can be drag-to-reordered within a menu, and dragged between nesting levels for mega menu columns — real multi-container `@dnd-kit/core` drag (every prior dnd-kit usage in this codebase was a single flat list), reparenting enforced against the same per-location max-depth rule as the API
- [x] The mega menu supports rich content blocks (a featured image/promo tile) alongside plain links, not just flat link lists — `MenuContentBlockType: Link | PromoTile`
- [x] A preview pane shows how the menu will render on desktop and mobile before publishing — renders the *real* `NavLinks`/`MegaMenuPanel`/`FooterColumnsGrid`/`MobileDrawerLinksList` presentational components against the current draft tree, not a mock
- [x] Publishing applies changes to the live storefront navigation atomically; changes are versioned with rollback to a prior published version — mirrors STORY-042's `HomepageLayout` `Draft`/`Published`/`Archived` pattern exactly, scoped per location
- [x] A broken-link check flags menu items pointing to a non-existent internal route or a 404ing external URL

## Tasks
- [x] **Database:** `Menu` (location, status, publishedAt), `MenuItem` (menuId, parentId self-relation, label, linkType, internalPath/externalUrl, openInNewTab, icon, visibility, targetCustomerGroup, active, contentBlockType, promo fields, sortOrder). No separate version/snapshot table — same `Draft`/`Published`/`Archived` status-enum pattern as `HomepageLayout`.
- [x] **API:** `/api/admin/navigation/menus/[location]` (+ `/items`, `/items/[itemId]`, `/items/reorder`, `/items/[itemId]/reparent`, `/publish`, `/rollback`), `/api/admin/navigation/link-check`.
- [x] **Service/Backend:** `navigation.service.ts` (reorder/nesting persistence with max-depth validation, publish/rollback, storefront resolution), `link-check.service.ts` (internal route validation via `sitemap.service.ts` plus a small static-routes list, external URL `HEAD` pinging with an injectable checker for tests), `menu-visibility.service.ts` (a scoped-down version of `popup.service.ts`'s audience matching).
- [x] **Frontend:** `src/app/(admin)/admin/navigation/page.tsx` with a 4-tab (Header/Mega Menu/Footer/Mobile) drag-and-drop tree editor (`@dnd-kit/core`, multi-container), an item edit drawer, a desktop/mobile preview toggle rendering the real storefront components, and a link-check results panel.
- [x] **Validation:** Zod schema for a menu item (exactly one of internal path / external URL, matching the link type); a max-nesting-depth guard per location (Header 2 levels, Footer 1, Mobile flat), enforced in the service layer (not the schema — Prisma can't express recursive depth constraints).
- [x] **Testing:** Unit tests for max-depth enforcement, link-target validation, reorder/reparent, publish/rollback scoping, and the published-menu-to-NavItem storefront mapping (`tests/unit/navigation-service.test.ts`); `menu-visibility.test.ts`; `link-check-service.test.ts` (internal checks against the real sitemap, external checks via an injected fake — never a real network call); `tests/e2e/admin-navigation.spec.ts` covers the admin UI (add/reorder/nest/link-check/publish) but deliberately does **not** assert a published menu against a real storefront page load, to avoid destabilizing `header.spec.ts`/`footer.spec.ts`/`search.spec.ts` under this project's `fullyParallel` Playwright config — see architecture-decisions.md.
- [x] **Documentation:** This doc + architecture-decisions.md entry. `src/lib/nav-config.ts`/`footer-config.ts` keep the hardcoded `actionNavItems`/`socialLinks`/`contactInfo`/`legalLinks` (system/functional, not content — out of scope); `Header`/`Footer`/`MobileNav` now resolve from the published DB menu with automatic fallback to those same static arrays until something's been published.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-004 (Primary Navigation & Header) and STORY-005 (Footer) — storefront components must render from the same menu data contract this console produces

## References
- `docs/blueprint.md` Section 7 ("Navigation & Menus" console module bullet)
