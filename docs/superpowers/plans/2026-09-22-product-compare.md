# Product Compare (STORY-014) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers add up to 4 products to a session-only compare tray from `ProductCard`/the PDP, see a header mini-drawer of what's selected, and view a full side-by-side comparison at `/products/compare?ids=...`.

**Architecture:** A new batch repository query (`findProductsForCompareByIds`) and service function (`getProductsForCompare`) reuse the PDP's existing rich per-product data shape (nutrition, ingredients, allergens, certifications) and the existing bulk-price-resolution/review-summary-provider conventions — no schema change, no auth, no server persistence. A new `GET /api/products/compare` route wraps the service. A new, non-persisted Zustand store (`useCompareStore`) holds the tray's product ids client-side. The tray drawer reuses STORY-013's existing `GET /api/products/by-ids` endpoint for its thumbnails — no new endpoint needed there. The compare page reads/writes its `ids` query param via `nuqs` (this codebase's established convention for query-string-backed UI state), matching how the product-listing filters already work.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7, Zustand 5 (no `persist` — session-only), TanStack Query 5 (thumbnail fetch reuses the existing by-ids endpoint), nuqs, Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-22-product-compare-design.md`

## Global Constraints

- **No new schema.** Compare reads existing `Product`/`Brand`/`ProductNutrition`/`ProductIngredient`/`ProductAllergen`/`ProductCertification` tables via a new batch query — no Prisma migration in this plan.
- **No duplicate logic:** reuse `resolvePricesForProducts` (never per-item resolution), `getReviewSummary` (the existing provider-hook, already defaults to `null` until STORY-015 registers a real provider — no new "is STORY-015 available" branching needed), and the **existing** `GET /api/products/by-ids` route (STORY-013) for the tray drawer's thumbnails — do not build a second by-ids-style endpoint.
- **No server-side persistence, no auth:** the compare store has no `persist` middleware and no session/auth branching anywhere in this feature. This is the one thing that makes compare simpler than wishlist — don't add either back in.
- **Max 4, block don't replace:** `useCompareStore.add()` returns `"added" | "duplicate" | "full"` and never silently evicts an existing item to make room for a new one.
- **`GET /api/products/compare`'s Zod schema rejects (400) more than 4 or zero valid ids** — this is a deliberate deviation from this codebase's listing-page `.catch()`-degrade convention (see `product-listing.schema.ts`), because silently truncating a comparison would show incomplete data with no indication why. **The compare page itself still degrades gracefully** (falls back to the empty-state UI on a parse failure, never a 400 error page) — the strict rejection lives only in the API route's contract, matching how every other page-vs-mutation-route split in this codebase already behaves.
- **`nuqs`'s `parseAsArrayOf(parseAsString)`** is this codebase's established convention for a comma-separated array query param (see `product-listing-params.ts`) — use it for the compare page's `ids` state, not manual `URLSearchParams` manipulation.
- **TypeScript strict mode:** no `any`, no implicit types.
- **`@vitest-environment node` on every test file that touches Prisma/`fetch`-backed routes directly.**
- **`npx prisma dev` must be running before `npm run test`.** If tests fail with connection errors, restart it (`docs/architecture-decisions.md`) — PGlite wedges under sustained load; a known, pre-existing, documented limitation. Run only the task's own scoped test file per step, not the full suite, between tasks.
- **Run `npx tsc --noEmit -p tsconfig.json` before committing each task.**
- **Commit style:** Conventional Commits, each task ends with its own commit.

---

## Task 1: `findProductsForCompareByIds` repository query

**Files:**
- Modify: `src/repositories/product.repository.ts`
- Test: `tests/unit/product-repository.test.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (existing).
- Produces: `findProductsForCompareByIds(ids: string[])` — returns `Product` rows (each with `brand`, `nutrition`, `ingredients`, `allergens`, `certifications`, `images` included), filtered to `status: "Published"` and `id: { in: ids }`. Empty input returns `[]` immediately, no query. Consumed by Task 3's service function.

- [ ] **Step 1: Write the failing test**

Add this `describe` block to the end of `tests/unit/product-repository.test.ts` (the file already imports `createProduct`, `createBrand`, `setProductNutrition`, `addProductIngredient`, `addProductImage`, `createAllergen`, `createCertification` — add `findProductsForCompareByIds` to the existing import list from `@/repositories/product.repository`):

```ts
describe("findProductsForCompareByIds", () => {
  it("returns only Published products among the given ids, with full comparison data", async () => {
    const brand = await createBrand({ name: "Oristor FPFCBI", slug: "oristor-fpfcbi" });
    const peanuts = await createAllergen({ name: "Peanuts-FPFCBI" });
    const organic = await createCertification({ name: "Organic-FPFCBI" });
    const published = await createProduct({
      sku: "FPFCBI-1",
      slug: "fpfcbi-1",
      name: "Published Product",
      status: "Published",
      brand: { connect: { id: brand.id } },
      allergens: { connect: [{ id: peanuts.id }] },
      certifications: { connect: [{ id: organic.id }] },
    });
    await setProductNutrition({
      product: { connect: { id: published.id } },
      servingSize: "1 tsp",
      calories: "10.00",
      protein: "1.00",
      fat: "0.50",
      saturatedFat: "0.10",
      carbohydrates: "1.00",
      sugar: "0.20",
      fibre: "0.50",
      sodium: "1.00",
    });
    await addProductIngredient({ product: { connect: { id: published.id } }, name: "Salt", sortOrder: 1 });
    await addProductImage({ product: { connect: { id: published.id } }, url: "/fpfcbi-1.jpg", isPrimary: true, sortOrder: 1 });
    const draft = await createProduct({
      sku: "FPFCBI-2",
      slug: "fpfcbi-2",
      name: "Draft Product",
      status: "Draft",
    });

    const results = await findProductsForCompareByIds([published.id, draft.id]);

    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("fpfcbi-1");
    expect(results[0]?.brand?.name).toBe("Oristor FPFCBI");
    expect(results[0]?.nutrition?.servingSize).toBe("1 tsp");
    expect(results[0]?.ingredients.map((i) => i.name)).toEqual(["Salt"]);
    expect(results[0]?.allergens.map((a) => a.name)).toEqual(["Peanuts-FPFCBI"]);
    expect(results[0]?.certifications.map((c) => c.name)).toEqual(["Organic-FPFCBI"]);
    expect(results[0]?.images.map((i) => i.url)).toEqual(["/fpfcbi-1.jpg"]);
  });

  it("returns an empty array immediately for an empty id list", async () => {
    expect(await findProductsForCompareByIds([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-repository.test.ts
```

Expected: FAIL — `findProductsForCompareByIds is not a function` (or a TypeScript import error).

- [ ] **Step 3: Implement the repository function**

In `src/repositories/product.repository.ts`, add near `findProductsByIdsWithFilters`/`findProductDetailBySlug`:

```ts
export function findProductsForCompareByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "Published" },
    include: {
      brand: true,
      nutrition: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      allergens: true,
      certifications: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-repository.test.ts
```

Expected: PASS, including the two new tests (all pre-existing tests in this file must still pass too).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/repositories/product.repository.ts tests/unit/product-repository.test.ts
git commit -m "feat: add findProductsForCompareByIds repository query"
```

---

## Task 2: `product-compare.schema.ts` validation

**Files:**
- Create: `src/validation/product-compare.schema.ts`
- Test: `tests/unit/product-compare-schema.test.ts`

**Interfaces:**
- Produces: `compareIdsSchema` (a Zod schema parsing a raw comma-separated string into a deduplicated array of 1-4 ids), `CompareIdsInput` type. Consumed by Task 4 (API route, strict 400-on-failure) and Task 9 (compare page, graceful empty-state-on-failure).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-compare-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { compareIdsSchema } from "@/validation/product-compare.schema";

describe("compareIdsSchema", () => {
  it("parses a comma-separated string into an array", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2", "p3"]);
  });

  it("dedupes repeated ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p1");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2"]);
  });

  it("trims whitespace and drops empty segments", () => {
    const result = compareIdsSchema.safeParse(" p1 , , p2 ");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1", "p2"]);
  });

  it("rejects more than 4 ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3,p4,p5");

    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = compareIdsSchema.safeParse("");

    expect(result.success).toBe(false);
  });

  it("accepts exactly 4 ids", () => {
    const result = compareIdsSchema.safeParse("p1,p2,p3,p4");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toHaveLength(4);
  });

  it("accepts a single id", () => {
    const result = compareIdsSchema.safeParse("p1");

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(["p1"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-compare-schema.test.ts
```

Expected: FAIL — `Cannot find module '@/validation/product-compare.schema'`.

- [ ] **Step 3: Implement the schema**

Create `src/validation/product-compare.schema.ts`:

```ts
import { z } from "zod";

export const compareIdsSchema = z
  .string()
  .transform((raw) => [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))])
  .pipe(z.array(z.string().min(1)).min(1).max(4));

export type CompareIdsInput = z.infer<typeof compareIdsSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-compare-schema.test.ts
```

Expected: PASS, all 7 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/validation/product-compare.schema.ts tests/unit/product-compare-schema.test.ts
git commit -m "feat: add product compare ids validation schema"
```

---

## Task 3: `getProductsForCompare` service function

**Files:**
- Modify: `src/services/product.service.ts`
- Test: `tests/unit/product-detail-service.test.ts`

**Interfaces:**
- Consumes: `findProductsForCompareByIds` from `@/repositories/product.repository` (Task 1), `resolvePricesForProducts` from `@/services/pricing.service` (existing), `getReviewSummary` from `@/services/product-detail-extensions` (existing).
- Produces: `CompareItem` interface, `getProductsForCompare(productIds: string[]): Promise<CompareItem[]>` — consumed by Task 4 (API route) and Task 9 (compare page).

- [ ] **Step 1: Write the failing test**

Add this to the end of `tests/unit/product-detail-service.test.ts` (the file already imports `createProduct`, `createBrand`, `createStandardPrice`, `setProductNutrition`, `addProductIngredient`, `registerReviewSummaryProvider`, `prisma` — add `getProductsForCompare` to the existing import from `@/services/product.service`):

```ts
describe("getProductsForCompare", () => {
  it("returns comparison data for published products with a resolved price", async () => {
    const brand = await createBrand({ name: "Oristor GPFC", slug: "oristor-gpfc" });
    const product = await createProduct({
      sku: "GPFC-1",
      slug: "gpfc-1",
      name: "Curry Powder",
      status: "Published",
      brand: { connect: { id: brand.id } },
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
    await setProductNutrition({
      product: { connect: { id: product.id } },
      servingSize: "1 tsp",
      calories: "10.00",
      protein: "1.00",
      fat: "0.50",
      saturatedFat: "0.10",
      carbohydrates: "1.00",
      sugar: "0.20",
      fibre: "0.50",
      sodium: "1.00",
    });

    const items = await getProductsForCompare([product.id]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: product.id,
      name: "Curry Powder",
      brandName: "Oristor GPFC",
      price: 450,
      nutrition: { servingSize: "1 tsp" },
      rating: null,
      reviewCount: null,
    });
  });

  it("excludes a product with no resolved price", async () => {
    const product = await createProduct({ sku: "GPFC-2", slug: "gpfc-2", name: "No Price", status: "Published" });

    expect(await getProductsForCompare([product.id])).toEqual([]);
  });

  it("excludes a non-Published product", async () => {
    const product = await createProduct({ sku: "GPFC-3", slug: "gpfc-3", name: "Draft", status: "Draft" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    expect(await getProductsForCompare([product.id])).toEqual([]);
  });

  it("returns results in the order of the input ids, not database order", async () => {
    const a = await createProduct({ sku: "GPFC-4", slug: "gpfc-4", name: "A", status: "Published" });
    await createStandardPrice({ product: { connect: { id: a.id } }, price: "100.00" });
    const b = await createProduct({ sku: "GPFC-5", slug: "gpfc-5", name: "B", status: "Published" });
    await createStandardPrice({ product: { connect: { id: b.id } }, price: "200.00" });

    const items = await getProductsForCompare([b.id, a.id]);

    expect(items.map((item) => item.id)).toEqual([b.id, a.id]);
  });

  it("uses a registered review summary provider once one exists", async () => {
    registerReviewSummaryProvider(async () => ({ averageRating: 4.5, reviewCount: 3, previewReviews: [] }));
    const product = await createProduct({ sku: "GPFC-6", slug: "gpfc-6", name: "Rated", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    const items = await getProductsForCompare([product.id]);

    expect(items[0]).toMatchObject({ rating: 4.5, reviewCount: 3 });
  });

  it("returns an empty array for an empty input", async () => {
    expect(await getProductsForCompare([])).toEqual([]);
  });
});
```

Also add `afterEach(() => registerReviewSummaryProvider(async () => null))` if the file doesn't already reset the provider between tests — check the existing `describe("getProductDetail", ...)` block's setup first; if it already resets the provider in a shared `afterEach`, don't add a second one.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-detail-service.test.ts
```

Expected: FAIL — `getProductsForCompare is not a function` (or a TypeScript import error). Pre-existing tests in this file must still pass.

- [ ] **Step 3: Implement the service function**

In `src/services/product.service.ts`, add near `getProductDetail`/`getProductsByIds`:

```ts
export interface CompareItem {
  id: string;
  slug: string;
  name: string;
  imageSrc: string;
  imageAlt: string;
  brandName: string | null;
  price: number;
  currency: string;
  nutrition: ProductDetailNutrition | null;
  ingredients: ProductDetailIngredient[];
  allergenNames: string[];
  certificationNames: string[];
  rating: number | null;
  reviewCount: number | null;
}

export async function getProductsForCompare(productIds: string[]): Promise<CompareItem[]> {
  if (productIds.length === 0) return [];

  const candidates = await productRepository.findProductsForCompareByIds(productIds);
  const resolvedPrices = await pricingService.resolvePricesForProducts(
    candidates.map((candidate) => candidate.id),
    { customerGroup: "Retail" },
  );

  const byId = new Map<string, CompareItem>();
  for (const candidate of candidates) {
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue;

    const reviewSummary = await getReviewSummary(candidate.id);
    const primaryImage = candidate.images[0];

    byId.set(candidate.id, {
      id: candidate.id,
      slug: candidate.slug,
      name: candidate.name,
      imageSrc: primaryImage?.url ?? "",
      imageAlt: primaryImage?.altText ?? candidate.name,
      brandName: candidate.brand?.name ?? null,
      price: resolved.price.toNumber(),
      currency: resolved.currency,
      nutrition: candidate.nutrition
        ? {
            servingSize: candidate.nutrition.servingSize,
            calories: candidate.nutrition.calories.toNumber(),
            protein: candidate.nutrition.protein.toNumber(),
            fat: candidate.nutrition.fat.toNumber(),
            saturatedFat: candidate.nutrition.saturatedFat.toNumber(),
            carbohydrates: candidate.nutrition.carbohydrates.toNumber(),
            sugar: candidate.nutrition.sugar.toNumber(),
            fibre: candidate.nutrition.fibre.toNumber(),
            sodium: candidate.nutrition.sodium.toNumber(),
          }
        : null,
      ingredients: candidate.ingredients.map((ingredient) => ({
        name: ingredient.name,
        isAllergen: ingredient.isAllergen,
      })),
      allergenNames: candidate.allergens.map((allergen) => allergen.name),
      certificationNames: candidate.certifications.map((certification) => certification.name),
      rating: reviewSummary?.averageRating ?? null,
      reviewCount: reviewSummary?.reviewCount ?? null,
    });
  }

  // Preserve the caller's id order (the tray's insertion order), not
  // database/query order — a product dropped by the price/status filters
  // above is simply absent, not a gap in the array.
  return productIds.map((id) => byId.get(id)).filter((item): item is CompareItem => item !== undefined);
}
```

Check `ProductDetailImage`'s `altText` field is non-nullable already handled the same way `getProductDetail` does it (`image.altText ?? product.name`) — match that exact fallback, already written above.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-detail-service.test.ts
```

Expected: PASS, including all 6 new `getProductsForCompare` tests (pre-existing `getProductDetail`/`listRelatedProducts` tests must still pass).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/services/product.service.ts tests/unit/product-detail-service.test.ts
git commit -m "feat: add getProductsForCompare service function"
```

---

## Task 4: `GET /api/products/compare`

**Files:**
- Create: `src/app/api/products/compare/route.ts`
- Test: `tests/unit/product-compare-route.test.ts`

**Interfaces:**
- Consumes: `getProductsForCompare` from `@/services/product.service` (Task 3), `compareIdsSchema` from `@/validation/product-compare.schema` (Task 2).
- Produces: `GET` handler for `/api/products/compare`.

This route is **not** auth-gated — same public trust level as `/api/products/by-ids`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-compare-route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/compare/route";

afterEach(async () => {
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
});

describe("GET /api/products/compare", () => {
  it("returns comparison data for valid ids", async () => {
    const product = await createProduct({
      sku: "COMPARE-ROUTE-1",
      slug: "compare-route-1",
      name: "Curry Powder",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request(`http://localhost/api/products/compare?ids=${product.id}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(product.id);
  });

  it("returns 400 for a missing ids param", async () => {
    const response = await GET(new Request("http://localhost/api/products/compare"));

    expect(response.status).toBe(400);
  });

  it("returns 400 for more than 4 ids", async () => {
    const response = await GET(
      new Request("http://localhost/api/products/compare?ids=p1,p2,p3,p4,p5"),
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 for a blank ids param", async () => {
    const response = await GET(new Request("http://localhost/api/products/compare?ids="));

    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-compare-route.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/products/compare/route'`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/products/compare/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getProductsForCompare } from "@/services/product.service";
import { compareIdsSchema } from "@/validation/product-compare.schema";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = compareIdsSchema.safeParse(url.searchParams.get("ids") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid ids" }, { status: 400 });
  }

  const items = await getProductsForCompare(parsed.data);
  return NextResponse.json({ items }, { status: 200 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-compare-route.test.ts
```

Expected: PASS, all 4 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/app/api/products/compare/route.ts tests/unit/product-compare-route.test.ts
git commit -m "feat: add GET /api/products/compare"
```

---

## Task 5: `compare-store.ts` (Zustand, session-only)

**Files:**
- Create: `src/lib/stores/compare-store.ts`
- Test: `tests/unit/compare-store.test.ts`

**Interfaces:**
- Produces: `useCompareStore` — `{ items: string[]; add(productId): "added"|"duplicate"|"full"; remove(productId): void; has(productId): boolean; clear(): void }`. Consumed by Task 6 (`CompareToggle`), Task 8 (`CompareTrayIndicator`), Task 9 (`CompareView`'s per-item remove).

**Deliberately no `persist` middleware** — unlike `wishlist-store.ts`, this must NOT survive a page reload/browser restart (the story requires it cleared on session end).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/compare-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useCompareStore } from "@/lib/stores/compare-store";

beforeEach(() => {
  useCompareStore.setState({ items: [] });
});

describe("useCompareStore", () => {
  it("adds a product id and returns \"added\"", () => {
    const result = useCompareStore.getState().add("p1");

    expect(result).toBe("added");
    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });

  it("returns \"duplicate\" and does not re-add an id already in the tray", () => {
    useCompareStore.getState().add("p1");

    const result = useCompareStore.getState().add("p1");

    expect(result).toBe("duplicate");
    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });

  it("returns \"full\" and does not add a 5th id", () => {
    useCompareStore.getState().add("p1");
    useCompareStore.getState().add("p2");
    useCompareStore.getState().add("p3");
    useCompareStore.getState().add("p4");

    const result = useCompareStore.getState().add("p5");

    expect(result).toBe("full");
    expect(useCompareStore.getState().items).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("removes a product id", () => {
    useCompareStore.getState().add("p1");

    useCompareStore.getState().remove("p1");

    expect(useCompareStore.getState().items).toEqual([]);
  });

  it("has() reflects current membership", () => {
    useCompareStore.getState().add("p1");

    expect(useCompareStore.getState().has("p1")).toBe(true);
    expect(useCompareStore.getState().has("p2")).toBe(false);
  });

  it("clear() empties the tray", () => {
    useCompareStore.getState().add("p1");
    useCompareStore.getState().add("p2");

    useCompareStore.getState().clear();

    expect(useCompareStore.getState().items).toEqual([]);
  });

  it("does not persist to localStorage", () => {
    useCompareStore.getState().add("p1");

    expect(localStorage.getItem("oristor-compare")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/compare-store.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/stores/compare-store'`.

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/compare-store.ts`:

```ts
import { create } from "zustand";

interface CompareState {
  items: string[];
  add: (productId: string) => "added" | "duplicate" | "full";
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
}

/**
 * Compare tray — STORY-014. Deliberately NOT persisted (no `persist`
 * middleware, unlike wishlist-store.ts): the story requires this to clear
 * on session end, not survive a browser restart. Session-only in-memory
 * Zustand state.
 */
export const useCompareStore = create<CompareState>((set, get) => ({
  items: [],
  add: (productId) => {
    const { items } = get();
    if (items.includes(productId)) return "duplicate";
    if (items.length >= 4) return "full";
    set({ items: [...items, productId] });
    return "added";
  },
  remove: (productId) => set({ items: get().items.filter((id) => id !== productId) }),
  has: (productId) => get().items.includes(productId),
  clear: () => set({ items: [] }),
}));
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/compare-store.test.ts
```

Expected: PASS, all 7 tests.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/lib/stores/compare-store.ts tests/unit/compare-store.test.ts
git commit -m "feat: add session-only compare tray store"
```

---

## Task 6: `CompareToggle` component; wire into `ProductCard`

**Files:**
- Create: `src/components/storefront/product/compare-toggle.tsx`
- Modify: `src/components/storefront/product/product-card.tsx`
- Modify: `tests/unit/product-card.test.tsx`

**Interfaces:**
- Consumes: `useCompareStore` (Task 5).
- Produces: `<CompareToggle productId={string} />` — a shared icon-button control, consumed by this task (`ProductCard`) and Task 7 (`ProductActions`).

- [ ] **Step 1: Write the failing test**

In `tests/unit/product-card.test.tsx`, add the import and two new tests. The file currently imports `ProductCard` and `useWishlistStore` — add `useCompareStore` from `@/lib/stores/compare-store` to the imports, and add a `beforeEach` reset (`useCompareStore.setState({ items: [] })`) alongside the existing wishlist reset. Add these tests to the existing `describe("ProductCard", ...)` block:

```ts
  it("renders a compare toggle that adds the product to the compare store", () => {
    renderCard();

    screen.getByRole("button", { name: "Add to compare" }).click();

    expect(useCompareStore.getState().items).toEqual(["1"]);
  });

  it("does not navigate when the compare toggle is clicked", () => {
    renderCard();

    const button = screen.getByRole("button", { name: "Add to compare" });
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    const prevented = !button.dispatchEvent(clickEvent);

    expect(prevented).toBe(true);
  });

  it("shows an inline message and does not add a 5th product when the tray is full", () => {
    useCompareStore.setState({ items: ["a", "b", "c", "d"] });
    renderCard();

    screen.getByRole("button", { name: "Add to compare" }).click();

    expect(screen.getByText(/compare is full/i)).toBeInTheDocument();
    expect(useCompareStore.getState().items).toEqual(["a", "b", "c", "d"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-card.test.tsx
```

Expected: FAIL — no button with name "Add to compare" exists yet.

- [ ] **Step 3: Implement `CompareToggle`**

Create `src/components/storefront/product/compare-toggle.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/lib/stores/compare-store";

export function CompareToggle({ productId, className }: { productId: string; className?: string }) {
  const isComparing = useCompareStore((state) => state.has(productId));
  const add = useCompareStore((state) => state.add);
  const remove = useCompareStore((state) => state.remove);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (isComparing) {
      remove(productId);
      return;
    }

    const result = add(productId);
    if (result === "full") {
      setMessage("Compare is full — remove one to add another.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-pressed={isComparing}
        aria-label={isComparing ? "Remove from compare" : "Add to compare"}
        onClick={handleClick}
      >
        <Scale className={isComparing ? "fill-current" : undefined} />
      </Button>
      <div aria-live="polite" className="sr-only">
        {message}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Wire it into `ProductCard`**

In `src/components/storefront/product/product-card.tsx`, add the import and place `<CompareToggle>` immediately before the existing wishlist `<Button>` in the top-right overlay, shifting the wishlist button's position so both fit side by side:

```tsx
import { CompareToggle } from "@/components/storefront/product/compare-toggle";
```

Change the wishlist button's `className` from `"absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"` to `"absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"` (unchanged), and add the compare toggle immediately before it in the JSX:

```tsx
<CompareToggle
  productId={product.id}
  className="absolute top-2 right-10 z-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
/>
```

(i.e. `right-10` instead of `right-2`, so it sits to the left of the wishlist heart at `right-2`, both in the same `absolute` overlay row.)

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-card.test.tsx
```

Expected: PASS, all 8 tests (5 pre-existing + 3 new).

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/storefront/product/compare-toggle.tsx src/components/storefront/product/product-card.tsx tests/unit/product-card.test.tsx
git commit -m "feat: add CompareToggle and wire it into ProductCard"
```

---

## Task 7: Wire `CompareToggle` into `ProductActions`

**Files:**
- Modify: `src/components/storefront/product/product-actions.tsx`
- Modify: `tests/unit/product-actions.test.tsx`

**Interfaces:**
- Consumes: `CompareToggle` (Task 6).
- Produces: no change to `ProductActions`'s existing `{ productId, inStock }` prop shape.

- [ ] **Step 1: Write the failing test**

In `tests/unit/product-actions.test.tsx`, add `useCompareStore` to the imports (`@/lib/stores/compare-store`), reset it in the existing `beforeEach` alongside the wishlist store reset, and add this test to the `describe("ProductActions", ...)` block:

```ts
  it("renders a compare toggle that adds the product to the compare store", () => {
    renderWithProviders(<ProductActions productId="p1" inStock={true} />);

    screen.getByRole("button", { name: "Add to compare" }).click();

    expect(useCompareStore.getState().items).toEqual(["p1"]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/product-actions.test.tsx
```

Expected: FAIL — no button with name "Add to compare" exists in `ProductActions` yet.

- [ ] **Step 3: Wire in the control**

In `src/components/storefront/product/product-actions.tsx`, add the import and render `<CompareToggle>` alongside the existing wishlist button:

```tsx
import { CompareToggle } from "@/components/storefront/product/compare-toggle";
```

Add `<CompareToggle productId={productId} className="shrink-0" />` as a sibling of the existing wishlist `<Button>`, inside the same `flex items-center gap-3` container (after the wishlist button, matching the existing `icon-lg` sizing visually — `CompareToggle` itself renders an `icon-sm` `Button`; if that looks visually inconsistent next to the PDP's larger `icon-lg` wishlist button once you view it, that's a design polish note to flag in your self-review, not a blocker — the plan's job is correctness, exact pixel sizing is a judgment call at review time).

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/product-actions.test.tsx
```

Expected: PASS, all 6 tests (5 pre-existing + 1 new).

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/storefront/product/product-actions.tsx tests/unit/product-actions.test.tsx
git commit -m "feat: add compare toggle to ProductActions"
```

---

## Task 8: `CompareTrayIndicator`; wire into `HeaderActions`

**Files:**
- Create: `src/components/storefront/layout/compare-tray-indicator.tsx`
- Modify: `src/components/storefront/layout/header-actions.tsx`
- Test: `tests/unit/compare-tray-indicator.test.tsx`

**Interfaces:**
- Consumes: `useCompareStore` (Task 5), `GET /api/products/by-ids` (existing, STORY-013 — reused as-is, not modified), `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent` from `@/components/ui/dropdown-menu` (existing).
- Produces: `<CompareTrayIndicator />`, mounted in `HeaderActions`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/compare-tray-indicator.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { CompareTrayIndicator } = await import("@/components/storefront/layout/compare-tray-indicator");
const { useCompareStore } = await import("@/lib/stores/compare-store");

function renderIndicator() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompareTrayIndicator />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useCompareStore.setState({ items: [] });
  vi.restoreAllMocks();
});

describe("CompareTrayIndicator", () => {
  it("shows no count badge when the tray is empty", () => {
    renderIndicator();

    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the item count when the tray has products", () => {
    useCompareStore.setState({ items: ["p1", "p2"] });

    renderIndicator();

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("opens the drawer and shows an empty-state message with no items", async () => {
    renderIndicator();

    screen.getByRole("button", { name: /compare/i }).click();

    await waitFor(() => expect(screen.getByText(/add products to compare/i)).toBeInTheDocument());
  });

  it("opens the drawer and fetches thumbnails for tray items", async () => {
    useCompareStore.setState({ items: ["p1"] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "p1",
                name: "Curry Powder",
                href: "/products/curry-powder",
                imageSrc: "/curry.jpg",
                imageAlt: "Curry Powder",
                price: 450,
                currency: "LKR",
                inStock: true,
              },
            ],
          }),
      }),
    );

    renderIndicator();
    screen.getByRole("button", { name: /compare/i }).click();

    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith("/api/products/by-ids?ids=p1");
  });

  it("removing an item from the drawer updates the compare store", async () => {
    useCompareStore.setState({ items: ["p1"] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "p1",
                name: "Curry Powder",
                href: "/products/curry-powder",
                imageSrc: "/curry.jpg",
                imageAlt: "Curry Powder",
                price: 450,
                currency: "LKR",
                inStock: true,
              },
            ],
          }),
      }),
    );

    renderIndicator();
    screen.getByRole("button", { name: /compare/i }).click();
    await waitFor(() => expect(screen.getByText("Curry Powder")).toBeInTheDocument());

    screen.getByRole("button", { name: /remove curry powder/i }).click();

    expect(useCompareStore.getState().items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/compare-tray-indicator.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/storefront/layout/compare-tray-indicator'`.

- [ ] **Step 3: Implement the component**

Create `src/components/storefront/layout/compare-tray-indicator.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Scale, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompareStore } from "@/lib/stores/compare-store";
import type { ProductListItem } from "@/types/product";

async function fetchTrayItems(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const response = await fetch(`/api/products/by-ids?ids=${ids.join(",")}`);
  if (!response.ok) throw new Error("Failed to load compare tray items");
  const body: { items: ProductListItem[] } = await response.json();
  return body.items;
}

export function CompareTrayIndicator() {
  const items = useCompareStore((state) => state.items);
  const remove = useCompareStore((state) => state.remove);

  const { data: trayItems = [] } = useQuery({
    queryKey: ["compare-tray", items],
    queryFn: () => fetchTrayItems(items),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={items.length > 0 ? `Compare, ${items.length} item${items.length === 1 ? "" : "s"}` : "Compare"}
        className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Scale className="size-5" aria-hidden="true" />
        {items.length > 0 && (
          <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
            {items.length}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {trayItems.length === 0 ? (
          <p className="p-4 text-center text-caption text-charcoal/70">Add products to compare</p>
        ) : (
          <div className="p-2">
            <ul>
              {trayItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 p-2">
                  <span className="flex-1 truncate text-small">{item.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove(item.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2 w-full"
              nativeButton={false}
              render={<Link href={`/products/compare?ids=${items.join(",")}`} />}
            >
              Compare
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

(`DropdownMenuTrigger` takes `className`/`aria-label`/children directly — confirmed against `src/components/ui/dropdown-menu.tsx`'s `MenuPrimitive.Trigger` wrapper and `account-menu.tsx`'s existing usage, which renders its own trigger content as children rather than via a `render` prop. Only `DropdownMenuItem` uses the `render`-prop-wrapping-a-`Link` pattern, for turning a menu row into a navigable link — not needed here since the trigger itself isn't a link.)

- [ ] **Step 4: Wire it into `HeaderActions`**

In `src/components/storefront/layout/header-actions.tsx`, add the import and render `<CompareTrayIndicator />` next to `<WishlistBadge />`:

```tsx
import { CompareTrayIndicator } from "./compare-tray-indicator";
```

```tsx
<WishlistBadge />
<CompareTrayIndicator />
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run tests/unit/compare-tray-indicator.test.tsx
```

Expected: PASS, all 5 tests.

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/components/storefront/layout/compare-tray-indicator.tsx src/components/storefront/layout/header-actions.tsx tests/unit/compare-tray-indicator.test.tsx
git commit -m "feat: add compare tray indicator to header"
```

---

## Task 9: `/products/compare` page

**Files:**
- Create: `src/app/(storefront)/products/compare/page.tsx`
- Create: `src/components/storefront/product/compare-view.tsx`
- Test: `tests/unit/compare-view.test.tsx`

**Interfaces:**
- Consumes: `getProductsForCompare` (Task 3), `compareIdsSchema` (Task 2), `useCompareStore` (Task 5).
- Produces: the page at `/products/compare`, linked from `CompareTrayIndicator` (Task 8, already points here).

**Graceful degradation, not a 400 page:** the page parses `ids` with the same `compareIdsSchema` the API route uses, but on a parse failure (missing, malformed, more than 4) treats it as an empty list rather than erroring — which naturally renders the existing empty state. This matches the codebase's page-vs-route convention (see Global Constraints).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/compare-view.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompareItem } from "@/services/product.service";

const { CompareView } = await import("@/components/storefront/product/compare-view");
const { useCompareStore } = await import("@/lib/stores/compare-store");

const itemA: CompareItem = {
  id: "p1",
  slug: "curry-powder",
  name: "Curry Powder",
  imageSrc: "/curry.jpg",
  imageAlt: "Curry Powder",
  brandName: "Oristor",
  price: 450,
  currency: "LKR",
  nutrition: {
    servingSize: "1 tsp",
    calories: 10,
    protein: 1,
    fat: 0.5,
    saturatedFat: 0.1,
    carbohydrates: 1,
    sugar: 0.2,
    fibre: 0.5,
    sodium: 1,
  },
  ingredients: [{ name: "Coriander", isAllergen: false }],
  allergenNames: [],
  certificationNames: ["Organic"],
  rating: 4.5,
  reviewCount: 10,
};

const itemB: CompareItem = { ...itemA, id: "p2", slug: "chili-paste", name: "Chili Paste" };

function renderView(items: CompareItem[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <CompareView items={items} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useCompareStore.setState({ items: [] });
});

describe("CompareView", () => {
  it("shows an empty state with zero products", () => {
    renderView([]);

    expect(screen.getByText(/add more products to compare/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /browse products/i })).toHaveAttribute("href", "/products");
  });

  it("shows an empty state with only one product", () => {
    renderView([itemA]);

    expect(screen.getByText(/add more products to compare/i)).toBeInTheDocument();
  });

  it("renders each product's name, price, and key attributes with 2+ products", () => {
    renderView([itemA, itemB]);

    expect(screen.getByText("Curry Powder")).toBeInTheDocument();
    expect(screen.getByText("Chili Paste")).toBeInTheDocument();
    expect(screen.getAllByText("LKR 450")).toHaveLength(2);
    expect(screen.getAllByText("Organic")).toHaveLength(2);
  });

  it("removing a product drops it from the view and from the compare store", async () => {
    useCompareStore.setState({ items: ["p1", "p2"] });
    renderView([itemA, itemB]);

    screen.getByRole("button", { name: /remove curry powder/i }).click();

    await waitFor(() => expect(screen.queryByText("Curry Powder")).not.toBeInTheDocument());
    expect(useCompareStore.getState().items).toEqual(["p2"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/compare-view.test.tsx
```

Expected: FAIL — `Cannot find module '@/components/storefront/product/compare-view'`.

- [ ] **Step 3: Implement `CompareView`**

Create `src/components/storefront/product/compare-view.tsx`:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/lib/stores/compare-store";
import type { CompareItem } from "@/services/product.service";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

const ATTRIBUTE_ROWS: Array<{ label: string; render: (item: CompareItem) => React.ReactNode }> = [
  { label: "Price", render: (item) => formatPrice(item.price, item.currency) },
  { label: "Brand", render: (item) => item.brandName ?? "—" },
  { label: "Rating", render: (item) => (item.rating !== null ? `${item.rating} (${item.reviewCount})` : "—") },
  {
    label: "Calories",
    render: (item) => (item.nutrition ? `${item.nutrition.calories} kcal` : "—"),
  },
  {
    label: "Protein",
    render: (item) => (item.nutrition ? `${item.nutrition.protein}g` : "—"),
  },
  {
    label: "Ingredients",
    render: (item) => (item.ingredients.length > 0 ? item.ingredients.map((i) => i.name).join(", ") : "—"),
  },
  {
    label: "Allergens",
    render: (item) => (item.allergenNames.length > 0 ? item.allergenNames.join(", ") : "None"),
  },
  {
    label: "Certifications",
    render: (item) => (item.certificationNames.length > 0 ? item.certificationNames.join(", ") : "—"),
  },
];

export function CompareView({ items }: { items: CompareItem[] }) {
  const router = useRouter();
  const removeFromStore = useCompareStore((state) => state.remove);

  function handleRemove(productId: string) {
    removeFromStore(productId);
    const remainingIds = items.filter((item) => item.id !== productId).map((item) => item.id);
    router.replace(remainingIds.length > 0 ? `/products/compare?ids=${remainingIds.join(",")}` : "/products/compare");
  }

  if (items.length < 2) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-h3 text-charcoal">Add more products to compare</h1>
        <p className="mt-2 text-body text-charcoal/80">Select at least 2 products to see a side-by-side comparison.</p>
        <Button className="mt-6" nativeButton={false} render={<Link href="/products" />}>
          Browse Products
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-h3 text-charcoal">Compare Products</h1>

      {/* Desktop: table, one column per product */}
      <table className="mt-6 hidden w-full border-collapse md:table">
        <thead>
          <tr>
            <th className="w-32" />
            {items.map((item) => (
              <th key={item.id} className="p-3 text-left align-top">
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-0 right-0"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => handleRemove(item.id)}
                  >
                    <X className="size-4" />
                  </Button>
                  <Link href={`/products/${item.slug}`} className="block">
                    <div className="relative aspect-square size-24 overflow-hidden rounded-lg bg-cream">
                      <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="96px" className="object-contain p-2" />
                    </div>
                    <p className="mt-2 font-medium text-charcoal">{item.name}</p>
                  </Link>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ATTRIBUTE_ROWS.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th className="p-3 text-left text-caption font-medium text-charcoal/70">{row.label}</th>
              {items.map((item) => (
                <td key={item.id} className="p-3 text-body text-charcoal">
                  {row.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: stacked, scrollable cards */}
      <div className="mt-6 space-y-6 md:hidden">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <Link href={`/products/${item.slug}`} className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-cream">
                  <Image src={item.imageSrc} alt={item.imageAlt} fill sizes="64px" className="object-contain p-2" />
                </div>
                <p className="font-medium text-charcoal">{item.name}</p>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.name}`}
                onClick={() => handleRemove(item.id)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <dl className="mt-3 space-y-1">
              {ATTRIBUTE_ROWS.map((row) => (
                <div key={row.label} className="flex justify-between text-small">
                  <dt className="text-charcoal/70">{row.label}</dt>
                  <dd className="text-charcoal">{row.render(item)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/compare-view.test.tsx
```

Expected: PASS, all 4 tests. If the "Browse Products" `Button`'s `render` prop usage doesn't match this codebase's actual Base UI `Button` API, check `src/components/storefront/home/hero-banner.tsx`'s existing `<Button ... nativeButton={false} render={<Link .../>} />` usage and match it exactly.

- [ ] **Step 5: Implement the page**

Create `src/app/(storefront)/products/compare/page.tsx`:

```tsx
import type { Metadata } from "next";

import { CompareView } from "@/components/storefront/product/compare-view";
import { getProductsForCompare } from "@/services/product.service";
import { compareIdsSchema } from "@/validation/product-compare.schema";

interface ComparePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Compare Products",
  robots: { index: false, follow: false },
};

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const raw = await searchParams;
  const idsParam = Array.isArray(raw.ids) ? raw.ids[0] : raw.ids;
  const parsed = compareIdsSchema.safeParse(idsParam ?? "");
  const items = parsed.success ? await getProductsForCompare(parsed.data) : [];

  return <CompareView items={items} />;
}
```

- [ ] **Step 6: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add src/app/\(storefront\)/products/compare/page.tsx src/components/storefront/product/compare-view.tsx tests/unit/compare-view.test.tsx
git commit -m "feat: add /products/compare page"
```

---

## Task 10: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/product-compare.spec.ts`

**Interfaces:**
- Consumes: the full stack built in Tasks 1-9, against a real running dev server + database.

- [ ] **Step 1: Write the test**

Create `tests/e2e/product-compare.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";

test.describe.configure({ mode: "serial" });

test.describe("Product Compare", () => {
  test.beforeEach(async () => {
    await prisma.standardPrice.deleteMany({});
    await prisma.product.deleteMany({ where: { sku: { startsWith: "E2E-COMPARE-" } } });
  });

  test("adds 3 products from the listing grid, compares them, then removes one", async ({ page }) => {
    for (const [i, name] of ["Curry Powder", "Chili Paste", "Turmeric Powder"].entries()) {
      const product = await createProduct({
        sku: `E2E-COMPARE-${i + 1}`,
        slug: `e2e-compare-${i + 1}`,
        name,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });
    }

    await page.goto("/products");
    const cards = page.locator('[aria-label="Add to compare"]');
    await cards.nth(0).click();
    await cards.nth(0).click();
    await cards.nth(0).click();

    await page.getByRole("button", { name: /compare, 3 items/i }).click();
    await page.getByRole("link", { name: "Compare" }).click();

    await expect(page).toHaveURL(/\/products\/compare\?ids=/);
    const rows = page.locator("table tbody tr");
    await expect(rows.first()).toBeVisible();

    const removeButtons = page.getByRole("button", { name: /^Remove /i });
    await removeButtons.first().click();

    await expect(page.locator("table thead th")).toHaveCount(3); // 1 label column + 2 remaining products
  });

  test("adding a 5th product to a full tray is blocked with an inline message", async ({ page }) => {
    const skus: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const product = await createProduct({
        sku: `E2E-COMPARE-${i}`,
        slug: `e2e-compare-full-${i}`,
        name: `Product ${i}`,
        status: "Published",
      });
      await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });
      skus.push(product.id);
    }

    await page.goto("/products");
    const toggles = page.locator('[aria-label="Add to compare"]');
    for (let i = 0; i < 4; i++) {
      await toggles.nth(0).click();
    }

    await toggles.nth(0).click();

    await expect(page.getByText(/compare is full/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the e2e tests**

```bash
npx playwright test tests/e2e/product-compare.spec.ts
```

Expected: PASS. If a selector doesn't match the actual rendered markup (e.g. the tray drawer's "Compare" link text, or the table structure), inspect the real page during a local `npm run dev` run and adjust the selectors to match exactly — don't guess blindly, this is the one part of this plan most likely to need on-the-spot adjustment against live rendered output, same as STORY-013's e2e task.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/product-compare.spec.ts
git commit -m "test: add Playwright e2e coverage for product compare"
```

---

## Task 11: Documentation; mark story done

**Files:**
- Modify: `docs/architecture-decisions.md`
- Modify: `docs/stories/03-product-platform/STORY-014-product-compare.md`
- Modify: `docs/stories/README.md`

**Interfaces:** none — final "ship" step.

- [ ] **Step 1: Document the feature**

Append an entry to `docs/architecture-decisions.md` (following the existing dated-entry format):

```markdown
## 2026-09-22 — STORY-014 Product Compare

**No schema change.** Compare reads existing catalogue tables via a new
batch query (`findProductsForCompareByIds`) reusing the exact include
shape `findProductDetailBySlug` (the PDP) already uses, just batched by id
instead of singular by slug.

**Session-only, no persistence, no auth.** `useCompareStore`
(`src/lib/stores/compare-store.ts`) deliberately has no `persist`
middleware, unlike `wishlist-store.ts` — the compare tray clears on
browser restart by design, per the story's acceptance criteria.

**Tray drawer reuses STORY-013's `GET /api/products/by-ids`** for its
thumbnails rather than a second batch-lookup endpoint — no new "public
lightweight product list" route was needed.

**Page-vs-route validation split:** `GET /api/products/compare` strictly
rejects (400) more than 4 or zero ids via `compareIdsSchema`, but
`/products/compare` (the page) uses the same schema and gracefully falls
back to its own empty state on a parse failure rather than erroring —
matching this codebase's established page-degrades/route-rejects
convention.

**Rating gracefully degrades automatically.** `getProductsForCompare`
reuses the existing `getReviewSummary` provider-hook from
`product-detail-extensions.ts` (already defaults to `null` until
STORY-015 registers a real provider) — no special-casing needed for
"STORY-015 not shipped yet."
```

- [ ] **Step 2: Mark the story done**

In `docs/stories/03-product-platform/STORY-014-product-compare.md`, change `**Status:** Draft` to `**Status:** Done`, and check off every item under **Acceptance Criteria** and **Tasks** that Tasks 1-10 above satisfy (cross-check against the actual implementation before checking each box — all of them should be satisfied by this plan).

In `docs/stories/README.md`, change the `STORY-014 | Product Compare | Draft` row to `STORY-014 | Product Compare | Done`.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture-decisions.md docs/stories/03-product-platform/STORY-014-product-compare.md docs/stories/README.md
git commit -m "docs: mark STORY-014 done; document compare architecture decisions"
```

---

## Self-Review Notes

- **Spec coverage:** every design-doc section (data layer, service, API,
  client state, frontend components, testing) maps to a task above. The
  spec's `nuqs`-on-the-page detail was simplified during planning — the
  Server Component reads `searchParams` directly (standard Next.js
  convention, matches `product-search/page.tsx`'s exact pattern) rather
  than needing a client-side `useQueryState` round-trip for the initial
  render; `nuqs`'s parser conventions are still followed for the comma-
  separated format, just via the plain Zod schema both the route and page
  share, not the `nuqs` React hook itself on the page (the hook would only
  matter for a fully client-rendered compare page, which this isn't).
- **Type consistency:** `CompareItem` (Task 3) is the one shape used
  across Tasks 3, 4, 9 — checked for drift. `useCompareStore`'s `add()`
  three-way return (`"added"|"duplicate"|"full"`) is identical from Task 5
  through both its consumers (Tasks 6, 7).
- **No placeholders:** every task's code is complete, runnable
  TypeScript, not sketched. `DropdownMenuTrigger`'s actual API was
  verified directly against `src/components/ui/dropdown-menu.tsx` and
  `account-menu.tsx`'s existing usage during planning (children directly,
  no `render` prop — only `DropdownMenuItem` uses `render`), so Task 8's
  code is not a guess. Task 10's e2e selectors remain flagged as needing
  on-the-spot verification against the actual live rendered markup, same
  as STORY-013's plan did for its one similarly uncertain spot — flagged,
  not hidden.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-22-product-compare.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
