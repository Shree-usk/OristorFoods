# STORY-042: Homepage Visual Builder

**Status:** Core landed (2026-09-30) — see `docs/architecture-decisions.md`'s 2026-09-30 STORY-042 entry for the full write-up, including the five scope decisions, the rollback-via-status-reuse design, the fixture-fallback + seed strategy, the dynamic-rendering bug found and fixed, and the Base UI / test-isolation bugs found while building this.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Content Editor, Super Administrator

## User Story
As a Marketing Manager, I want to drag-and-drop rearrange and edit every homepage section without writing code, so that I can refresh the homepage or launch a seasonal look independently of engineering.
As a Content Editor, I want to preview and schedule a homepage change before it goes live, so that campaign timing is precise and mistakes don't reach customers immediately.

## Description
This story delivers the no-code Homepage Visual Builder called out in `docs/blueprint.md` Section 7, covering every homepage section in the exact order defined in Section 4: Hero Banner, Featured Categories, Why Choose Oristor, Best Selling Products, Featured Recipes, Product Collections, Food Academy, Customer Reviews, Export Solutions, Rewards Club, Instagram Gallery, Newsletter, and Footer. It is the admin-side authoring tool for the section data that STORY-006 (Homepage) renders on the storefront, and depends on STORY-041 for all image/video fields within section configurations.

## Acceptance Criteria
- [x] The builder canvas represents the homepage as an ordered list of section block instances, restricted to the 11 section types defined in blueprint Section 4 (Newsletter/Footer excluded, matching STORY-006's own documented deviation — they're already the site-wide Footer)
- [x] Sections can be reordered via real drag-and-drop (`@dnd-kit`, pointer + keyboard sensors), and an admin can add, remove, or duplicate a section instance. **Deviation:** Hero Banner sections cap at one per layout (its own multi-slide model covers "multiple banners") and aren't duplicable at the section level — duplicate individual slides within it instead.
- [x] Hero Banner has its own rich config editor per `STORY-Additional.md`: multi-banner, desktop/mobile media via the Media Library's `AssetPickerDialog`, heading/subheadline/supporting text, CTA 1 + optional CTA 2, overlay, alignment, banner ordering, show/hide. **Deviation:** the other 10 section types get reorder + show/hide + an optional title/description override only this pass — no section-specific editors (Best Selling Products override list, "auto = top N by sales", curated Customer Reviews IDs) — explicitly deferred to later stories once their individual requirements are defined, per the user's scope decision.
- [x] A preview shows the layout before publish, with a desktop/mobile toggle. **Deviation:** shows the last-*saved* draft (server-rendered via the real storefront section components, admin-only route), not unsaved in-form edits reflected live — a true live/unsaved-edit-reflecting pane needs a sync mechanism disproportionate to this pass, per the user's scope decision.
- [x] A homepage layout can be saved as a Draft without publishing
- [ ] **Deferred to the follow-up sweep** (see `docs/architecture-decisions.md`'s 2026-09-30 entry): scheduling (auto-publish/auto-expire at a future date/time) — no cron/job-runner exists in this codebase yet.
- [x] Publishing swaps the live homepage layout atomically (`publishLayoutSwappingPrevious`, one transaction); the previous layout is retained (`Archived`, never deleted) and can be rolled back to via `rollbackToPrevious` — one-level rollback this pass, not a full multi-version history list (deferred).
- [x] Any section instance (and any Hero Banner slide) can be hidden via a visibility toggle without deleting its saved configuration
- [x] Every create/edit/reorder/duplicate/publish/rollback action is gated by STORY-038 `HomepageBuilder` permissions and logged to the audit log. **Deviation:** scheduling actions don't exist yet (deferred above), so nothing to gate/log for them.
- [x] Section/slide input is Zod-validated (`homepage-builder.schema.ts`) before the service layer ever writes it, so the builder cannot save a Hero Banner slide missing its required desktop image/alt text, or a mismatched CTA label/destination pair.

## Tasks
- [x] **Database:** `HomepageLayout` (status Draft/Published/Archived, publishedAt), `HomepageSection` (layoutId, type enum, sortOrder, visible, titleOverride/descriptionOverride), `HeroBannerSlide` (the multi-banner model for the HeroBanner section type: headline/subheadline/supportingText, CTA 1+2, desktop/mobile image, video, overlay, alignment). **Deviation:** no `scheduledAt`/`expiresAt` fields (scheduling deferred); config isn't a generic JSON blob — Hero Banner gets its own typed relation, the other 10 types get two override columns directly on `HomepageSection`, matching their actual (light-touch) scope.
- [x] **API:** `/api/admin/homepage-builder/layouts` (list/create), `/layouts/[id]` (get/delete-if-draft), `/layouts/[id]/publish`, `/rollback` (site-wide, no id needed), `/layouts/[id]/sections` (add), `/sections/[sectionId]` (update/remove), `/sections/[sectionId]/duplicate`, `/sections/reorder`, and the equivalent `.../banners` sub-resource for Hero Banner slides. **Deviation:** no `/schedule` endpoint (deferred).
- [x] **Service/Backend:** `homepage-builder.service.ts` (admin-facing: layout/section/banner CRUD, reorder, publish/rollback via `publishLayoutSwappingPrevious`) and a separate storefront-facing `homepage.service.ts` (`getPublishedHomepageLayout()`, no permission gate), mirroring the `product-admin.service.ts`/`product.service.ts` split.
- [x] **Frontend:** A dnd-kit sortable canvas (`homepage-builder-canvas.tsx`) under `src/app/(admin)/admin/homepage-builder/` (task list's suggested path was stale, matches STORY-040/041's established `(admin)/admin/<module>` prefix), a rich `hero-banner-editor.tsx` (its own dnd-kit-sortable slide list), a light-touch `section-editor.tsx` for the other 10 types, a `preview/` route with a desktop/mobile width toggle. **Deviation:** no schedule picker, no multi-version history list (both deferred).
- [x] **Validation:** `homepage-builder.schema.ts` — not a discriminated union keyed by section type (only Hero Banner has real structured config; the other 10 just get two optional override strings, not worth a per-type schema shape yet at this scope).
- [x] **Testing:** `tests/unit/homepage-builder-service.test.ts` (12 tests: draft creation blank/cloned, HeroBanner-cap-at-one, section/banner CRUD+reorder+duplicate, publish/rollback atomicity, Draft-only mutation guard, permission denial). `tests/e2e/admin-homepage-builder.spec.ts` (2 tests: full build→reorder→edit→preview→publish→storefront-reflects→rollback→storefront-reverts flow; Viewer-only permission check). **Deviation:** no scheduled-clock test (feature deferred).
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-09-30 STORY-042 entry covers every section type's actual config shape (Hero Banner's `HeroBannerSlide` model vs. the other 10's two override columns) and why the builder/storefront stay in sync (`HomepageSections`, one shared renderer used by both the real homepage and the admin preview route).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-006 (Homepage) — the storefront must render from the exact section/config contract this builder produces
- STORY-041 (Media Library) — every image/video field in a section config uses the shared asset picker

## References
- `docs/blueprint.md` Section 7 ("Homepage Visual Builder" console module bullet)
- `docs/blueprint.md` Section 4 (homepage section order)
