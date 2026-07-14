# STORY-046: Q&A Moderation Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Content Editor, Super Administrator

## User Story
As Customer Support, I want to answer and moderate product and recipe questions from one console, so that every customer question gets an accurate, approved answer without delay.
As an Administrator, I want a second approval step before an answer publishes, so that customer-facing answers are checked before they go live.

## Description
This story delivers the Questions & Answers console module from `docs/blueprint.md` Section 7: "product Q&A and recipe Q&A, each with its own submit → notify admin → answer → approve → publish → notify customer flow." It is the admin-side workflow for questions submitted through STORY-016 (Product Q&A) and the equivalent recipe Q&A surface, unifying both into one moderation queue.

## Acceptance Criteria
- [ ] A unified Q&A queue is filterable by source type (Product Q&A, Recipe Q&A) and status: New/Unanswered, Answered/Pending Approval, Published, Rejected/Hidden
- [ ] A new question submission triggers an admin notification per the "submit → notify admin" step
- [ ] An admin can draft an answer and save it without publishing, optionally assigning the question to a specific staff member or role
- [ ] A separate approval step exists before an answer is published; RBAC (STORY-038) can be configured so answer-authoring staff cannot self-approve their own answers (separation of duties), while roles with the approve permission can
- [ ] Publishing an approved answer triggers a "your question was answered" customer notification per the "publish → notify customer" step
- [ ] A question can be rejected with either an internal-only reason (not shown to the customer) or a public "unable to answer" response
- [ ] Bulk approve and bulk publish are available across a filtered selection
- [ ] An "unanswered only" saved filter view exists as an SLA-style queue for support staff, plus filters by date range and target product/recipe

## Tasks
- [ ] **Database:** Extend `ProductQuestion` (STORY-016) and add `RecipeQuestion` with a shared status enum (NEW/ANSWERED/APPROVED/PUBLISHED/REJECTED), `answeredById`, `approvedById`, and an internal-only `rejectionReason` field.
- [ ] **API:** `/api/admin/questions` (unified list/filter), `/api/admin/questions/[id]/answer`, `/approve`, `/reject`, `/publish`.
- [ ] **Service/Backend:** `qa-moderation.service.ts` implementing the full state machine and integrating `notification.service` (STORY-032) for both the admin-alert-on-submit and customer-notify-on-publish triggers.
- [ ] **Frontend:** `src/app/(admin)/questions/page.tsx` — unified queue with source-type tabs, an answer composer, an approve/reject action panel, and an "unanswered only" saved view.
- [ ] **Validation:** Zod schema for answer text (minimum length) and the reject-reason payload (internal vs. public variants).
- [ ] **Testing:** Unit tests for the full state machine (new → answered → approved → published, and the rejected branch) and for the two-step answer/approve separation-of-duties enforcement; unit tests confirming notifications fire at the correct transitions; e2e test answer → approve → publish and confirm the customer-facing product/recipe page shows the published answer.
- [ ] **Documentation:** Document how to configure the answer/approve separation-of-duties option via the RBAC permission matrix (STORY-038).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions and enables the optional answer/approve separation of duties
- STORY-016 (Product Q&A) — this is the admin-side workflow for questions submitted there; recipe Q&A submission feeds the same unified queue

## References
- `docs/blueprint.md` Section 7 ("Questions & Answers" console module bullet)
- `.claude/skills/admin-console-module/SKILL.md` (notification-on-state-change rule)
