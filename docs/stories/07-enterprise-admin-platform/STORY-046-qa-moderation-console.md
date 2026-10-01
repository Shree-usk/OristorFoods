# STORY-046: Q&A Moderation Console

**Status:** Core landed (2026-10-01) — see `docs/architecture-decisions.md`'s 2026-10-01 STORY-046 entry for the full write-up, including the pre-existing `Question.answeredById` bug found and fixed, the no-RecipeQuestion scope narrowing (confirmed stale by three independent prior decisions), the permission-based separation-of-duties interpretation, the public-vs-internal reject interpretation, and the real-customer-notification/no-real-admin-notification split.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Content Editor, Super Administrator

## User Story
As Customer Support, I want to answer and moderate product questions from one console, so that every customer question gets an accurate, approved answer without delay.
As an Administrator, I want a second approval step before an answer publishes, so that customer-facing answers are checked before they go live.

## Description
This story delivers the admin-side workflow for questions submitted through STORY-016 (Product Q&A), which already shipped a complete status-transition service (`qa.service.ts::canTransitionQuestion`/`answerQuestion`/`changeQuestionStatus`, matching the blueprint's submit → answer → approve → publish flow exactly) with a comment saying "the STORY-046 moderation console calls them." Nothing admin-facing existed until now. **Deviation:** the blueprint's admin-console bullet also mentions "recipe Q&A," but that was never built as a storefront feature — confirmed stale by three independent, already-documented decisions from STORY-022, STORY-039, and `qa.repository.ts` itself, not guessed at fresh this session. This story is therefore a single-source (Product Q&A) console; a separate, user-specified follow-on story (STORY-047, "Recipe Q&A — Lightweight") adds an isolated Recipe Q&A module later without touching this one.

## Acceptance Criteria
- [x] A queue is filterable by status: New/Unanswered (Pending), Answered/Pending Approval (Answered, Approved), Published, Rejected/Hidden (Rejected). **Deviation:** no separate source-type filter — single-source (Product Q&A only; see Description).
- [x] A new question submission triggers an admin notification per the "submit → notify admin" step. **Deviation:** stays the existing console-log placeholder, not a new channel — no admin-targeted notification infrastructure exists anywhere in this codebase to extend, and the admin Dashboard's already-shipped live "Pending Product Q&A" count widget (STORY-039) gives staff real-time visibility instead. A deliberate, documented deferral.
- [x] An admin can draft an answer and save it without publishing (the Answer dialog; Pending → Answered). **Deviation:** no assignment to a specific staff member or role — not asked for by any other shipped admin module and not necessary for the core moderation loop; a straightforward follow-up if needed.
- [x] A separate approval step exists before an answer is published (Answered → Approved → Published); RBAC can be configured so answer-authoring staff cannot self-approve. **Deviation:** satisfied entirely by existing RBAC (answer gates on `QA`/`Edit`, approve/publish gate on `QA`/`Approve`), not a new same-user runtime check — verified via a permission-denial unit test and a dedicated author/reviewer e2e pair.
- [x] Publishing an approved answer triggers a "your question was answered" customer notification. Real delivery via `sendNotification()` and a new `qa.question_answered` template, reusing the established STORY-032 pipeline — not a placeholder.
- [x] A question can be rejected with an internal-only reason (`rejectionReason`, never shown to the customer — structurally invisible, since the storefront only ever selects `status: "Published"`). **Deviation:** the AC's "public 'unable to answer' response" needs no separate code path — staff write the decline as the ordinary `answerText` through the normal answer → approve → publish pipeline, noted directly in the Answer dialog's helper text.
- [x] Bulk approve and bulk publish are available across a selection, reporting `{updated, skipped}`.
- [x] An "unanswered only" view exists as the queue's default status filter (`Pending`) on load. **Deviation:** no separate date-range/target-product filter controls — date-from/date-to inputs are included; "target product" is covered by the existing search box also matching the joined product's name, rather than a dedicated picker.

## Tasks
- [x] **Database:** `Question` (STORY-016) extended with `approvedById`/`approvedBy` (`AdminUser?`) + `approvedAt`, and an internal-only `rejectionReason String?`. **Deviation/bug fix:** `answeredById`/`answeredBy` retargeted from `User` to `AdminUser` — reserved by STORY-016 "for STORY-046," wired to the wrong model since before STORY-038 existed, safe to fix since nothing had ever written to it. No `RecipeQuestion` table (see Description).
- [x] **API:** `GET /api/admin/questions` (list+filters), `POST /api/admin/questions/[id]/answer`, `/approve`, `/reject`, `/publish`, `POST /api/admin/questions/bulk`.
- [x] **Service/Backend:** `qa-moderation.service.ts` — a thin `requirePermission`+audit-log wrapper composing `qa.service.ts`'s existing transition functions (no transition logic reimplemented), same composition pattern as `review-moderation.service.ts` (STORY-045). `qa-notifications.ts`'s existing notifier-registry seam (explicitly reserved by STORY-016/032 for this story) now defaults to a real notifier calling `sendNotification()` on publish.
- [x] **Frontend:** `src/app/(admin)/admin/questions/page.tsx` + `admin-qa-queue-view.tsx` — queue table, status/date-range/search filters (defaulting to Pending), an Answer dialog, a Reject dialog (internal reason), inline Approve/Publish actions computed from each question's actual status, checkbox + bulk toolbar.
- [x] **Validation:** `qa-admin.schema.ts` — queue filters, answer (reusing the existing `answerTextSchema`), reject-reason, and bulk-moderation schemas.
- [x] **Testing:** `tests/unit/qa-moderation-service.test.ts` (10 tests). `tests/e2e/admin-qa.spec.ts` (2 tests). Fixed two pre-existing regressions from the `answeredById` retarget (`qa-lifecycle.test.ts`, `qa-repository.test.ts`) and one from the notifier default-behavior change (`qa-notifications.test.ts`). Full QA regression confirmed green at 68 tests.
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-10-01 STORY-046 entry covers every deviation above plus the `answeredById` bug and the separation-of-duties interpretation (RBAC configuration, not new code — satisfying this task's "document how to configure... via the RBAC permission matrix" directly: grant a role `QA`/`Edit` without `QA`/`Approve` for answer-only staff, and `QA`/`Approve` for reviewers).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions and enables the answer/approve separation of duties
- STORY-016 (Product Q&A) — this is the admin-side workflow for questions submitted there
- ~~Recipe Q&A~~ — **not in scope**; never built as a storefront feature (see Description). STORY-047 ("Recipe Q&A — Lightweight") adds it separately.

## References
- `docs/blueprint.md` Section 7 ("Questions & Answers" console module bullet)
- `.claude/skills/admin-console-module/SKILL.md` (notification-on-state-change rule)
