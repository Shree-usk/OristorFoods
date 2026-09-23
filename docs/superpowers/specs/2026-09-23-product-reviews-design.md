# Product Reviews & Ratings — Design

**Story:** `docs/stories/03-product-platform/STORY-015-product-reviews-ratings.md`
**Date:** 2026-09-23
**Branch:** `feature/story-015-product-reviews`, based on
`feature/story-014-product-compare` (PR #2). Retarget to `master` once PR #2
merges.

## Summary

Signed-in customers submit a star rating (1–5), a title and a body for a
product. Each new review is created as `Pending` and is not publicly visible.
The Product Detail Page (PDP) shows an aggregate rating (average, count, and a
5→1 star histogram) and a paginated, sortable, star-filterable list of
`Published` reviews only. Customers can edit or withdraw their own review
while it is `Pending`.

The admin moderation console (approve/reject/reply/feature/hide) is
STORY-045. This story provides the status lifecycle and one entry point for
changing status (`changeReviewStatus`), which STORY-045 will call. Until then,
a dev-only CLI script and the seed publish reviews through that same function.

Decisions confirmed with the user before design:

- **Review photos are deferred.** The codebase has no file storage, and the
  hosting/cloud provider is an open item in `docs/blueprint.md` Section 10.
  The `ReviewImage` table is created now so photos can be added later without
  another schema change. Photo upload is expected to pair with the Media
  Library (STORY-041). The "optional photo(s)" acceptance criterion and the
  photo-upload frontend task are therefore **not** delivered in this story.
- **Aggregate rating is stored, not computed on read (approach A).** A
  `ProductRatingSummary` row per product is recalculated inside the same
  transaction as any status change into or out of `Published`. Computing on
  read (approach B) was rejected: the story explicitly asks for
  recalculation, and on-read aggregation would be costly on future listing
  cards and sort-by-rating. A database trigger (approach C) was rejected
  because it puts business logic outside the service layer and out of sight of
  Prisma and the tests.

## Data model

```prisma
enum ReviewStatus {
  Pending
  Approved
  Published
  Rejected
  Archived
}

model Review {
  id                 String       @id @default(cuid())
  productId          String
  product            Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId             String
  user               User         @relation("ReviewAuthor", fields: [userId], references: [id], onDelete: Cascade)
  rating             Int
  title              String
  body               String
  status             ReviewStatus @default(Pending)
  isVerifiedPurchase Boolean      @default(false)

  // Reserved for STORY-045 (moderation console). This story never writes them.
  reviewedById  String?
  reviewedBy    User?     @relation("ReviewModerator", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt    DateTime?
  moderatorNote String?

  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  images ReviewImage[]

  @@unique([productId, userId])
  @@index([productId, status, publishedAt])
}

model ReviewImage {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  url       String
  altText   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
}

model ProductRatingSummary {
  productId     String   @id
  product       Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  averageRating Decimal  @db.Decimal(3, 2)
  reviewCount   Int
  count1        Int
  count2        Int
  count3        Int
  count4        Int
  count5        Int
  updatedAt     DateTime @updatedAt
}
```

`User` gains `reviews Review[] @relation("ReviewAuthor")` and
`moderatedReviews Review[] @relation("ReviewModerator")`. `Product` gains
`reviews Review[]` and `ratingSummary ProductRatingSummary?`. No columns are
added to `Product` itself.

Rules:

- **One review per customer per product** is enforced by
  `@@unique([productId, userId])`, not only by a service-level check, so a
  double submit cannot create two rows.
- **`rating` is an integer from 1 to 5.** Zod enforces this at the API
  boundary and the service checks it again. Prisma has no check constraint,
  so the service check is the last line of defence for non-API callers such
  as the seed and the CLI script.
- **Withdrawing a `Pending` review deletes it.** It was never public, and
  deleting frees the unique slot so the customer can write a fresh review.
  This keeps the status enum to exactly the blueprint's five values.
- **`publishedAt`** is set every time a review enters `Published`, and kept
  (not cleared) when it leaves. "Most recent" sorts by it.
- **No summary row means no reviews.** Callers treat a missing
  `ProductRatingSummary` as "no reviews yet", never as a 0.0 rating. When the
  last `Published` review leaves `Published`, the summary row is deleted.
- **Author display name** is read live from `User.name`, falling back to
  "Oristor customer". It is not copied onto the review.
- **Account deletion** cascades to the customer's reviews, matching how
  `Wishlist` already behaves. Deleting a moderator keeps the review and sets
  `reviewedById` to null.
- **Migration:** a committed migration file generated with
  `prisma migrate diff --from-schema <old> --to-schema <new> --script`, as in
  STORY-012. This avoids the PGlite shadow-database bug documented in
  `docs/architecture-decisions.md`.

## Status lifecycle

```
Pending ──► Approved ──► Published ──► Archived
   │            │            ▲             │
   └──► Rejected ◄┘          └─────────────┘
```

Allowed transitions (all others throw `InvalidReviewTransitionError`):

| From      | To                     |
|-----------|------------------------|
| Pending   | Approved, Rejected     |
| Approved  | Published, Rejected    |
| Published | Archived               |
| Archived  | Published              |

`Rejected` is terminal in this story. STORY-045 may add more transitions (for
example re-review) by extending this table.

## Backend

### Repository: `src/repositories/review.repository.ts`

This is the only file that touches Prisma for reviews. It covers:

- create, update and delete a review
- find a review by id, and by `(productId, userId)`
- list `Published` reviews for a product, with sort, star filter and
  pagination
- count those reviews for pagination
- `recalculateRatingSummary(tx, productId)`: one `groupBy` over `Published`
  reviews by `rating`, then upsert the summary row (or delete it when the
  count is 0)
- `findRatingSummary(productId)`

Functions used inside a transaction take a `Prisma.TransactionClient`.

### Service: `src/services/review.service.ts`

| Function | Behaviour |
|---|---|
| `submitReview(userId, productSlug, input)` | Product must exist and be `Published`, else `NotFound`. Sets `isVerifiedPurchase` from `hasPurchasedProduct`. Creates the review as `Pending`. A Prisma `P2002` error becomes `DuplicateReviewError`. |
| `getMyReview(userId, productSlug)` | The customer's own review in any status, or `null`. |
| `editOwnPendingReview(userId, reviewId, input)` | Must be the owner (else `Forbidden`) and the review must be `Pending` (else `ReviewNotEditableError`). |
| `withdrawOwnPendingReview(userId, reviewId)` | Same owner and status checks; deletes the review. |
| `listPublishedReviews(productSlug, query)` | `Published` only. Returns `{ items, total, page, pageSize }`. |
| `getRatingSummary(productId)` | Summary including the histogram, or `null`. |
| `changeReviewStatus(reviewId, nextStatus, opts?)` | The **only** status mutator. Validates the transition, updates the status (and `publishedAt` when entering `Published`), and, if the review entered or left `Published`, runs `recalculateRatingSummary` in the **same transaction**. `opts: { moderatorId?, note? }` is accepted for STORY-045 and written to `reviewedById`/`reviewedAt`/`moderatorNote` only when provided. |

Errors are typed classes in `src/services/review.errors.ts` so route handlers
can map them to HTTP statuses without matching on message strings.

### Verified purchase hook

`src/services/purchase-verification.ts` exports
`registerPurchaseVerifier(fn)` and `hasPurchasedProduct(userId, productId)`.
The default verifier returns `false`. The pattern matches
`product-detail-extensions.ts`: STORY-028 (Order Management) registers the
real check, and nothing in this story imports order code. The flag is
evaluated once, at submission. Re-evaluating it for purchases made after the
review was written is out of scope and documented as a known gap.

### PDP integration

`review.service.ts` exports `registerReviewProviders()`, which calls the
existing `registerReviewSummaryProvider`. It is called once from a new
`src/instrumentation.ts` (Next.js's `register()` startup hook), so
`product.service.ts` never imports review code. `register()` runs in both the
Node.js and Edge runtimes, so it only imports the service when
`process.env.NEXT_RUNTIME === "nodejs"`, because Prisma can't load on Edge.
`register()` doesn't run under Vitest, so unit tests that need review data on
the PDP call `registerReviewProviders()` themselves and reset afterwards with
the existing `resetProductDetailExtensionsForTesting()`.

`ReviewSummary` in `product-detail-extensions.ts` is extended with
`histogram: Record<1 | 2 | 3 | 4 | 5, number>`. `previewReviews` becomes the
first page of the default list (most recent, 10 per page), so the PDP renders
without an extra client request. `ReviewPreview` gains `isVerifiedPurchase`.
The compare page's rating row (STORY-014) already reads this provider and
starts showing real data with no further change.

### API routes

All under `src/app/api/products/[slug]/reviews/`. Route handlers call the
service only.

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| GET | `/reviews?page&pageSize&sort&rating` | public | 200 `{ items, total, page, pageSize }` | 400 invalid query, 404 product |
| POST | `/reviews` | session | 201 created review | 400, 401, 404, 409 duplicate |
| GET | `/reviews/mine` | session | 200 review or `null` | 401, 404 product |
| PATCH | `/reviews/[reviewId]` | owner | 200 updated review | 400, 401, 403, 404, 409 not Pending |
| DELETE | `/reviews/[reviewId]` | owner | 204 | 401, 403, 404, 409 not Pending |

The story lists withdraw under PATCH. This design uses DELETE because
withdrawing deletes the row.

Query defaults: `page=1`, `pageSize=10` (maximum 50), `sort=recent`
(`recent` | `highest` | `lowest`), `rating` optional (1–5). Ties are broken by
`publishedAt desc, id` so pagination is stable. All error responses use the
`{ error: string, fieldErrors?: Record<string, string[]> }` shape.

### Validation: `src/validation/review.schema.ts`

- `reviewInputSchema`: `rating` is an integer from 1 to 5; `title` is trimmed,
  3–120 characters; `body` is trimmed, 20–2000 characters. The form and the
  POST/PATCH routes share this schema.
- `reviewListQuerySchema`: the query defaults above, coerced from strings.

### Dev-only publish path

`scripts/publish-review.ts`, run with `npm run review:publish -- <reviewId>`,
calls `changeReviewStatus` Pending → Approved → Published. It refuses to run
when `NODE_ENV=production`. `prisma/seed.ts` creates a few demo reviews across
seeded products and publishes them through the same service function, so demo
data goes through the real code path and the summaries are correct.

## Frontend

The PDP's existing "Customer Reviews" block is replaced by `ReviewsSection`
(`src/components/storefront/product/reviews/`), made of three components.
The PDP (a server component) passes the `ReviewSummary` it already fetched
into `ReviewsSection`, a client component that owns the shared star-filter
state, so no review data is fetched twice on first render.

### `RatingSummary` (client component, receives server-fetched data)

- Average rendered as stars plus text ("4.3 out of 5"), and "Based on N
  reviews".
- Histogram rows 5→1, each with a bar and a count. Each row is a button that
  sets the star filter held by `ReviewsSection`.
- Empty state: "No reviews yet. Be the first to review this product."
- `ProductJsonLd` already accepts `averageRating`/`reviewCount`, so the
  structured data needs no extra work.

### `ReviewList` (client component, TanStack Query)

- `initialData` is the server-rendered first page, so there is no loading
  flash; later pages, sorts and filters fetch from the GET endpoint.
- Controls: a sort select (Most recent, Highest rating, Lowest rating), a star
  filter with a clear control, and Previous/Next pagination with an
  "x–y of N" status.
- Each review shows its stars (with a text alternative), title, body, author
  name, date, and a "Verified Purchase" badge when the flag is set.
- Sort, filter and page are kept in component state, **not the URL**. The
  PDP URL stays canonical for SEO and sharing.
- An empty filtered result shows "No N-star reviews yet" with a clear-filter
  button.

### `ReviewForm` (client component, React Hook Form + `reviewInputSchema`)

It renders by state, loaded from `GET /reviews/mine` when signed in:

| State | Renders |
|---|---|
| Guest | "Sign in to write a review" linking to `/account/login?callbackUrl=<pdp>`. That route belongs to a later Customer Platform story; the header's "Sign In" link already points to it. |
| Signed in, no review | The form. The star input is a radio group ("1 star" … "5 stars") that works by keyboard and screen reader. Errors show inline, and the button disables while submitting. |
| Pending | "Thanks! Your review is pending approval", plus Edit (reopens the form prefilled) and Withdraw (inline confirmation, not a browser dialog). |
| Approved / Published / Rejected | A status note ("Your review has been published" etc.). No editing. |

Server errors map to form messages: a 409 duplicate switches to the
existing-review state, and a 400 with `fieldErrors` fills the field errors.

### Out of scope for the frontend

- Star ratings on listing `ProductCard`s and sort-by-rating on the listing
  page. Both become cheap to add because of `ProductRatingSummary`.
- Photo upload (deferred, see Summary).
- Helpful/not-helpful voting (out of scope per the story).

## Error handling

- Typed service errors are mapped to HTTP statuses in one helper
  (`src/lib/api/review-errors.ts`), not in each route.
- The duplicate race is handled by the unique constraint: `P2002` becomes 409.
- The summary recalculation runs in the status-change transaction. If it
  fails, the status change rolls back, so the summary cannot drift from the
  reviews.
- A product that is not `Published` returns 404 for every review endpoint,
  including GET, matching the PDP's own not-found behaviour.

## Testing

### Unit tests (Vitest, real database via `prisma dev`)

- One review per customer per product: a second submit returns
  `DuplicateReviewError`, including two concurrent `submitReview` calls.
- `changeReviewStatus`: every allowed transition succeeds; every disallowed
  transition throws; `publishedAt` is set on entering `Published`.
- Summary recalculation: entering `Published` creates or updates the summary
  with the correct average, count and histogram; leaving it updates the
  summary; the last one leaving deletes the row; a transition that doesn't
  touch `Published` doesn't change the summary.
- `listPublishedReviews` never returns non-`Published` reviews; sort,
  star-filter and pagination behave correctly, with stable tie-breaking.
- Owner-only edit and withdraw: another user gets `Forbidden`, and a review
  that isn't `Pending` gets `ReviewNotEditableError`.
- `reviewInputSchema` and `reviewListQuerySchema` bounds.
- Route handlers: status codes for each error path.
- `ReviewForm` renders each of its four states; `ReviewList` sort and filter
  controls call the API with the right params; `RatingSummary` renders the
  histogram and the empty state.

### E2E (Playwright)

- A signed-in customer submits a review. It does not appear publicly, and the
  form shows the pending state.
- A review published via `changeReviewStatus` renders on the PDP with the
  correct average, count and histogram, and the compare page's rating row
  shows it.
- An axe check on the reviews section reports no violations.

## Documentation

- `docs/architecture-decisions.md`: the status lifecycle and transition
  table, `changeReviewStatus` as STORY-045's entry point, the
  `ProductRatingSummary` recalculation contract, the purchase-verification
  hook for STORY-028, deferred photos, and the dev publish path.
- STORY-015 marked Done, with the photo acceptance criterion and task marked
  as deferred rather than checked off.
