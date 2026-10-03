# STORY-053: CMS Workflow & Versioning

**Status:** Done (additive scope — see Scope Decision below)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## Scope Decision (2026-10-03)

This story's own "Dependencies" section (below) assumed it would ship
*before or alongside* Homepage Visual Builder (042), Admin Recipes
Workflow (043), and Admin Blog Editor (044), with those three building
against its shared engine instead of their own state. In reality, all
three were already built first — `blueprint.md` Section 9a's own
build order always had 053 landing after them, contradicting this
story's stale "Dependencies" note. Each shipped with its own bespoke
status model: `HomepageLayout` (Draft/Published/Archived, no review
step), `Recipe` (Draft/Review/Approved/Published/Archived, but gated
by one flat `Recipes:Approve` permission, no separate reviewer tiers),
`BlogPost` (Draft/Scheduled/Published/Archived, no review step at
all). `recipe-admin.service.ts` already had a comment acknowledging
this engine didn't exist yet and that every module built its own
lightweight guard instead. Separately, the RBAC model's `AdminAction`
enum only has one `Approve` per module — it cannot express independent
Marketing-Review/SEO-Review gates on one item without a schema change,
regardless of path.

**Decision, confirmed with the user:** build additively instead of
retrofitting. The genuinely missing value — version snapshots with
diff and rollback, and a cross-content-type "My Review Queue" — was
built and wired into all three existing modules' publish actions,
without touching their status enums, transition tables, or permission
gates. The full 6-state Marketing-Review → SEO-Review → Approval
pipeline, per-content-type skippable-transition configuration, and new
per-step RBAC actions were **not** built, since nothing in this
codebase needs them yet and building them speculatively would violate
this project's own no-speculative-work convention. A future content
type that genuinely needs that richer pipeline can still build it —
`versioning.service.ts`'s `recordVersion`/`listVersions`/`diffVersions`
and `review-queue.service.ts`'s `QUEUE_SOURCES` registry are both
designed to accept it without migration. See
`docs/architecture-decisions.md`'s 2026-10-03 entry for the full
reasoning.

## Acceptance Criteria (as additively delivered — see Scope Decision)
- [ ] ~~A generic `ContentWorkflow` capability... not a copy-pasted status column duplicated per model~~ — not built; Homepage/Recipe/Blog keep their own existing status models
- [ ] ~~Workflow states are Draft → Marketing Review → SEO Review → Approval → Published → Archived...~~ — not built; no content type in this codebase has that 6-state pipeline today
- [ ] ~~Each transition is configurable per content type as required or skippable...~~ — not built, no content type needs it yet
- [ ] ~~Each transition is role-gated... only Marketing Manager can complete Marketing Review, only SEO Specialist can complete SEO Review...~~ — not built; today's `AdminAction` enum has one `Approve` per module, not per-step actions
- [x] Every transition captures the acting user, a timestamp, and an optional comment — already true for Recipe's existing review step (`reviewerComment`/`reviewedById`), unchanged by this story
- [x] Every publish creates an immutable version snapshot; admins can view a diff between any two versions and roll back to any prior published version — delivered for Homepage/Recipe/Blog via `versioning.service.ts`, wired into each type's existing publish action
- [x] Rejecting an item at any review step returns it to Draft with the reviewer's comment attached — already true for Recipe, unchanged by this story
- [x] A personal "My Review Queue" view lists in-flight items across content types awaiting the current user's review action — delivered at `/admin/cms/my-queue`; Recipe's `Review`-status items are the one real source today, via an extensible `QUEUE_SOURCES` registry

## Tasks (as additively delivered)
- [x] **Database:** `ContentVersion` (entityType as a free string — not a closed enum, so a future adopter needs no migration — entityId, versionNumber, snapshot Json, createdById, createdAt). No `ContentWorkflowState`/`ContentWorkflowTransition` tables — Homepage/Recipe/Blog's own status fields and audit-log entries already cover that.
- [x] **API:** `/api/admin/cms/versions/[entityType]/[entityId]` (+ `/diff`, `/[versionId]/rollback`), `/api/admin/cms/my-queue`.
- [x] **Service/Backend:** `versioning.service.ts` (generic record/list/get/diff, permission-checked via a small entityType→module lookup), `review-queue.service.ts` (`QUEUE_SOURCES` registry + per-caller permission filtering). Each content type's own `restoreFromVersion`/`restoreLayoutFromVersion` lives in its own existing service file, reusing its existing update primitives — restoring always lands back in Draft, never bypassing that type's own approval gate.
- [x] **Frontend:** `<VersionHistoryPanel>` (version list, diff view, restore button) embedded as a new "History" tab in the Homepage Builder, Recipe, and Blog admin edit screens; `/admin/cms/my-queue` page.
- [x] **Validation:** entityType enum at the API boundary (the 3 wired types); no transition-payload schema, since no new transitions were added.
- [x] **Testing:** `versioning-service.test.ts` (record/list/diff, permission denial), `review-queue-service.test.ts`, one assertion added to each of the 3 existing publish-flow unit test files confirming a version is created, and `tests/e2e/admin-cms-versioning.spec.ts` (publish twice, diff, restore through the real UI).
- [x] **Documentation:** this doc + `docs/architecture-decisions.md`'s 2026-10-03 entry.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates every workflow transition by role/permission

This story should land before or alongside STORY-042 (Homepage Visual Builder), STORY-043 (Admin Recipes Workflow), and STORY-044 (Admin Blog Editor); those stories' acceptance criteria and tasks reference this engine rather than re-implementing draft/review/publish state.

## References
- `docs/blueprint.md` Section 7 ("CMS workflow" bullet)
