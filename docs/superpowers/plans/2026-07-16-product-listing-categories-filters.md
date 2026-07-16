# STORY-010: Product Listing, Categories & Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the customer-facing browse experience on top of STORY-009's catalogue — `/products`, category and collection landing pages, filters, sort, pagination, and a reusable `ProductCard` — so every later Product Platform story (PDP, search, wishlist, compare) has a consistent listing UI and result-rendering components to build on.

**Architecture:** Each listing route is a Server Component that reads and validates `searchParams`, calls `product.service.ts`'s `listProducts()` directly (no self-HTTP call), and renders the first page as real HTML plus `ItemList` JSON-LD. A client `ProductGrid` island hydrates from that data as TanStack Query `initialData` and owns all subsequent filter/sort/page interactions against `GET /api/products` (which calls the same `listProducts()`). URL state (filters/sort/page) is managed by `nuqs`, sharing one parser definition between the client hook and the server-side loader.

**Tech Stack:** Next.js 16 App Router (Server Components), TanStack Query 5, `nuqs` 2.9 (new dependency), Zod 4, Prisma 7 (`@prisma/adapter-pg`), Shadcn `select`/`checkbox` (new primitives, Base UI-backed per this project's `base-nova` style), Vitest 4 (real local Postgres per STORY-009's pattern), Playwright.

**Design doc:** `docs/superpowers/specs/2026-07-16-product-listing-design.md`
**Story:** `docs/stories/03-product-platform/STORY-010-product-listing-categories-filters.md`

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types (`CLAUDE.md`)
- Repositories are the **only** layer that imports `@/lib/db` / Prisma. Services never import Prisma directly. Client (`"use client"`) components/hooks only ever import `type`-only exports from services (erased at compile time, never bundled) — never call a service/repository function directly from client code.
- Server Components by default; mark a file `"use client"` only where interactivity (state, event handlers, hooks) is required (`CLAUDE.md`)
- Zod: one schema per concern under `src/validation/`, paired `z.infer` type export, matching `src/validation/product.schema.ts` / `pricing.schema.ts`
- Local schema iteration uses `npx prisma db push` (see `docs/architecture-decisions.md`). PGlite supports **one concurrent connection** and is independently confirmed to wedge ("Server has closed the connection") after ~40-50s of sustained test activity — restart `npx prisma dev` between batches if `npm run test`/`npx vitest run` starts erroring with connection failures. This is why every price-resolution query in this plan is written as an exact fixed number of bulk queries (never N-per-product) — see Task 5.
- Conventional Commits (`feat:`, `test:`, `docs:`, etc.) per `CLAUDE.md`; commit after every task
- **Allergen filter semantics:** selecting an allergen **excludes** products that contain it (the standard "dietary needs" filter convention — e.g. checking "Gluten" hides products containing gluten). This is a plan-level decision (not surfaced during brainstorming) — flagged for the user to correct if a different semantic was intended.
- **Certification/brand filter semantics:** multi-select within one facet is a union (OR) — checking "Organic" and "Halal" shows products with either. Different facets combine as an intersection (AND) — matches standard faceted-search convention.
- **Catalogue-scale assumption:** `listProducts()` fetches the full non-price-filtered candidate set in one repository query, resolves all their prices in bulk (5 fixed queries, not per-product — see Task 5), then filters by price range, sorts, and paginates **in memory**. This is a deliberate YAGNI choice appropriate to a specialty food catalogue's realistic size (dozens to low hundreds of products), not millions — avoids building DB-level price filtering/sorting for a computed (non-column) value.
- **`pageSize`:** the API/service contract supports an explicit `pageSize` override (bounded 1-60, default 24), but the client UI does not expose a page-size control — the client always requests the fixed default of 24. This keeps the URL clean (only reflecting things a user actually changed).
- `nuqs` 2.9.0 verified APIs used in this plan (confirmed against the installed package's own type declarations, not assumed from training data): `useQueryStates` from `"nuqs"`; `parseAsInteger`/`parseAsFloat`/`parseAsBoolean`/`parseAsArrayOf`/`parseAsStringLiteral`/`createLoader` from `"nuqs/server"` (not the main `"nuqs"` package — discovered during Task 14 that importing the parser primitives from `"nuqs"` into `product-listing-params.ts`, a file transitively imported by a Server Component page, breaks them at runtime with `parseAsInteger.withDefault is not a function`, reproduced identically under both Turbopack and webpack, because `"nuqs"`'s main module also bundles the client-only `useQueryState`/`useQueryStates` hooks in the same file, and Next's RSC compiler mishandles the whole module once it detects hook usage. `nuqs/server` re-exports the same parser primitives without the hooks and is safe to import from files used by Server Components); `NuqsAdapter` from `"nuqs/adapters/next/app"`; `NuqsTestingAdapter`/`withNuqsTestingAdapter` from `"nuqs/adapters/testing"` (not the top-level `"nuqs/testing"`, which is a different module for parser round-trip testing — corrected during Task 3 after the original verification conflated the two). `parseAsArrayOf` serializes as one comma-separated query value (e.g. `?brands=oristor,mccormick`), **not** repeated keys — the API route's Zod schema parses accordingly.
- **Turbopack workspace root:** this worktree lives inside the main repo, which has its own sibling `package-lock.json` — Turbopack's root inference picks that as the workspace root instead of the worktree itself unless `turbopack.root` is pinned explicitly in `next.config.ts` (`path.join(__dirname)`), silently bundling from the wrong `node_modules` and producing a duplicate React instance ("Invalid hook call" in every client component using a hook). Fixed in Task 14.
- Shadcn `select`/`checkbox` primitives for this project's `base-nova` (Base UI, not Radix) style were generated and inspected directly (not assumed) — their real composition (`Select`/`SelectTrigger`/`SelectValue`/`SelectContent`/`SelectItem`, `Checkbox` with `checked`/`onCheckedChange`) is used as-is in this plan.
- `next/image` was confirmed to render correctly under this project's existing Vitest/jsdom setup (spiked and verified directly) — no additional mocking needed in component tests.

---

### Task 1: `inStock` field on `Product`

**Files:**
- Modify: `prisma/schema.prisma` (`Product` model, after the `rewardPoints` field)
- Create: `prisma/migrations/<timestamp>_add_product_in_stock/migration.sql`
- Modify: `tests/unit/product-repository.test.ts`

**Interfaces:**
- Produces: `Product.inStock: boolean` (default `true`), consumed by `findPublishedProductsForListing` (Task 6) and `ProductListItem` (Task 7)

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/product-repository.test.ts` (inside the existing `describe("product.repository", ...)` block, after the last `it`):

```ts
  it("defaults inStock to true and can be created as out of stock", async () => {
    const inStockProduct = await createProduct({ sku: "STOCK-1", slug: "stock-1", name: "In Stock" });
    const outOfStockProduct = await createProduct({
      sku: "STOCK-2",
      slug: "stock-2",
      name: "Out of Stock",
      inStock: false,
    });

    expect((await findProductById(inStockProduct.id))?.inStock).toBe(true);
    expect((await findProductById(outOfStockProduct.id))?.inStock).toBe(false);
  });
```

Add `findProductById` to the existing import from `@/repositories/product.repository` at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: FAIL — Prisma throws on the unknown `inStock` field (`Unknown argument 'inStock'`)

- [ ] **Step 3: Add the field to the schema**

In `prisma/schema.prisma`, in `model Product`, change:

```prisma
  publishedAt      DateTime?
  rewardPoints     Int           @default(0)

  brandId String?
```

to:

```prisma
  publishedAt      DateTime?
  rewardPoints     Int           @default(0)
  inStock          Boolean       @default(true)

  brandId String?
```

And change the model's existing index line:

```prisma
  @@index([status])
  @@index([brandId])
```

to:

```prisma
  @@index([status])
  @@index([status, inStock])
  @@index([brandId])
```

- [ ] **Step 4: Sync the local dev database**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: PASS (4 tests, including the new one)

- [ ] **Step 6: Generate an incremental migration file for this one field (no DB connection needed)**

```bash
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_product_in_stock"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script > "prisma/migrations/${TS}_add_product_in_stock/migration.sql"
```

Expected: `migration.sql` contains an `ALTER TABLE "Product" ADD COLUMN "inStock" BOOLEAN NOT NULL DEFAULT true;` plus a `CREATE INDEX` for `[status, inStock]`. Note the resulting folder name — Step 7 refers back to it.

- [ ] **Step 7: Register the migration as applied (the column already exists via `db push`, so this records history without re-running SQL)**

```bash
npx prisma migrate resolve --applied "<the folder name from Step 6>"
```

- [ ] **Step 8: Verify no drift**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`, new migration listed as applied

Run: `npx prisma db push`
Expected: `The database is already in sync with the Prisma schema.`

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/unit/product-repository.test.ts
git commit -m "feat: add inStock field to Product for the availability filter"
```

---

### Task 2: Listing query-param validation schema

**Files:**
- Create: `src/validation/product-listing.schema.ts`
- Test: `tests/unit/product-listing-schema.test.ts`

**Interfaces:**
- Produces: `productSortValues` (readonly tuple), `productListingQuerySchema` (Zod schema), `type ProductListingQuery = z.infer<typeof productListingQuerySchema>` — consumed by the `GET /api/products` route handler (Task 8)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-listing-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { productListingQuerySchema } from "@/validation/product-listing.schema";

describe("productListingQuerySchema", () => {
  it("fills in defaults for an empty query", () => {
    const result = productListingQuerySchema.parse({});

    expect(result).toEqual({
      page: 1,
      pageSize: 24,
      sort: "newest",
    });
  });

  it("coerces numeric and comma-separated fields", () => {
    const result = productListingQuerySchema.parse({
      page: "2",
      pageSize: "10",
      priceMin: "100",
      priceMax: "500",
      allergens: "peanuts,gluten",
      brands: "oristor",
      inStock: "true",
    });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.priceMin).toBe(100);
    expect(result.priceMax).toBe(500);
    expect(result.allergens).toEqual(["peanuts", "gluten"]);
    expect(result.brands).toEqual(["oristor"]);
    expect(result.inStock).toBe(true);
  });

  it("falls back to defaults for a malformed sort value instead of throwing", () => {
    const result = productListingQuerySchema.parse({ sort: "not-a-real-sort" });

    expect(result.sort).toBe("newest");
  });

  it("falls back to the default page for a negative or zero page number", () => {
    expect(productListingQuerySchema.parse({ page: "-1" }).page).toBe(1);
    expect(productListingQuerySchema.parse({ page: "0" }).page).toBe(1);
  });

  it("caps pageSize at 60 by falling back to the default rather than clamping", () => {
    const result = productListingQuerySchema.parse({ pageSize: "999" });

    expect(result.pageSize).toBe(24);
  });

  it("never throws, even for completely garbage input", () => {
    expect(() =>
      productListingQuerySchema.parse({
        page: "abc",
        priceMin: "not-a-number",
        inStock: "maybe",
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-listing-schema.test.ts`
Expected: FAIL — module `@/validation/product-listing.schema` does not exist

- [ ] **Step 3: Write the schema**

Create `src/validation/product-listing.schema.ts`:

```ts
import { z } from "zod";

export const productSortValues = ["price-asc", "price-desc", "newest", "best-selling", "rating"] as const;

/**
 * A comma-separated query value (matches `nuqs`'s `parseAsArrayOf` client-side
 * serialization, e.g. `?brands=oristor,mccormick` — not repeated keys).
 */
const commaSeparatedList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .optional()
  .catch(undefined);

/**
 * `.catch()` (not `.default()`) on every field: `.default()` only fills in a
 * *missing* value, but a malformed request (e.g. `sort=garbage`) must still
 * return 200 with sane defaults rather than reject the whole request — a
 * broken filter link elsewhere on the site shouldn't break this page for the
 * visitor who clicked it.
 */
export const productListingQuerySchema = z.object({
  category: z.string().optional().catch(undefined),
  collection: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(60).catch(24),
  sort: z.enum(productSortValues).catch("newest"),
  priceMin: z.coerce.number().nonnegative().optional().catch(undefined),
  priceMax: z.coerce.number().nonnegative().optional().catch(undefined),
  allergens: commaSeparatedList,
  certifications: commaSeparatedList,
  brands: commaSeparatedList,
  inStock: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .catch(undefined),
});

export type ProductListingQuery = z.infer<typeof productListingQuerySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-listing-schema.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/validation/product-listing.schema.ts tests/unit/product-listing-schema.test.ts
git commit -m "feat: add Zod schema for the product listing query-param contract"
```

---

### Task 3: URL state — `nuqs` setup and shared parsers

**Files:**
- Modify: `package.json`, `package-lock.json` (add `nuqs`)
- Create: `src/lib/product-listing-params.ts`
- Create: `src/lib/product-listing-loader.ts`
- Modify: `src/app/providers.tsx`
- Create: `src/hooks/use-product-listing-params.ts`
- Test: `tests/unit/use-product-listing-params.test.tsx`

**Interfaces:**
- Produces: `productListingParsers` (shared nuqs keyMap), `loadProductListingParams` (server loader), `useProductListingParams()` (client hook returning `[Values<typeof productListingParsers>, SetValues<...>]`) — consumed by `ProductGrid` (Task 13) and the page routes (Task 14)

- [ ] **Step 1: Install `nuqs`**

Run: `npm install nuqs@2.9.0`

- [ ] **Step 2: Write the failing test**

Create `tests/unit/use-product-listing-params.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";

import { useProductListingParams } from "@/hooks/use-product-listing-params";

describe("useProductListingParams", () => {
  it("defaults to page 1 and newest sort when the URL has no query", () => {
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter(),
    });

    const [params] = result.current;
    expect(params.page).toBe(1);
    expect(params.sort).toBe("newest");
    expect(params.allergens).toBeNull();
  });

  it("parses an existing query string", () => {
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter({
        searchParams: "?page=3&sort=price-asc&brands=oristor,mccormick",
      }),
    });

    const [params] = result.current;
    expect(params.page).toBe(3);
    expect(params.sort).toBe("price-asc");
    expect(params.brands).toEqual(["oristor", "mccormick"]);
  });

  it("updates the URL when setParams is called", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useProductListingParams(), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });

    await act(async () => {
      await result.current[1]({ page: 2 });
    });

    expect(onUrlUpdate).toHaveBeenCalled();
    const event = onUrlUpdate.mock.calls[0][0];
    expect(event.searchParams.get("page")).toBe("2");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-product-listing-params.test.tsx`
Expected: FAIL — modules `@/hooks/use-product-listing-params` and `@/lib/product-listing-params` don't exist

- [ ] **Step 4: Write the shared parsers**

Create `src/lib/product-listing-params.ts`:

```ts
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

export const productSortValues = ["price-asc", "price-desc", "newest", "best-selling", "rating"] as const;

/**
 * Single source of truth for the product-listing URL query state — shared
 * verbatim by the client `useProductListingParams()` hook (`useQueryStates`,
 * see `use-product-listing-params.ts`) and the server-side
 * `loadProductListingParams()` loader (`createLoader`, see
 * `product-listing-loader.ts`). Both are built from this same object, so the
 * client and server always agree on field names, types, and defaults.
 *
 * `pageSize` is deliberately not included here — the client UI never lets a
 * visitor change it, so it never needs to round-trip through the URL (see
 * Global Constraints in the plan this was built from).
 */
export const productListingParsers = {
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(productSortValues).withDefault("newest"),
  priceMin: parseAsFloat,
  priceMax: parseAsFloat,
  allergens: parseAsArrayOf(parseAsString),
  certifications: parseAsArrayOf(parseAsString),
  brands: parseAsArrayOf(parseAsString),
  inStock: parseAsBoolean,
};
```

- [ ] **Step 5: Write the server-side loader**

Create `src/lib/product-listing-loader.ts`:

```ts
import { createLoader } from "nuqs/server";

import { productListingParsers } from "@/lib/product-listing-params";

/**
 * Parses the App Router `searchParams` prop (a `Promise` in Next.js 15/16)
 * using the exact same parser definitions the client hook uses. Kept in its
 * own file (rather than alongside the parsers) because `nuqs/server` is a
 * server-only import — `product-listing-params.ts` stays safe to import
 * from a "use client" file, this file is only ever imported by page.tsx
 * Server Components.
 */
export const loadProductListingParams = createLoader(productListingParsers);
```

- [ ] **Step 6: Wire the `NuqsAdapter` into the app's providers**

In `src/app/providers.tsx`, change:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}
```

to:

```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryClientProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 7: Write the client hook**

Create `src/hooks/use-product-listing-params.ts`:

```ts
"use client";

import { useQueryStates } from "nuqs";

import { productListingParsers } from "@/lib/product-listing-params";

export function useProductListingParams() {
  return useQueryStates(productListingParsers);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-product-listing-params.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/lib/product-listing-params.ts src/lib/product-listing-loader.ts src/app/providers.tsx src/hooks/use-product-listing-params.ts tests/unit/use-product-listing-params.test.tsx
git commit -m "feat: add nuqs URL state for product listing filters/sort/page"
```

---

### Task 4: Category descendant IDs

**Files:**
- Modify: `src/repositories/category.repository.ts`
- Modify: `tests/unit/category-repository.test.ts`

**Interfaces:**
- Produces: `listCategoryAndDescendantIds(categoryId: string): Promise<string[]>` — consumed by `product.service.ts`'s `listProducts()` (Task 7)

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/category-repository.test.ts` (inside the existing `describe` block):

```ts
  it("lists a category's own id plus every descendant id", async () => {
    const root = await createCategory({ name: "Spices", slug: "spices-2" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "curry-powders-2",
      parent: { connect: { id: root.id } },
    });
    const grandchild = await createCategory({
      name: "Roasted Curry Powders",
      slug: "roasted-curry-powders",
      parent: { connect: { id: child.id } },
    });
    const unrelated = await createCategory({ name: "Snacks", slug: "snacks" });

    const ids = await listCategoryAndDescendantIds(root.id);

    expect(ids).toContain(root.id);
    expect(ids).toContain(child.id);
    expect(ids).toContain(grandchild.id);
    expect(ids).not.toContain(unrelated.id);
    expect(ids).toHaveLength(3);
  });

  it("returns just the category's own id when it has no children", async () => {
    const leaf = await createCategory({ name: "Standalone", slug: "standalone" });

    expect(await listCategoryAndDescendantIds(leaf.id)).toEqual([leaf.id]);
  });
```

Add `listCategoryAndDescendantIds` to the existing import from `@/repositories/category.repository`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/category-repository.test.ts`
Expected: FAIL — `listCategoryAndDescendantIds` is not exported

- [ ] **Step 3: Implement it**

Add to `src/repositories/category.repository.ts` (after `getCategoryTree`):

```ts
export async function listCategoryAndDescendantIds(categoryId: string): Promise<string[]> {
  const ids = [categoryId];
  const children = await listChildCategories(categoryId);
  for (const child of children) {
    ids.push(...(await listCategoryAndDescendantIds(child.id)));
  }
  return ids;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/category-repository.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/category.repository.ts tests/unit/category-repository.test.ts
git commit -m "feat: add listCategoryAndDescendantIds for category-scoped listings"
```

---

### Task 5: Bulk price resolution

**Files:**
- Modify: `src/repositories/pricing.repository.ts`
- Modify: `src/services/pricing.service.ts`
- Modify: `tests/unit/pricing-service.test.ts`

**Interfaces:**
- Produces: `resolvePricesForProducts(productIds: string[], params?: { customerGroup?: CustomerGroup; quantity?: number; date?: Date }): Promise<Map<string, ResolvedPrice>>` — consumed by `product.service.ts`'s `listProducts()` (Task 7)
- Consumes: existing `resolvePrice()`, `ResolvedPrice`, `PriceTier` from `pricing.service.ts` (STORY-009) — refactored to share logic, not reimplemented

This task refactors `resolvePrice()` to extract its priority/tie-break decision logic into a pure function (`resolveFromTierData`), then builds `resolvePricesForProducts()` on top of **5 new bulk repository queries** (one per pricing tier, `productId: { in: [...] }`) instead of 5 queries *per product* — required both to fulfil the design's stated intent and because PGlite (the local dev DB) only supports one connection at a time, so N-per-product parallel fetches would cause real connection contention at listing scale.

- [ ] **Step 1: Confirm the current baseline is green before refactoring**

Run: `npx vitest run tests/unit/pricing-service.test.ts`
Expected: PASS (9 tests) — this is the regression baseline; every one of these must still pass after Step 3's refactor

- [ ] **Step 2: Write the failing test for the new bulk function**

Add to `tests/unit/pricing-service.test.ts` (new `describe` block, after the existing `describe("resolvePrice", ...)`):

```ts
describe("resolvePricesForProducts", () => {
  it("resolves independent prices for multiple products in one call", async () => {
    const productA = await createProduct({ sku: "BULK-A", slug: "bulk-a", name: "A" });
    const productB = await createProduct({ sku: "BULK-B", slug: "bulk-b", name: "B" });
    await createStandardPrice({ product: { connect: { id: productA.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: productB.id } }, price: "300.00" });
    await createSalePrice({
      product: { connect: { id: productB.id } },
      price: "250.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePricesForProducts([productA.id, productB.id], {
      date: new Date("2026-07-15"),
    });

    expect(resolved.get(productA.id)?.tier).toBe("standard");
    expect(resolved.get(productA.id)?.price.toFixed(2)).toBe("500.00");
    expect(resolved.get(productB.id)?.tier).toBe("sale");
    expect(resolved.get(productB.id)?.price.toFixed(2)).toBe("250.00");
  });

  it("omits a product from the result map when it has no price configured", async () => {
    const product = await createProduct({ sku: "BULK-C", slug: "bulk-c", name: "C" });

    const resolved = await resolvePricesForProducts([product.id]);

    expect(resolved.has(product.id)).toBe(false);
  });

  it("returns an empty map for an empty product list", async () => {
    expect((await resolvePricesForProducts([])).size).toBe(0);
  });

  it("applies a customer-group price only to products where it was configured", async () => {
    const wholesaleProduct = await createProduct({ sku: "BULK-D", slug: "bulk-d", name: "D" });
    const retailOnlyProduct = await createProduct({ sku: "BULK-E", slug: "bulk-e", name: "E" });
    await createStandardPrice({ product: { connect: { id: wholesaleProduct.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: retailOnlyProduct.id } }, price: "300.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: wholesaleProduct.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });

    const resolved = await resolvePricesForProducts([wholesaleProduct.id, retailOnlyProduct.id], {
      customerGroup: "Wholesale",
    });

    expect(resolved.get(wholesaleProduct.id)?.tier).toBe("customerGroup");
    expect(resolved.get(retailOnlyProduct.id)?.tier).toBe("standard");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/pricing-service.test.ts`
Expected: FAIL — `resolvePricesForProducts` is not exported

- [ ] **Step 4: Add the 5 bulk repository queries**

Add to `src/repositories/pricing.repository.ts` (after the existing single-product functions):

```ts
export function getLatestStandardPricesForProducts(productIds: string[]) {
  return prisma.standardPrice.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveSalePricesForProducts(productIds: string[], date: Date) {
  return prisma.salePrice.findMany({
    where: { productId: { in: productIds }, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveCampaignPricesForProducts(productIds: string[], date: Date) {
  return prisma.campaignPrice.findMany({
    where: { productId: { in: productIds }, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getCustomerGroupPricesForProducts(productIds: string[], customerGroup: CustomerGroup) {
  return prisma.customerGroupPrice.findMany({
    where: { productId: { in: productIds }, customerGroup },
    orderBy: { createdAt: "desc" },
  });
}

export function getApplicableVolumeDiscountTiersForProducts(productIds: string[], quantity: number) {
  return prisma.volumeDiscountTier.findMany({
    where: { productId: { in: productIds }, minQuantity: { lte: quantity } },
    orderBy: [{ minQuantity: "desc" }, { createdAt: "desc" }],
  });
}
```

- [ ] **Step 5: Extract the shared resolution logic and add `resolvePricesForProducts`**

In `src/services/pricing.service.ts`, replace the body of `resolvePrice` (everything between the `Promise.all` call and the function's closing brace) — change:

```ts
export async function resolvePrice(params: ResolvePriceParams): Promise<ResolvedPrice | null> {
  const date = params.date ?? new Date();
  const quantity = params.quantity ?? 1;

  const [campaigns, sales, customerGroupPrice, volumeTiers, standard] = await Promise.all([
    pricingRepository.getActiveCampaignPrices(params.productId, date),
    pricingRepository.getActiveSalePrices(params.productId, date),
    params.customerGroup
      ? pricingRepository.getCustomerGroupPrice(params.productId, params.customerGroup)
      : Promise.resolve(null),
    pricingRepository.getApplicableVolumeDiscountTiers(params.productId, quantity),
    pricingRepository.getLatestStandardPrice(params.productId),
  ]);

  if (campaigns.length > 0) return toResolvedPrice(campaigns[0], "campaign");
  if (sales.length > 0) return toResolvedPrice(sales[0], "sale");
  if (customerGroupPrice) return toResolvedPrice(customerGroupPrice, "customerGroup");

  if (volumeTiers.length > 0) {
    const bestTier = volumeTiers[0];
    return {
      price: computeVolumeDiscountPrice(bestTier, standard),
      currency: bestTier.currency,
      tier: "volumeDiscount",
      sourceId: bestTier.id,
    };
  }

  if (standard) return toResolvedPrice(standard, "standard");
  return null;
}
```

to:

```ts
export async function resolvePrice(params: ResolvePriceParams): Promise<ResolvedPrice | null> {
  const date = params.date ?? new Date();
  const quantity = params.quantity ?? 1;

  const [campaigns, sales, customerGroupPrice, volumeTiers, standard] = await Promise.all([
    pricingRepository.getActiveCampaignPrices(params.productId, date),
    pricingRepository.getActiveSalePrices(params.productId, date),
    params.customerGroup
      ? pricingRepository.getCustomerGroupPrice(params.productId, params.customerGroup)
      : Promise.resolve(null),
    pricingRepository.getApplicableVolumeDiscountTiers(params.productId, quantity),
    pricingRepository.getLatestStandardPrice(params.productId),
  ]);

  return resolveFromTierData({ campaigns, sales, customerGroupPrice, volumeTiers, standard });
}

/**
 * Bulk variant of `resolvePrice()` for product listings (STORY-010):
 * fetches all five tiers for every product in exactly 5 queries total
 * (never per-product — see Global Constraints in the plan this was built
 * from, re: PGlite's single-connection limit), then applies the identical
 * priority/tie-break logic per product via `resolveFromTierData`. Products
 * with no price configured at all are simply absent from the returned map.
 */
export async function resolvePricesForProducts(
  productIds: string[],
  params: { customerGroup?: CustomerGroup; quantity?: number; date?: Date } = {},
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>();
  if (productIds.length === 0) return result;

  const date = params.date ?? new Date();
  const quantity = params.quantity ?? 1;

  const [campaigns, sales, customerGroupPrices, volumeTiers, standards] = await Promise.all([
    pricingRepository.getActiveCampaignPricesForProducts(productIds, date),
    pricingRepository.getActiveSalePricesForProducts(productIds, date),
    params.customerGroup
      ? pricingRepository.getCustomerGroupPricesForProducts(productIds, params.customerGroup)
      : Promise.resolve([]),
    pricingRepository.getApplicableVolumeDiscountTiersForProducts(productIds, quantity),
    pricingRepository.getLatestStandardPricesForProducts(productIds),
  ]);

  for (const productId of productIds) {
    const resolved = resolveFromTierData({
      campaigns: campaigns.filter((row) => row.productId === productId),
      sales: sales.filter((row) => row.productId === productId),
      customerGroupPrice: customerGroupPrices.find((row) => row.productId === productId) ?? null,
      volumeTiers: volumeTiers.filter((row) => row.productId === productId),
      standard: standards.find((row) => row.productId === productId) ?? null,
    });
    if (resolved) result.set(productId, resolved);
  }

  return result;
}

interface TierData {
  campaigns: PriceRow[];
  sales: PriceRow[];
  customerGroupPrice: PriceRow | null;
  volumeTiers: Array<{
    id: string;
    currency: string;
    discountPrice: Prisma.Decimal | null;
    discountPercent: Prisma.Decimal | null;
  }>;
  standard: PriceRow | null;
}

function resolveFromTierData(data: TierData): ResolvedPrice | null {
  if (data.campaigns.length > 0) return toResolvedPrice(data.campaigns[0], "campaign");
  if (data.sales.length > 0) return toResolvedPrice(data.sales[0], "sale");
  if (data.customerGroupPrice) return toResolvedPrice(data.customerGroupPrice, "customerGroup");

  if (data.volumeTiers.length > 0) {
    const bestTier = data.volumeTiers[0];
    return {
      price: computeVolumeDiscountPrice(bestTier, data.standard),
      currency: bestTier.currency,
      tier: "volumeDiscount",
      sourceId: bestTier.id,
    };
  }

  if (data.standard) return toResolvedPrice(data.standard, "standard");
  return null;
}
```

Note: `campaigns`, `sales`, `customerGroupPrices`, `standards` are all fetched with `orderBy: { createdAt: "desc" }` **globally** across all requested products — `Array.prototype.filter`/`.find` preserve relative order, so filtering down to one product's rows from that globally-sorted array still yields that product's rows in most-recent-first order, making `[0]` (or `.find`'s first match) correct per product. `volumeTiers` relies on the same reasoning with its `[{minQuantity: "desc"}, {createdAt: "desc"}]` ordering.

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `npx vitest run tests/unit/pricing-service.test.ts`
Expected: PASS (13 tests — the original 9 plus 4 new)

- [ ] **Step 7: Confirm no regression on the full pricing-service suite**

Run: `npx vitest run tests/unit/pricing-service.test.ts`
Expected: all 13 PASS, including every original test from Step 1's baseline

- [ ] **Step 8: Commit**

```bash
git add src/repositories/pricing.repository.ts src/services/pricing.service.ts tests/unit/pricing-service.test.ts
git commit -m "feat: add bulk price resolution for product listings"
```

---

### Task 6: Product repository additions for listing

**Files:**
- Modify: `src/repositories/product.repository.ts`
- Modify: `tests/unit/product-repository.test.ts`

**Interfaces:**
- Produces: `ProductListingFilters` (interface), `findPublishedProductsForListing(filters: ProductListingFilters)`, `listAllergens()`, `listCertifications()` — consumed by `product.service.ts`'s `listProducts()` (Task 7) and the page routes' filter-option lists (Task 14)

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/product-repository.test.ts` (new `describe` block, after the existing one):

```ts
describe("findPublishedProductsForListing", () => {
  it("only returns Published products, never other statuses", async () => {
    await createProduct({ sku: "LIST-1", slug: "list-1", name: "Live", status: "Published" });
    await createProduct({ sku: "LIST-2", slug: "list-2", name: "Draft", status: "Draft" });

    const results = await findPublishedProductsForListing({});

    expect(results.map((p) => p.slug)).toEqual(["list-1"]);
  });

  it("filters by category id", async () => {
    const category = await createCategory({ name: "Spice Blends", slug: "spice-blends-list" });
    const other = await createCategory({ name: "Snacks", slug: "snacks-list" });
    await createProduct({
      sku: "LIST-3",
      slug: "list-3",
      name: "In Category",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createProduct({
      sku: "LIST-4",
      slug: "list-4",
      name: "Other Category",
      status: "Published",
      categories: { connect: [{ id: other.id }] },
    });

    const results = await findPublishedProductsForListing({ categoryIds: [category.id] });

    expect(results.map((p) => p.slug)).toEqual(["list-3"]);
  });

  it("excludes products containing a selected allergen to avoid", async () => {
    const peanuts = await createAllergen({ name: "Peanuts" });
    await createProduct({
      sku: "LIST-5",
      slug: "list-5",
      name: "Contains Peanuts",
      status: "Published",
      allergens: { connect: [{ id: peanuts.id }] },
    });
    await createProduct({ sku: "LIST-6", slug: "list-6", name: "Peanut Free", status: "Published" });

    const results = await findPublishedProductsForListing({ allergenNamesToExclude: ["Peanuts"] });

    expect(results.map((p) => p.slug)).toEqual(["list-6"]);
  });

  it("includes only products with a selected certification", async () => {
    const organic = await createCertification({ name: "Organic" });
    await createProduct({
      sku: "LIST-7",
      slug: "list-7",
      name: "Organic Product",
      status: "Published",
      certifications: { connect: [{ id: organic.id }] },
    });
    await createProduct({ sku: "LIST-8", slug: "list-8", name: "Non-Organic", status: "Published" });

    const results = await findPublishedProductsForListing({ certificationIds: [organic.id] });

    expect(results.map((p) => p.slug)).toEqual(["list-7"]);
  });

  it("filters by brand slug", async () => {
    const brand = await createBrand({ name: "Oristor", slug: "oristor-list" });
    await createProduct({
      sku: "LIST-9",
      slug: "list-9",
      name: "Branded",
      status: "Published",
      brand: { connect: { id: brand.id } },
    });
    await createProduct({ sku: "LIST-10", slug: "list-10", name: "Unbranded", status: "Published" });

    const results = await findPublishedProductsForListing({ brandSlugs: ["oristor-list"] });

    expect(results.map((p) => p.slug)).toEqual(["list-9"]);
  });

  it("filters by inStock", async () => {
    await createProduct({
      sku: "LIST-11",
      slug: "list-11",
      name: "In Stock",
      status: "Published",
      inStock: true,
    });
    await createProduct({
      sku: "LIST-12",
      slug: "list-12",
      name: "Out of Stock",
      status: "Published",
      inStock: false,
    });

    const results = await findPublishedProductsForListing({ inStock: true });

    expect(results.map((p) => p.slug)).toEqual(["list-11"]);
  });
});

describe("listAllergens and listCertifications", () => {
  it("lists all allergens alphabetically", async () => {
    await createAllergen({ name: "Peanuts" });
    await createAllergen({ name: "Gluten" });

    const results = await listAllergens();

    expect(results.map((a) => a.name)).toEqual(["Gluten", "Peanuts"]);
  });

  it("lists all certifications alphabetically", async () => {
    await createCertification({ name: "SLS" });
    await createCertification({ name: "Organic" });

    const results = await listCertifications();

    expect(results.map((c) => c.name)).toEqual(["Organic", "SLS"]);
  });
});
```

Update the top-of-file imports in `tests/unit/product-repository.test.ts` to also bring in `createAllergen`, `createCertification`, `findPublishedProductsForListing`, `listAllergens`, `listCertifications` from `@/repositories/product.repository`, and add `await prisma.allergen.deleteMany(); await prisma.certification.deleteMany();` to the existing `afterEach`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: FAIL — none of the new functions are exported

- [ ] **Step 3: Implement the repository additions**

Add to `src/repositories/product.repository.ts` (after `getBundleWithItems`):

```ts
export interface ProductListingFilters {
  categoryIds?: string[];
  collectionId?: string;
  allergenNamesToExclude?: string[];
  certificationIds?: string[];
  brandSlugs?: string[];
  inStock?: boolean;
}

export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
    where: {
      status: "Published",
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
  });
}

export function listAllergens() {
  return prisma.allergen.findMany({ orderBy: { name: "asc" } });
}

export function listCertifications() {
  return prisma.certification.findMany({ orderBy: { name: "asc" } });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/product-repository.test.ts`
Expected: PASS (13 tests — the original 4 plus 9 new)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/product.repository.ts tests/unit/product-repository.test.ts
git commit -m "feat: add findPublishedProductsForListing and allergen/certification listing"
```

---

### Task 7: `ProductListItem` type and `listProducts()`

**Files:**
- Create: `src/types/product.ts`
- Modify: `src/services/product.service.ts`
- Modify: `tests/unit/product-service.test.ts`

**Interfaces:**
- Produces: `ProductListItem` (type, extends `ProductCardData` from `@/types/home` plus `inStock: boolean`), `ProductSort`, `ProductListingParams`, `ProductListingResult`, `listProducts(params: ProductListingParams): Promise<ProductListingResult>` — consumed by `GET /api/products` (Task 8), `ProductGrid`/`useProductListing` (Task 13), and the page routes (Task 14)
- Consumes: `findCategoryBySlug`, `listCategoryAndDescendantIds` (Task 4); `getPublishedCollectionBySlug` (STORY-009); `findPublishedProductsForListing` (Task 6); `resolvePricesForProducts` (Task 5)

- [ ] **Step 1: Create the shared type**

Create `src/types/product.ts`:

```ts
import type { ProductCardData } from "@/types/home";

export interface ProductListItem extends ProductCardData {
  inStock: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/unit/product-service.test.ts` (new `describe` block, after the existing one — add `createCategory`, `createCollection`, `createStandardPrice`, `createSalePrice` to the top-of-file imports as needed, and `listProducts` from `@/services/product.service`):

```ts
describe("listProducts", () => {
  it("returns only Published products with a resolved Retail price", async () => {
    const published = await createProduct({
      sku: "LP-1",
      slug: "lp-1",
      name: "Published Product",
      status: "Published",
    });
    await createProduct({ sku: "LP-2", slug: "lp-2", name: "Draft Product", status: "Draft" });
    await createStandardPrice({ product: { connect: { id: published.id } }, price: "650.00" });

    const result = await listProducts({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("Published Product");
    expect(result.items[0].price).toBe(650);
  });

  it("excludes a product with no price configured", async () => {
    await createProduct({ sku: "LP-3", slug: "lp-3", name: "No Price", status: "Published" });

    const result = await listProducts({});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("includes subcategory products when filtering by a parent category", async () => {
    const parent = await createCategory({ name: "Spices", slug: "svc-spices" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "svc-curry-powders",
      parent: { connect: { id: parent.id } },
    });
    const product = await createProduct({
      sku: "LP-4",
      slug: "lp-4",
      name: "In Subcategory",
      status: "Published",
      categories: { connect: [{ id: child.id }] },
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });

    const result = await listProducts({ categorySlug: "svc-spices" });

    expect(result.items.map((i) => i.name)).toEqual(["In Subcategory"]);
  });

  it("returns an empty result for an unknown category slug", async () => {
    const result = await listProducts({ categorySlug: "does-not-exist" });

    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false });
  });

  it("returns an empty result for a collection outside its date window", async () => {
    await createCollection({
      name: "Old Promo",
      slug: "svc-old-promo",
      status: "Active",
      endDate: new Date("2020-01-01"),
    });

    const result = await listProducts({ collectionSlug: "svc-old-promo" });

    expect(result.items).toHaveLength(0);
  });

  it("filters by price range", async () => {
    const cheap = await createProduct({ sku: "LP-5", slug: "lp-5", name: "Cheap", status: "Published" });
    const expensive = await createProduct({
      sku: "LP-6",
      slug: "lp-6",
      name: "Expensive",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: cheap.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: expensive.id } }, price: "900.00" });

    const result = await listProducts({ filters: { priceMin: 500 } });

    expect(result.items.map((i) => i.name)).toEqual(["Expensive"]);
  });

  it("sorts by price ascending and descending", async () => {
    const a = await createProduct({ sku: "LP-7", slug: "lp-7", name: "A", status: "Published" });
    const b = await createProduct({ sku: "LP-8", slug: "lp-8", name: "B", status: "Published" });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "300.00" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "100.00" });

    const ascending = await listProducts({ sort: "price-asc" });
    const descending = await listProducts({ sort: "price-desc" });

    expect(ascending.items.map((i) => i.name)).toEqual(["B", "A"]);
    expect(descending.items.map((i) => i.name)).toEqual(["A", "B"]);
  });

  it("sorts newest by publishedAt descending, and falls back to newest for best-selling/rating", async () => {
    const older = await createProduct({
      sku: "LP-9",
      slug: "lp-9",
      name: "Older",
      status: "Published",
      publishedAt: new Date("2026-01-01"),
    });
    const newer = await createProduct({
      sku: "LP-10",
      slug: "lp-10",
      name: "Newer",
      status: "Published",
      publishedAt: new Date("2026-06-01"),
    });
    await createStandardPrice({ product: { connect: { id: older.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: newer.id } }, price: "100.00" });

    const newest = await listProducts({ sort: "newest" });
    const bestSelling = await listProducts({ sort: "best-selling" });
    const rating = await listProducts({ sort: "rating" });

    expect(newest.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
    expect(bestSelling.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
    expect(rating.items.map((i) => i.name)).toEqual(["Newer", "Older"]);
  });

  it("paginates correctly at the first page, last page, and beyond the last page", async () => {
    for (let i = 0; i < 5; i++) {
      const product = await createProduct({
        sku: `LP-PAGE-${i}`,
        slug: `lp-page-${i}`,
        name: `Product ${i}`,
        status: "Published",
        publishedAt: new Date(2026, 0, i + 1),
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const firstPage = await listProducts({ page: 1, pageSize: 2 });
    const lastPage = await listProducts({ page: 3, pageSize: 2 });
    const beyondLastPage = await listProducts({ page: 10, pageSize: 2 });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBe(5);
    expect(firstPage.hasNextPage).toBe(true);

    expect(lastPage.items).toHaveLength(1);
    expect(lastPage.hasNextPage).toBe(false);

    expect(beyondLastPage.items).toHaveLength(0);
    expect(beyondLastPage.hasNextPage).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/unit/product-service.test.ts`
Expected: FAIL — `listProducts` is not exported

- [ ] **Step 4: Implement `listProducts()`**

In `src/services/product.service.ts`, replace the single existing import line (`import * as productRepository from "@/repositories/product.repository";`) with the 5-line import block below, leaving the rest of the file (the three existing exported functions) untouched, then append everything after the import block to the end of the file:

```ts
import type { CustomerGroup } from "@/generated/prisma/client";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionService from "@/services/collection.service";
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
import type { ProductListItem } from "@/types/product";

export async function getProductBySlug(slug: string) {
  const product = await productRepository.findProductBySlug(slug);
  if (!product || product.status !== "Published") return null;
  return product;
}

export function getProductBySlugForAdmin(slug: string) {
  return productRepository.findProductBySlug(slug);
}

export async function listPublishedProductsByCategory(categoryId: string) {
  const products = await productRepository.listProductsByCategory(categoryId);
  return products.filter((product) => product.status === "Published");
}

export type ProductSort = "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";

export interface ProductListingFiltersInput {
  priceMin?: number;
  priceMax?: number;
  /** Products containing ANY of these allergens are excluded. */
  allergens?: string[];
  /** Products with ANY of these certification ids are included. */
  certifications?: string[];
  /** Products with ANY of these brand slugs are included. */
  brands?: string[];
  inStock?: boolean;
}

export interface ProductListingParams {
  categorySlug?: string;
  collectionSlug?: string;
  filters?: ProductListingFiltersInput;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  customerGroup?: CustomerGroup;
}

export interface ProductListingResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

function emptyListingResult(page: number, pageSize: number): ProductListingResult {
  return { items: [], total: 0, page, pageSize, hasNextPage: false };
}

export async function listProducts(params: ProductListingParams): Promise<ProductListingResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const filters = params.filters ?? {};
  const sort = params.sort ?? "newest";

  let categoryIds: string[] | undefined;
  if (params.categorySlug) {
    const category = await categoryRepository.findCategoryBySlug(params.categorySlug);
    if (!category) return emptyListingResult(page, pageSize);
    categoryIds = await categoryRepository.listCategoryAndDescendantIds(category.id);
  }

  let collectionId: string | undefined;
  if (params.collectionSlug) {
    const collection = await collectionService.getPublishedCollectionBySlug(params.collectionSlug);
    if (!collection) return emptyListingResult(page, pageSize);
    collectionId = collection.id;
  }

  const products = await productRepository.findPublishedProductsForListing({
    categoryIds,
    collectionId,
    allergenNamesToExclude: filters.allergens,
    certificationIds: filters.certifications,
    brandSlugs: filters.brands,
    inStock: filters.inStock,
  });

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    products.map((product) => product.id),
    { customerGroup: params.customerGroup ?? "Retail" },
  );

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

  candidates = sortCandidates(candidates, sort);

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const pageCandidates = candidates.slice(start, start + pageSize);

  const items: ProductListItem[] = pageCandidates.map(({ product, price, currency }) => {
    const primaryImage = product.images[0];
    return {
      id: product.id,
      name: product.name,
      href: `/products/${product.slug}`,
      imageSrc: primaryImage?.url ?? "",
      imageAlt: primaryImage?.altText ?? product.name,
      price,
      currency,
      inStock: product.inStock,
    };
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasNextPage: start + pageSize < total,
  };
}

function sortCandidates<T extends { product: { publishedAt: Date | null }; price: number }>(
  candidates: T[],
  sort: ProductSort,
): T[] {
  const sorted = [...candidates];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    // "best-selling" and "rating" fall back to "newest" ordering — no Order
    // model (Commerce Platform epic) or reviews/ratings data (STORY-015)
    // exists yet to sort by. See
    // docs/superpowers/specs/2026-07-16-product-listing-design.md.
    case "best-selling":
    case "rating":
    case "newest":
    default:
      return sorted.sort((a, b) => {
        const aTime = a.product.publishedAt?.getTime() ?? 0;
        const bTime = b.product.publishedAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/product-service.test.ts`
Expected: PASS (12 tests — the original 3 plus 9 new)

- [ ] **Step 6: Commit**

```bash
git add src/types/product.ts src/services/product.service.ts tests/unit/product-service.test.ts
git commit -m "feat: add listProducts() composing category/collection/filters/sort/pagination"
```

---

### Task 8: `GET /api/products` route handler

**Files:**
- Create: `src/app/api/products/route.ts`
- Test: `tests/unit/products-route.test.ts`

**Interfaces:**
- Consumes: `productListingQuerySchema` (Task 2), `listProducts` (Task 7)
- Produces: `GET(request: Request): Promise<Response>` — consumed by `useProductListing` (Task 13)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/products-route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/route";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("GET /api/products", () => {
  it("returns published products with pagination metadata", async () => {
    const product = await createProduct({
      sku: "ROUTE-1",
      slug: "route-product",
      name: "Route Product",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "199.00" });

    const response = await GET(new Request("http://localhost/api/products"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Route Product");
    expect(body.total).toBe(1);
    expect(body.hasNextPage).toBe(false);
  });

  it("returns 200 with default sort applied when given a malformed sort value", async () => {
    const response = await GET(new Request("http://localhost/api/products?sort=not-a-real-sort"));

    expect(response.status).toBe(200);
  });

  it("filters by category slug via the category query param", async () => {
    const category = await createCategory({ name: "Spices", slug: "route-spices" });
    const inCategory = await createProduct({
      sku: "ROUTE-2",
      slug: "route-2",
      name: "In Category",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createProduct({ sku: "ROUTE-3", slug: "route-3", name: "Other", status: "Published" });
    await createStandardPrice({ product: { connect: { id: inCategory.id } }, price: "100.00" });

    const response = await GET(new Request("http://localhost/api/products?category=route-spices"));
    const body = await response.json();

    expect(body.items.map((item: { name: string }) => item.name)).toEqual(["In Category"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/products-route.test.ts`
Expected: FAIL — `@/app/api/products/route` does not exist

- [ ] **Step 3: Implement the route handler**

Create `src/app/api/products/route.ts`:

```ts
import { NextResponse } from "next/server";

import { listProducts } from "@/services/product.service";
import { productListingQuerySchema } from "@/validation/product-listing.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = productListingQuerySchema.parse(rawQuery);

  const result = await listProducts({
    categorySlug: query.category,
    collectionSlug: query.collection,
    filters: {
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      allergens: query.allergens,
      certifications: query.certifications,
      brands: query.brands,
      inStock: query.inStock,
    },
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  });

  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/products-route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/route.ts tests/unit/products-route.test.ts
git commit -m "feat: add GET /api/products route handler"
```

---

### Task 9: `ProductCard` component

**Files:**
- Create: `src/components/storefront/product/product-card.tsx`
- Test: `tests/unit/product-card.test.tsx`

**Interfaces:**
- Consumes: `ProductListItem` (Task 7)
- Produces: `ProductCard({ product: ProductListItem })` — consumed by `ProductGrid` (Task 13)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

const baseProduct: ProductListItem = {
  id: "1",
  name: "Roasted Curry Powder",
  href: "/products/roasted-curry-powder",
  imageSrc: "/images/curry-powder.jpg",
  imageAlt: "Roasted Curry Powder",
  price: 650,
  currency: "LKR",
  inStock: true,
};

describe("ProductCard", () => {
  it("renders the product name, price, and link", () => {
    render(<ProductCard product={baseProduct} />);

    expect(screen.getByText("Roasted Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("LKR 650")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("shows an out-of-stock badge and hides the price when inStock is false", () => {
    render(<ProductCard product={{ ...baseProduct, inStock: false }} />);

    expect(screen.getByText("Out of stock")).toBeInTheDocument();
    expect(screen.queryByText("LKR 650")).not.toBeInTheDocument();
  });

  it("renders a rating when present", () => {
    render(<ProductCard product={{ ...baseProduct, rating: 4.5, reviewCount: 12 }} />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-card.test.tsx`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement the component**

Create `src/components/storefront/product/product-card.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ProductListItem } from "@/types/product";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

export function ProductCard({ product }: { product: ProductListItem }) {
  return (
    <Link href={product.href} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
        {product.badge && <Badge className="absolute top-2 left-2 z-10">{product.badge}</Badge>}
        <Image
          src={product.imageSrc}
          alt={product.imageAlt}
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
          className={
            product.inStock
              ? "object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              : "object-contain p-4 opacity-50"
          }
        />
        {!product.inStock && (
          <Badge variant="secondary" className="absolute bottom-2 left-2 z-10">
            Out of stock
          </Badge>
        )}
      </div>
      <p className="mt-3 text-small font-medium text-charcoal">{product.name}</p>
      {product.rating && (
        <div className="mt-1 flex items-center gap-1 text-caption text-charcoal/80">
          <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
          <span>{product.rating}</span>
          {product.reviewCount && <span>({product.reviewCount})</span>}
        </div>
      )}
      {product.inStock && (
        <p className="mt-1 font-number text-body text-charcoal">
          {formatPrice(product.price, product.currency)}
        </p>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-card.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/product/product-card.tsx tests/unit/product-card.test.tsx
git commit -m "feat: add reusable ProductCard component"
```

---

### Task 10: `Pagination` component

**Files:**
- Create: `src/components/storefront/product/pagination.tsx`
- Test: `tests/unit/pagination.test.tsx`

**Interfaces:**
- Produces: `Pagination({ page, pageSize, total, onPageChange })` — consumed by `ProductGrid` (Task 13)

- [ ] **Step 1: Write the failing test**

Create `tests/unit/pagination.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/storefront/product/pagination";

describe("Pagination", () => {
  it("renders one button per page and marks the current page", () => {
    render(<Pagination page={2} pageSize={10} total={35} onPageChange={vi.fn()} />);

    // 4 numbered pages (ceil(35/10)) + previous + next
    expect(screen.getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
  });

  it("disables the previous button on the first page", () => {
    render(<Pagination page={1} pageSize={10} total={35} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
  });

  it("disables the next button on the last page", () => {
    render(<Pagination page={4} pageSize={10} total={35} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("calls onPageChange with the clicked page number", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={10} total={35} onPageChange={onPageChange} />);

    await user.click(screen.getByRole("button", { name: "3" }));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders a single, disabled page for a zero-result set", () => {
    render(<Pagination page={1} pageSize={10} total={0} onPageChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pagination.test.tsx`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement the component**

Create `src/components/storefront/product/pagination.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-input disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-lg text-small",
            p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-input disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pagination.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/product/pagination.tsx tests/unit/pagination.test.tsx
git commit -m "feat: add Pagination component"
```

---

### Task 11: `SortSelect` component

**Files:**
- Create: `src/components/ui/select.tsx` (generated by Shadcn CLI)
- Create: `src/components/storefront/product/sort-select.tsx`
- Test: `tests/unit/sort-select.test.tsx`

**Interfaces:**
- Consumes: `ProductSort` (Task 7)
- Produces: `SortSelect({ value, onValueChange })` — consumed by `ProductGrid` (Task 13)

- [ ] **Step 1: Add the Shadcn `select` primitive**

Run: `npx shadcn@latest add select --yes`
Expected: creates `src/components/ui/select.tsx` (Base UI-backed, per this project's `base-nova` style), exporting `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator`

- [ ] **Step 2: Write the failing test**

Create `tests/unit/sort-select.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortSelect } from "@/components/storefront/product/sort-select";

describe("SortSelect", () => {
  it("shows the current sort value", () => {
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Newest");
  });

  it("calls onValueChange when a new option is selected", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SortSelect value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Price: Low to High" }));

    expect(onValueChange).toHaveBeenCalledWith("price-asc");
  });

  it("disables the best-selling and rating options", async () => {
    const user = userEvent.setup();
    render(<SortSelect value="newest" onValueChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: /Best Selling/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/sort-select.test.tsx`
Expected: FAIL — `@/components/storefront/product/sort-select` does not exist

- [ ] **Step 4: Implement the component**

Create `src/components/storefront/product/sort-select.tsx`:

```tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductSort } from "@/services/product.service";

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

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/sort-select.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/select.tsx src/components/storefront/product/sort-select.tsx tests/unit/sort-select.test.tsx
git commit -m "feat: add SortSelect component"
```

---

### Task 12: Filter components

**Files:**
- Create: `src/components/ui/checkbox.tsx` (generated by Shadcn CLI)
- Create: `src/components/storefront/product/filter-controls.tsx`
- Create: `src/components/storefront/product/filter-sidebar.tsx`
- Create: `src/components/storefront/product/filter-drawer.tsx`
- Test: `tests/unit/filter-controls.test.tsx`

**Interfaces:**
- Produces: `FilterOptionGroup`, `FilterValues`, `FilterControls`, `FilterSidebar`, `FilterDrawer` — consumed by `ProductGrid` (Task 13)

- [ ] **Step 1: Add the Shadcn `checkbox` primitive**

Run: `npx shadcn@latest add checkbox --yes`
Expected: creates `src/components/ui/checkbox.tsx`, exporting `Checkbox` (accepts `checked`/`onCheckedChange`)

- [ ] **Step 2: Write the failing test**

Create `tests/unit/filter-controls.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterControls, type FilterValues } from "@/components/storefront/product/filter-controls";

const baseValues: FilterValues = {
  priceMin: undefined,
  priceMax: undefined,
  allergens: [],
  certifications: [],
  brands: [],
  inStock: false,
};

describe("FilterControls", () => {
  it("toggles an allergen on when its checkbox is checked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={baseValues}
        onChange={onChange}
        allergenOptions={[{ value: "Peanuts", label: "Peanuts" }]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Peanuts" }));

    expect(onChange).toHaveBeenCalledWith({ ...baseValues, allergens: ["Peanuts"] });
  });

  it("updates priceMin when the min price input changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={baseValues}
        onChange={onChange}
        allergenOptions={[]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.type(screen.getByLabelText("Minimum price"), "5");

    expect(onChange).toHaveBeenLastCalledWith({ ...baseValues, priceMin: 5 });
  });

  it("resets all values when Clear filters is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterControls
        values={{ ...baseValues, allergens: ["Peanuts"], inStock: true }}
        onChange={onChange}
        allergenOptions={[{ value: "Peanuts", label: "Peanuts" }]}
        certificationOptions={[]}
        brandOptions={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onChange).toHaveBeenCalledWith(baseValues);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/filter-controls.test.tsx`
Expected: FAIL — module does not exist

- [ ] **Step 4: Implement `FilterControls`**

Create `src/components/storefront/product/filter-controls.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FilterOptionGroup {
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface FilterValues {
  priceMin?: number;
  priceMax?: number;
  allergens: string[];
  certifications: string[];
  brands: string[];
  inStock: boolean;
}

const emptyFilterValues: FilterValues = {
  priceMin: undefined,
  priceMax: undefined,
  allergens: [],
  certifications: [],
  brands: [],
  inStock: false,
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

interface FilterControlsProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  allergenOptions: FilterOptionGroup["options"];
  certificationOptions: FilterOptionGroup["options"];
  brandOptions: FilterOptionGroup["options"];
}

export function FilterControls({
  values,
  onChange,
  allergenOptions,
  certificationOptions,
  brandOptions,
}: FilterControlsProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Price Range</legend>
        <div className="flex items-center gap-2">
          <Label htmlFor="price-min" className="sr-only">
            Minimum price
          </Label>
          <Input
            id="price-min"
            type="number"
            min={0}
            placeholder="Min"
            value={values.priceMin ?? ""}
            onChange={(event) =>
              onChange({
                ...values,
                priceMin: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
          <span aria-hidden="true">–</span>
          <Label htmlFor="price-max" className="sr-only">
            Maximum price
          </Label>
          <Input
            id="price-max"
            type="number"
            min={0}
            placeholder="Max"
            value={values.priceMax ?? ""}
            onChange={(event) =>
              onChange({
                ...values,
                priceMax: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Allergen-Free</legend>
        {allergenOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-small text-charcoal">
            <Checkbox
              checked={values.allergens.includes(option.value)}
              onCheckedChange={() =>
                onChange({ ...values, allergens: toggleValue(values.allergens, option.value) })
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Certifications</legend>
        {certificationOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-small text-charcoal">
            <Checkbox
              checked={values.certifications.includes(option.value)}
              onCheckedChange={() =>
                onChange({
                  ...values,
                  certifications: toggleValue(values.certifications, option.value),
                })
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Brand</legend>
        {brandOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-small text-charcoal">
            <Checkbox
              checked={values.brands.includes(option.value)}
              onCheckedChange={() =>
                onChange({ ...values, brands: toggleValue(values.brands, option.value) })
              }
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-small text-charcoal">
        <Checkbox
          checked={values.inStock}
          onCheckedChange={(checked) => onChange({ ...values, inStock: checked === true })}
        />
        In stock only
      </label>

      <Button type="button" variant="outline" onClick={() => onChange(emptyFilterValues)}>
        Clear filters
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Implement `FilterSidebar` and `FilterDrawer`**

Create `src/components/storefront/product/filter-sidebar.tsx`:

```tsx
import type { ComponentProps } from "react";

import { FilterControls } from "./filter-controls";

export function FilterSidebar(props: ComponentProps<typeof FilterControls>) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filter products">
      <FilterControls {...props} />
    </aside>
  );
}
```

Create `src/components/storefront/product/filter-drawer.tsx`:

```tsx
"use client";

import { useState, type ComponentProps } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterControls } from "./filter-controls";

export function FilterDrawer(props: ComponentProps<typeof FilterControls>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <FilterControls {...props} />
          </div>
          <Button type="button" className="mx-4 mb-4" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

This matches the existing `MobileMenuDrawer` (`src/components/storefront/layout/mobile-menu-drawer.tsx`, STORY-004) pattern of a plain `Button` toggling `open` state passed to a controlled `Sheet` — no `SheetTrigger` render-prop composition needed.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/filter-controls.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/checkbox.tsx src/components/storefront/product/filter-controls.tsx src/components/storefront/product/filter-sidebar.tsx src/components/storefront/product/filter-drawer.tsx tests/unit/filter-controls.test.tsx
git commit -m "feat: add FilterControls, FilterSidebar, and FilterDrawer components"
```

---

### Task 13: `useProductListing` hook and `ProductGrid` composition

**Files:**
- Create: `src/hooks/use-product-listing.ts`
- Create: `src/components/storefront/product/product-grid.tsx`
- Test: `tests/unit/product-grid.test.tsx`

**Interfaces:**
- Consumes: `useProductListingParams` (Task 3), `ProductListingResult`/`ProductSort` (Task 7), `ProductCard` (Task 9), `Pagination` (Task 10), `SortSelect` (Task 11), `FilterControls`/`FilterSidebar`/`FilterDrawer` (Task 12)
- Produces: `useProductListing(scope, params, initialData)`, `ProductGrid({ scope, initialData, allergenOptions, certificationOptions, brandOptions })` — consumed by the page routes (Task 14). This is the client "island" the page routes hydrate into — it owns the single `useProductListingParams()` call and lays out filters, sort, the grid, and pagination together, since they all share the same URL state.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-grid.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductGrid } from "@/components/storefront/product/product-grid";
import type { ProductListingResult } from "@/services/product.service";

const initialData: ProductListingResult = {
  items: [
    {
      id: "1",
      name: "Curry Powder",
      href: "/products/curry-powder",
      imageSrc: "/images/curry-powder.jpg",
      imageAlt: "Curry Powder",
      price: 650,
      currency: "LKR",
      inStock: true,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 24,
  hasNextPage: false,
};

function renderProductGrid(data: ProductListingResult) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductGrid
        scope={{}}
        initialData={data}
        allergenOptions={[]}
        certificationOptions={[]}
        brandOptions={[]}
      />
    </QueryClientProvider>,
    { wrapper: withNuqsTestingAdapter() },
  );
}

describe("ProductGrid", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(initialData) }),
    );
  });

  it("renders products from initialData immediately", () => {
    renderProductGrid(initialData);
    expect(screen.getByText("Curry Powder")).toBeInTheDocument();
  });

  it("renders a zero-result state with a clear-filters control when the API returns no items", async () => {
    const empty: ProductListingResult = { items: [], total: 0, page: 1, pageSize: 24, hasNextPage: false };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(empty) }));

    renderProductGrid(empty);

    await waitFor(() => {
      expect(screen.getByText("No products match your filters.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
  });

  it("renders pagination reflecting the current result", () => {
    renderProductGrid({ ...initialData, total: 50, pageSize: 24 });
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/product-grid.test.tsx`
Expected: FAIL — `@/components/storefront/product/product-grid` and `@/hooks/use-product-listing` don't exist

- [ ] **Step 3: Implement the TanStack Query hook**

Create `src/hooks/use-product-listing.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import type { Values } from "nuqs";

import { productListingParsers } from "@/lib/product-listing-params";
import type { ProductListingResult } from "@/services/product.service";

export interface ProductListingScope {
  category?: string;
  collection?: string;
}

export type ProductListingQueryParams = Values<typeof productListingParsers>;

const PAGE_SIZE = 24;

function buildSearchParams(scope: ProductListingScope, params: ProductListingQueryParams): string {
  const search = new URLSearchParams();
  if (scope.category) search.set("category", scope.category);
  if (scope.collection) search.set("collection", scope.collection);
  search.set("page", String(params.page));
  search.set("sort", params.sort);
  search.set("pageSize", String(PAGE_SIZE));
  if (params.priceMin !== null) search.set("priceMin", String(params.priceMin));
  if (params.priceMax !== null) search.set("priceMax", String(params.priceMax));
  if (params.allergens && params.allergens.length > 0) search.set("allergens", params.allergens.join(","));
  if (params.certifications && params.certifications.length > 0)
    search.set("certifications", params.certifications.join(","));
  if (params.brands && params.brands.length > 0) search.set("brands", params.brands.join(","));
  if (params.inStock !== null) search.set("inStock", String(params.inStock));
  return search.toString();
}

export function useProductListing(
  scope: ProductListingScope,
  params: ProductListingQueryParams,
  initialData: ProductListingResult,
) {
  return useQuery({
    queryKey: ["products", scope, params],
    queryFn: async () => {
      const response = await fetch(`/api/products?${buildSearchParams(scope, params)}`);
      if (!response.ok) throw new Error("Failed to load products");
      return (await response.json()) as ProductListingResult;
    },
    initialData,
  });
}
```

- [ ] **Step 4: Implement `ProductGrid`**

Create `src/components/storefront/product/product-grid.tsx`:

```tsx
"use client";

import { useProductListingParams } from "@/hooks/use-product-listing-params";
import { useProductListing, type ProductListingScope } from "@/hooks/use-product-listing";
import type { ProductListingResult, ProductSort } from "@/services/product.service";
import type { FilterOptionGroup, FilterValues } from "./filter-controls";
import { FilterSidebar } from "./filter-sidebar";
import { FilterDrawer } from "./filter-drawer";
import { SortSelect } from "./sort-select";
import { ProductCard } from "./product-card";
import { Pagination } from "./pagination";

interface ProductGridProps {
  scope: ProductListingScope;
  initialData: ProductListingResult;
  allergenOptions: FilterOptionGroup["options"];
  certificationOptions: FilterOptionGroup["options"];
  brandOptions: FilterOptionGroup["options"];
}

export function ProductGrid({
  scope,
  initialData,
  allergenOptions,
  certificationOptions,
  brandOptions,
}: ProductGridProps) {
  const [params, setParams] = useProductListingParams();
  const { data, isLoading } = useProductListing(scope, params, initialData);

  const filterValues: FilterValues = {
    priceMin: params.priceMin ?? undefined,
    priceMax: params.priceMax ?? undefined,
    allergens: params.allergens ?? [],
    certifications: params.certifications ?? [],
    brands: params.brands ?? [],
    inStock: params.inStock ?? false,
  };

  function handleFilterChange(next: FilterValues) {
    void setParams({
      page: 1,
      priceMin: next.priceMin ?? null,
      priceMax: next.priceMax ?? null,
      allergens: next.allergens.length > 0 ? next.allergens : null,
      certifications: next.certifications.length > 0 ? next.certifications : null,
      brands: next.brands.length > 0 ? next.brands : null,
      inStock: next.inStock ? true : null,
    });
  }

  function clearFilters() {
    void setParams({
      page: 1,
      priceMin: null,
      priceMax: null,
      allergens: null,
      certifications: null,
      brands: null,
      inStock: null,
    });
  }

  const filterProps = {
    values: filterValues,
    onChange: handleFilterChange,
    allergenOptions,
    certificationOptions,
    brandOptions,
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <FilterSidebar {...filterProps} />
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between gap-4">
          <FilterDrawer {...filterProps} />
          <SortSelect
            value={params.sort}
            onValueChange={(sort: ProductSort) => void setParams({ sort, page: 1 })}
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: initialData.pageSize }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-body text-charcoal">No products match your filters.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-small text-chilli hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(page) => void setParams({ page })}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/product-grid.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-product-listing.ts src/components/storefront/product/product-grid.tsx tests/unit/product-grid.test.tsx
git commit -m "feat: add useProductListing hook and ProductGrid composition"
```

---

### Task 14: Page routes

**Files:**
- Create: `src/app/(storefront)/products/page.tsx`
- Create: `src/app/(storefront)/products/[category]/page.tsx`
- Create: `src/app/(storefront)/products/collections/[collection]/page.tsx`
- Modify: `next.config.ts` (pin `turbopack.root` — see Global Constraints)

**Interfaces:**
- Consumes: `loadProductListingParams` (Task 3), `listProducts` (Task 7), `listAllergens`/`listCertifications` (Task 6), `listBrands` (STORY-009), `findCategoryBySlug` (STORY-009), `getPublishedCollectionBySlug` (STORY-009), `ProductGrid` (Task 13)

No new backend logic in this task — this is pure composition, so a plain manual render check (documented in Step 4 of each page) substitutes for a unit test; the full interactive path is covered by Task 15's Playwright suite.

- [ ] **Step 1: Build `/products` (all products)**

Create `src/app/(storefront)/products/page.tsx`:

```tsx
import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { listProducts } from "@/services/product.service";

export const metadata: Metadata = {
  title: "All Products",
  description: "Browse the full Oristor product catalogue.",
};

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await loadProductListingParams(searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      sort: params.sort,
      page: params.page,
      filters: {
        priceMin: params.priceMin ?? undefined,
        priceMax: params.priceMax ?? undefined,
        allergens: params.allergens ?? undefined,
        certifications: params.certifications ?? undefined,
        brands: params.brands ?? undefined,
        inStock: params.inStock ?? undefined,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: result.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.href,
      name: item.name,
    })),
  };

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <h1 className="text-h1 font-heading text-charcoal">All Products</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{}}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Build `/products/[category]`**

Create `src/app/(storefront)/products/[category]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { findCategoryBySlug } from "@/repositories/category.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { listProducts } from "@/services/product.service";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await findCategoryBySlug(categorySlug);
  if (!category) return {};

  return {
    title: category.metaTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    alternates: category.canonicalUrl ? { canonical: category.canonicalUrl } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const category = await findCategoryBySlug(categorySlug);
  if (!category) notFound();

  const listingParams = await loadProductListingParams(searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      categorySlug,
      sort: listingParams.sort,
      page: listingParams.page,
      filters: {
        priceMin: listingParams.priceMin ?? undefined,
        priceMax: listingParams.priceMax ?? undefined,
        allergens: listingParams.allergens ?? undefined,
        certifications: listingParams.certifications ?? undefined,
        brands: listingParams.brands ?? undefined,
        inStock: listingParams.inStock ?? undefined,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: result.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.href,
      name: item.name,
    })),
  };

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <h1 className="text-h1 font-heading text-charcoal">{category.name}</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{ category: categorySlug }}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Build `/products/collections/[collection]`**

Create `src/app/(storefront)/products/collections/[collection]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Section } from "@/components/storefront/layout/section";
import { ProductGrid } from "@/components/storefront/product/product-grid";
import { loadProductListingParams } from "@/lib/product-listing-loader";
import { listBrands } from "@/repositories/brand.repository";
import { listAllergens, listCertifications } from "@/repositories/product.repository";
import { getPublishedCollectionBySlug } from "@/services/collection.service";
import { listProducts } from "@/services/product.service";

interface CollectionPageProps {
  params: Promise<{ collection: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { collection: collectionSlug } = await params;
  const collection = await getPublishedCollectionBySlug(collectionSlug);
  if (!collection) return {};

  return {
    title: collection.metaTitle ?? collection.name,
    description: collection.metaDescription ?? collection.description ?? undefined,
    alternates: collection.canonicalUrl ? { canonical: collection.canonicalUrl } : undefined,
  };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const { collection: collectionSlug } = await params;
  const collection = await getPublishedCollectionBySlug(collectionSlug);
  if (!collection) notFound();

  const listingParams = await loadProductListingParams(searchParams);

  const [result, allergens, certifications, brands] = await Promise.all([
    listProducts({
      collectionSlug,
      sort: listingParams.sort,
      page: listingParams.page,
      filters: {
        priceMin: listingParams.priceMin ?? undefined,
        priceMax: listingParams.priceMax ?? undefined,
        allergens: listingParams.allergens ?? undefined,
        certifications: listingParams.certifications ?? undefined,
        brands: listingParams.brands ?? undefined,
        inStock: listingParams.inStock ?? undefined,
      },
    }),
    listAllergens(),
    listCertifications(),
    listBrands(),
  ]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: result.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.href,
      name: item.name,
    })),
  };

  return (
    <Section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <h1 className="text-h1 font-heading text-charcoal">{collection.name}</h1>
      <div className="mt-8">
        <ProductGrid
          scope={{ collection: collectionSlug }}
          initialData={result}
          allergenOptions={allergens.map((a) => ({ value: a.name, label: a.name }))}
          certificationOptions={certifications.map((c) => ({ value: c.id, label: c.name }))}
          brandOptions={brands.map((b) => ({ value: b.slug, label: b.name }))}
        />
      </div>
    </Section>
  );
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then in a browser (or via `curl`):
- `GET /products` — expect a 200 page rendering seeded products (see Task 15 for seeding)
- `GET /products/does-not-exist-category` — expect a 404 page
- `GET /products/collections/does-not-exist-collection` — expect a 404 page

Run: `npx tsc --noEmit`
Expected: zero type errors across all three new page files

- [ ] **Step 5: Commit**

```bash
git add "src/app/(storefront)/products"
git commit -m "feat: add /products, category, and collection listing pages"
```

---

### Task 15: E2E tests, query-param contract docs, and story sign-off

**Files:**
- Create: `tests/e2e/product-listing.spec.ts`
- Modify: `docs/architecture-decisions.md`
- Modify: `docs/stories/03-product-platform/STORY-010-product-listing-categories-filters.md`

**Interfaces:**
- Consumes: everything built in Tasks 1-14

- [ ] **Step 1: Seed the database for e2e testing**

Run: `npx prisma db seed`
Expected: seeds 4 Published products (per `prisma/seed.ts`, STORY-009) — enough to exercise pagination with a reduced `pageSize`. Note: `tests/unit/global-setup.ts` truncates all app data before every `npm run test`/`npx vitest run` invocation (STORY-009), so re-run this seed command if a unit test run happens between now and the e2e run below.

- [ ] **Step 2: Write the e2e tests**

Create `tests/e2e/product-listing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("applying the in-stock filter updates the URL and the result grid", async ({ page }) => {
  await page.goto("/products");

  const checkbox = page.getByRole("checkbox", { name: "In stock only" }).first();
  await checkbox.click();

  await expect(page).toHaveURL(/inStock=true/);
});

test("changing the sort order updates the URL", async ({ page }) => {
  await page.goto("/products");

  await page.getByRole("combobox", { name: "Sort products" }).click();
  await page.getByRole("option", { name: "Price: Low to High" }).click();

  await expect(page).toHaveURL(/sort=price-asc/);
});

test("pagination navigates between pages and updates the URL", async ({ page }) => {
  await page.goto("/products?pageSize=2");

  const pagination = page.getByRole("navigation", { name: "Pagination" });
  await expect(pagination).toBeVisible();

  await pagination.getByRole("button", { name: "2" }).click();

  await expect(page).toHaveURL(/page=2/);
});

test("shows the zero-result state with a working clear-filters control", async ({ page }) => {
  await page.goto("/products?priceMin=999999");

  await expect(page.getByText("No products match your filters.")).toBeVisible();

  await page.getByRole("button", { name: "Clear all filters" }).click();

  await expect(page).not.toHaveURL(/priceMin/);
});

test("filter sidebar has no automatically detectable accessibility violations (desktop)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/products");

  const results = await new AxeBuilder({ page }).include('aside[aria-label="Filter products"]').analyze();

  expect(results.violations).toEqual([]);
});

test("filter drawer has no automatically detectable accessibility violations (mobile)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");

  await page.getByRole("button", { name: "Filters" }).click();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();

  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 3: Run the e2e tests**

Run: `npx playwright test tests/e2e/product-listing.spec.ts`
Expected: PASS (6 tests). If the dev server's database was truncated by an intervening unit test run, re-run Step 1's seed command first.

- [ ] **Step 4: Document the query-param contract**

Add to `docs/architecture-decisions.md` (append a new `##` section at the end of the file, following the existing dated-entry pattern):

```markdown
## 2026-07-16 — STORY-010 Product Listing, Categories & Filters

- **Listing query-param contract** (shared by `GET /api/products`, the three
  storefront listing pages, and `nuqs`'s client-side URL state —
  `src/lib/product-listing-params.ts` / `src/validation/product-listing.schema.ts`):

  | Param | Type | Default | Notes |
  |---|---|---|---|
  | `page` | positive int | `1` | |
  | `pageSize` | positive int, max 60 | `24` | Not exposed in the client UI; accepted by the API/service for direct callers and tests. |
  | `sort` | `price-asc \| price-desc \| newest \| best-selling \| rating` | `newest` | `best-selling`/`rating` currently fall back to `newest` ordering — no Order/Review data exists yet (Commerce Platform epic, STORY-015). |
  | `priceMin`, `priceMax` | number | none | |
  | `allergens` | comma-separated string list | none | Selecting an allergen **excludes** products containing it. |
  | `certifications` | comma-separated string list (certification ids) | none | Multi-select within this facet is a union (OR). |
  | `brands` | comma-separated string list (brand slugs) | none | Multi-select within this facet is a union (OR). |
  | `inStock` | `"true" \| "false"` | none | |
  | `category` | route param (page routes) / query param (API route only) | — | Never reflected in the page's own URL query string — see `product-listing-loader.ts`. |
  | `collection` | route param (page routes) / query param (API route only) | — | Same as `category`. |

  All malformed/invalid values fall back to their default (via Zod's
  `.catch()`, not `.default()` — see `product-listing.schema.ts`) rather than
  rejecting the request. STORY-012 (search) reuses this exact result shape
  (`ProductListingResult`) and the `ProductCard`/`ProductGrid`/`Pagination`
  components rather than rebuilding result rendering.
- **`resolvePricesForProducts()` bulk pricing.** STORY-009's `resolvePrice()`
  issues 5 queries per product; a listing page showing N products can't do
  that N times without risking PGlite's single-connection limit. Refactored
  the shared priority/tie-break logic into `resolveFromTierData()` so both
  the single-product and bulk (`resolvePricesForProducts`, exactly 5 queries
  total regardless of N) paths use identical resolution logic.
- **Listing filter/sort/pagination happens in memory**, after fetching the
  full non-price-filtered candidate set in one query. Deliberate choice
  given this catalogue's realistic scale (not millions of rows) — avoids
  building DB-level filtering/sorting for a price value that isn't a stored
  column. Revisit if the catalogue ever grows enough for this to matter.
```

- [ ] **Step 5: Mark the story done**

In `docs/stories/03-product-platform/STORY-010-product-listing-categories-filters.md`, change the `**Status:** Draft` line to `**Status:** Done`, and change every `- [ ]` under "Acceptance Criteria" and "Tasks" to `- [x]`, **except** the sort-by-best-selling and sort-by-average-rating related acceptance criteria bullets — leave those unchecked with an inline note `(implemented as a documented fallback to "newest" — see docs/architecture-decisions.md STORY-010 entry; real data needs Commerce Platform/STORY-015)`.

- [ ] **Step 6: Final full verification**

Run (in batches, per the PGlite wedge workaround — restart `npx prisma dev` between batches if one errors with a connection failure):

```bash
npx vitest run tests/unit/product-repository.test.ts tests/unit/product-listing-schema.test.ts tests/unit/use-product-listing-params.test.tsx tests/unit/category-repository.test.ts tests/unit/pricing-service.test.ts
npx vitest run tests/unit/product-service.test.ts tests/unit/products-route.test.ts tests/unit/product-card.test.tsx tests/unit/pagination.test.tsx tests/unit/sort-select.test.tsx
npx vitest run tests/unit/filter-controls.test.tsx tests/unit/product-grid.test.tsx
npx tsc --noEmit
npx eslint .
```

Expected: all green, zero type errors, zero lint errors.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/product-listing.spec.ts docs/architecture-decisions.md docs/stories/03-product-platform/STORY-010-product-listing-categories-filters.md
git commit -m "test: add product listing e2e coverage; docs: query-param contract, mark STORY-010 done"
```

## ALL 15 TASKS COMPLETE. Proceed to final whole-branch review (per superpowers:subagent-driven-development / superpowers:executing-plans) before merging.
