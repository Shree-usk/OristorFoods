# STORY-022: Recipe Reviews & Bookmarks

**Status:** Done
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
- [x] A recipe detail page (STORY-018) shows the average star rating and total review count, sourced from approved reviews only — `RecipeRatingStars` (`src/components/storefront/recipes/recipe-rating-stars.tsx`) is rendered by `[slug]/page.tsx:130` from `recipe.avgRating`/`recipe.ratingCount`, which are recalculated only from `Approved` reviews (see the recalculation AC below).
- [x] An authenticated customer can submit a star rating (1–5) and optional written review for a recipe they are viewing; unauthenticated visitors are prompted to log in/register before submitting — `RecipeReviewForm` (`recipe-review-form.tsx:31-41`) renders a "Sign in to write a review" link with `callbackUrl` preserved when `useSession().status === "unauthenticated"`; covered end to end by `tests/e2e/recipe-reviews.spec.ts`'s "an unauthenticated visitor is prompted to sign in, with callbackUrl preserved".
- [x] A customer can submit at most one review per recipe; resubmission edits their existing review rather than creating a duplicate — enforced at the DB level (`@@unique([recipeId, customerId])`) and the UI never offers a second submission path: `RecipeReviewForm` fetches the caller's own review first (`fetchMyRecipeReview`) and, when one already exists, renders it read-only with Edit/Withdraw actions instead of the blank submission form (`recipe-review-form.tsx:48-71`). A raw second `POST` (bypassing the UI) is rejected with `DuplicateRecipeReviewError` (409), not silently converted to an edit — `tests/unit/recipe-review-service.test.ts`.
- [x] Submitted reviews are created with `status = PENDING` and are not shown in the public review list until approved via the admin Reviews Moderation Console (Epic 07, STORY-045); the submitting customer sees a "submitted, awaiting approval" confirmation — `submitReview` defaults to `Pending` (schema default); `listApprovedReviews` only ever queries `status: "Approved"`; the form shows "Thanks! Your review is pending approval." on success — `tests/e2e/recipe-reviews.spec.ts`'s first test covers the full round trip (submit → reload shows "No reviews yet." → edit → withdraw).
- [x] The public review list on the recipe detail page shows only `APPROVED` reviews, paginated/sorted (e.g. Newest, Highest Rated, Lowest Rated), each showing reviewer name/initials, star rating, review text, and date — `RecipeReviewList`/`RecipeReviewsSection` (`src/components/storefront/recipes/reviews/`), sort values `recent`/`highest`/`lowest` (`recipe-review.repository.ts`'s `orderBySort`); `tests/e2e/recipe-reviews.spec.ts`'s "approved reviews show on the recipe detail page, sorted and paginated" covers count, content, and re-sorting.
- [x] `Recipe.avgRating` (used by STORY-017's "Highest Rated" sort and STORY-018's rating display) recalculates whenever a review is approved, edited, or removed — recalculates on every status transition that crosses the `Approved` boundary (`recipe-review.service.ts`'s `changeRecipeReviewStatus`); an edit to an already-Approved review is not possible (`editOwnPendingReview` only permits edits while `status === "Pending"`, i.e. before it counts toward the average at all), so "removed" (Approved → Hidden) and "approved" are the two transitions that actually touch the aggregate, both row-locked and transactional (`updateReviewStatusAndRecalculate`) — `tests/unit/recipe-review-repository.test.ts`.
- [x] An authenticated customer can bookmark/save a recipe via a toggle button on both the `RecipeCard` (STORY-017 grid) and the recipe detail page (STORY-018); the toggle reflects current saved state immediately (optimistic UI) and persists via `RecipeBookmark` records — `RecipeBookmarkButton` used in `recipe-card.tsx:43` (icon variant) and `[slug]/page.tsx:131` (labelled variant); `useRecipeBookmark`'s `onMutate` optimistically updates the `["recipe-bookmarks"]` query cache before the network round-trip — `tests/e2e/recipe-bookmarks.spec.ts`'s "toggling on the detail page is optimistic and persists across reload".
- [x] Unauthenticated visitors attempting to bookmark are prompted to log in/register; the intended bookmark action completes automatically after successful login (or the user is clearly told to retry) — a guest toggle writes to `useRecipeBookmarkStore` (localStorage) immediately (no login prompt blocks the action itself); `RecipeBookmarkMergeSync` (mounted in `src/app/providers.tsx`) detects the unauthenticated→authenticated transition and POSTs the guest ids to `/api/recipes/bookmarks/merge` — `tests/e2e/recipe-bookmarks.spec.ts`'s "an unauthenticated visitor bookmarking as a guest sees it appear automatically after signing in".
- [x] A customer can un-bookmark a previously saved recipe from the same toggle control — `useRecipeBookmark.toggle()` branches on current membership for both the guest store and the authenticated mutation (`removeRecipeBookmark` vs. `addRecipeBookmark`).
- [x] The bookmark data model/service exposed here is what STORY-037 (Saved Recipes & Sync, Customer Platform epic) consumes to render the account-side saved-recipes list — no separate/duplicate bookmark table should be created by that story — documented explicitly in `docs/architecture-decisions.md`'s 2026-09-27 entry, naming `listBookmarksForCustomer(customerId): Promise<RecipeCard[]>` as the contract STORY-037 must call.
- [x] Rating/review and bookmark UI meet WCAG 2.1 AA (star input operable by keyboard, clear labels/ARIA for the bookmark toggle state) — star input is a `<fieldset>`/`<legend>` of visually-hidden native radios (keyboard-operable via native radio-group arrow-key behavior, no custom key handling); bookmark toggle is a real `<button aria-pressed>` with a text alternative that changes with state. Zero axe violations confirmed by `tests/e2e/recipe-reviews.spec.ts`'s and `tests/e2e/recipe-bookmarks.spec.ts`'s accessibility tests, both states.

## Tasks

- [x] **Database:**
  - [x] Define `RecipeReview` model — `prisma/schema.prisma`: `id`, `recipeId`, `customerId`, `rating: Int`, `reviewText: String?`, `status: RecipeReviewStatus @default(Pending)` (`Pending`/`Approved`/`Rejected`/`Hidden` — PascalCase, matching this codebase's existing enum-naming convention, not the story text's SCREAMING_CASE), `createdAt`, `updatedAt`, `@@unique([recipeId, customerId])`.
  - [x] Define `RecipeBookmark` model — flat `{ id, recipeId, customerId, createdAt }`, `@@unique([recipeId, customerId])` (deliberately not a `Wishlist`-style container table — see the architecture-decisions.md entry).
  - [x] Add indexes supporting "reviews for a recipe" and "bookmarks for a customer" lookups — `RecipeReview` has `@@index([recipeId, status])`; `RecipeBookmark` has `@@index([customerId])`.
  - [x] Migration; recalculation strategy documented — `prisma/migrations/<ts>_add_recipe_reviews_bookmarks`; chosen approach is service-level recompute inside the same transaction as the status-changing write, row-locked via `SELECT ... FOR UPDATE` on `Recipe` (`recipe-review.repository.ts`'s `updateReviewStatusAndRecalculate`) — not a DB trigger or scheduled job; full rationale in `docs/architecture-decisions.md`.
  - [x] Seed data: `prisma/seed.ts` walks 7 reviews through the real `submitReview`/`advanceRecipeReviewToApproved` workflow to `Approved` across 4 recipes, plus one `Pending` and one `Rejected` review (demonstrating every status), and 5 `RecipeBookmark` rows across 2 seeded customers. The 14 hardcoded fake `avgRating`/`ratingCount` pairs previously in `prisma/seed-recipes.ts` (with no backing reviews) were nulled out.

- [x] **API:**
  - [x] `POST /api/recipes/[slug]/reviews` — creates the authenticated customer's review; a second submission is rejected (409 `duplicate`), not silently upserted — editing an existing review is a separate `PATCH` action, matching `RecipeReviewForm`'s own read-then-edit UX (see the AC note above on why this is "upsert" in effect, not mechanism).
  - [x] `GET /api/recipes/[slug]/reviews` — paginated `Approved`-only list, `?sort=recent|highest|lowest`, `?page`, `?pageSize`.
  - [x] `GET /api/recipes/[slug]/reviews/mine` / `PATCH .../reviews/[reviewId]` / `DELETE .../reviews/[reviewId]` — own-review fetch/edit/withdraw, not originally itemized in this task list but required by the edit/withdraw ACs above.
  - [x] `POST /api/recipes/[slug]/bookmark` / `DELETE /api/recipes/[slug]/bookmark` — toggle for the authenticated customer.
  - [x] `GET /api/recipes/bookmarks` — the caller's bookmarked recipes (delivered as a list endpoint returning `RecipeCard[]`, superseding the story text's originally-proposed single-recipe `bookmark-status` endpoint — the frontend hook needs the full list anyway to seed the `["recipe-bookmarks"]` query cache each toggle reads from).
  - [x] `POST /api/recipes/bookmarks/merge` — guest→authenticated bookmark merge, not itemized in the original task list but required by the guest-bookmark AC.

- [x] **Service/Backend:**
  - [x] `recipe-review.service.ts`: `submitReview`, `getMyReview`, `editOwnPendingReview`, `withdrawOwnPendingReview`, `listApprovedReviews`/`listApprovedReviewsForRecipe`, `changeRecipeReviewStatus`/`canTransitionRecipeReview` (the lifecycle mutator, named to match `blog.service.ts`'s `changeCommentStatus`/`canTransitionComment` shape rather than a single `recalculateAvgRating` helper — recalculation is a side effect of a status change, not a standalone callable).
  - [x] `recipe-bookmark.service.ts`: `addBookmark`, `removeBookmark`, `listBookmarksForCustomer(customerId): Promise<RecipeCard[]>` (the exact contract STORY-037 must consume), `mergeGuestBookmarks`.
  - [x] `recipe-review.repository.ts` / `recipe-bookmark.repository.ts` are the only files importing Prisma for these two models.
  - [x] Every mutation resolves the customer from `auth()`'s server-side session; no route or service function accepts a client-supplied `customerId`.

- [x] **Frontend:**
  - [x] `RecipeRatingStars` (Server Component, display-only), `RecipeReviewForm` (Client Component, React Hook Form + Zod, controlled star-radio input + optional textarea, edit/withdraw states), `RecipeReviewList` + `RecipeReviewsSection` (sort + pagination), `RecipeBookmarkButton` (Client Component, optimistic toggle, `icon`/`labelled` variants) — `src/components/storefront/recipes/` and `.../recipes/reviews/`.
  - [x] Login-required prompts: a "Sign in to write a review" link with `callbackUrl` for reviews; bookmarking as a guest does not block on login at all (writes to local storage immediately, merges on sign-in) — a deliberately different, and more permissive, UX than a login gate, matching `Wishlist`'s existing guest-bookmark precedent.
  - [x] `RecipeReviewForm`/`RecipeReviewsSection` and `RecipeBookmarkButton` integrated into the STORY-018 detail page (`src/app/(storefront)/recipes/[slug]/page.tsx`); `RecipeBookmarkButton` integrated into the STORY-017 `RecipeCard` (`recipe-card.tsx`) as a Client Component child of a Server Component, so `RecipeCard` itself stays a Server Component.

- [x] **Validation:**
  - [x] `recipeReviewInputSchema` (`src/validation/recipe-review.schema.ts`): `rating` int 1–5 required, `reviewText` optional, trimmed, max 2000 chars, empty string transformed to `undefined`.
  - [x] "One review per customer per recipe" is enforced at the DB level (`@@unique`) and surfaced as a typed `DuplicateRecipeReviewError` → HTTP 409 (`recipe-review.errors.ts`/`recipe-review-responses.ts`), never a raw Prisma constraint-violation error.

- [x] **Testing:**
  - [x] Unit tests for the recalculation transaction: correct average across `Approved`-only reviews, `Pending`/`Rejected` never counted, zero-approved resolves to `avgRating: null` (not `0`), and two concurrent approvals both land with no lost update — `tests/unit/recipe-review-repository.test.ts`.
  - [x] Unit tests for the "one review per customer, edit/withdraw only while Pending" behavior, including the race where a moderator changes status between a caller's read and write — `tests/unit/recipe-review-service.test.ts`.
  - [x] Unit tests for bookmark idempotency and the unique-constraint-backed duplicate case — `tests/unit/recipe-bookmark-service.test.ts`, `tests/unit/recipe-bookmark-repository.test.ts`.
  - [x] Playwright e2e (`tests/e2e/recipe-reviews.spec.ts`, `tests/e2e/recipe-bookmarks.spec.ts`, 8 tests total): submit → pending-approval state → edit → withdraw; approved reviews visible/sorted/paginated; optimistic bookmark toggle persisting across reload; bookmark toggle on the `RecipeCard` grid; guest bookmark auto-appearing after sign-in.
  - [x] Playwright e2e: unauthenticated review submission prompts sign-in with `callbackUrl` preserved (bookmarking as a guest is intentionally *not* login-gated — see the Frontend task note above, so there is no "prompts login" case to test for bookmarks).
  - [x] Accessibility (axe): zero violations on the review form's star input and on the bookmark toggle in both `aria-pressed` states.

- [x] **Documentation:**
  - [x] `docs/architecture-decisions.md`'s 2026-09-27 entry documents the `RecipeBookmark` model/`recipe-bookmark.service.ts` contract for STORY-037, the `avgRating` recalculation strategy (reusable by future review-heavy stories), the deliberately-simpler `RecipeReview` lifecycle vs. `Review`'s, and an e2e fixture gotcha found during verification (a directly-created test `Recipe` needs an explicit `publishedAt` or it's invisible on the default `/recipes` listing sort).

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
