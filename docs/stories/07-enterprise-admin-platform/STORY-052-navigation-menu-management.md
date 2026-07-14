# STORY-052: Navigation & Menu Management

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Low
**Persona(s):** Content Editor, Marketing Manager, Super Administrator

## User Story
As a Content Editor, I want to manage the header, mega menu, footer, and mobile menu with drag-to-reorder, so that site navigation can change without a code deployment.

## Description
This story delivers the Navigation & Menus console module from `docs/blueprint.md` Section 7: "header/mega menu/footer/mobile menu, drag-to-reorder." It is the admin authoring tool for the navigation structures rendered on the storefront by STORY-004 (Primary Navigation & Header) and STORY-005 (Footer), which must consume the same menu data contract this console produces.

## Acceptance Criteria
- [ ] The menu manager supports four distinct menu locations: Header (primary nav), Mega Menu (nested columns/sections per top-level item), Footer (multi-column link groups), and Mobile Menu
- [ ] Each menu item has: label, link target (an internal route picker or an external URL), an open-in-new-tab flag, an optional icon, a visibility rule (role-based or always visible), and an active/inactive toggle
- [ ] Items can be drag-to-reordered within a menu, and dragged between nesting levels for mega menu columns
- [ ] The mega menu supports rich content blocks (a featured image/promo tile) alongside plain links, not just flat link lists
- [ ] A preview pane shows how the menu will render on desktop and mobile before publishing
- [ ] Publishing applies changes to the live storefront navigation atomically; changes are versioned with rollback to a prior published version
- [ ] A broken-link check flags menu items pointing to a non-existent internal route or a 404ing external URL

## Tasks
- [ ] **Database:** `MenuLocation` (HEADER/MEGA_MENU/FOOTER/MOBILE), `MenuItem` (locationId, parentId, label, url, sortOrder, openInNewTab, visible, iconId), `MenuVersion` (snapshot JSON, publishedAt) for rollback.
- [ ] **API:** `/api/admin/navigation/menus/[location]`, `/api/admin/navigation/menus/[location]/items`, `/api/admin/navigation/menus/[location]/publish`, `/api/admin/navigation/link-check`.
- [ ] **Service/Backend:** `navigation.service.ts` (reorder/nesting persistence, publish/rollback), `link-check.service.ts` (validates internal route existence and pings external URLs).
- [ ] **Frontend:** `src/app/(admin)/navigation/page.tsx` with a per-location drag-and-drop tree editor (dnd-kit), an item edit drawer, a desktop/mobile preview toggle, and a broken-link report panel.
- [ ] **Validation:** Zod schema for a menu item (must have exactly one of an internal route or an external URL, not both empty); a max-nesting-depth guard for mega menu columns.
- [ ] **Testing:** Unit tests for reorder/nesting persistence and broken-link detection; e2e test reordering a header menu item, publishing, and confirming STORY-004's storefront header reflects the new order.
- [ ] **Documentation:** Document the menu item data contract consumed by STORY-004 (header) and STORY-005 (footer) storefront components.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-004 (Primary Navigation & Header) and STORY-005 (Footer) — storefront components must render from the same menu data contract this console produces

## References
- `docs/blueprint.md` Section 7 ("Navigation & Menus" console module bullet)
