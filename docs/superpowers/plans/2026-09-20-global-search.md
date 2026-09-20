# Global Search (STORY-007) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storefront's global search entry point — a desktop header overlay with live grouped suggestions, a mobile direct link to a results page, and the `/search` results page itself — powered by simple case-insensitive substring matching over the product catalogue, with a registered-extension seam for recipes (no Recipe data model exists yet).

**Architecture:** One service function, `searchCatalogue(query, opts)`, serves both the overlay's live suggestions (small `pageSize`) and the `/search` results page (default `pageSize`) — avoiding two near-duplicate service functions. It composes a new repository query (`searchPublishedProducts`, substring match on name/SKU) with the existing pricing-resolution pipeline (`toProductListItem`, exported from `product.service.ts` for reuse) and a recipe search extension point (`search-extensions.ts`, same registered-provider pattern STORY-011 established for PDP reviews/Q&A/recipes). The overlay is a self-contained Client Component built on the existing `Dialog` primitive; the results page is a Server Component reading `q`/`page` from the URL, with a plain native `<form method="get">` requiring no client JS to search from that page.

**Tech Stack:** Next.js 16 App Router (Server/Client Components), TypeScript strict, Zod, TanStack Query, Zustand (`persist` middleware), Prisma 7 (`@prisma/adapter-pg`), Vitest, Playwright + `@axe-core/playwright`.

**Spec:** `docs/superpowers/specs/2026-09-20-global-search-design.md`

## Global Constraints

- **Service Layer pattern:** route handlers never call Prisma directly; they call `search.service.ts`, which calls `product.repository.ts`. No exceptions.
- **Query-param validation degrades, never 400s:** every field in `search.schema.ts` uses `.catch(<default>)`, matching `product-listing.schema.ts`'s established convention — a malformed/missing query returns 200 with an empty/default result, never a validation error.
- **No duplicate logic:** one `searchCatalogue` function serves both suggestions and full results; reuse `toProductListItem` (exported from `product.service.ts`) rather than re-implementing product→list-item mapping.
- **Extension-point pattern for unbuilt modules:** Recipes have no data model yet (Epic 04 unbuilt). `search-extensions.ts` mirrors `product-detail-extensions.ts` exactly — a module-local stub returning `[]`, a `register*Provider` export, and a plain getter the service calls. Never import a not-yet-built module from `search.service.ts`.
- **Deterministic ordering:** any new Prisma query over `Product` sorts by `orderBy: { publishedAt: "desc" }`, matching `findPublishedProductsForListing`'s documented rationale (unordered Postgres results would shuffle between requests).
- **TypeScript strict mode:** no `any`, no implicit types.
- **Accessibility:** the search overlay (open state) and `/search` results page must pass an automated axe scan with zero **critical/serious** violations (the project's established bar — see `header.spec.ts`/`homepage.spec.ts`, not "zero violations" of any severity).
- **Client/Server Component split:** the overlay trigger, suggestions dropdown, and search input are Client Components (`"use client"`); the `/search` page itself is a Server Component that fetches data directly (no client-side `fetch` waterfall).
- **Local DB workflow:** `npx prisma dev` must be running before `npm run test` (global setup runs `db push` against it) — see `docs/architecture-decisions.md`.
- **Commit style:** Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`), each task ends with its own commit.

---

## Task 1: Search query validation schema

**Files:**
- Create: `src/validation/search.schema.ts`
- Test: `tests/unit/search-schema.test.ts`

**Interfaces:**
- Produces: `searchQuerySchema: ZodObject`, `type SearchQuery = { q: string; page: number; pageSize: number | undefined }` — consumed by Task 4 (route handler) and Task 11 (`/search/page.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-schema.test.ts
import { describe, expect, it } from "vitest";

import { searchQuerySchema } from "@/validation/search.schema";

describe("searchQuerySchema", () => {
  it("trims a valid query and defaults page to 1", () => {
    const result = searchQuerySchema.parse({ q: "  curry  " });

    expect(result).toEqual({ q: "curry", page: 1, pageSize: undefined });
  });

  it("degrades a missing q to an empty string instead of throwing", () => {
    const result = searchQuerySchema.parse({});

    expect(result.q).toBe("");
  });

  it("degrades a malformed page to 1 instead of throwing", () => {
    const result = searchQuerySchema.parse({ q: "curry", page: "not-a-number" });

    expect(result.page).toBe(1);
  });

  it("accepts an explicit pageSize override", () => {
    const result = searchQuerySchema.parse({ q: "curry", pageSize: "5" });

    expect(result.pageSize).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-schema.test.ts`
Expected: FAIL — `Cannot find module '@/validation/search.schema'`

- [ ] **Step 3: Write the implementation**

```ts
// src/validation/search.schema.ts
import { z } from "zod";

/**
 * `.catch()` on every field (never `.min(1)`/a hard validation error) —
 * matches product-listing.schema.ts's convention: a malformed or missing
 * query degrades to an empty/default result (200) instead of breaking
 * the page for whoever followed a broken link.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().catch(""),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(60).optional().catch(undefined),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-schema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/validation/search.schema.ts tests/unit/search-schema.test.ts
git commit -m "feat: add search query validation schema"
```

---

## Task 2: Recipe search extension point

**Files:**
- Create: `src/services/search-extensions.ts`
- Test: `tests/unit/search-extensions.test.ts`

**Interfaces:**
- Produces: `SearchSuggestionItem` interface, `registerRecipeSearchProvider(fn)`, `searchRecipes(query, limit)`, `resetSearchExtensionsForTesting()` — consumed by Task 4 (`search.service.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-extensions.test.ts
import { afterEach, describe, expect, it } from "vitest";

import {
  registerRecipeSearchProvider,
  resetSearchExtensionsForTesting,
  searchRecipes,
} from "@/services/search-extensions";

afterEach(() => {
  resetSearchExtensionsForTesting();
});

describe("search-extensions", () => {
  it("returns an empty array before a provider is registered", async () => {
    expect(await searchRecipes("curry", 3)).toEqual([]);
  });

  it("returns the registered provider's result", async () => {
    registerRecipeSearchProvider(async (query, limit) => [
      { id: "r1", label: `Recipe for ${query}`, href: "/recipes/r1", type: "Recipe" },
    ].slice(0, limit));

    const result = await searchRecipes("curry", 3);

    expect(result).toEqual([{ id: "r1", label: "Recipe for curry", href: "/recipes/r1", type: "Recipe" }]);
  });

  it("resets to the stub after resetSearchExtensionsForTesting", async () => {
    registerRecipeSearchProvider(async () => [
      { id: "r1", label: "Recipe", href: "/recipes/r1", type: "Recipe" },
    ]);
    resetSearchExtensionsForTesting();

    expect(await searchRecipes("curry", 3)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-extensions.test.ts`
Expected: FAIL — `Cannot find module '@/services/search-extensions'`

- [ ] **Step 3: Write the implementation**

```ts
// src/services/search-extensions.ts
export interface SearchSuggestionItem {
  id: string;
  label: string;
  href: string;
  imageSrc?: string;
  type: "Product" | "Recipe";
}

export type SearchRecipes = (query: string, limit: number) => Promise<SearchSuggestionItem[]>;

let recipeSearchProvider: SearchRecipes = async () => [];

/**
 * Epic 04 (Recipes & Food Academy) — and later STORY-061 (AI Smart
 * Search) — calls this from its own service module's init to plug real
 * recipe search results into Global Search, without search.service.ts
 * importing a module that doesn't exist yet. Same contract/rationale as
 * product-detail-extensions.ts's register*Provider functions.
 */
export function registerRecipeSearchProvider(provider: SearchRecipes) {
  recipeSearchProvider = provider;
}

export function searchRecipes(query: string, limit: number) {
  return recipeSearchProvider(query, limit);
}

/** Test-only: restores the provider to its default stub. */
export function resetSearchExtensionsForTesting() {
  recipeSearchProvider = async () => [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-extensions.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/search-extensions.ts tests/unit/search-extensions.test.ts
git commit -m "feat: add recipe search extension point"
```

---

## Task 3: Repository — searchPublishedProducts

**Files:**
- Modify: `src/repositories/product.repository.ts` (append after `findPublishedProductsForListing`, currently ending at line 194 — see `## listAllergens()` immediately after)
- Test: `tests/unit/search-repository.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (already imported at the top of `product.repository.ts`).
- Produces: `searchPublishedProducts(query: string, opts?: { take?: number; skip?: number }): Promise<Product[]>` (with `brand` and primary `images` included, same shape `findPublishedProductsForListing` returns) — consumed by Task 4 (`search.service.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { createProduct, searchPublishedProducts } from "@/repositories/product.repository";
import { prisma } from "@/lib/db";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("searchPublishedProducts", () => {
  it("matches a published product by a substring of its name, case-insensitively", async () => {
    await createProduct({
      sku: "SEARCH-REPO-1",
      slug: "search-repo-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });

    const results = await searchPublishedProducts("CURRY");

    expect(results.map((p) => p.slug)).toEqual(["search-repo-curry"]);
  });

  it("matches by SKU", async () => {
    await createProduct({
      sku: "SEARCH-REPO-SKU-1",
      slug: "search-repo-sku",
      name: "Unrelated Name",
      status: "Published",
    });

    const results = await searchPublishedProducts("SEARCH-REPO-SKU-1");

    expect(results.map((p) => p.slug)).toEqual(["search-repo-sku"]);
  });

  it("excludes non-Published products", async () => {
    await createProduct({
      sku: "SEARCH-REPO-2",
      slug: "search-repo-draft",
      name: "Curry Draft",
      status: "Draft",
    });

    const results = await searchPublishedProducts("curry");

    expect(results).toEqual([]);
  });

  it("bounds the result count when take is given", async () => {
    await createProduct({ sku: "SEARCH-REPO-3", slug: "search-repo-3", name: "Curry A", status: "Published" });
    await createProduct({ sku: "SEARCH-REPO-4", slug: "search-repo-4", name: "Curry B", status: "Published" });

    const results = await searchPublishedProducts("curry", { take: 1 });

    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-repository.test.ts`
Expected: FAIL — `searchPublishedProducts is not a function` (or similar export error)

- [ ] **Step 3: Write the implementation**

Append to `src/repositories/product.repository.ts`, directly after the closing `}` of `findPublishedProductsForListing` (before `export function listAllergens()`):

```ts
export function searchPublishedProducts(query: string, opts: { take?: number; skip?: number } = {}) {
  return prisma.product.findMany({
    where: {
      status: "Published",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    // Deterministic ordering — same rationale as findPublishedProductsForListing
    // just above: without this, Postgres returns rows in unspecified order
    // and results would shuffle between identical searches.
    orderBy: { publishedAt: "desc" },
    take: opts.take,
    skip: opts.skip,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-repository.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/repositories/product.repository.ts tests/unit/search-repository.test.ts
git commit -m "feat: add searchPublishedProducts repository query"
```

---

## Task 4: Search service — searchCatalogue

**Files:**
- Modify: `src/services/product.service.ts:168` — add `export` to `function toProductListItem(`
- Create: `src/services/search.service.ts`
- Test: `tests/unit/search-service.test.ts`

**Interfaces:**
- Consumes: `productRepository.searchPublishedProducts` (Task 3), `pricingService.resolvePricesForProducts` (existing, `src/services/pricing.service.ts`), `toProductListItem` (this task, exported from `product.service.ts`), `searchRecipes` + `SearchSuggestionItem` (Task 2, `search-extensions.ts`).
- Produces: `SearchResultsPage` interface (`{ query, products, recipes, page, pageSize, hasNextPage }`), `searchCatalogue(query: string, opts?: { page?: number; pageSize?: number }): Promise<SearchResultsPage>` — consumed by Task 5 (route handler) and Task 11 (`/search/page.tsx`).

- [ ] **Step 1: Modify `product.service.ts` to export `toProductListItem`**

In `src/services/product.service.ts`, change line 168 from:

```ts
function toProductListItem(
```

to:

```ts
export function toProductListItem(
```

No other change to that function's body.

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/search-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import {
  registerRecipeSearchProvider,
  resetSearchExtensionsForTesting,
} from "@/services/search-extensions";
import { searchCatalogue } from "@/services/search.service";

afterEach(async () => {
  resetSearchExtensionsForTesting();
  await prisma.product.deleteMany();
});

describe("searchCatalogue", () => {
  it("returns an empty result for a blank query without touching the database", async () => {
    const result = await searchCatalogue("   ");

    expect(result).toEqual({ query: "", products: [], recipes: [], page: 1, pageSize: 12, hasNextPage: false });
  });

  it("returns matching, priced products", async () => {
    const product = await createProduct({
      sku: "SEARCH-SVC-1",
      slug: "search-svc-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const result = await searchCatalogue("curry");

    expect(result.products).toEqual([
      {
        id: product.id,
        name: "Roasted Curry Powder",
        href: "/products/search-svc-curry",
        imageSrc: "",
        imageAlt: "Roasted Curry Powder",
        price: 450,
        currency: "LKR",
        inStock: true,
      },
    ]);
  });

  it("omits a matching product with no configured price", async () => {
    await createProduct({
      sku: "SEARCH-SVC-2",
      slug: "search-svc-unpriced",
      name: "Curry Without Price",
      status: "Published",
    });

    const result = await searchCatalogue("curry");

    expect(result.products).toEqual([]);
  });

  it("returns recipes from a registered search provider", async () => {
    registerRecipeSearchProvider(async (query) => [
      { id: "rec1", label: `${query} recipe`, href: "/recipes/rec1", type: "Recipe" as const },
    ]);

    const result = await searchCatalogue("curry");

    expect(result.recipes).toEqual([{ id: "rec1", label: "curry recipe", href: "/recipes/rec1", type: "Recipe" }]);
  });

  it("sets hasNextPage when more results exist beyond pageSize", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SEARCH-SVC-PAGE-${i}`,
        slug: `search-svc-page-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const result = await searchCatalogue("curry", { pageSize: 2 });

    expect(result.products).toHaveLength(2);
    expect(result.hasNextPage).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-service.test.ts`
Expected: FAIL — `Cannot find module '@/services/search.service'`

- [ ] **Step 4: Write the implementation**

```ts
// src/services/search.service.ts
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
import { toProductListItem } from "@/services/product.service";
import { searchRecipes, type SearchSuggestionItem } from "@/services/search-extensions";
import type { ProductListItem } from "@/types/product";

export type { SearchSuggestionItem } from "@/services/search-extensions";

const DEFAULT_PAGE_SIZE = 12;

export interface SearchResultsPage {
  query: string;
  products: ProductListItem[];
  recipes: SearchSuggestionItem[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

function emptyResult(page: number, pageSize: number): SearchResultsPage {
  return { query: "", products: [], recipes: [], page, pageSize, hasNextPage: false };
}

export async function searchCatalogue(
  query: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchResultsPage> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE;
  const trimmed = query.trim();
  if (!trimmed) return emptyResult(page, pageSize);

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
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-service.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/services/product.service.ts src/services/search.service.ts tests/unit/search-service.test.ts
git commit -m "feat: add searchCatalogue service"
```

---

## Task 5: API route — GET /api/search

**Files:**
- Create: `src/app/api/search/route.ts`
- Test: `tests/unit/search-route.test.ts`

**Interfaces:**
- Consumes: `searchQuerySchema` (Task 1), `searchCatalogue` (Task 4).
- Produces: `GET(request: Request): Promise<Response>` returning JSON `SearchResultsPage` — consumed by Task 8's `use-search-suggestions.ts` hook and Task 12's e2e tests (indirectly, via the browser).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/search-route.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/search/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/search", () => {
  it("returns matching published products for a query", async () => {
    const product = await createProduct({
      sku: "SEARCH-ROUTE-1",
      slug: "search-route-curry",
      name: "Roasted Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/search?q=curry"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(["Roasted Curry Powder"]);
  });

  it("returns an empty result for a blank query, not an error", async () => {
    const response = await GET(new Request("http://localhost/api/search?q="));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.products).toEqual([]);
  });

  it("respects an explicit pageSize override", async () => {
    for (let i = 0; i < 3; i++) {
      const product = await createProduct({
        sku: `SEARCH-ROUTE-PS-${i}`,
        slug: `search-route-ps-${i}`,
        name: `Curry Page ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    }

    const response = await GET(new Request("http://localhost/api/search?q=curry&pageSize=2"));
    const body = await response.json();

    expect(body.products).toHaveLength(2);
    expect(body.hasNextPage).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/search/route'`

- [ ] **Step 3: Write the implementation**

```ts
// src/app/api/search/route.ts
import { NextResponse } from "next/server";

import { searchCatalogue } from "@/services/search.service";
import { searchQuerySchema } from "@/validation/search.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawQuery = Object.fromEntries(url.searchParams);
  const query = searchQuerySchema.parse(rawQuery);

  const result = await searchCatalogue(query.q, { page: query.page, pageSize: query.pageSize });

  return NextResponse.json(result, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/search/route.ts tests/unit/search-route.test.ts
git commit -m "feat: add GET /api/search route handler"
```

---

## Task 6: useDebouncedValue hook

**Files:**
- Create: `src/hooks/use-debounced-value.ts`
- Test: `tests/unit/use-debounced-value.test.ts`

**Interfaces:**
- Produces: `useDebouncedValue<T>(value: T, delayMs: number): T` — consumed by Task 10 (`search-overlay.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/use-debounced-value.test.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 300));

    expect(result.current).toBe("a");
  });

  it("delays updating until the debounce window elapses", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("ab");
  });

  it("resets the timer on rapid successive changes", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "ab" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: "abc" });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe("abc");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/use-debounced-value.test.ts`
Expected: FAIL — `Cannot find module '@/hooks/use-debounced-value'`

- [ ] **Step 3: Write the implementation**

```ts
// src/hooks/use-debounced-value.ts
"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/use-debounced-value.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-debounced-value.ts tests/unit/use-debounced-value.test.ts
git commit -m "feat: add useDebouncedValue hook"
```

---

## Task 7: Recent searches store

**Files:**
- Create: `src/lib/stores/recent-searches-store.ts`
- Test: `tests/unit/recent-searches-store.test.ts`

**Interfaces:**
- Produces: `useRecentSearchesStore` (Zustand store, state `{ queries: string[]; add(query: string): void }`) — consumed by Task 10 (`search-overlay.tsx`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/recent-searches-store.test.ts
import { beforeEach, describe, expect, it } from "vitest";

import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";

describe("useRecentSearchesStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentSearchesStore.setState({ queries: [] });
  });

  it("adds a query to the front of the list", () => {
    useRecentSearchesStore.getState().add("curry");

    expect(useRecentSearchesStore.getState().queries).toEqual(["curry"]);
  });

  it("moves a re-searched query to the front instead of duplicating it, case-insensitively", () => {
    useRecentSearchesStore.getState().add("curry");
    useRecentSearchesStore.getState().add("chilli");
    useRecentSearchesStore.getState().add("Curry");

    expect(useRecentSearchesStore.getState().queries).toEqual(["Curry", "chilli"]);
  });

  it("caps the list at 5 queries", () => {
    for (let i = 0; i < 8; i++) useRecentSearchesStore.getState().add(`query-${i}`);

    expect(useRecentSearchesStore.getState().queries).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/recent-searches-store.test.ts`
Expected: FAIL — `Cannot find module '@/lib/stores/recent-searches-store'`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/stores/recent-searches-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_QUERIES = 5;

interface RecentSearchesState {
  queries: string[];
  add: (query: string) => void;
}

/**
 * Client-side recent-search history for the Global Search overlay
 * (STORY-007). Persisted to localStorage — same count-or-list-in-
 * localStorage pattern as recently-viewed-store.ts (STORY-011); extend
 * that convention rather than introducing a different one.
 */
export const useRecentSearchesStore = create<RecentSearchesState>()(
  persist(
    (set, get) => ({
      queries: [],
      add: (query) => {
        const deduped = get().queries.filter(
          (existing) => existing.toLowerCase() !== query.toLowerCase(),
        );
        set({ queries: [query, ...deduped].slice(0, MAX_QUERIES) });
      },
    }),
    { name: "oristor-recent-searches" },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/recent-searches-store.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/recent-searches-store.ts tests/unit/recent-searches-store.test.ts
git commit -m "feat: add recent searches store"
```

---

## Task 8: SearchInput component

**Files:**
- Create: `src/components/storefront/search/search-input.tsx`

**Interfaces:**
- Produces: `SearchInput` component, props `{ id: string; name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void; autoFocus?: boolean; placeholder?: string }` — consumed by Task 10 (`search-overlay.tsx`) and Task 11 (`/search/page.tsx`).

This component is a thin, mostly-presentational wrapper with no branching logic of its own — its behavior is fully exercised through Task 10's `SearchOverlay` test (typing, submitting) and Task 12's e2e test (the results-page native-form usage), so it does not get a separate isolated unit test, matching how trivial layout primitives like `Section` have none either.

- [ ] **Step 1: Write the implementation**

```tsx
// src/components/storefront/search/search-input.tsx
"use client";

import { Search } from "lucide-react";
import type { ChangeEvent, KeyboardEvent } from "react";

interface SearchInputProps {
  id: string;
  /** Set when used inside a native `<form method="get">` (the /search page) so submission serializes this field. */
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

export function SearchInput({
  id,
  name,
  value,
  defaultValue,
  onChange,
  onKeyDown,
  autoFocus,
  placeholder = "Search products and recipes",
}: SearchInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div className="relative flex flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 size-4 text-stone" aria-hidden="true" />
      <input
        id={id}
        name={name}
        type="search"
        value={value}
        defaultValue={defaultValue}
        onChange={onChange ? handleChange : undefined}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Search"
        className="h-11 w-full rounded-lg border border-border bg-background py-2 pr-3 pl-9 text-body text-charcoal placeholder:text-stone focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/storefront/search/search-input.tsx
git commit -m "feat: add SearchInput component"
```

---

## Task 9: SearchSuggestionsDropdown component

**Files:**
- Create: `src/components/storefront/search/search-suggestions.tsx`
- Test: `tests/unit/search-suggestions.test.tsx`

**Interfaces:**
- Consumes: `SearchSuggestionItem` (Task 2, `@/services/search-extensions`).
- Produces: `SearchSuggestionsDropdown` component, props `{ hasQuery: boolean; items: SearchSuggestionItem[]; activeIndex: number; recentSearches: string[]; onSelectItem: (item: SearchSuggestionItem) => void; onSelectRecent: (query: string) => void }` — consumed by Task 10 (`search-overlay.tsx`).

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/search-suggestions.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchSuggestionsDropdown } from "@/components/storefront/search/search-suggestions";
import type { SearchSuggestionItem } from "@/services/search-extensions";

const items: SearchSuggestionItem[] = [
  { id: "p1", label: "Roasted Curry Powder", href: "/products/roasted-curry-powder", type: "Product" },
  { id: "p2", label: "Chilli Powder", href: "/products/chilli-powder", type: "Product" },
];

describe("SearchSuggestionsDropdown", () => {
  it("shows recent searches when there is no query and history exists", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={["curry"]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText("Recent searches")).toBeVisible();
    expect(screen.getByRole("button", { name: "curry" })).toBeVisible();
  });

  it("shows a hint instead of a blank overlay when there is no query and no history", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText(/Try:/)).toBeVisible();
  });

  it("groups suggestions under a Products heading and omits an empty Recipes heading", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText("Products")).toBeVisible();
    expect(screen.getByRole("link", { name: "Roasted Curry Powder" })).toBeVisible();
    expect(screen.queryByText("Recipes")).not.toBeInTheDocument();
  });

  it("marks the item at activeIndex as selected", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Chilli Powder" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Roasted Curry Powder" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("calls onSelectItem when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    const onSelectItem = vi.fn();
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={items}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={onSelectItem}
        onSelectRecent={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("link", { name: "Roasted Curry Powder" }));

    expect(onSelectItem).toHaveBeenCalledWith(items[0]);
  });

  it("calls onSelectRecent when a recent search is clicked", async () => {
    const user = userEvent.setup();
    const onSelectRecent = vi.fn();
    render(
      <SearchSuggestionsDropdown
        hasQuery={false}
        items={[]}
        activeIndex={-1}
        recentSearches={["curry"]}
        onSelectItem={vi.fn()}
        onSelectRecent={onSelectRecent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "curry" }));

    expect(onSelectRecent).toHaveBeenCalledWith("curry");
  });

  it("shows a no-matches message when the query has no results", () => {
    render(
      <SearchSuggestionsDropdown
        hasQuery
        items={[]}
        activeIndex={-1}
        recentSearches={[]}
        onSelectItem={vi.fn()}
        onSelectRecent={vi.fn()}
      />,
    );

    expect(screen.getByText(/No matches yet/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-suggestions.test.tsx`
Expected: FAIL — `Cannot find module '@/components/storefront/search/search-suggestions'`

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/storefront/search/search-suggestions.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

import type { SearchSuggestionItem } from "@/services/search-extensions";

interface SearchSuggestionsDropdownProps {
  hasQuery: boolean;
  items: SearchSuggestionItem[];
  activeIndex: number;
  recentSearches: string[];
  onSelectItem: (item: SearchSuggestionItem) => void;
  onSelectRecent: (query: string) => void;
}

export function SearchSuggestionsDropdown({
  hasQuery,
  items,
  activeIndex,
  recentSearches,
  onSelectItem,
  onSelectRecent,
}: SearchSuggestionsDropdownProps) {
  if (!hasQuery) {
    return (
      <div className="mt-4">
        {recentSearches.length > 0 ? (
          <>
            <p className="text-caption font-medium text-charcoal/70">Recent searches</p>
            <ul className="mt-2 flex flex-col gap-1">
              {recentSearches.map((query) => (
                <li key={query}>
                  <button
                    type="button"
                    onClick={() => onSelectRecent(query)}
                    className="w-full rounded-md px-2 py-1.5 text-left text-small text-charcoal hover:bg-muted"
                  >
                    {query}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-small text-charcoal/70">Try: curry powder, coconut milk, chilli powder</p>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-small text-charcoal/70">No matches yet — keep typing or press Enter to search.</p>
    );
  }

  const products = items.filter((item) => item.type === "Product");
  const recipes = items.filter((item) => item.type === "Recipe");

  return (
    <ul role="listbox" aria-label="Search suggestions" className="mt-4 flex flex-col gap-1">
      {products.length > 0 && (
        <li role="presentation" className="px-2 py-1 text-caption font-medium text-charcoal/70">
          Products
        </li>
      )}
      {products.map((item) => (
        <SuggestionRow
          key={item.id}
          item={item}
          isActive={items.indexOf(item) === activeIndex}
          onSelect={onSelectItem}
        />
      ))}
      {recipes.length > 0 && (
        <li role="presentation" className="px-2 py-1 text-caption font-medium text-charcoal/70">
          Recipes
        </li>
      )}
      {recipes.map((item) => (
        <SuggestionRow
          key={item.id}
          item={item}
          isActive={items.indexOf(item) === activeIndex}
          onSelect={onSelectItem}
        />
      ))}
    </ul>
  );
}

function SuggestionRow({
  item,
  isActive,
  onSelect,
}: {
  item: SearchSuggestionItem;
  isActive: boolean;
  onSelect: (item: SearchSuggestionItem) => void;
}) {
  return (
    <li role="option" aria-selected={isActive}>
      <Link
        href={item.href}
        onClick={() => onSelect(item)}
        className={
          isActive
            ? "flex items-center gap-3 rounded-md bg-muted px-2 py-1.5 text-small text-charcoal"
            : "flex items-center gap-3 rounded-md px-2 py-1.5 text-small text-charcoal hover:bg-muted"
        }
      >
        {item.imageSrc && (
          <span className="relative size-8 shrink-0 overflow-hidden rounded bg-cream">
            <Image src={item.imageSrc} alt="" fill sizes="32px" className="object-contain" />
          </span>
        )}
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-suggestions.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/search/search-suggestions.tsx tests/unit/search-suggestions.test.tsx
git commit -m "feat: add SearchSuggestionsDropdown component"
```

---

## Task 10: SearchOverlay component + wire into the header

**Files:**
- Create: `src/components/storefront/search/search-overlay.tsx`
- Modify: `src/components/storefront/layout/header-actions.tsx` (replace the `SearchTrigger` stub)
- Modify: `tests/e2e/header.spec.ts:38` (stale comment — the button is no longer inert)
- Test: `tests/unit/search-overlay.test.tsx`

**Interfaces:**
- Consumes: `Dialog`/`DialogTrigger`/`DialogContent` (existing, `@/components/ui/dialog`), `useDebouncedValue` (Task 6), `useRecentSearchesStore` (Task 7), `SearchInput` (Task 8), `SearchSuggestionsDropdown` (Task 9), `SearchResultsPage`/`SearchSuggestionItem` (Task 4).
- Produces: `SearchOverlay` component (no props — self-contained trigger + dialog) — consumed by `header-actions.tsx`.

This task also creates `src/hooks/use-search-suggestions.ts` (a small TanStack Query wrapper) since `SearchOverlay` is the only consumer and the two are tightly coupled — splitting it into its own task would leave neither independently reviewable.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/search-overlay.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";
import type { SearchResultsPage } from "@/services/search.service";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const suggestionsResponse: SearchResultsPage = {
  query: "curry",
  products: [
    {
      id: "p1",
      name: "Roasted Curry Powder",
      href: "/products/roasted-curry-powder",
      imageSrc: "",
      imageAlt: "Roasted Curry Powder",
      price: 450,
      currency: "LKR",
      inStock: true,
    } as unknown as SearchResultsPage["products"][number],
  ],
  recipes: [],
  page: 1,
  pageSize: 5,
  hasNextPage: false,
};

function renderOverlay() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchOverlay />
    </QueryClientProvider>,
  );
}

describe("SearchOverlay", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentSearchesStore.setState({ queries: [] });
    mockPush.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(suggestionsResponse) }),
    );
  });

  it("opens the overlay when the trigger is clicked", async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("shows a hint (not a blank overlay) when opened with no query and no history", async () => {
    const user = userEvent.setup();
    renderOverlay();

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByText(/Try:/)).toBeVisible();
  });

  it("shows live suggestions grouped by type after typing", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.type(screen.getByLabelText("Search"), "curry");

    await waitFor(() => expect(screen.getByText("Roasted Curry Powder")).toBeVisible());
    expect(screen.getByText("Products")).toBeVisible();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("dialog")).toBeVisible();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("navigates to the results page and records the query on submit", async () => {
    const user = userEvent.setup();
    renderOverlay();
    await user.click(screen.getByRole("button", { name: "Search" }));

    await user.type(screen.getByLabelText("Search"), "curry{Enter}");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/search?q=curry"));
    expect(useRecentSearchesStore.getState().queries).toContain("curry");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/search-overlay.test.tsx`
Expected: FAIL — `Cannot find module '@/components/storefront/search/search-overlay'`

- [ ] **Step 3: Write `use-search-suggestions.ts`**

```ts
// src/hooks/use-search-suggestions.ts
"use client";

import { useQuery } from "@tanstack/react-query";

import type { SearchResultsPage } from "@/services/search.service";

const SUGGESTIONS_PAGE_SIZE = 5;

export function useSearchSuggestions(query: string) {
  return useQuery({
    queryKey: ["search-suggestions", query],
    queryFn: async () => {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&pageSize=${SUGGESTIONS_PAGE_SIZE}`,
      );
      if (!response.ok) throw new Error("Failed to load search suggestions");
      return (await response.json()) as SearchResultsPage;
    },
    enabled: query.length > 0,
  });
}
```

- [ ] **Step 4: Write `search-overlay.tsx`**

```tsx
// src/components/storefront/search/search-overlay.tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";
import { useRecentSearchesStore } from "@/lib/stores/recent-searches-store";
import type { SearchSuggestionItem } from "@/services/search-extensions";
import { SearchInput } from "./search-input";
import { SearchSuggestionsDropdown } from "./search-suggestions";

const DEBOUNCE_MS = 275;

export function SearchOverlay() {
  const router = useRouter();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(rawQuery, DEBOUNCE_MS);
  const trimmedQuery = debouncedQuery.trim();
  const { data: suggestions } = useSearchSuggestions(trimmedQuery);

  const recentSearches = useRecentSearchesStore((state) => state.queries);
  const addRecentSearch = useRecentSearchesStore((state) => state.add);

  const items: SearchSuggestionItem[] = trimmedQuery
    ? [...(suggestions?.products.map(toSuggestionItem) ?? []), ...(suggestions?.recipes ?? [])]
    : [];

  function reset() {
    setRawQuery("");
    setActiveIndex(-1);
  }

  function recordAndClose(query: string) {
    const trimmed = query.trim();
    if (trimmed) addRecentSearch(trimmed);
    setOpen(false);
    reset();
  }

  function handleSelectItem(item: SearchSuggestionItem) {
    // Records what was actually selected, not the (possibly partial) typed
    // text — matches handleSubmit's activeIndex branch below.
    recordAndClose(item.label);
  }

  function handleSelectRecent(query: string) {
    recordAndClose(query);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0 && items[activeIndex]) {
      const item = items[activeIndex];
      recordAndClose(item.label);
      router.push(item.href);
      return;
    }
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    recordAndClose(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, items.length - 1));
    } else if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, -1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <DialogTrigger
        aria-label="Search"
        className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Search className="size-5" aria-hidden="true" />
      </DialogTrigger>
      <DialogContent aria-label="Search Oristor" className="top-20 max-w-xl translate-y-0">
        <form role="search" aria-label="Site" onSubmit={handleSubmit}>
          <SearchInput
            id={inputId}
            value={rawQuery}
            onChange={(value) => {
              setRawQuery(value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </form>
        <div aria-live="polite" className="sr-only">
          {trimmedQuery && `${items.length} result${items.length === 1 ? "" : "s"} found`}
        </div>
        <SearchSuggestionsDropdown
          hasQuery={trimmedQuery.length > 0}
          items={items}
          activeIndex={activeIndex}
          recentSearches={recentSearches}
          onSelectItem={handleSelectItem}
          onSelectRecent={handleSelectRecent}
        />
      </DialogContent>
    </Dialog>
  );
}

function toSuggestionItem(product: {
  id: string;
  name: string;
  href: string;
  imageSrc: string;
}): SearchSuggestionItem {
  return {
    id: product.id,
    label: product.name,
    href: product.href,
    imageSrc: product.imageSrc || undefined,
    type: "Product",
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/search-overlay.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 6: Wire into the header**

In `src/components/storefront/layout/header-actions.tsx`, replace:

```tsx
import Link from "next/link";
import { Gift, Search } from "lucide-react";

import { AccountMenu } from "./account-menu";
import { CartBadge } from "./cart-badge";
import { WishlistBadge } from "./wishlist-badge";
```

with:

```tsx
import Link from "next/link";
import { Gift } from "lucide-react";

import { SearchOverlay } from "@/components/storefront/search/search-overlay";
import { AccountMenu } from "./account-menu";
import { CartBadge } from "./cart-badge";
import { WishlistBadge } from "./wishlist-badge";
```

Replace the `<SearchTrigger />` usage with `<SearchOverlay />`, and delete the entire `SearchTrigger` function (including its doc comment) that follows `HeaderActions`:

```tsx
export function HeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <SearchOverlay />
      <WishlistBadge />
      ...
```

- [ ] **Step 7: Fix the now-stale e2e comment**

In `tests/e2e/header.spec.ts:38`, change:

```ts
    // Search is a wired-but-inert <button> (STORY-007 owns the real UX).
```

to:

```ts
    // Search opens the STORY-007 overlay; this smoke test only checks the trigger's presence.
```

- [ ] **Step 8: Run the header e2e test to confirm nothing broke**

Run: `npx playwright test tests/e2e/header.spec.ts`
Expected: PASS (all existing header tests, including the "Search" button visibility assertion)

- [ ] **Step 9: Commit**

```bash
git add src/hooks/use-search-suggestions.ts src/components/storefront/search/search-overlay.tsx tests/unit/search-overlay.test.tsx src/components/storefront/layout/header-actions.tsx tests/e2e/header.spec.ts
git commit -m "feat: add SearchOverlay and wire it into the header"
```

---

## Task 11: /search results page

**Files:**
- Create: `src/app/(storefront)/search/page.tsx`
- Create: `src/app/(storefront)/search/loading.tsx`

**Interfaces:**
- Consumes: `searchQuerySchema` (Task 1), `searchCatalogue` (Task 4), `SearchInput` (Task 8), `ProductCard` (existing, `@/components/storefront/product/product-card`).

No Vitest test for this task — this codebase has no direct unit tests for `page.tsx`/`loading.tsx` Server Components (`products/[slug]/page.tsx` and `products/page.tsx` have none either); coverage comes from Task 12's Playwright e2e test.

- [ ] **Step 1: Write `page.tsx`**

```tsx
// src/app/(storefront)/search/page.tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/storefront/layout/section";
import { ProductCard } from "@/components/storefront/product/product-card";
import { SearchInput } from "@/components/storefront/search/search-input";
import { searchCatalogue } from "@/services/search.service";
import { searchQuerySchema } from "@/validation/search.schema";

interface SearchPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = searchQuerySchema.parse(await searchParams);
  return { title: q ? `Search results for "${q}"` : "Search" };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = searchQuerySchema.parse(await searchParams);
  const results = await searchCatalogue(q, { page });

  return (
    <Section>
      <form role="search" aria-label="Site" action="/search" method="get" className="flex gap-2">
        <SearchInput id="search-page-input" name="q" defaultValue={q} />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg bg-primary px-4 text-small font-medium text-primary-foreground hover:bg-primary/80"
        >
          Search
        </button>
      </form>

      <h1 className="mt-8 text-h1 font-heading text-charcoal">{q ? `Results for "${q}"` : "Search"}</h1>

      {q && (
        <div aria-live="polite" className="mt-1 text-small text-charcoal/70">
          {results.products.length} result{results.products.length === 1 ? "" : "s"}
        </div>
      )}

      {q && results.products.length === 0 ? (
        <div className="mt-8 text-body text-charcoal/70">
          <p>No results found for &quot;{q}&quot;.</p>
          <p className="mt-2">
            Browse{" "}
            <Link href="/products" className="text-chilli hover:underline">
              all products
            </Link>{" "}
            or{" "}
            <Link href="/recipes" className="text-chilli hover:underline">
              recipes
            </Link>{" "}
            instead.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {results.products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {results.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Link
            href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}`}
            className="text-small text-chilli hover:underline"
          >
            Load more results
          </Link>
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Write `loading.tsx`**

```tsx
// src/app/(storefront)/search/loading.tsx
import { Section } from "@/components/storefront/layout/section";

export default function SearchLoading() {
  return (
    <Section>
      <div className="h-11 w-full max-w-md animate-pulse rounded-lg bg-cream" />
      <div className="mt-8 h-9 w-64 animate-pulse rounded bg-cream" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-lg bg-cream" />
        ))}
      </div>
    </Section>
  );
}
```

- [ ] **Step 3: Manually verify in the dev server**

Run: `npm run dev`, then visit `http://localhost:3000/search?q=curry` (with the seeded database from `prisma/seed.ts` — "Roasted Curry Powder 100g" and "Curry Lover's Gift Set" should appear) and `http://localhost:3000/search` (empty-query state: heading "Search", no results grid, no error).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(storefront)/search/page.tsx" "src/app/(storefront)/search/loading.tsx"
git commit -m "feat: add /search results page"
```

---

## Task 12: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/search.spec.ts`

**Interfaces:**
- Consumes: the running dev server (seeded via `prisma/seed.ts` — "Roasted Curry Powder 100g" and "Curry Lover's Gift Set" both match "curry").

- [ ] **Step 1: Write the e2e test**

```ts
// tests/e2e/search.spec.ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("opens the overlay from the header, shows suggestions, and navigates to results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.getByLabel("Search").fill("curry");
  await expect(page.getByRole("link", { name: /Curry/ }).first()).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/search\?q=curry/);
  await expect(page.getByRole("heading", { level: 1, name: 'Results for "curry"' })).toBeVisible();
});

test("closes the overlay on Escape and returns focus to the trigger", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search" });

  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("mobile nav's Search item links directly to a usable results page", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  await page.locator('nav[aria-label="Primary"]').getByRole("link", { name: "Search" }).click();

  await expect(page).toHaveURL("/search");
  await page.getByLabel("Search").fill("chilli");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page).toHaveURL(/\/search\?q=chilli/);
  await expect(page.getByText(/Chilli Powder/).first()).toBeVisible();
});

test("shows a no-results empty state with links to browse instead", async ({ page }) => {
  await page.goto("/search?q=zzz-no-such-product-zzz");

  await expect(page.getByText('No results found for "zzz-no-such-product-zzz".')).toBeVisible();
  await expect(page.getByRole("link", { name: "all products" })).toHaveAttribute("href", "/products");
});

test("search overlay has zero critical/serious axe violations when open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test("search results page has zero critical/serious axe violations", async ({ page }) => {
  await page.goto("/search?q=curry");

  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npx playwright test tests/e2e/search.spec.ts`
Expected: PASS (6 tests). If the dev server isn't already running, Playwright's `webServer` config starts it automatically (`reuseExistingServer: !process.env.CI`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/search.spec.ts
git commit -m "test: add Playwright e2e coverage for Global Search"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/stories/02-core-ui/STORY-007-global-search.md`
- Modify: `docs/stories/README.md:29` (STORY-007 status row)
- Modify: `docs/architecture-decisions.md` (append a new dated entry)

- [ ] **Step 1: Mark every AC and task checkbox done in the story file**

In `docs/stories/02-core-ui/STORY-007-global-search.md`, change `**Status:** Draft` to:

```markdown
**Status:** Done — see `src/services/search-extensions.ts` for the recipe
search provider contract Epic 04 and STORY-061 must implement
(`registerRecipeSearchProvider`), and
`docs/superpowers/plans/2026-09-20-global-search.md` for the full
implementation record.
```

Change every `- [ ]` under `## Acceptance Criteria` and `## Tasks` to `- [x]`.

- [ ] **Step 2: Update the backlog index**

In `docs/stories/README.md`, change the STORY-007 row from:

```markdown
| STORY-007 | Global Search | Draft |
```

to:

```markdown
| STORY-007 | Global Search | Done |
```

- [ ] **Step 3: Document the STORY-061 seam**

Append to `docs/architecture-decisions.md`:

```markdown
---

## 2026-09-20 — STORY-007 Global Search

**Matching logic seam for STORY-061.** `search.service.ts`'s
`searchCatalogue()` does plain case-insensitive substring matching
(`contains`/`mode: "insensitive"`) against product name/SKU — intentional
per this story's scope (no AI/semantic ranking). STORY-061 (AI Smart
Search) replaces the matching logic *inside* `searchCatalogue()` (or the
repository call it makes) with an AI-backed implementation; the storefront
UI (`search-overlay.tsx`, `/search/page.tsx`) and the `SearchResultsPage`
contract do not change. Recipes use the same registered-extension-point
pattern STORY-011 established for PDP reviews/Q&A/recipes
(`search-extensions.ts`'s `registerRecipeSearchProvider`) — Epic 04
registers a real provider when the Recipe data model ships; until then the
Recipes group is simply absent from suggestions/results.
```

- [ ] **Step 4: Commit**

```bash
git add docs/stories/02-core-ui/STORY-007-global-search.md docs/stories/README.md docs/architecture-decisions.md
git commit -m "docs: mark STORY-007 done and document the search matching-logic seam"
```

---

## Final Verification

- [ ] Run `npm run lint` — 0 problems
- [ ] Run `npm run test` (with `npx prisma dev` running) — all unit tests pass
- [ ] Run `npx playwright test` — all e2e tests pass, including the new `search.spec.ts`
- [ ] Manually click through: header search icon → type a query → see grouped suggestions → arrow-key through them → Enter → land on `/search` with results; mobile viewport → bottom-nav Search → `/search` → type + submit → results
