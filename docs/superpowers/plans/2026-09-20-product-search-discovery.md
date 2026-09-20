# Product Search & Discovery (STORY-012) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the product-catalogue search engine — typo-tolerant, relevance-ranked full-text search via `pg_trgm`, a `/products/search` results page reusing STORY-010's listing UI, a lightweight suggestions endpoint, and a "did you mean" empty state — and upgrade STORY-007's header search overlay to use the same ranked matching internally, without changing its external interface.

**Architecture:** A new `search.repository.ts` holds one raw-SQL ranking query (`findRankedProductMatches`) computing a 4-tier relevance score (exact name > prefix > fuzzy/contains > other-field) plus trigram similarity, returning ids only — never full rows, so it stays small and doesn't duplicate the relational filter logic `product.repository.ts` already has. `search.service.ts` (already exists from STORY-007) gains `searchProducts()`, which takes those ranked ids, applies STORY-010's exact filter shape via a new `findProductsByIdsWithFilters` (sharing a `buildProductListingWhere` helper extracted from the existing `findPublishedProductsForListing`, not duplicated), resolves prices, and returns the same `ProductListingResult` shape `ProductGrid`/`Pagination` already consume — so the results page is a thin wrapper reusing existing UI, not a rebuild. STORY-007's `searchCatalogue()` starts calling `searchProducts()` internally for its product-matching, upgrading its quality "for free"; its own external interface (`SearchOverlay`, `/api/search`, `use-search-suggestions.ts`) is untouched, per the integration scope confirmed with the user during design.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`) with raw `$queryRaw` for trigram ranking, PostgreSQL `pg_trgm` extension (confirmed working on the local PGlite dev DB before committing to this approach), Zod, TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-product-search-discovery-design.md`

## Global Constraints

- **Service Layer pattern:** route handlers never call Prisma directly; they call `search.service.ts`, which calls repositories. No exceptions, including the new raw-SQL repository function.
- **No duplicate logic:** `findProductsByIdsWithFilters` shares `buildProductListingWhere` with `findPublishedProductsForListing`, not a re-typed copy. Non-relevance sorts in `searchProducts()` reuse the existing (now-exported) `sortCandidates()`, not a second sort implementation. `searchCatalogue()` (STORY-007) calls `searchProducts()` rather than keeping its own matching logic — `searchPublishedProducts()` is deleted once nothing calls it.
- **Query-param validation degrades, never 400s:** every field in `productSearchQuerySchema` uses `.catch(<default>)`, matching the existing `productListingQuerySchema` convention.
- **Raw SQL is always parameterized:** `$queryRaw` tagged templates only (`${value}` interpolation, which Prisma parameterizes automatically) — never `$queryRawUnsafe` with interpolated user input.
- **No fabricated ranking signals:** the "best-seller/rating boost" AC has no real data source yet (no Order model, no Review model) — follow the exact precedent `product.service.ts`'s `sortCandidates()` already set (fall back to `newest`, documented with a comment pointing at the future stories that supply real data). Do not invent a proxy signal.
- **Migration safety (PGlite-specific — see `docs/architecture-decisions.md`):** `prisma migrate dev` is unreliable beyond a fresh server's first call. This plan's migration task uses the project's already-proven offline-diff-plus-manual-apply recipe instead (`migrate diff` between two schema **files**, no database connection; apply via `db execute` + `migrate resolve --applied`) — never `migrate dev` directly.
- **Never delete the whole `%LOCALAPPDATA%\prisma-dev-nodejs\Data` directory** — it is shared with at least one other project's named `prisma dev` server (`Data\production-app\`) on this machine. Scope any data-directory reset to `Data\default\` and `Data\durable-streams\default\` only.
- **TypeScript strict mode:** no `any`, no implicit types.
- **Client/Server Component split:** the results page is a Server Component (no client fetch waterfall); the suggestions hook and any interactive pieces are `"use client"`.
- **Local DB workflow:** `npx prisma dev` must be running before `npm run test`/`npx tsc`. Run `npx tsc --noEmit -p tsconfig.json` before committing each task — this caught real bugs during STORY-007 and is now standard practice for this codebase.
- **Commit style:** Conventional Commits, each task ends with its own commit.

---

## Task 1: Enable `pg_trgm` and add trigram indexes (migration)

**Files:**
- Modify: `prisma/schema.prisma` (generator + datasource blocks)
- Create: `prisma/migrations/<timestamp>_enable_pg_trgm_search/migration.sql`

**Interfaces:**
- Produces: the `pg_trgm` extension and two GIN trigram indexes available to every later task's raw SQL.

This task does not follow the standard TDD step shape (schema/infra work, not application code) — it follows the project's documented safe migration recipe exactly. Read `docs/architecture-decisions.md`'s "Migration history note" (STORY-009 entry) and its `docs/superpowers/plans/2026-07-15-product-catalogue-data-model.md` Task 14 before starting — this task adapts that exact recipe, verified working during this plan's design phase.

- [ ] **Step 1: Update the schema**

In `prisma/schema.prisma`, change:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

to:

```prisma
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [pg_trgm]
}
```

- [ ] **Step 2: Generate the migration SQL from a file-to-file diff (zero database connection)**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_enable_pg_trgm_search"
npx prisma migrate diff --from-schema /tmp/schema-before.prisma --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_enable_pg_trgm_search/migration.sql"
rm /tmp/schema-before.prisma
```

Expected `migration.sql` content: `CREATE EXTENSION IF NOT EXISTS "pg_trgm";` and nothing else (verified during this plan's design — this exact command produces exactly this output against the unmodified base schema).

- [ ] **Step 3: Append the trigram indexes**

Prisma's schema language can't express a `gin_trgm_ops` operator-class index declaratively, so append these two statements to the same `migration.sql` file generated in Step 2:

```sql

-- CreateIndex (trigram, for fuzzy/typo-tolerant search — STORY-012)
CREATE INDEX "product_name_trgm_idx" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX "product_short_description_trgm_idx" ON "Product" USING gin ("shortDescription" gin_trgm_ops);
```

- [ ] **Step 4: Apply the migration to a fresh, isolated local server**

Stop any running `prisma dev` process:

```bash
netstat -ano | grep 51214 | grep LISTEN
# note the PID in the last column, then:
taskkill //F //PID <pid>
```

Reset **only this project's default-named server data** — never the whole `Data` directory (it's shared with another project's `production-app`-named server on this machine):

```bash
rm -rf "$LOCALAPPDATA/prisma-dev-nodejs/Data/default"
rm -rf "$LOCALAPPDATA/prisma-dev-nodejs/Data/durable-streams/default"
# If $LOCALAPPDATA isn't set in this shell, substitute the real path —
# on this machine that's C:\Users\ITAdmin\AppData\Local (verified during
# this plan's design); confirm with `echo $LOCALAPPDATA` first if unsure.
```

Start a fresh server in the background and wait for "Your local Prisma Postgres server ... is now running":

```bash
nohup npx prisma dev > /tmp/prisma-dev-migration.log 2>&1 &
disown
sleep 12 && tail -15 /tmp/prisma-dev-migration.log
```

Apply the migration in three steps against the fresh, empty database (never `migrate dev`):

```bash
npx prisma db execute --file prisma/create_migrations_table.sql
npx prisma db execute --file "prisma/migrations/<the folder from Step 2>/migration.sql"
npx prisma migrate resolve --applied "<the folder name from Step 2>"
```

- [ ] **Step 5: Verify**

```bash
npx prisma migrate status
```
Expected: `Database schema is up to date!` with the new migration listed.

```bash
npx prisma db push
```
Expected: `The database is already in sync with the Prisma schema.` (confirms the hand-applied SQL matches the schema exactly).

```bash
npx tsx --env-file=.env -e "console.log('placeholder')" > /dev/null; npx tsx --env-file=.env prisma/seed.ts
```
Expected: same `Seed complete` output the project's seed script normally produces (re-seeds the now-empty fresh database).

- [ ] **Step 6: Confirm `pg_trgm` actually works against the new indexes**

```bash
npx prisma db execute --stdin <<'EOF'
SELECT similarity('curry', 'currry') AS sim;
EOF
```
Expected: a numeric similarity value (e.g. `0.857...`), not an error.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: enable pg_trgm extension and add trigram indexes for product search"
```

---

## Task 2: Add "relevance" as a sort option

**Files:**
- Modify: `src/services/product.service.ts` (the `ProductSort` type)
- Modify: `src/lib/product-listing-params.ts` (`productSortValues`)
- Modify: `src/validation/product-listing.schema.ts` (`productSortValues`)
- Modify: `src/components/storefront/product/sort-select.tsx` (add `showRelevance` gating)
- Test: `tests/unit/sort-select.test.tsx`

**Interfaces:**
- Consumes: none new.
- Produces: `ProductSort` including `"relevance"`, `SortSelect`'s `showRelevance?: boolean` prop — consumed by Task 5 (`searchProducts()`'s sort logic) and Task 11 (the search results page).

This project defines the same sort-values literal union in three places already (a pre-existing, environment-boundary-driven duplication — `product.service.ts`'s type for service consumers, `product-listing-params.ts`'s const array for the client-safe `nuqs` parser, `product-listing.schema.ts`'s const array for the server-side Zod schema). This task extends all three consistently rather than introducing a fourth single-source-of-truth — out of scope to refactor that pattern here.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/sort-select.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SortSelect } from "@/components/storefront/product/sort-select";

describe("SortSelect", () => {
  it("does not show Relevance by default", async () => {
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);

    // Base UI Select renders options into a portal only once opened —
    // check the trigger doesn't advertise it and no option exists to open to.
    expect(screen.queryByText("Relevance")).not.toBeInTheDocument();
  });

  it("shows Relevance when showRelevance is true", async () => {
    render(<SortSelect value="relevance" onValueChange={vi.fn()} showRelevance />);

    expect(screen.getByText("Relevance")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/sort-select.test.tsx`
Expected: FAIL — `Cannot find module` or the `showRelevance` prop not recognized / "Relevance" text not found (the second case, since `value="relevance"` isn't a valid `ProductSort` yet either).

- [ ] **Step 3: Extend the three sort-value definitions**

In `src/services/product.service.ts`, change:
```ts
export type ProductSort = "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";
```
to:
```ts
export type ProductSort = "relevance" | "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";
```

In `src/lib/product-listing-params.ts`, change:
```ts
export const productSortValues = ["price-asc", "price-desc", "newest", "best-selling", "rating"] as const;
```
to:
```ts
export const productSortValues = ["relevance", "price-asc", "price-desc", "newest", "best-selling", "rating"] as const;
```

In `src/validation/product-listing.schema.ts`, apply the identical change to its own `productSortValues` const.

- [ ] **Step 4: Update `SortSelect`**

In `src/components/storefront/product/sort-select.tsx`, change:

```tsx
const sortLabels: Record<ProductSort, string> = {
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Average Rating",
};

// STORY-015 (Reviews) and the Commerce Platform epic haven't landed yet, so
// there's no real data to sort "best-selling"/"rating" by — disabled for
// now, see docs/superpowers/specs/2026-07-16-product-listing-design.md.
const disabledSorts: ProductSort[] = ["best-selling", "rating"];
const allSorts = Object.keys(sortLabels) as ProductSort[];

interface SortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
}

export function SortSelect({ value, onValueChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as ProductSort)}>
      <SelectTrigger aria-label="Sort products">
        <SelectValue placeholder="Sort by">
          {(selected: ProductSort | null) => (selected ? sortLabels[selected] : "Sort by")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allSorts.map((sort) => (
          <SelectItem key={sort} value={sort} disabled={disabledSorts.includes(sort)}>
            {disabledSorts.includes(sort) ? `${sortLabels[sort]} (coming soon)` : sortLabels[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

to:

```tsx
const sortLabels: Record<ProductSort, string> = {
  relevance: "Relevance",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Average Rating",
};

// STORY-015 (Reviews) and the Commerce Platform epic haven't landed yet, so
// there's no real data to sort "best-selling"/"rating" by — disabled for
// now, see docs/superpowers/specs/2026-07-16-product-listing-design.md.
const disabledSorts: ProductSort[] = ["best-selling", "rating"];

// "Relevance" only means something with a search query behind it (STORY-012)
// — every other listing page (category/collection browsing) defaults to
// "newest" and would show a confusing, non-functional option otherwise.
const baseSorts = (Object.keys(sortLabels) as ProductSort[]).filter((sort) => sort !== "relevance");

interface SortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
  showRelevance?: boolean;
}

export function SortSelect({ value, onValueChange, showRelevance = false }: SortSelectProps) {
  const allSorts = showRelevance ? (["relevance", ...baseSorts] as ProductSort[]) : baseSorts;

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as ProductSort)}>
      <SelectTrigger aria-label="Sort products">
        <SelectValue placeholder="Sort by">
          {(selected: ProductSort | null) => (selected ? sortLabels[selected] : "Sort by")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allSorts.map((sort) => (
          <SelectItem key={sort} value={sort} disabled={disabledSorts.includes(sort)}>
            {disabledSorts.includes(sort) ? `${sortLabels[sort]} (coming soon)` : sortLabels[sort]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/sort-select.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (the `ProductSort` extension is additive; every existing `Record<ProductSort, ...>`/switch must now handle `"relevance"` — `sortLabels` above already does; if tsc reports another exhaustiveness gap elsewhere, fix it there too before proceeding).

- [ ] **Step 7: Commit**

```bash
git add src/services/product.service.ts src/lib/product-listing-params.ts src/validation/product-listing.schema.ts src/components/storefront/product/sort-select.tsx tests/unit/sort-select.test.tsx
git commit -m "feat: add relevance as a sort option, gated behind search pages"
```

---

## Task 3: Extract shared filter builder; add findProductsByIdsWithFilters

**Files:**
- Modify: `src/repositories/product.repository.ts`
- Modify: `tests/unit/product-repository.test.ts`

**Interfaces:**
- Produces: `findProductsByIdsWithFilters(ids: string[], filters: Pick<ProductListingFilters, "allergenNamesToExclude" | "certificationIds" | "brandSlugs" | "inStock">)` — consumed by Task 5 (`searchProducts()`) and Task 6 (`getSearchSuggestions()`).
- Behavior of `findPublishedProductsForListing` must be unchanged (this is a refactor, not a behavior change) — its existing tests in `tests/unit/product-repository.test.ts` must keep passing unmodified.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/product-repository.test.ts` (inside a new `describe` block, after the existing `findPublishedProductsForListing` describe block):

```ts
describe("findProductsByIdsWithFilters", () => {
  it("returns only the given ids that match the filters", async () => {
    const peanuts = await createAllergen({ name: "Peanuts-FPIWF" });
    const included = await createProduct({
      sku: "FPIWF-1",
      slug: "fpiwf-1",
      name: "Included",
      status: "Published",
    });
    const excludedByAllergen = await createProduct({
      sku: "FPIWF-2",
      slug: "fpiwf-2",
      name: "Has Peanuts",
      status: "Published",
      allergens: { connect: [{ id: peanuts.id }] },
    });
    const notInIdList = await createProduct({
      sku: "FPIWF-3",
      slug: "fpiwf-3",
      name: "Not Requested",
      status: "Published",
    });

    const results = await findProductsByIdsWithFilters(
      [included.id, excludedByAllergen.id, notInIdList.id].slice(0, 2),
      { allergenNamesToExclude: ["Peanuts-FPIWF"] },
    );

    expect(results.map((p) => p.slug)).toEqual(["fpiwf-1"]);
  });

  it("returns an empty array immediately for an empty id list", async () => {
    const results = await findProductsByIdsWithFilters([], {});

    expect(results).toEqual([]);
  });

  it("still enforces the relational filters findPublishedProductsForListing already tests (brands)", async () => {
    const brand = await createBrand({ name: "Oristor FPIWF", slug: "oristor-fpiwf" });
    const branded = await createProduct({
      sku: "FPIWF-4",
      slug: "fpiwf-4",
      name: "Branded",
      status: "Published",
      brand: { connect: { id: brand.id } },
    });
    const unbranded = await createProduct({
      sku: "FPIWF-5",
      slug: "fpiwf-5",
      name: "Unbranded",
      status: "Published",
    });

    const results = await findProductsByIdsWithFilters([branded.id, unbranded.id], {
      brandSlugs: ["oristor-fpiwf"],
    });

    expect(results.map((p) => p.slug)).toEqual(["fpiwf-4"]);
  });
});
```

Add `findProductsByIdsWithFilters` to the existing import block at the top of the test file (alongside `findPublishedProductsForListing`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: FAIL — `findProductsByIdsWithFilters is not a function` (the new tests fail; all pre-existing tests in this file still pass).

- [ ] **Step 3: Extract the shared where-builder and add the new function**

In `src/repositories/product.repository.ts`, replace:

```ts
export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
    take: filters.take,
    where: {
      status: "Published",
      ...(filters.excludeProductId ? { id: { not: filters.excludeProductId } } : {}),
      ...(filters.categoryIds?.length
        ? { categories: { some: { id: { in: filters.categoryIds } } } }
        : {}),
      ...(filters.collectionId ? { collections: { some: { id: filters.collectionId } } } : {}),
      ...(filters.allergenNamesToExclude?.length
        ? { allergens: { none: { name: { in: filters.allergenNamesToExclude } } } }
        : {}),
      ...(filters.certificationIds?.length
        ? { certifications: { some: { id: { in: filters.certificationIds } } } }
        : {}),
      ...(filters.brandSlugs?.length ? { brand: { slug: { in: filters.brandSlugs } } } : {}),
      ...(filters.inStock !== undefined ? { inStock: filters.inStock } : {}),
    },
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    // Deterministic ordering matches listProducts's "newest" default sort
    // (see product.service.ts's sortCandidates) — without this, Postgres
    // returns rows in unspecified order and callers that don't apply their
    // own sort (e.g. listRelatedProducts) would see results shuffle
    // between requests.
    orderBy: { publishedAt: "desc" },
  });
}
```

with:

```ts
function buildProductListingWhere(filters: ProductListingFilters): Prisma.ProductWhereInput {
  return {
    status: "Published",
    ...(filters.excludeProductId ? { id: { not: filters.excludeProductId } } : {}),
    ...(filters.categoryIds?.length
      ? { categories: { some: { id: { in: filters.categoryIds } } } }
      : {}),
    ...(filters.collectionId ? { collections: { some: { id: filters.collectionId } } } : {}),
    ...(filters.allergenNamesToExclude?.length
      ? { allergens: { none: { name: { in: filters.allergenNamesToExclude } } } }
      : {}),
    ...(filters.certificationIds?.length
      ? { certifications: { some: { id: { in: filters.certificationIds } } } }
      : {}),
    ...(filters.brandSlugs?.length ? { brand: { slug: { in: filters.brandSlugs } } } : {}),
    ...(filters.inStock !== undefined ? { inStock: filters.inStock } : {}),
  };
}

export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
    take: filters.take,
    where: buildProductListingWhere(filters),
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    // Deterministic ordering matches listProducts's "newest" default sort
    // (see product.service.ts's sortCandidates) — without this, Postgres
    // returns rows in unspecified order and callers that don't apply their
    // own sort (e.g. listRelatedProducts) would see results shuffle
    // between requests.
    orderBy: { publishedAt: "desc" },
  });
}

// Same relational filter shape as findPublishedProductsForListing, applied
// to a pre-computed id set instead of a fresh catalogue-wide query — used
// by search.service.ts's searchProducts()/getSearchSuggestions() (STORY-012)
// after search.repository.ts's raw-SQL ranking query has already narrowed
// down candidate ids. No orderBy: callers re-sort by rank order themselves.
export function findProductsByIdsWithFilters(
  ids: string[],
  filters: Pick<ProductListingFilters, "allergenNamesToExclude" | "certificationIds" | "brandSlugs" | "inStock">,
) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { ...buildProductListingWhere(filters), id: { in: ids } },
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: PASS, including every pre-existing test in this file (confirms the refactor didn't change `findPublishedProductsForListing`'s behavior).

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/product.repository.ts tests/unit/product-repository.test.ts
git commit -m "refactor: extract shared listing filter builder; add findProductsByIdsWithFilters"
```

---

## Task 4: Raw-SQL ranking repository — findRankedProductMatches, findClosestNameSuggestion

**Files:**
- Create: `src/repositories/search.repository.ts`
- Test: `tests/unit/search-ranking-repository.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `pg_trgm`'s `similarity()` function (Task 1).
- Produces: `RankedProductMatch` interface, `findRankedProductMatches(query: string): Promise<RankedProductMatch[]>`, `findClosestNameSuggestion(query: string): Promise<string | null>` — consumed by Task 5 (`searchProducts()`) and Task 6 (`getSearchSuggestions()`/`findDidYouMeanSuggestion()`).

**Note on test file naming:** STORY-007 already created a `tests/unit/search-repository.test.ts` testing a *different* function (`searchPublishedProducts` in `product.repository.ts`, a plain substring match). That function is deleted in Task 7 of this plan, and its test file deleted with it. To avoid any ambiguity in the meantime, this task's new test file uses a distinct name (`search-ranking-repository.test.ts`) rather than reusing/colliding with that name.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-ranking-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { addProductIngredient, createProduct } from "@/repositories/product.repository";
import { findClosestNameSuggestion, findRankedProductMatches } from "@/repositories/search.repository";

afterEach(async () => {
  await prisma.productIngredient.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("findRankedProductMatches", () => {
  it("ranks an exact name match above a prefix match, above a contains match, above a description-only match", async () => {
    // A single-word query with each fixture's tier controlled by guaranteed
    // string containment/prefix logic — deliberately not relying on
    // trigram similarity scores for tier placement (verified empirically
    // during this plan's design that similarity() thresholds are easy to
    // misjudge by hand — see search-products-service.test.ts's note on
    // this same pitfall).
    const exact = await createProduct({
      sku: "RANK-1",
      slug: "rank-1",
      name: "Curry",
      status: "Published",
    });
    const prefix = await createProduct({
      sku: "RANK-2",
      slug: "rank-2",
      name: "Curry Blend",
      status: "Published",
    });
    const contains = await createProduct({
      sku: "RANK-3",
      slug: "rank-3",
      name: "Roasted Curry Mix",
      status: "Published",
    });
    const descriptionOnly = await createProduct({
      sku: "RANK-4",
      slug: "rank-4",
      name: "Spice Mix",
      shortDescription: "Pairs well with curry",
      status: "Published",
    });

    const matches = await findRankedProductMatches("curry");
    const byId = new Map(matches.map((m) => [m.productId, m]));

    expect(byId.get(exact.id)?.rankTier).toBe(4);
    expect(byId.get(prefix.id)?.rankTier).toBe(3);
    expect(byId.get(contains.id)?.rankTier).toBe(2);
    expect(byId.get(descriptionOnly.id)?.rankTier).toBe(1);
    // Sorted by tier descending
    expect(matches[0].productId).toBe(exact.id);
  });

  it("is typo-tolerant: a common misspelling still matches via trigram similarity", async () => {
    const product = await createProduct({
      sku: "RANK-5",
      slug: "rank-5",
      name: "Chilli Powder",
      status: "Published",
    });

    const matches = await findRankedProductMatches("chili powder");

    expect(matches.map((m) => m.productId)).toContain(product.id);
  });

  it("excludes non-Published products", async () => {
    await createProduct({ sku: "RANK-6", slug: "rank-6", name: "Curry Draft", status: "Draft" });

    const matches = await findRankedProductMatches("curry");

    expect(matches).toEqual([]);
  });

  it("matches an ingredient name at the lowest tier", async () => {
    const product = await createProduct({
      sku: "RANK-7",
      slug: "rank-7",
      name: "Mystery Blend",
      status: "Published",
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Fenugreek",
    });

    const matches = await findRankedProductMatches("fenugreek");

    expect(matches.map((m) => m.productId)).toEqual([product.id]);
    expect(matches[0].rankTier).toBe(1);
  });

  it("matches a category name at the lowest tier", async () => {
    const category = await createCategory({ name: "Spice Blends Unique", slug: "rank-cat-1" });
    const product = await createProduct({
      sku: "RANK-8",
      slug: "rank-8",
      name: "Unrelated Name",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });

    const matches = await findRankedProductMatches("Spice Blends Unique");

    expect(matches.map((m) => m.productId)).toEqual([product.id]);
  });

  it("returns an empty array for a blank query", async () => {
    expect(await findRankedProductMatches("   ")).toEqual([]);
  });
});

describe("findClosestNameSuggestion", () => {
  it("returns the closest product name above the similarity threshold", async () => {
    await createProduct({
      sku: "RANK-9",
      slug: "rank-9",
      name: "Ginger Powder",
      status: "Published",
    });

    const suggestion = await findClosestNameSuggestion("ginger powde");

    expect(suggestion).toBe("Ginger Powder");
  });

  it("returns null when nothing is close enough", async () => {
    await createProduct({
      sku: "RANK-10",
      slug: "rank-10",
      name: "Ginger Powder",
      status: "Published",
    });

    const suggestion = await findClosestNameSuggestion("zzz-completely-unrelated-zzz");

    expect(suggestion).toBeNull();
  });

  it("returns null for a blank query", async () => {
    expect(await findClosestNameSuggestion("")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-ranking-repository.test.ts`
Expected: FAIL — `Cannot find module '@/repositories/search.repository'`

- [ ] **Step 3: Write the implementation**

```ts
// src/repositories/search.repository.ts
import { prisma } from "@/lib/db";

export interface RankedProductMatch {
  productId: string;
  rankTier: number; // 4=exact name, 3=prefix, 2=fuzzy/contains, 1=other-field-only
  similarity: number;
}

/**
 * Ranked product search via pg_trgm (STORY-012). Returns ids and rank info
 * only — never full product rows — so relational filters (allergens,
 * certifications, brands, inStock) stay in product.repository.ts's
 * existing Prisma-based filter shape instead of being hand-joined into
 * raw SQL here. See docs/superpowers/specs/2026-09-20-product-search-discovery-design.md.
 */
export async function findRankedProductMatches(query: string): Promise<RankedProductMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.$queryRaw<RankedProductMatch[]>`
    WITH matches AS (
      SELECT
        p.id AS "productId",
        CASE
          WHEN lower(p.name) = lower(${trimmed}) THEN 4
          WHEN lower(p.name) LIKE lower(${trimmed}) || '%' THEN 3
          WHEN lower(p.name) LIKE '%' || lower(${trimmed}) || '%'
            OR similarity(p.name, ${trimmed}) > 0.3
          THEN 2
          WHEN
            p."shortDescription" ILIKE '%' || ${trimmed} || '%'
            OR p.story ILIKE '%' || ${trimmed} || '%'
            OR p.sku ILIKE '%' || ${trimmed} || '%'
            OR EXISTS (
              SELECT 1 FROM "ProductIngredient" pi
              WHERE pi."productId" = p.id AND pi.name ILIKE '%' || ${trimmed} || '%'
            )
            OR EXISTS (
              SELECT 1 FROM "_CategoryToProduct" ctp
              JOIN "Category" c ON c.id = ctp."A"
              WHERE ctp."B" = p.id AND c.name ILIKE '%' || ${trimmed} || '%'
            )
            OR EXISTS (
              SELECT 1 FROM "_CollectionToProduct" cop
              JOIN "Collection" col ON col.id = cop."A"
              WHERE cop."B" = p.id AND col.name ILIKE '%' || ${trimmed} || '%'
            )
          THEN 1
          ELSE 0
        END AS "rankTier",
        similarity(p.name, ${trimmed}) AS similarity
      FROM "Product" p
      WHERE p.status = 'Published'
    )
    SELECT "productId", "rankTier", similarity
    FROM matches
    WHERE "rankTier" > 0
    ORDER BY "rankTier" DESC, similarity DESC, "productId" ASC
  `;
}

/**
 * Trigram similarity lookup against Published product names and Active
 * category names, for the "did you mean" empty-search-result state
 * (STORY-012). Returns a display name to re-run a corrected search with,
 * not an id/href — a bad suggestion just yields another empty state
 * instead of a broken link.
 */
export async function findClosestNameSuggestion(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const rows = await prisma.$queryRaw<{ name: string; similarity: number }[]>`
    SELECT name, similarity(name, ${trimmed}) AS similarity
    FROM (
      SELECT name FROM "Product" WHERE status = 'Published'
      UNION ALL
      SELECT name FROM "Category" WHERE status = 'Active'
    ) AS names
    WHERE similarity(name, ${trimmed}) > 0.3
    ORDER BY similarity DESC
    LIMIT 1
  `;

  return rows[0]?.name ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-ranking-repository.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/search.repository.ts tests/unit/search-ranking-repository.test.ts
git commit -m "feat: add trigram-ranked product search repository"
```

---

## Task 5: searchProducts() service function

**Files:**
- Modify: `src/services/product.service.ts` (export `sortCandidates`)
- Modify: `src/services/search.service.ts`
- Test: `tests/unit/search-products-service.test.ts`

**Interfaces:**
- Consumes: `findRankedProductMatches` (Task 4), `findProductsByIdsWithFilters` (Task 3), `sortCandidates` (this task, newly exported), `toProductListItem`/`ProductListingResult`/`ProductListingFiltersInput`/`ProductSort` (existing, `product.service.ts`), `pricingService.resolvePricesForProducts` (existing).
- Produces: `searchProducts(query: string, opts?: { filters?: ProductListingFiltersInput; sort?: ProductSort; page?: number; pageSize?: number }): Promise<ProductListingResult>` — consumed by Task 7 (`searchCatalogue()`), Task 9 (route handler), Task 11 (results page).

- [ ] **Step 1: Export `sortCandidates`**

In `src/services/product.service.ts`, change:

```ts
function sortCandidates<T extends { product: { publishedAt: Date | null }; price: number }>(
```

to:

```ts
export function sortCandidates<T extends { product: { publishedAt: Date | null }; price: number }>(
```

No other change to that function's body.

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/search-products-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createAllergen, createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { searchProducts } from "@/services/search.service";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.allergen.deleteMany();
});

describe("searchProducts", () => {
  it("returns an empty result for a blank query without touching the database", async () => {
    const result = await searchProducts("   ");

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false });
  });

  it("returns matching, priced products ordered by relevance by default", async () => {
    const exact = await createProduct({
      sku: "SPS-1",
      slug: "sps-1",
      name: "Curry Powder",
      status: "Published",
    });
    // Contains the full query as a literal substring (guaranteed tier-2
    // match via the LIKE condition) — deliberately NOT relying on the
    // trigram similarity threshold here: empirically,
    // similarity("Roasted Curry Blend", "Curry Powder") = 0.222, *below*
    // the 0.3 cutoff, so a fixture that depended on fuzzy similarity alone
    // would silently fail to match at all.
    const contains = await createProduct({
      sku: "SPS-2",
      slug: "sps-2",
      name: "Deluxe Curry Powder Mix",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: exact.id } }, price: "450.00" });
    await createStandardPrice({ product: { connect: { id: contains.id } }, price: "500.00" });

    const result = await searchProducts("Curry Powder");

    expect(result.items.map((i) => i.name)).toEqual(["Curry Powder", "Deluxe Curry Powder Mix"]);
    expect(result.items[0].price).toBe(450);
  });

  it("omits a matching product with no configured price", async () => {
    await createProduct({ sku: "SPS-3", slug: "sps-3", name: "Curry No Price", status: "Published" });

    const result = await searchProducts("curry");

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("applies allergen exclusion filters on top of the search results", async () => {
    const peanuts = await createAllergen({ name: "Peanuts-SPS" });
    const withPeanuts = await createProduct({
      sku: "SPS-4",
      slug: "sps-4",
      name: "Curry Peanut Mix",
      status: "Published",
      allergens: { connect: [{ id: peanuts.id }] },
    });
    const withoutPeanuts = await createProduct({
      sku: "SPS-5",
      slug: "sps-5",
      name: "Curry Plain",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: withPeanuts.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: withoutPeanuts.id } }, price: "100.00" });

    const result = await searchProducts("curry", { filters: { allergens: ["Peanuts-SPS"] } });

    expect(result.items.map((i) => i.name)).toEqual(["Curry Plain"]);
  });

  it("uses newest ordering instead of relevance when an explicit sort is given", async () => {
    // "Curry" is an exact match for the query (tier 4); "Amazing Curry Blend"
    // only contains "curry" as a substring, not as a prefix (tier 2) — an
    // unambiguous tier gap, unlike two names that both start with "Curry"
    // (which would tie at tier 3 and make this test's premise unclear).
    const exactOlder = await createProduct({
      sku: "SPS-6",
      slug: "sps-6",
      name: "Curry",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const containsNewer = await createProduct({
      sku: "SPS-7",
      slug: "sps-7",
      name: "Amazing Curry Blend",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: exactOlder.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: containsNewer.id } }, price: "100.00" });

    const relevanceResult = await searchProducts("curry");
    expect(relevanceResult.items.map((i) => i.name)).toEqual(["Curry", "Amazing Curry Blend"]);

    const newestResult = await searchProducts("curry", { sort: "newest" });
    expect(newestResult.items.map((i) => i.name)).toEqual(["Amazing Curry Blend", "Curry"]);
  });

  it("paginates and reports an accurate total after filtering", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SPS-PAGE-${i}`,
        slug: `sps-page-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const result = await searchProducts("curry", { pageSize: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.hasNextPage).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-products-service.test.ts`
Expected: FAIL — `searchProducts is not a function` (or similar export error)

- [ ] **Step 4: Write the implementation**

Add to `src/services/search.service.ts` (below the existing `searchCatalogue` function):

```ts
import type { ProductListingFiltersInput, ProductListingResult, ProductSort } from "@/services/product.service";
import { sortCandidates } from "@/services/product.service";
import * as searchRepository from "@/repositories/search.repository";

// ... (add these two imports to the existing import block at the top of the file)

const DEFAULT_LISTING_PAGE_SIZE = 24;

function emptyListingResult(page: number, pageSize: number): ProductListingResult {
  return { items: [], total: 0, page, pageSize, hasNextPage: false };
}

export async function searchProducts(
  query: string,
  opts: {
    filters?: ProductListingFiltersInput;
    sort?: ProductSort;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ProductListingResult> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? DEFAULT_LISTING_PAGE_SIZE;
  const filters = opts.filters ?? {};
  const sort = opts.sort ?? "relevance";
  const trimmed = query.trim();
  if (!trimmed) return emptyListingResult(page, pageSize);

  const matches = await searchRepository.findRankedProductMatches(trimmed);
  if (matches.length === 0) return emptyListingResult(page, pageSize);

  const rankById = new Map(matches.map((match) => [match.productId, match]));
  const products = await productRepository.findProductsByIdsWithFilters(
    matches.map((match) => match.productId),
    {
      allergenNamesToExclude: filters.allergens,
      certificationIds: filters.certifications,
      brandSlugs: filters.brands,
      inStock: filters.inStock,
    },
  );

  const resolvedPrices = await pricingService.resolvePricesForProducts(products.map((product) => product.id));

  interface Candidate {
    product: (typeof products)[number];
    price: number;
    currency: string;
  }

  let candidates: Candidate[] = [];
  for (const product of products) {
    const resolved = resolvedPrices.get(product.id);
    if (!resolved) continue; // no price configured — never shown on the storefront
    candidates.push({ product, price: resolved.price.toNumber(), currency: resolved.currency });
  }

  if (filters.priceMin !== undefined) {
    const min = filters.priceMin;
    candidates = candidates.filter((candidate) => candidate.price >= min);
  }
  if (filters.priceMax !== undefined) {
    const max = filters.priceMax;
    candidates = candidates.filter((candidate) => candidate.price <= max);
  }

  if (sort === "relevance") {
    candidates.sort((a, b) => {
      const rankA = rankById.get(a.product.id)!;
      const rankB = rankById.get(b.product.id)!;
      if (rankB.rankTier !== rankA.rankTier) return rankB.rankTier - rankA.rankTier;
      return rankB.similarity - rankA.similarity;
    });
  } else {
    candidates = sortCandidates(candidates, sort);
  }

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const pageCandidates = candidates.slice(start, start + pageSize);

  const items = pageCandidates.map(({ product, price, currency }) =>
    toProductListItem(product, price, currency),
  );

  return { items, total, page, pageSize, hasNextPage: start + pageSize < total };
}
```

Also add `import * as productRepository from "@/repositories/product.repository";` and `import * as pricingService from "@/services/pricing.service";` to the top of `search.service.ts` if not already present (check the existing imports first — `search.service.ts` already imports `pricingService` and `productRepository` for `searchCatalogue`, so these may already be there; do not duplicate the import lines).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-products-service.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/product.service.ts src/services/search.service.ts tests/unit/search-products-service.test.ts
git commit -m "feat: add searchProducts service composing ranked search with STORY-010 filters"
```

---

## Task 6: getSearchSuggestions, findDidYouMeanSuggestion, logProductSearch

**Files:**
- Modify: `src/services/search.service.ts`
- Test: `tests/unit/search-suggestions-service.test.ts`

**Interfaces:**
- Consumes: `findRankedProductMatches`/`findClosestNameSuggestion` (Task 4), `findProductsByIdsWithFilters` (Task 3).
- Produces: `SearchSuggestion` interface, `getSearchSuggestions(query: string, limit?: number): Promise<SearchSuggestion[]>`, `findDidYouMeanSuggestion(query: string): Promise<string | null>`, `logProductSearch(event: { query: string; resultCount: number }): void` — consumed by Task 5's `searchProducts` (for `logProductSearch`, wired in this task), Task 9 (suggestions route), Task 11 (results page's empty state).

**Note on naming:** this file already exports a *different* `SearchSuggestionItem` type (from `@/services/search-extensions`, re-exported, used by STORY-007's overlay for Products+Recipes). This task's `SearchSuggestion` (no "Item" suffix) is a distinct, product-only shape — do not conflate the two or try to unify them; STORY-007's overlay is explicitly not rewired in this plan (see Task 7).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-suggestions-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  findDidYouMeanSuggestion,
  getSearchSuggestions,
  logProductSearch,
} from "@/services/search.service";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("getSearchSuggestions", () => {
  it("returns an empty array for a blank query", async () => {
    expect(await getSearchSuggestions("   ")).toEqual([]);
  });

  it("returns product suggestions sorted by rank", async () => {
    const exact = await createProduct({
      sku: "SUGG-1",
      slug: "sugg-1",
      name: "Curry Powder",
      status: "Published",
    });
    // Guaranteed tier-2 via substring containment, not fuzzy similarity —
    // see search-products-service.test.ts's note on why "Roasted Curry
    // Blend" specifically does NOT reliably match "Curry Powder" (measured
    // similarity 0.222, below the 0.3 cutoff).
    const contains = await createProduct({
      sku: "SUGG-2",
      slug: "sugg-2",
      name: "Deluxe Curry Powder Mix",
      status: "Published",
    });

    const suggestions = await getSearchSuggestions("Curry Powder");

    expect(suggestions.map((s) => s.label)).toEqual(["Curry Powder", "Deluxe Curry Powder Mix"]);
    expect(suggestions[0]).toEqual({
      id: exact.id,
      label: "Curry Powder",
      href: "/products/sugg-1",
      type: "Product",
    });
    expect(suggestions.map((s) => s.id)).toContain(contains.id);
  });

  it("excludes description-only (tier-1) matches", async () => {
    await createProduct({
      sku: "SUGG-3",
      slug: "sugg-3",
      name: "Spice Mix",
      shortDescription: "Great with curry dishes",
      status: "Published",
    });

    const suggestions = await getSearchSuggestions("curry");

    expect(suggestions).toEqual([]);
  });

  it("caps results at the given limit", async () => {
    for (let i = 0; i < 5; i++) {
      await createProduct({
        sku: `SUGG-CAP-${i}`,
        slug: `sugg-cap-${i}`,
        name: `Curry ${i}`,
        status: "Published",
      });
    }

    const suggestions = await getSearchSuggestions("curry", 3);

    expect(suggestions).toHaveLength(3);
  });
});

describe("findDidYouMeanSuggestion", () => {
  it("delegates to the repository and returns a corrected name", async () => {
    await createProduct({
      sku: "SUGG-4",
      slug: "sugg-4",
      name: "Ginger Powder",
      status: "Published",
    });

    expect(await findDidYouMeanSuggestion("ginger powde")).toBe("Ginger Powder");
  });

  it("returns null for a blank query", async () => {
    expect(await findDidYouMeanSuggestion("")).toBeNull();
  });
});

describe("logProductSearch", () => {
  it("does not throw when called", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});

    expect(() => logProductSearch({ query: "curry", resultCount: 3 })).not.toThrow();

    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-suggestions-service.test.ts`
Expected: FAIL — `getSearchSuggestions is not a function` (or similar)

- [ ] **Step 3: Write the implementation**

Add to `src/services/search.service.ts`:

```ts
const DEFAULT_SUGGESTION_LIMIT = 8;
const SUGGESTION_MIN_TIER = 2; // exclude tier-1 (description/ingredient-only) matches — a suggestion dropdown should look obviously relevant

export interface SearchSuggestion {
  id: string;
  label: string;
  href: string;
  type: "Product";
}

export async function getSearchSuggestions(
  query: string,
  limit: number = DEFAULT_SUGGESTION_LIMIT,
): Promise<SearchSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matches = await searchRepository.findRankedProductMatches(trimmed);
  const relevant = matches.filter((match) => match.rankTier >= SUGGESTION_MIN_TIER).slice(0, limit);
  if (relevant.length === 0) return [];

  const rankOrder = new Map(relevant.map((match, index) => [match.productId, index]));
  const products = await productRepository.findProductsByIdsWithFilters(
    relevant.map((match) => match.productId),
    {},
  );
  const sorted = [...products].sort(
    (a, b) => (rankOrder.get(a.id) ?? 0) - (rankOrder.get(b.id) ?? 0),
  );

  return sorted.map((product) => ({
    id: product.id,
    label: product.name,
    href: `/products/${product.slug}`,
    type: "Product" as const,
  }));
}

export function findDidYouMeanSuggestion(query: string): Promise<string | null> {
  return searchRepository.findClosestNameSuggestion(query);
}

/**
 * Typed hook point for future analytics/AI consumption (STORY-061 AI
 * Smart Search, STORY-064 AI Business Insights) — no UI, no queue, just a
 * call site those stories can redirect to a real sink. Logs outside
 * production only, matching src/lib/db.ts's existing
 * NODE_ENV-gated-logging convention — there's no real sink yet.
 */
export function logProductSearch(event: { query: string; resultCount: number }): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[search] product search logged", event);
  }
}
```

Then wire `logProductSearch` into `searchProducts()` (Task 5's function, same file): after computing `total` and before the `return` statement, add:

```ts
  if (trimmed) logProductSearch({ query: trimmed, resultCount: total });
```

(`trimmed` is already in scope from earlier in the function; the blank-query early-return above this point means `trimmed` is always non-empty by the time this line runs, but the guard documents the intent — AC #28 asks for every *search request*, not the blank-query short-circuit, to be logged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-suggestions-service.test.ts tests/unit/search-products-service.test.ts`
Expected: PASS (both files — re-run Task 5's tests too since `searchProducts` was just modified to call `logProductSearch`)

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/search.service.ts tests/unit/search-suggestions-service.test.ts
git commit -m "feat: add product search suggestions, did-you-mean, and search logging hook"
```

---

## Task 7: Upgrade STORY-007's searchCatalogue() internals; retire searchPublishedProducts()

**Files:**
- Modify: `src/services/search.service.ts` (`searchCatalogue`)
- Modify: `src/repositories/product.repository.ts` (delete `searchPublishedProducts`)
- Delete: `tests/unit/search-repository.test.ts` (tested the now-deleted function)
- Test: `tests/unit/search-service.test.ts` (STORY-007's existing file — extend, don't replace)

**Interfaces:**
- Consumes: `searchProducts` (Task 5).
- Produces: no new exports — `searchCatalogue`'s signature and `SearchResultsPage` return shape are unchanged; this task only changes its internals.

Per the integration approach confirmed with the user during design: STORY-007's `SearchOverlay`, `use-search-suggestions.ts`, and `/api/search/route.ts` are **not touched** by this task.

- [ ] **Step 1: Write the failing/updated test**

`tests/unit/search-service.test.ts` already has a `describe("searchCatalogue", ...)` block from STORY-007. Add one new test to it, after the existing tests in that block, demonstrating the quality upgrade:

```ts
  it("now finds a typo-matched product that the old plain substring match would have missed", async () => {
    const product = await createProduct({
      sku: "SC-TYPO-1",
      slug: "sc-typo-1",
      name: "Chilli Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });

    // "chili" (one L) never appears as a substring of "Chilli Powder" — a
    // plain `contains` match (STORY-007's original searchPublishedProducts)
    // would return nothing here. The trigram-ranked searchProducts() this
    // task switches searchCatalogue() to use internally still finds it.
    const result = await searchCatalogue("chili powder");

    expect(result.products.map((p) => p.name)).toContain("Chilli Powder");
  });
```

(This goes inside the existing `describe("searchCatalogue", () => { ... })` block in `tests/unit/search-service.test.ts` — do not create a new describe block or duplicate the file's existing `afterEach`/imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-service.test.ts`
Expected: FAIL on the new test only — `searchCatalogue` still calls the old plain-substring `searchPublishedProducts`, which won't match "chili" against "Chilli" (one L vs two).

- [ ] **Step 3: Switch searchCatalogue()'s product-matching to searchProducts()**

In `src/services/search.service.ts`, find `searchCatalogue`'s body:

```ts
  const skip = (page - 1) * pageSize;
  // Fetch one extra row to detect a next page without a separate COUNT
  // query — no AC requires an exact running total, and the story
  // explicitly defers full pagination UX to STORY-012.
  const [candidates, recipes] = await Promise.all([
    productRepository.searchPublishedProducts(trimmed, { take: pageSize + 1, skip }),
    searchRecipes(trimmed, pageSize),
  ]);

  const hasNextPage = candidates.length > pageSize;
  const pageCandidates = candidates.slice(0, pageSize);

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    pageCandidates.map((candidate) => candidate.id),
  );

  const products: ProductListItem[] = [];
  for (const candidate of pageCandidates) {
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue; // no price configured — never shown on the storefront
    products.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
  }

  return { query: trimmed, products, recipes, page, pageSize, hasNextPage };
```

Replace with:

```ts
  // STORY-012's searchProducts() now provides the ranked, typo-tolerant
  // product matching that used to be a plain substring search here —
  // same external SearchResultsPage shape, better internals.
  const [productResults, recipes] = await Promise.all([
    searchProducts(trimmed, { page, pageSize }),
    searchRecipes(trimmed, pageSize),
  ]);

  return {
    query: trimmed,
    products: productResults.items,
    recipes,
    page,
    pageSize,
    hasNextPage: productResults.hasNextPage,
  };
```

Note: `searchProducts` defaults to `sort: "relevance"` when no `sort` option is passed, which is exactly what `searchCatalogue` wants here — no explicit `sort` argument needed in this call.

- [ ] **Step 4: Delete the now-dead searchPublishedProducts and its test file**

In `src/repositories/product.repository.ts`, delete the entire `searchPublishedProducts` function (the block starting `export function searchPublishedProducts(query: string, opts...` through its closing `}`).

Delete the file: `rm tests/unit/search-repository.test.ts`

- [ ] **Step 5: Run tests to verify everything passes**

Run: `npx vitest run tests/unit/search-service.test.ts tests/unit/search-products-service.test.ts tests/unit/product-repository.test.ts`
Expected: PASS across all three files (confirms `searchCatalogue`'s existing STORY-007 tests still pass with the new internals, the new typo test passes, `searchProducts` itself is unaffected, and `product.repository.ts`'s remaining tests are unaffected by the deletion).

Also run: `npx vitest run tests/unit/search-route.test.ts tests/unit/search-overlay.test.tsx`
Expected: PASS (STORY-007's route and overlay tests, confirming the interface-preserving nature of this change — these files are not modified by this task).

- [ ] **Step 6: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (confirms nothing else in the codebase still references the deleted `searchPublishedProducts`).

- [ ] **Step 7: Commit**

```bash
git add src/services/search.service.ts src/repositories/product.repository.ts tests/unit/search-service.test.ts
git rm tests/unit/search-repository.test.ts
git commit -m "refactor: upgrade searchCatalogue to use ranked searchProducts internally"
```

---

## Task 8: Validation schema

**Files:**
- Create: `src/validation/product-search.schema.ts`
- Test: `tests/unit/product-search-schema.test.ts`

**Interfaces:**
- Consumes: `productListingQuerySchema` (existing, `@/validation/product-listing.schema`).
- Produces: `productSearchQuerySchema`, `type ProductSearchQuery` — consumed by Task 9 (routes) and Task 11 (results page).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/product-search-schema.test.ts
import { describe, expect, it } from "vitest";

import { productSearchQuerySchema } from "@/validation/product-search.schema";

describe("productSearchQuerySchema", () => {
  it("trims q and defaults page/sort like the base listing schema", () => {
    const result = productSearchQuerySchema.parse({ q: "  curry  " });

    expect(result.q).toBe("curry");
    expect(result.page).toBe(1);
    expect(result.sort).toBe("newest");
  });

  it("accepts sort: relevance", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", sort: "relevance" });

    expect(result.sort).toBe("relevance");
  });

  it("degrades a missing q to an empty string instead of throwing", () => {
    expect(productSearchQuerySchema.parse({}).q).toBe("");
  });

  it("still validates the shared filter fields (e.g. inStock)", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", inStock: "true" });

    expect(result.inStock).toBe(true);
  });

  it("does not include category/collection fields", () => {
    const result = productSearchQuerySchema.parse({ q: "curry", category: "spices" });

    expect(result).not.toHaveProperty("category");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-search-schema.test.ts`
Expected: FAIL — `Cannot find module '@/validation/product-search.schema'`

- [ ] **Step 3: Write the implementation**

```ts
// src/validation/product-search.schema.ts
import { z } from "zod";

import { productListingQuerySchema } from "@/validation/product-listing.schema";

/**
 * Reuses productListingQuerySchema's exact filter/sort/pagination shape
 * (same `.catch()`-everywhere convention — a malformed request degrades
 * to a default, never a 400) minus category/collection (search doesn't
 * scope to either), plus the search query itself.
 */
export const productSearchQuerySchema = productListingQuerySchema
  .omit({ category: true, collection: true })
  .extend({
    q: z.string().trim().catch(""),
  });

export type ProductSearchQuery = z.infer<typeof productSearchQuerySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-search-schema.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/validation/product-search.schema.ts tests/unit/product-search-schema.test.ts
git commit -m "feat: add product search query validation schema"
```

---

## Task 9: API routes

**Files:**
- Create: `src/app/api/products/search/route.ts`
- Create: `src/app/api/products/search/suggestions/route.ts`
- Test: `tests/unit/product-search-route.test.ts`
- Test: `tests/unit/product-search-suggestions-route.test.ts`

**Interfaces:**
- Consumes: `productSearchQuerySchema` (Task 8), `searchProducts`/`getSearchSuggestions` (Tasks 5, 6).
- Produces: `GET /api/products/search`, `GET /api/products/search/suggestions` — consumed by Task 10 (`useProductListing`) and Task 12 (suggestions hook).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/product-search-route.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/search/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/products/search", () => {
  it("returns matching published products for a query", async () => {
    const product = await createProduct({
      sku: "ROUTE-SEARCH-1",
      slug: "route-search-curry",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/products/search?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items.map((p: { name: string }) => p.name)).toEqual(["Curry Powder"]);
  });

  it("returns an empty result for a blank query, not an error", async () => {
    const response = await GET(new Request("http://localhost/api/products/search?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it("respects filters and sort query params", async () => {
    const a = await createProduct({
      sku: "ROUTE-SEARCH-2",
      slug: "route-search-a",
      name: "Curry A",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const b = await createProduct({
      sku: "ROUTE-SEARCH-3",
      slug: "route-search-b",
      name: "Curry B",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "100.00" });

    const response = await GET(new Request("http://localhost/api/products/search?q=curry&sort=newest"));
    const body = await response.json();

    expect(body.items.map((p: { name: string }) => p.name)).toEqual(["Curry B", "Curry A"]);
  });
});
```

```ts
// tests/unit/product-search-suggestions-route.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { GET } from "@/app/api/products/search/suggestions/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/products/search/suggestions", () => {
  it("returns top suggestions for a query", async () => {
    await createProduct({
      sku: "SUGG-ROUTE-1",
      slug: "sugg-route-curry",
      name: "Curry Powder",
      status: "Published",
    });

    const response = await GET(new Request("http://localhost/api/products/search/suggestions?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.map((s: { label: string }) => s.label)).toEqual(["Curry Powder"]);
  });

  it("returns an empty array for a blank query", async () => {
    const response = await GET(new Request("http://localhost/api/products/search/suggestions?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/product-search-route.test.ts tests/unit/product-search-suggestions-route.test.ts`
Expected: FAIL — both route modules don't exist yet.

- [ ] **Step 3: Write the implementations**

```ts
// src/app/api/products/search/route.ts
import { NextResponse } from "next/server";

import { searchProducts } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = productSearchQuerySchema.parse(rawQuery);

  const result = await searchProducts(query.q, {
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    filters: {
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      allergens: query.allergens,
      certifications: query.certifications,
      brands: query.brands,
      inStock: query.inStock,
    },
  });

  return NextResponse.json(result, { status: 200 });
}
```

```ts
// src/app/api/products/search/suggestions/route.ts
import { NextResponse } from "next/server";

import { getSearchSuggestions } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const { q } = productSearchQuerySchema.pick({ q: true }).parse(rawQuery);

  const suggestions = await getSearchSuggestions(q);

  return NextResponse.json(suggestions, { status: 200 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/product-search-route.test.ts tests/unit/product-search-suggestions-route.test.ts`
Expected: PASS (5 tests total)

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/search/route.ts src/app/api/products/search/suggestions/route.ts tests/unit/product-search-route.test.ts tests/unit/product-search-suggestions-route.test.ts
git commit -m "feat: add product search and suggestions API routes"
```

---

## Task 10: Extend ProductListingScope and useProductListing for search

**Files:**
- Modify: `src/hooks/use-product-listing.ts`
- Modify: `tests/unit/product-grid.test.tsx` (add one case)

**Interfaces:**
- Produces: `ProductListingScope.query?: string`, `useProductListing` fetching `/api/products/search` instead of `/api/products` when `scope.query` is set — consumed by Task 11 (`/products/search/page.tsx`).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/product-grid.test.tsx`, inside the existing `describe("ProductGrid", () => { ... })` block, after the existing tests:

```tsx
  it("fetches from the search endpoint when scope.query is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(initialData) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProductGrid
          scope={{ query: "curry" }}
          initialData={initialData}
          allergenOptions={[]}
          certificationOptions={[]}
          brandOptions={[]}
        />
      </QueryClientProvider>,
      { wrapper: withNuqsTestingAdapter() },
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/products/search?")),
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("q=curry"));
  });
```

(This reuses the file's existing `initialData` fixture, `render`, `QueryClientProvider`, `QueryClient`, `withNuqsTestingAdapter`, `waitFor`, and `vi` imports — no new imports needed if the existing test file already has them, which it does per STORY-010's original test.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-grid.test.tsx`
Expected: FAIL on the new test — `scope.query` is not yet a recognized field and the fetch still targets `/api/products`.

- [ ] **Step 3: Extend the hook**

In `src/hooks/use-product-listing.ts`, change:

```ts
export interface ProductListingScope {
  category?: string;
  collection?: string;
}

export type ProductListingQueryParams = Values<typeof productListingParsers>;

function buildSearchParams(
  scope: ProductListingScope,
  params: ProductListingQueryParams,
  pageSize: number,
): string {
  const search = new URLSearchParams();
  if (scope.category) search.set("category", scope.category);
  if (scope.collection) search.set("collection", scope.collection);
  search.set("page", String(params.page));
```

to:

```ts
export interface ProductListingScope {
  category?: string;
  collection?: string;
  /** When set, useProductListing fetches /api/products/search instead of /api/products (STORY-012). */
  query?: string;
}

export type ProductListingQueryParams = Values<typeof productListingParsers>;

function buildSearchParams(
  scope: ProductListingScope,
  params: ProductListingQueryParams,
  pageSize: number,
): string {
  const search = new URLSearchParams();
  if (scope.category) search.set("category", scope.category);
  if (scope.collection) search.set("collection", scope.collection);
  if (scope.query) search.set("q", scope.query);
  search.set("page", String(params.page));
```

Then in the same file, change:

```ts
    queryFn: async () => {
      const response = await fetch(`/api/products?${buildSearchParams(scope, params, pageSize)}`);
      if (!response.ok) throw new Error("Failed to load products");
      return (await response.json()) as ProductListingResult;
    },
```

to:

```ts
    queryFn: async () => {
      const endpoint = scope.query ? "/api/products/search" : "/api/products";
      const response = await fetch(`${endpoint}?${buildSearchParams(scope, params, pageSize)}`);
      if (!response.ok) throw new Error("Failed to load products");
      return (await response.json()) as ProductListingResult;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-grid.test.tsx`
Expected: PASS, including every pre-existing test in this file.

- [ ] **Step 5: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-product-listing.ts tests/unit/product-grid.test.tsx
git commit -m "feat: point useProductListing at the search endpoint when scope.query is set"
```

---

## Task 11: /products/search results page

**Files:**
- Create: `src/app/(storefront)/products/search/page.tsx`
- Create: `src/app/(storefront)/products/search/loading.tsx`

**Interfaces:**
- Consumes: `productSearchQuerySchema` (Task 8), `searchProducts`/`findDidYouMeanSuggestion` (Tasks 5, 6), `ProductGrid` (existing, extended by Task 10), `listAllergens`/`listCertifications`/`listBrands` (existing, same as `/products/page.tsx`).

No Vitest test for this task — this codebase has no direct unit tests for Server Component `page.tsx` files (confirmed precedent: `/products/page.tsx`, `/search/page.tsx` from STORY-007 have none either); coverage comes from Task 13's Playwright e2e test.

- [ ] **Step 1: Write `page.tsx`**

```tsx
// src/app/(storefront)/products/search/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { findDidYouMeanSuggestion, searchProducts } from "@/services/search.service";
import { productSearchQuerySchema } from "@/validation/product-search.schema";

interface ProductSearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: ProductSearchPageProps): Promise<Metadata> {
  const { q } = await searchParams.then((raw) => productSearchQuerySchema.parse(raw));
  return {
    title: q ? `Search results for "${q}"` : "Search Products",
    robots: { index: false, follow: true },
  };
}

export default async function ProductSearchPage({ searchParams }: ProductSearchPageProps) {
  const query = productSearchQuerySchema.parse(await searchParams);
  const { q, sort, page, pageSize } = query;

  const [result, allergens, certifications, brands] = await Promise.all([
    searchProducts(q, {
      sort,
      page,
      pageSize,
      filters: {
        priceMin: query.priceMin,
        priceMax: query.priceMax,
        allergens: query.allergens,
        certifications: query.certifications,
        brands: query.brands,
        inStock: query.inStock,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const didYouMean = q && result.items.length === 0 ? await findDidYouMeanSuggestion(q) : null;

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">{q ? `Results for "${q}"` : "Search Products"}</h1>

      {q && result.items.length === 0 ? (
        <div className="mt-8 text-body text-charcoal/70">
          {didYouMean ? (
            <p>
              No results found for &quot;{q}&quot;. Did you mean{" "}
              <Link
                href={`/products/search?q=${encodeURIComponent(didYouMean)}`}
                className="text-chilli hover:underline"
              >
                {didYouMean}
              </Link>
              ?
            </p>
          ) : (
            <p>No products match &quot;{q}&quot;.</p>
          )}
          <p className="mt-2">
            Browse{" "}
            <Link href="/products" className="text-chilli hover:underline">
              all products
            </Link>{" "}
            instead.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <ProductGrid
            scope={{ query: q }}
            initialData={result}
            allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
            certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
            brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
          />
        </div>
      )}
    </Section>
  );
}
```

This page passes `scope={{ query: q }}` to `ProductGrid`, which Step 3 below updates to derive `showRelevance` from `scope.query` internally — no new prop on `ProductGrid`'s own public interface.

- [ ] **Step 2: Write `loading.tsx`**

```tsx
// src/app/(storefront)/products/search/loading.tsx
import { Section } from "@/components/storefront/layout/section";

export default function ProductSearchLoading() {
  return (
    <Section>
      <div className="h-9 w-64 animate-pulse rounded bg-cream" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-lg bg-cream" />
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Wire `showRelevance` into `ProductGrid`**

In `src/components/storefront/product/product-grid.tsx`, change:

```tsx
          <SortSelect
            value={params.sort}
            onValueChange={(sort: ProductSort) => void setParams({ sort, page: 1 })}
          />
```

to:

```tsx
          <SortSelect
            value={params.sort}
            onValueChange={(sort: ProductSort) => void setParams({ sort, page: 1 })}
            showRelevance={scope.query !== undefined}
          />
```

- [ ] **Step 4: Manually verify against the running dev server**

Ensure `npm run dev` and `npx prisma dev` are running (start them in the background if not, waiting for each to report ready — see prior tasks' environment notes for the exact recovery commands if the shared PGlite server has wedged).

Check: `curl -s "http://localhost:3000/products/search?q=curry"` — expect 200 and the seeded "Roasted Curry Powder 100g"/"Curry Lover's Gift Set" product names in the response body (`prisma/seed.ts`'s fixture data).

Check: `curl -s "http://localhost:3000/products/search?q=zzz-no-such-product-zzz"` — expect 200 and either a "did you mean" or a plain "No products match" message, never an error.

Check: `curl -s "http://localhost:3000/products/search"` (no `q`) — expect 200, heading "Search Products", no results grid, no error.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(storefront)/products/search/page.tsx" "src/app/(storefront)/products/search/loading.tsx" src/components/storefront/product/product-grid.tsx
git commit -m "feat: add /products/search results page reusing STORY-010's listing UI"
```

---

## Task 12: Product search suggestions hook

**Files:**
- Create: `src/hooks/use-product-search-suggestions.ts`

**Interfaces:**
- Consumes: `useDebouncedValue` (existing, STORY-007, `@/hooks/use-debounced-value`), `SearchSuggestion` (Task 6, `@/services/search.service`).
- Produces: `useProductSearchSuggestions(query: string)` — documented and shipped per AC #25 ("ready for the STORY-007 header search box to consume without rebuilding ranking logic"); **not** wired into `SearchOverlay` by this plan, per the integration scope confirmed with the user during design.

No dedicated test for this task — it's a thin TanStack Query wrapper with no branching logic of its own (mirrors `use-search-suggestions.ts`'s precedent from STORY-007, which also has no standalone test); its behavior is exercised through Task 9's route tests (the endpoint it calls) and would be exercised by whichever future story wires it into a component.

- [ ] **Step 1: Write the implementation**

```ts
// src/hooks/use-product-search-suggestions.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import type { SearchSuggestion } from "@/services/search.service";

export function useProductSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ["product-search-suggestions", query],
    queryFn: async () => {
      const response = await fetch(`/api/products/search/suggestions?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Failed to load product search suggestions");
      return (await response.json()) as SearchSuggestion[];
    },
    enabled: query.length > 0,
  });
}
```

- [ ] **Step 2: Run tsc**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Run eslint**

Run: `npx eslint src/hooks/use-product-search-suggestions.ts`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-product-search-suggestions.ts
git commit -m "feat: add product search suggestions hook (not yet wired into the header overlay)"
```

---

## Task 13: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/product-search.spec.ts`

**Interfaces:**
- Consumes: the running dev server, seeded via `prisma/seed.ts` ("Roasted Curry Powder 100g" and "Chilli Powder 100g" both usable for exact/typo matches).

- [ ] **Step 1: Write the e2e test**

```ts
// tests/e2e/product-search.spec.ts
import { expect, test } from "@playwright/test";

test("searching a known product by exact name shows it in results", async ({ page }) => {
  await page.goto("/products/search?q=Roasted+Curry+Powder");

  await expect(page.getByRole("heading", { level: 1, name: /Results for/ })).toBeVisible();
  await expect(page.getByText("Roasted Curry Powder 100g")).toBeVisible();
});

test("a common misspelling surfaces a did-you-mean suggestion, and the corrected link works", async ({ page }) => {
  await page.goto("/products/search?q=chili+powder");

  const didYouMean = page.getByRole("link", { name: /Chilli Powder/ });
  await expect(didYouMean).toBeVisible();

  await didYouMean.click();

  await expect(page).toHaveURL(/q=Chilli\+?Powder|q=Chilli%20Powder/);
  await expect(page.getByText("Chilli Powder 100g")).toBeVisible();
});

test("applying a STORY-010 filter on top of search results keeps the query in the URL", async ({ page }) => {
  await page.goto("/products/search?q=curry");
  await expect(page.getByText(/Curry/).first()).toBeVisible();

  await page.getByRole("checkbox", { name: /In Stock/i }).click();

  await expect(page).toHaveURL(/q=curry/);
  await expect(page).toHaveURL(/inStock=true/);
});

test("search results page is not indexable", async ({ page }) => {
  const response = await page.goto("/products/search?q=curry");
  const html = await response!.text();

  expect(html).toContain('name="robots"');
  expect(html).toMatch(/noindex/);
});
```

**Note:** the second and third tests depend on the exact filter-sidebar UI (an "In Stock" checkbox) and URL-encoding details of the app's existing STORY-010 filter components — verify the actual rendered control's accessible name against `src/components/storefront/product/filter-controls.tsx` before finalizing the selector, and adjust the query-string assertion regex to match whatever `nuqs` actually serializes (`+` vs `%20` for spaces) rather than guessing; run the test and read the failure output if the first attempt doesn't match.

- [ ] **Step 2: Run the e2e suite**

Run: `npx playwright test tests/e2e/product-search.spec.ts`
Expected: PASS (4 tests). Ensure `npm run dev` and `npx prisma dev` are running and seeded first (see prior tasks' environment notes).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/product-search.spec.ts
git commit -m "test: add Playwright e2e coverage for product search & discovery"
```

---

## Task 14: Documentation

**Files:**
- Modify: `docs/stories/03-product-platform/STORY-012-product-search-discovery.md`
- Modify: `docs/stories/README.md`
- Modify: `docs/architecture-decisions.md`

- [ ] **Step 1: Mark every AC and task checkbox done in the story file**

In `docs/stories/03-product-platform/STORY-012-product-search-discovery.md`, change `**Status:** Draft` to:

```markdown
**Status:** Done — see `src/repositories/search.repository.ts` for the
trigram-ranking query and `src/services/search.service.ts` for
`searchProducts()`/`getSearchSuggestions()`, and
`docs/superpowers/plans/2026-09-20-product-search-discovery.md` for the
full implementation record.
```

Change every `- [ ]` under `## Acceptance Criteria` and `## Tasks` to `- [x]`.

- [ ] **Step 2: Update the backlog index**

In `docs/stories/README.md`, change the STORY-012 row from `| STORY-012 | Product Search & Discovery | Draft |` to `| STORY-012 | Product Search & Discovery | Done |`.

- [ ] **Step 3: Document the migration recipe reuse and the STORY-007 upgrade**

Append to `docs/architecture-decisions.md`:

```markdown
---

## 2026-09-20 — STORY-012 Product Search & Discovery

**pg_trgm confirmed working on PGlite.** Verified directly before
committing to trigram search as the approach (`CREATE EXTENSION IF NOT
EXISTS pg_trgm` + `similarity()` both succeed against the local `prisma
dev` database) — this project's PGlite compatibility has been a recurring
source of surprises (see the STORY-001 entry above), so this was checked
first rather than assumed.

**Migration applied via the offline file-to-file diff recipe, not
`migrate diff --from-empty` or `migrate dev`.** `migrate diff
--from-migrations` requires a shadow database connection (the exact class
of bug already documented above) — this migration instead diffed the
schema file at the previous commit against the modified schema.prisma
directly (`migrate diff --from-schema <old-file> --to-schema
<new-file> --script`), which needs no database connection at all, then
applied the result by hand-appending the trigram GIN indexes (not
expressible in Prisma's schema language) and using `db execute` +
`migrate resolve --applied` — never `migrate dev`. See Task 1 of
`docs/superpowers/plans/2026-09-20-product-search-discovery.md`.

**The shared `%LOCALAPPDATA%\prisma-dev-nodejs\Data` directory is not
project-local.** It contains a `production-app`-named server's data
alongside this project's `default`-named server on this machine — any
future "reset local dev DB" step must scope deletion to `Data\default\`
and `Data\durable-streams\default\` only, never wipe the whole `Data`
directory.

**`searchCatalogue()` (STORY-007) now delegates its product-matching to
this story's `searchProducts()`** instead of the plain substring match it
shipped with (`searchPublishedProducts`, now deleted) — same external
`SearchResultsPage` contract, better relevance and typo-tolerance.
`SearchOverlay`, `use-search-suggestions.ts`, and `/api/search/route.ts`
were deliberately left untouched (confirmed with the user during this
story's design) — a future story can wire the header overlay's
suggestions to this story's dedicated `/api/products/search/suggestions`
endpoint and `use-product-search-suggestions.ts` hook if the two
suggestion experiences ever need to diverge, but nothing requires that
today.
```

- [ ] **Step 4: Commit**

```bash
git add docs/stories/03-product-platform/STORY-012-product-search-discovery.md docs/stories/README.md docs/architecture-decisions.md
git commit -m "docs: mark STORY-012 done and document the migration recipe and STORY-007 upgrade"
```

---

## Final Verification

- [ ] Run `npm run lint` — 0 problems
- [ ] Run `npm run test` (with `npx prisma dev` running) — all unit tests pass, including every STORY-007 test file (confirming the `searchCatalogue` internals swap didn't regress it)
- [ ] Run `npx playwright test` — all e2e tests pass, including the new `product-search.spec.ts` and STORY-007's `search.spec.ts`/`header.spec.ts`
- [ ] Manually click through: `/products/search?q=curry` → results render with STORY-010's filter sidebar/sort/pagination; change a filter → query stays in URL; search a misspelling → did-you-mean appears and its link works; header search overlay (STORY-007) still works exactly as before
