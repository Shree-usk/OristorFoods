# Product Detail Page (STORY-011) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the storefront Product Detail Page at `/products/[slug]`, rendering every section `docs/blueprint.md` Section 4 requires from one aggregated server-side call, with graceful stand-ins for Reviews (STORY-015), Q&A (STORY-016), Recipes (Epic 04), Wishlist (STORY-013), and Cart (STORY-024) — none of which exist yet.

**Architecture:** A new `getProductDetail(slug, opts)` in `product.service.ts` composes catalogue data (extended repository query), resolved pricing, related products, and three registered "extension point" providers that default to `null`/empty until their owning story registers a real implementation. The page itself is a Next.js Server Component; only the gallery lightbox, share-copy button, add-to-cart/wishlist stub controls, and recently-viewed tracking are Client Components.

**Tech Stack:** Next.js 16 App Router (Server Components), TypeScript strict, Prisma 7 + `@prisma/adapter-pg`, Tailwind v4, Shadcn-style primitives on `@base-ui/react`, Zustand (+ `persist` for recently-viewed), Zod, Vitest + Testing Library, Playwright + `@axe-core/playwright`.

## Global Constraints

- No `any`, no implicit types (TypeScript strict mode).
- Database access only through the Repository layer; Services call Repositories, route handlers/pages call Services — never Prisma directly from a component or route handler.
- No duplicate logic — extract shared helpers instead of copy-pasting (see Task 6's `toProductListItem` extraction).
- Every new Zod-validated input uses `.catch()` for malformed-but-non-critical fields, matching `product-listing.schema.ts`'s established pattern, so a bad value degrades gracefully rather than 500s.
- Conventional Commits (`feat:`, `test:`, `docs:`, etc.) and frequent, small commits — one per task step group as shown below.
- Every section STORY-011's acceptance criteria requires must render a real value when data exists and a documented empty/placeholder state when it doesn't — never throw, never silently omit.
- `npx prisma db push` (not `migrate dev`) for schema iteration on this machine — see `docs/architecture-decisions.md`.

---

## Task 1: Data Layer — Schema, Repository Queries, and Seed Data

**Files:**
- Modify: `prisma/schema.prisma` (Product model)
- Modify: `src/repositories/product.repository.ts` (add `findProductDetailBySlug`, extend `ProductListingFilters`/`findPublishedProductsForListing`)
- Modify: `src/repositories/category.repository.ts` (add `getCategoryAncestorPath`)
- Modify: `prisma/seed.ts` (add `benefits`/`servingSuggestions` + a second image to the flagship seeded product)
- Test: `tests/unit/product-repository.test.ts`
- Test: `tests/unit/category-repository.test.ts`

**Interfaces:**
- Produces: `productRepository.findProductDetailBySlug(slug: string)` — returns the full Prisma `Product` with `brand`, `categories`, `images` (primary first), `videos`, `nutrition`, `ingredients` (ordered), `allergens`, `certifications`, and `bundle.items.componentProduct.images` included, or `null`.
- Produces: `ProductListingFilters.excludeProductId?: string` and matching `WHERE id != excludeProductId` behavior in `findPublishedProductsForListing`.
- Produces: `categoryRepository.CategoryPathItem { name: string; slug: string }` and `categoryRepository.getCategoryAncestorPath(categoryId: string): Promise<CategoryPathItem[]>` — root-to-leaf ordered.
- Consumes: nothing new (builds on STORY-009/010's existing repository functions).

- [ ] **Step 1: Add `benefits`/`servingSuggestions` to the Prisma schema**

Edit `prisma/schema.prisma`, in the `Product` model, immediately after `inStock`:

```prisma
  inStock          Boolean       @default(true)
  benefits           String[] @default([])
  servingSuggestions String[] @default([])
```

- [ ] **Step 2: Push the schema change**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Write the failing test for `findProductDetailBySlug`**

Add to `tests/unit/product-repository.test.ts`, after the closing `});` of `describe("findPublishedProductsForListing", ...)` (currently ending at line 185) and before `describe("listAllergens and listCertifications", ...)`:

```ts
describe("findProductDetailBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await findProductDetailBySlug("does-not-exist")).toBeNull();
  });

  it("includes nutrition, ordered ingredients, allergens, certifications, and images", async () => {
    const product = await createProduct({
      sku: "DETAIL-REPO-1",
      slug: "detail-repo-1",
      name: "Detail Repo Product",
      status: "Published",
      benefits: ["Rich in fibre"],
      servingSuggestions: ["Add to soups"],
    });
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
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "Second", sortOrder: 2 });
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "First", sortOrder: 1 });
    await addProductImage({ product: { connect: { id: product.id } }, url: "/a.jpg", isPrimary: false, sortOrder: 2 });
    await addProductImage({ product: { connect: { id: product.id } }, url: "/b.jpg", isPrimary: true, sortOrder: 1 });

    const found = await findProductDetailBySlug("detail-repo-1");

    expect(found?.benefits).toEqual(["Rich in fibre"]);
    expect(found?.servingSuggestions).toEqual(["Add to soups"]);
    expect(found?.nutrition?.servingSize).toBe("1 tsp");
    expect(found?.ingredients.map((i) => i.name)).toEqual(["First", "Second"]);
    expect(found?.images.map((i) => i.url)).toEqual(["/b.jpg", "/a.jpg"]);
  });
});
```

The test file does not yet import `findProductDetailBySlug`, `setProductNutrition`, `addProductIngredient`, or `addProductImage` — add all four to the existing named import from `@/repositories/product.repository` at the top of the file (alongside the already-imported `createAllergen`, `createCertification`, `createProduct`, etc.).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx prisma dev` (if not already running), then `npm run test -- product-repository`
Expected: FAIL — `findProductDetailBySlug is not a function` (or not exported)

- [ ] **Step 3: Implement `findProductDetailBySlug`**

Add to `src/repositories/product.repository.ts`, after `findProductById`:

```ts
export function findProductDetailBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      categories: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      videos: { orderBy: { sortOrder: "asc" } },
      nutrition: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      allergens: true,
      certifications: true,
      bundle: {
        include: {
          items: {
            include: {
              componentProduct: {
                include: { images: { where: { isPrimary: true }, take: 1 } },
              },
            },
          },
        },
      },
    },
  });
}
```

Also extend `ProductListingFilters` and `findPublishedProductsForListing` (used by Task 6's related-products lookup) — modify the existing interface and function:

```ts
export interface ProductListingFilters {
  categoryIds?: string[];
  collectionId?: string;
  allergenNamesToExclude?: string[];
  certificationIds?: string[];
  brandSlugs?: string[];
  inStock?: boolean;
  excludeProductId?: string;
}

export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
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
  });
}
```

Add a test for the new filter right before the closing `});` of `describe("findPublishedProductsForListing", ...)` (after the existing `inStock` test, still inside that describe block):

```ts
  it("excludes the given product id", async () => {
    const excluded = await createProduct({
      sku: "LIST-13",
      slug: "list-13",
      name: "Excluded",
      status: "Published",
    });
    await createProduct({ sku: "LIST-14", slug: "list-14", name: "Included", status: "Published" });

    const results = await findPublishedProductsForListing({ excludeProductId: excluded.id });

    expect(results.map((p) => p.slug)).not.toContain("list-13");
    expect(results.map((p) => p.slug)).toContain("list-14");
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-repository`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Write the failing test for `getCategoryAncestorPath`**

Add to `tests/unit/category-repository.test.ts` (create a new `describe` block; check the file's existing imports and add `getCategoryAncestorPath`):

```ts
describe("getCategoryAncestorPath", () => {
  it("returns a single-item path for a root category with no parent", async () => {
    const root = await createCategory({ name: "Root", slug: "path-root" });

    const path = await getCategoryAncestorPath(root.id);

    expect(path).toEqual([{ name: "Root", slug: "path-root" }]);
  });

  it("returns the full root-to-leaf path for a nested category", async () => {
    const root = await createCategory({ name: "Spices", slug: "path-spices" });
    const child = await createCategory({
      name: "Curry Powders",
      slug: "path-curry-powders",
      parent: { connect: { id: root.id } },
    });

    const path = await getCategoryAncestorPath(child.id);

    expect(path).toEqual([
      { name: "Spices", slug: "path-spices" },
      { name: "Curry Powders", slug: "path-curry-powders" },
    ]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -- category-repository`
Expected: FAIL — `getCategoryAncestorPath is not a function`

- [ ] **Step 7: Implement `getCategoryAncestorPath`**

Add to `src/repositories/category.repository.ts`, at the end of the file:

```ts
export interface CategoryPathItem {
  name: string;
  slug: string;
}

export async function getCategoryAncestorPath(categoryId: string): Promise<CategoryPathItem[]> {
  const path: CategoryPathItem[] = [];
  let current = await findCategoryById(categoryId);
  while (current) {
    path.unshift({ name: current.name, slug: current.slug });
    if (!current.parentId) break;
    current = await findCategoryById(current.parentId);
  }
  return path;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- category-repository`
Expected: PASS

- [ ] **Step 9: Seed the flagship product with the new fields and a second image**

In `prisma/seed.ts`, modify the `curryPowder` creation call to add `benefits` and `servingSuggestions`:

```ts
  const curryPowder = await productRepository.createProduct({
    sku: "ORI-CP-100",
    slug: "roasted-curry-powder-100g",
    name: "Roasted Curry Powder 100g",
    shortDescription: "Our signature roasted curry powder blend.",
    story: "Roasted in small batches using a recipe passed down for three generations.",
    status: "Published",
    productType: "Standard",
    publishedAt: new Date(),
    rewardPoints: 10,
    benefits: ["Rich in antioxidants", "No artificial preservatives"],
    servingSuggestions: ["Add to curries and stews", "Sprinkle over roasted vegetables"],
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: spices.id }] },
  });
```

And immediately after the existing `addProductImage` call for `curryPowder`, add a second image:

```ts
  await productRepository.addProductImage({
    product: { connect: { id: curryPowder.id } },
    url: "/images/products/roasted-curry-powder-100g-alt.jpg",
    altText: "Roasted Curry Powder 100g, alternate angle",
    isPrimary: false,
    sortOrder: 2,
  });
```

- [ ] **Step 10: Re-run the seed against the local dev database**

Run: `npx prisma db push && npx tsx prisma/seed.ts`
Expected: `Seed complete: { ... }` logged with no errors (re-running is safe — `main()` just re-inserts; if unique-constraint errors occur because seed already ran, first run `npx prisma db execute --file tests/unit/truncate-all.sql` to clear data, then re-seed).

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts src/repositories/product.repository.ts src/repositories/category.repository.ts tests/unit/product-repository.test.ts tests/unit/category-repository.test.ts
git commit -m "feat: add benefits/servingSuggestions fields and PDP-supporting repository queries"
```

---

## Task 2: Pricing Service — Standard Price Helper

**Files:**
- Modify: `src/services/pricing.service.ts`
- Test: `tests/unit/pricing-service.test.ts`

**Interfaces:**
- Produces: `pricingService.getStandardPrice(productId: string): Promise<{ price: number; currency: string } | null>`
- Consumes: `pricingRepository.getLatestStandardPrice` (existing).

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/pricing-service.test.ts` (new `describe` block; add `createStandardPrice` and `getStandardPrice` to existing imports if not already present):

```ts
describe("getStandardPrice", () => {
  it("returns the latest standard price as a plain number", async () => {
    const product = await createProduct({ sku: "STD-1", slug: "std-1", name: "Std", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "300.00" });

    const result = await getStandardPrice(product.id);

    expect(result).toEqual({ price: 300, currency: "LKR" });
  });

  it("returns null when no standard price is configured", async () => {
    const product = await createProduct({ sku: "STD-2", slug: "std-2", name: "Std 2", status: "Published" });

    expect(await getStandardPrice(product.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- pricing-service`
Expected: FAIL — `getStandardPrice is not a function`

- [ ] **Step 3: Implement `getStandardPrice`**

Add to `src/services/pricing.service.ts`, after `resolvePricesForProducts`:

```ts
export async function getStandardPrice(
  productId: string,
): Promise<{ price: number; currency: string } | null> {
  const standard = await pricingRepository.getLatestStandardPrice(productId);
  if (!standard) return null;
  return { price: standard.price.toNumber(), currency: standard.currency };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- pricing-service`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing.service.ts tests/unit/pricing-service.test.ts
git commit -m "feat: add getStandardPrice for PDP strike-through pricing"
```

---

## Task 3: Product Detail Extension Points

**Files:**
- Create: `src/services/product-detail-extensions.ts`
- Test: `tests/unit/product-detail-extensions.test.ts`

**Interfaces:**
- Produces: `ReviewPreview`, `ReviewSummary`, `GetReviewSummary`, `registerReviewSummaryProvider`, `getReviewSummary`
- Produces: `QaPreview`, `QaSummary`, `GetQaSummary`, `registerQaSummaryProvider`, `getQaSummary`
- Produces: `RecipePreview`, `RecipeSummary`, `GetRecipeSummary`, `registerRecipeSummaryProvider`, `getRecipeSummary`
- Produces: `resetProductDetailExtensionsForTesting()` (test-only)
- Consumes: nothing (this is the leaf module STORY-015/016/Epic-04 will import to plug in later).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-detail-extensions.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";

import {
  getQaSummary,
  getRecipeSummary,
  getReviewSummary,
  registerQaSummaryProvider,
  registerRecipeSummaryProvider,
  registerReviewSummaryProvider,
  resetProductDetailExtensionsForTesting,
} from "@/services/product-detail-extensions";

afterEach(() => {
  resetProductDetailExtensionsForTesting();
});

describe("product-detail-extensions", () => {
  it("returns null from every summary before a provider is registered", async () => {
    expect(await getReviewSummary("p1")).toBeNull();
    expect(await getQaSummary("p1")).toBeNull();
    expect(await getRecipeSummary("p1")).toBeNull();
  });

  it("returns the registered review summary provider's result", async () => {
    registerReviewSummaryProvider(async () => ({
      averageRating: 4.2,
      reviewCount: 10,
      previewReviews: [
        { id: "r1", authorName: "Kasun", rating: 5, title: "Great", body: "Loved it", createdAt: new Date() },
      ],
    }));

    expect((await getReviewSummary("p1"))?.averageRating).toBe(4.2);
  });

  it("returns the registered QA summary provider's result", async () => {
    registerQaSummaryProvider(async () => ({
      previewItems: [{ id: "q1", question: "Is it spicy?", answer: "Mildly", createdAt: new Date() }],
      totalCount: 1,
    }));

    expect((await getQaSummary("p1"))?.totalCount).toBe(1);
  });

  it("returns the registered recipe summary provider's result", async () => {
    registerRecipeSummaryProvider(async () => ({
      recipes: [{ id: "rec1", title: "Curry", slug: "curry", imageSrc: "/x.jpg" }],
    }));

    expect((await getRecipeSummary("p1"))?.recipes).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-detail-extensions`
Expected: FAIL — cannot find module `@/services/product-detail-extensions`

- [ ] **Step 3: Implement the extension-points module**

Create `src/services/product-detail-extensions.ts`:

```ts
export interface ReviewPreview {
  id: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
}
export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  previewReviews: ReviewPreview[];
}
export type GetReviewSummary = (productId: string) => Promise<ReviewSummary | null>;

export interface QaPreview {
  id: string;
  question: string;
  answer: string;
  createdAt: Date;
}
export interface QaSummary {
  previewItems: QaPreview[];
  totalCount: number;
}
export type GetQaSummary = (productId: string) => Promise<QaSummary | null>;

export interface RecipePreview {
  id: string;
  title: string;
  slug: string;
  imageSrc: string;
}
export interface RecipeSummary {
  recipes: RecipePreview[];
}
export type GetRecipeSummary = (productId: string) => Promise<RecipeSummary | null>;

let reviewSummaryProvider: GetReviewSummary = async () => null;
let qaSummaryProvider: GetQaSummary = async () => null;
let recipeSummaryProvider: GetRecipeSummary = async () => null;

/**
 * STORY-015 (Product Reviews & Ratings) calls this from its own service
 * module's init to plug real review data into the Product Detail Page,
 * without product.service.ts importing a module that doesn't exist yet.
 */
export function registerReviewSummaryProvider(provider: GetReviewSummary) {
  reviewSummaryProvider = provider;
}
export function getReviewSummary(productId: string) {
  return reviewSummaryProvider(productId);
}

/** STORY-016 (Product Q&A) — same contract as registerReviewSummaryProvider. */
export function registerQaSummaryProvider(provider: GetQaSummary) {
  qaSummaryProvider = provider;
}
export function getQaSummary(productId: string) {
  return qaSummaryProvider(productId);
}

/** Epic 04 (Recipes & Food Academy) — same contract as registerReviewSummaryProvider. */
export function registerRecipeSummaryProvider(provider: GetRecipeSummary) {
  recipeSummaryProvider = provider;
}
export function getRecipeSummary(productId: string) {
  return recipeSummaryProvider(productId);
}

/** Test-only: restores every provider to its default stub. */
export function resetProductDetailExtensionsForTesting() {
  reviewSummaryProvider = async () => null;
  qaSummaryProvider = async () => null;
  recipeSummaryProvider = async () => null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-detail-extensions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/product-detail-extensions.ts tests/unit/product-detail-extensions.test.ts
git commit -m "feat: add PDP extension points for reviews, Q&A, and recipes"
```

---

## Task 4: Validation Schemas

**Files:**
- Create: `src/validation/product-detail.schema.ts`
- Test: `tests/unit/product-detail-schema.test.ts`

**Interfaces:**
- Produces: `productSlugParamSchema` (Zod), `recentlyViewedItemSchema` (Zod), `type RecentlyViewedItem`
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-detail-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { productSlugParamSchema, recentlyViewedItemSchema } from "@/validation/product-detail.schema";

describe("productSlugParamSchema", () => {
  it("accepts a valid slug", () => {
    expect(productSlugParamSchema.parse({ slug: "roasted-curry-powder-100g" })).toEqual({
      slug: "roasted-curry-powder-100g",
    });
  });

  it("rejects an empty slug", () => {
    expect(() => productSlugParamSchema.parse({ slug: "" })).toThrow();
  });
});

describe("recentlyViewedItemSchema", () => {
  it("accepts a well-formed recently-viewed item", () => {
    const item = {
      id: "1",
      name: "Curry Powder",
      href: "/products/curry-powder",
      imageSrc: "/curry.jpg",
      imageAlt: "Curry Powder",
      price: 550,
      currency: "LKR",
      inStock: true,
    };

    expect(recentlyViewedItemSchema.parse(item)).toEqual(item);
  });

  it("rejects an item missing a required field", () => {
    expect(() => recentlyViewedItemSchema.parse({ id: "1", name: "Curry Powder" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-detail-schema`
Expected: FAIL — cannot find module `@/validation/product-detail.schema`

- [ ] **Step 3: Implement the schemas**

Create `src/validation/product-detail.schema.ts`:

```ts
import { z } from "zod";

export const productSlugParamSchema = z.object({
  slug: z.string().min(1),
});

export const recentlyViewedItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  href: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  price: z.number(),
  currency: z.string(),
  inStock: z.boolean(),
});

export type RecentlyViewedItem = z.infer<typeof recentlyViewedItemSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-detail-schema`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/validation/product-detail.schema.ts tests/unit/product-detail-schema.test.ts
git commit -m "feat: add slug param and recently-viewed item validation schemas"
```

---

## Task 5: Recently-Viewed Zustand Store

**Files:**
- Create: `src/lib/stores/recently-viewed-store.ts`
- Test: `tests/unit/recently-viewed-store.test.ts`

**Interfaces:**
- Produces: `useRecentlyViewedStore` — state `{ items: RecentlyViewedItem[] }`, action `add(item: RecentlyViewedItem): void`
- Consumes: `RecentlyViewedItem` from `@/validation/product-detail.schema` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/recently-viewed-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

function item(id: string): RecentlyViewedItem {
  return {
    id,
    name: `Product ${id}`,
    href: `/products/${id}`,
    imageSrc: "/x.jpg",
    imageAlt: "x",
    price: 100,
    currency: "LKR",
    inStock: true,
  };
}

describe("useRecentlyViewedStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("adds an item to the front of the list", () => {
    useRecentlyViewedStore.getState().add(item("1"));

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1"]);
  });

  it("moves a re-viewed item to the front instead of duplicating it", () => {
    useRecentlyViewedStore.getState().add(item("1"));
    useRecentlyViewedStore.getState().add(item("2"));
    useRecentlyViewedStore.getState().add(item("1"));

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("caps the list at 12 items", () => {
    for (let i = 0; i < 15; i++) useRecentlyViewedStore.getState().add(item(String(i)));

    expect(useRecentlyViewedStore.getState().items).toHaveLength(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- recently-viewed-store`
Expected: FAIL — cannot find module `@/lib/stores/recently-viewed-store`

- [ ] **Step 3: Implement the store**

Create `src/lib/stores/recently-viewed-store.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

const MAX_ITEMS = 12;

interface RecentlyViewedState {
  items: RecentlyViewedItem[];
  add: (item: RecentlyViewedItem) => void;
}

/**
 * Client-side "recently viewed products" tracking (STORY-011). Persisted
 * to localStorage so it survives reloads without requiring login. The
 * full wishlist/cart stores in this directory follow the same
 * count-or-list-in-localStorage pattern; extend this one rather than
 * introducing a second recently-viewed store.
 */
export const useRecentlyViewedStore = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const deduped = get().items.filter((existing) => existing.id !== item.id);
        set({ items: [item, ...deduped].slice(0, MAX_ITEMS) });
      },
    }),
    { name: "oristor-recently-viewed" },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- recently-viewed-store`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/recently-viewed-store.ts tests/unit/recently-viewed-store.test.ts
git commit -m "feat: add persisted recently-viewed products store"
```

---

## Task 6: Product Service — Aggregated Detail and Related Products

**Files:**
- Modify: `src/services/product.service.ts`
- Test: `tests/unit/product-detail-service.test.ts`

**Interfaces:**
- Produces: `ProductDetailImage`, `ProductDetailVideo`, `ProductDetailNutrition`, `ProductDetailIngredient`, `ProductDetailBundleItem`, `ProductDetail` (types)
- Produces: `getProductDetail(slug: string, opts?: { customerGroup?: CustomerGroup }): Promise<ProductDetail | null>`
- Produces: `listRelatedProducts(params: { productId: string; categoryIds: string[]; customerGroup?: CustomerGroup; limit?: number }): Promise<ProductListItem[]>`
- Produces (internal, exported for reuse only — not part of the public contract other tasks call): `toProductListItem`
- Consumes: `productRepository.findProductDetailBySlug`, `productRepository.findPublishedProductsForListing` (Task 1); `pricingService.resolvePrice`, `pricingService.resolvePricesForProducts`, `pricingService.getStandardPrice` (Task 2); `getReviewSummary`/`getQaSummary`/`getRecipeSummary` (Task 3); `categoryRepository.getCategoryAncestorPath` (Task 1).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/product-detail-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import {
  addProductIngredient,
  createBundle,
  createProduct,
  setProductNutrition,
} from "@/repositories/product.repository";
import { addBundleItem } from "@/repositories/product.repository";
import { createSalePrice, createStandardPrice } from "@/repositories/pricing.repository";
import { getProductDetail, listRelatedProducts } from "@/services/product.service";
import {
  registerReviewSummaryProvider,
  resetProductDetailExtensionsForTesting,
} from "@/services/product-detail-extensions";

afterEach(async () => {
  resetProductDetailExtensionsForTesting();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

describe("getProductDetail", () => {
  it("returns null for an unpublished or missing product", async () => {
    await createProduct({ sku: "PD-1", slug: "pd-draft", name: "Draft", status: "Draft" });

    expect(await getProductDetail("pd-draft")).toBeNull();
    expect(await getProductDetail("does-not-exist")).toBeNull();
  });

  it("returns null when no price is configured", async () => {
    await createProduct({ sku: "PD-2", slug: "pd-no-price", name: "No Price", status: "Published" });

    expect(await getProductDetail("pd-no-price")).toBeNull();
  });

  it("aggregates catalogue, nutrition, ingredients, and price for a published product", async () => {
    const product = await createProduct({
      sku: "PD-3",
      slug: "pd-full",
      name: "Full Product",
      shortDescription: "Short",
      story: "Long story",
      status: "Published",
      rewardPoints: 12,
      benefits: ["Benefit A"],
      servingSuggestions: ["Suggestion A"],
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
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
    await addProductIngredient({ product: { connect: { id: product.id } }, name: "Salt", sortOrder: 1 });

    const detail = await getProductDetail("pd-full");

    expect(detail?.name).toBe("Full Product");
    expect(detail?.price).toBe(500);
    expect(detail?.originalPrice).toBeNull();
    expect(detail?.rewardPoints).toBe(12);
    expect(detail?.benefits).toEqual(["Benefit A"]);
    expect(detail?.servingSuggestions).toEqual(["Suggestion A"]);
    expect(detail?.nutrition?.servingSize).toBe("1 tsp");
    expect(detail?.ingredients).toEqual([{ name: "Salt", isAllergen: false }]);
  });

  it("exposes the standard price as originalPrice when a discount tier applies", async () => {
    const product = await createProduct({ sku: "PD-4", slug: "pd-sale", name: "On Sale", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "1000.00" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "800.00",
      startDate: new Date(Date.now() - 1000 * 60 * 60),
      endDate: new Date(Date.now() + 1000 * 60 * 60),
    });

    const detail = await getProductDetail("pd-sale");

    expect(detail?.price).toBe(800);
    expect(detail?.originalPrice).toBe(1000);
  });

  it("defaults review/QA/recipe summaries to null before any provider registers", async () => {
    const product = await createProduct({ sku: "PD-5", slug: "pd-extensions", name: "Ext", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });

    const detail = await getProductDetail("pd-extensions");

    expect(detail?.reviewSummary).toBeNull();
    expect(detail?.qaSummary).toBeNull();
    expect(detail?.recipeSummary).toBeNull();
  });

  it("uses a registered review summary provider once one exists", async () => {
    const product = await createProduct({ sku: "PD-6", slug: "pd-reviews", name: "Reviewed", status: "Published" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
    registerReviewSummaryProvider(async () => ({ averageRating: 4.5, reviewCount: 3, previewReviews: [] }));

    const detail = await getProductDetail("pd-reviews");

    expect(detail?.reviewSummary?.averageRating).toBe(4.5);
  });

  it("renders bundle component items for a Bundle product type", async () => {
    const component = await createProduct({
      sku: "PD-COMP",
      slug: "pd-component",
      name: "Component",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: component.id } }, price: "50.00" });
    const bundleProduct = await createProduct({
      sku: "PD-BUNDLE",
      slug: "pd-bundle",
      name: "Bundle",
      productType: "Bundle",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: bundleProduct.id } }, price: "90.00" });
    const bundle = await createBundle({ product: { connect: { id: bundleProduct.id } } });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: component.id } },
      quantity: 2,
    });

    const detail = await getProductDetail("pd-bundle");

    expect(detail?.bundleItems).toEqual([
      { productId: component.id, name: "Component", slug: "pd-component", quantity: 2, imageSrc: "", imageAlt: "Component" },
    ]);
  });
});

describe("listRelatedProducts", () => {
  it("returns published products sharing a category, excluding the given product", async () => {
    const category = await createCategory({ name: "Spices", slug: "related-spices" });
    const self = await createProduct({
      sku: "REL-1",
      slug: "rel-1",
      name: "Self",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    const sibling = await createProduct({
      sku: "REL-2",
      slug: "rel-2",
      name: "Sibling",
      status: "Published",
      categories: { connect: [{ id: category.id }] },
    });
    await createStandardPrice({ product: { connect: { id: self.id } }, price: "100.00" });
    await createStandardPrice({ product: { connect: { id: sibling.id } }, price: "100.00" });

    const related = await listRelatedProducts({ productId: self.id, categoryIds: [category.id] });

    expect(related.map((p) => p.id)).toEqual([sibling.id]);
  });

  it("returns an empty array when the product has no categories", async () => {
    const related = await listRelatedProducts({ productId: "no-categories", categoryIds: [] });

    expect(related).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-detail-service`
Expected: FAIL — `getProductDetail`/`listRelatedProducts` not exported

- [ ] **Step 3: Extract `toProductListItem` and implement `listRelatedProducts` + `getProductDetail`**

In `src/services/product.service.ts`, first update the import list at the top to add the new dependency and type:

```ts
import type { CustomerGroup, ProductType } from "@/generated/prisma/client";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionService from "@/services/collection.service";
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
import {
  getQaSummary,
  getRecipeSummary,
  getReviewSummary,
  type QaSummary,
  type RecipeSummary,
  type ReviewSummary,
} from "@/services/product-detail-extensions";
import type { ProductListItem } from "@/types/product";
```

Replace the item-mapping block inside `listProducts` (the `const items: ProductListItem[] = pageCandidates.map(...)` block) with a call to a new shared helper, and add that helper plus everything else below `sortCandidates`:

```ts
  const items: ProductListItem[] = pageCandidates.map(({ product, price, currency }) =>
    toProductListItem(product, price, currency),
  );
```

Then, after the existing `sortCandidates` function at the bottom of the file, add:

```ts
function toProductListItem(
  product: {
    id: string;
    name: string;
    slug: string;
    images: Array<{ url: string; altText: string | null }>;
    inStock: boolean;
  },
  price: number,
  currency: string,
): ProductListItem {
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
}

export async function listRelatedProducts(params: {
  productId: string;
  categoryIds: string[];
  customerGroup?: CustomerGroup;
  limit?: number;
}): Promise<ProductListItem[]> {
  if (params.categoryIds.length === 0) return [];
  const limit = params.limit ?? 8;

  const candidates = await productRepository.findPublishedProductsForListing({
    categoryIds: params.categoryIds,
    excludeProductId: params.productId,
  });

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    candidates.map((candidate) => candidate.id),
    { customerGroup: params.customerGroup ?? "Retail" },
  );

  const items: ProductListItem[] = [];
  for (const candidate of candidates) {
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue;
    items.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
    if (items.length >= limit) break;
  }
  return items;
}

export interface ProductDetailImage {
  url: string;
  altText: string;
  isPrimary: boolean;
}
export interface ProductDetailVideo {
  url: string;
  altText: string;
}
export interface ProductDetailNutrition {
  servingSize: string;
  calories: number;
  protein: number;
  fat: number;
  saturatedFat: number;
  carbohydrates: number;
  sugar: number;
  fibre: number;
  sodium: number;
}
export interface ProductDetailIngredient {
  name: string;
  isAllergen: boolean;
}
export interface ProductDetailBundleItem {
  productId: string;
  name: string;
  slug: string;
  quantity: number;
  imageSrc: string;
  imageAlt: string;
}

export interface ProductDetail {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  story: string | null;
  benefits: string[];
  servingSuggestions: string[];
  productType: ProductType;
  inStock: boolean;
  rewardPoints: number;
  images: ProductDetailImage[];
  videos: ProductDetailVideo[];
  nutrition: ProductDetailNutrition | null;
  ingredients: ProductDetailIngredient[];
  allergenNames: string[];
  certificationNames: string[];
  bundleItems: ProductDetailBundleItem[];
  price: number;
  originalPrice: number | null;
  currency: string;
  categoryPath: categoryRepository.CategoryPathItem[];
  relatedProducts: ProductListItem[];
  reviewSummary: ReviewSummary | null;
  qaSummary: QaSummary | null;
  recipeSummary: RecipeSummary | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
}

export async function getProductDetail(
  slug: string,
  opts: { customerGroup?: CustomerGroup } = {},
): Promise<ProductDetail | null> {
  const product = await productRepository.findProductDetailBySlug(slug);
  if (!product || product.status !== "Published") return null;

  const categoryIds = product.categories.map((category) => category.id);

  const [resolvedPrice, relatedProducts, reviewSummary, qaSummary, recipeSummary] = await Promise.all([
    pricingService.resolvePrice({ productId: product.id, customerGroup: opts.customerGroup ?? "Retail" }),
    listRelatedProducts({ productId: product.id, categoryIds, customerGroup: opts.customerGroup }),
    getReviewSummary(product.id),
    getQaSummary(product.id),
    getRecipeSummary(product.id),
  ]);

  if (!resolvedPrice) return null;

  let originalPrice: number | null = null;
  if (resolvedPrice.tier !== "standard") {
    const standard = await pricingService.getStandardPrice(product.id);
    if (standard && standard.price > resolvedPrice.price.toNumber()) {
      originalPrice = standard.price;
    }
  }

  const categoryPath = product.categories[0]
    ? await categoryRepository.getCategoryAncestorPath(product.categories[0].id)
    : [];

  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    story: product.story,
    benefits: product.benefits,
    servingSuggestions: product.servingSuggestions,
    productType: product.productType,
    inStock: product.inStock,
    rewardPoints: product.rewardPoints,
    images: product.images.map((image) => ({
      url: image.url,
      altText: image.altText ?? product.name,
      isPrimary: image.isPrimary,
    })),
    videos: product.videos.map((video) => ({ url: video.url, altText: video.altText ?? product.name })),
    nutrition: product.nutrition
      ? {
          servingSize: product.nutrition.servingSize,
          calories: product.nutrition.calories.toNumber(),
          protein: product.nutrition.protein.toNumber(),
          fat: product.nutrition.fat.toNumber(),
          saturatedFat: product.nutrition.saturatedFat.toNumber(),
          carbohydrates: product.nutrition.carbohydrates.toNumber(),
          sugar: product.nutrition.sugar.toNumber(),
          fibre: product.nutrition.fibre.toNumber(),
          sodium: product.nutrition.sodium.toNumber(),
        }
      : null,
    ingredients: product.ingredients.map((ingredient) => ({
      name: ingredient.name,
      isAllergen: ingredient.isAllergen,
    })),
    allergenNames: product.allergens.map((allergen) => allergen.name),
    certificationNames: product.certifications.map((certification) => certification.name),
    bundleItems: (product.bundle?.items ?? []).map((item) => ({
      productId: item.componentProductId,
      name: item.componentProduct.name,
      slug: item.componentProduct.slug,
      quantity: item.quantity,
      imageSrc: item.componentProduct.images[0]?.url ?? "",
      imageAlt: item.componentProduct.images[0]?.altText ?? item.componentProduct.name,
    })),
    price: resolvedPrice.price.toNumber(),
    originalPrice,
    currency: resolvedPrice.currency,
    categoryPath,
    relatedProducts,
    reviewSummary,
    qaSummary,
    recipeSummary,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    canonicalUrl: product.canonicalUrl,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-detail-service product-service`
Expected: PASS for both files (re-running `product-service.test.ts` confirms the `toProductListItem` extraction didn't change `listProducts`'s behavior)

- [ ] **Step 5: Commit**

```bash
git add src/services/product.service.ts tests/unit/product-detail-service.test.ts
git commit -m "feat: add getProductDetail aggregation and listRelatedProducts"
```

---

## Task 7: Product Detail API Route

**Files:**
- Create: `src/app/api/products/[slug]/route.ts`
- Test: `tests/unit/product-detail-route.test.ts`

**Interfaces:**
- Produces: `GET(request: Request, { params }: { params: Promise<{ slug: string }> })` returning the `ProductDetail` JSON payload with status 200, or `{ error: string }` with status 404.
- Consumes: `getProductDetail` (Task 6), `productSlugParamSchema` (Task 4).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-detail-route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { GET } from "@/app/api/products/[slug]/route";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("GET /api/products/[slug]", () => {
  it("returns the product detail payload for a published product", async () => {
    const product = await createProduct({
      sku: "DETAIL-ROUTE-1",
      slug: "detail-route-product",
      name: "Detail Route Product",
      status: "Published",
    });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });

    const response = await GET(new Request("http://localhost/api/products/detail-route-product"), {
      params: Promise.resolve({ slug: "detail-route-product" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe("Detail Route Product");
    expect(body.price).toBe(450);
  });

  it("returns 404 for an unknown slug", async () => {
    const response = await GET(new Request("http://localhost/api/products/does-not-exist"), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-detail-route`
Expected: FAIL — cannot find module `@/app/api/products/[slug]/route`

- [ ] **Step 3: Implement the route handler**

Create `src/app/api/products/[slug]/route.ts`:

```ts
import { NextResponse } from "next/server";

import { getProductDetail } from "@/services/product.service";
import { productSlugParamSchema } from "@/validation/product-detail.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = productSlugParamSchema.parse(await params);

  const product = await getProductDetail(slug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-detail-route`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/[slug]/route.ts tests/unit/product-detail-route.test.ts
git commit -m "feat: add GET /api/products/[slug] route handler"
```

---

## Task 8: Dialog Primitive and Product Gallery

**Files:**
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/storefront/product/product-gallery.tsx`
- Test: `tests/unit/product-gallery.test.tsx`

**Interfaces:**
- Produces: `Dialog`, `DialogTrigger`, `DialogClose`, `DialogContent` (generic centered-modal primitive, mirrors `src/components/ui/sheet.tsx`'s structure on the same `@base-ui/react/dialog` package).
- Produces: `ProductGallery({ images: ProductDetailImage[]; videos?: ProductDetailVideo[]; productName: string })` — images and videos render as one combined slideshow (images first, then videos), satisfying STORY-011's "Image/video gallery" acceptance criterion.
- Consumes: `ProductDetailImage`, `ProductDetailVideo` types (Task 6).

Note: matching this codebase's existing convention (`Sheet`/`Button`/`Badge` have no dedicated Vitest file — their interactive/portal behavior is verified through the components that consume them, in Playwright), `dialog.tsx` itself gets no standalone unit test. `ProductGallery`'s lightbox open/close is instead covered by Task 15's Playwright e2e test; this task's Vitest test covers only what's reliably assertable in jsdom (image/thumbnail rendering).

- [ ] **Step 1: Implement the Dialog primitive**

Create `src/components/ui/dialog.tsx`:

```tsx
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/70 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-auto bg-popover bg-clip-padding p-4 text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-95 data-starting-style:scale-95 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

export { Dialog, DialogTrigger, DialogClose, DialogContent }
```

- [ ] **Step 2: Write the failing test for ProductGallery**

Create `tests/unit/product-gallery.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductGallery } from "@/components/storefront/product/product-gallery";

const images = [
  { url: "/primary.jpg", altText: "Primary", isPrimary: true },
  { url: "/secondary.jpg", altText: "Secondary", isPrimary: false },
];

describe("ProductGallery", () => {
  it("renders the primary image and one thumbnail per image", () => {
    render(<ProductGallery images={images} productName="Curry Powder" />);

    // The primary image is rendered twice: once as the main display image,
    // once as its own thumbnail.
    expect(screen.getAllByAltText("Primary")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Show image 1 of 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show image 2 of 2" })).toBeInTheDocument();
  });

  it("does not render a thumbnail row for a single image", () => {
    render(<ProductGallery images={[images[0]]} productName="Curry Powder" />);

    expect(screen.queryByRole("button", { name: /Show image/ })).not.toBeInTheDocument();
  });

  it("includes videos in the gallery alongside images", () => {
    render(
      <ProductGallery
        images={[images[0]]}
        videos={[{ url: "/demo.mp4", altText: "Demo video" }]}
        productName="Curry Powder"
      />,
    );

    expect(screen.getByRole("button", { name: "Show video 2 of 2" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- product-gallery`
Expected: FAIL — cannot find module `@/components/storefront/product/product-gallery`

- [ ] **Step 4: Implement ProductGallery**

Create `src/components/storefront/product/product-gallery.tsx`:

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { ProductDetailImage, ProductDetailVideo } from "@/services/product.service";

interface GallerySlide {
  type: "image" | "video";
  url: string;
  altText: string;
}

interface ProductGalleryProps {
  images: ProductDetailImage[];
  videos?: ProductDetailVideo[];
  productName: string;
}

export function ProductGallery({ images, videos = [], productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides: GallerySlide[] = [
    ...images.map((image) => ({ type: "image" as const, url: image.url, altText: image.altText })),
    ...videos.map((video) => ({ type: "video" as const, url: video.url, altText: video.altText })),
  ];
  const gallery: GallerySlide[] =
    slides.length > 0 ? slides : [{ type: "image", url: "", altText: productName }];
  const active = gallery[activeIndex];

  return (
    <div>
      <Dialog>
        <DialogTrigger
          className="relative block aspect-square w-full overflow-hidden rounded-lg bg-cream"
          aria-label={`Zoom in on ${active.altText}`}
        >
          {active.type === "video" ? (
            <video src={active.url} className="size-full object-contain p-6" muted playsInline />
          ) : (
            <Image
              src={active.url}
              alt={active.altText}
              fill
              sizes="(min-width: 1024px) 40vw, 90vw"
              className="object-contain p-6"
            />
          )}
        </DialogTrigger>
        <DialogContent aria-label={`${productName} media, enlarged`}>
          {active.type === "video" ? (
            <video src={active.url} className="max-h-[80vh] w-full" controls autoPlay />
          ) : (
            <div className="relative aspect-square w-full">
              <Image src={active.url} alt={active.altText} fill sizes="90vw" className="object-contain" />
            </div>
          )}
        </DialogContent>
      </Dialog>
      {gallery.length > 1 && (
        <div className="mt-3 flex gap-2">
          {gallery.map((slide, index) => (
            <button
              key={slide.url + index}
              type="button"
              aria-label={`Show ${slide.type === "video" ? "video" : "image"} ${index + 1} of ${gallery.length}`}
              aria-current={index === activeIndex}
              onClick={() => setActiveIndex(index)}
              className={
                index === activeIndex
                  ? "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-charcoal bg-cream"
                  : "relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-transparent bg-cream"
              }
            >
              {slide.type === "video" ? (
                <Play className="size-5 text-charcoal" aria-hidden="true" />
              ) : (
                <Image src={slide.url} alt={slide.altText} fill sizes="64px" className="object-contain p-1" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- product-gallery`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/storefront/product/product-gallery.tsx tests/unit/product-gallery.test.tsx
git commit -m "feat: add Dialog primitive and ProductGallery lightbox"
```

---

## Task 9: Nutrition, Ingredients, and Bullet-List Components

**Files:**
- Create: `src/components/storefront/product/nutrition-table.tsx`
- Create: `src/components/storefront/product/ingredients-list.tsx`
- Create: `src/components/storefront/product/bullet-list.tsx`
- Test: `tests/unit/nutrition-table.test.tsx`
- Test: `tests/unit/ingredients-list.test.tsx`
- Test: `tests/unit/bullet-list.test.tsx`

**Interfaces:**
- Produces: `NutritionTable({ nutrition: ProductDetailNutrition })`
- Produces: `IngredientsList({ ingredients: ProductDetailIngredient[] })`
- Produces: `BulletList({ heading: string; items: string[] })` — shared by the Benefits and Serving Suggestions sections (DRY: one bullet-rendering component instead of two near-identical ones).
- Consumes: `ProductDetailNutrition`, `ProductDetailIngredient` types (Task 6).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/nutrition-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NutritionTable } from "@/components/storefront/product/nutrition-table";

const nutrition = {
  servingSize: "1 tsp (5g)",
  calories: 18,
  protein: 0.8,
  fat: 0.7,
  saturatedFat: 0.1,
  carbohydrates: 2.5,
  sugar: 0.3,
  fibre: 1.1,
  sodium: 2,
};

describe("NutritionTable", () => {
  it("renders the serving size and every nutrient row", () => {
    render(<NutritionTable nutrition={nutrition} />);

    expect(screen.getByText("Serving size: 1 tsp (5g)")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByText("18 kcal")).toBeInTheDocument();
    expect(screen.getByText("Sodium")).toBeInTheDocument();
    expect(screen.getByText("2 mg")).toBeInTheDocument();
  });
});
```

Create `tests/unit/ingredients-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { IngredientsList } from "@/components/storefront/product/ingredients-list";

describe("IngredientsList", () => {
  it("renders each ingredient in order and flags allergens", () => {
    render(
      <IngredientsList
        ingredients={[
          { name: "Coriander", isAllergen: false },
          { name: "Peanuts", isAllergen: true },
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Coriander");
    expect(items[1]).toHaveTextContent("Peanuts");
    expect(items[1]).toHaveTextContent("(allergen)");
    expect(items[0]).not.toHaveTextContent("(allergen)");
  });

  it("renders nothing for an empty ingredient list", () => {
    const { container } = render(<IngredientsList ingredients={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `tests/unit/bullet-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BulletList } from "@/components/storefront/product/bullet-list";

describe("BulletList", () => {
  it("renders the heading and every item", () => {
    render(<BulletList heading="Benefits" items={["Rich in fibre", "No preservatives"]} />);

    expect(screen.getByText("Benefits")).toBeInTheDocument();
    expect(screen.getByText("Rich in fibre")).toBeInTheDocument();
    expect(screen.getByText("No preservatives")).toBeInTheDocument();
  });

  it("renders nothing for an empty item list", () => {
    const { container } = render(<BulletList heading="Benefits" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- nutrition-table ingredients-list bullet-list`
Expected: FAIL — cannot find the three component modules

- [ ] **Step 3: Implement the three components**

Create `src/components/storefront/product/nutrition-table.tsx`:

```tsx
import type { ProductDetailNutrition } from "@/services/product.service";

const NUTRIENT_ROWS: Array<{ key: keyof Omit<ProductDetailNutrition, "servingSize">; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
  { key: "saturatedFat", label: "Saturated Fat", unit: "g" },
  { key: "carbohydrates", label: "Carbohydrates", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "fibre", label: "Fibre", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];

export function NutritionTable({ nutrition }: { nutrition: ProductDetailNutrition }) {
  return (
    <table className="w-full text-small text-charcoal">
      <caption className="mb-2 text-left font-medium">Serving size: {nutrition.servingSize}</caption>
      <tbody>
        {NUTRIENT_ROWS.map((row) => (
          <tr key={row.key} className="border-b border-charcoal/10">
            <th scope="row" className="py-1.5 text-left font-normal text-charcoal/70">
              {row.label}
            </th>
            <td className="py-1.5 text-right font-number">{`${nutrition[row.key]} ${row.unit}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `src/components/storefront/product/ingredients-list.tsx`:

```tsx
import type { ProductDetailIngredient } from "@/services/product.service";

export function IngredientsList({ ingredients }: { ingredients: ProductDetailIngredient[] }) {
  if (ingredients.length === 0) return null;
  return (
    <ul className="list-inside list-disc space-y-1 text-small text-charcoal">
      {ingredients.map((ingredient) => (
        <li key={ingredient.name} className={ingredient.isAllergen ? "font-medium text-destructive" : undefined}>
          {ingredient.name}
          {ingredient.isAllergen && <span className="ml-1 text-caption">(allergen)</span>}
        </li>
      ))}
    </ul>
  );
}
```

Create `src/components/storefront/product/bullet-list.tsx`:

```tsx
export function BulletList({ heading, items }: { heading: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-h4 font-heading text-charcoal">{heading}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-small text-charcoal">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- nutrition-table ingredients-list bullet-list`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/product/nutrition-table.tsx src/components/storefront/product/ingredients-list.tsx src/components/storefront/product/bullet-list.tsx tests/unit/nutrition-table.test.tsx tests/unit/ingredients-list.test.tsx tests/unit/bullet-list.test.tsx
git commit -m "feat: add PDP nutrition, ingredients, and bullet-list components"
```

---

## Task 10: Share Buttons and Breadcrumbs

**Files:**
- Create: `src/components/storefront/product/share-buttons.tsx`
- Create: `src/components/storefront/layout/breadcrumbs.tsx`
- Test: `tests/unit/share-buttons.test.tsx`
- Test: `tests/unit/breadcrumbs.test.tsx`

**Interfaces:**
- Produces: `ShareButtons({ url: string; title: string })`
- Produces: `BreadcrumbItem { name: string; href: string }`, `Breadcrumbs({ items: BreadcrumbItem[] })`
- Consumes: `Button` (`@/components/ui/button`, existing).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/share-buttons.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShareButtons } from "@/components/storefront/product/share-buttons";

describe("ShareButtons", () => {
  it("copies the product URL to the clipboard and shows confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const user = userEvent.setup();

    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith("https://oristor.com/products/curry-powder");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied!"));
  });

  it("builds correct share links for WhatsApp, Facebook, X, and email", () => {
    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);

    expect(screen.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me"),
    );
    expect(screen.getByRole("link", { name: "Share on Facebook" })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/sharer"),
    );
    expect(screen.getByRole("link", { name: "Share on X" })).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet"),
    );
    expect(screen.getByRole("link", { name: "Share by email" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:"),
    );
  });
});
```

Create `tests/unit/breadcrumbs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders each item as a link except the last, which is the current page", () => {
    render(
      <Breadcrumbs
        items={[
          { name: "Spices", href: "/products/spices" },
          { name: "Curry Powder", href: "/products/curry-powder" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Spices" })).toHaveAttribute("href", "/products/spices");
    expect(screen.getByText("Curry Powder")).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- share-buttons breadcrumbs`
Expected: FAIL — cannot find the two component modules

- [ ] **Step 3: Implement ShareButtons**

Create `src/components/storefront/product/share-buttons.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Copy, Mail, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FacebookIcon } from "@/components/storefront/layout/social-icons";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon-sm" onClick={handleCopy} aria-label="Copy link">
        <Copy />
      </Button>
      {copied && (
        <span role="status" className="text-caption text-charcoal/70">
          Copied!
        </span>
      )}
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        aria-label="Share on WhatsApp"
        render={
          <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" />
        }
      >
        <MessageCircle />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        aria-label="Share on Facebook"
        render={
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        <FacebookIcon className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        aria-label="Share on X"
        render={
          <a
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
          />
        }
      >
        X
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        nativeButton={false}
        aria-label="Share by email"
        render={<a href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`} />}
      >
        <Mail />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Implement Breadcrumbs**

Create `src/components/storefront/layout/breadcrumbs.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  name: string;
  href: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1.5 text-caption text-charcoal/70">
        <li>
          <Link href="/" className="hover:text-charcoal">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5" aria-hidden="true" />
            {index === items.length - 1 ? (
              <span aria-current="page" className="text-charcoal">
                {item.name}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-charcoal">
                {item.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- share-buttons breadcrumbs`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/product/share-buttons.tsx src/components/storefront/layout/breadcrumbs.tsx tests/unit/share-buttons.test.tsx tests/unit/breadcrumbs.test.tsx
git commit -m "feat: add ShareButtons and Breadcrumbs components"
```

---

## Task 11: Product JSON-LD

**Files:**
- Create: `src/components/storefront/product/product-json-ld.tsx`
- Test: `tests/unit/product-json-ld.test.tsx`

**Interfaces:**
- Produces: `ProductJsonLd(props: { name: string; description: string | null; imageUrls: string[]; sku: string; price: number; currency: string; inStock: boolean; url: string; averageRating?: number; reviewCount?: number })`
- Consumes: nothing new (mirrors `item-list-json-ld.tsx`'s existing pattern from STORY-010).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-json-ld.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductJsonLd } from "@/components/storefront/product/product-json-ld";

describe("ProductJsonLd", () => {
  it("renders a schema.org Product script with offer details", () => {
    const { container } = render(
      <ProductJsonLd
        name="Curry Powder"
        description="Roasted curry powder"
        imageUrls={["/curry.jpg"]}
        sku="SKU-1"
        price={650}
        currency="LKR"
        inStock={true}
        url="https://oristor.com/products/curry-powder"
      />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script?.innerHTML ?? "{}");

    expect(json["@type"]).toBe("Product");
    expect(json.sku).toBe("SKU-1");
    expect(json.offers.price).toBe(650);
    expect(json.offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock availability correctly", () => {
    const { container } = render(
      <ProductJsonLd
        name="Curry Powder"
        description={null}
        imageUrls={[]}
        sku="SKU-1"
        price={650}
        currency="LKR"
        inStock={false}
        url="https://oristor.com/products/curry-powder"
      />,
    );

    const script = container.querySelector('script[type="application/ld+json"]');
    const json = JSON.parse(script?.innerHTML ?? "{}");

    expect(json.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-json-ld`
Expected: FAIL — cannot find module `@/components/storefront/product/product-json-ld`

- [ ] **Step 3: Implement ProductJsonLd**

Create `src/components/storefront/product/product-json-ld.tsx`:

```tsx
interface ProductJsonLdProps {
  name: string;
  description: string | null;
  imageUrls: string[];
  sku: string;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
  averageRating?: number;
  reviewCount?: number;
}

/**
 * `JSON.stringify` doesn't escape `<`, so a product name or story
 * containing `</script><script>` could break out of this block —
 * replacing `<` with its unicode escape neutralizes that without
 * affecting the parsed JSON. Same technique as ItemListJsonLd (STORY-010).
 */
export function ProductJsonLd(props: ProductJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: props.name,
    description: props.description ?? undefined,
    image: props.imageUrls,
    sku: props.sku,
    url: props.url,
    offers: {
      "@type": "Offer",
      price: props.price,
      priceCurrency: props.currency,
      availability: props.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(props.averageRating !== undefined && props.reviewCount !== undefined
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: props.averageRating,
            reviewCount: props.reviewCount,
          },
        }
      : {}),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-json-ld`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/product/product-json-ld.tsx tests/unit/product-json-ld.test.tsx
git commit -m "feat: add Product JSON-LD structured data component"
```

---

## Task 12: Related and Recently-Viewed Product Sections

**Files:**
- Create: `src/components/storefront/product/related-products.tsx`
- Create: `src/components/storefront/product/recently-viewed.tsx`
- Test: `tests/unit/related-products.test.tsx`
- Test: `tests/unit/recently-viewed.test.tsx`

**Interfaces:**
- Produces: `RelatedProducts({ products: ProductListItem[] })`
- Produces: `TrackRecentlyViewed({ product: RecentlyViewedItem })` — client component, side-effect only, renders nothing.
- Produces: `RecentlyViewed({ excludeProductId: string })`
- Consumes: `ProductCard` (existing, STORY-010), `useRecentlyViewedStore` (Task 5), `RecentlyViewedItem` type (Task 4).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/related-products.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RelatedProducts } from "@/components/storefront/product/related-products";
import type { ProductListItem } from "@/types/product";

const product: ProductListItem = {
  id: "1",
  name: "Chilli Powder",
  href: "/products/chilli-powder",
  imageSrc: "/chilli.jpg",
  imageAlt: "Chilli Powder",
  price: 480,
  currency: "LKR",
  inStock: true,
};

describe("RelatedProducts", () => {
  it("renders a heading and a card per related product", () => {
    render(<RelatedProducts products={[product]} />);

    expect(screen.getByText("You May Also Like")).toBeInTheDocument();
    expect(screen.getByText("Chilli Powder")).toBeInTheDocument();
  });

  it("renders nothing when there are no related products", () => {
    const { container } = render(<RelatedProducts products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

Create `tests/unit/recently-viewed.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { RecentlyViewed, TrackRecentlyViewed } from "@/components/storefront/product/recently-viewed";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

function item(id: string): RecentlyViewedItem {
  return {
    id,
    name: `Product ${id}`,
    href: `/products/${id}`,
    imageSrc: "/x.jpg",
    imageAlt: "x",
    price: 100,
    currency: "LKR",
    inStock: true,
  };
}

describe("TrackRecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("adds the viewed product to the store on mount", () => {
    render(<TrackRecentlyViewed product={item("1")} />);

    expect(useRecentlyViewedStore.getState().items.map((i) => i.id)).toEqual(["1"]);
  });
});

describe("RecentlyViewed", () => {
  beforeEach(() => {
    localStorage.clear();
    useRecentlyViewedStore.setState({ items: [] });
  });

  it("renders nothing when there are no recently viewed products", () => {
    const { container } = render(<RecentlyViewed excludeProductId="none" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders recently viewed products, excluding the current product", () => {
    useRecentlyViewedStore.setState({ items: [item("1"), item("2")] });

    render(<RecentlyViewed excludeProductId="1" />);

    expect(screen.getByText("Product 2")).toBeInTheDocument();
    expect(screen.queryByText("Product 1")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- related-products recently-viewed`
Expected: FAIL — cannot find the two component modules

- [ ] **Step 3: Implement RelatedProducts**

Create `src/components/storefront/product/related-products.tsx`:

```tsx
import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

export function RelatedProducts({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;
  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">You May Also Like</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement TrackRecentlyViewed and RecentlyViewed**

Create `src/components/storefront/product/recently-viewed.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { ProductCard } from "@/components/storefront/product/product-card";
import { useRecentlyViewedStore } from "@/lib/stores/recently-viewed-store";
import type { RecentlyViewedItem } from "@/validation/product-detail.schema";

export function TrackRecentlyViewed({ product }: { product: RecentlyViewedItem }) {
  const add = useRecentlyViewedStore((state) => state.add);

  useEffect(() => {
    add(product);
  }, [add, product.id]);

  return null;
}

export function RecentlyViewed({ excludeProductId }: { excludeProductId: string }) {
  const items = useRecentlyViewedStore((state) => state.items).filter(
    (item) => item.id !== excludeProductId,
  );

  if (items.length === 0) return null;

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Recently Viewed</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- related-products recently-viewed`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/product/related-products.tsx src/components/storefront/product/recently-viewed.tsx tests/unit/related-products.test.tsx tests/unit/recently-viewed.test.tsx
git commit -m "feat: add RelatedProducts and RecentlyViewed sections"
```

---

## Task 13: Product Actions (Add-to-Cart and Wishlist Stubs)

**Files:**
- Create: `src/hooks/use-add-to-cart.ts`
- Create: `src/hooks/use-wishlist.ts`
- Create: `src/components/storefront/product/product-actions.tsx`
- Test: `tests/unit/product-actions.test.tsx`

**Interfaces:**
- Produces: `useAddToCart(productId: string): { isAvailable: boolean; addToCart: (quantity?: number) => void }` — stub until STORY-024 (Shopping Cart) ships.
- Produces: `useWishlist(productId: string): { isWishlisted: boolean; isAvailable: boolean; toggle: () => void }` — stub until STORY-013 (Wishlist) ships.
- Produces: `ProductActions({ productId: string; inStock: boolean })`
- Consumes: `Button` (existing).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/product-actions.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductActions } from "@/components/storefront/product/product-actions";

describe("ProductActions", () => {
  it("shows an Out of Stock label and disables Add to Cart when out of stock", () => {
    render(<ProductActions productId="p1" inStock={false} />);

    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });

  it("disables the wishlist toggle until STORY-013 provides a real implementation", () => {
    render(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to wishlist" })).toBeDisabled();
  });

  it("disables Add to Cart even when in stock, until STORY-024 provides a real implementation", () => {
    render(<ProductActions productId="p1" inStock={true} />);

    expect(screen.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- product-actions`
Expected: FAIL — cannot find module `@/components/storefront/product/product-actions`

- [ ] **Step 3: Implement the stub hooks and ProductActions**

Create `src/hooks/use-add-to-cart.ts`:

```ts
export interface UseAddToCartResult {
  isAvailable: boolean;
  addToCart: (quantity?: number) => void;
}

/**
 * Stub until STORY-024 (Shopping Cart) lands — always reports unavailable
 * so the PDP renders a disabled control instead of a fake add-to-cart.
 * Replace this implementation (not its call sites) when STORY-024 ships.
 */
export function useAddToCart(_productId: string): UseAddToCartResult {
  return { isAvailable: false, addToCart: () => {} };
}
```

Create `src/hooks/use-wishlist.ts`:

```ts
export interface UseWishlistResult {
  isWishlisted: boolean;
  isAvailable: boolean;
  toggle: () => void;
}

/**
 * Stub until STORY-013 (Wishlist) lands — same contract/rationale as
 * useAddToCart. Replace this implementation (not its call sites).
 */
export function useWishlist(_productId: string): UseWishlistResult {
  return { isWishlisted: false, isAvailable: false, toggle: () => {} };
}
```

Create `src/components/storefront/product/product-actions.tsx`:

```tsx
"use client";

import { Heart, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAddToCart } from "@/hooks/use-add-to-cart";
import { useWishlist } from "@/hooks/use-wishlist";

interface ProductActionsProps {
  productId: string;
  inStock: boolean;
}

export function ProductActions({ productId, inStock }: ProductActionsProps) {
  const cart = useAddToCart(productId);
  const wishlist = useWishlist(productId);

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="lg"
        disabled={!inStock || !cart.isAvailable}
        onClick={() => cart.addToCart()}
      >
        <ShoppingCart /> {inStock ? "Add to Cart" : "Out of Stock"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        disabled={!wishlist.isAvailable}
        aria-pressed={wishlist.isWishlisted}
        aria-label={wishlist.isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        onClick={wishlist.toggle}
      >
        <Heart className={wishlist.isWishlisted ? "fill-current" : undefined} />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- product-actions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-add-to-cart.ts src/hooks/use-wishlist.ts src/components/storefront/product/product-actions.tsx tests/unit/product-actions.test.tsx
git commit -m "feat: add ProductActions with add-to-cart/wishlist stubs"
```

---

## Task 14: Product Detail Page Route

**Files:**
- Create: `src/app/(storefront)/products/[slug]/page.tsx`

**Interfaces:**
- Produces: `generateMetadata`, default export `ProductDetailPage` — the full PDP composition.
- Consumes: everything from Tasks 6, 8–13 plus existing `Section` (STORY-006).

This task has no new Vitest test: this codebase doesn't unit-test page-level Server Components (see `src/app/(storefront)/products/page.tsx` and `[category]/page.tsx` — neither has a corresponding `tests/unit` file; they're covered by Playwright instead, which Task 15 adds for this page). Every piece this page assembles was already unit-tested in its own task.

- [ ] **Step 1: Implement the page**

Create `src/app/(storefront)/products/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { BulletList } from "@/components/storefront/product/bullet-list";
import { IngredientsList } from "@/components/storefront/product/ingredients-list";
import { NutritionTable } from "@/components/storefront/product/nutrition-table";
import { ProductActions } from "@/components/storefront/product/product-actions";
import { ProductGallery } from "@/components/storefront/product/product-gallery";
import { ProductJsonLd } from "@/components/storefront/product/product-json-ld";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/storefront/product/recently-viewed";
import { RelatedProducts } from "@/components/storefront/product/related-products";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { getProductDetail } from "@/services/product.service";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return {};

  return {
    title: product.metaTitle ?? product.name,
    description: product.metaDescription ?? product.shortDescription ?? undefined,
    alternates: product.canonicalUrl ? { canonical: product.canonicalUrl } : undefined,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();

  const pageUrl = `${SITE_URL}/products/${product.slug}`;

  return (
    <Section>
      <ProductJsonLd
        name={product.name}
        description={product.shortDescription}
        imageUrls={product.images.map((image) => image.url)}
        sku={product.sku}
        price={product.price}
        currency={product.currency}
        inStock={product.inStock}
        url={pageUrl}
        averageRating={product.reviewSummary?.averageRating}
        reviewCount={product.reviewSummary?.reviewCount}
      />
      <TrackRecentlyViewed
        product={{
          id: product.id,
          name: product.name,
          href: `/products/${product.slug}`,
          imageSrc: product.images[0]?.url ?? "",
          imageAlt: product.images[0]?.altText ?? product.name,
          price: product.price,
          currency: product.currency,
          inStock: product.inStock,
        }}
      />
      <Breadcrumbs
        items={[
          ...product.categoryPath.map((category) => ({
            name: category.name,
            href: `/products/${category.slug}`,
          })),
          { name: product.name, href: `/products/${product.slug}` },
        ]}
      />

      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} videos={product.videos} productName={product.name} />

        <div>
          <h1 className="text-h1 font-heading text-charcoal">{product.name}</h1>
          <div className="mt-2 flex items-center gap-2 font-number text-h3 text-charcoal">
            <span>
              {product.currency} {product.price.toLocaleString()}
            </span>
            {product.originalPrice && (
              <span className="text-body text-charcoal/50 line-through">
                {product.currency} {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
          <p className="mt-1 text-caption text-charcoal/70">
            Earn {product.rewardPoints} reward points with this purchase
          </p>
          <p className="mt-1 text-small text-charcoal/70">
            {product.inStock ? "In stock — ships within 2-3 business days" : "Currently out of stock"}
          </p>

          <div className="mt-6">
            <ProductActions productId={product.id} inStock={product.inStock} />
          </div>

          {product.story && <p className="mt-6 text-body text-charcoal">{product.story}</p>}

          {product.bundleItems.length > 0 && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">This bundle includes</h2>
              <ul className="mt-2 space-y-1 text-small text-charcoal">
                {product.bundleItems.map((item) => (
                  <li key={item.productId}>
                    {item.quantity} x {item.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6">
            <BulletList heading="Benefits" items={product.benefits} />
          </div>
          <div className="mt-6">
            <BulletList heading="Serving Suggestions" items={product.servingSuggestions} />
          </div>

          {product.nutrition && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">Nutrition Facts</h2>
              <div className="mt-2">
                <NutritionTable nutrition={product.nutrition} />
              </div>
            </div>
          )}

          {product.ingredients.length > 0 && (
            <div className="mt-6">
              <h2 className="text-h4 font-heading text-charcoal">Ingredients</h2>
              <div className="mt-2">
                <IngredientsList ingredients={product.ingredients} />
              </div>
            </div>
          )}

          <div className="mt-6">
            <ShareButtons url={pageUrl} title={product.name} />
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Recipes Using This Product</h2>
        {product.recipeSummary && product.recipeSummary.recipes.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {product.recipeSummary.recipes.map((recipe) => (
              <a key={recipe.id} href={`/recipes/${recipe.slug}`} className="block text-small text-charcoal">
                {recipe.title}
              </a>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">Recipes for this product are coming soon.</p>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Customer Reviews</h2>
        {product.reviewSummary ? (
          <div className="mt-4">
            <p className="font-number text-body text-charcoal">
              {product.reviewSummary.averageRating.toFixed(1)} / 5 ({product.reviewSummary.reviewCount} reviews)
            </p>
            <ul className="mt-4 space-y-4">
              {product.reviewSummary.previewReviews.map((review) => (
                <li key={review.id} className="border-b border-charcoal/10 pb-4">
                  <p className="font-medium text-charcoal">{review.title}</p>
                  <p className="text-small text-charcoal/70">{review.body}</p>
                  <p className="mt-1 text-caption text-charcoal/50">— {review.authorName}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">No reviews yet.</p>
        )}
      </div>

      <div className="mt-12">
        <h2 className="text-h3 font-heading text-charcoal">Questions & Answers</h2>
        {product.qaSummary && product.qaSummary.previewItems.length > 0 ? (
          <ul className="mt-4 space-y-4">
            {product.qaSummary.previewItems.map((qa) => (
              <li key={qa.id} className="border-b border-charcoal/10 pb-4">
                <p className="font-medium text-charcoal">{qa.question}</p>
                <p className="text-small text-charcoal/70">{qa.answer}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-small text-charcoal/70">No questions yet.</p>
        )}
      </div>

      <div className="mt-12">
        <RelatedProducts products={product.relatedProducts} />
      </div>
      <div className="mt-12">
        <RecentlyViewed excludeProductId={product.id} />
      </div>
    </Section>
  );
}
```

- [ ] **Step 2: Verify the page renders in dev**

Run: `npx prisma dev` (if not running) and `npm run dev` in one terminal, then in another: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/products/roasted-curry-powder-100g`
Expected: `200`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(storefront)/products/[slug]/page.tsx"
git commit -m "feat: add the Product Detail Page route"
```

---

## Task 15: Playwright E2E Coverage

**Files:**
- Create: `tests/e2e/product-detail.spec.ts`

**Interfaces:**
- Consumes: the running dev server (via `playwright.config.ts`'s `webServer`) and the seeded `roasted-curry-powder-100g` product (Task 1, Step 9).

- [ ] **Step 1: Write the e2e tests**

Create `tests/e2e/product-detail.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("renders every required PDP section for a seeded product", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await expect(page.getByRole("heading", { level: 1, name: "Roasted Curry Powder 100g" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  await expect(page.getByText("Nutrition Facts")).toBeVisible();
  await expect(page.getByText("Coriander")).toBeVisible();
  await expect(page.getByText("Benefits")).toBeVisible();
  await expect(page.getByText("Serving Suggestions")).toBeVisible();
  await expect(page.getByText(/Earn \d+ reward points/)).toBeVisible();
  await expect(page.getByText("Recipes for this product are coming soon.")).toBeVisible();
  await expect(page.getByText("No reviews yet.")).toBeVisible();
  await expect(page.getByText("No questions yet.")).toBeVisible();
});

test("opens and closes the image gallery lightbox", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await page.getByRole("button", { name: /Zoom in on/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("shows a disabled Add to Cart control until the Shopping Cart story ships", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  await expect(page.getByRole("button", { name: "Add to Cart" })).toBeDisabled();
});

test("product detail page has no automatically detectable accessibility violations", async ({ page }) => {
  await page.goto("/products/roasted-curry-powder-100g");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `npm run test:e2e -- product-detail`
Expected: 4 passed. If the seeded product is missing, first run `npx prisma db push && npx tsx prisma/seed.ts` (see Task 1, Step 10).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/product-detail.spec.ts
git commit -m "test: add Playwright e2e coverage for the Product Detail Page"
```

---

## Task 16: Backlog and Documentation Update

**Files:**
- Modify: `docs/stories/03-product-platform/STORY-011-product-detail-page.md`
- Modify: `docs/stories/README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Mark STORY-011 done and document the extension-point contract**

In `docs/stories/03-product-platform/STORY-011-product-detail-page.md`, change line 3 from:

```markdown
**Status:** Draft
```

to:

```markdown
**Status:** Done — see `src/services/product-detail-extensions.ts` for the
review/Q&A/recipe-summary provider contract STORY-015, STORY-016, and
Epic 04 must implement (`register*SummaryProvider`), and
`docs/superpowers/plans/2026-09-18-product-detail-page.md` for the full
implementation record.
```

- [ ] **Step 2: Update the backlog rollup**

In `docs/stories/README.md`, change:

```markdown
| STORY-011 | Product Detail Page | Draft |
```

to:

```markdown
| STORY-011 | Product Detail Page | Done |
```

- [ ] **Step 3: Commit**

```bash
git add docs/stories/03-product-platform/STORY-011-product-detail-page.md docs/stories/README.md
git commit -m "docs: mark STORY-011 done and document the PDP extension-point contract"
```
