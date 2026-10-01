# STORY-045: Reviews Moderation Console

**Status:** Core landed (2026-10-01) — see `docs/architecture-decisions.md`'s 2026-10-01 STORY-045 entry for the full write-up, including the pre-existing `Review.reviewedById` bug found and fixed, the Reply/Feature/Reward-grant additions, the `Hidden`-status addition to `ReviewStatus`, the asymmetric-lifecycles design (product reviews vs. recipe reviews/blog comments), the bounded-merge pagination for "All sources", the Customer-Reviews-section-not-actually-wired finding (flagged, not fixed), and a real `updateMany`-vs-relation-`connect` bug found while writing tests.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Content Editor, Marketing Manager, Super Administrator

## User Story
As Customer Support, I want to moderate product reviews, recipe reviews, and blog/Food Academy comments from a single unified console, so that I don't have to jump between separate screens to keep customer-generated content appropriate and on-brand.
As a Marketing Manager, I want to feature strong reviews and reward the customers who wrote them, so that great feedback is amplified and loyal reviewers are recognized.

## Description
This story delivers the Reviews console module from `docs/blueprint.md` Section 7: "product reviews, recipe reviews, blog/Food Academy comments; pending → approved → published → archived workflow; approve/reject/reply/feature/hide/reward-customer actions." It unifies moderation for content submitted through STORY-015 (Product Reviews & Ratings), STORY-022 (Recipe Reviews & Bookmarks), and blog comments (STORY-021/044) — all three of which already shipped a complete status-transition service with a comment saying "approved from the moderation console (Epic 07, STORY-045)," with nothing admin-facing built until now. **Deviation:** the three underlying lifecycles are genuinely asymmetric (product reviews have a real two-step Approved→Published gate; recipe reviews/blog comments treat Approved as the visible state already) and this console's UI/service reflects that rather than forcing a false uniform status vocabulary — see the architecture-decisions entry for the full reasoning.

## Acceptance Criteria
- [x] A unified moderation queue (`/admin/reviews`) lists items across all three content types with a source-type filter: Product Reviews, Recipe Reviews, Blog Comments (+ "All sources")
- [x] Each queue item shows content type (source badge), submitter, target item (product/recipe/post, linked), star rating (where applicable — em-dash for blog comments), body text, submission date, and current status
- [x] Status follows Pending → Approved → Published → Archived for product reviews, plus Rejected and Hidden as explicit side-states. **Deviation:** recipe reviews and blog comments follow Pending → Approved → Hidden (Approved IS the visible state for those two, matching their own already-shipped STORY-021/022 design) — not forced into the product-review shape
- [x] Available actions per item: Approve, Reject, Reply, Feature (product/recipe reviews only — **Deviation**, not wired into the Homepage Builder's Customer Reviews section, which has no curated-review consumption mechanism to wire into; see architecture-decisions), Hide, and Reward Customer (manual reward point grant, built directly on STORY-030's wallet rather than gated behind the not-yet-built STORY-049)
- [x] Bulk approve/reject is available across a selected set (checkbox + toolbar), reporting which items actually updated vs. were skipped (not actually Pending)
- [x] The queue is filterable by status, source type, rating, and keyword search. **Deviation:** no date-range filter this pass (not in the plan's validation schema; straightforward follow-up, not built to keep scope tight)
- [x] Approving a product or recipe review triggers a customer notification and recalculates the target's aggregate rating — reusing the exact existing recalculation functions, zero new recalculation logic. **Deviation:** blog-comment approval triggers neither (no rating to recalculate; the AC's own wording is specific to "review")
- [x] Every moderation action is recorded in the audit log, gated by the existing `Reviews` permission module (no seed changes needed — `Reviews` and `customer_support`'s home-module grant already existed from STORY-038)

## Tasks
- [x] **Database:** `Review` gained `adminReplyBody`/`featured` plus a new `Hidden` value in `ReviewStatus`; `RecipeReview` gained `adminReplyBody`/`featured`/`reviewedById`/`reviewedAt` (mirroring `Review`'s own reserved-fields pattern, which it never had); `BlogComment` gained `adminReplyBody`. **Deviation/bug fix:** `Review.reviewedById` was retargeted from `User` to `AdminUser` — it had been wired to the wrong model since STORY-015, reserved-but-unwritten until this story wrote it for the first time.
- [x] **API:** `GET /api/admin/reviews` (unified queue), `POST /api/admin/reviews/[sourceType]/[id]/approve`, `/reject`, `/hide`, `/reply`, `/feature`, `/reward`, `/publish`, `/archive`, `/restore` (the last three product-only — **Deviation** from the plan's listed action set, needed because product reviews have a real Approved→Published→Archived chain the other two don't), `POST /api/admin/reviews/bulk`.
- [x] **Service/Backend:** `review-moderation.service.ts` composes `review.service.ts` (STORY-015, extended), `recipe-review.service.ts` (STORY-022, extended), and `blog.service.ts` (STORY-021/044) behind one interface — delegates to each domain's own `canTransition*`/`change*Status` rather than reimplementing transition logic; `rewards.service.ts` gained `grantManualPoints`. **Deviation:** blog-comment actions taken through this console gate on `Reviews`, not `Blog` (see architecture-decisions' "two doors, one lock" note) — not `reward.service.ts` from the not-yet-built STORY-049.
- [x] **Frontend:** `src/app/(admin)/admin/reviews/page.tsx` + `admin-reviews-queue-view.tsx` — unified table with source/status filters, per-row actions computed from each item's actual (sourceType, status) pair (not a false shared action set), a Reply dialog and a Reward dialog, checkbox-select + bulk toolbar.
- [x] **Validation:** `review-moderation.schema.ts` — queue filters, reply/feature/reward-grant/bulk-moderation schemas.
- [x] **Testing:** `tests/unit/review-moderation-service.test.ts` (14 tests). `tests/e2e/admin-reviews.spec.ts` (2 tests). Re-ran and fixed the pre-existing `review-lifecycle.test.ts` (the `AdminUser` fix) and confirmed zero regressions across 183 tests in 10 files spanning this story, STORY-015, STORY-022, STORY-030, and STORY-044.
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-10-01 STORY-045 entry covers every deviation above plus two real bugs found and fixed while building this (the `reviewedById` relation-target bug, and an `updateMany`-vs-relation-`connect` Prisma input-type bug caught by the first unit test run).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-015 (Product Reviews & Ratings), STORY-022 (Recipe Reviews & Bookmarks), STORY-021/044 (Blog) — this console moderates content submitted through those storefront features and reuses their own transition services directly
- STORY-030 (Rewards / Loyalty Club) — the manual reward grant extends its existing wallet primitives
- ~~STORY-049 (Rewards & Referrals Campaign Management)~~ — **not used**; the reward-customer action is a manual grant built directly on STORY-030, not gated behind this not-yet-built story (user confirmed)

## References
- `docs/blueprint.md` Section 7 ("Reviews" console module bullet)
- `.claude/skills/admin-console-module/SKILL.md` (pending → approved → published → archived pattern)
