# STORY-042: Homepage Visual Builder

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Content Editor, Super Administrator

## User Story
As a Marketing Manager, I want to drag-and-drop rearrange and edit every homepage section without writing code, so that I can refresh the homepage or launch a seasonal look independently of engineering.
As a Content Editor, I want to preview and schedule a homepage change before it goes live, so that campaign timing is precise and mistakes don't reach customers immediately.

## Description
This story delivers the no-code Homepage Visual Builder called out in `docs/blueprint.md` Section 7, covering every homepage section in the exact order defined in Section 4: Hero Banner, Featured Categories, Why Choose Oristor, Best Selling Products, Featured Recipes, Product Collections, Food Academy, Customer Reviews, Export Solutions, Rewards Club, Instagram Gallery, Newsletter, and Footer. It is the admin-side authoring tool for the section data that STORY-006 (Homepage) renders on the storefront, and depends on STORY-041 for all image/video fields within section configurations.

## Acceptance Criteria
- [ ] The builder canvas represents the homepage as an ordered list of section block instances, restricted to the section types defined in blueprint Section 4
- [ ] Sections can be reordered via drag-and-drop, and an admin can add, remove, or duplicate a section instance
- [ ] Each section type has its own config editor matching its content needs (e.g. Hero Banner: headline, subtext, CTA label/link, desktop and mobile background image/video via Media Library; Best Selling Products: manual product override list or "auto = top N by sales"; Customer Reviews: a curated list of featured review IDs pulled from STORY-045's moderation output)
- [ ] A live preview pane reflects unsaved edits before publish, with a desktop/mobile toggle
- [ ] A homepage layout can be saved as a Draft without publishing
- [ ] A homepage layout can be scheduled to go live at a future date/time, and optionally scheduled to expire/revert at a future date/time (e.g. a seasonal banner active for a fixed date range)
- [ ] Publishing swaps the live homepage layout atomically; the previous layout is retained and can be rolled back to
- [ ] Any section instance can be hidden (visibility toggle) without deleting its saved configuration
- [ ] Every create/edit/reorder/publish/schedule/rollback action is gated by STORY-038 permissions and logged to the audit log (STORY-057)
- [ ] Section config is schema-validated per section type so the builder cannot save a configuration that would break the storefront's render of that section

## Tasks
- [ ] **Database:** `HomepageLayout` (status DRAFT/SCHEDULED/PUBLISHED/ARCHIVED, publishedAt, scheduledAt, expiresAt), `HomepageSection` (layoutId, type enum matching blueprint Section 4's section list, sortOrder, config JSON, visible boolean).
- [ ] **API:** `/api/admin/homepage-builder/layouts` (CRUD), `/api/admin/homepage-builder/layouts/[id]/sections` (reorder/update), `/api/admin/homepage-builder/layouts/[id]/publish`, `/api/admin/homepage-builder/layouts/[id]/schedule`, `/api/admin/homepage-builder/layouts/[id]/rollback`.
- [ ] **Service/Backend:** `homepage-builder.service.ts` handling section reordering, per-type config validation, and publish/schedule/rollback orchestration (creating an immutable snapshot on publish).
- [ ] **Frontend:** A drag-and-drop canvas (dnd-kit) under `src/app/(admin)/homepage-builder/` (or the applicable admin route), a per-section-type editor drawer, a live preview iframe with desktop/mobile toggle, a schedule picker, and a version history list with a rollback action.
- [ ] **Validation:** A discriminated-union Zod schema keyed by section `type`, so each section's config is strictly validated against its own shape rather than a generic bag of fields.
- [ ] **Testing:** Unit tests for section reorder persistence and per-type schema validation; e2e test building a layout, scheduling it, and confirming the storefront homepage (STORY-006) renders the scheduled layout once its start time is reached (via a mocked clock); e2e test rollback to a previous published version.
- [ ] **Documentation:** Document every section type's config schema so STORY-006's storefront rendering and this builder's editor stay in sync as new section types are added.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-006 (Homepage) — the storefront must render from the exact section/config contract this builder produces
- STORY-041 (Media Library) — every image/video field in a section config uses the shared asset picker

## References
- `docs/blueprint.md` Section 7 ("Homepage Visual Builder" console module bullet)
- `docs/blueprint.md` Section 4 (homepage section order)
