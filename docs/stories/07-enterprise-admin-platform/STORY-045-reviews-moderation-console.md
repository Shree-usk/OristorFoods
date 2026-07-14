# STORY-045: Reviews Moderation Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Content Editor, Marketing Manager, Super Administrator

## User Story
As Customer Support, I want to moderate product reviews, recipe reviews, and blog/Food Academy comments from a single unified console, so that I don't have to jump between separate screens to keep customer-generated content appropriate and on-brand.
As a Marketing Manager, I want to feature strong reviews and reward the customers who wrote them, so that great feedback is amplified and loyal reviewers are recognized.

## Description
This story delivers the Reviews console module from `docs/blueprint.md` Section 7: "product reviews, recipe reviews, blog/Food Academy comments; pending → approved → published → archived workflow; approve/reject/reply/feature/hide/reward-customer actions." It unifies moderation for content submitted through STORY-015 (Product Reviews & Ratings), STORY-022 (Recipe Reviews & Bookmarks), and blog/Food Academy comments (STORY-021/STORY-020), following the `pending → approved → published → archived` state pattern described in `.claude/skills/admin-console-module/SKILL.md`.

## Acceptance Criteria
- [ ] A unified moderation queue lists items across all three content types with a source-type filter: Product Reviews, Recipe Reviews, Blog/Food Academy Comments
- [ ] Each queue item shows content type, submitter, target item (product/recipe/post), star rating (where applicable), body text, submission date, and current status
- [ ] Status follows Pending → Approved → Published → Archived, plus Rejected and Hidden as explicit side-states
- [ ] Available actions per item: Approve, Reject, Reply (an admin-authored public reply attached to the review), Feature (pin/highlight, consumable by the Homepage Visual Builder's Customer Reviews section, STORY-042), Hide (remove from public view without deleting), and Reward Customer (issue a manual reward point grant)
- [ ] Bulk approve/reject is available across a filtered selection
- [ ] The queue is filterable by status, content type, rating range, date range, and keyword search
- [ ] Approving a review triggers a customer notification and recalculates the target product's or recipe's aggregate rating
- [ ] Every moderation action (approve/reject/reply/feature/hide/reward) is recorded in the audit log (STORY-057)

## Tasks
- [ ] **Database:** Confirm/extend `Review` (from STORY-015) and `RecipeReview` (from STORY-022) with a shared status enum (PENDING/APPROVED/PUBLISHED/REJECTED/HIDDEN/ARCHIVED) and a `featured` boolean; reuse `BlogComment` (from STORY-044) with the same status vocabulary where practical.
- [ ] **API:** `/api/admin/reviews` (unified list across sources with a `sourceType` filter), `/api/admin/reviews/[id]/approve`, `/reject`, `/reply`, `/feature`, `/hide`, `/reward`.
- [ ] **Service/Backend:** `review-moderation.service.ts` composing `product-review.service` (STORY-015), `recipe-review.service` (STORY-022), and `blog-comment.service` (STORY-044) behind one interface; triggers rating recalculation and delegates to `notification.service` (STORY-032) and `reward.service` (STORY-049) for the notify and reward-customer actions.
- [ ] **Frontend:** `src/app/(admin)/reviews/page.tsx` — unified queue table with source-type tabs, a detail drawer with the action buttons above, and a bulk-action toolbar.
- [ ] **Validation:** Zod schema for reply text (non-empty, max length) and reward-grant amount bounds.
- [ ] **Testing:** Unit tests for aggregate-rating recalculation on approve/hide transitions and the reward-grant integration; e2e test approving a pending product review and confirming it appears on the storefront product detail page.
- [ ] **Documentation:** Document the unified moderation status enum shared across product reviews, recipe reviews, and blog comments.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-015 (Product Reviews & Ratings), STORY-022 (Recipe Reviews & Bookmarks), STORY-021 (Blog) — this console moderates content submitted through those storefront features
- STORY-049 (Rewards & Referrals Campaign Management) — backs the reward-customer action's point grant

## References
- `docs/blueprint.md` Section 7 ("Reviews" console module bullet)
- `.claude/skills/admin-console-module/SKILL.md` (pending → approved → published → archived pattern)
