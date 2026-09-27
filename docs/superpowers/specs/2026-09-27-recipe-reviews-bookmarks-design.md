# STORY-022 Recipe Reviews & Bookmarks — Design Decisions

Spec for community engagement on the Recipe Detail Page: star rating + review
submission/display, and a bookmark/save-for-later toggle. Both halves are
new models scoped to `Recipe`, but neither is a novel design problem — this
codebase already has a mature, shipped precedent for each: `review.service.ts`
(Product Reviews, STORY-015) for the moderated-rating lifecycle, and
`wishlist.service.ts` (STORY-013) for the auth-gated, guest-capable toggle.
This spec is mostly "apply that precedent to Recipe," with the differences
called out explicitly.

**Ground rule for every "mirrors X" decision below:** adapt the
architectural pattern (layering, transaction shape, error-handling
convention, optimistic-update flow) — never copy a `Review`/`Wishlist`
source file byte-for-byte and rename identifiers. Where the two domains
already need identical logic (e.g. the "strip-and-lock-then-recompute"
transaction shape, or the guest-store `add`/`remove`/`has`/`clear` shape),
write it fresh for `Recipe`; do not introduce a shared abstraction between
the Product and Recipe implementations solely to make them structurally
identical — that would be new coupling this spec has no requirement for.

## 1. `RecipeReview`: simpler lifecycle than `Review`, no title field

`Review` (Product Reviews) has a 5-state lifecycle (`Pending → Approved →
Published → Archived`, with `Archived → Published` for reinstatement) because
a Product review has a real "Approved but not yet Published" gap — the
moderation console can approve content before it's live. The AC for Recipe
Reviews doesn't ask for that extra step: "reviews are created with `status =
PENDING`... not shown... until approved" — approval *is* publication here,
the same shape `BlogComment` (STORY-021) already established:

```
Pending  → Approved | Rejected
Approved → Hidden
Rejected → (terminal)
Hidden   → (terminal)
```

`recipe-review.service.ts`'s `canTransitionRecipeReview`/
`changeRecipeReviewStatus` mirror `blog.service.ts`'s
`canTransitionComment`/`changeCommentStatus` exactly (an
`allowedTransitions` table + one mutation function) — not `review.service.ts`'s
more complex one, since the state shapes now genuinely differ.

`RecipeReview` also drops `Review`'s `title` field: the AC asks for "a star
rating (1–5) and optional written review," not a separate headline. Fields:
`rating` (Int 1–5), `reviewText` (String, nullable — a rating alone is a
valid review, matching "optional written review"). No `isVerifiedPurchase`
equivalent (nothing in the AC calls for one), no `reviewedById`/
`moderatorNote`/`publishedAt` moderator-audit columns (same simplification
`BlogComment` made — Epic 07's future moderation console can add them
alongside its own UI, the same way it will for `BlogComment`).

## 2. `avgRating`/`reviewCount` recalculation: reuse `Recipe`'s existing flat columns, `Review`'s transaction pattern

Unlike `Product`, which stores its aggregate in a separate
`ProductRatingSummary` row (recalculated because a Published review's
histogram — `count1`..`count5` — is genuinely relational, one row per
product), `Recipe.avgRating`/`Recipe.ratingCount` (added in STORY-017) are
already flat columns directly on `Recipe`. The AC doesn't ask for a rating
histogram, only "average star rating and total review count." So
recalculation stays a direct `UPDATE "Recipe"` inside the same transaction
as the status change — `Review`'s `updateStatusAndRecalculate`'s exact
shape (row-lock the parent via `SELECT ... FOR UPDATE`, recompute over
`Approved`-only rows, write back), but the destination is `Recipe`'s own
two columns, not a side table:

```typescript
// recipe-review.repository.ts
export function updateReviewStatusAndRecalculate(
  reviewId: string,
  recipeId: string,
  fromStatus: RecipeReviewStatus,
  data: Prisma.RecipeReviewUpdateInput,
  recalculate: boolean,
) {
  return prisma.$transaction(async (tx) => {
    if (recalculate) {
      await tx.$queryRaw`SELECT 1 FROM "Recipe" WHERE "id" = ${recipeId} FOR UPDATE`;
    }
    const { count } = await tx.recipeReview.updateMany({ where: { id: reviewId, status: fromStatus }, data });
    if (count === 0) return null;
    if (recalculate) {
      const agg = await tx.recipeReview.aggregate({
        where: { recipeId, status: "Approved" },
        _avg: { rating: true },
        _count: true,
      });
      await tx.recipe.update({
        where: { id: recipeId },
        data: { avgRating: agg._avg.rating ?? null, ratingCount: agg._count },
      });
    }
    return tx.recipeReview.findUnique({ where: { id: reviewId } });
  });
}
```

`recalculate` is `true` whenever the transition crosses the `Approved`
boundary in either direction (`Pending→Approved`, `Approved→Hidden`,
`Approved→Rejected` is impossible per the transition table above so doesn't
need handling) — same trigger condition `review.service.ts`'s
`touchesPublished` flag uses today.

## 3. One review per customer per recipe: upsert + edit + withdraw, mirroring `ReviewForm`'s exact UX

The AC ("at most one review per recipe; resubmission edits their existing
review") and the existing `ReviewForm.tsx` component already solve this
identically. `recipe-review.service.ts` gets the same three-function shape
`review.service.ts` has: `submitReview` (create, `@@unique([recipeId,
customerId])`-backed, `P2002` → `DuplicateReviewError`), `editOwnPendingReview`
(conditional update on `status: "Pending"`, so a moderator approving between
read and write can't be silently overwritten), `withdrawOwnPendingReview`
(delete — a still-Pending review was never public, withdrawing just frees
the slot, same reasoning `review.service.ts`'s doc comment gives). New
typed errors in `recipe-review.errors.ts` mirror `review.errors.ts`'s
`RecipeNotFoundError`/`RecipeReviewNotFoundError`/`RecipeReviewForbiddenError`/
`DuplicateRecipeReviewError`/`RecipeReviewNotEditableError`/
`InvalidRecipeReviewTransitionError`.

`RecipeReviewForm.tsx` is `ReviewForm.tsx` copied and adapted: same
sign-in-prompt-when-unauthenticated pattern (`/account/login?callbackUrl=...`),
same `fetchMyReview`/`isEditing`/`isConfirmingWithdraw` state machine, same
controlled star-radio input (`useController`, not `register`, for the exact
reason `ReviewForm.tsx`'s own comment gives — RHF's strict string/number
comparison on a radio group), same 409-conflict handling. Only the title
field and its Zod validation are dropped, and `rating`+`reviewText` are the
only fields client- and server-side (`recipeReviewInputSchema`).

## 4. `RecipeBookmark`: flat model, not a `Wishlist`-style container

`Wishlist`+`WishlistItem` is a two-table design because a wishlist is
logically "one container per user, many items in it" — useful for a future
per-list feature (multiple named lists), which isn't asked for here. The
story's own Database task specifies a flat `RecipeBookmark { id, recipeId,
customerId, createdAt }` with `@@unique([recipeId, customerId])` directly —
simpler, and this spec follows that rather than introducing an unneeded
container table. `recipe-bookmark.repository.ts`'s shape mirrors
`wishlist.repository.ts`'s item-level functions directly (no
`findOrCreateWishlist`-equivalent needed, since there's no container to
find-or-create): `addBookmark` (idempotent — `P2002` swallowed, matching
`wishlist.service.ts`'s `addToWishlist`), `removeBookmark` (`deleteMany`,
never `delete`), `listBookmarkedRecipesForCustomer`, `isBookmarked`.

`recipe-bookmark.service.ts`'s `listBookmarksForCustomer(customerId)` is the
one method the story's own AC names as "what STORY-037 is expected to
call/reuse rather than reimplement" — it returns `RecipeCard[]` (the same
shape `RecipeGrid`/`RecipeCard` already consume), the same way
`wishlist.service.ts`'s `getWishlist` returns `ProductListItem[]` for
`WishlistView`/`WishlistBadge` to consume directly.

## 5. Guest bookmarks: full `Wishlist` parity, not a simplified redirect-only flow

The AC leaves this open ("completes automatically after successful login
... or the user is clearly told to retry"), but `Wishlist`'s guest-then-merge
flow is already shipped, proven, and sits right next to this feature in the
UI — a Recipe Card can show both a wishlist heart (for the product it might
link to) and a bookmark ribbon (for the recipe itself) with inconsistent
behavior otherwise. This spec copies the pattern in full:

- `src/lib/stores/recipe-bookmark-store.ts` — a Zustand + `persist`
  localStorage store, `wishlist-store.ts`'s shape exactly (`items: string[]`,
  `add`/`remove`/`has`/`clear`), keyed `"oristor-recipe-bookmarks"`.
- `src/hooks/use-recipe-bookmark.ts` — `useRecipeBookmark(recipeId)` mirrors
  `useWishlist(productId)`'s optimistic-toggle shape: TanStack Query
  `["recipe-bookmarks"]` for the authenticated list, `onMutate`/`onError`/
  `onSuccess` optimistic update, guest-vs-authenticated branching in `toggle()`.
- `src/components/providers/recipe-bookmark-merge-sync.tsx` —
  `WishlistMergeSync`'s exact shape: watches the unauthenticated→
  authenticated `useSession()` transition, POSTs the guest store's ids to
  `/api/recipes/bookmarks/merge` once, clears the guest store on success,
  invalidates the `["recipe-bookmarks"]` query, leaves the guest store
  intact on failure (retried on the next transition, never silently
  dropped) — same reasoning as the Wishlist precedent's own comment.
- `POST /api/recipes/bookmarks/merge` mirrors `POST /api/wishlist/merge`:
  auth-required, takes `{ recipeIds: string[] }` (capped, same bound
  `wishlist.schema.ts` already applies), calls
  `recipe-bookmark.service.ts`'s `mergeGuestBookmarks(customerId, recipeIds)`
  (sequential per-id lookups, same justification `mergeGuestWishlist`'s
  comment gives — small, bounded input, not a listing endpoint).

## 6. Data model

```prisma
enum RecipeReviewStatus {
  Pending
  Approved
  Rejected
  Hidden
}

model RecipeReview {
  id         String             @id @default(cuid())
  recipeId   String
  recipe     Recipe             @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  customerId String
  customer   User               @relation(fields: [customerId], references: [id], onDelete: Cascade)
  rating     Int
  reviewText String?
  status     RecipeReviewStatus @default(Pending)
  createdAt  DateTime           @default(now())
  updatedAt  DateTime           @updatedAt

  @@unique([recipeId, customerId])
  @@index([recipeId, status])
}

model RecipeBookmark {
  id         String   @id @default(cuid())
  recipeId   String
  recipe     Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  customerId String
  customer   User     @relation(fields: [customerId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([recipeId, customerId])
  @@index([customerId])
}
```

No named `@relation` needed on either model's `User` FK, since each has
only one relation to `User` (unlike `Review`'s `ReviewAuthor`/
`ReviewModerator` pair — `RecipeReview` has no moderator-audit column at
this story's stage, per decision #1). `Recipe.avgRating`/`ratingCount`
(already present, STORY-017) are not touched by this migration — only
read and recomputed by `recipe-review.service.ts`. Add the two inverse
relations (`recipeReviews RecipeReview[]`, `recipeBookmarks
RecipeBookmark[]`) to both `Recipe` and `User` in the same style as their
existing reverse relations.

## 7. API surface

```
POST   /api/recipes/[slug]/reviews          — upsert the caller's review (auth required)
GET    /api/recipes/[slug]/reviews          — paginated Approved reviews (?sort=recent|highest|lowest, ?page, ?pageSize)
GET    /api/recipes/[slug]/reviews/mine     — the caller's own review, any status (auth required)
PATCH  /api/recipes/[slug]/reviews/[reviewId] — edit own Pending review (auth required)
DELETE /api/recipes/[slug]/reviews/[reviewId] — withdraw own Pending review (auth required)

POST   /api/recipes/[slug]/bookmark         — add (auth required)
DELETE /api/recipes/[slug]/bookmark         — remove (auth required)
GET    /api/recipes/bookmarks               — the caller's bookmarked recipes, as RecipeCard[] (auth required)
POST   /api/recipes/bookmarks/merge         — merge guest bookmark ids into the caller's account (auth required)
```

Every route follows the `auth()` → 401-if-absent → service-call → typed-error-to-HTTP-status
convention `src/app/api/products/[slug]/reviews/**` and
`src/app/api/wishlist/**` already establish, including a
`recipe-review-responses.ts` mapping `RecipeReviewErrorCode` → status the
same way `review-responses.ts` does today.

## 8. Security posture

Reviews require full authentication end-to-end — unlike `BlogComment`
(STORY-021), there is no guest-submission path, so none of that story's
honeypot/rate-limit spam-guard machinery applies here; `submitReview`'s
security surface is simpler by construction, not by omission. Every
mutation (`submitReview`, `editOwnPendingReview`, `withdrawOwnPendingReview`,
`toggleBookmark`, the merge endpoint) resolves the customer identity from
`auth()`'s session server-side, the same way `review.service.ts`/
`wishlist.service.ts` already do — a request body's `customerId` (if a
caller supplied one) is never trusted or read. `editOwnPendingReview`/
`withdrawOwnPendingReview` re-check both ownership (`review.customerId ===
session.user.id`) and status (`review.status === "Pending"`) inside the
same conditional-update pattern `review.service.ts`'s doc comment already
explains, closing the same read-then-write race that pattern was built to
close. The bookmark merge endpoint validates every incoming recipe id is
real and Published before creating a row — the same guard
`mergeGuestWishlist` already applies for Draft/Discontinued products —
so a tampered or stale guest-store id can't create a bookmark row for
content that shouldn't be bookmarkable.

## 9. Frontend structure

**Correction from an earlier draft of this section:** the product Review UI
does NOT use the generic `SortSelect`/`Pagination` components from
`src/components/storefront/listing/` — those are for the Product/Recipe
*grid* listings (STORY-010/017). The actual, closer precedent is
`reviews-section.tsx`/`review-list.tsx`, which hand-roll their own inline
`Select` (from `@/components/ui/select`) and a simple Previous/Next button
pair (no numbered page links), because the review list's query state
(sort, page) lives in local component state, not the URL — the detail
page's own URL must stay canonical. This spec follows that closer
precedent, not the grid-listing one.

- `RecipeRatingStars` (Server Component, display-only — filled/outline
  `Star` icons plus the numeric average and count, `role="img"` with a
  computed `aria-label`, matching `star-rating.tsx`'s existing display
  pattern).
- `RecipeReviewsSection` (Client Component, mirrors `reviews-section.tsx`):
  owns the list's `{ page, sort }` query state, composes
  `RecipeRatingStars`, `RecipeReviewList`, and `RecipeReviewForm`.
- `RecipeReviewList` (Client Component, mirrors `review-list.tsx` exactly):
  `useQuery` with `initialData` seeded from the detail page's own
  server-fetched first page (so the list isn't empty before hydration),
  the inline `Select` for Newest/Highest Rated/Lowest Rated, Previous/Next
  buttons gated on `page`/`lastPage`.
- `RecipeReviewForm` (Client Component, mirrors `review-form.tsx` exactly):
  sign-in prompt via `/account/login?callbackUrl=...` when unauthenticated,
  `fetchMyReview`/edit/withdraw state machine, controlled star-radio input
  (dropping the `title` field per decision #1).
- `RecipeBookmarkButton` (Client Component, `useRecipeBookmark`): a small,
  self-contained toggle — **not** `WishlistBadge` (that's the header nav's
  item-count badge, a different component entirely) but the inline toggle
  `ProductCard` itself renders (`<Button variant="ghost" size="icon-sm"
  aria-pressed aria-label="Add to wishlist"/"Remove from wishlist"
  onClick={(e) => { e.preventDefault(); e.stopPropagation(); ... }}>`,
  absolutely positioned top-right, since the whole card is a `<Link>`).
  **Deliberate improvement over the `ProductCard` precedent**:
  `ProductCard` itself had to become a Client Component to call
  `useWishlist` directly, but `RecipeCard` is currently a pure Server
  Component (its own comment explicitly values this — it renders
  server-side on the homepage and inside the client `/recipes` listing
  alike). `RecipeBookmarkButton` stays an isolated Client Component that
  `RecipeCard` renders as a child — Next.js Server Components can render
  Client Component children without becoming Client Components
  themselves — so `RecipeCard` keeps its Server Component status. Used in
  both `RecipeCard` (STORY-017 grid, icon-only, top-right corner) and the
  STORY-018 detail page (a labelled button near the title).

**No provider-registry needed for the rating summary.** Product's PDP gets
its review summary through `product-detail-extensions.ts`'s
`registerReviewSummaryProvider`, because `product.service.ts` must not
import `review.service.ts` directly (avoiding a circular dependency) and
still needs `getReviewSummaryForProduct`'s data at render time. Recipe
doesn't have this problem: `Recipe.avgRating`/`ratingCount` are already
flat columns `recipe.service.ts`'s existing `getRecipeBySlug` returns
directly (decision #2) — no cross-service call needed for the summary at
all. The STORY-018 detail page's own Server Component calls
`recipe-review.service.ts`'s `listApprovedReviews` directly (the same way
`blog.service.ts`'s `getPostBySlug` calls its own repository without a
registry) to seed `RecipeReviewsSection`'s `initialData` — no new
provider/registration pattern is introduced by this story.

## 10. Accessibility floor

Star rating input: a `<fieldset>`/`<legend>` grouping five radio inputs
(`ReviewForm.tsx`'s exact pattern — visually-hidden native radios, a
`sr-only` "N star(s)" label per option, `peer-focus-visible` ring styling
on the visible `Star` icon) — fully keyboard-operable (arrow keys move
between radio options natively) without any custom key handling. Bookmark
toggle: a real `<button aria-pressed={isBookmarked}>` with a text
alternative that changes with state ("Bookmark this recipe" /
"Remove bookmark"), not an icon-only control with a static label.

## 11. Testing plan

Unit — Reviews:
- Review creation (valid input persists as `Pending`).
- Zod validation (`rating` out of 1–5 range rejected; `reviewText` length bound if one is set).
- Duplicate-review prevention (`@@unique([recipeId, customerId])`; a second `submitReview` call upserts/conflicts per decision #3, never creates a second row).
- `canTransitionRecipeReview`'s full transition table, both allowed and disallowed pairs (mirroring `blog-service.test.ts`'s equivalent shape).
- Approval, rejection, and hiding (`changeRecipeReviewStatus` for each target status) each recompute `Recipe.avgRating`/`ratingCount` correctly; rejection alone (`Pending→Rejected`, never touching `Approved`) does NOT trigger a recalculation.
- Withdrawal (only removes a still-`Pending`, own row; a no-longer-`Pending` or another customer's row is rejected).
- Rating recalculation correctness: average across `Approved`-only reviews, ignores `Pending`/`Rejected`/`Hidden`; the zero-`Approved`-reviews case resolves to `avgRating: null, ratingCount: 0` (matching `Recipe.avgRating`'s existing nullable-until-rated convention from STORY-017, not `0`).
- **Concurrent status-change safety**: two simultaneous `changeRecipeReviewStatus` calls touching the same recipe's aggregate (e.g. two reviews approved at once) must not lose an update — a practical test using two overlapping transactions against the real PGlite connection (matching this codebase's existing pattern for exercising `SELECT ... FOR UPDATE` row-locking, if one already exists for `review.repository.ts`; otherwise a sequential-but-interleaved simulation that proves the lock is actually acquired) must confirm the final `ratingCount` reflects both approvals, not just one.
- Pagination and each sort order (Newest, Highest Rated, Lowest Rated) on `listApprovedReviews`.

Unit — Bookmarks:
- Bookmark creation.
- Duplicate-bookmark prevention (`P2002` swallowed — idempotent, not an error — and no second row created even under a simulated concurrent double-submit).
- Bookmark removal (`deleteMany` on an already-removed row is a no-op, not a 404).
- `mergeGuestBookmarks`: skips ids already bookmarked, skips Draft/unpublished recipe ids (same guard `mergeGuestWishlist` applies for Draft/Discontinued products), and — repeated/idempotent merge — calling it twice with the same id list produces no duplicate rows and no error the second time.
- Unauthorized access: every mutation rejects a request with no session (401) before touching the repository layer.

Playwright e2e: as an authenticated test customer — submit a review, confirm the "awaiting approval" state and that it's absent from the public list; edit a Pending review; withdraw a Pending review; toggle a bookmark on both the recipe card and the detail page and confirm the state survives a reload (including the optimistic-UI behavior: the toggle visibly flips before the network round-trip resolves). As an unauthenticated visitor — confirm both actions prompt sign-in (with `callbackUrl` preserved) rather than silently failing, and (guest-bookmark path) confirm a bookmark made while signed out appears automatically once signed in. Accessibility: axe scan on the review form's star input and the bookmark toggle in both states.
