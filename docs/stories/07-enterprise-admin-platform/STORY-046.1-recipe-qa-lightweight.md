# STORY-046.1: Recipe Q&A — Lightweight

**Status:** Core landed (2026-10-01) — see `docs/architecture-decisions.md`'s 2026-10-01 STORY-046.1 entry for the full write-up, including the `QuestionStatus` enum-reuse decision (a deliberate deviation from the Review/RecipeReview precedent), the `customerId` naming convention, the no-provider-registry simplification, and the two intentional lightweight omissions (no "my open questions" tracking, no customer-facing search).
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Content Editor, Super Administrator, Customer

**Naming note:** this story is filed as `STORY-046.1` (originally user-supplied as a raw `.txt` spec that called itself "STORY-047" — the real backlog's own STORY-047 is "Admin Orders Console," confirmed in a full backlog survey and recorded in `docs/blueprint.md` Section 9a). Always refer to this work as STORY-046.1.

## User Story
As a customer, I want to ask questions about a recipe and see answers to what others have asked, so that I can get practical help before I cook it.
As Customer Support, I want to answer and moderate recipe questions from their own lightweight console, so that recipe questions get handled without disturbing the existing Product Q&A workflow.

## Description
Adds a lightweight, fully isolated Recipe Q&A module, reusing Product Q&A's (STORY-016/046) architecture, status workflow, permissions, and notification patterns wherever practical — but sharing no code path or data model with it, and reachable through a **separate** admin console (`/admin/recipe-questions`, never merged into `/admin/questions`). Scoped deliberately tight per the originating spec: no bulk operations beyond basic approve/publish, no advanced filters, no analytics, no extra moderation features.

## Acceptance Criteria
- [x] A customer can submit a question from a Recipe page (signed-in only, mirrors Product Q&A's sign-in gate)
- [x] A customer can view published questions and answers for that Recipe
- [x] An admin can view pending Recipe questions in a dedicated console
- [x] An admin can answer a Recipe question
- [x] An admin can approve, reject, and publish an answer (`Pending → Answered → Approved → Published`, `Rejected` from any state — identical to Product Q&A's workflow)
- [x] Rejected questions remain invisible to customers (internal-only `rejectionReason`, never serialized to the public API; a Rejected row is structurally excluded since the public list only ever selects `status: "Published"`)
- [x] Customer receives a real notification when their answer is published, reusing the established `sendNotification()` infrastructure (STORY-032) — a new `recipe_qa.question_answered` template, not a placeholder
- [x] A lightweight Recipe Q&A admin section exists, following the existing admin UI pattern (basic list, status filter, and a Recipe filter — implemented via the existing search box also matching the joined recipe's title, same trick as STORY-046's product-name search, rather than a separate picker)
- [x] Answer/Approve/Reject/Publish actions use the existing QA permissions/RBAC pattern — no new permission system introduced
- [x] Database: only the minimum `RecipeQuestion` model/relations added; the existing `Question` (Product Q&A) model and its relationships are completely unchanged
- [x] API/Service: endpoints and service methods scoped to Recipe Q&A only; reuses existing QA validation (`answerTextSchema`), moderation, and notification patterns without duplicating Product Q&A's logic
- [x] Existing Product Q&A tests continue passing (78 tests, confirmed unchanged)

## Tasks
- [x] **Database:** New `RecipeQuestion` model (`prisma/schema.prisma`) — `recipeId`/`recipe`, `customerId`/`customer` (`"RecipeQuestionAsker"`), `text`, `status` (reuses the existing `QuestionStatus` enum — see architecture-decisions for why), `answerText`/`answeredById`/`answeredBy` (`AdminUser`, `"RecipeQuestionAnswerer"`)/`answeredAt`, `approvedById`/`approvedBy` (`"RecipeQuestionApprover"`)/`approvedAt`, internal-only `rejectionReason`, `publishedAt`. Back-relations added to `Recipe`, `User`, `AdminUser`. Zero changes to `Question`/`Product Q&A`.
- [x] **API:** Customer-facing `GET/POST /api/recipes/[slug]/questions` (mirrors `/api/recipes/[slug]/reviews`). Admin `GET /api/admin/recipe-questions`, `POST /api/admin/recipe-questions/[id]/{answer,approve,reject,publish}`, `POST /api/admin/recipe-questions/bulk` — a fully separate route tree from `/api/admin/questions`.
- [x] **Service/Backend:** `recipe-qa.service.ts` (transition logic + customer actions, mirrors `qa.service.ts`), `recipe-qa-notifications.ts` (real notifier from the start), `recipe-qa-moderation.service.ts` (admin wrapper, mirrors `qa-moderation.service.ts`), `recipe-qa.errors.ts` (own error hierarchy, mirrors `qa.errors.ts`).
- [x] **Frontend:** Customer — `RecipeQuestionsSection`/`AskRecipeQuestionForm`/`RecipeQuestionsList` wired into the recipe detail page below `RecipeReviewsSection`. Admin — `/admin/recipe-questions` page + `AdminRecipeQaQueueView`, a separate console, `RequirePermission` gated on `QA`/`View`.
- [x] **Validation:** `recipe-question.schema.ts` (customer input, reuses `answerTextSchema` from `question.schema.ts` rather than cloning it), `recipe-qa-admin.schema.ts` (admin filters/actions, mirrors `qa-admin.schema.ts`).
- [x] **Testing:** `tests/unit/recipe-qa-lifecycle.test.ts` + `tests/unit/recipe-qa-moderation-service.test.ts` (44 tests). `tests/e2e/admin-recipe-qa.spec.ts` (2 tests, author/reviewer separation-of-duties pair). Full regression confirming all 78 Product Q&A tests and Recipe Review tests pass unchanged.
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-10-01 STORY-046.1 entry covers every scope decision above.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions via the existing `QA` permission module
- STORY-016/STORY-046 (Product Q&A) — the architecture this story reuses patterns from, without sharing code or data
- STORY-017/STORY-022 (Recipes & Recipe Reviews) — the Recipe model and the `customerId` relation-naming convention this story follows

## References
- `docs/stories/07-enterprise-admin-platform/STORY-046.1-Recipe Q&A-Lightweight.txt` — the original user-supplied spec
- `docs/blueprint.md` Section 9a — confirms this story's place in the build sequence and the STORY-047 naming note
