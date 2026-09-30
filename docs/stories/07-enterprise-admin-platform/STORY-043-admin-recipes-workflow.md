# STORY-043: Admin Recipes Workflow

**Status:** Core landed (2026-09-30) — see `docs/architecture-decisions.md`'s 2026-09-30 STORY-043 entry for the full write-up, including the STORY-053 deviation, the version-history/scheduling deferrals, the publish-readiness guard, the reviewer-comment field, the `valueAsNumber`/NaN bug found and fixed, and the `SelectValue` raw-value-display bug found but deliberately not fixed here.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## User Story
As a Content Editor, I want a full recipe builder covering steps, ingredients, nutrition, video, and chef notes, so that I can author rich recipe content without touching code.
As an Administrator, I want recipes to move through a draft → review → approval → publish workflow, so that no recipe reaches customers without being quality-checked.
As an SEO Specialist, I want to review a recipe's SEO fields before it publishes, so that content is optimized for search from day one.

## Description
This is the admin authoring counterpart to the customer-facing recipe experience built in STORY-017 (Recipe Centre) and STORY-018 (Recipe Detail Page), delivering the "Recipes — full recipe builder (steps, ingredients, nutrition, video, chef notes), draft → review → approval → publish workflow" console module from `docs/blueprint.md` Section 7. It is the sole write path for the `Recipe` model STORY-017/018 read from. **Deviation:** built directly on `Recipe` with its own lightweight `ALLOWED_TRANSITIONS` workflow guard, not on STORY-053's shared CMS Workflow & Versioning engine — STORY-053 doesn't exist yet, and every other admin module so far (STORY-040, STORY-042) took the same approach rather than waiting for a shared engine nothing else needs yet either. See the architecture-decisions entry for the full reasoning.

## Acceptance Criteria
- [x] Recipe builder form covers: title, slug, hero image/video (Media Library), category/cuisine tag, difficulty, prep/cook/total time, servings, an ordered ingredient list (quantity, unit, optional link to a `Product` for "shop this ingredient"), ordered step-by-step instructions (per step, optional per-step image), nutrition facts, dietary tags, chef notes
- [x] The video field supports either an uploaded video (via Media Library) or an embedded video URL, matching what STORY-019 (Video Recipes) renders on the storefront
- [x] Recipe status follows Draft → Review → Approved → Published → Archived. **Deviation:** backed by this story's own `ALLOWED_TRANSITIONS` whitelist in `recipe-admin.service.ts` (not STORY-053, which doesn't exist yet); role-gated via the existing STORY-038 `"Recipes"` module — `Edit` covers create/update/submit/archive/restore, `Approve` (a pre-existing `AdminAction` value) covers approve/reject/publish specifically
- [x] A reviewer sees a formatted preview of the recipe as it will render on `/recipes/[slug]` before approving — `/admin/recipes/[id]/preview` server-renders the real storefront components against any-status data via the same `toRecipeDetail` transformation the storefront uses, so the two can never structurally drift apart
- [x] A reviewer can reject a recipe back to Draft with a required comment visible to the original author (`reviewerComment` field, cleared on the next submit)
- [x] Only `Published` recipes are ever returned by the storefront queries built in STORY-017/018 — unchanged, enforced at the Repository level via `findPublishedRecipeBySlug`; this story's admin reads use the separate any-status `findRecipeAdminDetailById`
- [ ] **Deferred** (see architecture-decisions entry): full version snapshot-per-publish with browsable history and rollback-to-any-version — core ships the Draft→Review→Approved→Published gate and reject-with-comment instead, consistent with STORY-042's same deferral for homepage layouts
- [ ] **Deferred:** scheduled auto-publish at a future date/time — no cron/job-runner exists in this codebase yet
- [x] Every create/edit/submit/approve/reject/publish/archive/restore action is gated by STORY-038 permissions and logged to the audit log, with `{ from, to }` (and the comment, for rejects) in the log metadata

## Tasks
- [x] **Database:** Added to `Recipe`: `reviewerComment String?`, `createdById`/`updatedById`/`reviewedById` (all optional `AdminUser` relations, `onDelete: SetNull`, mirroring `Product.createdById`/`updatedById` from STORY-040 plus one more for "who reviewed this"). No new tables — `RecipeStep`/`RecipeIngredient` already modeled what the builder needed. **Deviation:** no `ContentVersion`/`ContentWorkflowState` tables (STORY-053 doesn't exist; see Description).
- [x] **API:** `/api/admin/recipes` (list/create), `/api/admin/recipes/[id]` (get/update/delete), `/api/admin/recipes/[id]/submit-for-review`, `/approve`, `/reject`, `/publish`, `/archive`, `/restore`, `/api/admin/recipes/reference-data`. **Deviation:** no `/schedule` or `/versions/[versionId]/rollback` endpoints (both deferred).
- [x] **Service/Backend:** `recipe-admin.service.ts` — the `ALLOWED_TRANSITIONS` whitelist, `assertPublishReady` guard, `requirePermission` + `writeAuditLog` on every mutating call, `getRecipeForPreview` reusing the storefront's own `toRecipeDetail`. **Deviation:** no delegation to a STORY-053 `content-workflow.service.ts` (doesn't exist).
- [x] **Frontend:** `src/app/(admin)/admin/recipes/page.tsx` (list + status filter), `src/app/(admin)/admin/recipes/[id]/page.tsx` + `admin-recipe-form.tsx` (tabbed builder: Details / Ingredients / Steps / Nutrition / Media / SEO, `useFieldArray` for ingredients/steps, `AssetPickerDialog` for hero image and per-step images, a lightweight in-form product picker for "shop this ingredient"), workflow action buttons per current status + granted actions, `src/app/(admin)/admin/recipes/[id]/preview/page.tsx`. **Deviation:** no version-history panel, no schedule picker (both deferred); no `<ContentWorkflowPanel>` (STORY-053 doesn't exist) — action buttons are bespoke, matching STORY-040/042's own pattern.
- [x] **Validation:** `recipe-admin.schema.ts` covering the full builder payload plus a `rejectRecipeSchema` requiring a non-empty comment. The publish-readiness guard (hero image + alt, ≥1 ingredient, ≥1 step) lives in the service layer, not just disabled buttons.
- [x] **Testing:** `tests/unit/recipe-admin-service.test.ts` (11 tests: create/update with ingredients+steps, duplicate-slug rejection, full transition matrix incl. illegal transitions, reject-with-comment, the 3-part publish-readiness guard, Draft-only delete, permission denial, Approve-specifically-required for approve/reject/publish). `tests/e2e/admin-recipes.spec.ts` (2 tests: full author→reviewer→author→reviewer lifecycle including preview and reject-with-comment, ending on the real storefront; Viewer-only permission check). **Deviation:** no rollback-to-prior-version test (feature deferred).
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-09-30 STORY-043 entry — the STORY-053 deviation, the publish-readiness guard, the `valueAsNumber`/NaN bug found and fixed, and the pre-existing `SelectValue` raw-value-display bug found but deliberately left unfixed (flagged as a follow-up, likely also affecting the Products module's Brand/Category selects).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-018 (Recipe Detail Page) — the field/model contract this builder authors must match what the storefront detail page renders
- STORY-041 (Media Library) — hero images, step images, and recipe video
- ~~STORY-053 (CMS Workflow & Versioning)~~ — **not used**; this module built its own lightweight workflow guard instead of waiting for a shared engine that doesn't exist yet (see Description)

## References
- `docs/blueprint.md` Section 7 ("Recipes" console module bullet)
- `docs/blueprint.md` Section 4/5 (recipe content requirements)
- `.claude/skills/admin-console-module/SKILL.md`
