# Product Reviews & Ratings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in customers submit 1–5 star reviews that start as `Pending`, and show `Published` reviews on the Product Detail Page with an aggregate rating, a star histogram, and a sortable, filterable, paginated list.

**Architecture:** A new `Review` aggregate: `review.repository.ts` (all Prisma access, including the one transaction), `review.service.ts` (business rules and the single status mutator `changeReviewStatus`), and route handlers under `/api/products/[slug]/reviews`. A stored `ProductRatingSummary` row is recalculated in the same transaction as every status change into or out of `Published`. The PDP gets its data through the existing `registerReviewSummaryProvider` hook, registered at startup from `src/instrumentation.ts`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`), Zod 4, React Hook Form + `@hookform/resolvers`, TanStack Query 5, Base UI / shadcn components, Lucide icons, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-09-23-product-reviews-design.md`

## Global Constraints

- Branch `feature/story-015-product-reviews`, worktree `.claude/worktrees/story-015-product-reviews`, based on `feature/story-014-product-compare`.
- Only files in `src/repositories/` may import `@/lib/db` (`src/repositories/README.md`). Services may import `Prisma` from `@/generated/prisma/client` for error classes and types only.
- No `any`. TypeScript strict. `npx tsc --noEmit` covers `tests/` too.
- Review status values are exactly `Pending`, `Approved`, `Published`, `Rejected`, `Archived`.
- Allowed transitions: Pending→Approved, Pending→Rejected, Approved→Published, Approved→Rejected, Published→Archived, Archived→Published. Nothing else.
- Rating: an integer from 1 to 5. Title: trimmed, 3–120 characters. Body: trimmed, 20–2000 characters.
- List query defaults: `page=1`, `pageSize=10` (max 50), `sort=recent` (`recent` | `highest` | `lowest`), optional `rating` 1–5.
- Author display name: `User.name`, trimmed, falling back to `"Oristor customer"`.
- Review photos are **not** implemented. `ReviewImage` is created in the schema only.
- Error response body shape: `{ error: string, fieldErrors?: Record<string, string[]> }`.
- The PDP empty state must contain the text `No reviews yet.`, because `tests/e2e/product-detail.spec.ts` asserts it.
- Seed demo reviews must **not** be on `roasted-curry-powder-100g` (that PDP must stay empty).
- Commits: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Local DB:** unit tests need `prisma dev` listening on port 51214. Start or restart it with `npx prisma dev --detach --db-port 51214 --shadow-db-port 51215`, after waiting about 20 seconds when a previous instance was just killed. `npm run test` truncates all app data. If a run fails with `P1001`, `ConnectionClosed`, or `Connection terminated unexpectedly`, restart the DB and re-run only the affected files. This is a known PGlite limitation (`docs/architecture-decisions.md`), not a test failure.

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `ReviewStatus`, `Review`, `ReviewImage`, `ProductRatingSummary`, plus relations on `User` and `Product` |
| `prisma/migrations/20260923090000_add_reviews/migration.sql` | The committed migration |
| `src/types/review.ts` | Client-safe shared types and constants (no server imports) |
| `src/validation/review.schema.ts` | `reviewInputSchema`, `reviewListQuerySchema` |
| `src/repositories/review.repository.ts` | All review/summary Prisma access, including the status+summary transaction |
| `src/services/review.errors.ts` | Typed service errors with a `code` |
| `src/services/purchase-verification.ts` | The `hasPurchasedProduct` hook (STORY-028 plugs in later) |
| `src/services/review.service.ts` | Lifecycle, customer actions, listing, PDP provider, dev publish helper |
| `src/services/product-detail-extensions.ts` | Extended `ReviewSummary`; provider registry moved onto `globalThis` |
| `src/instrumentation.ts` | Registers the review provider at server startup |
| `src/lib/api/review-responses.ts` | Maps service errors and Zod errors to `NextResponse` |
| `src/app/api/products/[slug]/reviews/route.ts` | GET list, POST submit |
| `src/app/api/products/[slug]/reviews/mine/route.ts` | GET own review |
| `src/app/api/products/[slug]/reviews/[reviewId]/route.ts` | PATCH edit, DELETE withdraw |
| `src/lib/api/review-client.ts` | Browser fetch wrappers and `ReviewApiError` |
| `src/components/storefront/product/reviews/star-rating.tsx` | Read-only star display |
| `src/components/storefront/product/reviews/rating-summary.tsx` | Average and clickable histogram |
| `src/components/storefront/product/reviews/review-list.tsx` | Paginated, sortable list |
| `src/components/storefront/product/reviews/review-form.tsx` | Submit, edit and withdraw form, rendered by state |
| `src/components/storefront/product/reviews/reviews-section.tsx` | PDP section; owns the list query state |
| `src/app/(storefront)/products/[slug]/page.tsx` | Uses `ReviewsSection` |
| `scripts/publish-review.ts` | Dev-only CLI: `npm run review:publish -- <reviewId>` |
| `prisma/seed.ts` | Demo reviews, published through the service |
| `tests/e2e/helpers/auth.ts` | Shared `signInAs` for e2e specs |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (the `User` model at the top; the `Product` model; append new models at the end)
- Create: `prisma/migrations/20260923090000_add_reviews/migration.sql`

**Interfaces:**
- Produces: Prisma models `review`, `reviewImage`, `productRatingSummary`; the enum `ReviewStatus`; the compound unique key `productId_userId` on `Review`; `Product.ratingSummary`.

- [ ] **Step 1: Add the relation fields to `User`**

In `model User`, after `wishlist      Wishlist?`, add:

```prisma
  reviews          Review[] @relation("ReviewAuthor")
  moderatedReviews Review[] @relation("ReviewModerator")
```

- [ ] **Step 2: Add the relation fields to `Product`**

In `model Product`, after `wishlistItems       WishlistItem[]`, add:

```prisma
  reviews             Review[]
  ratingSummary       ProductRatingSummary?
```

- [ ] **Step 3: Append the new enum and models at the end of `prisma/schema.prisma`**

```prisma
// STORY-015. Status lifecycle and transitions: see
// docs/superpowers/specs/2026-09-23-product-reviews-design.md. Status is only
// ever changed through review.service.ts's changeReviewStatus().
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

  // Reserved for the STORY-045 moderation console; STORY-015 never writes them.
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

// Created now so photo upload can be added later without a schema change.
// Unused until a storage provider is chosen (docs/blueprint.md Section 10).
model ReviewImage {
  id        String   @id @default(cuid())
  reviewId  String
  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  url       String
  altText   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@index([reviewId])
}

// One row per product that has at least one Published review. Recalculated
// inside the same transaction as any status change into or out of Published.
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

- [ ] **Step 4: Validate the schema**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 5: Generate the migration offline**

This avoids `migrate dev` and the PGlite shadow-database bug (see `docs/architecture-decisions.md`, STORY-012 entry).

```bash
git show HEAD:prisma/schema.prisma > "$TEMP/schema-before-reviews.prisma"
mkdir -p prisma/migrations/20260923090000_add_reviews
npx prisma migrate diff --from-schema "$TEMP/schema-before-reviews.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20260923090000_add_reviews/migration.sql
head -3 prisma/migrations/20260923090000_add_reviews/migration.sql
grep -cE 'CREATE TYPE "ReviewStatus"|CREATE TABLE "Review"|CREATE TABLE "ReviewImage"|CREATE TABLE "ProductRatingSummary"|CREATE UNIQUE INDEX "Review_productId_userId_key"' prisma/migrations/20260923090000_add_reviews/migration.sql
```

Expected: the first line is `-- CreateEnum`, and the count is `5`. If a `Loaded Prisma config` line appears at the top of the file, delete that line.

- [ ] **Step 6: Apply it locally and regenerate the client**

```bash
npx prisma generate
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (0 errors).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260923090000_add_reviews/migration.sql
git commit -m "feat: add Review, ReviewImage and ProductRatingSummary models" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared review types and validation schemas

**Files:**
- Create: `src/types/review.ts`
- Create: `src/validation/review.schema.ts`
- Test: `tests/unit/review-schema.test.ts`

**Interfaces:**
- Produces (`src/types/review.ts`, client-safe, no server imports): `StarRating`, `STAR_RATINGS`, `RatingHistogram`, `RatingSummaryData`, `PublicReview`, `ReviewPage`, `ReviewStatusValue`, `OwnReview`, `REVIEW_SORTS`, `ReviewSort`, `REVIEW_PAGE_SIZE`, `ReviewPageQuery`.
- Produces (`src/validation/review.schema.ts`): `reviewInputSchema`, `ReviewInput`, `reviewListQuerySchema`, `ReviewListQuery`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { reviewInputSchema, reviewListQuerySchema } from "@/validation/review.schema";

const valid = {
  rating: 4,
  title: "Lovely aroma",
  body: "Fresh, fragrant and great in a chicken curry.",
};

describe("reviewInputSchema", () => {
  it("accepts a valid review and trims the text fields", () => {
    const parsed = reviewInputSchema.parse({ ...valid, title: "  Lovely aroma  ", body: `  ${valid.body}  ` });

    expect(parsed).toEqual(valid);
  });

  it.each([0, 6, 3.5])("rejects a rating of %s", (rating) => {
    expect(reviewInputSchema.safeParse({ ...valid, rating }).success).toBe(false);
  });

  it("rejects a missing rating with a friendly message", () => {
    const result = reviewInputSchema.safeParse({ title: valid.title, body: valid.body });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Please choose a star rating");
  });

  it("rejects NaN with the same message", () => {
    const result = reviewInputSchema.safeParse({ ...valid, rating: Number.NaN });

    expect(result.error?.issues[0]?.message).toBe("Please choose a star rating");
  });

  it("measures title length after trimming (3–120)", () => {
    expect(reviewInputSchema.safeParse({ ...valid, title: "  ab  " }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, title: "abc" }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, title: "a".repeat(121) }).success).toBe(false);
  });

  it("measures body length after trimming (20–2000)", () => {
    expect(reviewInputSchema.safeParse({ ...valid, body: `  ${"a".repeat(19)}  ` }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...valid, body: "a".repeat(20) }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ ...valid, body: "a".repeat(2001) }).success).toBe(false);
  });
});

describe("reviewListQuerySchema", () => {
  it("applies defaults when no params are given", () => {
    expect(reviewListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10, sort: "recent" });
  });

  it("coerces string query params", () => {
    expect(reviewListQuerySchema.parse({ page: "2", pageSize: "20", sort: "lowest", rating: "5" })).toEqual({
      page: 2,
      pageSize: 20,
      sort: "lowest",
      rating: 5,
    });
  });

  it.each([{ pageSize: "51" }, { page: "0" }, { rating: "6" }, { rating: "0" }, { sort: "oldest" }])(
    "rejects %o",
    (query) => {
      expect(reviewListQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-schema.test.ts`
Expected: FAIL, `Failed to resolve import "@/validation/review.schema"`.

- [ ] **Step 3: Create `src/types/review.ts`**

```ts
/**
 * Review types and constants shared by server and client code (STORY-015).
 * Keep this file free of server-only imports (Prisma, services): client
 * components import from it.
 */

export type StarRating = 1 | 2 | 3 | 4 | 5;

/** Highest first — the order the histogram is displayed in. */
export const STAR_RATINGS: readonly StarRating[] = [5, 4, 3, 2, 1];

export type RatingHistogram = Record<StarRating, number>;

export interface RatingSummaryData {
  averageRating: number;
  reviewCount: number;
  histogram: RatingHistogram;
}

/** A Published review as returned by the public API and shown on the PDP. */
export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  isVerifiedPurchase: boolean;
  /** ISO 8601 string. */
  publishedAt: string;
}

export interface ReviewPage {
  items: PublicReview[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReviewStatusValue = "Pending" | "Approved" | "Published" | "Rejected" | "Archived";

/** The signed-in customer's own review, in any status. */
export interface OwnReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatusValue;
}

export const REVIEW_SORTS = ["recent", "highest", "lowest"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const REVIEW_PAGE_SIZE = 10;

export interface ReviewPageQuery {
  page: number;
  pageSize: number;
  sort: ReviewSort;
  rating?: StarRating;
}
```

- [ ] **Step 4: Create `src/validation/review.schema.ts`**

```ts
import { z } from "zod";

import { REVIEW_PAGE_SIZE, REVIEW_SORTS } from "@/types/review";

const RATING_MESSAGE = "Please choose a star rating";

/** Shared by ReviewForm (client) and the POST/PATCH review routes (server). */
export const reviewInputSchema = z.object({
  rating: z.number({ error: RATING_MESSAGE }).int(RATING_MESSAGE).min(1, RATING_MESSAGE).max(5, RATING_MESSAGE),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or fewer"),
  body: z
    .string()
    .trim()
    .min(20, "Review must be at least 20 characters")
    .max(2000, "Review must be 2,000 characters or fewer"),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(REVIEW_PAGE_SIZE),
  sort: z.enum(REVIEW_SORTS).default("recent"),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/review-schema.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/review.ts src/validation/review.schema.ts tests/unit/review-schema.test.ts
git commit -m "feat: add review types and validation schemas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Review repository

**Files:**
- Create: `src/repositories/review.repository.ts`
- Test: `tests/unit/review-repository.test.ts`

**Interfaces:**
- Consumes: the Prisma models from Task 1; `ReviewSort` from `@/types/review`.
- Produces:
  - `createReview(data: Prisma.ReviewUncheckedCreateInput): Promise<Review>`
  - `findReviewById(id: string): Promise<Review | null>`
  - `findReviewByProductAndUser(productId: string, userId: string): Promise<Review | null>`
  - `updateReviewContent(id: string, data: { rating: number; title: string; body: string }): Promise<Review>`
  - `deleteReview(id: string): Promise<Review>`
  - `listPublishedReviews(productId: string, query: PublishedReviewQuery): Promise<{ items: ReviewWithAuthor[]; total: number }>`
  - `findRatingSummary(productId: string): Promise<ProductRatingSummary | null>`
  - `updateStatusAndRecalculate(reviewId: string, productId: string, data: ReviewStatusUpdate, recalculate: boolean): Promise<Review>`
  - types: `ReviewWithAuthor`, `PublishedReviewQuery { sort: ReviewSort; rating?: number; skip: number; take: number }`, `ReviewStatusUpdate { status: ReviewStatus; publishedAt?: Date; reviewedById?: string; reviewedAt?: Date; moderatorNote?: string }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createReview,
  deleteReview,
  findRatingSummary,
  findReviewById,
  findReviewByProductAndUser,
  listPublishedReviews,
  updateReviewContent,
  updateStatusAndRecalculate,
} from "@/repositories/review.repository";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `REV-REPO-${sequence}`, slug: `rev-repo-${sequence}`, name: "Curry Powder", status: "Published" });
}

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-repo-${sequence}@test.com`, name } });
}

async function makeReview(productId: string, rating = 4, name: string | null = "Test Reviewer") {
  const user = await makeUser(name);
  return createReview({
    productId,
    userId: user.id,
    rating,
    title: `Rated ${rating}`,
    body: "A perfectly adequate review body.",
  });
}

async function makePublishedReview(productId: string, rating: number, publishedAt: Date, name = "Test Reviewer") {
  const review = await makeReview(productId, rating, name);
  return updateStatusAndRecalculate(review.id, productId, { status: "Published", publishedAt }, true);
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("review CRUD", () => {
  it("creates a Pending review and finds it by id and by (product, user)", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    expect(review.status).toBe("Pending");
    expect((await findReviewById(review.id))?.id).toBe(review.id);
    expect((await findReviewByProductAndUser(product.id, review.userId))?.id).toBe(review.id);
  });

  it("enforces one review per customer per product at the database level", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    await expect(
      createReview({ productId: product.id, userId: review.userId, rating: 2, title: "Again", body: "Trying to review twice here." }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("updates content and deletes", async () => {
    const product = await makeProduct();
    const review = await makeReview(product.id);

    const updated = await updateReviewContent(review.id, { rating: 5, title: "Changed", body: "A changed and longer review body." });
    expect(updated).toMatchObject({ rating: 5, title: "Changed" });

    await deleteReview(review.id);
    expect(await findReviewById(review.id)).toBeNull();
  });
});

describe("listPublishedReviews", () => {
  it("returns only Published reviews, with the author's name", async () => {
    const product = await makeProduct();
    await makeReview(product.id, 5); // stays Pending
    const rejected = await makeReview(product.id, 1);
    await updateStatusAndRecalculate(rejected.id, product.id, { status: "Rejected" }, false);
    await makePublishedReview(product.id, 3, new Date("2026-09-01"), "Nadeesha");

    const result = await listPublishedReviews(product.id, { sort: "recent", skip: 0, take: 10 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.user.name).toBe("Nadeesha");
  });

  it("sorts by recent, highest and lowest, breaking ties by most recent", async () => {
    const product = await makeProduct();
    const oldFive = await makePublishedReview(product.id, 5, new Date("2026-01-01"));
    const newFive = await makePublishedReview(product.id, 5, new Date("2026-03-01"));
    const midTwo = await makePublishedReview(product.id, 2, new Date("2026-02-01"));

    const ids = async (sort: "recent" | "highest" | "lowest") =>
      (await listPublishedReviews(product.id, { sort, skip: 0, take: 10 })).items.map((item) => item.id);

    expect(await ids("recent")).toEqual([newFive.id, midTwo.id, oldFive.id]);
    expect(await ids("highest")).toEqual([newFive.id, oldFive.id, midTwo.id]);
    expect(await ids("lowest")).toEqual([midTwo.id, newFive.id, oldFive.id]);
  });

  it("filters by rating and paginates, with total reflecting the filter", async () => {
    const product = await makeProduct();
    for (let day = 1; day <= 3; day += 1) {
      await makePublishedReview(product.id, 5, new Date(`2026-05-0${day}`));
    }
    await makePublishedReview(product.id, 1, new Date("2026-05-09"));

    const firstPage = await listPublishedReviews(product.id, { sort: "recent", rating: 5, skip: 0, take: 2 });
    const secondPage = await listPublishedReviews(product.id, { sort: "recent", rating: 5, skip: 2, take: 2 });

    expect(firstPage.total).toBe(3);
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(1);
    expect([...firstPage.items, ...secondPage.items].every((item) => item.rating === 5)).toBe(true);
  });
});

describe("updateStatusAndRecalculate", () => {
  it("creates the rating summary when the first review is published", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 4, new Date());

    const summary = await findRatingSummary(product.id);

    expect(summary?.reviewCount).toBe(1);
    expect(summary?.averageRating.toFixed(2)).toBe("4.00");
    expect(summary).toMatchObject({ count1: 0, count2: 0, count3: 0, count4: 1, count5: 0 });
  });

  it("recalculates the average and histogram as more reviews are published", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 5, new Date());
    await makePublishedReview(product.id, 4, new Date());
    await makePublishedReview(product.id, 4, new Date());

    const summary = await findRatingSummary(product.id);

    expect(summary?.reviewCount).toBe(3);
    expect(summary?.averageRating.toFixed(2)).toBe("4.33");
    expect(summary).toMatchObject({ count4: 2, count5: 1 });
  });

  it("recalculates when a review leaves Published, and deletes the row when none remain", async () => {
    const product = await makeProduct();
    const five = await makePublishedReview(product.id, 5, new Date());
    const three = await makePublishedReview(product.id, 3, new Date());

    await updateStatusAndRecalculate(five.id, product.id, { status: "Archived" }, true);
    expect(await findRatingSummary(product.id)).toMatchObject({ reviewCount: 1, count3: 1, count5: 0 });

    await updateStatusAndRecalculate(three.id, product.id, { status: "Archived" }, true);
    expect(await findRatingSummary(product.id)).toBeNull();
  });

  it("leaves the summary untouched when recalculate is false", async () => {
    const product = await makeProduct();
    await makePublishedReview(product.id, 5, new Date());
    const pending = await makeReview(product.id, 1);

    await updateStatusAndRecalculate(pending.id, product.id, { status: "Approved" }, false);

    expect(await findRatingSummary(product.id)).toMatchObject({ reviewCount: 1, count5: 1 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-repository.test.ts`
Expected: FAIL, `Failed to resolve import "@/repositories/review.repository"`.

- [ ] **Step 3: Write the repository**

Create `src/repositories/review.repository.ts`:

```ts
import type { Prisma, ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { ReviewSort } from "@/types/review";

const withAuthorName = { user: { select: { name: true } } } satisfies Prisma.ReviewInclude;

export type ReviewWithAuthor = Prisma.ReviewGetPayload<{ include: typeof withAuthorName }>;

export interface PublishedReviewQuery {
  sort: ReviewSort;
  rating?: number;
  skip: number;
  take: number;
}

export interface ReviewStatusUpdate {
  status: ReviewStatus;
  publishedAt?: Date;
  reviewedById?: string;
  reviewedAt?: Date;
  moderatorNote?: string;
}

// Every sort ends with publishedAt desc, then id, so ties are broken the same
// way on every request and pagination never repeats or skips a review.
const orderBySort: Record<ReviewSort, Prisma.ReviewOrderByWithRelationInput[]> = {
  recent: [{ publishedAt: "desc" }, { id: "asc" }],
  highest: [{ rating: "desc" }, { publishedAt: "desc" }, { id: "asc" }],
  lowest: [{ rating: "asc" }, { publishedAt: "desc" }, { id: "asc" }],
};

export function createReview(data: Prisma.ReviewUncheckedCreateInput) {
  return prisma.review.create({ data });
}

export function findReviewById(id: string) {
  return prisma.review.findUnique({ where: { id } });
}

export function findReviewByProductAndUser(productId: string, userId: string) {
  return prisma.review.findUnique({ where: { productId_userId: { productId, userId } } });
}

export function updateReviewContent(id: string, data: { rating: number; title: string; body: string }) {
  return prisma.review.update({ where: { id }, data });
}

export function deleteReview(id: string) {
  return prisma.review.delete({ where: { id } });
}

export async function listPublishedReviews(
  productId: string,
  query: PublishedReviewQuery,
): Promise<{ items: ReviewWithAuthor[]; total: number }> {
  const where: Prisma.ReviewWhereInput = {
    productId,
    status: "Published",
    ...(query.rating ? { rating: query.rating } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: orderBySort[query.sort],
      skip: query.skip,
      take: query.take,
      include: withAuthorName,
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

export function findRatingSummary(productId: string) {
  return prisma.productRatingSummary.findUnique({ where: { productId } });
}

async function recalculateRatingSummary(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const groups = await tx.review.groupBy({
    by: ["rating"],
    where: { productId, status: "Published" },
    _count: { _all: true },
  });
  const countFor = (star: number) => groups.find((group) => group.rating === star)?._count._all ?? 0;
  const counts = { count1: countFor(1), count2: countFor(2), count3: countFor(3), count4: countFor(4), count5: countFor(5) };
  const reviewCount = counts.count1 + counts.count2 + counts.count3 + counts.count4 + counts.count5;

  if (reviewCount === 0) {
    await tx.productRatingSummary.deleteMany({ where: { productId } });
    return;
  }

  const ratingTotal = counts.count1 + 2 * counts.count2 + 3 * counts.count3 + 4 * counts.count4 + 5 * counts.count5;
  const data = { ...counts, reviewCount, averageRating: (ratingTotal / reviewCount).toFixed(2) };
  await tx.productRatingSummary.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
  });
}

/**
 * Changes a review's status and, when `recalculate` is true, rebuilds the
 * product's rating summary in the same transaction, so the summary can never
 * disagree with the Published reviews. review.service.ts decides whether a
 * recalculation is needed (only when the review enters or leaves Published).
 */
export function updateStatusAndRecalculate(
  reviewId: string,
  productId: string,
  data: ReviewStatusUpdate,
  recalculate: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.update({ where: { id: reviewId }, data });
    if (recalculate) await recalculateRatingSummary(tx, productId);
    return review;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/review-repository.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/review.repository.ts tests/unit/review-repository.test.ts
git commit -m "feat: add review repository with transactional rating summary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Review status lifecycle (errors, transitions, `changeReviewStatus`)

**Files:**
- Create: `src/services/review.errors.ts`
- Create: `src/services/review.service.ts`
- Test: `tests/unit/review-lifecycle.test.ts`

**Interfaces:**
- Consumes: `findReviewById`, `findRatingSummary`, `updateStatusAndRecalculate`, `ReviewStatusUpdate` (Task 3); `RatingSummaryData` (Task 2).
- Produces:
  - `review.errors.ts`: `ReviewErrorCode`, `ReviewServiceError` (with `readonly code: ReviewErrorCode`), and the subclasses `InvalidReviewInputError(message)`, `ProductNotFoundError()`, `ReviewNotFoundError()`, `ReviewForbiddenError()`, `DuplicateReviewError()`, `ReviewNotEditableError()`, `InvalidReviewTransitionError(from, to)`.
  - `review.service.ts`: `canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean`; `changeReviewStatus(reviewId: string, nextStatus: ReviewStatus, options?: ChangeReviewStatusOptions): Promise<Review>`; `ChangeReviewStatusOptions { moderatorId?: string; note?: string }`; `getRatingSummary(productId: string): Promise<RatingSummaryData | null>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-lifecycle.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { ReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createReview, findReviewById } from "@/repositories/review.repository";
import { InvalidReviewTransitionError, ReviewNotFoundError } from "@/services/review.errors";
import { canTransitionReview, changeReviewStatus, getRatingSummary } from "@/services/review.service";

let sequence = 0;

async function makePendingReview(rating = 4) {
  sequence += 1;
  const product = await createProduct({ sku: `REV-LIFE-${sequence}`, slug: `rev-life-${sequence}`, name: "Chilli Powder", status: "Published" });
  const user = await prisma.user.create({ data: { email: `rev-life-${sequence}@test.com`, name: "Reviewer" } });
  return createReview({ productId: product.id, userId: user.id, rating, title: "Nice heat", body: "Balanced heat with a lovely colour." });
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

const statuses: ReviewStatus[] = ["Pending", "Approved", "Published", "Rejected", "Archived"];
const allowed = new Set([
  "Pending>Approved",
  "Pending>Rejected",
  "Approved>Published",
  "Approved>Rejected",
  "Published>Archived",
  "Archived>Published",
]);

describe("canTransitionReview", () => {
  const pairs = statuses.flatMap((from) => statuses.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s matches the blueprint workflow", (from, to) => {
    expect(canTransitionReview(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});

describe("changeReviewStatus", () => {
  it("throws ReviewNotFoundError for an unknown review", async () => {
    await expect(changeReviewStatus("missing-id", "Approved")).rejects.toBeInstanceOf(ReviewNotFoundError);
  });

  it("rejects a transition the workflow doesn't allow", async () => {
    const review = await makePendingReview();

    await expect(changeReviewStatus(review.id, "Published")).rejects.toBeInstanceOf(InvalidReviewTransitionError);
    expect((await findReviewById(review.id))?.status).toBe("Pending");
  });

  it("does not create a summary for a transition that doesn't touch Published", async () => {
    const review = await makePendingReview();

    await changeReviewStatus(review.id, "Approved");

    expect(await getRatingSummary(review.productId)).toBeNull();
  });

  it("sets publishedAt and builds the summary on entering Published", async () => {
    const review = await makePendingReview(4);
    await changeReviewStatus(review.id, "Approved");

    const published = await changeReviewStatus(review.id, "Published");

    expect(published.status).toBe("Published");
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(await getRatingSummary(review.productId)).toEqual({
      averageRating: 4,
      reviewCount: 1,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    });
  });

  it("removes the review from the summary when archived, and restores it when re-published", async () => {
    const review = await makePendingReview(5);
    await changeReviewStatus(review.id, "Approved");
    await changeReviewStatus(review.id, "Published");

    await changeReviewStatus(review.id, "Archived");
    expect(await getRatingSummary(review.productId)).toBeNull();

    await changeReviewStatus(review.id, "Published");
    expect((await getRatingSummary(review.productId))?.reviewCount).toBe(1);
  });

  it("writes moderator fields only when they are provided", async () => {
    const review = await makePendingReview();
    const moderator = await prisma.user.create({ data: { email: "moderator@test.com", name: "Moderator" } });

    const approved = await changeReviewStatus(review.id, "Approved");
    expect(approved).toMatchObject({ reviewedById: null, reviewedAt: null, moderatorNote: null });

    const rejected = await changeReviewStatus(review.id, "Rejected", { moderatorId: moderator.id, note: "Off-topic" });
    expect(rejected.reviewedById).toBe(moderator.id);
    expect(rejected.reviewedAt).toBeInstanceOf(Date);
    expect(rejected.moderatorNote).toBe("Off-topic");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-lifecycle.test.ts`
Expected: FAIL, `Failed to resolve import "@/services/review.errors"`.

- [ ] **Step 3: Create `src/services/review.errors.ts`**

```ts
/**
 * Typed errors thrown by review.service.ts. Route handlers map `code` to an
 * HTTP status in one place (src/lib/api/review-responses.ts) instead of
 * matching on message strings.
 */
export type ReviewErrorCode =
  | "invalid_input"
  | "product_not_found"
  | "review_not_found"
  | "forbidden"
  | "duplicate"
  | "not_editable"
  | "invalid_transition";

export class ReviewServiceError extends Error {
  readonly code: ReviewErrorCode;

  constructor(code: ReviewErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidReviewInputError extends ReviewServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class ProductNotFoundError extends ReviewServiceError {
  constructor() {
    super("product_not_found", "Product not found");
  }
}

export class ReviewNotFoundError extends ReviewServiceError {
  constructor() {
    super("review_not_found", "Review not found");
  }
}

export class ReviewForbiddenError extends ReviewServiceError {
  constructor() {
    super("forbidden", "You can only change your own review");
  }
}

export class DuplicateReviewError extends ReviewServiceError {
  constructor() {
    super("duplicate", "You have already reviewed this product");
  }
}

export class ReviewNotEditableError extends ReviewServiceError {
  constructor() {
    super("not_editable", "Only reviews that are pending approval can be changed");
  }
}

export class InvalidReviewTransitionError extends ReviewServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A review can't move from ${from} to ${to}`);
  }
}
```

- [ ] **Step 4: Create `src/services/review.service.ts` with the lifecycle part**

```ts
import type { ReviewStatus } from "@/generated/prisma/client";
import * as reviewRepository from "@/repositories/review.repository";
import type { ReviewStatusUpdate } from "@/repositories/review.repository";
import { InvalidReviewTransitionError, ReviewNotFoundError } from "@/services/review.errors";
import type { RatingSummaryData } from "@/types/review";

// ---------------------------------------------------------------------------
// Status lifecycle (blueprint Section 7: pending → approved → published →
// archived). changeReviewStatus() is the only way a status changes; the
// STORY-045 moderation console calls it.
// ---------------------------------------------------------------------------

const allowedTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Published", "Rejected"],
  Published: ["Archived"],
  Archived: ["Published"],
  Rejected: [],
};

export function canTransitionReview(from: ReviewStatus, to: ReviewStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export interface ChangeReviewStatusOptions {
  moderatorId?: string;
  note?: string;
}

export async function changeReviewStatus(
  reviewId: string,
  nextStatus: ReviewStatus,
  options: ChangeReviewStatusOptions = {},
) {
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review) throw new ReviewNotFoundError();
  if (!canTransitionReview(review.status, nextStatus)) {
    throw new InvalidReviewTransitionError(review.status, nextStatus);
  }

  const data: ReviewStatusUpdate = { status: nextStatus };
  if (nextStatus === "Published") data.publishedAt = new Date();
  if (options.moderatorId) {
    data.reviewedById = options.moderatorId;
    data.reviewedAt = new Date();
  }
  if (options.note !== undefined) data.moderatorNote = options.note;

  const touchesPublished = review.status === "Published" || nextStatus === "Published";
  return reviewRepository.updateStatusAndRecalculate(review.id, review.productId, data, touchesPublished);
}

export async function getRatingSummary(productId: string): Promise<RatingSummaryData | null> {
  const row = await reviewRepository.findRatingSummary(productId);
  if (!row) return null;
  return {
    averageRating: row.averageRating.toNumber(),
    reviewCount: row.reviewCount,
    histogram: { 1: row.count1, 2: row.count2, 3: row.count3, 4: row.count4, 5: row.count5 },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/review-lifecycle.test.ts`
Expected: PASS (all 25 transition cases plus the `changeReviewStatus` tests).

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/review.errors.ts src/services/review.service.ts tests/unit/review-lifecycle.test.ts
git commit -m "feat: add review status lifecycle with changeReviewStatus" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Customer review actions and listing

**Files:**
- Create: `src/services/purchase-verification.ts`
- Modify: `src/services/review.service.ts` (add imports at the top; append the new section at the end)
- Test: `tests/unit/review-service.test.ts`

**Interfaces:**
- Consumes: Task 3 repository functions; Task 4 errors and `changeReviewStatus`; `findProductBySlug` from `@/repositories/product.repository`; `reviewInputSchema`, `ReviewInput`, `ReviewListQuery` (Task 2); `OwnReview`, `PublicReview`, `ReviewPage` (Task 2).
- Produces:
  - `purchase-verification.ts`: `PurchaseVerifier`, `registerPurchaseVerifier(fn)`, `hasPurchasedProduct(userId, productId): Promise<boolean>`, `resetPurchaseVerifierForTesting()`.
  - `review.service.ts`: `submitReview(userId, productSlug, input: ReviewInput): Promise<OwnReview>`, `getMyReview(userId, productSlug): Promise<OwnReview | null>`, `editOwnPendingReview(userId, productSlug, reviewId, input): Promise<OwnReview>`, `withdrawOwnPendingReview(userId, productSlug, reviewId): Promise<void>`, `listPublishedReviewsForProduct(productId, query: ReviewListQuery): Promise<ReviewPage>`, `listPublishedReviews(productSlug, query: ReviewListQuery): Promise<ReviewPage>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { findReviewById } from "@/repositories/review.repository";
import { registerPurchaseVerifier, resetPurchaseVerifierForTesting } from "@/services/purchase-verification";
import {
  DuplicateReviewError,
  InvalidReviewInputError,
  ProductNotFoundError,
  ReviewForbiddenError,
  ReviewNotEditableError,
  ReviewNotFoundError,
} from "@/services/review.errors";
import {
  changeReviewStatus,
  editOwnPendingReview,
  getMyReview,
  listPublishedReviews,
  submitReview,
  withdrawOwnPendingReview,
} from "@/services/review.service";

const input = { rating: 4, title: "Great colour", body: "Bright red colour and a steady, even heat." };
const defaultQuery = { page: 1, pageSize: 10, sort: "recent" as const };
let sequence = 0;

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `REV-SVC-${sequence}`, slug: `rev-svc-${sequence}`, name: "Chilli Powder", status });
}

async function makeUser(name: string | null = "Kasun Perera") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-svc-${sequence}@test.com`, name } });
}

async function publish(reviewId: string) {
  await changeReviewStatus(reviewId, "Approved");
  await changeReviewStatus(reviewId, "Published");
}

afterEach(async () => {
  resetPurchaseVerifierForTesting();
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("submitReview", () => {
  it("creates a Pending review, not verified by default", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const review = await submitReview(user.id, product.slug, input);

    expect(review).toMatchObject({ ...input, status: "Pending" });
    expect((await findReviewById(review.id))?.isVerifiedPurchase).toBe(false);
  });

  it("flags a verified purchase when the registered verifier says so", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    registerPurchaseVerifier(async (userId, productId) => userId === user.id && productId === product.id);

    const review = await submitReview(user.id, product.slug, input);

    expect((await findReviewById(review.id))?.isVerifiedPurchase).toBe(true);
  });

  it("rejects an unknown or unpublished product", async () => {
    const draft = await makeProduct("Draft");
    const user = await makeUser();

    await expect(submitReview(user.id, draft.slug, input)).rejects.toBeInstanceOf(ProductNotFoundError);
    await expect(submitReview(user.id, "no-such-product", input)).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it("re-validates input for non-API callers", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    await expect(submitReview(user.id, product.slug, { ...input, rating: 7 })).rejects.toBeInstanceOf(InvalidReviewInputError);
  });

  it("rejects a second review from the same customer", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await submitReview(user.id, product.slug, input);

    await expect(submitReview(user.id, product.slug, input)).rejects.toBeInstanceOf(DuplicateReviewError);
  });

  it("lets exactly one of two concurrent submissions through", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const results = await Promise.allSettled([
      submitReview(user.id, product.slug, input),
      submitReview(user.id, product.slug, input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection?.status === "rejected" && rejection.reason).toBeInstanceOf(DuplicateReviewError);
  });
});

describe("getMyReview", () => {
  it("returns null before reviewing and the review (any status) after", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    expect(await getMyReview(user.id, product.slug)).toBeNull();

    const review = await submitReview(user.id, product.slug, input);

    expect(await getMyReview(user.id, product.slug)).toEqual(review);
  });
});

describe("editOwnPendingReview", () => {
  it("updates the customer's own Pending review", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    const edited = await editOwnPendingReview(user.id, product.slug, review.id, { ...input, rating: 2, title: "Changed my mind" });

    expect(edited).toMatchObject({ rating: 2, title: "Changed my mind", status: "Pending" });
  });

  it("refuses another customer's review", async () => {
    const product = await makeProduct();
    const review = await submitReview((await makeUser()).id, product.slug, input);
    const intruder = await makeUser();

    await expect(editOwnPendingReview(intruder.id, product.slug, review.id, input)).rejects.toBeInstanceOf(ReviewForbiddenError);
  });

  it("refuses once the review has left Pending", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);
    await changeReviewStatus(review.id, "Approved");

    await expect(editOwnPendingReview(user.id, product.slug, review.id, input)).rejects.toBeInstanceOf(ReviewNotEditableError);
  });

  it("treats a review that belongs to a different product as not found", async () => {
    const product = await makeProduct();
    const otherProduct = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    await expect(editOwnPendingReview(user.id, otherProduct.slug, review.id, input)).rejects.toBeInstanceOf(ReviewNotFoundError);
  });
});

describe("withdrawOwnPendingReview", () => {
  it("deletes the Pending review so the customer can write a fresh one", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);

    await withdrawOwnPendingReview(user.id, product.slug, review.id);

    expect(await findReviewById(review.id)).toBeNull();
    await expect(submitReview(user.id, product.slug, input)).resolves.toMatchObject({ status: "Pending" });
  });

  it("refuses another customer's review and a review past Pending", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);

    await expect(withdrawOwnPendingReview((await makeUser()).id, product.slug, review.id)).rejects.toBeInstanceOf(ReviewForbiddenError);

    await changeReviewStatus(review.id, "Approved");
    await expect(withdrawOwnPendingReview(owner.id, product.slug, review.id)).rejects.toBeInstanceOf(ReviewNotEditableError);
  });
});

describe("listPublishedReviews", () => {
  it("returns only Published reviews as public DTOs with pagination metadata", async () => {
    const product = await makeProduct();
    const named = await submitReview((await makeUser("  Nadeesha  ")).id, product.slug, input);
    const anonymous = await submitReview((await makeUser(null)).id, product.slug, { ...input, rating: 5 });
    await submitReview((await makeUser()).id, product.slug, input); // stays Pending
    await publish(named.id);
    await publish(anonymous.id);

    const page = await listPublishedReviews(product.slug, defaultQuery);

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 10 });
    expect(page.items.map((item) => item.authorName).sort()).toEqual(["Nadeesha", "Oristor customer"]);
    expect(page.items[0]).toEqual({
      id: expect.any(String),
      authorName: expect.any(String),
      rating: expect.any(Number),
      title: input.title,
      body: input.body,
      isVerifiedPurchase: false,
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("applies the rating filter and page offsets", async () => {
    const product = await makeProduct();
    for (const rating of [5, 5, 5, 2]) {
      const review = await submitReview((await makeUser()).id, product.slug, { ...input, rating });
      await publish(review.id);
    }

    const page2 = await listPublishedReviews(product.slug, { page: 2, pageSize: 2, sort: "recent", rating: 5 });

    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.rating).toBe(5);
  });

  it("rejects an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    await expect(listPublishedReviews(draft.slug, defaultQuery)).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-service.test.ts`
Expected: FAIL, `Failed to resolve import "@/services/purchase-verification"`.

- [ ] **Step 3: Create `src/services/purchase-verification.ts`**

```ts
/**
 * "Verified Purchase" hook for reviews (STORY-015). There is no Order model
 * yet, so the default verifier always answers false. STORY-028 (Order
 * Management) registers the real check at startup, the same way
 * product-detail-extensions.ts providers work, so review code never imports
 * order code. The flag is evaluated once, when a review is submitted.
 */
export type PurchaseVerifier = (userId: string, productId: string) => Promise<boolean>;

const defaultVerifier: PurchaseVerifier = async () => false;
let verifier: PurchaseVerifier = defaultVerifier;

export function registerPurchaseVerifier(next: PurchaseVerifier): void {
  verifier = next;
}

export function hasPurchasedProduct(userId: string, productId: string): Promise<boolean> {
  return verifier(userId, productId);
}

/** Test-only: restores the default verifier. */
export function resetPurchaseVerifierForTesting(): void {
  verifier = defaultVerifier;
}
```

- [ ] **Step 4: Extend `src/services/review.service.ts`**

Replace the import block at the top of the file with:

```ts
import { Prisma, type ReviewStatus } from "@/generated/prisma/client";
import { findProductBySlug } from "@/repositories/product.repository";
import * as reviewRepository from "@/repositories/review.repository";
import type { ReviewStatusUpdate, ReviewWithAuthor } from "@/repositories/review.repository";
import { hasPurchasedProduct } from "@/services/purchase-verification";
import {
  DuplicateReviewError,
  InvalidReviewInputError,
  InvalidReviewTransitionError,
  ProductNotFoundError,
  ReviewForbiddenError,
  ReviewNotEditableError,
  ReviewNotFoundError,
} from "@/services/review.errors";
import type { OwnReview, PublicReview, RatingSummaryData, ReviewPage } from "@/types/review";
import { reviewInputSchema, type ReviewInput, type ReviewListQuery } from "@/validation/review.schema";
```

Then append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

const FALLBACK_AUTHOR_NAME = "Oristor customer";

function toOwnReview(review: { id: string; rating: number; title: string; body: string; status: ReviewStatus }): OwnReview {
  return { id: review.id, rating: review.rating, title: review.title, body: review.body, status: review.status };
}

function toPublicReview(review: ReviewWithAuthor): PublicReview {
  return {
    id: review.id,
    authorName: review.user.name?.trim() || FALLBACK_AUTHOR_NAME,
    rating: review.rating,
    title: review.title,
    body: review.body,
    isVerifiedPurchase: review.isVerifiedPurchase,
    publishedAt: (review.publishedAt ?? review.createdAt).toISOString(),
  };
}

async function requirePublishedProduct(productSlug: string) {
  const product = await findProductBySlug(productSlug);
  if (!product || product.status !== "Published") throw new ProductNotFoundError();
  return product;
}

// Route handlers already validate with the same schema; this second check
// protects non-API callers (the seed, the dev publish script, future jobs).
function parseReviewInput(input: ReviewInput): ReviewInput {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidReviewInputError(parsed.error.issues[0]?.message ?? "Invalid review");
  return parsed.data;
}

async function requireOwnPendingReview(userId: string, productSlug: string, reviewId: string) {
  const product = await requirePublishedProduct(productSlug);
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review || review.productId !== product.id) throw new ReviewNotFoundError();
  if (review.userId !== userId) throw new ReviewForbiddenError();
  if (review.status !== "Pending") throw new ReviewNotEditableError();
  return review;
}

export async function submitReview(userId: string, productSlug: string, input: ReviewInput): Promise<OwnReview> {
  const product = await requirePublishedProduct(productSlug);
  const data = parseReviewInput(input);
  const isVerifiedPurchase = await hasPurchasedProduct(userId, product.id);
  try {
    const review = await reviewRepository.createReview({ productId: product.id, userId, ...data, isVerifiedPurchase });
    return toOwnReview(review);
  } catch (error) {
    // The (productId, userId) unique constraint is the real guard, so two
    // concurrent submits can't both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateReviewError();
    }
    throw error;
  }
}

export async function getMyReview(userId: string, productSlug: string): Promise<OwnReview | null> {
  const product = await requirePublishedProduct(productSlug);
  const review = await reviewRepository.findReviewByProductAndUser(product.id, userId);
  return review ? toOwnReview(review) : null;
}

export async function editOwnPendingReview(
  userId: string,
  productSlug: string,
  reviewId: string,
  input: ReviewInput,
): Promise<OwnReview> {
  const review = await requireOwnPendingReview(userId, productSlug, reviewId);
  const updated = await reviewRepository.updateReviewContent(review.id, parseReviewInput(input));
  return toOwnReview(updated);
}

/** Withdrawing deletes the review: it was never public, and this frees the one-per-product slot. */
export async function withdrawOwnPendingReview(userId: string, productSlug: string, reviewId: string): Promise<void> {
  const review = await requireOwnPendingReview(userId, productSlug, reviewId);
  await reviewRepository.deleteReview(review.id);
}

export async function listPublishedReviewsForProduct(productId: string, query: ReviewListQuery): Promise<ReviewPage> {
  const { items, total } = await reviewRepository.listPublishedReviews(productId, {
    sort: query.sort,
    rating: query.rating,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicReview), total, page: query.page, pageSize: query.pageSize };
}

export async function listPublishedReviews(productSlug: string, query: ReviewListQuery): Promise<ReviewPage> {
  const product = await requirePublishedProduct(productSlug);
  return listPublishedReviewsForProduct(product.id, query);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/review-service.test.ts tests/unit/review-lifecycle.test.ts`
Expected: PASS (both files).

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/purchase-verification.ts src/services/review.service.ts tests/unit/review-service.test.ts
git commit -m "feat: add customer review submission, editing, withdrawal and listing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Plug reviews into the Product Detail Page data

**Files:**
- Modify: `src/services/product-detail-extensions.ts` (the `ReviewPreview`/`ReviewSummary` types, the provider variables, and the register/get/reset functions)
- Modify: `src/services/review.service.ts` (add an import; append the provider section)
- Create: `src/instrumentation.ts`
- Modify: `tests/unit/product-detail-extensions.test.ts` (the review fixture, around lines 24-35)
- Modify: `tests/unit/product-detail-service.test.ts` (the fixtures at lines 112 and 245)
- Test: `tests/unit/review-summary-provider.test.ts`

**Interfaces:**
- Consumes: `getRatingSummary` (Task 4); `listPublishedReviewsForProduct` (Task 5); `PublicReview`, `RatingHistogram`, `REVIEW_PAGE_SIZE` (Task 2).
- Produces:
  - `ReviewSummary { averageRating: number; reviewCount: number; histogram: RatingHistogram; previewReviews: ReviewPreview[] }`, where `ReviewPreview = PublicReview`.
  - `getReviewSummaryForProduct(productId): Promise<ReviewSummary | null>`
  - `registerReviewProviders(): void`
  - `src/instrumentation.ts` `register()`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-summary-provider.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { resetProductDetailExtensionsForTesting } from "@/services/product-detail-extensions";
import { getProductDetail } from "@/services/product.service";
import {
  changeReviewStatus,
  getReviewSummaryForProduct,
  registerReviewProviders,
  submitReview,
} from "@/services/review.service";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  const product = await createProduct({ sku: `REV-PROV-${sequence}`, slug: `rev-prov-${sequence}`, name: "Gift Set", status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "2500.00" });
  return product;
}

async function publishedReview(productSlug: string, rating: number, name: string) {
  sequence += 1;
  const user = await prisma.user.create({ data: { email: `rev-prov-${sequence}@test.com`, name } });
  const review = await submitReview(user.id, productSlug, { rating, title: `${rating} stars`, body: "Beautifully packed and very fresh spices." });
  await changeReviewStatus(review.id, "Approved");
  await changeReviewStatus(review.id, "Published");
}

afterEach(async () => {
  resetProductDetailExtensionsForTesting();
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("getReviewSummaryForProduct", () => {
  it("returns null when the product has no Published reviews", async () => {
    const product = await makeProduct();

    expect(await getReviewSummaryForProduct(product.id)).toBeNull();
  });

  it("returns the aggregate, histogram and the first page of reviews", async () => {
    const product = await makeProduct();
    await publishedReview(product.slug, 5, "Nadeesha");
    await publishedReview(product.slug, 4, "Kamal");

    const summary = await getReviewSummaryForProduct(product.id);

    expect(summary).toMatchObject({
      averageRating: 4.5,
      reviewCount: 2,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
    });
    // Both were published within the same test, possibly in the same
    // millisecond, so assert membership rather than order.
    expect(summary?.previewReviews.map((review) => review.authorName).sort()).toEqual(["Kamal", "Nadeesha"]);
  });
});

describe("registerReviewProviders", () => {
  it("makes getProductDetail include real review data", async () => {
    const product = await makeProduct();
    await publishedReview(product.slug, 3, "Ruwani");

    registerReviewProviders();
    const detail = await getProductDetail(product.slug);

    expect(detail?.reviewSummary).toMatchObject({ averageRating: 3, reviewCount: 1 });
  });
});

describe("provider registry", () => {
  it("is shared across separately loaded copies of the extensions module", async () => {
    // Next.js bundles src/instrumentation.ts separately from route code, so
    // the module that registers a provider is not the same module instance
    // that reads it. The registry lives on globalThis to survive that.
    const first = await import("@/services/product-detail-extensions");
    vi.resetModules();
    const second = await import("@/services/product-detail-extensions");
    expect(second).not.toBe(first);

    first.registerReviewSummaryProvider(async () => ({ averageRating: 2, reviewCount: 1, histogram: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0 }, previewReviews: [] }));

    expect((await second.getReviewSummary("any"))?.averageRating).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-summary-provider.test.ts`
Expected: FAIL. `getReviewSummaryForProduct` and `registerReviewProviders` are not exported (TypeError: not a function), and the registry test fails because module-scoped providers aren't shared.

- [ ] **Step 3: Update `src/services/product-detail-extensions.ts`**

Replace the `ReviewPreview` and `ReviewSummary` declarations at the top of the file with:

```ts
import type { PublicReview, RatingHistogram } from "@/types/review";

/** A Published review as shown on the PDP. Same shape the reviews API returns. */
export type ReviewPreview = PublicReview;
export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  histogram: RatingHistogram;
  /** The first page of Published reviews, most recent first. */
  previewReviews: ReviewPreview[];
}
```

Then replace everything from `let reviewSummaryProvider` to the end of the file with:

```ts
interface ProductDetailProviders {
  review: GetReviewSummary;
  qa: GetQaSummary;
  recipe: GetRecipeSummary;
}

function defaultProviders(): ProductDetailProviders {
  return { review: async () => null, qa: async () => null, recipe: async () => null };
}

// Kept on globalThis, not in module scope. Providers register at server
// startup from src/instrumentation.ts, which Next.js bundles separately from
// the route code that reads them, so each bundle gets its own copy of this
// module. globalThis is shared by both within the server process (the same
// reason src/lib/db.ts keeps the Prisma client there).
const globalForExtensions = globalThis as unknown as { __oristorProductDetailProviders?: ProductDetailProviders };
const providers = (globalForExtensions.__oristorProductDetailProviders ??= defaultProviders());

/**
 * STORY-015 (Product Reviews & Ratings) registers this through
 * registerReviewProviders() in src/instrumentation.ts, so product.service.ts
 * never imports review code.
 */
export function registerReviewSummaryProvider(provider: GetReviewSummary) {
  providers.review = provider;
}
export function getReviewSummary(productId: string) {
  return providers.review(productId);
}

/** STORY-016 (Product Q&A) — same contract as registerReviewSummaryProvider. */
export function registerQaSummaryProvider(provider: GetQaSummary) {
  providers.qa = provider;
}
export function getQaSummary(productId: string) {
  return providers.qa(productId);
}

/** Epic 04 (Recipes & Food Academy) — same contract as registerReviewSummaryProvider. */
export function registerRecipeSummaryProvider(provider: GetRecipeSummary) {
  providers.recipe = provider;
}
export function getRecipeSummary(productId: string) {
  return providers.recipe(productId);
}

/** Test-only: restores every provider to its default stub. */
export function resetProductDetailExtensionsForTesting() {
  Object.assign(providers, defaultProviders());
}
```

- [ ] **Step 4: Append the provider section to `src/services/review.service.ts`**

In the import block at the top of the file, add:

```ts
import { registerReviewSummaryProvider, type ReviewSummary } from "@/services/product-detail-extensions";
```

and change the existing `import type { OwnReview, PublicReview, RatingSummaryData, ReviewPage } from "@/types/review";` line to (one import per module):

```ts
import { REVIEW_PAGE_SIZE, type OwnReview, type PublicReview, type RatingSummaryData, type ReviewPage } from "@/types/review";
```

Then append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// PDP integration (STORY-011 extension point)
// ---------------------------------------------------------------------------

export async function getReviewSummaryForProduct(productId: string): Promise<ReviewSummary | null> {
  const summary = await getRatingSummary(productId);
  if (!summary) return null;
  const firstPage = await listPublishedReviewsForProduct(productId, { page: 1, pageSize: REVIEW_PAGE_SIZE, sort: "recent" });
  return { ...summary, previewReviews: firstPage.items };
}

/** Called once at server startup from src/instrumentation.ts. */
export function registerReviewProviders(): void {
  registerReviewSummaryProvider(getReviewSummaryForProduct);
}
```

- [ ] **Step 5: Create `src/instrumentation.ts`**

```ts
/**
 * Next.js calls register() once when the server starts. It runs in both the
 * Node.js and Edge runtimes; Prisma only loads on Node.js, so the service is
 * imported only there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerReviewProviders } = await import("@/services/review.service");
    registerReviewProviders();
  }
}
```

- [ ] **Step 6: Update the existing test fixtures to the new `ReviewSummary` shape**

In `tests/unit/product-detail-extensions.test.ts`, replace the `registerReviewSummaryProvider(async () => ({ ... }))` call in the "returns the registered review summary provider's result" test with:

```ts
    registerReviewSummaryProvider(async () => ({
      averageRating: 4.2,
      reviewCount: 10,
      histogram: { 1: 0, 2: 0, 3: 1, 4: 6, 5: 3 },
      previewReviews: [
        {
          id: "r1",
          authorName: "Kasun",
          rating: 5,
          title: "Great",
          body: "Loved it",
          isVerifiedPurchase: false,
          publishedAt: "2026-09-01T00:00:00.000Z",
        },
      ],
    }));
```

In `tests/unit/product-detail-service.test.ts`, replace **both** occurrences (lines 112 and 245) of

```ts
registerReviewSummaryProvider(async () => ({ averageRating: 4.5, reviewCount: 3, previewReviews: [] }));
```

with

```ts
registerReviewSummaryProvider(async () => ({
  averageRating: 4.5,
  reviewCount: 3,
  histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 2 },
  previewReviews: [],
}));
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/review-summary-provider.test.ts tests/unit/product-detail-extensions.test.ts tests/unit/product-detail-service.test.ts`
Expected: PASS (all three files).

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. `src/app/(storefront)/products/[slug]/page.tsx` still compiles: it reads only `authorName`, `title`, `body` and `id` from `previewReviews`, all of which still exist.

- [ ] **Step 9: Check the dev server starts with instrumentation**

Run `npm run dev` in the background, then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/products/roasted-curry-powder-100g`.
Expected: `200`, and no `instrumentation` or `register` error in the dev-server output. Stop the dev server afterwards. (Task 11's e2e test proves the provider is actually used by the page.)

- [ ] **Step 10: Commit**

```bash
git add src/services/product-detail-extensions.ts src/services/review.service.ts src/instrumentation.ts tests/unit/review-summary-provider.test.ts tests/unit/product-detail-extensions.test.ts tests/unit/product-detail-service.test.ts
git commit -m "feat: register the review summary provider for the product detail page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Review API routes

**Files:**
- Create: `src/lib/api/review-responses.ts`
- Create: `src/app/api/products/[slug]/reviews/route.ts`
- Create: `src/app/api/products/[slug]/reviews/mine/route.ts`
- Create: `src/app/api/products/[slug]/reviews/[reviewId]/route.ts`
- Test: `tests/unit/review-routes.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; the Task 5 service functions; `reviewInputSchema`, `reviewListQuerySchema` (Task 2); `ReviewServiceError`, `ReviewErrorCode` (Task 4).
- Produces: HTTP endpoints, with these response bodies:
  - `GET /reviews` → 200 `ReviewPage`
  - `POST /reviews` → 201 `{ review: OwnReview }`
  - `GET /reviews/mine` → 200 `{ review: OwnReview | null }`
  - `PATCH /reviews/[reviewId]` → 200 `{ review: OwnReview }`
  - `DELETE /reviews/[reviewId]` → 204 with no body
  - Errors → `{ error, fieldErrors? }` with status 400/401/403/404/409

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-routes.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { changeReviewStatus, submitReview } from "@/services/review.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/products/[slug]/reviews/route");
const mineRoute = await import("@/app/api/products/[slug]/reviews/mine/route");
const itemRoute = await import("@/app/api/products/[slug]/reviews/[reviewId]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const input = { rating: 5, title: "Superb", body: "Fragrant, fresh and perfectly ground." };
let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function reviewParams(slug: string, reviewId: string) {
  return { params: Promise.resolve({ slug, reviewId }) };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `REV-ROUTE-${sequence}`, slug: `rev-route-${sequence}`, name: "Turmeric", status });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rev-route-${sequence}@test.com`, name: "Route Tester" } });
}

afterEach(async () => {
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  vi.clearAllMocks();
});

describe("GET /api/products/[slug]/reviews", () => {
  it("lists Published reviews only", async () => {
    const product = await makeProduct();
    const published = await submitReview((await makeUser()).id, product.slug, input);
    await changeReviewStatus(published.id, "Approved");
    await changeReviewStatus(published.id, "Published");
    await submitReview((await makeUser()).id, product.slug, input); // Pending

    const response = await listRoute.GET(new Request(`http://localhost/api/products/${product.slug}/reviews`), slugParams(product.slug));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(body.items[0].id).toBe(published.id);
  });

  it("returns 400 with field errors for an invalid query", async () => {
    const product = await makeProduct();

    const response = await listRoute.GET(
      new Request(`http://localhost/api/products/${product.slug}/reviews?pageSize=99`),
      slugParams(product.slug),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.pageSize).toBeDefined();
  });

  it("returns 404 for an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    const response = await listRoute.GET(new Request(`http://localhost/api/products/${draft.slug}/reviews`), slugParams(draft.slug));

    expect(response.status).toBe(404);
  });
});

describe("POST /api/products/[slug]/reviews", () => {
  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const product = await makeProduct();

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));

    expect(response.status).toBe(401);
  });

  it("returns 400 with field errors for invalid input", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", { ...input, body: "short" }), slugParams(product.slug));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.fieldErrors.body).toEqual(["Review must be at least 20 characters"]);
  });

  it("creates a Pending review (201), then 409 on a second attempt", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const first = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));
    const second = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams(product.slug));

    expect(first.status).toBe(201);
    expect((await first.json()).review.status).toBe("Pending");
    expect(second.status).toBe(409);
  });

  it("returns 404 for an unknown product", async () => {
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const response = await listRoute.POST(jsonRequest("http://localhost/x", "POST", input), slugParams("nope"));

    expect(response.status).toBe(404);
  });
});

describe("GET /api/products/[slug]/reviews/mine", () => {
  it("returns 401, then null, then the customer's review", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    mockAuth.mockResolvedValue(null);
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor(user.id));
    expect(await (await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).json()).toEqual({ review: null });

    const review = await submitReview(user.id, product.slug, input);
    expect(await (await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).json()).toEqual({ review });
  });
});

describe("PATCH and DELETE /api/products/[slug]/reviews/[reviewId]", () => {
  it("lets the owner edit a Pending review", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const review = await submitReview(user.id, product.slug, input);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await itemRoute.PATCH(
      jsonRequest("http://localhost/x", "PATCH", { ...input, rating: 3 }),
      reviewParams(product.slug, review.id),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).review.rating).toBe(3);
  });

  it("returns 400 for invalid edits, 403 for another customer, 409 once past Pending", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);

    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const invalid = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", { ...input, rating: 9 }), reviewParams(product.slug, review.id));
    expect(invalid.status).toBe(400);

    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));
    const forbidden = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", input), reviewParams(product.slug, review.id));
    expect(forbidden.status).toBe(403);

    await changeReviewStatus(review.id, "Approved");
    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const conflict = await itemRoute.PATCH(jsonRequest("http://localhost/x", "PATCH", input), reviewParams(product.slug, review.id));
    expect(conflict.status).toBe(409);
  });

  it("withdraws with 204, and returns 401/403/409 in the matching cases", async () => {
    const product = await makeProduct();
    const owner = await makeUser();
    const review = await submitReview(owner.id, product.slug, input);
    const request = () => new Request("http://localhost/x", { method: "DELETE" });

    mockAuth.mockResolvedValue(null);
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, review.id))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, review.id))).status).toBe(403);

    mockAuth.mockResolvedValue(sessionFor(owner.id));
    const withdrawn = await itemRoute.DELETE(request(), reviewParams(product.slug, review.id));
    expect(withdrawn.status).toBe(204);
    expect(await prisma.review.findUnique({ where: { id: review.id } })).toBeNull();

    const again = await submitReview(owner.id, product.slug, input);
    await changeReviewStatus(again.id, "Approved");
    expect((await itemRoute.DELETE(request(), reviewParams(product.slug, again.id))).status).toBe(409);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-routes.test.ts`
Expected: FAIL, `Failed to resolve import "@/app/api/products/[slug]/reviews/route"`.

- [ ] **Step 3: Create `src/lib/api/review-responses.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

import { ReviewServiceError, type ReviewErrorCode } from "@/services/review.errors";

const statusByCode: Record<ReviewErrorCode, number> = {
  invalid_input: 400,
  product_not_found: 404,
  review_not_found: 404,
  forbidden: 403,
  duplicate: 409,
  not_editable: 409,
  invalid_transition: 409,
};

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Invalid input", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 },
  );
}

/** Maps a review service error to its HTTP response; anything else is rethrown (500). */
export function reviewErrorResponse(error: unknown) {
  if (error instanceof ReviewServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
```

- [ ] **Step 4: Create `src/app/api/products/[slug]/reviews/route.ts`**

```ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/review-responses";
import { listPublishedReviews, submitReview } from "@/services/review.service";
import { reviewInputSchema, reviewListQuerySchema } from "@/validation/review.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = reviewListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listPublishedReviews(slug, parsed.data), { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await submitReview(session.user.id, slug, parsed.data);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
```

- [ ] **Step 5: Create `src/app/api/products/[slug]/reviews/mine/route.ts`**

```ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse } from "@/lib/api/review-responses";
import { getMyReview } from "@/services/review.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ review: await getMyReview(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
```

- [ ] **Step 6: Create `src/app/api/products/[slug]/reviews/[reviewId]/route.ts`**

```ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { reviewErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/review-responses";
import { editOwnPendingReview, withdrawOwnPendingReview } from "@/services/review.service";
import { reviewInputSchema } from "@/validation/review.schema";

type RouteContext = { params: Promise<{ slug: string; reviewId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug, reviewId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = reviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await editOwnPendingReview(session.user.id, slug, reviewId, parsed.data);
    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}

/** Withdraws (deletes) the signed-in customer's own Pending review. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug, reviewId } = await params;
  try {
    await withdrawOwnPendingReview(session.user.id, slug, reviewId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/review-routes.test.ts`
Expected: PASS (all tests).

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/api/review-responses.ts "src/app/api/products/[slug]/reviews" tests/unit/review-routes.test.ts
git commit -m "feat: add product review API routes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Rating summary and review list on the PDP

**Files:**
- Create: `src/lib/api/review-client.ts`
- Create: `src/components/storefront/product/reviews/star-rating.tsx`
- Create: `src/components/storefront/product/reviews/rating-summary.tsx`
- Create: `src/components/storefront/product/reviews/review-list.tsx`
- Create: `src/components/storefront/product/reviews/reviews-section.tsx`
- Modify: `src/app/(storefront)/products/[slug]/page.tsx` (imports; replace the "Customer Reviews" block, around lines 173-193)
- Test: `tests/unit/review-client.test.ts`, `tests/unit/rating-summary.test.tsx`, `tests/unit/reviews-section.test.tsx`

**Interfaces:**
- Consumes: the API from Task 7; types from Task 2; `ReviewSummary` (Task 6, type-only import).
- Produces:
  - `review-client.ts`: `ReviewApiError` (`status: number`, `fieldErrors: Partial<Record<keyof ReviewInput, string[]>>`), `fetchReviewPage(slug, query: ReviewPageQuery): Promise<ReviewPage>`, `fetchMyReview(slug): Promise<OwnReview | null>`, `postReview(slug, input): Promise<OwnReview>`, `patchReview(slug, reviewId, input): Promise<OwnReview>`, `deleteReview(slug, reviewId): Promise<void>`.
  - Components: `StarRating({ rating, className? })`, `RatingSummary({ summary, activeRating?, onSelectRating })`, `ReviewList({ productSlug, initialPage, query, onSortChange, onPageChange, onClearRating })`, `ReviewsSection({ productSlug, summary })`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/review-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteReview, fetchMyReview, fetchReviewPage, postReview, ReviewApiError } from "@/lib/api/review-client";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("review-client", () => {
  it("builds the list URL with the rating filter only when set", async () => {
    // mockImplementation, not mockResolvedValue: a Response body can only be read once.
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, page: 2, pageSize: 10 }));

    await fetchReviewPage("curry powder", { page: 2, pageSize: 10, sort: "highest" });
    await fetchReviewPage("curry", { page: 1, pageSize: 10, sort: "recent", rating: 5 });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/curry%20powder/reviews?page=2&pageSize=10&sort=highest");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/products/curry/reviews?page=1&pageSize=10&sort=recent&rating=5");
  });

  it("returns the customer's review from /mine", async () => {
    fetchMock.mockResolvedValue(json({ review: null }));

    expect(await fetchMyReview("curry")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/curry/reviews/mine");
  });

  it("throws ReviewApiError with status and field errors", async () => {
    fetchMock.mockResolvedValue(json({ error: "Review must be at least 20 characters", fieldErrors: { body: ["Review must be at least 20 characters"] } }, 400));

    const error = await postReview("curry", { rating: 5, title: "Hi there", body: "short" }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ReviewApiError);
    expect(error).toMatchObject({ status: 400, fieldErrors: { body: ["Review must be at least 20 characters"] } });
  });

  it("treats 204 from DELETE as success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteReview("curry", "r1")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "DELETE" });
  });
});
```

Create `tests/unit/rating-summary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RatingSummary } from "@/components/storefront/product/reviews/rating-summary";

const summary = { averageRating: 4.33, reviewCount: 3, histogram: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 } };

describe("RatingSummary", () => {
  it("shows the empty state when there are no reviews", () => {
    render(<RatingSummary summary={null} onSelectRating={vi.fn()} />);

    expect(screen.getByText("No reviews yet. Be the first to review this product.")).toBeInTheDocument();
  });

  it("shows the average, count and a histogram row per star", () => {
    render(<RatingSummary summary={summary} onSelectRating={vi.fn()} />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("Based on 3 reviews")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "4.3 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 4-star reviews (2)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Show 1-star reviews (0)" })).toBeDisabled();
  });

  it("selects a star filter and marks the active row", async () => {
    const onSelectRating = vi.fn();
    render(<RatingSummary summary={summary} activeRating={5} onSelectRating={onSelectRating} />);

    await userEvent.click(screen.getByRole("button", { name: "Show 4-star reviews (2)" }));

    expect(onSelectRating).toHaveBeenCalledWith(4);
    expect(screen.getByRole("button", { name: "Show 5-star reviews (1)" })).toHaveAttribute("aria-pressed", "true");
  });
});
```

Create `tests/unit/reviews-section.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewsSection } from "@/components/storefront/product/reviews/reviews-section";
import type { ReviewSummary } from "@/services/product-detail-extensions";
import type { PublicReview } from "@/types/review";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function review(id: string, rating: number, title: string, extra: Partial<PublicReview> = {}): PublicReview {
  return { id, authorName: "Nadeesha", rating, title, body: "Lovely and fresh.", isVerifiedPurchase: false, publishedAt: "2026-09-01T00:00:00.000Z", ...extra };
}

const summary: ReviewSummary = {
  averageRating: 4.5,
  reviewCount: 2,
  histogram: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
  previewReviews: [review("r1", 5, "Fiery and fresh", { isVerifiedPurchase: true }), review("r2", 4, "Good everyday chilli")],
};

function renderSection(value: ReviewSummary | null = summary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewsSection productSlug="chilli" summary={value} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("ReviewsSection", () => {
  it("renders the server-provided first page without fetching", () => {
    renderSection();

    expect(screen.getByRole("heading", { level: 2, name: "Customer Reviews" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Fiery and fresh" })).toBeInTheDocument();
    expect(screen.getByText("Verified Purchase")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 reviews")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows only the empty state when there are no reviews", () => {
    renderSection(null);

    expect(screen.getByText("No reviews yet. Be the first to review this product.")).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });

  it("fetches the filtered list when a histogram row is chosen, and clears the filter", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [summary.previewReviews[0]], total: 1, page: 1, pageSize: 10 }), { status: 200 }),
    );
    renderSection();

    await userEvent.click(screen.getByRole("button", { name: "Show 5-star reviews (1)" }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Good everyday chilli" })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/reviews?page=1&pageSize=10&sort=recent&rating=5");
    expect(screen.getByText("Showing 1–1 of 1 5-star reviews")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Clear star filter" }));
    expect(await screen.findByRole("heading", { name: "Good everyday chilli" })).toBeInTheDocument();
  });

  it("pages forward with Next", async () => {
    const many: ReviewSummary = { ...summary, reviewCount: 12, previewReviews: summary.previewReviews };
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [review("r11", 3, "Page two review")], total: 12, page: 2, pageSize: 10 }), { status: 200 }),
    );
    renderSection(many);

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Page two review" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/reviews?page=2&pageSize=10&sort=recent");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/review-client.test.ts tests/unit/rating-summary.test.tsx tests/unit/reviews-section.test.tsx`
Expected: FAIL, unresolved imports for `@/lib/api/review-client` and the review components.

- [ ] **Step 3: Create `src/lib/api/review-client.ts`**

```ts
import type { OwnReview, ReviewPage, ReviewPageQuery } from "@/types/review";
import type { ReviewInput } from "@/validation/review.schema";

/**
 * Browser-side wrapper around the product reviews API (STORY-015). Every
 * function throws ReviewApiError on a non-2xx response, carrying the status
 * and any per-field validation errors so the form can show them.
 */
export class ReviewApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<keyof ReviewInput, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<keyof ReviewInput, string[]>> = {}) {
    super(message);
    this.name = "ReviewApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Partial<Record<keyof ReviewInput, string[]>>;
}

async function toApiError(response: Response): Promise<ReviewApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new ReviewApiError(body?.error ?? `Request failed (${response.status})`, response.status, body?.fieldErrors ?? {});
}

function reviewsUrl(productSlug: string): string {
  return `/api/products/${encodeURIComponent(productSlug)}/reviews`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function fetchReviewPage(productSlug: string, query: ReviewPageQuery): Promise<ReviewPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sort: query.sort });
  if (query.rating) params.set("rating", String(query.rating));
  const response = await fetch(`${reviewsUrl(productSlug)}?${params.toString()}`);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as ReviewPage;
}

export async function fetchMyReview(productSlug: string): Promise<OwnReview | null> {
  const response = await fetch(`${reviewsUrl(productSlug)}/mine`);
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview | null }).review;
}

export async function postReview(productSlug: string, input: ReviewInput): Promise<OwnReview> {
  const response = await fetch(reviewsUrl(productSlug), jsonInit("POST", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview }).review;
}

export async function patchReview(productSlug: string, reviewId: string, input: ReviewInput): Promise<OwnReview> {
  const response = await fetch(`${reviewsUrl(productSlug)}/${encodeURIComponent(reviewId)}`, jsonInit("PATCH", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnReview }).review;
}

export async function deleteReview(productSlug: string, reviewId: string): Promise<void> {
  const response = await fetch(`${reviewsUrl(productSlug)}/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  if (!response.ok) throw await toApiError(response);
}
```

- [ ] **Step 4: Create `src/components/storefront/product/reviews/star-rating.tsx`**

```tsx
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/** Read-only stars. Screen readers get one "4.3 out of 5 stars" label, not five icons. */
export function StarRating({ rating, className }: { rating: number; className?: string }) {
  const filled = Math.round(rating);
  return (
    <span
      role="img"
      aria-label={`${formatRating(rating)} out of 5 stars`}
      className={cn("inline-flex items-center gap-0.5 text-gold", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= filled ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
    </span>
  );
}
```

- [ ] **Step 5: Create `src/components/storefront/product/reviews/rating-summary.tsx`**

```tsx
"use client";

import { STAR_RATINGS, type RatingSummaryData, type StarRating as StarValue } from "@/types/review";

import { formatRating, StarRating } from "./star-rating";

interface RatingSummaryProps {
  summary: RatingSummaryData | null;
  activeRating?: StarValue;
  onSelectRating: (rating: StarValue) => void;
}

export function RatingSummary({ summary, activeRating, onSelectRating }: RatingSummaryProps) {
  if (!summary) {
    return <p className="text-small text-charcoal/70">No reviews yet. Be the first to review this product.</p>;
  }

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
      <div className="shrink-0">
        <p className="text-charcoal">
          <span className="font-number text-h2">{formatRating(summary.averageRating)}</span>{" "}
          <span className="text-small text-charcoal/70">out of 5</span>
        </p>
        <StarRating rating={summary.averageRating} className="mt-1" />
        <p className="mt-1 text-small text-charcoal/70">
          Based on {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}
        </p>
      </div>

      <ul className="flex w-full max-w-md flex-col gap-1" aria-label="Rating breakdown">
        {STAR_RATINGS.map((star) => {
          const count = summary.histogram[star];
          const percent = Math.round((count / summary.reviewCount) * 100);
          return (
            <li key={star}>
              <button
                type="button"
                onClick={() => onSelectRating(star)}
                disabled={count === 0}
                aria-pressed={activeRating === star}
                aria-label={`Show ${star}-star reviews (${count})`}
                className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-small text-charcoal hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent aria-pressed:bg-muted"
              >
                <span className="w-12 shrink-0 text-left">{star} star</span>
                <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-charcoal/10">
                  <span className="block h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
                </span>
                <span className="w-8 shrink-0 text-right font-number">{count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/storefront/product/reviews/review-list.tsx`**

```tsx
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchReviewPage } from "@/lib/api/review-client";
import { cn } from "@/lib/utils";
import { REVIEW_SORTS, type ReviewPage, type ReviewPageQuery, type ReviewSort } from "@/types/review";

import { StarRating } from "./star-rating";

const sortLabels: Record<ReviewSort, string> = {
  recent: "Most recent",
  highest: "Highest rating",
  lowest: "Lowest rating",
};

// Fixed locale and time zone so the server render and the browser hydrate
// to the same string.
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

interface ReviewListProps {
  productSlug: string;
  /** The server-rendered first page (most recent, unfiltered). */
  initialPage: ReviewPage;
  query: ReviewPageQuery;
  onSortChange: (sort: ReviewSort) => void;
  onPageChange: (page: number) => void;
  onClearRating: () => void;
}

export function ReviewList({ productSlug, initialPage, query, onSortChange, onPageChange, onClearRating }: ReviewListProps) {
  const isInitialQuery = query.page === 1 && query.sort === "recent" && query.rating === undefined;
  const { data, isError, isFetching } = useQuery({
    queryKey: ["reviews", productSlug, query],
    queryFn: () => fetchReviewPage(productSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));
  const noun = query.rating ? `${query.rating}-star reviews` : "reviews";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-charcoal/70" aria-live="polite">
          {page.total > 0 ? `Showing ${from}–${to} of ${page.total} ${noun}` : ""}
        </p>
        <div className="flex items-center gap-2">
          {query.rating && (
            <Button type="button" variant="ghost" size="sm" onClick={onClearRating}>
              Clear star filter
            </Button>
          )}
          <Select value={query.sort} onValueChange={(next) => onSortChange(next as ReviewSort)}>
            <SelectTrigger aria-label="Sort reviews">
              <SelectValue>{(selected: ReviewSort | null) => sortLabels[selected ?? "recent"]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REVIEW_SORTS.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {sortLabels[sort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load reviews. Please try again.
        </p>
      )}

      {page.items.length === 0 && query.rating ? (
        <p className="text-small text-charcoal/70">No {query.rating}-star reviews yet.</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((review) => (
            <li key={review.id} className="py-4">
              <article aria-labelledby={`review-${review.id}-title`}>
                <StarRating rating={review.rating} />
                <h3 id={`review-${review.id}-title`} className="mt-1 font-medium text-charcoal">
                  {review.title}
                </h3>
                <p className="mt-1 text-small whitespace-pre-line text-charcoal">{review.body}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-charcoal/60">
                  <span>{review.authorName}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={review.publishedAt}>{dateFormatter.format(new Date(review.publishedAt))}</time>
                  {review.isVerifiedPurchase && <Badge variant="secondary">Verified Purchase</Badge>}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <nav aria-label="Review pages" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={query.page <= 1} onClick={() => onPageChange(query.page - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.page >= lastPage}
            onClick={() => onPageChange(query.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/storefront/product/reviews/reviews-section.tsx`**

```tsx
"use client";

import { useState } from "react";

import type { ReviewSummary } from "@/services/product-detail-extensions";
import { REVIEW_PAGE_SIZE, type ReviewPage, type ReviewPageQuery } from "@/types/review";

import { RatingSummary } from "./rating-summary";
import { ReviewList } from "./review-list";

interface ReviewsSectionProps {
  productSlug: string;
  /** Fetched by the PDP (server) through the review summary provider. */
  summary: ReviewSummary | null;
}

/**
 * Owns the list's query state (sort, star filter, page). The histogram in
 * RatingSummary and the controls in ReviewList both change it. Kept in
 * component state, not the URL, so the PDP URL stays canonical.
 */
export function ReviewsSection({ productSlug, summary }: ReviewsSectionProps) {
  const [query, setQuery] = useState<ReviewPageQuery>({ page: 1, pageSize: REVIEW_PAGE_SIZE, sort: "recent" });
  const initialPage: ReviewPage = {
    items: summary?.previewReviews ?? [],
    total: summary?.reviewCount ?? 0,
    page: 1,
    pageSize: REVIEW_PAGE_SIZE,
  };

  return (
    <section aria-labelledby="reviews-heading" className="flex flex-col gap-6">
      <h2 id="reviews-heading" className="text-h3 font-heading text-charcoal">
        Customer Reviews
      </h2>
      <RatingSummary
        summary={summary}
        activeRating={query.rating}
        onSelectRating={(rating) => setQuery((current) => ({ ...current, rating, page: 1 }))}
      />
      {summary && (
        <ReviewList
          productSlug={productSlug}
          initialPage={initialPage}
          query={query}
          onSortChange={(sort) => setQuery((current) => ({ ...current, sort, page: 1 }))}
          onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          onClearRating={() => setQuery((current) => ({ ...current, rating: undefined, page: 1 }))}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 8: Use `ReviewsSection` on the PDP**

In `src/app/(storefront)/products/[slug]/page.tsx`, add the import after the `RelatedProducts` import:

```tsx
import { ReviewsSection } from "@/components/storefront/product/reviews/reviews-section";
```

Replace the whole block that begins `<div className="mt-12">` with `<h2 ...>Customer Reviews</h2>` (it ends after the `No reviews yet.` paragraph and its closing `</div>`) with:

```tsx
      <div className="mt-12">
        <ReviewsSection productSlug={product.slug} summary={product.reviewSummary} />
      </div>
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/review-client.test.ts tests/unit/rating-summary.test.tsx tests/unit/reviews-section.test.tsx`
Expected: PASS (all three files).

- [ ] **Step 10: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/api/review-client.ts src/components/storefront/product/reviews "src/app/(storefront)/products/[slug]/page.tsx" tests/unit/review-client.test.ts tests/unit/rating-summary.test.tsx tests/unit/reviews-section.test.tsx
git commit -m "feat: show rating summary and published reviews on the product page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Review form (submit, edit, withdraw)

**Files:**
- Create: `src/components/storefront/product/reviews/review-form.tsx`
- Modify: `src/components/storefront/product/reviews/reviews-section.tsx` (render the form)
- Modify: `tests/unit/reviews-section.test.tsx` (mock `next-auth/react`)
- Test: `tests/unit/review-form.test.tsx`

**Interfaces:**
- Consumes: `fetchMyReview`, `postReview`, `patchReview`, `deleteReview`, `ReviewApiError` (Task 8); `reviewInputSchema`, `ReviewInput` (Task 2); `OwnReview`, `ReviewStatusValue` (Task 2); `useSession` from `next-auth/react`.
- Produces: `ReviewForm({ productSlug }: { productSlug: string })`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/review-form.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { ReviewForm } = await import("@/components/storefront/product/reviews/review-form");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const pending = { id: "r1", rating: 4, title: "Rich and aromatic", body: "Toasted notes come through nicely.", status: "Pending" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Routes fetch calls by method + URL suffix. Each handler may be called many times. */
function routeFetch(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = Object.keys(handlers).find((candidate) => {
      const [candidateMethod, suffix] = candidate.split(" ");
      return candidateMethod === method && url.endsWith(suffix ?? "");
    });
    if (!key) throw new Error(`Unexpected fetch: ${method} ${url}`);
    return handlers[key]!();
  });
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReviewForm productSlug="curry" />
    </QueryClientProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "4 stars" }));
  await user.type(screen.getByLabelText("Title"), "Rich and aromatic");
  await user.type(screen.getByLabelText("Your review"), "Toasted notes come through nicely.");
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("ReviewForm", () => {
  it("renders nothing while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });

    const { container } = renderForm();

    expect(container).toBeEmptyDOMElement();
  });

  it("asks guests to sign in, returning them to this product", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    renderForm();

    expect(screen.getByRole("link", { name: "Sign in to write a review" })).toHaveAttribute(
      "href",
      "/account/login?callbackUrl=%2Fproducts%2Fcurry",
    );
  });

  it("validates on the client before submitting", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: null }) });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Please choose a star rating")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("submits and switches to the pending state", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: null }), "POST /reviews": () => json({ review: pending }, 201) });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ rating: 4, title: "Rich and aromatic", body: "Toasted notes come through nicely." });
  });

  it("shows server field errors", async () => {
    routeFetch({
      "GET /reviews/mine": () => json({ review: null }),
      "POST /reviews": () => json({ error: "Title must be at least 3 characters", fieldErrors: { title: ["Title must be at least 3 characters"] } }, 400),
    });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Title must be at least 3 characters")).toBeInTheDocument();
  });

  it("shows the existing review after a 409 duplicate", async () => {
    let mineCalls = 0;
    routeFetch({
      "GET /reviews/mine": () => {
        mineCalls += 1;
        return json({ review: mineCalls === 1 ? null : pending });
      },
      "POST /reviews": () => json({ error: "You have already reviewed this product" }, 409),
    });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
  });

  it("edits a pending review with its values prefilled", async () => {
    routeFetch({
      "GET /reviews/mine": () => json({ review: pending }),
      "PATCH /reviews/r1": () => json({ review: { ...pending, title: "Even better" } }),
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Edit review" }));
    const title = screen.getByLabelText("Title");
    expect(title).toHaveValue("Rich and aromatic");
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();

    await user.clear(title);
    await user.type(title, "Even better");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true);
  });

  it("withdraws after an inline confirmation, then shows the empty form", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: pending }), "DELETE /reviews/r1": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    expect(screen.getByText("Withdraw your review? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, withdraw" }));

    expect(await screen.findByRole("button", { name: "Submit review" })).toBeInTheDocument();
  });

  it("shows a status note, without editing, once past Pending", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: { ...pending, status: "Published" } }) });

    renderForm();

    expect(await screen.findByText("Thanks! Your review has been published.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit review" })).not.toBeInTheDocument();
  });
});

describe("ReviewForm errors", () => {
  it("reports a failed load of the customer's review", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ error: "boom" }, 500) });

    renderForm();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your review"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-form.test.tsx`
Expected: FAIL, `Failed to resolve import "@/components/storefront/product/reviews/review-form"`.

- [ ] **Step 3: Create `src/components/storefront/product/reviews/review-form.tsx`**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteReview, fetchMyReview, patchReview, postReview, ReviewApiError } from "@/lib/api/review-client";
import { cn } from "@/lib/utils";
import type { OwnReview, ReviewStatusValue } from "@/types/review";
import { reviewInputSchema, type ReviewInput } from "@/validation/review.schema";

const statusNotes: Record<Exclude<ReviewStatusValue, "Pending">, string> = {
  Approved: "Your review has been approved and will appear here soon.",
  Published: "Thanks! Your review has been published.",
  Rejected: "Your review wasn't approved for publication.",
  Archived: "Your review is no longer shown on this product.",
};

const reviewFields = ["rating", "title", "body"] as const;

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(`/products/${productSlug}`);
    return (
      <p className="text-small text-charcoal">
        <Link href={`/account/login?callbackUrl=${callbackUrl}`} className="font-medium underline underline-offset-4">
          Sign in to write a review
        </Link>
      </p>
    );
  }
  return <SignedInReviewPanel productSlug={productSlug} />;
}

function SignedInReviewPanel({ productSlug }: { productSlug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["my-review", productSlug];
  const { data: myReview, isPending, isError } = useQuery({ queryKey, queryFn: () => fetchMyReview(productSlug) });
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const withdraw = useMutation({
    mutationFn: (reviewId: string) => deleteReview(productSlug, reviewId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      setIsConfirmingWithdraw(false);
    },
  });

  if (isPending) return null;
  if (isError) {
    return (
      <p role="alert" className="text-small text-destructive">
        Couldn&apos;t load your review. Please refresh the page.
      </p>
    );
  }

  if (!myReview || isEditing) {
    return (
      <ReviewFormFields
        productSlug={productSlug}
        existing={isEditing ? myReview : null}
        onSaved={(review) => {
          queryClient.setQueryData(queryKey, review);
          setIsEditing(false);
        }}
        onConflict={() => {
          setIsEditing(false);
          void queryClient.invalidateQueries({ queryKey });
        }}
        onCancel={isEditing ? () => setIsEditing(false) : undefined}
      />
    );
  }

  if (myReview.status !== "Pending") {
    return (
      <p role="status" className="text-small text-charcoal">
        {statusNotes[myReview.status]}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-charcoal/10 p-4">
      <p role="status" className="text-small font-medium text-charcoal">
        Thanks! Your review is pending approval.
      </p>
      {isConfirmingWithdraw ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-small text-charcoal">Withdraw your review? This can&apos;t be undone.</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(myReview.id)}
          >
            Yes, withdraw
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsConfirmingWithdraw(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit review
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsConfirmingWithdraw(true)}>
            Withdraw
          </Button>
        </div>
      )}
      {withdraw.isError && (
        <p role="alert" className="mt-2 text-small text-destructive">
          Couldn&apos;t withdraw your review. Please try again.
        </p>
      )}
    </div>
  );
}

interface ReviewFormFieldsProps {
  productSlug: string;
  existing: OwnReview | null | undefined;
  onSaved: (review: OwnReview) => void;
  /** 409: the customer already has a review, or it's no longer Pending. */
  onConflict: () => void;
  onCancel?: () => void;
}

function ReviewFormFields({ productSlug, existing, onSaved, onConflict, onCancel }: ReviewFormFieldsProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewInputSchema),
    defaultValues: existing
      ? { rating: existing.rating, title: existing.title, body: existing.body }
      : { title: "", body: "" },
  });
  // Controlled, not register(): RHF compares a radio's string value ("4")
  // with the numeric default (4) strictly, so an edited review would open
  // with no star selected.
  const { field: ratingField } = useController({ name: "rating", control });
  const selectedRating: number = ratingField.value ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = existing ? await patchReview(productSlug, existing.id, values) : await postReview(productSlug, values);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ReviewApiError && error.status === 409) {
        onConflict();
        return;
      }
      if (error instanceof ReviewApiError && error.status === 400) {
        let hasFieldError = false;
        for (const field of reviewFields) {
          const message = error.fieldErrors[field]?.[0];
          if (message) {
            setError(field, { message });
            hasFieldError = true;
          }
        }
        if (hasFieldError) return;
      }
      setError("root", {
        message: error instanceof ReviewApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <h3 className="text-h4 font-heading text-charcoal">{existing ? "Edit your review" : "Write a review"}</h3>

      <fieldset aria-describedby={errors.rating ? "review-rating-error" : undefined}>
        <legend className="text-small font-medium text-charcoal">Your rating</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="cursor-pointer">
              <input
                type="radio"
                name={ratingField.name}
                value={star}
                checked={selectedRating === star}
                onChange={() => ratingField.onChange(star)}
                onBlur={ratingField.onBlur}
                className="peer sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 rounded-sm text-gold peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  selectedRating >= star ? "fill-current" : "fill-none text-charcoal/30",
                )}
              />
              <span className="sr-only">{star === 1 ? "1 star" : `${star} stars`}</span>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id="review-rating-error" className="mt-1 text-small text-destructive">
            {errors.rating.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor="review-title">Title</Label>
        <Input
          id="review-title"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "review-title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="review-title-error" className="text-small text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="review-body">Your review</Label>
        <textarea
          id="review-body"
          rows={5}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "review-body-error" : undefined}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          {...register("body")}
        />
        {errors.body && (
          <p id="review-body-error" className="text-small text-destructive">
            {errors.body.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {existing ? "Save changes" : "Submit review"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Render the form in `ReviewsSection`**

In `src/components/storefront/product/reviews/reviews-section.tsx`, add the import after `import { RatingSummary } from "./rating-summary";`:

```tsx
import { ReviewForm } from "./review-form";
```

and add the form as the last child of the `<section>`, after the `{summary && (<ReviewList ... />)}` block:

```tsx
      <ReviewForm productSlug={productSlug} />
```

- [ ] **Step 5: Mock the session in the section test**

`ReviewsSection` now calls `useSession`. In `tests/unit/reviews-section.test.tsx`, add this line directly after the `vitest` import:

```ts
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/review-form.test.tsx tests/unit/reviews-section.test.tsx`
Expected: PASS (both files).

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/storefront/product/reviews/review-form.tsx src/components/storefront/product/reviews/reviews-section.tsx tests/unit/review-form.test.tsx tests/unit/reviews-section.test.tsx
git commit -m "feat: add review submission form with edit and withdraw" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dev publish path and seed demo reviews

**Files:**
- Modify: `src/services/review.service.ts` (append `advanceReviewToPublished`)
- Create: `scripts/publish-review.ts`
- Modify: `package.json` (`scripts`)
- Modify: `prisma/seed.ts` (imports; a demo-review block before the final `console.log`)
- Test: `tests/unit/review-lifecycle.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `changeReviewStatus`, `submitReview` (Tasks 4–5).
- Produces: `advanceReviewToPublished(reviewId: string): Promise<Review>`, used by the script, the seed and the Task 11 e2e test.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/review-lifecycle.test.ts`, and add `advanceReviewToPublished` to its import from `@/services/review.service`:

```ts
describe("advanceReviewToPublished", () => {
  it("walks a Pending review through Approved to Published", async () => {
    const review = await makePendingReview(5);

    const published = await advanceReviewToPublished(review.id);

    expect(published.status).toBe("Published");
    expect((await getRatingSummary(review.productId))?.reviewCount).toBe(1);
  });

  it("republishes an Archived review and leaves a Published one as it is", async () => {
    const review = await makePendingReview();
    await advanceReviewToPublished(review.id);
    await changeReviewStatus(review.id, "Archived");

    expect((await advanceReviewToPublished(review.id)).status).toBe("Published");
    expect((await advanceReviewToPublished(review.id)).status).toBe("Published");
  });

  it("refuses a Rejected review", async () => {
    const review = await makePendingReview();
    await changeReviewStatus(review.id, "Rejected");

    await expect(advanceReviewToPublished(review.id)).rejects.toBeInstanceOf(InvalidReviewTransitionError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/review-lifecycle.test.ts`
Expected: FAIL, `advanceReviewToPublished is not a function`.

- [ ] **Step 3: Append `advanceReviewToPublished` to `src/services/review.service.ts`**

```ts
// ---------------------------------------------------------------------------
// Dev tooling
// ---------------------------------------------------------------------------

/**
 * Walks a review to Published through the real workflow (Pending → Approved →
 * Published, or Archived → Published), so the rating summary is maintained
 * exactly as in production. For the seed, the review:publish script and e2e
 * tests only. In production, reviews are published from the moderation
 * console (STORY-045).
 */
export async function advanceReviewToPublished(reviewId: string) {
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review) throw new ReviewNotFoundError();
  if (review.status === "Published") return review;

  let status = review.status;
  if (status === "Pending") {
    status = (await changeReviewStatus(reviewId, "Approved")).status;
  }
  if (status === "Approved" || status === "Archived") {
    return changeReviewStatus(reviewId, "Published");
  }
  throw new InvalidReviewTransitionError(status, "Published");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/review-lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `scripts/publish-review.ts`**

```ts
/**
 * Dev-only: publishes a review without the moderation console (STORY-045).
 *   npm run review:publish -- <reviewId>
 * Goes through review.service.ts's real workflow, so the product's rating
 * summary is recalculated exactly as it will be in production.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { advanceReviewToPublished } from "../src/services/review.service";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "review:publish is a local development tool. In production, reviews are published from the moderation console (STORY-045).",
    );
  }
  const reviewId = process.argv[2];
  if (!reviewId) throw new Error("Usage: npm run review:publish -- <reviewId>");

  const review = await advanceReviewToPublished(reviewId);
  console.log(`Review ${review.id} is now ${review.status}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Add the npm script**

In `package.json` `"scripts"`, after `"test:e2e": "playwright test"`, add a comma and:

```json
    "review:publish": "tsx scripts/publish-review.ts"
```

- [ ] **Step 7: Add demo reviews to `prisma/seed.ts`**

Add after the existing repository imports at the top:

```ts
import { advanceReviewToPublished, submitReview } from "../src/services/review.service";
```

Insert before the final `console.log("Seed complete:", { ... })` in `main()`:

```ts
  // Demo reviews (STORY-015), published through the real review workflow so
  // ProductRatingSummary is maintained exactly as in production. Kept off
  // the curry powder: tests/e2e/product-detail.spec.ts expects that PDP to
  // show the empty "No reviews yet." state.
  const nadeesha = await prisma.user.create({ data: { email: "nadeesha.demo@oristor.test", name: "Nadeesha P." } });
  const kamal = await prisma.user.create({ data: { email: "kamal.demo@oristor.test", name: "Kamal R." } });
  const demoReviews = [
    {
      userId: nadeesha.id,
      slug: chilliPowder.slug,
      input: { rating: 5, title: "Proper heat, great colour", body: "Bright red, fragrant and properly hot. Makes a fantastic seeni sambol." },
    },
    {
      userId: kamal.id,
      slug: chilliPowder.slug,
      input: { rating: 4, title: "Hot but balanced", body: "Good everyday chilli powder. A little goes a long way in a fish curry." },
    },
    {
      userId: nadeesha.id,
      slug: giftSet.slug,
      input: { rating: 5, title: "A lovely gift", body: "Beautifully packed and the spices were very fresh. My family loved it." },
    },
  ];
  for (const demo of demoReviews) {
    const review = await submitReview(demo.userId, demo.slug, demo.input);
    await advanceReviewToPublished(review.id);
  }
```

- [ ] **Step 8: Verify the seed and the script**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx prisma db seed; echo "seed exit=$?"
npm run review:publish -- does-not-exist; echo "exit=$?"
NODE_ENV=production npm run review:publish -- anything; echo "exit=$?"
```

Expected: `seed exit=0`. The first script run prints `Review not found` and `exit=1`. The production run prints the "local development tool" message and `exit=1`.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/review.service.ts scripts/publish-review.ts package.json prisma/seed.ts tests/unit/review-lifecycle.test.ts
git commit -m "feat: add dev review publish script and seed demo reviews" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end tests

**Files:**
- Create: `tests/e2e/helpers/auth.ts`
- Modify: `tests/e2e/wishlist.spec.ts` (use the shared helper; delete its local `signInAs` and the `encode` import)
- Create: `tests/e2e/product-reviews.spec.ts`

**Interfaces:**
- Consumes: `submitReview`, `advanceReviewToPublished` (Tasks 5, 10); the PDP UI (Tasks 8–9); the compare page (STORY-014).
- Produces: `signInAs(page: Page, userId: string): Promise<void>` in `tests/e2e/helpers/auth.ts`.

- [ ] **Step 1: Extract the shared sign-in helper**

Create `tests/e2e/helpers/auth.ts`:

```ts
import type { Page } from "@playwright/test";
import { encode } from "next-auth/jwt";

/** Signs the browser in as `userId` by setting an Auth.js session cookie. */
export async function signInAs(page: Page, userId: string): Promise<void> {
  const token = await encode({
    token: { sub: userId },
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
  });
  await page.context().addCookies([{ name: "authjs.session-token", value: token, domain: "localhost", path: "/" }]);
}
```

In `tests/e2e/wishlist.spec.ts`, delete the `import { encode } from "next-auth/jwt";` line and the whole local `async function signInAs(...) { ... }`, then add:

```ts
import { signInAs } from "./helpers/auth";
```

- [ ] **Step 2: Write the e2e spec**

Create `tests/e2e/product-reviews.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { advanceReviewToPublished, submitReview } from "@/services/review.service";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-REVIEW-";
const EMAIL_DOMAIN = "@e2e-review.test";
const reviewBody = "Plenty of flavour and a clean, bright heat.";

async function seedProduct(n: number, name: string) {
  const product = await createProduct({ sku: `${SKU_PREFIX}${n}`, slug: `e2e-review-${n}`, name, status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
  return product;
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

async function seedPublishedReview(productSlug: string, userId: string, rating: number, title: string) {
  const review = await submitReview(userId, productSlug, { rating, title, body: reviewBody });
  await advanceReviewToPublished(review.id);
}

test.describe("Product reviews", () => {
  // Both tests clean up the same SKU/email prefixes in beforeEach.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Reviews and rating summaries cascade with their product and user.
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted review stays private until it is published", async ({ page }) => {
    const product = await seedProduct(1, "E2E Review Curry");
    const user = await seedUser("writer", "Asha W.");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await page.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await page.getByLabel("Title").fill("Rich and aromatic");
    await page.getByLabel("Your review").fill("Toasted notes come through nicely in a dhal.");
    await page.getByRole("button", { name: "Submit review" }).click();

    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.reload();
    const reviews = page.locator('section[aria-labelledby="reviews-heading"]');
    await expect(reviews.getByText("No reviews yet.")).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Rich and aromatic" })).toHaveCount(0);
  });

  test("published reviews show on the product page and in compare", async ({ page }) => {
    const reviewed = await seedProduct(2, "E2E Reviewed Chilli");
    const other = await seedProduct(3, "E2E Unreviewed Pepper");
    await seedPublishedReview(reviewed.slug, (await seedUser("a", "Nimal S.")).id, 5, "Fiery and fresh");
    await seedPublishedReview(reviewed.slug, (await seedUser("b", "Ruwani D.")).id, 4, "Good everyday chilli");

    await page.goto(`/products/${reviewed.slug}`);
    const reviews = page.locator('section[aria-labelledby="reviews-heading"]');
    await expect(reviews.getByText("Based on 2 reviews")).toBeVisible();
    await expect(reviews.getByRole("img", { name: "4.5 out of 5 stars" })).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Fiery and fresh" })).toBeVisible();
    await expect(reviews.getByRole("heading", { name: "Good everyday chilli" })).toBeVisible();

    await reviews.getByRole("button", { name: "Show 5-star reviews (1)" }).click();
    await expect(reviews.getByRole("heading", { name: "Good everyday chilli" })).toHaveCount(0);
    await expect(reviews.getByRole("heading", { name: "Fiery and fresh" })).toBeVisible();

    await page.goto(`/products/compare?ids=${reviewed.id},${other.id}`);
    await expect(page.getByText("4.5 (2)")).toBeVisible();
  });

  test("the reviews section has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(4, "E2E Accessible Turmeric");
    await seedPublishedReview(product.slug, (await seedUser("c", "Dilani K.")).id, 5, "Golden and earthy");
    await signInAs(page, (await seedUser("d", "Sunil J.")).id);

    await page.goto(`/products/${product.slug}`);
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="reviews-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 3: Prepare a fresh local environment**

Follow `docs/architecture-decisions.md` and the Global Constraints:

```bash
# Restart the DB (kill the process listening on 51214 first if running), wait ~20s, then:
npx prisma dev --detach --db-port 51214 --shadow-db-port 51215
npx prisma db push
npx prisma db execute --file tests/unit/truncate-all.sql
npx prisma db seed; echo "seed exit=$?"
```

Then start a **fresh** `npm run dev` (a dev server that outlived a DB restart keeps dead connections).

- [ ] **Step 4: Run the new spec plus the specs it can affect**

Run: `npx playwright test tests/e2e/product-reviews.spec.ts tests/e2e/product-detail.spec.ts tests/e2e/product-compare.spec.ts tests/e2e/wishlist.spec.ts --workers=1`
Expected: all pass.

If "published reviews show on the product page" fails because the PDP shows "No reviews yet." even though the reviews exist, the startup registration isn't reaching the page. Check the dev-server log for a `register` error first, then confirm that `globalThis.__oristorProductDetailProviders` is being set (Task 6, Step 3). Don't work around it by importing review code into `product.service.ts`. That breaks the decoupling the extension point exists for.

If a run fails with `ConnectionClosed`, `Server has closed the connection` or `P1001`, that's the documented PGlite limitation: restart per Step 3 and re-run only the failing spec.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/helpers/auth.ts tests/e2e/wishlist.spec.ts tests/e2e/product-reviews.spec.ts
git commit -m "test: add Playwright e2e coverage for product reviews" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Documentation and story status

**Files:**
- Modify: `docs/architecture-decisions.md` (append an entry)
- Modify: `docs/stories/03-product-platform/STORY-015-product-reviews-ratings.md`
- Modify: `docs/stories/README.md` (the STORY-015 row)
- Modify: `src/components/storefront/product/sort-select.tsx` (lines 15-17 comment)
- Modify: `src/services/product.service.ts` (the comment at lines 152-153)

**Interfaces:** none. This is the final ship step.

- [ ] **Step 1: Append to `docs/architecture-decisions.md`**

```markdown

---

## 2026-09-23 — STORY-015 Product Reviews & Ratings

**Status lifecycle.** `Review.status` is one of `Pending`, `Approved`,
`Published`, `Rejected`, `Archived`. Allowed moves: Pending→Approved,
Pending→Rejected, Approved→Published, Approved→Rejected,
Published→Archived, Archived→Published. `Rejected` is terminal for now.
**`changeReviewStatus()` in `review.service.ts` is the only way a status
changes.** The STORY-045 moderation console must call it (passing
`{ moderatorId, note }` to fill the reserved `reviewedById`/`reviewedAt`/
`moderatorNote` columns) and must not update `Review.status` directly.

**Stored rating summary.** `ProductRatingSummary` (average, count, and
`count1`–`count5`) is rebuilt inside the same transaction as any status
change into or out of `Published` (`updateStatusAndRecalculate` in
`review.repository.ts`, the only transaction in the codebase so far,
because services can't import Prisma). No row means no Published reviews,
and callers show "No reviews yet", never a 0.0 rating. Future listing-card
ratings and sort-by-rating should read this table.

**PDP wiring and the provider registry.** `registerReviewProviders()` runs
from `src/instrumentation.ts` at server startup (Node runtime only).
`product-detail-extensions.ts` now keeps its providers on `globalThis`,
because Next.js bundles `instrumentation.ts` separately from route code and
module-scoped state wasn't shared between the two. STORY-016 (Q&A) and
Epic 04 (recipes) should register their providers the same way.

**Verified purchase.** `purchase-verification.ts` defaults to `false`
until STORY-028 (Order Management) calls `registerPurchaseVerifier()`. The
flag is captured once, at submission; purchases made after a review was
written don't update it (known gap).

**Withdraw = delete.** Withdrawing a Pending review deletes it, freeing the
`(productId, userId)` unique slot, so the status enum stays exactly the
blueprint's five values. The API uses `DELETE` for withdraw (the story
listed it under `PATCH`).

**Review photos deferred.** `ReviewImage` exists in the schema but nothing
writes it. Upload waits on a storage provider (blueprint Section 10, open)
and should reuse the Media Library pipeline (STORY-041).

**Publishing reviews without the moderation console.** Locally:
`npm run review:publish -- <reviewId>` (refuses to run with
`NODE_ENV=production`). The seed publishes three demo reviews (chilli
powder and gift set, not curry powder, whose PDP e2e test expects the empty
state) through the same `advanceReviewToPublished()` helper.
```

- [ ] **Step 2: Update the story file**

In `docs/stories/03-product-platform/STORY-015-product-reviews-ratings.md`:

- Change `**Status:** Draft` to `**Status:** Done`.
- Check (`- [x]`) every acceptance criterion and task line, **except** these two, which get a note instead of a check:
  - The first acceptance criterion: replace it with
    `- [x] A logged-in customer can submit a review on a product: star rating (1–5, required), title, body text _(optional photo(s) deferred: no storage provider yet, see docs/architecture-decisions.md 2026-09-23; ReviewImage table exists)_`
  - The frontend task line `Build the review submission form (star rating input, title, body, optional photo upload) ...`: replace it with
    `  - [x] Build the review submission form (star rating input, title, body) with a "your review is pending approval" confirmation state _(photo upload deferred, see above)_`
- On the `PATCH /api/products/[slug]/reviews/[reviewId]` task line, append ` _(withdraw implemented as DELETE on the same path)_`.

Before checking each box, confirm the implementation actually satisfies it (for example, "recalculated whenever a review transitions into or out of Published" → `changeReviewStatus` + `updateStatusAndRecalculate`).

- [ ] **Step 3: Update `docs/stories/README.md`**

Change `| STORY-015 | Product Reviews & Ratings | Draft |` to `| STORY-015 | Product Reviews & Ratings | Done |`. (Open the file first to copy the row's exact text if the title differs.)

- [ ] **Step 4: Correct two stale code comments**

In `src/components/storefront/product/sort-select.tsx`, replace the comment above `const disabledSorts` with:

```ts
// No sales data yet (Commerce Platform epic) for "best-selling". "rating"
// could now read ProductRatingSummary (STORY-015), but the listing query
// doesn't support it yet — both stay disabled until they're built.
```

In `src/services/product.service.ts`, replace the two-line comment beginning `// "best-selling" and "rating" fall back to "newest" ordering` with:

```ts
    // "best-selling" and "rating" fall back to "newest" ordering: there's no
    // Order model yet, and sorting by ProductRatingSummary (STORY-015) isn't
```

keeping the comment's remaining line(s) unchanged. Read the surrounding lines first so the sentence still reads correctly.

- [ ] **Step 5: Final verification**

```bash
npx tsc --noEmit && npm run lint
npx vitest run tests/unit/review-*.test.ts tests/unit/review-*.test.tsx tests/unit/rating-summary.test.tsx tests/unit/reviews-section.test.tsx tests/unit/product-detail-*.test.ts tests/unit/filter-controls.test.tsx
```

Expected: no type or lint errors; all listed test files pass. (Run the full suite in batches per the Global Constraints if you need it locally; CI runs it on real Postgres.)

- [ ] **Step 6: Commit**

```bash
git add docs/architecture-decisions.md docs/stories/03-product-platform/STORY-015-product-reviews-ratings.md docs/stories/README.md src/components/storefront/product/sort-select.tsx src/services/product.service.ts
git commit -m "docs: mark STORY-015 done; document review lifecycle and rating summary" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Data model → Task 1
  - Validation → Task 2
  - Repository and transactional summary → Task 3
  - Lifecycle and `changeReviewStatus` → Task 4
  - Customer actions, verified-purchase hook, listing → Task 5
  - PDP provider and `instrumentation.ts` → Task 6
  - API routes and error mapping → Task 7
  - `RatingSummary`, `ReviewList`, `ReviewsSection` → Task 8
  - `ReviewForm` → Task 9
  - Dev publish path and seed → Task 10
  - E2E, including the compare rating row and axe → Task 11
  - Documentation → Task 12
- **Deviation from the spec, noted:** the spec names the error-mapping helper `src/lib/api/review-errors.ts`. This plan uses `src/lib/api/review-responses.ts`, because it also builds the 401 and validation responses, not only error mappings.
- **Discovered during planning:** module-scoped provider state in `product-detail-extensions.ts` would not be shared between `instrumentation.ts` and route bundles. Task 6 moves it to `globalThis` and adds a unit test that reproduces the separate-module-instance case. Task 11's e2e test is the end-to-end proof.
- **Type consistency:** `ReviewPageQuery.rating` is `StarRating` on the client and `ReviewListQuery.rating` is `number` on the server; the service accepts the wider type. `OwnReview.status` (`ReviewStatusValue`) mirrors the Prisma enum values. `ReviewPreview = PublicReview` everywhere after Task 6.
