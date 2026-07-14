# STORY-053: CMS Workflow & Versioning

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## User Story
As a Content Editor, I want every content item to follow a consistent Draft → Marketing Review → SEO Review → Approval → Publish → Archive workflow with full version history, so that content quality is consistent and any published change can be rolled back.
As a Super Administrator, I want a single review queue showing everything awaiting my action across content types, so that nothing sits unreviewed because it lives in a module I didn't happen to check.

## Description
This story delivers the CMS workflow module from `docs/blueprint.md` Section 7: "Draft → Marketing Review → SEO Review → Approval → Publish → Archive, with version history and rollback." Rather than each content module reimplementing draft/review/publish state, this story builds a single, generic, entity-agnostic workflow engine that Homepage Visual Builder (STORY-042), Admin Recipes Workflow (STORY-043), and Admin Blog Editor (STORY-044) plug into via a shared `entityType`/`entityId` reference and a reusable `<ContentWorkflowPanel>` UI component. This is a cross-cutting infrastructure story for the epic, not a standalone content module.

## Acceptance Criteria
- [ ] A generic `ContentWorkflow` capability can be attached to any content entity type (Recipe, BlogPost, HomepageLayout, and future types) via `entityType` + `entityId`, not a copy-pasted status column duplicated per model
- [ ] Workflow states are Draft → Marketing Review → SEO Review → Approval → Published → Archived, modeled as an explicit state machine with a defined set of valid transitions — no arbitrary status writes are permitted
- [ ] Each transition is configurable per content type as required or skippable (e.g. a minor blog post may skip SEO Review; Homepage Builder changes always require Marketing Review) via a per-content-type configuration map
- [ ] Each transition is role-gated via STORY-038 (e.g. only Marketing Manager can complete Marketing Review, only SEO Specialist can complete SEO Review, only Super Administrator/Administrator can Approve)
- [ ] Every transition captures the acting user, a timestamp, and an optional (required-on-reject) comment, visible as an audit trail on the content item
- [ ] Every publish creates an immutable version snapshot; admins can view a diff between any two versions and roll back to any prior published version
- [ ] Rejecting an item at any review step returns it to Draft with the reviewer's comment attached and visible to the original author
- [ ] A personal "My Review Queue" view lists all in-flight items across content types awaiting the current user's review action

## Tasks
- [ ] **Database:** `ContentWorkflowState` (entityType, entityId, status enum, currentVersionId), `ContentWorkflowTransition` (from, to, actorId, comment, timestamp — the audit trail), `ContentVersion` (entityType, entityId, versionNumber, snapshotJson, createdAt).
- [ ] **API:** `/api/admin/cms/workflow/[entityType]/[entityId]/transition`, `/api/admin/cms/workflow/[entityType]/[entityId]/versions`, `/api/admin/cms/workflow/[entityType]/[entityId]/versions/[versionId]/rollback`, `/api/admin/cms/workflow/my-queue`.
- [ ] **Service/Backend:** `content-workflow.service.ts` — a generic, entity-agnostic state machine (`transition(entityType, entityId, action, actor)`) validated against a per-content-type configuration map — plus `versioning.service.ts` (snapshot/diff/rollback).
- [ ] **Frontend:** A reusable `<ContentWorkflowPanel>` component (status badge, permission-filtered transition action buttons, comment field, version history list with a diff view) designed to be embedded directly in the Homepage Builder (STORY-042), Recipes (STORY-043), and Blog (STORY-044) edit screens; a `/admin/cms/my-queue` personal review queue page.
- [ ] **Validation:** Zod schema for a transition payload (target state must be a valid next state per that content type's configuration); a required-comment rule on reject.
- [ ] **Testing:** Unit tests for the generic state machine run against multiple content-type configurations, including one that skips SEO Review; unit tests for version diff/rollback; e2e test a recipe moving through all five states using three distinct role fixtures (author, marketing reviewer, approver).
- [ ] **Documentation:** Document the per-content-type workflow configuration format and how a new content type registers into the engine — this is the reference doc STORY-042/043/044 should follow instead of building their own workflow state machinery.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates every workflow transition by role/permission

This story should land before or alongside STORY-042 (Homepage Visual Builder), STORY-043 (Admin Recipes Workflow), and STORY-044 (Admin Blog Editor); those stories' acceptance criteria and tasks reference this engine rather than re-implementing draft/review/publish state.

## References
- `docs/blueprint.md` Section 7 ("CMS workflow" bullet)
