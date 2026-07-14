# STORY-043: Admin Recipes Workflow

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## User Story
As a Content Editor, I want a full recipe builder covering steps, ingredients, nutrition, video, and chef notes, so that I can author rich recipe content without touching code.
As an Administrator, I want recipes to move through a draft → review → approval → publish workflow, so that no recipe reaches customers without being quality-checked.
As an SEO Specialist, I want to review a recipe's SEO fields before it publishes, so that content is optimized for search from day one.

## Description
This is the admin authoring counterpart to the customer-facing recipe experience built in STORY-017 (Recipe Centre) and STORY-018 (Recipe Detail Page), delivering the "Recipes — full recipe builder (steps, ingredients, nutrition, video, chef notes), draft → review → approval → publish workflow" console module from `docs/blueprint.md` Section 7. It is the sole write path for the `Recipe` model STORY-017/018 read from, and plugs into the shared CMS workflow engine (STORY-053) rather than reimplementing draft/review/publish state machinery.

## Acceptance Criteria
- [ ] Recipe builder form covers: title, slug, hero image/video (Media Library), category/cuisine tag, difficulty, prep/cook/total time, servings, an ordered ingredient list (quantity, unit, optional link to a `Product` for "shop this ingredient"), ordered step-by-step instructions (rich text per step, optional per-step image), nutrition facts, dietary tags, chef notes, related products, related recipes
- [ ] The video field supports either an uploaded video (via Media Library) or an embedded video URL, matching what STORY-019 (Video Recipes) renders on the storefront
- [ ] Recipe status follows Draft → In Review → Approved → Published → Archived, backed by the shared CMS workflow engine (STORY-053), with each transition role-gated (e.g. only Marketing Manager/SEO Specialist can complete their respective review steps; only Super Administrator/Administrator can Approve → Publish)
- [ ] A reviewer sees a formatted preview of the recipe as it will render on `/recipes/[slug]` before approving
- [ ] A reviewer can reject a recipe back to Draft with a required comment visible to the original author
- [ ] Only `PUBLISHED` recipes are ever returned by the storefront queries built in STORY-017/018 — enforced at the Service/Repository level, not just by UI filtering
- [ ] Every publish creates a version snapshot; version history is browsable with rollback to any prior published version
- [ ] A recipe can be scheduled to auto-publish at a future date/time once approved
- [ ] Every create/edit/submit/approve/reject/publish/rollback action is logged to the audit log (STORY-057)

## Tasks
- [ ] **Database:** Extend the `Recipe` model from STORY-018 with authoring/workflow fields (status enum, reviewer comments, current version reference); add `RecipeStep`, `RecipeIngredient`, and rely on STORY-053's generic `ContentVersion`/`ContentWorkflowState` tables for versioning and workflow state rather than duplicating them on `Recipe` directly.
- [ ] **API:** `/api/admin/recipes` (CRUD), `/api/admin/recipes/[id]/submit-for-review`, `/api/admin/recipes/[id]/approve`, `/api/admin/recipes/[id]/reject`, `/api/admin/recipes/[id]/publish`, `/api/admin/recipes/[id]/schedule`, `/api/admin/recipes/[id]/versions/[versionId]/rollback`.
- [ ] **Service/Backend:** `recipe-admin.service.ts` wrapping `recipe.repository.ts` (from STORY-018) with workflow-state transitions delegated to STORY-053's `content-workflow.service.ts`, so this story configures the workflow rather than reimplementing it.
- [ ] **Frontend:** `src/app/(admin)/recipes/page.tsx` (list + review queue), `src/app/(admin)/recipes/[id]/page.tsx` (tabbed builder: Details / Ingredients / Steps / Nutrition / Media / SEO), a reviewer preview/diff pane, and a version history panel — reusing STORY-053's shared `<ContentWorkflowPanel>` component rather than a bespoke status UI.
- [ ] **Validation:** Zod schemas per builder section; a publish-readiness guard requiring at minimum a hero image, one ingredient, and one step before the "Submit for Review" or "Publish" actions are enabled.
- [ ] **Testing:** Unit tests for the publish-readiness guard and workflow-transition role gating; e2e test a full Draft → In Review → Approved → Published path using distinct role fixtures for author and reviewer; e2e test rollback to a prior published version.
- [ ] **Documentation:** Document the recipe field contract shared with STORY-017/018 so storefront rendering and this builder never drift out of sync.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-018 (Recipe Detail Page) — the field/model contract this builder authors must match what the storefront detail page renders
- STORY-041 (Media Library) — hero images, step images, and recipe video
- STORY-053 (CMS Workflow & Versioning) — this module plugs into the shared draft/review/approval/publish/version engine rather than building its own

## References
- `docs/blueprint.md` Section 7 ("Recipes" console module bullet)
- `docs/blueprint.md` Section 4/5 (recipe content requirements)
- `.claude/skills/admin-console-module/SKILL.md`
