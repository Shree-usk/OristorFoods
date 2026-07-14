# STORY-022: Recipe Reviews & Bookmarks

**Status:** Draft
**Epic:** 04 — Recipes & Food Academy
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to rate and review a recipe I've cooked, so that I can share feedback and help other customers decide what to make.
As a Busy Professional, I want to bookmark recipes I plan to cook later, so that I can quickly find them again without re-searching.
As a Gourmet Food Enthusiast, I want to see other customers' ratings and reviews on a recipe, so that I can gauge whether it's worth attempting.

## Description
This story adds community engagement to the Recipe Detail Page (STORY-018): star rating + written review submission and display, and a bookmark/save-for-later action, matching `docs/blueprint.md` Section 5 ("Community: reviews, ratings...") applied specifically to recipes, and Section 9 item 4 ("recipe reviews, bookmarks"). Recipe bookmarking mirrors the "Saved Recipes" concept owned by the Customer Platform epic (STORY-037, "Saved Recipes & Sync") — this story implements the bookmark action itself (the button/toggle on the recipe card and detail page, and the underlying save record); STORY-037 is the customer-account-side dashboard that surfaces and syncs the full saved list. The two are related, not duplicated: this story is the write/toggle path, STORY-037 is the account-side read/management view.

## Acceptance Criteria
- [ ] A recipe detail page (STORY-018) shows the average star rating and total review count, sourced from approved reviews only
- [ ] An authenticated customer can submit a star rating (1–5) and optional written review for a recipe they are viewing; unauthenticated visitors are prompted to log in/register before submitting
- [ ] A customer can submit at most one review per recipe; resubmission edits their existing review rather than creating a duplicate
- [ ] Submitted reviews are created with `status = PENDING` and are not shown in the public review list until approved via the admin Reviews Moderation Console (Epic 07, STORY-045); the submitting customer sees a "submitted, awaiting approval" confirmation
- [ ] The public review list on the recipe detail page shows only `APPROVED` reviews, paginated/sorted (e.g. Newest, Highest Rated, Lowest Rated), each showing reviewer name/initials, star rating, review text, and date
- [ ] `Recipe.avgRating` (used by STORY-017's "Highest Rated" sort and STORY-018's rating display) recalculates whenever a review is approved, edited, or removed
- [ ] An authenticated customer can bookmark/save a recipe via a toggle button on both the `RecipeCard` (STORY-017 grid) and the recipe detail page (STORY-018); the toggle reflects current saved state immediately (optimistic UI) and persists via `RecipeBookmark` records
- [ ] Unauthenticated visitors attempting to bookmark are prompted to log in/register; the intended bookmark action completes automatically after successful login (or the user is clearly told to retry)
- [ ] A customer can un-bookmark a previously saved recipe from the same toggle control
- [ ] The bookmark data model/service exposed here is what STORY-037 (Saved Recipes & Sync, Customer Platform epic) consumes to render the account-side saved-recipes list — no separate/duplicate bookmark table should be created by that story
- [ ] Rating/review and bookmark UI meet WCAG 2.1 AA (star input operable by keyboard, clear labels/ARIA for the bookmark toggle state)

## Tasks

- [ ] **Database:**
  - [ ] Define `RecipeReview` model: `id`, `recipeId`, `customerId`, `rating` (1–5 int), `reviewText` (nullable), `status` (PENDING/APPROVED/REJECTED/HIDDEN), `createdAt`, `updatedAt`; unique constraint on (`recipeId`, `customerId`)
  - [ ] Define `RecipeBookmark` model: `id`, `recipeId`, `customerId`, `createdAt`; unique constraint on (`recipeId`, `customerId`)
  - [ ] Add indexes supporting "reviews for a recipe" and "bookmarks for a customer" lookups
  - [ ] Migration; add a denormalized/cached `avgRating` + `reviewCount` on `Recipe` (already present per STORY-017) with a recalculation strategy (trigger, service-level recompute on write, or scheduled job — document the chosen approach)
  - [ ] Seed data: sample approved/pending reviews across seeded recipes, and sample bookmarks for a seeded test customer account

- [ ] **API:**
  - [ ] `POST /api/recipes/[slug]/reviews` — create/update the authenticated customer's review (upsert on the unique constraint); requires auth
  - [ ] `GET /api/recipes/[slug]/reviews` — paginated list of `APPROVED` reviews with sort param
  - [ ] `POST /api/recipes/[slug]/bookmark` / `DELETE /api/recipes/[slug]/bookmark` — toggle bookmark for the authenticated customer
  - [ ] `GET /api/recipes/[slug]/bookmark-status` (or included in the recipe detail payload when authenticated) — whether the current customer has bookmarked this recipe

- [ ] **Service/Backend:**
  - [ ] `recipe-review.service.ts`: `submitReview(recipeId, customerId, input)` (upsert), `listApprovedReviews(recipeId, sort, pagination)`, `recalculateAvgRating(recipeId)`
  - [ ] `recipe-bookmark.service.ts`: `toggleBookmark(recipeId, customerId)`, `isBookmarked(recipeId, customerId)`, `listBookmarksForCustomer(customerId)` (this last method is the one STORY-037 is expected to call/reuse rather than reimplement)
  - [ ] Repositories (`recipe-review.repository.ts`, `recipe-bookmark.repository.ts`) as the only files importing Prisma for these models
  - [ ] Auth check (NextAuth session) enforced at the service layer for both review submission and bookmark toggling, not just hidden in the UI

- [ ] **Frontend:**
  - [ ] `src/components/storefront/recipes/RecipeRatingStars.tsx` (display), `RecipeReviewForm.tsx` (Client Component, React Hook Form + Zod, star input + textarea), `RecipeReviewList.tsx` (with sort control), `RecipeBookmarkButton.tsx` (Client Component, optimistic toggle, used in both `RecipeCard` and the detail page)
  - [ ] Wire login-required prompts (e.g. redirect to `/login?returnTo=...` or an inline modal) for unauthenticated review submission and bookmarking
  - [ ] Integrate `RecipeReviewForm`/`RecipeReviewList` and `RecipeBookmarkButton` into the STORY-018 detail page, and `RecipeBookmarkButton` into the STORY-017 `RecipeCard`

- [ ] **Validation:**
  - [ ] Zod schema for review submission (`rating` int 1–5 required, `reviewText` optional with max length)
  - [ ] Server-side enforcement of "one review per customer per recipe" beyond the DB unique constraint, returning a clear validation error/upsert behavior rather than a raw constraint-violation error

- [ ] **Testing:**
  - [ ] Unit tests for `recalculateAvgRating` (correct average across approved-only reviews, ignores pending/rejected)
  - [ ] Unit tests for review upsert behavior (same customer submitting twice updates rather than duplicates)
  - [ ] Unit tests for bookmark toggle idempotency and the unique-constraint-backed "already bookmarked" case
  - [ ] Playwright e2e: as an authenticated test customer, submit a review, confirm "awaiting approval" state and that it is not yet publicly visible; toggle a bookmark on a recipe card and on the detail page and confirm state persists across reload
  - [ ] Playwright e2e: as an unauthenticated visitor, confirm review/bookmark actions prompt login rather than silently failing
  - [ ] Accessibility test pass (axe) on the review form's star rating input and the bookmark toggle

- [ ] **Documentation:**
  - [ ] Document the `RecipeBookmark` model and `recipe-bookmark.service.ts` public methods in `docs/architecture-decisions.md`, explicitly flagging it as the shared source of truth STORY-037 (Saved Recipes & Sync) must build on rather than duplicate
  - [ ] Document the `avgRating` recalculation strategy chosen (trigger vs. on-write recompute vs. scheduled job) so future review-heavy stories (e.g. product reviews, STORY-015) can reuse the same pattern if applicable

## Dependencies
- STORY-001 (Project Foundation Setup) — including the NextAuth auth scaffolding required for authenticated actions
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-017 (Recipe Centre & Listing) — bookmark toggle integrates into `RecipeCard`; avg rating feeds the "Highest Rated" sort
- STORY-018 (Recipe Detail Page) — review/rating and bookmark UI integrate into the detail page
- Related: STORY-037 (Saved Recipes & Sync, Customer Platform epic) — consumes the bookmark data/service built here for the account-side saved-recipes dashboard; not a duplicate of this story
- Related: Epic 07 STORY-045 (Reviews Moderation Console) — approves/rejects the `PENDING` reviews created here

## Out of Scope
- Review moderation UI (approve/reject/reply/feature/hide) — Epic 07, STORY-045
- Account-side "Saved Recipes" dashboard/list page and cross-device sync UX — Customer Platform epic, STORY-037
- Recipe Q&A (not specified for recipes in the blueprint; Q&A is specified for products, STORY-016)
- Reward points for leaving a recipe review (if applicable, belongs to the Rewards/Loyalty epic, STORY-030)

## References
- `docs/blueprint.md` Section 5 (Community: reviews, ratings)
- `docs/blueprint.md` Section 9 item 4 ("recipe reviews, bookmarks")
- `docs/blueprint.md` Section 9 item 6 (Customer Platform — "saved recipes")
- `docs/blueprint.md` Section 7 (Admin Console — Reviews module)
- `docs/folder-structure.md`
