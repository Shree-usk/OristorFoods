# STORY-015: Product Reviews & Ratings

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** Medium
**Persona(s):** Home Cook, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to rate and review products I've bought, so that I can share my experience and help other shoppers decide.

As a Gourmet Food Enthusiast, I want to read other customers' reviews and see an average rating on each product, so that I can judge quality before purchasing.

## Description
This story implements the customer-facing submit/view review and rating flow referenced in `docs/blueprint.md` Section 4 (Products: Reviews) and Section 4's Product Detail Page requirements ("customer reviews"), and it produces the data model behind Section 7's Reviews workflow (`pending → approved → published → archived`). It covers submission, storage, and public display of `Published` reviews plus the PDP integration point defined by STORY-011. The admin moderation console — approve/reject/reply/feature/hide/reward-customer actions — is explicitly out of scope here and belongs to the Admin epic's **Reviews Moderation Console** (STORY-045, Epic 07).

## Acceptance Criteria
- [ ] A logged-in customer can submit a review on a product: star rating (1–5, required), title, body text, and optional photo(s)
- [ ] A customer can submit at most one review per product; while their review is `Pending`, they can edit or withdraw it (editing after `Approved`/`Published` is not supported in this story)
- [ ] A newly submitted review is created with status `Pending` and is not publicly visible
- [ ] A `Review` Prisma model exists with a status enum (`Pending`/`Approved`/`Published`/`Rejected`/`Archived`) matching the blueprint Section 7 workflow, plus fields reserved for the future moderation console (`reviewedBy`, `reviewedAt`, `moderatorNote`) that this story does not populate but must not omit
- [ ] Only `Published` reviews are ever returned to public/storefront read endpoints
- [ ] The Product Detail Page (STORY-011's integration point) displays the aggregate rating (average + count) computed from `Published` reviews only, and a paginated list of `Published` reviews
- [ ] The review list supports sorting by most recent, highest rating, and lowest rating
- [ ] The review list can be filtered by star rating
- [ ] A review submission form validates required fields client-side and server-side before creating a `Pending` review
- [ ] If the reviewing customer has a completed order containing the product, their review is flagged/displayed as a "Verified Purchase"
- [ ] The product's aggregate rating is recalculated whenever a review transitions into or out of `Published` status
- [ ] Because there is no admin approval UI yet (STORY-045 not built), a documented seed/dev-only path exists to mark a review `Published` for local testing and demoing the storefront display

## Tasks

- [ ] **Database:**
  - [ ] Add `Review` model (rating, title, body, status enum, `productId`, `userId`, `isVerifiedPurchase`, timestamps, moderation fields reserved for STORY-045) to `prisma/schema.prisma`
  - [ ] Add an optional `ReviewImage` model for review photo attachments
  - [ ] Add a unique constraint on `(productId, userId)` to enforce one review per customer per product
  - [ ] Run and verify the migration

- [ ] **API:**
  - [ ] `POST /api/products/[slug]/reviews` — submit a review (authenticated)
  - [ ] `GET /api/products/[slug]/reviews` — list `Published` reviews with pagination, sort, and rating-filter params
  - [ ] `PATCH /api/products/[slug]/reviews/[reviewId]` — edit/withdraw own `Pending` review

- [ ] **Service/Backend:**
  - [ ] Implement `review.service.ts` (submit, edit own pending, list published, compute aggregate rating) calling a new `review.repository.ts`
  - [ ] Implement verified-purchase detection by checking the customer's order history for the product (calling into the future Order service's public interface; stub/mocked if Order module isn't built yet, documented as a known gap)
  - [ ] Implement aggregate-rating recalculation triggered on any status transition into/out of `Published`

- [ ] **Frontend:**
  - [ ] Build the review submission form (star rating input, title, body, optional photo upload) with a "your review is pending approval" confirmation state
  - [ ] Build the review list component (sort, filter by rating, pagination) for PDP integration per STORY-011's contract
  - [ ] Build the aggregate rating summary (average + histogram by star count) for the PDP

- [ ] **Validation:**
  - [ ] Zod schema for review submission (rating 1–5 integer required, title/body length bounds, max photo count)

- [ ] **Testing:**
  - [ ] Unit test the one-review-per-customer-per-product constraint and the aggregate-rating recalculation logic
  - [ ] Playwright e2e test: submit a review, confirm it does not appear publicly; seed a `Published` review directly, confirm it renders correctly on the PDP with correct aggregate rating

- [ ] **Documentation:**
  - [ ] Document the dev/seed workaround for publishing a review without the moderation console
  - [ ] Document the `Review` status lifecycle and note where STORY-045 plugs in

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — the products being reviewed
- STORY-011 (Product Detail Page) — hosts the review summary/list integration point
- STORY-045 (Reviews Moderation Console, Epic 07) — forward dependency for the admin approve/reject/reply/feature/hide/reward-customer workflow; reviews will accumulate in `Pending` with no admin UI to act on them until STORY-045 ships

## Out of Scope
- Admin moderation console: approve/reject/reply/feature/hide/reward-customer actions (STORY-045, Epic 07)
- Recipe reviews and blog/Food Academy comment moderation (separate content types, Epic 04)
- Helpful/not-helpful voting on reviews (not specified in the blueprint; can be added later without schema conflict)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Products: Reviews; Product Detail Page requirements list)
- `docs/blueprint.md` Section 7 (Admin Console — Reviews module workflow)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
