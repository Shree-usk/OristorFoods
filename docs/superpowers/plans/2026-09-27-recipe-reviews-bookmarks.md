# STORY-022 Recipe Reviews & Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add star-rating reviews and save/bookmark actions to `Recipe`, matching STORY-022's acceptance criteria: an authenticated customer can submit one review per recipe (moderated Pending→Approved/Rejected/Hidden), the recipe detail page shows the average rating from Approved reviews only, and any authenticated customer can bookmark/unbookmark a recipe from both the `RecipeCard` grid and the detail page, with a guest (localStorage) bookmark path that merges into the account on login.

**Architecture:** Two independent feature slices, each following this codebase's Service Layer convention (route → service → repository) and reusing an already-shipped precedent's *pattern*, not its code: `RecipeReview` mirrors `review.service.ts`'s moderated-review shape but with `BlogComment`'s simpler 4-state lifecycle (no separate "Approved but not published" step); `RecipeBookmark` mirrors `wishlist.service.ts`'s auth-gated, guest-capable optimistic toggle but as a flat one-row-per-save model (no container table). Both write to `Recipe`'s own `avgRating`/`ratingCount` columns (already present since STORY-017) — no new summary table.

**Tech Stack:** Next.js 16 App Router / Server Components, TypeScript strict, Prisma 7 + `@prisma/adapter-pg`, Zod, React Hook Form, TanStack Query, Zustand (`persist`), NextAuth `auth()`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-recipe-reviews-bookmarks-design.md` (read this first — every model field, function name, route path, and component name below is taken directly from it). Also authoritative: `docs/stories/04-recipes-food-academy/STORY-022-recipe-reviews-bookmarks.md` (acceptance criteria) and `docs/New-instruction-Reviews-1.txt` (folded into the spec already; nothing further to re-derive from it).

## Global Constraints

- **Never call Prisma directly outside a repository.** `recipe-review.repository.ts` and `recipe-bookmark.repository.ts` are the only files that import `@/lib/db`'s `prisma` for these two models. Routes call services; services call repositories.
- **Never trust a client-supplied customer id.** Every mutation resolves the customer from `auth()`'s session server-side (`session.user.id`); no route or service function accepts a `customerId` parameter from a request body.
- **RecipeReview lifecycle is exactly:** `Pending → Approved | Rejected`, `Approved → Hidden`. No other transitions exist. No `title` field, no `isVerifiedPurchase`, no moderator-audit columns (`reviewedById`/`moderatorNote`/`publishedAt`) — these are explicitly out of scope per the spec's decision #1.
- **`RecipeBookmark` is a flat model** (`id`, `recipeId`, `customerId`, `createdAt`) — never introduce a container/list table for it.
- **`Recipe.avgRating`/`ratingCount` recalculation only happens inside `recipe-review.repository.ts`'s `updateReviewStatusAndRecalculate`**, transactionally, row-locked via `SELECT ... FOR UPDATE`, counting `Approved`-only reviews. Zero approved reviews → `avgRating: null`, `ratingCount: 0` (never `0` for the average).
- **`DATABASE_POOL_MAX=1` is set in every worktree's `.env`** (PGlite supports one connection only) — see the note on Task 3's concurrency test for what this means for testing the row lock.
- **Migration workflow:** use `npx prisma db push` for iteration; produce the real committed migration via the offline `migrate diff --from-schema/--to-schema --script` recipe in Task 1, never `migrate dev` (see `docs/architecture-decisions.md`, STORY-001 and STORY-012 entries).
- **No placeholder/fake data left inconsistent with a new invariant.** Task 8 must reconcile `prisma/seed-recipes.ts`'s existing hardcoded `avgRating`/`ratingCount` values (seeded with zero backing `RecipeReview` rows) now that those columns are a computed, review-backed invariant.
- **Every new route follows the existing `auth()` → 401-if-absent → service-call → typed-error-to-HTTP-status convention** (`src/app/api/products/[slug]/reviews/**`, `src/app/api/wishlist/**`) using the shared `unauthorizedResponse()`/`validationErrorResponse()` helpers from `src/lib/api/responses.ts`.
- **Run `npx tsc --noEmit -p tsconfig.json` and `npm run lint` before committing each task.** Run `npm run test` (with `npx prisma dev` running) before moving to the next task.

## Review Focus

- **A recipe with zero Approved reviews must render "no reviews yet," not `0.0 stars.`** `RecipeCard`/`RecipeDetail`'s existing `avgRating: number | null` convention (STORY-017) already encodes this — a task that writes `avgRating: 0` for the empty case instead of `null` is a bug. Task 3's repository test and Task 10's component must both exercise this.
- **Editing or withdrawing a review that a moderator just approved/rejected must not silently corrupt state.** The conditional `updateMany`-then-read pattern (never a plain `update`) must be exercised by a test that pre-changes the review's status between "read" and "write" and confirms a `RecipeReviewNotEditableError`, not a silent overwrite or a thrown Prisma error. Task 4.
- **A second `submitReview` call for the same (recipe, customer) pair must never create a second row or leak a raw Postgres constraint-violation error to the client.** The `@@unique([recipeId, customerId])` + `P2002`-catch path must be tested at the repository, service, and route layers, not just one. Tasks 3, 4, 5.
- **A bookmark toggle (or the merge endpoint) for a Draft/Archived/nonexistent recipe slug must not create an orphaned or policy-violating row.** `addBookmark`/`mergeGuestBookmarks` must reject a non-Published recipe the same way `mergeGuestWishlist` rejects a non-Published product. Task 6.
- **An unauthenticated request to any of the 8 authenticated endpoints (POST/PATCH/DELETE reviews and GET .../mine; POST/DELETE bookmark, GET bookmarks, POST merge — everything except the public `GET /api/recipes/[slug]/reviews` list) must return 401 before the repository layer is ever touched** — not a 500, not a silent success. Every route test in Tasks 5 and 7 must include this case per endpoint.

---

## Task 1: Database schema, migration, and repository/service scaffolding check

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_recipe_reviews_bookmarks/migration.sql`

**Interfaces:**
- Produces: `RecipeReviewStatus` enum (`Pending`, `Approved`, `Rejected`, `Hidden`); `RecipeReview` model (`id`, `recipeId`, `customerId`, `rating: Int`, `reviewText: String?`, `status: RecipeReviewStatus @default(Pending)`, `createdAt`, `updatedAt`, `@@unique([recipeId, customerId])`, `@@index([recipeId, status])`); `RecipeBookmark` model (`id`, `recipeId`, `customerId`, `createdAt`, `@@unique([recipeId, customerId])`, `@@index([customerId])`). Both later tasks' repositories query these directly by name (`prisma.recipeReview`, `prisma.recipeBookmark`).

- [ ] **Step 1: Add the two models and their enum to `prisma/schema.prisma`**

Add near the existing `Recipe`/`Review` models (match this codebase's existing formatting exactly):

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

No named `@relation` is needed on either FK to `User` — each model has only one relation to `User`, unlike `Review`'s `ReviewAuthor`/`ReviewModerator` pair.

Add the two inverse relations to the existing `Recipe` model, next to its other reverse relations (e.g. near `ingredients`/`steps`):

```prisma
  recipeReviews   RecipeReview[]
  recipeBookmarks RecipeBookmark[]
```

And to the existing `User` model, next to its other reverse relations (e.g. near `reviews`/`wishlist`):

```prisma
  recipeReviews   RecipeReview[]
  recipeBookmarks RecipeBookmark[]
```

- [ ] **Step 2: Push the schema change for local iteration and confirm the generated client compiles**

```bash
npx prisma db push
npx prisma generate
npx tsc --noEmit -p tsconfig.json
```

Expected: `db push` reports the two new tables created; `tsc` has no new errors (existing errors, if any, are pre-existing and out of scope).

- [ ] **Step 3: Generate the real migration file via the offline schema-diff recipe (never `migrate dev`)**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_recipe_reviews_bookmarks"
npx prisma migrate diff --from-schema /tmp/schema-before.prisma --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_add_recipe_reviews_bookmarks/migration.sql"
rm /tmp/schema-before.prisma
```

Expected `migration.sql` content: `CREATE TYPE "RecipeReviewStatus" ...`, `CREATE TABLE "RecipeReview" ...`, `CREATE TABLE "RecipeBookmark" ...`, their unique indexes, the `(recipeId, status)` and `(customerId)` indexes, and the two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statements — nothing else (both models are fully expressible in Prisma's schema language, unlike STORY-012's trigram indexes, so no manual SQL append is needed here).

- [ ] **Step 4: Apply the migration to a fresh, isolated local server (never `migrate dev`)**

Stop any running `prisma dev` process:

```bash
netstat -ano | grep 51214 | grep LISTEN
# note the PID in the last column, then:
taskkill //F //PID <pid>
```

Reset only this project's `default`-named server data (never the whole `Data` directory — it's shared with another project on this machine):

```bash
rm -rf "$LOCALAPPDATA/prisma-dev-nodejs/Data/default"
rm -rf "$LOCALAPPDATA/prisma-dev-nodejs/Data/durable-streams/default"
```

Start a fresh server in the background and wait for it to report ready:

```bash
nohup npx prisma dev --db-port 51214 --shadow-db-port 51215 > /tmp/prisma-dev-migration.log 2>&1 &
disown
sleep 12 && tail -15 /tmp/prisma-dev-migration.log
```

Apply in three steps against the fresh, empty database:

```bash
npx prisma db execute --file prisma/create_migrations_table.sql
npx prisma db execute --file "prisma/migrations/<the folder from Step 3>/migration.sql"
npx prisma migrate resolve --applied "<the folder name from Step 3>"
```

- [ ] **Step 5: Verify and re-seed**

```bash
npx prisma migrate status
```
Expected: `Database schema is up to date!` with the new migration listed.

```bash
npx prisma db push
```
Expected: `The database is already in sync with the Prisma schema.` (confirms the hand-applied SQL matches the schema exactly).

```bash
npx tsx --env-file=.env prisma/seed.ts
```
Expected: the same `Seed complete: {...}` output the project's seed script normally produces (this re-seeds the now-empty fresh database with everything up through STORY-021; Task 8 below adds this story's own seed data on top, later).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add RecipeReview and RecipeBookmark models"
```

---

## Task 2: Shared types and Zod validation schemas

**Files:**
- Create: `src/types/recipe-review.ts`
- Create: `src/validation/recipe-review.schema.ts`
- Create: `src/validation/recipe-bookmark.schema.ts`
- Test: `tests/unit/recipe-review-schema.test.ts`

**Interfaces:**
- Consumes: nothing (leaf files — no server-only imports, per `types/review.ts`'s existing convention, since client components import from `recipe-review.ts` too).
- Produces: `PublicRecipeReview`, `RecipeReviewPage`, `OwnRecipeReview`, `RecipeReviewStatusValue`, `RECIPE_REVIEW_SORTS`, `RecipeReviewSort`, `RECIPE_REVIEW_PAGE_SIZE`, `RecipeReviewPageQuery` (all from `types/recipe-review.ts`); `recipeReviewInputSchema`, `RecipeReviewInput`, `recipeReviewListQuerySchema`, `RecipeReviewListQuery` (from `validation/recipe-review.schema.ts`); `mergeRecipeBookmarksSchema`, `MergeRecipeBookmarksInput` (from `validation/recipe-bookmark.schema.ts`). Tasks 3–11 all import from these three files.

- [ ] **Step 1: Write `src/types/recipe-review.ts`**

```typescript
/**
 * Recipe review types and constants shared by server and client code
 * (STORY-022). Keep this file free of server-only imports (Prisma,
 * services): client components import from it directly.
 */

/** A Approved review as returned by the public API and shown on the recipe detail page. */
export interface PublicRecipeReview {
  id: string;
  authorName: string;
  rating: number;
  reviewText: string | null;
  /** ISO 8601 string. */
  createdAt: string;
}

export interface RecipeReviewPage {
  items: PublicRecipeReview[];
  total: number;
  page: number;
  pageSize: number;
}

export type RecipeReviewStatusValue = "Pending" | "Approved" | "Rejected" | "Hidden";

/** The signed-in customer's own review, in any status. */
export interface OwnRecipeReview {
  id: string;
  rating: number;
  reviewText: string | null;
  status: RecipeReviewStatusValue;
}

export const RECIPE_REVIEW_SORTS = ["recent", "highest", "lowest"] as const;
export type RecipeReviewSort = (typeof RECIPE_REVIEW_SORTS)[number];

export const RECIPE_REVIEW_PAGE_SIZE = 10;

export interface RecipeReviewPageQuery {
  page: number;
  pageSize: number;
  sort: RecipeReviewSort;
}
```

- [ ] **Step 2: Write `src/validation/recipe-review.schema.ts`**

```typescript
import { z } from "zod";

import { RECIPE_REVIEW_PAGE_SIZE, RECIPE_REVIEW_SORTS } from "@/types/recipe-review";

const RATING_MESSAGE = "Please choose a star rating";

/**
 * Shared by RecipeReviewForm (client) and the POST/PATCH review routes
 * (server). `reviewText` transforms an empty string to `undefined`: React
 * Hook Form submits `""` for an untouched textarea, and without this
 * transform an empty review would fail to round-trip as `null` the way the
 * nullable `RecipeReview.reviewText` column expects (the same empty-string-
 * vs-undefined gotcha fixed in STORY-021's blog comment form).
 */
export const recipeReviewInputSchema = z.object({
  rating: z.number({ error: RATING_MESSAGE }).int(RATING_MESSAGE).min(1, RATING_MESSAGE).max(5, RATING_MESSAGE),
  reviewText: z
    .string()
    .trim()
    .max(2000, "Review must be 2,000 characters or fewer")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type RecipeReviewInput = z.infer<typeof recipeReviewInputSchema>;

export const recipeReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(RECIPE_REVIEW_PAGE_SIZE),
  sort: z.enum(RECIPE_REVIEW_SORTS).default("recent"),
});

export type RecipeReviewListQuery = z.infer<typeof recipeReviewListQuerySchema>;
```

- [ ] **Step 3: Write `src/validation/recipe-bookmark.schema.ts`**

```typescript
import { z } from "zod";

/** Same 200-id cap `wishlist.schema.ts`'s mergeWishlistSchema applies, for the same reason: a small, bounded guest-store payload, not a listing endpoint. */
export const mergeRecipeBookmarksSchema = z.object({
  recipeIds: z.array(z.string().min(1)).max(200),
});

export type MergeRecipeBookmarksInput = z.infer<typeof mergeRecipeBookmarksSchema>;
```

- [ ] **Step 4: Write the failing test for the empty-string transform**

```typescript
// tests/unit/recipe-review-schema.test.ts
import { describe, expect, it } from "vitest";

import { recipeReviewInputSchema } from "@/validation/recipe-review.schema";

describe("recipeReviewInputSchema", () => {
  it("accepts a rating with no review text", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 4 });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reviewText).toBeUndefined();
  });

  it("treats an empty-string reviewText the same as omitted (RHF submits \"\" for an untouched textarea)", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 4, reviewText: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.reviewText).toBeUndefined();
  });

  it("rejects a rating outside 1-5", () => {
    expect(recipeReviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(recipeReviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
  });

  it("rejects review text over 2000 characters", () => {
    const parsed = recipeReviewInputSchema.safeParse({ rating: 5, reviewText: "a".repeat(2001) });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npm run test -- recipe-review-schema`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/types/recipe-review.ts src/validation/recipe-review.schema.ts src/validation/recipe-bookmark.schema.ts tests/unit/recipe-review-schema.test.ts
git commit -m "feat: add recipe review/bookmark types and validation schemas"
```

---

## Task 3: `recipe-review.errors.ts` and `recipe-review.repository.ts`

**Files:**
- Create: `src/services/recipe-review.errors.ts`
- Create: `src/repositories/recipe-review.repository.ts`
- Test: `tests/unit/recipe-review-repository.test.ts`

**Interfaces:**
- Consumes: `Recipe`/`RecipeReview`/`RecipeReviewStatus` from `@/generated/prisma/client` (Task 1); `RecipeReviewSort` from `@/types/recipe-review` (Task 2).
- Produces: error classes `RecipeReviewServiceError`, `InvalidRecipeReviewInputError`, `RecipeNotFoundError`, `RecipeReviewNotFoundError`, `RecipeReviewForbiddenError`, `DuplicateRecipeReviewError`, `RecipeReviewNotEditableError`, `InvalidRecipeReviewTransitionError` (each with a `.code: RecipeReviewErrorCode`); repository functions `createReview`, `findReviewById`, `findReviewByRecipeAndCustomer`, `updateOwnPendingReviewContent`, `deleteOwnPendingReview`, `listApprovedReviews`, `updateReviewStatusAndRecalculate`, and type `RecipeReviewWithAuthor`. Task 4's service imports all of these.

- [ ] **Step 1: Write `src/services/recipe-review.errors.ts`**

```typescript
/**
 * Typed errors thrown by recipe-review.service.ts. Route handlers map `code`
 * to an HTTP status in one place (src/lib/api/recipe-review-responses.ts)
 * instead of matching on message strings.
 */
export type RecipeReviewErrorCode =
  | "invalid_input"
  | "recipe_not_found"
  | "review_not_found"
  | "forbidden"
  | "duplicate"
  | "not_editable"
  | "invalid_transition";

export class RecipeReviewServiceError extends Error {
  readonly code: RecipeReviewErrorCode;

  constructor(code: RecipeReviewErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidRecipeReviewInputError extends RecipeReviewServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class RecipeNotFoundError extends RecipeReviewServiceError {
  constructor() {
    super("recipe_not_found", "Recipe not found");
  }
}

export class RecipeReviewNotFoundError extends RecipeReviewServiceError {
  constructor() {
    super("review_not_found", "Review not found");
  }
}

export class RecipeReviewForbiddenError extends RecipeReviewServiceError {
  constructor() {
    super("forbidden", "You can only change your own review");
  }
}

export class DuplicateRecipeReviewError extends RecipeReviewServiceError {
  constructor() {
    super("duplicate", "You have already reviewed this recipe");
  }
}

export class RecipeReviewNotEditableError extends RecipeReviewServiceError {
  constructor() {
    super("not_editable", "Only reviews that are pending approval can be changed");
  }
}

export class InvalidRecipeReviewTransitionError extends RecipeReviewServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A review can't move from ${from} to ${to}`);
  }
}
```

- [ ] **Step 2: Write `src/repositories/recipe-review.repository.ts`**

```typescript
import type { Prisma, RecipeReviewStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { RecipeReviewSort } from "@/types/recipe-review";

const withAuthorName = { customer: { select: { name: true } } } satisfies Prisma.RecipeReviewInclude;

export type RecipeReviewWithAuthor = Prisma.RecipeReviewGetPayload<{ include: typeof withAuthorName }>;

export interface ApprovedReviewQuery {
  sort: RecipeReviewSort;
  skip: number;
  take: number;
}

// Every sort ends with id, so ties are broken the same way on every request
// and pagination never repeats or skips a review.
const orderBySort: Record<RecipeReviewSort, Prisma.RecipeReviewOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }, { id: "asc" }],
  highest: [{ rating: "desc" }, { createdAt: "desc" }, { id: "asc" }],
  lowest: [{ rating: "asc" }, { createdAt: "desc" }, { id: "asc" }],
};

export function createReview(data: Prisma.RecipeReviewUncheckedCreateInput) {
  return prisma.recipeReview.create({ data });
}

export function findReviewById(id: string) {
  return prisma.recipeReview.findUnique({ where: { id } });
}

export function findReviewByRecipeAndCustomer(recipeId: string, customerId: string) {
  return prisma.recipeReview.findUnique({ where: { recipeId_customerId: { recipeId, customerId } } });
}

/**
 * Writes are conditional on the review still being the caller's own Pending
 * review, so a moderator approving/rejecting it concurrently can't have its
 * content overwritten. Returns `null` when no row matched (already left
 * Pending, or wrong customer) instead of throwing, so the service can tell
 * that apart from a real not-found. Mirrors review.repository.ts's
 * updateOwnPendingReviewContent exactly.
 */
export async function updateOwnPendingReviewContent(
  id: string,
  customerId: string,
  data: { rating: number; reviewText: string | null },
) {
  const { count } = await prisma.recipeReview.updateMany({
    where: { id, customerId, status: "Pending" },
    data,
  });
  if (count === 0) return null;
  return prisma.recipeReview.findUnique({ where: { id } });
}

/** Same conditional guard as updateOwnPendingReviewContent; see its comment. */
export async function deleteOwnPendingReview(id: string, customerId: string): Promise<boolean> {
  const { count } = await prisma.recipeReview.deleteMany({ where: { id, customerId, status: "Pending" } });
  return count > 0;
}

export async function listApprovedReviews(
  recipeId: string,
  query: ApprovedReviewQuery,
): Promise<{ items: RecipeReviewWithAuthor[]; total: number }> {
  const where: Prisma.RecipeReviewWhereInput = { recipeId, status: "Approved" };
  const [items, total] = await Promise.all([
    prisma.recipeReview.findMany({
      where,
      orderBy: orderBySort[query.sort],
      skip: query.skip,
      take: query.take,
      include: withAuthorName,
    }),
    prisma.recipeReview.count({ where }),
  ]);
  return { items, total };
}

/**
 * Changes a review's status and, when `recalculate` is true, rebuilds
 * Recipe.avgRating/ratingCount in the same transaction, so the columns can
 * never disagree with the Approved reviews. recipe-review.service.ts decides
 * whether a recalculation is needed (only when the review enters or leaves
 * Approved). See docs/superpowers/specs/2026-09-27-recipe-reviews-bookmarks-design.md
 * decision #2 for why this writes Recipe's own flat columns directly instead
 * of a separate summary table.
 *
 * Two concurrent transactions recalculating the same recipe would otherwise
 * both read the pre-change aggregate under READ COMMITTED and each overwrite
 * the other's update. `SELECT ... FOR UPDATE` on the recipe row serialises
 * them: the second transaction blocks until the first commits, so its own
 * aggregate sees the first transaction's status change. The status write
 * itself is conditional on `fromStatus` (`updateMany`, not `update`), so a
 * status change that raced ahead of the caller's stale read is detected
 * (`count === 0`) instead of silently overwritten. Identical reasoning to
 * review.repository.ts's updateStatusAndRecalculate.
 */
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

- [ ] **Step 3: Write the repository tests**

```typescript
// tests/unit/recipe-review-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createReview,
  deleteOwnPendingReview,
  findReviewByRecipeAndCustomer,
  findReviewById,
  listApprovedReviews,
  updateOwnPendingReviewContent,
  updateReviewStatusAndRecalculate,
} from "@/repositories/recipe-review.repository";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";

let sequence = 0;

async function makeCategory() {
  sequence += 1;
  return createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-category-${sequence}` });
}

async function makeRecipe() {
  sequence += 1;
  const category = await makeCategory();
  return createRecipe({
    slug: `rr-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
  });
}

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-repo-${sequence}@test.com`, name } });
}

async function makeReview(recipeId: string, rating = 4) {
  const user = await makeUser();
  return createReview({ recipeId, customerId: user.id, rating });
}

afterEach(async () => {
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("createReview / findReviewById / findReviewByRecipeAndCustomer", () => {
  it("creates a Pending review with no review text by default", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 5);

    expect(review.status).toBe("Pending");
    expect(review.reviewText).toBeNull();
    expect(await findReviewById(review.id)).not.toBeNull();
  });

  it("finds a review by (recipeId, customerId)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);

    const found = await findReviewByRecipeAndCustomer(recipe.id, review.customerId);
    expect(found?.id).toBe(review.id);
  });

  it("enforces one review per (recipe, customer) at the database level", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await createReview({ recipeId: recipe.id, customerId: user.id, rating: 4 });

    await expect(createReview({ recipeId: recipe.id, customerId: user.id, rating: 5 })).rejects.toThrow();
  });
});

describe("updateOwnPendingReviewContent / deleteOwnPendingReview", () => {
  it("updates content while still Pending", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 3);

    const updated = await updateOwnPendingReviewContent(review.id, review.customerId, { rating: 5, reviewText: "Great!" });
    expect(updated?.rating).toBe(5);
    expect(updated?.reviewText).toBe("Great!");
  });

  it("returns null when the review is no longer Pending (conditional write, not a silent overwrite)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Approved" } });

    const updated = await updateOwnPendingReviewContent(review.id, review.customerId, { rating: 1, reviewText: null });
    expect(updated).toBeNull();
    expect((await findReviewById(review.id))?.rating).toBe(review.rating); // untouched
  });

  it("returns null when the customer doesn't own the review", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    const other = await makeUser();

    expect(await updateOwnPendingReviewContent(review.id, other.id, { rating: 1, reviewText: null })).toBeNull();
  });

  it("deletes a Pending review and reports true", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);

    expect(await deleteOwnPendingReview(review.id, review.customerId)).toBe(true);
    expect(await findReviewById(review.id)).toBeNull();
  });

  it("does not delete (and reports false) a no-longer-Pending review", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Approved" } });

    expect(await deleteOwnPendingReview(review.id, review.customerId)).toBe(false);
    expect(await findReviewById(review.id)).not.toBeNull();
  });
});

describe("listApprovedReviews", () => {
  it("only returns Approved reviews, sorted and paginated", async () => {
    const recipe = await makeRecipe();
    const pending = await makeReview(recipe.id, 5);
    const approvedLow = await makeReview(recipe.id, 2);
    const approvedHigh = await makeReview(recipe.id, 5);
    await prisma.recipeReview.update({ where: { id: approvedLow.id }, data: { status: "Approved" } });
    await prisma.recipeReview.update({ where: { id: approvedHigh.id }, data: { status: "Approved" } });
    void pending;

    const highest = await listApprovedReviews(recipe.id, { sort: "highest", skip: 0, take: 10 });
    expect(highest.total).toBe(2);
    expect(highest.items.map((r) => r.rating)).toEqual([5, 2]);

    const lowest = await listApprovedReviews(recipe.id, { sort: "lowest", skip: 0, take: 10 });
    expect(lowest.items.map((r) => r.rating)).toEqual([2, 5]);

    const paged = await listApprovedReviews(recipe.id, { sort: "recent", skip: 1, take: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(2);
  });
});

describe("updateReviewStatusAndRecalculate", () => {
  it("Pending -> Approved recalculates avgRating/ratingCount from Approved-only reviews", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);

    const updated = await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);
    expect(updated?.status).toBe("Approved");

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating?.toNumber()).toBe(4);
    expect(refreshed.ratingCount).toBe(1);
  });

  it("Pending -> Rejected does not recalculate (never touches Approved)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);

    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Rejected" }, false);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });

  it("Approved -> Hidden recalculates back down to the zero-approved-reviews case (avgRating null, not 0)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);
    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);

    await updateReviewStatusAndRecalculate(review.id, recipe.id, "Approved", { status: "Hidden" }, true);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });

  it("returns null when fromStatus no longer matches (conditional update, not a silent overwrite)", async () => {
    const recipe = await makeRecipe();
    const review = await makeReview(recipe.id, 4);
    await prisma.recipeReview.update({ where: { id: review.id }, data: { status: "Rejected" } });

    const result = await updateReviewStatusAndRecalculate(review.id, recipe.id, "Pending", { status: "Approved" }, true);
    expect(result).toBeNull();
  });

  it(
    "two overlapping approvals against the same recipe both land — no lost update. " +
      "Note: DATABASE_POOL_MAX=1 (PGlite supports one connection) means these two " +
      "$transaction calls physically serialise at the connection-pool level, not at " +
      "the row lock — this still exercises the correctness property that matters " +
      "(each transaction re-aggregates from the DB rather than incrementing a stale " +
      "in-memory count), which is what a lost update would actually break.",
    async () => {
      const recipe = await makeRecipe();
      const reviewA = await makeReview(recipe.id, 3);
      const reviewB = await makeReview(recipe.id, 5);

      await Promise.all([
        updateReviewStatusAndRecalculate(reviewA.id, recipe.id, "Pending", { status: "Approved" }, true),
        updateReviewStatusAndRecalculate(reviewB.id, recipe.id, "Pending", { status: "Approved" }, true),
      ]);

      const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
      expect(refreshed.ratingCount).toBe(2);
      expect(refreshed.avgRating?.toNumber()).toBe(4);
    },
  );
});
```

- [ ] **Step 4: Run the tests**

Run: `npm run test -- recipe-review-repository`
Expected: PASS (all tests). Ensure `npx prisma dev` is running first.

- [ ] **Step 5: Commit**

```bash
git add src/services/recipe-review.errors.ts src/repositories/recipe-review.repository.ts tests/unit/recipe-review-repository.test.ts
git commit -m "feat: add recipe review repository and typed errors"
```

---

## Task 4: `recipe-review.service.ts`

**Files:**
- Create: `src/services/recipe-review.service.ts`
- Test: `tests/unit/recipe-review-service.test.ts`

**Interfaces:**
- Consumes: `findPublishedRecipeBySlug` from `@/repositories/recipe.repository` (existing, Task 1's `Recipe` relation fields don't change its shape); everything Task 3 produces; `RecipeReviewInput`/`RecipeReviewListQuery` from Task 2.
- Produces: `canTransitionRecipeReview(from, to): boolean`, `changeRecipeReviewStatus(reviewId, nextStatus)`, `submitReview(customerId, recipeSlug, input): Promise<OwnRecipeReview>`, `getMyReview(customerId, recipeSlug): Promise<OwnRecipeReview | null>`, `editOwnPendingReview(customerId, recipeSlug, reviewId, input): Promise<OwnRecipeReview>`, `withdrawOwnPendingReview(customerId, recipeSlug, reviewId): Promise<void>`, `listApprovedReviewsForRecipe(recipeId, query): Promise<RecipeReviewPage>`, `listApprovedReviews(recipeSlug, query): Promise<RecipeReviewPage>`, `advanceRecipeReviewToApproved(reviewId)`. Task 5's routes call all of these except `listApprovedReviewsForRecipe`, which Task 11's detail page calls directly; Task 8's seed script calls `submitReview` and `advanceRecipeReviewToApproved`.

- [ ] **Step 1: Write `src/services/recipe-review.service.ts`**

```typescript
import { Prisma, type RecipeReviewStatus } from "@/generated/prisma/client";
import { findPublishedRecipeBySlug } from "@/repositories/recipe.repository";
import * as recipeReviewRepository from "@/repositories/recipe-review.repository";
import type { RecipeReviewWithAuthor } from "@/repositories/recipe-review.repository";
import {
  DuplicateRecipeReviewError,
  InvalidRecipeReviewInputError,
  InvalidRecipeReviewTransitionError,
  RecipeNotFoundError,
  RecipeReviewForbiddenError,
  RecipeReviewNotEditableError,
  RecipeReviewNotFoundError,
} from "@/services/recipe-review.errors";
import type { OwnRecipeReview, PublicRecipeReview, RecipeReviewPage } from "@/types/recipe-review";
import { recipeReviewInputSchema, type RecipeReviewInput, type RecipeReviewListQuery } from "@/validation/recipe-review.schema";

// ---------------------------------------------------------------------------
// Status lifecycle — mirrors blog.service.ts's shape exactly (an
// allowedTransitions table + one mutation function), not review.service.ts's
// more complex one: RecipeReview has no separate "Approved but not yet
// published" step (design spec decision #1).
// ---------------------------------------------------------------------------

const allowedTransitions: Record<RecipeReviewStatus, readonly RecipeReviewStatus[]> = {
  Pending: ["Approved", "Rejected"],
  Approved: ["Hidden"],
  Rejected: [],
  Hidden: [],
};

export function canTransitionRecipeReview(from: RecipeReviewStatus, to: RecipeReviewStatus): boolean {
  return allowedTransitions[from].includes(to);
}

export async function changeRecipeReviewStatus(reviewId: string, nextStatus: RecipeReviewStatus) {
  const review = await recipeReviewRepository.findReviewById(reviewId);
  if (!review) throw new RecipeReviewNotFoundError();
  if (!canTransitionRecipeReview(review.status, nextStatus)) {
    throw new InvalidRecipeReviewTransitionError(review.status, nextStatus);
  }

  // Recalculation triggers whenever the transition crosses the Approved
  // boundary in either direction (Pending->Approved, Approved->Hidden).
  // Approved->Rejected is impossible per allowedTransitions above.
  const recalculate = review.status === "Approved" || nextStatus === "Approved";
  const updated = await recipeReviewRepository.updateReviewStatusAndRecalculate(
    review.id,
    review.recipeId,
    review.status,
    { status: nextStatus },
    recalculate,
  );
  if (!updated) throw new InvalidRecipeReviewTransitionError(review.status, nextStatus);
  return updated;
}

// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

const FALLBACK_AUTHOR_NAME = "Oristor customer";

function toOwnReview(review: {
  id: string;
  rating: number;
  reviewText: string | null;
  status: RecipeReviewStatus;
}): OwnRecipeReview {
  return { id: review.id, rating: review.rating, reviewText: review.reviewText, status: review.status };
}

function toPublicReview(review: RecipeReviewWithAuthor): PublicRecipeReview {
  return {
    id: review.id,
    authorName: review.customer.name?.trim() || FALLBACK_AUTHOR_NAME,
    rating: review.rating,
    reviewText: review.reviewText,
    createdAt: review.createdAt.toISOString(),
  };
}

async function requirePublishedRecipe(slug: string) {
  const recipe = await findPublishedRecipeBySlug(slug);
  if (!recipe) throw new RecipeNotFoundError();
  return recipe;
}

// Route handlers already validate with the same schema; this second check
// protects non-API callers (the seed, e2e helpers, future jobs).
function parseReviewInput(input: RecipeReviewInput): RecipeReviewInput {
  const parsed = recipeReviewInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidRecipeReviewInputError(parsed.error.issues[0]?.message ?? "Invalid review");
  return parsed.data;
}

async function requireOwnPendingReview(customerId: string, recipeSlug: string, reviewId: string) {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const review = await recipeReviewRepository.findReviewById(reviewId);
  if (!review || review.recipeId !== recipe.id) throw new RecipeReviewNotFoundError();
  if (review.customerId !== customerId) throw new RecipeReviewForbiddenError();
  if (review.status !== "Pending") throw new RecipeReviewNotEditableError();
  return review;
}

export async function submitReview(customerId: string, recipeSlug: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const data = parseReviewInput(input);
  try {
    const review = await recipeReviewRepository.createReview({
      recipeId: recipe.id,
      customerId,
      rating: data.rating,
      reviewText: data.reviewText ?? null,
    });
    return toOwnReview(review);
  } catch (error) {
    // The (recipeId, customerId) unique constraint is the real guard, so two
    // concurrent submits can't both succeed.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DuplicateRecipeReviewError();
    }
    throw error;
  }
}

export async function getMyReview(customerId: string, recipeSlug: string): Promise<OwnRecipeReview | null> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  const review = await recipeReviewRepository.findReviewByRecipeAndCustomer(recipe.id, customerId);
  return review ? toOwnReview(review) : null;
}

export async function editOwnPendingReview(
  customerId: string,
  recipeSlug: string,
  reviewId: string,
  input: RecipeReviewInput,
): Promise<OwnRecipeReview> {
  await requireOwnPendingReview(customerId, recipeSlug, reviewId);
  const data = parseReviewInput(input);
  // Conditional on status = Pending: see updateOwnPendingReviewContent's doc
  // comment in recipe-review.repository.ts — a moderator acting between the
  // read above and this write makes this affect 0 rows instead of silently
  // overwriting Approved/Rejected content.
  const updated = await recipeReviewRepository.updateOwnPendingReviewContent(reviewId, customerId, {
    rating: data.rating,
    reviewText: data.reviewText ?? null,
  });
  if (!updated) throw new RecipeReviewNotEditableError();
  return toOwnReview(updated);
}

/** Withdrawing deletes the review: it was never public, and this frees the one-per-recipe slot. */
export async function withdrawOwnPendingReview(customerId: string, recipeSlug: string, reviewId: string): Promise<void> {
  await requireOwnPendingReview(customerId, recipeSlug, reviewId);
  // Conditional delete: see the comment in editOwnPendingReview above.
  const deleted = await recipeReviewRepository.deleteOwnPendingReview(reviewId, customerId);
  if (!deleted) throw new RecipeReviewNotEditableError();
}

/**
 * id-based primitive, called directly by the recipe detail page (Server
 * Component, Task 11) to seed RecipeReviewsSection's initialData. No
 * provider-registry indirection is needed here (unlike Product's
 * registerReviewSummaryProvider) because Recipe.avgRating/ratingCount are
 * already flat columns recipe.service.ts's getRecipeBySlug returns directly
 * — see design spec decision #9.
 */
export async function listApprovedReviewsForRecipe(recipeId: string, query: RecipeReviewListQuery): Promise<RecipeReviewPage> {
  const { items, total } = await recipeReviewRepository.listApprovedReviews(recipeId, {
    sort: query.sort,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicReview), total, page: query.page, pageSize: query.pageSize };
}

/** slug-based wrapper, used only by GET /api/recipes/[slug]/reviews (Task 5). */
export async function listApprovedReviews(recipeSlug: string, query: RecipeReviewListQuery): Promise<RecipeReviewPage> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  return listApprovedReviewsForRecipe(recipe.id, query);
}

// ---------------------------------------------------------------------------
// Dev tooling
// ---------------------------------------------------------------------------

/**
 * Walks a Pending review to Approved through the real transition function,
 * for the seed (Task 8) and e2e tests (Task 12) only. In production,
 * reviews are approved from the moderation console (Epic 07, STORY-045).
 */
export function advanceRecipeReviewToApproved(reviewId: string) {
  return changeRecipeReviewStatus(reviewId, "Approved");
}
```

- [ ] **Step 2: Write the service tests**

```typescript
// tests/unit/recipe-review-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import {
  advanceRecipeReviewToApproved,
  canTransitionRecipeReview,
  changeRecipeReviewStatus,
  editOwnPendingReview,
  getMyReview,
  listApprovedReviews,
  submitReview,
  withdrawOwnPendingReview,
} from "@/services/recipe-review.service";
import {
  DuplicateRecipeReviewError,
  InvalidRecipeReviewInputError,
  RecipeReviewForbiddenError,
  RecipeReviewNotEditableError,
} from "@/services/recipe-review.errors";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-svc-category-${sequence}` });
  return createRecipe({
    slug: `rr-svc-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser(name: string | null = "Test Reviewer") {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-svc-${sequence}@test.com`, name } });
}

afterEach(async () => {
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("canTransitionRecipeReview", () => {
  it.each([
    ["Pending", "Approved", true],
    ["Pending", "Rejected", true],
    ["Pending", "Hidden", false],
    ["Approved", "Hidden", true],
    ["Approved", "Pending", false],
    ["Approved", "Rejected", false],
    ["Rejected", "Approved", false],
    ["Hidden", "Approved", false],
  ] as const)("%s -> %s is %s", (from, to, expected) => {
    expect(canTransitionRecipeReview(from, to)).toBe(expected);
  });
});

describe("submitReview / getMyReview", () => {
  it("creates a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    const review = await submitReview(user.id, recipe.slug, { rating: 5, reviewText: "Loved it" });

    expect(review.status).toBe("Pending");
    expect(await getMyReview(user.id, recipe.slug)).toEqual(review);
  });

  it("rejects a rating outside 1-5 even bypassing the route's own Zod check", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await expect(submitReview(user.id, recipe.slug, { rating: 9 } as never)).rejects.toThrow(InvalidRecipeReviewInputError);
  });

  it("throws DuplicateRecipeReviewError on a second submission for the same recipe", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await submitReview(user.id, recipe.slug, { rating: 3 });

    await expect(submitReview(user.id, recipe.slug, { rating: 4 })).rejects.toThrow(DuplicateRecipeReviewError);
  });

  it("throws RecipeNotFoundError for a Draft recipe's slug", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();

    await expect(submitReview(user.id, recipe.slug, { rating: 3 })).rejects.toThrow("Recipe not found");
  });
});

describe("editOwnPendingReview / withdrawOwnPendingReview", () => {
  it("edits a Pending review's rating and text", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    const updated = await editOwnPendingReview(user.id, recipe.slug, review.id, { rating: 5, reviewText: "Changed my mind" });
    expect(updated.rating).toBe(5);
    expect(updated.reviewText).toBe("Changed my mind");
  });

  it("rejects editing another customer's review", async () => {
    const recipe = await makeRecipe();
    const owner = await makeUser();
    const intruder = await makeUser();
    const review = await submitReview(owner.id, recipe.slug, { rating: 2 });

    await expect(editOwnPendingReview(intruder.id, recipe.slug, review.id, { rating: 5 })).rejects.toThrow(
      RecipeReviewForbiddenError,
    );
  });

  it("rejects editing a review that a moderator already approved", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });
    await advanceRecipeReviewToApproved(review.id);

    await expect(editOwnPendingReview(user.id, recipe.slug, review.id, { rating: 5 })).rejects.toThrow(
      RecipeReviewNotEditableError,
    );
  });

  it("withdraws (deletes) a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    await withdrawOwnPendingReview(user.id, recipe.slug, review.id);

    expect(await getMyReview(user.id, recipe.slug)).toBeNull();
  });
});

describe("changeRecipeReviewStatus / listApprovedReviews", () => {
  it("Approved review appears in the public list and recalculates the recipe's rating", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 4 });

    await advanceRecipeReviewToApproved(review.id);

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(1);
    expect(page.items[0]?.authorName).toBe(user.name);

    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating?.toNumber()).toBe(4);
    expect(refreshed.ratingCount).toBe(1);
  });

  it("a Pending or Rejected review never appears in the public list", async () => {
    const recipe = await makeRecipe();
    const pendingUser = await makeUser();
    const rejectedUser = await makeUser();
    const pending = await submitReview(pendingUser.id, recipe.slug, { rating: 5 });
    const rejected = await submitReview(rejectedUser.id, recipe.slug, { rating: 1 });
    await changeRecipeReviewStatus(rejected.id, "Rejected");
    void pending;

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(0);
  });

  it("Approved -> Hidden removes it from the public list and recalculates back to null/0", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, { rating: 4 });
    await advanceRecipeReviewToApproved(review.id);

    await changeRecipeReviewStatus(review.id, "Hidden");

    const page = await listApprovedReviews(recipe.slug, { page: 1, pageSize: 10, sort: "recent" });
    expect(page.total).toBe(0);
    const refreshed = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(refreshed.avgRating).toBeNull();
    expect(refreshed.ratingCount).toBe(0);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test -- recipe-review-service`
Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add src/services/recipe-review.service.ts tests/unit/recipe-review-service.test.ts
git commit -m "feat: add recipe review service"
```

---

## Task 5: `recipe-review-responses.ts` and the 5 review API routes

**Files:**
- Create: `src/lib/api/recipe-review-responses.ts`
- Create: `src/app/api/recipes/[slug]/reviews/route.ts`
- Create: `src/app/api/recipes/[slug]/reviews/mine/route.ts`
- Create: `src/app/api/recipes/[slug]/reviews/[reviewId]/route.ts`
- Test: `tests/unit/recipe-review-routes.test.ts`

**Interfaces:**
- Consumes: `unauthorizedResponse`/`validationErrorResponse` from `@/lib/api/responses` (existing, shared); everything Task 4 produces; `recipeReviewInputSchema`/`recipeReviewListQuerySchema` from Task 2.
- Produces: `GET/POST /api/recipes/[slug]/reviews`, `GET /api/recipes/[slug]/reviews/mine`, `PATCH/DELETE /api/recipes/[slug]/reviews/[reviewId]`. No later task depends on this route module directly (the frontend talks to it via a client wrapper built in Task 11).

- [ ] **Step 1: Write `src/lib/api/recipe-review-responses.ts`**

```typescript
import { NextResponse } from "next/server";

import { RecipeReviewServiceError, type RecipeReviewErrorCode } from "@/services/recipe-review.errors";

const statusByCode: Record<RecipeReviewErrorCode, number> = {
  invalid_input: 400,
  recipe_not_found: 404,
  review_not_found: 404,
  forbidden: 403,
  duplicate: 409,
  not_editable: 409,
  invalid_transition: 409,
};

/** Maps a recipe review service error to its HTTP response; anything else is rethrown (500). */
export function recipeReviewErrorResponse(error: unknown) {
  if (error instanceof RecipeReviewServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
```

- [ ] **Step 2: Write `src/app/api/recipes/[slug]/reviews/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeReviewErrorResponse } from "@/lib/api/recipe-review-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listApprovedReviews, submitReview } from "@/services/recipe-review.service";
import { recipeReviewInputSchema, recipeReviewListQuerySchema } from "@/validation/recipe-review.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = recipeReviewListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listApprovedReviews(slug, parsed.data), { status: 200 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = recipeReviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await submitReview(session.user.id, slug, parsed.data);
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}
```

- [ ] **Step 3: Write `src/app/api/recipes/[slug]/reviews/mine/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeReviewErrorResponse } from "@/lib/api/recipe-review-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getMyReview } from "@/services/recipe-review.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ review: await getMyReview(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
  }
}
```

- [ ] **Step 4: Write `src/app/api/recipes/[slug]/reviews/[reviewId]/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { recipeReviewErrorResponse } from "@/lib/api/recipe-review-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { editOwnPendingReview, withdrawOwnPendingReview } from "@/services/recipe-review.service";
import { recipeReviewInputSchema } from "@/validation/recipe-review.schema";

type RouteContext = { params: Promise<{ slug: string; reviewId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug, reviewId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = recipeReviewInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const review = await editOwnPendingReview(session.user.id, slug, reviewId, parsed.data);
    return NextResponse.json({ review }, { status: 200 });
  } catch (error) {
    return recipeReviewErrorResponse(error);
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
    return recipeReviewErrorResponse(error);
  }
}
```

- [ ] **Step 5: Write the route tests**

```typescript
// tests/unit/recipe-review-routes.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { advanceRecipeReviewToApproved, submitReview } from "@/services/recipe-review.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/recipes/[slug]/reviews/route");
const mineRoute = await import("@/app/api/recipes/[slug]/reviews/mine/route");
const itemRoute = await import("@/app/api/recipes/[slug]/reviews/[reviewId]/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const input = { rating: 5, reviewText: "Fragrant and well-balanced." };
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

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rr-route-category-${sequence}` });
  return createRecipe({
    slug: `rr-route-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rr-route-${sequence}@test.com`, name: "Route Tester" } });
}

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.recipeReview.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("POST /api/recipes/[slug]/reviews", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("creates a Pending review for an authenticated customer", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(201);
    const body = (await response.json()) as { review: { status: string } };
    expect(body.review.status).toBe("Pending");
  });

  it("returns 400 for an out-of-range rating", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", { rating: 9 }), slugParams(recipe.slug));
    expect(response.status).toBe(400);
  });

  it("returns 409 on a duplicate submission", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    await submitReview(user.id, recipe.slug, input);

    const response = await listRoute.POST(jsonRequest("http://test/x", "POST", input), slugParams(recipe.slug));
    expect(response.status).toBe(409);
  });
});

describe("GET /api/recipes/[slug]/reviews", () => {
  it("does not require auth and only returns Approved reviews", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();
    const user = await makeUser();
    const review = await submitReview(user.id, recipe.slug, input);
    await advanceRecipeReviewToApproved(review.id);

    const response = await listRoute.GET(new Request(`http://test/x?sort=recent`), slugParams(recipe.slug));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(1);
  });
});

describe("GET /api/recipes/[slug]/reviews/mine", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await mineRoute.GET(new Request("http://test/x"), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("returns null when the customer has no review yet", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mineRoute.GET(new Request("http://test/x"), slugParams(recipe.slug));
    const body = (await response.json()) as { review: unknown };
    expect(body.review).toBeNull();
  });
});

describe("PATCH/DELETE /api/recipes/[slug]/reviews/[reviewId]", () => {
  it("PATCH returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await itemRoute.PATCH(jsonRequest("http://test/x", "PATCH", input), reviewParams(recipe.slug, "any"));
    expect(response.status).toBe(401);
  });

  it("PATCH edits a Pending review", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    const response = await itemRoute.PATCH(
      jsonRequest("http://test/x", "PATCH", { rating: 5, reviewText: "Updated" }),
      reviewParams(recipe.slug, review.id),
    );
    expect(response.status).toBe(200);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, "any"));
    expect(response.status).toBe(401);
  });

  it("DELETE withdraws a Pending review with 204", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const review = await submitReview(user.id, recipe.slug, { rating: 2 });

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, review.id));
    expect(response.status).toBe(204);
  });

  it("DELETE returns 404 for a non-existent review ID", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await itemRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), reviewParams(recipe.slug, "nope"));
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npm run test -- recipe-review-routes`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/api/recipe-review-responses.ts src/app/api/recipes tests/unit/recipe-review-routes.test.ts
git commit -m "feat: add recipe review API routes"
```

---

## Task 6: `recipe-bookmark.errors.ts`, `recipe-bookmark.repository.ts`, `recipe-bookmark.service.ts`

**Files:**
- Create: `src/services/recipe-bookmark.errors.ts`
- Create: `src/repositories/recipe-bookmark.repository.ts`
- Create: `src/services/recipe-bookmark.service.ts`
- Test: `tests/unit/recipe-bookmark-repository.test.ts`
- Test: `tests/unit/recipe-bookmark-service.test.ts`

**Interfaces:**
- Consumes: `findPublishedRecipeBySlug`, `findRecipesByIds`, `toRecipeCard` from `@/repositories/recipe.repository` / `@/services/recipe.service` (all existing, unmodified).
- Produces: `RecipeNotFoundError` (bookmark-scoped, distinct class from Task 3's review-scoped one — see the note in Step 1); repository functions `addBookmark`, `removeBookmark`, `isBookmarked`, `listBookmarkedRecipeIdsForCustomer`, `findExistingBookmarkedRecipeIds`; service functions `addBookmark(customerId, recipeSlug)`, `removeBookmark(customerId, recipeSlug)`, `listBookmarksForCustomer(customerId): Promise<RecipeCard[]>`, `mergeGuestBookmarks(customerId, recipeIds)`. Task 7's routes and Task 9's frontend both depend on the service's exact function names.

Two independent `RecipeNotFoundError` classes exist in this codebase after this task (one in `recipe-review.errors.ts`, one in `recipe-bookmark.errors.ts`) — this is intentional, not an oversight: the design spec's ground rule explicitly says not to introduce a shared abstraction between the two feature slices solely to avoid this ~10-line duplication, and Reviews/Bookmarks otherwise import nothing from each other.

- [ ] **Step 1: Write `src/services/recipe-bookmark.errors.ts`**

```typescript
/**
 * Typed error thrown by recipe-bookmark.service.ts. A separate class from
 * recipe-review.errors.ts's RecipeNotFoundError by design — see this task's
 * note in the plan on why no shared error module was introduced.
 */
export type RecipeBookmarkErrorCode = "recipe_not_found";

export class RecipeBookmarkServiceError extends Error {
  readonly code: RecipeBookmarkErrorCode;

  constructor(code: RecipeBookmarkErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class RecipeNotFoundError extends RecipeBookmarkServiceError {
  constructor() {
    super("recipe_not_found", "Recipe not found");
  }
}
```

- [ ] **Step 2: Write `src/repositories/recipe-bookmark.repository.ts`**

```typescript
import { prisma } from "@/lib/db";

export function addBookmark(recipeId: string, customerId: string) {
  return prisma.recipeBookmark.create({ data: { recipeId, customerId } });
}

export function removeBookmark(recipeId: string, customerId: string) {
  // deleteMany (not delete) so removing a bookmark that's already gone is a
  // no-op rather than a thrown P2025 — matches wishlist.repository.ts's
  // removeItem.
  return prisma.recipeBookmark.deleteMany({ where: { recipeId, customerId } });
}

export function isBookmarked(recipeId: string, customerId: string): Promise<boolean> {
  return prisma.recipeBookmark
    .findUnique({ where: { recipeId_customerId: { recipeId, customerId } } })
    .then((row) => row !== null);
}

export function listBookmarkedRecipeIdsForCustomer(customerId: string): Promise<string[]> {
  return prisma.recipeBookmark
    .findMany({
      where: { customerId, recipe: { status: "Published" } },
      orderBy: { createdAt: "desc" },
      select: { recipeId: true },
    })
    .then((rows) => rows.map((row) => row.recipeId));
}

export function findExistingBookmarkedRecipeIds(customerId: string, recipeIds: string[]): Promise<string[]> {
  if (recipeIds.length === 0) return Promise.resolve([]);
  return prisma.recipeBookmark
    .findMany({
      where: { customerId, recipeId: { in: recipeIds } },
      select: { recipeId: true },
    })
    .then((rows) => rows.map((row) => row.recipeId));
}
```

- [ ] **Step 3: Write `src/services/recipe-bookmark.service.ts`**

```typescript
import { Prisma } from "@/generated/prisma/client";
import { findPublishedRecipeBySlug, findRecipesByIds } from "@/repositories/recipe.repository";
import * as recipeBookmarkRepository from "@/repositories/recipe-bookmark.repository";
import { RecipeNotFoundError } from "@/services/recipe-bookmark.errors";
import { toRecipeCard } from "@/services/recipe.service";
import type { RecipeCard } from "@/types/recipe";

async function requirePublishedRecipe(slug: string) {
  const recipe = await findPublishedRecipeBySlug(slug);
  if (!recipe) throw new RecipeNotFoundError();
  return recipe;
}

export async function addBookmark(customerId: string, recipeSlug: string): Promise<void> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  try {
    await recipeBookmarkRepository.addBookmark(recipe.id, customerId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // already bookmarked — idempotent no-op, not an error
    }
    throw error;
  }
}

export async function removeBookmark(customerId: string, recipeSlug: string): Promise<void> {
  const recipe = await requirePublishedRecipe(recipeSlug);
  await recipeBookmarkRepository.removeBookmark(recipe.id, customerId);
}

/**
 * The one method STORY-037 (Saved Recipes & Sync) is expected to call/reuse
 * rather than reimplement — returns the same RecipeCard[] shape
 * RecipeGrid/RecipeCard already consume, ordered most-recently-bookmarked
 * first. findRecipesByIds (STORY-017) orders by popularity internally, so
 * the bookmark-recency order is restored here rather than in the repository.
 */
export async function listBookmarksForCustomer(customerId: string): Promise<RecipeCard[]> {
  const ids = await recipeBookmarkRepository.listBookmarkedRecipeIdsForCustomer(customerId);
  if (ids.length === 0) return [];

  const rows = await findRecipesByIds(ids, ids.length);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => rowById.get(id))
    .filter((row) => row !== undefined)
    .map(toRecipeCard);
}

/**
 * Merges a guest (localStorage) bookmark list into the customer's
 * server-side bookmarks on login. A small, bounded id list (capped at 200 —
 * see recipe-bookmark.schema.ts), so a single bulk findRecipesByIds
 * existence/Published check (rather than mergeGuestWishlist's per-id
 * sequential lookups) is used here since that bulk helper already exists in
 * this codebase for exactly this shape of query — see design spec decision
 * #5 for the rest of the merge flow's parity with mergeGuestWishlist.
 */
export async function mergeGuestBookmarks(customerId: string, recipeIds: string[]): Promise<void> {
  if (recipeIds.length === 0) return;

  const uniqueIds = [...new Set(recipeIds)];
  const existingIds = new Set(await recipeBookmarkRepository.findExistingBookmarkedRecipeIds(customerId, uniqueIds));
  const candidateIds = uniqueIds.filter((id) => !existingIds.has(id));
  if (candidateIds.length === 0) return;

  const publishedRows = await findRecipesByIds(candidateIds, candidateIds.length);
  const publishedIds = new Set(publishedRows.map((row) => row.id));

  for (const recipeId of candidateIds) {
    if (!publishedIds.has(recipeId)) continue;
    try {
      await recipeBookmarkRepository.addBookmark(recipeId, customerId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
}
```

- [ ] **Step 4: Write the repository tests**

```typescript
// tests/unit/recipe-bookmark-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addBookmark,
  findExistingBookmarkedRecipeIds,
  isBookmarked,
  listBookmarkedRecipeIdsForCustomer,
  removeBookmark,
} from "@/repositories/recipe-bookmark.repository";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-repo-category-${sequence}` });
  return createRecipe({
    slug: `rb-repo-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rb-repo-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("addBookmark / isBookmarked / removeBookmark", () => {
  it("creates a bookmark and reports it as bookmarked", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await addBookmark(recipe.id, user.id);

    expect(await isBookmarked(recipe.id, user.id)).toBe(true);
  });

  it("enforces one bookmark per (recipe, customer) at the database level", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(recipe.id, user.id);

    await expect(addBookmark(recipe.id, user.id)).rejects.toThrow();
  });

  it("removeBookmark on an already-removed row is a no-op, not a throw", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await expect(removeBookmark(recipe.id, user.id)).resolves.not.toThrow();
    expect(await isBookmarked(recipe.id, user.id)).toBe(false);
  });

  it("removeBookmark actually removes an existing row", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(recipe.id, user.id);

    await removeBookmark(recipe.id, user.id);

    expect(await isBookmarked(recipe.id, user.id)).toBe(false);
  });
});

describe("listBookmarkedRecipeIdsForCustomer", () => {
  it("only returns bookmarks for Published recipes, most recent first", async () => {
    const user = await makeUser();
    const published = await makeRecipe("Published");
    const draft = await makeRecipe("Draft");
    await addBookmark(draft.id, user.id);
    await addBookmark(published.id, user.id);

    expect(await listBookmarkedRecipeIdsForCustomer(user.id)).toEqual([published.id]);
  });
});

describe("findExistingBookmarkedRecipeIds", () => {
  it("returns only the ids that are already bookmarked", async () => {
    const user = await makeUser();
    const bookmarked = await makeRecipe();
    const notBookmarked = await makeRecipe();
    await addBookmark(bookmarked.id, user.id);

    const existing = await findExistingBookmarkedRecipeIds(user.id, [bookmarked.id, notBookmarked.id]);
    expect(existing).toEqual([bookmarked.id]);
  });
});
```

- [ ] **Step 5: Write the service tests**

```typescript
// tests/unit/recipe-bookmark-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { addBookmark, listBookmarksForCustomer, mergeGuestBookmarks, removeBookmark } from "@/services/recipe-bookmark.service";
import { RecipeNotFoundError } from "@/services/recipe-bookmark.errors";

let sequence = 0;

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-svc-category-${sequence}` });
  return createRecipe({
    slug: `rb-svc-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rb-svc-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("addBookmark / removeBookmark", () => {
  it("adds a bookmark for a Published recipe", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();

    await addBookmark(user.id, recipe.slug);

    const bookmarks = await listBookmarksForCustomer(user.id);
    expect(bookmarks.map((r) => r.id)).toEqual([recipe.id]);
  });

  it("rejects bookmarking a Draft recipe", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();

    await expect(addBookmark(user.id, recipe.slug)).rejects.toThrow(RecipeNotFoundError);
  });

  it("a second addBookmark call for the same recipe is an idempotent no-op", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);

    await expect(addBookmark(user.id, recipe.slug)).resolves.toBeUndefined();
    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("removeBookmark removes a bookmark", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);

    await removeBookmark(user.id, recipe.slug);

    expect(await listBookmarksForCustomer(user.id)).toEqual([]);
  });
});

describe("mergeGuestBookmarks", () => {
  it("bookmarks every valid, not-yet-bookmarked, Published recipe id", async () => {
    const user = await makeUser();
    const recipeA = await makeRecipe();
    const recipeB = await makeRecipe();
    const draft = await makeRecipe("Draft");

    await mergeGuestBookmarks(user.id, [recipeA.id, recipeB.id, draft.id, "nonexistent-id"]);

    const bookmarks = await listBookmarksForCustomer(user.id);
    expect(bookmarks.map((r) => r.id).sort()).toEqual([recipeA.id, recipeB.id].sort());
  });

  it("skips ids that are already bookmarked", async () => {
    const user = await makeUser();
    const recipe = await makeRecipe();
    await addBookmark(user.id, recipe.slug);

    await expect(mergeGuestBookmarks(user.id, [recipe.id])).resolves.toBeUndefined();
    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("is idempotent — calling it twice with the same ids produces no duplicates and no error", async () => {
    const user = await makeUser();
    const recipe = await makeRecipe();

    await mergeGuestBookmarks(user.id, [recipe.id]);
    await mergeGuestBookmarks(user.id, [recipe.id]);

    expect(await listBookmarksForCustomer(user.id)).toHaveLength(1);
  });

  it("does nothing for an empty list", async () => {
    const user = await makeUser();
    await expect(mergeGuestBookmarks(user.id, [])).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npm run test -- recipe-bookmark`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/services/recipe-bookmark.errors.ts src/repositories/recipe-bookmark.repository.ts src/services/recipe-bookmark.service.ts tests/unit/recipe-bookmark-repository.test.ts tests/unit/recipe-bookmark-service.test.ts
git commit -m "feat: add recipe bookmark repository and service"
```

---

## Task 7: The 4 recipe bookmark API routes

**Files:**
- Create: `src/app/api/recipes/[slug]/bookmark/route.ts`
- Create: `src/app/api/recipes/bookmarks/route.ts`
- Create: `src/app/api/recipes/bookmarks/merge/route.ts`
- Test: `tests/unit/recipe-bookmark-routes.test.ts`

**Interfaces:**
- Consumes: `unauthorizedResponse`/`validationErrorResponse` from `@/lib/api/responses`; everything Task 6 produces; `mergeRecipeBookmarksSchema` from Task 2.
- Produces: `POST/DELETE /api/recipes/[slug]/bookmark`, `GET /api/recipes/bookmarks`, `POST /api/recipes/bookmarks/merge`. Task 9's frontend client wrapper calls all three paths.

A `recipe-bookmark-responses.ts` mapper is not needed: `RecipeBookmarkServiceError` currently has exactly one code (`recipe_not_found` → 404), so each route below catches it inline — adding a whole mapper module for one status mapping would be the kind of premature abstraction CLAUDE.md's conventions warn against. If a later story adds a second bookmark error code, extract the mapper then.

- [ ] **Step 1: Write `src/app/api/recipes/[slug]/bookmark/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { addBookmark, removeBookmark } from "@/services/recipe-bookmark.service";
import { RecipeBookmarkServiceError } from "@/services/recipe-bookmark.errors";

type RouteContext = { params: Promise<{ slug: string }> };

function bookmarkErrorResponse(error: unknown) {
  if (error instanceof RecipeBookmarkServiceError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  throw error;
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    await addBookmark(session.user.id, slug);
    return NextResponse.json({ bookmarked: true }, { status: 200 });
  } catch (error) {
    return bookmarkErrorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    await removeBookmark(session.user.id, slug);
    return NextResponse.json({ removed: true }, { status: 200 });
  } catch (error) {
    return bookmarkErrorResponse(error);
  }
}
```

- [ ] **Step 2: Write `src/app/api/recipes/bookmarks/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listBookmarksForCustomer } from "@/services/recipe-bookmark.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const items = await listBookmarksForCustomer(session.user.id);
  return NextResponse.json({ items }, { status: 200 });
}
```

- [ ] **Step 3: Write `src/app/api/recipes/bookmarks/merge/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { mergeGuestBookmarks } from "@/services/recipe-bookmark.service";
import { mergeRecipeBookmarksSchema } from "@/validation/recipe-bookmark.schema";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => null);
  const parsed = mergeRecipeBookmarksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  await mergeGuestBookmarks(session.user.id, parsed.data.recipeIds);
  return NextResponse.json({ merged: true }, { status: 200 });
}
```

- [ ] **Step 4: Write the route tests**

```typescript
// tests/unit/recipe-bookmark-routes.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { addBookmark } from "@/services/recipe-bookmark.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const bookmarkRoute = await import("@/app/api/recipes/[slug]/bookmark/route");
const listRoute = await import("@/app/api/recipes/bookmarks/route");
const mergeRoute = await import("@/app/api/recipes/bookmarks/merge/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeRecipe(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rb-route-category-${sequence}` });
  return createRecipe({
    slug: `rb-route-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status,
  });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `rb-route-${sequence}@test.com`, name: "Bookmark Tester" } });
}

afterEach(async () => {
  vi.clearAllMocks();
  await prisma.recipeBookmark.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
});

describe("POST/DELETE /api/recipes/[slug]/bookmark", () => {
  it("POST returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("POST bookmarks a Published recipe for the authenticated customer", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(200);
  });

  it("POST returns 404 for a Draft recipe's slug", async () => {
    const recipe = await makeRecipe("Draft");
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.POST(new Request("http://test/x", { method: "POST" }), slugParams(recipe.slug));
    expect(response.status).toBe(404);
  });

  it("DELETE returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const recipe = await makeRecipe();

    const response = await bookmarkRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), slugParams(recipe.slug));
    expect(response.status).toBe(401);
  });

  it("DELETE removes an existing bookmark", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await bookmarkRoute.DELETE(new Request("http://test/x", { method: "DELETE" }), slugParams(recipe.slug));
    expect(response.status).toBe(200);
  });
});

describe("GET /api/recipes/bookmarks", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await listRoute.GET();
    expect(response.status).toBe(401);
  });

  it("returns the customer's bookmarked recipes as RecipeCard[]", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    await addBookmark(user.id, recipe.slug);
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await listRoute.GET();
    const body = (await response.json()) as { items: Array<{ id: string; slug: string }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.slug).toBe(recipe.slug);
  });
});

describe("POST /api/recipes/bookmarks/merge", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: [] }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for a malformed body", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: "not-an-array" }));
    expect(response.status).toBe(400);
  });

  it("merges valid recipe ids into the customer's bookmarks", async () => {
    const recipe = await makeRecipe();
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await mergeRoute.POST(jsonRequest("http://test/x", "POST", { recipeIds: [recipe.id] }));
    expect(response.status).toBe(200);

    const listResponse = await listRoute.GET();
    const body = (await listResponse.json()) as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm run test -- recipe-bookmark-routes`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/recipes/bookmarks src/app/api/recipes/\[slug\]/bookmark tests/unit/recipe-bookmark-routes.test.ts
git commit -m "feat: add recipe bookmark API routes"
```

---

## Task 8: Seed data — real reviews replacing the fake `avgRating`/`ratingCount`, plus sample bookmarks

**Why this task exists:** `prisma/seed-recipes.ts` currently hardcodes `avgRating`/`ratingCount` (e.g. `sri-lankan-chicken-curry: avgRating: 4.9, ratingCount: 58`) on 14 of its 18 recipes, with **zero backing `RecipeReview` rows** — these were placeholder demo numbers written before this story existed. Now that `Recipe.avgRating`/`ratingCount` are a review-derived invariant (Task 3), leaving them in place means a freshly-seeded database shows "4.9 (58 ratings)" on a recipe whose review list is empty — an inconsistency a real user would immediately notice. This task fixes it the same way `prisma/seed.ts` already fixed the equivalent problem for `Product`/`Review`: replace the fake numbers with real reviews walked through the actual `submitReview`/`advanceRecipeReviewToApproved` workflow, so the displayed rating is always backed by real, inspectable rows.

**Files:**
- Modify: `prisma/seed-recipes.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `submitReview`, `advanceRecipeReviewToApproved`, `changeRecipeReviewStatus` from Task 4; `addBookmark` from Task 6; the existing `nadeesha`/`kamal` `User` rows `prisma/seed.ts` already creates for the product demo reviews/Q&A.
- Produces: nothing new consumed by later tasks — this is terminal seed content.

- [ ] **Step 1: Null out the 14 fake `avgRating`/`ratingCount` pairs in `prisma/seed-recipes.ts`**

For each of these 14 recipes (identified by their `slug:` line), change `avgRating: <N>, ratingCount: <N>,` to `avgRating: null, ratingCount: 0,` — the exact same "not yet rated" convention `kiribath-milk-rice`/`pol-roti-lunu-miris`/`wood-apple-juice`/`pumpkin-curry` already use in this same file:

- `chili-paste-deviled-prawns` (was `4.7, 32`)
- `coconut-sambol-maldive-fish` (was `4.8, 41`)
- `spiced-mango-pickle-rice` (was `4.5, 12`)
- `sri-lankan-chicken-curry` (was `4.9, 58`)
- `dhal-curry-parippu` (was `4.6, 47`)
- `watalappan` (was `4.4, 9`)
- `fish-ambul-thiyal` (was `4.7, 15`)
- `chicken-kottu-roti` (was `4.6, 36`)
- `sri-lankan-ginger-tea` (was `4.2, 5`)
- `vegetable-samosas` (was `4.3, 21`)
- `seeni-sambol` (was `4.8, 29`)
- `brinjal-moju` (was `4.5, 14`)
- `isso-vadai` (was `4.6, 19`)
- `milk-toffee` (was `4.1, 7`)

Four recipes are already `avgRating: null, ratingCount: 0` and need no change: `kiribath-milk-rice`, `pol-roti-lunu-miris`, `wood-apple-juice`, `pumpkin-curry`.

- [ ] **Step 2: Add real demo reviews and bookmarks to `prisma/seed.ts`**

Add this block immediately after the existing `const recipeSeed = await seedRecipes();` line (before the `// Cooking Tips (STORY-019).` comment), reusing the `nadeesha`/`kamal` users already created earlier in `main()` for the product demo reviews:

```typescript
  // Demo recipe reviews and bookmarks (STORY-022), submitted/approved
  // through the real workflow so Recipe.avgRating/ratingCount are always
  // backed by real rows — never the hardcoded placeholder numbers
  // prisma/seed-recipes.ts used before this story existed.
  const demoRecipeReviews = [
    { userId: nadeesha.id, slug: "sri-lankan-chicken-curry", rating: 5, reviewText: "Our family's new favourite — the coconut milk makes it so rich." },
    { userId: kamal.id, slug: "sri-lankan-chicken-curry", rating: 5, reviewText: "Restaurant quality. The chicken masala really carries this one." },
    { userId: nadeesha.id, slug: "watalappan", rating: 5, reviewText: "Perfectly set, not too sweet. A real crowd-pleaser at Avurudu." },
    { userId: kamal.id, slug: "watalappan", rating: 4, reviewText: "Delicious, though mine took longer to set than the recipe suggested." },
    { userId: kamal.id, slug: "coconut-sambol-maldive-fish", rating: 5, reviewText: "Exactly like my grandmother's pol sambol." },
    { userId: nadeesha.id, slug: "coconut-sambol-maldive-fish", rating: 4, reviewText: "Great with kottu. I used a bit less maldive fish for a milder version." },
    { userId: nadeesha.id, slug: "dhal-curry-parippu", rating: 4, reviewText: "Simple, comforting, and freezes well for meal prep." },
  ];
  for (const demo of demoRecipeReviews) {
    const review = await submitReview(demo.userId, demo.slug, { rating: demo.rating, reviewText: demo.reviewText });
    await advanceRecipeReviewToApproved(review.id);
  }

  // One still-Pending review (awaiting moderation) and one Rejected review,
  // so the seeded database demonstrates every review state, not only
  // Approved. Kept off sri-lankan-chicken-curry/watalappan/
  // coconut-sambol-maldive-fish (used above) and dhal-curry-parippu (used
  // above) to avoid a duplicate-review conflict for the same customer.
  const asanka = await prisma.user.create({ data: { email: "asanka.demo@oristor.test", name: "Asanka F." } });
  const pendingReview = await submitReview(asanka.id, "fish-ambul-thiyal", {
    rating: 5,
    reviewText: "Tried this last weekend — will report back once I've perfected the tamarind balance!",
  });
  void pendingReview; // left Pending deliberately — demonstrates the "awaiting approval" state

  const rejectedReview = await submitReview(kamal.id, "dhal-curry-parippu", { rating: 1, reviewText: "Link spam: buy-followers-now.example" });
  await changeRecipeReviewStatus(rejectedReview.id, "Rejected");

  // Demo bookmarks for the same two seeded customers.
  await addBookmark(nadeesha.id, "sri-lankan-chicken-curry");
  await addBookmark(nadeesha.id, "watalappan");
  await addBookmark(nadeesha.id, "seeni-sambol");
  await addBookmark(kamal.id, "dhal-curry-parippu");
  await addBookmark(kamal.id, "coconut-sambol-maldive-fish");
```

Add the three new imports at the top of `prisma/seed.ts`, alongside the existing `submitReview`/`advanceReviewToPublished` imports:

```typescript
import { advanceRecipeReviewToApproved, changeRecipeReviewStatus, submitReview as submitRecipeReview } from "../src/services/recipe-review.service";
import { addBookmark } from "../src/services/recipe-bookmark.service";
```

`prisma/seed.ts` already imports a `submitReview` from `review.service.ts` for products — rename the block above's calls to use the aliased `submitRecipeReview` instead of the bare `submitReview` shown above (i.e. replace every `submitReview(demo.userId, ...)`/`submitReview(asanka.id, ...)`/`submitReview(kamal.id, ...)` call in Step 2 with `submitRecipeReview(...)`) to avoid a naming collision with the existing product import.

- [ ] **Step 3: Re-run the seed and verify**

```bash
npx tsx --env-file=.env prisma/seed.ts
```

Expected: `Seed complete: {...}` with no errors.

```bash
npx prisma studio
```

Manually confirm (then close Prisma Studio): `sri-lankan-chicken-curry`'s `Recipe.avgRating` is `5.0` and `ratingCount` is `2`; `fish-ambul-thiyal` has exactly one `RecipeReview` with `status = Pending`; `dhal-curry-parippu` has one `Approved` and one `Rejected` review, and its `avgRating` reflects only the Approved one (`4.0`, not an average including the Rejected `1`); `chili-paste-deviled-prawns` (and the other 9 previously-fake recipes) now show `avgRating: null`, `ratingCount: 0`.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-recipes.ts prisma/seed.ts
git commit -m "feat: seed real recipe reviews and bookmarks, remove placeholder ratings"
```

---

## Task 9: Guest bookmark frontend infrastructure (store, client wrapper, hook, merge-sync)

**Files:**
- Create: `src/lib/stores/recipe-bookmark-store.ts`
- Create: `src/lib/api/recipe-bookmark-client.ts`
- Create: `src/hooks/use-recipe-bookmark.ts`
- Create: `src/components/providers/recipe-bookmark-merge-sync.tsx`
- Modify: `src/app/providers.tsx`
- Test: `tests/unit/recipe-bookmark-store.test.ts`
- Test: `tests/unit/use-recipe-bookmark.test.tsx`
- Test: `tests/unit/recipe-bookmark-merge-sync.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks except the HTTP routes from Task 7 (called only at runtime via `fetch`, not imported).
- Produces: `useRecipeBookmarkStore` (Zustand store: `items: string[]`, `add`, `remove`, `has`, `clear`); `fetchBookmarkedRecipes(): Promise<RecipeCard[]>`, `addRecipeBookmark(recipeSlug): Promise<void>`, `removeRecipeBookmark(recipeSlug): Promise<void>` (client wrapper); `useRecipeBookmark({ recipeId, recipeSlug }): { isBookmarked: boolean; isAvailable: boolean; toggle: () => void }` (hook); `RecipeBookmarkMergeSync` (provider component, registered in this same task's Step 5). Task 10 imports the hook.

**Design note on the `recipeId`/`recipeSlug` split:** the toggle endpoint is routed by slug (`POST/DELETE /api/recipes/[slug]/bookmark`, matching the reviews routes' convention), but the guest store and the "is this bookmarked" membership check against `GET /api/recipes/bookmarks`'s `RecipeCard[]` response use `id` (matching `wishlist-store.ts`'s id-based shape exactly, and because `RecipeCard`/`RecipeDetail` both already expose `.id`). `useRecipeBookmark` therefore takes both.

- [ ] **Step 1: Write `src/lib/stores/recipe-bookmark-store.ts`**

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecipeBookmarkState {
  items: string[];
  add: (recipeId: string) => void;
  remove: (recipeId: string) => void;
  has: (recipeId: string) => boolean;
  clear: () => void;
}

/**
 * Guest (unauthenticated) recipe bookmarks, persisted to localStorage —
 * STORY-022. Mirrors wishlist-store.ts's shape exactly (add/remove/has/clear
 * over a plain string[]). Logged-in customers' bookmarks live server-side
 * (see recipe-bookmark.service.ts) and are fetched via useRecipeBookmark's
 * TanStack Query branch instead; this store is only the guest path.
 */
export const useRecipeBookmarkStore = create<RecipeBookmarkState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (recipeId) => {
        if (get().items.includes(recipeId)) return;
        set({ items: [...get().items, recipeId] });
      },
      remove: (recipeId) => set({ items: get().items.filter((id) => id !== recipeId) }),
      has: (recipeId) => get().items.includes(recipeId),
      clear: () => set({ items: [] }),
    }),
    { name: "oristor-recipe-bookmarks" },
  ),
);
```

- [ ] **Step 2: Write `src/lib/api/recipe-bookmark-client.ts`**

```typescript
import type { RecipeCard } from "@/types/recipe";

/**
 * Shared client-side wrapper around the recipe bookmark HTTP API —
 * STORY-022. Every function checks `response.ok` and throws on a non-2xx,
 * so callers (TanStack Query mutations, or an explicit `.catch()`) can
 * surface the failure instead of silently treating a 401/404/500 as
 * success. Mirrors wishlist-client.ts's shape.
 */

function assertOk(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} (${response.status})`);
  }
}

/** GET /api/recipes/bookmarks — the signed-in customer's bookmarked recipes. */
export async function fetchBookmarkedRecipes(): Promise<RecipeCard[]> {
  const response = await fetch("/api/recipes/bookmarks");
  assertOk(response, "Failed to load bookmarks");
  const body: { items: RecipeCard[] } = await response.json();
  return body.items;
}

/** POST /api/recipes/:slug/bookmark — bookmarks a recipe for the signed-in customer. */
export async function addRecipeBookmark(recipeSlug: string): Promise<void> {
  const response = await fetch(`/api/recipes/${encodeURIComponent(recipeSlug)}/bookmark`, { method: "POST" });
  assertOk(response, "Failed to bookmark recipe");
}

/** DELETE /api/recipes/:slug/bookmark — removes a recipe bookmark for the signed-in customer. */
export async function removeRecipeBookmark(recipeSlug: string): Promise<void> {
  const response = await fetch(`/api/recipes/${encodeURIComponent(recipeSlug)}/bookmark`, { method: "DELETE" });
  assertOk(response, "Failed to remove bookmark");
}
```

- [ ] **Step 3: Write `src/hooks/use-recipe-bookmark.ts`**

```typescript
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { addRecipeBookmark, fetchBookmarkedRecipes, removeRecipeBookmark } from "@/lib/api/recipe-bookmark-client";
import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";
import type { RecipeCard } from "@/types/recipe";

export interface UseRecipeBookmarkResult {
  isBookmarked: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

interface ToggleContext {
  previousItems: RecipeCard[] | undefined;
}

function optimisticPlaceholder(recipeId: string): RecipeCard {
  return {
    id: recipeId,
    slug: "",
    href: "",
    title: "",
    heroImage: "",
    heroImageAlt: "",
    categoryName: "",
    cuisine: null,
    difficulty: "Easy",
    totalTimeMinutes: 0,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    hasVideo: false,
  };
}

export function useRecipeBookmark(recipeId: string, recipeSlug: string): UseRecipeBookmarkResult {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const isAuthenticated = status === "authenticated";

  const guestHas = useRecipeBookmarkStore((state) => state.has(recipeId));
  const guestAdd = useRecipeBookmarkStore((state) => state.add);
  const guestRemove = useRecipeBookmarkStore((state) => state.remove);

  const { data: items } = useQuery({
    queryKey: ["recipe-bookmarks"],
    queryFn: fetchBookmarkedRecipes,
    enabled: isAuthenticated,
  });

  const isServerBookmarked = (items ?? []).some((item) => item.id === recipeId);
  const isBookmarked = isAuthenticated ? isServerBookmarked : guestHas;

  const toggleMutation = useMutation<void, Error, void, ToggleContext>({
    mutationFn: async () => {
      if (isServerBookmarked) {
        await removeRecipeBookmark(recipeSlug);
      } else {
        await addRecipeBookmark(recipeSlug);
      }
    },
    // Optimistic update, same shape as useWishlist: the toggle must flip
    // immediately for signed-in customers too, not only after the
    // POST/DELETE round-trip and refetch.
    onMutate: async (): Promise<ToggleContext> => {
      await queryClient.cancelQueries({ queryKey: ["recipe-bookmarks"] });
      const previousItems = queryClient.getQueryData<RecipeCard[]>(["recipe-bookmarks"]);

      queryClient.setQueryData<RecipeCard[]>(["recipe-bookmarks"], (current) => {
        const list = current ?? [];
        if (list.some((item) => item.id === recipeId)) {
          return list.filter((item) => item.id !== recipeId);
        }
        // Placeholder row — only `id` is consulted for `isBookmarked`, and
        // onSuccess's invalidateQueries replaces it with the real recipe
        // record as soon as the refetch lands.
        return [...list, optimisticPlaceholder(recipeId)];
      });

      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      if (context.previousItems === undefined) {
        queryClient.removeQueries({ queryKey: ["recipe-bookmarks"], exact: true });
        return;
      }
      queryClient.setQueryData<RecipeCard[]>(["recipe-bookmarks"], context.previousItems);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipe-bookmarks"] });
    },
  });

  function toggle() {
    if (isAuthenticated) {
      toggleMutation.mutate();
    } else if (guestHas) {
      guestRemove(recipeId);
    } else {
      guestAdd(recipeId);
    }
  }

  return { isBookmarked, isAvailable: true, toggle };
}
```

- [ ] **Step 4: Write `src/components/providers/recipe-bookmark-merge-sync.tsx`**

```typescript
"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

/**
 * Watches for the unauthenticated -> authenticated session transition and
 * merges any guest (localStorage) recipe bookmarks into the customer's
 * server-side bookmarks exactly once per transition. Mirrors
 * wishlist-merge-sync.tsx's shape exactly.
 */
export function RecipeBookmarkMergeSync() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const prevStatus = useRef(status);

  useEffect(() => {
    const justAuthenticated = prevStatus.current !== "authenticated" && status === "authenticated";
    prevStatus.current = status;
    if (!justAuthenticated) return;

    const guestItems = useRecipeBookmarkStore.getState().items;
    if (guestItems.length === 0) return;

    fetch("/api/recipes/bookmarks/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeIds: guestItems }),
    })
      .then(() => {
        useRecipeBookmarkStore.getState().clear();
        queryClient.invalidateQueries({ queryKey: ["recipe-bookmarks"] });
      })
      .catch(() => {
        // Merge failure leaves the guest store intact, so it's retried on
        // the next authenticated transition rather than silently losing
        // the customer's bookmarks.
      });
  }, [status, queryClient]);

  return null;
}
```

- [ ] **Step 5: Register the provider in `src/app/providers.tsx`**

```typescript
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

import { RecipeBookmarkMergeSync } from "@/components/providers/recipe-bookmark-merge-sync";
import { WishlistMergeSync } from "@/components/providers/wishlist-merge-sync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <WishlistMergeSync />
        <RecipeBookmarkMergeSync />
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 6: Write the store test**

```typescript
// tests/unit/recipe-bookmark-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
});

describe("useRecipeBookmarkStore", () => {
  it("adds a recipe id", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("does not add a duplicate", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("removes a recipe id", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().remove("r1");
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });

  it("has() reflects current membership", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(useRecipeBookmarkStore.getState().has("r1")).toBe(true);
    expect(useRecipeBookmarkStore.getState().has("r2")).toBe(false);
  });

  it("clear() empties the list", () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r2");
    useRecipeBookmarkStore.getState().clear();
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });

  it("persists across store instances via localStorage", () => {
    useRecipeBookmarkStore.getState().add("r1");
    expect(localStorage.getItem("oristor-recipe-bookmarks")).toContain("r1");
  });
});
```

- [ ] **Step 7: Write the hook test**

```typescript
// tests/unit/use-recipe-bookmark.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { useRecipeBookmark } = await import("@/hooks/use-recipe-bookmark");

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("useRecipeBookmark — guest", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "unauthenticated" }));

  it("is available and starts un-bookmarked", () => {
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isBookmarked).toBe(false);
  });

  it("toggling adds to the guest store", () => {
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    act(() => result.current.toggle());
    expect(useRecipeBookmarkStore.getState().items).toEqual(["r1"]);
  });

  it("toggling again removes from the guest store", () => {
    useRecipeBookmarkStore.getState().add("r1");
    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    act(() => result.current.toggle());
    expect(useRecipeBookmarkStore.getState().items).toEqual([]);
  });
});

describe("useRecipeBookmark — authenticated", () => {
  beforeEach(() => mockUseSession.mockReturnValue({ status: "authenticated" }));

  it("reflects server bookmark state from GET /api/recipes/bookmarks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "r1" }] }) }));

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));
  });

  it("POSTs to the slug-routed endpoint when toggled while not bookmarked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/recipes/recipe-one/bookmark", expect.objectContaining({ method: "POST" })),
    );
  });

  it("DELETEs when toggled while already bookmarked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [{ id: "r1" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    act(() => result.current.toggle());

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/recipes/recipe-one/bookmark", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("flips isBookmarked optimistically, before the POST resolves", async () => {
    let releasePost: () => void = () => {};
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        await postGate;
        return { ok: true, status: 200, json: () => Promise.resolve({}) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ items: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    act(() => result.current.toggle());

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    await act(async () => {
      releasePost();
    });
  });

  it("rolls back the optimistic change when the request fails", async () => {
    let releaseDelete: () => void = () => {};
    const deleteGate = new Promise<void>((resolve) => {
      releaseDelete = resolve;
    });
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        await deleteGate;
        return { ok: false, status: 500, json: () => Promise.resolve({}) };
      }
      return { ok: true, status: 200, json: () => Promise.resolve({ items: [{ id: "r1" }] }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRecipeBookmark("r1", "recipe-one"), { wrapper });
    await waitFor(() => expect(result.current.isBookmarked).toBe(true));

    act(() => result.current.toggle());
    await waitFor(() => expect(result.current.isBookmarked).toBe(false));

    await act(async () => {
      releaseDelete();
    });

    await waitFor(() => expect(result.current.isBookmarked).toBe(true));
  });
});
```

- [ ] **Step 8: Write the merge-sync test**

```typescript
// tests/unit/recipe-bookmark-merge-sync.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { RecipeBookmarkMergeSync } = await import("@/components/providers/recipe-bookmark-merge-sync");
const { useRecipeBookmarkStore } = await import("@/lib/stores/recipe-bookmark-store");

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("RecipeBookmarkMergeSync", () => {
  it("merges guest items and clears the store when the session becomes authenticated", async () => {
    useRecipeBookmarkStore.getState().add("r1");
    useRecipeBookmarkStore.getState().add("r2");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient();

    mockUseSession.mockReturnValue({ status: "unauthenticated" });
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    mockUseSession.mockReturnValue({ status: "authenticated" });
    rerender(
      <QueryClientProvider client={queryClient}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/recipes/bookmarks/merge",
        expect.objectContaining({ method: "POST", body: JSON.stringify({ recipeIds: ["r1", "r2"] }) }),
      ),
    );
    await waitFor(() => expect(useRecipeBookmarkStore.getState().items).toEqual([]));
  });

  it("does not call merge when there are no guest items", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockUseSession.mockReturnValue({ status: "authenticated" });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <RecipeBookmarkMergeSync />
      </QueryClientProvider>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 9: Run the tests**

Run: `npm run test -- recipe-bookmark-store use-recipe-bookmark recipe-bookmark-merge-sync`
Expected: PASS (all tests).

- [ ] **Step 10: Commit**

```bash
git add src/lib/stores/recipe-bookmark-store.ts src/lib/api/recipe-bookmark-client.ts src/hooks/use-recipe-bookmark.ts src/components/providers/recipe-bookmark-merge-sync.tsx src/app/providers.tsx tests/unit/recipe-bookmark-store.test.ts tests/unit/use-recipe-bookmark.test.tsx tests/unit/recipe-bookmark-merge-sync.test.tsx
git commit -m "feat: add guest recipe bookmark store, hook, and merge-sync provider"
```

---

## Task 10: `RecipeRatingStars`, `RecipeBookmarkButton`, and their integration into `RecipeCard` and the detail page header

**Files:**
- Create: `src/components/storefront/recipes/recipe-rating-stars.tsx`
- Create: `src/components/storefront/recipes/recipe-bookmark-button.tsx`
- Modify: `src/components/storefront/recipes/recipe-card.tsx`
- Modify: `src/app/(storefront)/recipes/[slug]/page.tsx`
- Test: `tests/unit/recipe-bookmark-button.test.tsx`
- Test: `tests/unit/recipe-rating-stars.test.tsx`

**Interfaces:**
- Consumes: `useRecipeBookmark` from Task 9.
- Produces: `RecipeRatingStars({ avgRating, ratingCount, className? })` (Server Component); `RecipeBookmarkButton({ recipeId, recipeSlug, variant?, className? })` (Client Component). Task 11 does not depend on either — this task's two components are self-contained.

- [ ] **Step 1: Write `src/components/storefront/recipes/recipe-rating-stars.tsx`**

```typescript
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface RecipeRatingStarsProps {
  avgRating: number | null;
  ratingCount: number;
  className?: string;
}

/**
 * Server Component, display-only (STORY-022). One screen-reader summary
 * label, not five icons read individually — matches
 * product/reviews/star-rating.tsx's existing pattern. Renders "No reviews
 * yet." instead of a 0-star row when the recipe has no Approved reviews,
 * matching Recipe.avgRating's existing nullable-until-rated convention
 * (STORY-017) — never show "0.0 stars" for an unrated recipe.
 */
export function RecipeRatingStars({ avgRating, ratingCount, className }: RecipeRatingStarsProps) {
  if (avgRating === null || ratingCount === 0) {
    return <p className={cn("text-small text-charcoal/70", className)}>No reviews yet.</p>;
  }

  const filled = Math.round(avgRating);
  return (
    <span
      role="img"
      aria-label={`Rated ${avgRating.toFixed(1)} out of 5 from ${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`}
      className={cn("inline-flex items-center gap-1 text-gold", className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= filled ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
      <span aria-hidden="true" className="ml-1 text-small text-charcoal">
        {avgRating.toFixed(1)} ({ratingCount})
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Write `src/components/storefront/recipes/recipe-bookmark-button.tsx`**

```typescript
"use client";

import { Bookmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useRecipeBookmark } from "@/hooks/use-recipe-bookmark";
import { cn } from "@/lib/utils";

interface RecipeBookmarkButtonProps {
  recipeId: string;
  recipeSlug: string;
  /** "icon": the RecipeCard corner toggle (STORY-017 grid). "labelled": the detail page's button with visible text. */
  variant?: "icon" | "labelled";
  className?: string;
}

/**
 * Client Component, optimistic toggle (STORY-022). Kept isolated so RecipeCard,
 * which renders it, can stay a Server Component — Next.js lets a Server
 * Component render a Client Component child without becoming one itself.
 * This is a deliberate improvement over the ProductCard precedent, where
 * the whole card had to become a Client Component to call useWishlist
 * directly.
 */
export function RecipeBookmarkButton({ recipeId, recipeSlug, variant = "icon", className }: RecipeBookmarkButtonProps) {
  const bookmark = useRecipeBookmark(recipeId, recipeSlug);
  const label = bookmark.isBookmarked ? "Remove bookmark" : "Bookmark this recipe";

  if (variant === "labelled") {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={!bookmark.isAvailable}
        aria-pressed={bookmark.isBookmarked}
        onClick={() => bookmark.toggle()}
        className={cn("gap-2", className)}
      >
        <Bookmark className={cn("size-4", bookmark.isBookmarked && "fill-current")} aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={!bookmark.isAvailable}
      aria-pressed={bookmark.isBookmarked}
      aria-label={label}
      className={cn(
        "absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background",
        className,
      )}
      onClick={(event) => {
        // RecipeCard's title Link stretches an invisible ::after overlay
        // over the whole <article> (the same CSS trick ProductCard's own
        // wrapping <Link> uses) — without these two calls, a click here
        // would also navigate to the recipe instead of only toggling the
        // bookmark.
        event.preventDefault();
        event.stopPropagation();
        bookmark.toggle();
      }}
    >
      <Bookmark className={bookmark.isBookmarked ? "fill-current" : undefined} aria-hidden="true" />
    </Button>
  );
}
```

- [ ] **Step 3: Integrate into `src/components/storefront/recipes/recipe-card.tsx`**

Add the import:

```typescript
import { RecipeBookmarkButton } from "@/components/storefront/recipes/recipe-bookmark-button";
```

Move the existing video-play badge from `top-2 right-2` to `top-2 left-2` (freeing the right corner for the new bookmark toggle), and add the bookmark button as a sibling inside the same image `<div>`:

```typescript
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        <Image
          src={recipe.heroImage}
          alt={recipe.heroImageAlt}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
        />
        {recipe.hasVideo && (
          <span
            role="img"
            aria-label="Video available"
            className="absolute top-2 left-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Play className="size-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
        <RecipeBookmarkButton recipeId={recipe.id} recipeSlug={recipe.slug} />
      </div>
```

(Only the `top-2 right-2` → `top-2 left-2` change on the existing `<span>` and the new `<RecipeBookmarkButton>` line are new; everything else in this block is unchanged — locate it by the existing `{recipe.hasVideo && (` line.)

- [ ] **Step 4: Integrate into the detail page header, `src/app/(storefront)/recipes/[slug]/page.tsx`**

Add the two imports:

```typescript
import { RecipeBookmarkButton } from "@/components/storefront/recipes/recipe-bookmark-button";
import { RecipeRatingStars } from "@/components/storefront/recipes/recipe-rating-stars";
```

Add a new row directly after the existing dietary-tags block (locate it by `{recipe.dietaryTags.length > 0 && (`) and before the closing `</div>` of that same right-column `<div>`:

```typescript
          {recipe.dietaryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.dietaryTags.map((tag) => (
                <Badge key={tag.slug} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <RecipeRatingStars avgRating={recipe.avgRating} ratingCount={recipe.ratingCount} />
            <RecipeBookmarkButton recipeId={recipe.id} recipeSlug={recipe.slug} variant="labelled" />
          </div>
        </div>
      </div>
```

(The final `</div></div>` above is the existing closing tags for the right column and the two-column grid — only the new `<div className="mt-4 ...">` block is inserted before them.)

- [ ] **Step 5: Write the bookmark button test**

```typescript
// tests/unit/recipe-bookmark-button.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecipeBookmarkStore } from "@/lib/stores/recipe-bookmark-store";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

const { RecipeBookmarkButton } = await import("@/components/storefront/recipes/recipe-bookmark-button");

function renderButton(variant?: "icon" | "labelled") {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RecipeBookmarkButton recipeId="r1" recipeSlug="recipe-one" variant={variant} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useRecipeBookmarkStore.setState({ items: [] });
  vi.restoreAllMocks();
  mockUseSession.mockReturnValue({ status: "unauthenticated" });
});

describe("RecipeBookmarkButton", () => {
  it("renders an aria-pressed button with the un-bookmarked label by default", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Bookmark this recipe" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("toggling flips the label and aria-pressed state (guest path)", async () => {
    renderButton();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Bookmark this recipe" }));

    expect(screen.getByRole("button", { name: "Remove bookmark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("labelled variant renders visible text, not only an aria-label", () => {
    renderButton("labelled");
    expect(screen.getByText("Bookmark this recipe")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Write the `RecipeRatingStars` test**

```typescript
// tests/unit/recipe-rating-stars.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipeRatingStars } from "@/components/storefront/recipes/recipe-rating-stars";

describe("RecipeRatingStars", () => {
  it("renders \"No reviews yet.\" for a recipe with no Approved reviews, never \"0.0 stars\"", () => {
    render(<RecipeRatingStars avgRating={null} ratingCount={0} />);

    expect(screen.getByText("No reviews yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders the star summary with a computed aria-label for a rated recipe", () => {
    render(<RecipeRatingStars avgRating={4.5} ratingCount={2} />);

    expect(screen.getByRole("img", { name: "Rated 4.5 out of 5 from 2 ratings" })).toBeInTheDocument();
    expect(screen.getByText("4.5 (2)")).toBeInTheDocument();
  });

  it("uses singular \"rating\" for a count of exactly 1", () => {
    render(<RecipeRatingStars avgRating={5} ratingCount={1} />);

    expect(screen.getByRole("img", { name: "Rated 5.0 out of 5 from 1 rating" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npm run test -- recipe-bookmark-button recipe-rating-stars`
Expected: PASS (all tests).

- [ ] **Step 8: Manually verify in the browser**

```bash
npm run dev
```

Visit `/recipes` and confirm: the bookmark toggle appears in the top-right corner of every `RecipeCard`, the video badge (on cards with a video) has moved to the top-left and no longer overlaps it, and clicking the bookmark toggle does not navigate to the recipe detail page. Visit `/recipes/sri-lankan-chicken-curry` and confirm the star rating (from Task 8's seed data) and a labelled "Bookmark this recipe" button both appear near the title.

- [ ] **Step 9: Commit**

```bash
git add src/components/storefront/recipes/recipe-rating-stars.tsx src/components/storefront/recipes/recipe-bookmark-button.tsx src/components/storefront/recipes/recipe-card.tsx "src/app/(storefront)/recipes/[slug]/page.tsx" tests/unit/recipe-bookmark-button.test.tsx tests/unit/recipe-rating-stars.test.tsx
git commit -m "feat: add RecipeRatingStars and RecipeBookmarkButton, wire into RecipeCard and detail page"
```

---

## Task 11: `RecipeReviewForm`, `RecipeReviewList`, `RecipeReviewsSection`, and detail-page integration

**Files:**
- Create: `src/lib/api/recipe-review-client.ts`
- Create: `src/components/storefront/recipes/reviews/recipe-review-form.tsx`
- Create: `src/components/storefront/recipes/reviews/recipe-review-list.tsx`
- Create: `src/components/storefront/recipes/reviews/recipe-reviews-section.tsx`
- Modify: `src/app/(storefront)/recipes/[slug]/page.tsx`
- Test: `tests/unit/recipe-review-form.test.tsx`

**Interfaces:**
- Consumes: the 5 routes from Task 5 (via fetch, not import); `recipeReviewInputSchema`/`RecipeReviewInput`, `RECIPE_REVIEW_SORTS`/`RecipeReviewSort`, `RECIPE_REVIEW_PAGE_SIZE`/`RecipeReviewPageQuery`/`RecipeReviewPage`/`OwnRecipeReview`/`RecipeReviewStatusValue` from Task 2; `listApprovedReviewsForRecipe` from Task 4.
- Produces: `RecipeReviewsSection({ recipeSlug, initialReviewPage })` — the only export the detail page needs.

- [ ] **Step 1: Write `src/lib/api/recipe-review-client.ts`**

```typescript
import type { OwnRecipeReview, RecipeReviewPage, RecipeReviewPageQuery } from "@/types/recipe-review";
import type { RecipeReviewInput } from "@/validation/recipe-review.schema";

/**
 * Browser-side wrapper around the recipe reviews API (STORY-022). Every
 * function throws RecipeReviewApiError on a non-2xx response, carrying the
 * status and any per-field validation errors so the form can show them.
 * Mirrors review-client.ts's shape.
 */
export class RecipeReviewApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<keyof RecipeReviewInput, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<keyof RecipeReviewInput, string[]>> = {}) {
    super(message);
    this.name = "RecipeReviewApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Partial<Record<keyof RecipeReviewInput, string[]>>;
}

async function toApiError(response: Response): Promise<RecipeReviewApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new RecipeReviewApiError(
    body?.error ?? `Request failed (${response.status})`,
    response.status,
    body?.fieldErrors ?? {},
  );
}

function reviewsUrl(recipeSlug: string): string {
  return `/api/recipes/${encodeURIComponent(recipeSlug)}/reviews`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function fetchRecipeReviewPage(recipeSlug: string, query: RecipeReviewPageQuery): Promise<RecipeReviewPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sort: query.sort });
  const response = await fetch(`${reviewsUrl(recipeSlug)}?${params.toString()}`);
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as RecipeReviewPage;
}

export async function fetchMyRecipeReview(recipeSlug: string): Promise<OwnRecipeReview | null> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/mine`);
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview | null }).review;
}

export async function postRecipeReview(recipeSlug: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const response = await fetch(reviewsUrl(recipeSlug), jsonInit("POST", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview }).review;
}

export async function patchRecipeReview(recipeSlug: string, reviewId: string, input: RecipeReviewInput): Promise<OwnRecipeReview> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/${encodeURIComponent(reviewId)}`, jsonInit("PATCH", input));
  if (!response.ok) throw await toApiError(response);
  return ((await response.json()) as { review: OwnRecipeReview }).review;
}

export async function deleteRecipeReview(recipeSlug: string, reviewId: string): Promise<void> {
  const response = await fetch(`${reviewsUrl(recipeSlug)}/${encodeURIComponent(reviewId)}`, { method: "DELETE" });
  if (!response.ok) throw await toApiError(response);
}
```

- [ ] **Step 2: Write `src/components/storefront/recipes/reviews/recipe-review-form.tsx`**

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  deleteRecipeReview,
  fetchMyRecipeReview,
  patchRecipeReview,
  postRecipeReview,
  RecipeReviewApiError,
} from "@/lib/api/recipe-review-client";
import { cn } from "@/lib/utils";
import type { OwnRecipeReview, RecipeReviewStatusValue } from "@/types/recipe-review";
import { recipeReviewInputSchema, type RecipeReviewInput } from "@/validation/recipe-review.schema";

const statusNotes: Record<Exclude<RecipeReviewStatusValue, "Pending">, string> = {
  Approved: "Your review has been approved and is now visible on this recipe.",
  Rejected: "Your review wasn't approved for publication.",
  Hidden: "Your review is no longer shown on this recipe.",
};

const reviewFields = ["rating", "reviewText"] as const;

export function RecipeReviewForm({ recipeSlug }: { recipeSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(`/recipes/${recipeSlug}`);
    return (
      <p className="text-small text-charcoal">
        <Link href={`/account/login?callbackUrl=${callbackUrl}`} className="font-medium underline underline-offset-4">
          Sign in to write a review
        </Link>
      </p>
    );
  }
  return <SignedInReviewPanel recipeSlug={recipeSlug} />;
}

function SignedInReviewPanel({ recipeSlug }: { recipeSlug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["my-recipe-review", recipeSlug];
  const { data: myReview, isPending, isError } = useQuery({ queryKey, queryFn: () => fetchMyRecipeReview(recipeSlug) });
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const withdraw = useMutation({
    mutationFn: (reviewId: string) => deleteRecipeReview(recipeSlug, reviewId),
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
      <RecipeReviewFormFields
        recipeSlug={recipeSlug}
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

interface RecipeReviewFormFieldsProps {
  recipeSlug: string;
  existing: OwnRecipeReview | null | undefined;
  onSaved: (review: OwnRecipeReview) => void;
  /** 409: the customer already has a review, or it's no longer Pending. */
  onConflict: () => void;
  onCancel?: () => void;
}

function RecipeReviewFormFields({ recipeSlug, existing, onSaved, onConflict, onCancel }: RecipeReviewFormFieldsProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RecipeReviewInput>({
    resolver: zodResolver(recipeReviewInputSchema),
    defaultValues: existing ? { rating: existing.rating, reviewText: existing.reviewText ?? "" } : { reviewText: "" },
  });
  // Controlled, not register(): RHF compares a radio's string value ("4")
  // with the numeric default (4) strictly, so an edited review would open
  // with no star selected.
  const { field: ratingField } = useController({ name: "rating", control });
  const selectedRating: number = ratingField.value ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = existing
        ? await patchRecipeReview(recipeSlug, existing.id, values)
        : await postRecipeReview(recipeSlug, values);
      onSaved(saved);
    } catch (error) {
      if (error instanceof RecipeReviewApiError && error.status === 409) {
        onConflict();
        return;
      }
      if (error instanceof RecipeReviewApiError && error.status === 400) {
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
        message: error instanceof RecipeReviewApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <h3 className="text-h4 font-heading text-charcoal">{existing ? "Edit your review" : "Write a review"}</h3>

      <fieldset aria-describedby={errors.rating ? "recipe-review-rating-error" : undefined}>
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
          <p id="recipe-review-rating-error" className="mt-1 text-small text-destructive">
            {errors.rating.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="recipe-review-text" className="text-small font-medium text-charcoal">
          Your review (optional)
        </label>
        <textarea
          id="recipe-review-text"
          rows={5}
          aria-invalid={errors.reviewText ? true : undefined}
          aria-describedby={errors.reviewText ? "recipe-review-text-error" : undefined}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          {...register("reviewText")}
        />
        {errors.reviewText && (
          <p id="recipe-review-text-error" className="text-small text-destructive">
            {errors.reviewText.message}
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

- [ ] **Step 3: Write `src/components/storefront/recipes/reviews/recipe-review-list.tsx`**

```typescript
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchRecipeReviewPage } from "@/lib/api/recipe-review-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { RECIPE_REVIEW_SORTS, type RecipeReviewPage, type RecipeReviewPageQuery, type RecipeReviewSort } from "@/types/recipe-review";

const sortLabels: Record<RecipeReviewSort, string> = {
  recent: "Most recent",
  highest: "Highest rating",
  lowest: "Lowest rating",
};

/**
 * A single review's star row — a pure `rating: number`, unlike
 * RecipeRatingStars (which also handles the recipe-wide null/empty
 * aggregate case). Local to this file since nothing else needs it.
 */
function ReviewStars({ rating }: { rating: number }) {
  return (
    <span role="img" aria-label={`${rating} out of 5 stars`} className="inline-flex items-center gap-0.5 text-gold">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={cn("size-4", star <= rating ? "fill-current" : "fill-none text-charcoal/30")}
        />
      ))}
    </span>
  );
}

interface RecipeReviewListProps {
  recipeSlug: string;
  /** The server-rendered first page (most recent). */
  initialPage: RecipeReviewPage;
  query: RecipeReviewPageQuery;
  onSortChange: (sort: RecipeReviewSort) => void;
  onPageChange: (page: number) => void;
}

export function RecipeReviewList({ recipeSlug, initialPage, query, onSortChange, onPageChange }: RecipeReviewListProps) {
  const isInitialQuery = query.page === 1 && query.sort === "recent";
  const { data, isError, isFetching } = useQuery({
    queryKey: ["recipe-reviews", recipeSlug, query],
    queryFn: () => fetchRecipeReviewPage(recipeSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-charcoal/70" aria-live="polite">
          {page.total > 0 ? `Showing ${from}–${to} of ${page.total} reviews` : ""}
        </p>
        <Select value={query.sort} onValueChange={(next) => onSortChange(next as RecipeReviewSort)}>
          <SelectTrigger aria-label="Sort reviews">
            <SelectValue>{(selected: RecipeReviewSort | null) => sortLabels[selected ?? "recent"]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {RECIPE_REVIEW_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {sortLabels[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load reviews. Please try again.
        </p>
      )}

      {page.items.length === 0 ? (
        <p className="text-small text-charcoal/70">No reviews yet.</p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((review) => (
            <li key={review.id} className="py-4">
              <article aria-labelledby={`recipe-review-${review.id}-author`}>
                <ReviewStars rating={review.rating} />
                {review.reviewText && <p className="mt-1 text-small whitespace-pre-line text-charcoal">{review.reviewText}</p>}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-caption text-charcoal/70">
                  <span id={`recipe-review-${review.id}-author`}>{review.authorName}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={review.createdAt}>{formatDisplayDate(review.createdAt)}</time>
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

- [ ] **Step 4: Write `src/components/storefront/recipes/reviews/recipe-reviews-section.tsx`**

```typescript
"use client";

import { useState } from "react";

import { RECIPE_REVIEW_PAGE_SIZE, type RecipeReviewPage, type RecipeReviewPageQuery } from "@/types/recipe-review";

import { RecipeReviewForm } from "./recipe-review-form";
import { RecipeReviewList } from "./recipe-review-list";

interface RecipeReviewsSectionProps {
  recipeSlug: string;
  /** Fetched by the detail page (Server Component) via recipe-review.service.ts's listApprovedReviewsForRecipe. */
  initialReviewPage: RecipeReviewPage;
}

/**
 * Owns the list's query state (sort, page). Kept in component state, not
 * the URL, so the detail page's URL stays canonical — mirrors
 * reviews-section.tsx.
 */
export function RecipeReviewsSection({ recipeSlug, initialReviewPage }: RecipeReviewsSectionProps) {
  const [query, setQuery] = useState<RecipeReviewPageQuery>({ page: 1, pageSize: RECIPE_REVIEW_PAGE_SIZE, sort: "recent" });

  return (
    <section aria-labelledby="recipe-reviews-heading" className="flex flex-col gap-6">
      <h2 id="recipe-reviews-heading" className="text-h3 font-heading text-charcoal">
        Customer Reviews
      </h2>
      <RecipeReviewList
        recipeSlug={recipeSlug}
        initialPage={initialReviewPage}
        query={query}
        onSortChange={(sort) => setQuery((current) => ({ ...current, sort, page: 1 }))}
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
      />
      <RecipeReviewForm recipeSlug={recipeSlug} />
    </section>
  );
}
```

- [ ] **Step 5: Integrate into `src/app/(storefront)/recipes/[slug]/page.tsx`**

Add the imports:

```typescript
import { RecipeReviewsSection } from "@/components/storefront/recipes/reviews/recipe-reviews-section";
import { listApprovedReviewsForRecipe } from "@/services/recipe-review.service";
import { RECIPE_REVIEW_PAGE_SIZE } from "@/types/recipe-review";
```

Immediately after the existing `if (!recipe) notFound();` line, add:

```typescript
  const initialReviewPage = await listApprovedReviewsForRecipe(recipe.id, {
    page: 1,
    pageSize: RECIPE_REVIEW_PAGE_SIZE,
    sort: "recent",
  });
```

Insert a new section immediately before the existing `<div className="mt-10"><RelatedRecipes recipes={recipe.relatedRecipes} /></div>` block:

```typescript
      <div className="mt-10">
        <RecipeReviewsSection recipeSlug={recipe.slug} initialReviewPage={initialReviewPage} />
      </div>
      <div className="mt-10">
        <RelatedRecipes recipes={recipe.relatedRecipes} />
      </div>
```

(Only the first new `<div className="mt-10">...</div>` block is new; the `RelatedRecipes` block already exists — locate it and insert directly above it.)

- [ ] **Step 6: Write the review form test**

```typescript
// tests/unit/recipe-review-form.test.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { RecipeReviewForm } = await import("@/components/storefront/recipes/reviews/recipe-review-form");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const pending = { id: "r1", rating: 4, reviewText: "Rich and aromatic.", status: "Pending" };

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
      <RecipeReviewForm recipeSlug="chicken-curry" />
    </QueryClientProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "4 stars" }));
  await user.type(screen.getByLabelText("Your review (optional)"), "Rich and aromatic.");
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("RecipeReviewForm", () => {
  it("renders nothing while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });

    const { container } = renderForm();

    expect(container).toBeEmptyDOMElement();
  });

  it("asks guests to sign in, returning them to this recipe", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    renderForm();

    expect(screen.getByRole("link", { name: "Sign in to write a review" })).toHaveAttribute(
      "href",
      "/account/login?callbackUrl=%2Frecipes%2Fchicken-curry",
    );
  });

  it("validates on the client before submitting (a rating is required, review text is not)", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: null }) });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Please choose a star rating")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("submits with no review text and switches to the pending state", async () => {
    routeFetch({
      "GET /reviews/mine": () => json({ review: null }),
      "POST /reviews": () => json({ review: { ...pending, reviewText: null } }, 201),
    });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ rating: 4 });
  });

  it("shows the existing review after a 409 duplicate", async () => {
    let mineCalls = 0;
    routeFetch({
      "GET /reviews/mine": () => {
        mineCalls += 1;
        return json({ review: mineCalls === 1 ? null : pending });
      },
      "POST /reviews": () => json({ error: "You have already reviewed this recipe" }, 409),
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
      "PATCH /reviews/r1": () => json({ review: { ...pending, reviewText: "Even better" } }),
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Edit review" }));
    expect(screen.getByLabelText("Your review (optional)")).toHaveValue("Rich and aromatic.");
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();

    const textarea = screen.getByLabelText("Your review (optional)");
    await user.clear(textarea);
    await user.type(textarea, "Even better");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(String(patch?.[0])).toMatch(/\/api\/recipes\/chicken-curry\/reviews\/r1$/);
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
    routeFetch({ "GET /reviews/mine": () => json({ review: { ...pending, status: "Approved" } }) });

    renderForm();

    expect(await screen.findByText("Your review has been approved and is now visible on this recipe.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit review" })).not.toBeInTheDocument();
  });

  it("reports a failed load of the customer's review", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ error: "boom" }, 500) });

    renderForm();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your review"));
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npm run test -- recipe-review-form`
Expected: PASS (all tests).

- [ ] **Step 8: Manually verify in the browser**

```bash
npm run dev
```

Sign in as `nadeesha.demo@oristor.test` (or any seeded customer) and visit `/recipes/dhal-curry-parippu` (has one seeded Approved review from Task 8). Confirm: the Approved review renders in the list with the correct star count, sorting Newest/Highest/Lowest re-orders correctly, submitting a new review (as a different signed-in account) shows the "pending approval" state and does not appear in the public list until approved.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/recipe-review-client.ts src/components/storefront/recipes/reviews "src/app/(storefront)/recipes/[slug]/page.tsx" tests/unit/recipe-review-form.test.tsx
git commit -m "feat: add RecipeReviewForm/List/Section and wire into the recipe detail page"
```

---

## Task 12: Playwright e2e tests

**Files:**
- Create: `tests/e2e/recipe-reviews.spec.ts`
- Create: `tests/e2e/recipe-bookmarks.spec.ts`

**Interfaces:**
- Consumes: `signInAs` from `tests/e2e/helpers/auth.ts` (existing); `submitReview`/`advanceRecipeReviewToApproved` (Task 4), `addBookmark` (Task 6), `createRecipe`/`createRecipeCategory` (existing) — all called directly for fast, deterministic test setup, matching `product-reviews.spec.ts`'s/`wishlist.spec.ts`'s existing convention of seeding fixtures directly rather than through the UI.
- Produces: nothing consumed by later tasks — this is the final functional task before documentation.

- [ ] **Step 1: Write `tests/e2e/recipe-reviews.spec.ts`**

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { advanceRecipeReviewToApproved, submitReview } from "@/services/recipe-review.service";

import { signInAs } from "./helpers/auth";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-review-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-review-";
const EMAIL_DOMAIN = "@e2e-recipe-review.test";

async function seedRecipe(n: number, title: string) {
  const category = await createRecipeCategory({ name: `E2E Category ${n}`, slug: `${CATEGORY_SLUG_PREFIX}${n}` });
  return createRecipe({
    slug: `${RECIPE_SLUG_PREFIX}${n}`,
    title,
    shortDescription: "A test recipe for the reviews e2e suite.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
  });
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

test.describe("Recipe reviews", () => {
  // Both tests clean up the same slug/email prefixes in beforeEach — same
  // reasoning as product-reviews.spec.ts's own test.describe.configure.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted review stays private until it is approved, then can be edited and withdrawn", async ({ page }) => {
    const recipe = await seedRecipe(1, "E2E Review Curry");
    const user = await seedUser("writer", "Asha W.");
    await signInAs(page, user.id);

    await page.goto(`/recipes/${recipe.slug}`);
    await page.getByRole("radio", { name: "4 stars" }).check({ force: true });
    await page.getByLabel("Your review (optional)").fill("Toasted notes come through nicely.");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.reload();
    const reviews = page.locator('section[aria-labelledby="recipe-reviews-heading"]');
    await expect(reviews.getByText("No reviews yet.")).toBeVisible();

    await page.getByRole("button", { name: "Edit review" }).click();
    await page.getByRole("radio", { name: "5 stars" }).check({ force: true });
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Thanks! Your review is pending approval.")).toBeVisible();

    await page.getByRole("button", { name: "Withdraw" }).click();
    await page.getByRole("button", { name: "Yes, withdraw" }).click();
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();
  });

  test("approved reviews show on the recipe detail page, sorted and paginated", async ({ page }) => {
    const recipe = await seedRecipe(2, "E2E Reviewed Watalappan");
    const authorA = await seedUser("a", "Nimal S.");
    const authorB = await seedUser("b", "Ruwani D.");
    const reviewA = await submitReview(authorA.id, recipe.slug, { rating: 5, reviewText: "Perfectly set." });
    const reviewB = await submitReview(authorB.id, recipe.slug, { rating: 3, reviewText: "A bit too sweet for me." });
    await advanceRecipeReviewToApproved(reviewA.id);
    await advanceRecipeReviewToApproved(reviewB.id);

    await page.goto(`/recipes/${recipe.slug}`);
    const reviews = page.locator('section[aria-labelledby="recipe-reviews-heading"]');
    await expect(reviews.getByText("Showing 1–2 of 2 reviews")).toBeVisible();
    await expect(reviews.getByText("Perfectly set.")).toBeVisible();
    await expect(reviews.getByText("A bit too sweet for me.")).toBeVisible();
    await expect(page.getByRole("img", { name: "Rated 4.0 out of 5 from 2 ratings" })).toBeVisible();

    await reviews.getByRole("combobox", { name: "Sort reviews" }).click();
    await page.getByRole("option", { name: "Lowest rating" }).click();
    const firstReview = reviews.locator("article").first();
    await expect(firstReview).toContainText("A bit too sweet for me.");
  });

  test("an unauthenticated visitor is prompted to sign in, with callbackUrl preserved", async ({ page }) => {
    const recipe = await seedRecipe(3, "E2E Signed-Out Curry");

    await page.goto(`/recipes/${recipe.slug}`);

    const signInLink = page.getByRole("link", { name: "Sign in to write a review" });
    await expect(signInLink).toHaveAttribute("href", `/account/login?callbackUrl=%2Frecipes%2F${recipe.slug}`);
  });

  test("the review form's star input has no detectable accessibility violations", async ({ page }) => {
    const recipe = await seedRecipe(4, "E2E Accessible Kottu");
    await signInAs(page, (await seedUser("c", "Dilani K.")).id);

    await page.goto(`/recipes/${recipe.slug}`);
    await expect(page.getByRole("button", { name: "Submit review" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="recipe-reviews-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Write `tests/e2e/recipe-bookmarks.spec.ts`**

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { prisma } from "@/lib/db";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

import { signInAs } from "./helpers/auth";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-bookmark-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-bookmark-";
const EMAIL_DOMAIN = "@e2e-recipe-bookmark.test";

async function seedRecipe(n: number, title: string) {
  const category = await createRecipeCategory({ name: `E2E Bookmark Category ${n}`, slug: `${CATEGORY_SLUG_PREFIX}${n}` });
  return createRecipe({
    slug: `${RECIPE_SLUG_PREFIX}${n}`,
    title,
    shortDescription: "A test recipe for the bookmarks e2e suite.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
  });
}

async function seedUser(label: string, name: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name } });
}

test.describe("Recipe bookmarks", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
    await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("toggling on the detail page is optimistic and persists across reload", async ({ page }) => {
    const recipe = await seedRecipe(1, "E2E Bookmark Chicken Curry");
    const user = await seedUser("a", "Kasun P.");
    await signInAs(page, user.id);

    await page.goto(`/recipes/${recipe.slug}`);
    const button = page.getByRole("button", { name: "Bookmark this recipe" });
    await button.click();
    // Optimistic: the label flips before any network round-trip could have
    // resolved (Playwright's default assertion polling would still pass on
    // a slow non-optimistic implementation, so this specifically does not
    // wait past the click).
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  });

  test("toggling on the recipe card does not navigate to the recipe", async ({ page }) => {
    const recipe = await seedRecipe(2, "E2E Bookmark Watalappan");
    const user = await seedUser("b", "Nadeesha F.");
    await signInAs(page, user.id);

    await page.goto("/recipes");
    const card = page.locator("article", { hasText: recipe.title });
    await card.getByRole("button", { name: "Bookmark this recipe" }).click();

    await expect(card.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await expect(page).toHaveURL(/\/recipes$/);
  });

  test("an unauthenticated visitor bookmarking as a guest sees it appear automatically after signing in", async ({ page }) => {
    const recipe = await seedRecipe(3, "E2E Guest Bookmark Dhal");
    const user = await seedUser("c", "Ruwan D.");

    await page.goto(`/recipes/${recipe.slug}`);
    await page.getByRole("button", { name: "Bookmark this recipe" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();

    await signInAs(page, user.id);
    await page.reload();

    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
  });

  test("the bookmark toggle has no detectable accessibility violations in either state", async ({ page }) => {
    const recipe = await seedRecipe(4, "E2E Accessible Bookmark Samosas");
    await signInAs(page, (await seedUser("d", "Chamari K.")).id);

    await page.goto(`/recipes/${recipe.slug}`);
    const unbookmarkedResults = await new AxeBuilder({ page })
      .include('button[aria-pressed="false"]')
      .analyze();
    expect(unbookmarkedResults.violations).toEqual([]);

    await page.getByRole("button", { name: "Bookmark this recipe" }).click();
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    const bookmarkedResults = await new AxeBuilder({ page }).include('button[aria-pressed="true"]').analyze();
    expect(bookmarkedResults.violations).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the e2e suites**

```bash
npm run test:e2e -- recipe-reviews recipe-bookmarks
```
Expected: PASS (all tests). This spins up the dev server itself — ensure `npx prisma dev` is running first.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/recipe-reviews.spec.ts tests/e2e/recipe-bookmarks.spec.ts
git commit -m "test: add recipe reviews and bookmarks e2e coverage"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Append a new dated entry to `docs/architecture-decisions.md`**

Add this at the end of the file, after the existing STORY-021 entry (preceded by a blank line and a `---` separator, matching every other entry boundary in this file):

```markdown
---

## 2026-09-27 — STORY-022 Recipe Reviews & Bookmarks

**`RecipeBookmark` and `recipe-bookmark.service.ts` are the shared source
of truth for saved recipes — STORY-037 (Saved Recipes & Sync) must consume
`listBookmarksForCustomer(customerId): Promise<RecipeCard[]>` rather than
querying `RecipeBookmark` directly or introducing a second bookmark table.**
`RecipeBookmark` is a flat `{ id, recipeId, customerId, createdAt }` model
with `@@unique([recipeId, customerId])` — deliberately not a
`Wishlist`-style two-table container, since a bookmark is a simple
recipe-to-customer relationship with no need for multiple named lists.
`addBookmark`/`removeBookmark`/`listBookmarksForCustomer`/
`mergeGuestBookmarks` (`src/services/recipe-bookmark.service.ts`) are the
only sanctioned write/read paths; `src/repositories/recipe-bookmark.repository.ts`
is the only file that imports Prisma for this model. STORY-037's
account-side dashboard should call `listBookmarksForCustomer` directly for
its list view.

**`Recipe.avgRating`/`ratingCount` recalculation strategy: service-level
recompute on every status-changing write, inside the same transaction,
row-locked — not a trigger, and not a scheduled job.** Chosen because a
review's status change is already a single, identifiable write path
(`recipe-review.service.ts`'s `changeRecipeReviewStatus`, the only function
that mutates `RecipeReview.status`), so there is exactly one place that
needs to trigger recalculation — a DB trigger or background job would add
operational complexity (migration-managed trigger functions, or a queue
and worker) for no benefit over a direct transactional call at that single
call site. `recipe-review.repository.ts`'s `updateReviewStatusAndRecalculate`
does `SELECT ... FOR UPDATE` on the `Recipe` row before re-aggregating
`AVG(rating)`/`COUNT(*)` over `Approved`-only reviews, so two concurrent
status changes on the same recipe can't produce a lost update (the second
transaction blocks until the first commits, then re-reads the post-commit
state). Zero `Approved` reviews resolves to `avgRating: null`, `ratingCount:
0` — never `0` for the average, matching `Recipe.avgRating`'s existing
nullable-until-rated convention from STORY-017. This is the same pattern
`review.repository.ts`'s `updateStatusAndRecalculate` already established
for `Product`/`ProductRatingSummary` (STORY-015) — any future review-heavy
story needing the same guarantee should reuse this shape (row-lock the
parent, re-aggregate from source rows inside the same transaction, write
back conditionally on the pre-change status) rather than inventing a new
one.

**`RecipeReview`'s lifecycle is intentionally simpler than `Review`'s:**
`Pending → Approved | Rejected`, `Approved → Hidden` — four states, not
`Review`'s five (no separate "Approved but not yet Published" step,
because approval and publication are the same event for recipe reviews).
This mirrors `BlogComment`'s lifecycle shape exactly
(`canTransitionRecipeReview`/`changeRecipeReviewStatus` in
`recipe-review.service.ts` mirror `blog.service.ts`'s
`canTransitionComment`/`changeCommentStatus`), not `review.service.ts`'s
more complex one. No moderator-audit columns (`reviewedById`,
`moderatorNote`, a separate `publishedAt`) exist on `RecipeReview` at this
story's stage — Epic 07's Reviews Moderation Console (STORY-045) can add
them alongside its own UI if it needs them, the same deferral already made
for `BlogComment`.

**Two independent `RecipeNotFoundError` classes exist by design** — one in
`recipe-review.errors.ts`, one in `recipe-bookmark.errors.ts`. Reviews and
Bookmarks import nothing from each other; introducing a shared error
module for one ~10-line class would be exactly the kind of unnecessary
coupling the story's own design spec warned against.

**Seed data fix: `prisma/seed-recipes.ts`'s `avgRating`/`ratingCount` were
previously hardcoded fake numbers (e.g. `sri-lankan-chicken-curry:
avgRating: 4.9, ratingCount: 58`) with zero backing `RecipeReview` rows —
written before this story existed.** Now that these columns are a
review-derived invariant, they were nulled out and replaced with real
`RecipeReview` rows walked through the actual `submitReview`/
`advanceRecipeReviewToApproved` workflow in `prisma/seed.ts` (mirroring how
`prisma/seed.ts` already does this for `Product`/`Review`). Anyone adding a
new seeded recipe with a nonzero `avgRating` in the future must back it
with real seeded reviews the same way — a fake rating with no reviews
behind it is a bug, not a shortcut, once a working review system exists.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture-decisions.md
git commit -m "docs: document recipe review recalculation strategy and bookmark contract for STORY-037"
```

---

## Final Verification

After all 13 tasks are complete:

- [ ] `npx tsc --noEmit -p tsconfig.json` — no errors.
- [ ] `npm run lint` — no errors.
- [ ] `npm run test` (with `npx prisma dev` running) — full suite passes, including every file this plan added.
- [ ] `npm run test:e2e` — full suite passes, including `recipe-reviews.spec.ts` and `recipe-bookmarks.spec.ts`.
- [ ] Manually re-verify in the browser: `/recipes` grid shows bookmark toggles with no video-badge overlap; a recipe detail page shows the rating summary, review list, review form, and labelled bookmark button; submitting a review shows the pending-approval state; toggling a bookmark persists across reload.
- [ ] Re-read the design spec (`docs/superpowers/specs/2026-09-27-recipe-reviews-bookmarks-design.md`) once more against the finished code — confirm every numbered decision (1 through 11) has a corresponding implementation.
