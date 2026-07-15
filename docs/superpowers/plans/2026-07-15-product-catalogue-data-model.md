# STORY-009: Product Catalogue Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Prisma schema, Repository layer, Service layer, and Zod validation for the Oristor product catalogue and nine-tier pricing engine, so every later Product Platform story (listing, PDP, search, wishlist, compare, reviews, Q&A) has a consistent, validated data source.

**Architecture:** Service Layer pattern (route handlers/components → services → repositories → Prisma). Repositories are the only code that imports Prisma for catalogue entities. Services apply business rules (e.g. storefront callers only ever see `Published` products). No route handlers, admin UI, or storefront pages are built in this plan — purely the data layer STORY-010 onward will consume.

**Tech Stack:** Prisma 7.8.0 (driver-adapter pattern, `@prisma/adapter-pg`), PostgreSQL, Zod 4.4.3, Vitest 4.1.10.

**Design doc:** `docs/superpowers/specs/2026-07-15-product-catalogue-data-model-design.md`
**Story:** `docs/stories/03-product-platform/STORY-009-product-catalogue-data-model.md`

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types (`CLAUDE.md`)
- Repositories are the **only** layer that imports `@/lib/db` / Prisma. Services never import Prisma directly (`src/repositories/README.md`, `src/services/README.md`)
- One repository/service file per aggregate (`product.repository.ts`, `category.repository.ts`, etc.) — matches existing `src/repositories/`, `src/services/` convention
- All money fields: `Decimal @db.Decimal(10,2)` in Postgres; every price row carries `currency String @default("LKR")` (design doc decision — forward-compatible single-currency)
- `rewardPoints Int @default(0)` as a plain field on `Product`, not a separate rules model (design doc decision)
- SEO fields (`metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`) inline on `Product`, `Category`, `Collection` — no dedicated SEO model (design doc decision)
- IDs: `String @id @default(cuid())`, matching existing `User`/`Account`/`Session` models in `prisma/schema.prisma`
- Zod: one schema per concern under `src/validation/`, paired `z.infer` type export, matching `src/validation/auth.schema.ts` / `example.schema.ts` pattern
- Local schema iteration uses `npx prisma db push` (not `migrate dev`) — a documented upstream PGlite bug makes repeated `migrate dev` calls unreliable in this environment; see `docs/architecture-decisions.md`
- Conventional Commits (`feat:`, `test:`, `docs:`, etc.) per `CLAUDE.md`; commit after every task
- **`prisma/schema.prisma` line numbers below are only accurate for Task 1's starting state.** From Task 2 onward, the file has already been modified by prior tasks in this plan — later tasks locate their insertion point by content anchor (e.g. "append after the closing `}` of `model Brand`") rather than by line number, since exact numbers would drift as tasks execute in order.

---

### Task 1: Test database infrastructure + `Category` model

**Files:**
- Modify: `prisma/schema.prisma` (append after line 65, the end of the `VerificationToken` model)
- Create: `tests/unit/global-setup.ts`
- Modify: `vitest.config.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `CLAUDE.md`
- Create: `src/repositories/category.repository.ts`
- Test: `tests/unit/category-repository.test.ts`

**Interfaces:**
- Produces: `ContentStatus` enum (`Active`/`Inactive`) — reused by `Collection` in Task 3. `createCategory(data: Prisma.CategoryCreateInput): Promise<Category>`, `findCategoryBySlug(slug: string): Promise<Category | null>`, `findCategoryById(id: string): Promise<Category | null>`, `listRootCategories(): Promise<Category[]>`, `listChildCategories(parentId: string): Promise<Category[]>`, `listAllCategories(): Promise<Category[]>`, `getCategoryTree(): Promise<CategoryTreeNode[]>` — all in `src/repositories/category.repository.ts`, consumed by `category.service.ts` in Task 11.

This task also wires up the mechanism every later DB-touching task depends on: a Vitest `globalSetup` that runs `prisma db push` before the suite, so tests exercise the real local Postgres (per the design doc's approved test strategy), plus a Postgres service container in CI so `npm run test` keeps working there too (CI currently has no live DB — see the comment in `.github/workflows/ci.yml`).

- [ ] **Step 1: Add `ContentStatus` enum and `Category` model to the schema**

Open `prisma/schema.prisma`. After the `VerificationToken` model (the last block in the file, ending at line 65), append:

```prisma

// --- Product Catalogue (STORY-009) ---

enum ContentStatus {
  Active
  Inactive
}

model Category {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  description String?
  image       String?
  sortOrder   Int           @default(0)
  status      ContentStatus @default(Active)

  parentId String?
  parent   Category?  @relation("CategoryToParent", fields: [parentId], references: [id], onDelete: SetNull)
  children Category[] @relation("CategoryToParent")

  metaTitle       String?
  metaDescription String?
  canonicalUrl    String?
  ogImage         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
}
```

- [ ] **Step 2: Push the schema to the local dev database**

Make sure the local Prisma dev server is running (`npx prisma dev` in a separate terminal/background process — see `docs/architecture-decisions.md` if it's not already up).

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.` and a regenerated Prisma Client (the command auto-generates unless `--skip-generate` is passed).

- [ ] **Step 3: Write the global test-database setup**

Create `tests/unit/global-setup.ts`:

```ts
import { execSync } from "node:child_process";

export default function setup() {
  execSync("npx prisma db push --force-reset --accept-data-loss --skip-generate", {
    stdio: "inherit",
  });
}
```

- [ ] **Step 4: Wire the global setup into Vitest**

In `vitest.config.ts`, add `globalSetup` inside the `test` block:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globalSetup: ["./tests/unit/global-setup.ts"],
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 5: Add a Postgres service to CI and point `DATABASE_URL` at it**

Replace the `env:` block and add a `services:` block in `.github/workflows/ci.yml` (the job currently starts at line 10):

```yaml
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: oristor_ci
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      # Real Postgres service container above — unit tests run `prisma db
      # push` against it via tests/unit/global-setup.ts. Not used by
      # lint/typecheck/build, which don't need a live DB.
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/oristor_ci?sslmode=disable"
      AUTH_SECRET: "ci-placeholder-secret-do-not-use-in-production"
    steps:
```

Leave the rest of the file (`steps:` and everything under it) unchanged.

- [ ] **Step 6: Document the new local test requirement in `CLAUDE.md`**

In `CLAUDE.md`, find the "Local DB workflow" paragraph (added when the DB connectivity blocker was resolved) and append a sentence:

```markdown
**Local DB workflow:** `npx prisma dev` runs a PGlite-backed local Postgres
server, which has an upstream bug that breaks `prisma migrate dev` on
repeated calls (see `docs/architecture-decisions.md` for root cause and
fix). Use `npx prisma db push` for day-to-day schema iteration; only use
`migrate dev` (against a freshly restarted server) when deliberately
producing a migration file to commit. **`npm run test` now requires a
running `prisma dev` server** — the Vitest global setup runs `db push`
against it before every test run; start `npx prisma dev` first if tests
fail with a connection error.
```

- [ ] **Step 7: Write the repository, including tree traversal**

Create `src/repositories/category.repository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Category, Prisma } from "@/generated/prisma/client";

export function createCategory(data: Prisma.CategoryCreateInput) {
  return prisma.category.create({ data });
}

export function findCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export function findCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export function listRootCategories() {
  return prisma.category.findMany({
    where: { parentId: null },
    orderBy: { sortOrder: "asc" },
  });
}

export function listChildCategories(parentId: string) {
  return prisma.category.findMany({
    where: { parentId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listAllCategories() {
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const all = await listAllCategories();
  const byParent = new Map<string | null, Category[]>();
  for (const category of all) {
    const key = category.parentId;
    const bucket = byParent.get(key) ?? [];
    bucket.push(category);
    byParent.set(key, bucket);
  }
  function build(parentId: string | null): CategoryTreeNode[] {
    return (byParent.get(parentId) ?? []).map((category) => ({
      ...category,
      children: build(category.id),
    }));
  }
  return build(null);
}
```

- [ ] **Step 8: Write the failing test**

Create `tests/unit/category-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createCategory,
  findCategoryBySlug,
  getCategoryTree,
  listChildCategories,
  listRootCategories,
} from "@/repositories/category.repository";

afterEach(async () => {
  await prisma.category.deleteMany();
});

describe("category.repository", () => {
  it("creates a category and finds it by slug", async () => {
    await createCategory({ name: "Spice Blends", slug: "spice-blends" });

    const found = await findCategoryBySlug("spice-blends");

    expect(found?.name).toBe("Spice Blends");
  });

  it("rejects a duplicate slug", async () => {
    await createCategory({ name: "Spice Blends", slug: "spice-blends" });

    await expect(
      createCategory({ name: "Other", slug: "spice-blends" }),
    ).rejects.toThrow();
  });

  it("supports arbitrary-depth nesting via parentId", async () => {
    const root = await createCategory({ name: "Products", slug: "products" });
    const child = await createCategory({
      name: "Spices",
      slug: "spices",
      parent: { connect: { id: root.id } },
    });
    await createCategory({
      name: "Curry Powders",
      slug: "curry-powders",
      parent: { connect: { id: child.id } },
    });

    const roots = await listRootCategories();
    const children = await listChildCategories(root.id);
    const tree = await getCategoryTree();

    expect(roots.map((c) => c.slug)).toEqual(["products"]);
    expect(children.map((c) => c.slug)).toEqual(["spices"]);
    expect(tree[0].children[0].children[0].slug).toBe("curry-powders");
  });
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test -- category-repository`
Expected: `3 passed`. If it fails with a connection error, start `npx prisma dev` in another terminal and retry — this is the new dependency Step 3–4 introduced.

- [ ] **Step 10: Run the full suite to confirm nothing else broke**

Run: `npm run test`
Expected: all existing test files plus `category-repository.test.ts` pass (the global setup's `db push --force-reset` wipes the dev DB before the run, which is fine — no other test depends on pre-existing data).

- [ ] **Step 11: Commit**

```bash
git add prisma/schema.prisma tests/unit/global-setup.ts vitest.config.ts .github/workflows/ci.yml CLAUDE.md src/repositories/category.repository.ts tests/unit/category-repository.test.ts
git commit -m "feat: add Category model, repository, and real-DB test infrastructure"
```

---

### Task 2: `Brand` model

**Files:**
- Modify: `prisma/schema.prisma` (append after the `Category` model)
- Create: `src/repositories/brand.repository.ts`
- Test: `tests/unit/brand-repository.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: `createBrand(data: Prisma.BrandCreateInput): Promise<Brand>`, `findBrandBySlug(slug: string): Promise<Brand | null>`, `findBrandById(id: string): Promise<Brand | null>`, `listBrands(): Promise<Brand[]>` — consumed by `product.repository.ts` (Task 4, via the `brandId` FK) and seed data (Task 13).

- [ ] **Step 1: Add the `Brand` model to the schema**

Append after the closing `}` of `model Category` in `prisma/schema.prisma`:

```prisma

model Brand {
  id          String  @id @default(cuid())
  name        String
  slug        String  @unique
  logo        String?
  description String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Write the repository**

Create `src/repositories/brand.repository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function createBrand(data: Prisma.BrandCreateInput) {
  return prisma.brand.create({ data });
}

export function findBrandBySlug(slug: string) {
  return prisma.brand.findUnique({ where: { slug } });
}

export function findBrandById(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export function listBrands() {
  return prisma.brand.findMany({ orderBy: { name: "asc" } });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/brand-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBrand, findBrandBySlug, listBrands } from "@/repositories/brand.repository";

afterEach(async () => {
  await prisma.brand.deleteMany();
});

describe("brand.repository", () => {
  it("creates a brand and finds it by slug", async () => {
    await createBrand({ name: "Oristor", slug: "oristor" });

    const found = await findBrandBySlug("oristor");

    expect(found?.name).toBe("Oristor");
  });

  it("rejects a duplicate slug", async () => {
    await createBrand({ name: "Oristor", slug: "oristor" });

    await expect(createBrand({ name: "Other", slug: "oristor" })).rejects.toThrow();
  });

  it("lists all brands alphabetically", async () => {
    await createBrand({ name: "Zesty Co", slug: "zesty-co" });
    await createBrand({ name: "Ambrosia", slug: "ambrosia" });

    const brands = await listBrands();

    expect(brands.map((b) => b.name)).toEqual(["Ambrosia", "Zesty Co"]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- brand-repository`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/brand.repository.ts tests/unit/brand-repository.test.ts
git commit -m "feat: add Brand model and repository"
```

---

### Task 3: `Collection` model

**Files:**
- Modify: `prisma/schema.prisma` (append after the `Brand` model)
- Create: `src/repositories/collection.repository.ts`
- Test: `tests/unit/collection-repository.test.ts`

**Interfaces:**
- Consumes: `ContentStatus` enum from Task 1
- Produces: `createCollection(data: Prisma.CollectionCreateInput): Promise<Collection>`, `findCollectionBySlug(slug: string): Promise<Collection | null>`, `findCollectionById(id: string): Promise<Collection | null>`, `listActiveCollections(date: Date): Promise<Collection[]>` — consumed by `collection.service.ts` (Task 11) and seed data (Task 13). Note: no `products` relation yet — added in Task 4 alongside `Product`.

- [ ] **Step 1: Add the `Collection` model to the schema**

Append after the closing `}` of `model Brand`:

```prisma

model Collection {
  id          String        @id @default(cuid())
  name        String
  slug        String        @unique
  description String?
  status      ContentStatus @default(Active)
  rules       Json?
  startDate   DateTime?
  endDate     DateTime?

  metaTitle       String?
  metaDescription String?
  canonicalUrl    String?
  ogImage         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Write the repository**

Create `src/repositories/collection.repository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function createCollection(data: Prisma.CollectionCreateInput) {
  return prisma.collection.create({ data });
}

export function findCollectionBySlug(slug: string) {
  return prisma.collection.findUnique({ where: { slug } });
}

export function findCollectionById(id: string) {
  return prisma.collection.findUnique({ where: { id } });
}

/**
 * Active collections currently in their seasonal/limited-time window (or
 * with no window set at all, i.e. always-on collections).
 */
export function listActiveCollections(date: Date = new Date()) {
  return prisma.collection.findMany({
    where: {
      status: "Active",
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: date }, endDate: { gte: date } },
      ],
    },
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/collection-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createCollection,
  findCollectionBySlug,
  listActiveCollections,
} from "@/repositories/collection.repository";

afterEach(async () => {
  await prisma.collection.deleteMany();
});

describe("collection.repository", () => {
  it("creates a collection and finds it by slug", async () => {
    await createCollection({ name: "New Year Specials", slug: "new-year-specials" });

    const found = await findCollectionBySlug("new-year-specials");

    expect(found?.name).toBe("New Year Specials");
  });

  it("lists always-on active collections", async () => {
    await createCollection({ name: "Bestsellers", slug: "bestsellers" });

    const active = await listActiveCollections(new Date("2026-07-15"));

    expect(active.map((c) => c.slug)).toEqual(["bestsellers"]);
  });

  it("excludes a seasonal collection outside its date window", async () => {
    await createCollection({
      name: "Avurudu 2026",
      slug: "avurudu-2026",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    const duringWindow = await listActiveCollections(new Date("2026-04-15"));
    const afterWindow = await listActiveCollections(new Date("2026-07-15"));

    expect(duringWindow.map((c) => c.slug)).toEqual(["avurudu-2026"]);
    expect(afterWindow.map((c) => c.slug)).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- collection-repository`
Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/collection.repository.ts tests/unit/collection-repository.test.ts
git commit -m "feat: add Collection model and repository"
```

---

### Task 4: `Product` model and its category/collection/brand relations

**Files:**
- Modify: `prisma/schema.prisma` (add `products Product[]` to `Category`, `Brand`, and `Collection`; append `ProductStatus`, `ProductType` enums and `model Product`)
- Modify: `src/repositories/collection.repository.ts` (add `getCollectionProducts`)
- Create: `src/repositories/product.repository.ts`
- Test: `tests/unit/product-repository.test.ts`

**Interfaces:**
- Consumes: `Category`, `Brand`, `Collection` models from Tasks 1–3
- Produces: `createProduct(data: Prisma.ProductCreateInput): Promise<Product>`, `findProductBySlug(slug: string): Promise<Product | null>`, `findProductBySku(sku: string): Promise<Product | null>`, `findProductById(id: string): Promise<Product | null>`, `listProductsByCategory(categoryId: string): Promise<Product[]>`, `listProductsByStatus(status: ProductStatus): Promise<Product[]>` — all consumed by `product.service.ts` (Task 11) and every later task that attaches child data to a product (Tasks 5–9).

- [ ] **Step 1: Add back-relations and the `Product` model to the schema**

In `prisma/schema.prisma`, add one line inside each of these three existing models (do not change anything else in them):

In `model Category`, immediately before its closing `}`, add:
```prisma
  products Product[]
```

In `model Brand`, immediately before its closing `}`, add:
```prisma
  products Product[]
```

In `model Collection`, immediately before its closing `}`, add:
```prisma
  products Product[]
```

Then append after the closing `}` of `model Collection`:

```prisma

enum ProductStatus {
  Draft
  Review
  Published
  Archived
  Discontinued
  OutOfSeason
}

enum ProductType {
  Standard
  Bundle
  GiftPack
  Seasonal
  LimitedEdition
}

model Product {
  id               String        @id @default(cuid())
  sku              String        @unique
  barcode          String?       @unique
  slug             String        @unique
  name             String
  shortDescription String?
  story            String?
  status           ProductStatus @default(Draft)
  productType      ProductType   @default(Standard)
  publishedAt      DateTime?
  rewardPoints     Int           @default(0)

  brandId String?
  brand   Brand?  @relation(fields: [brandId], references: [id], onDelete: SetNull)

  categories  Category[]
  collections Collection[]

  metaTitle       String?
  metaDescription String?
  canonicalUrl    String?
  ogImage         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([brandId])
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Add collection-membership lookup**

In `src/repositories/collection.repository.ts`, append:

```ts

export function getCollectionProducts(collectionId: string) {
  return prisma.product.findMany({
    where: { collections: { some: { id: collectionId } } },
  });
}
```

- [ ] **Step 4: Write the repository**

Create `src/repositories/product.repository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";

export function createProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data });
}

export function findProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export function findProductBySku(sku: string) {
  return prisma.product.findUnique({ where: { sku } });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function listProductsByCategory(categoryId: string) {
  return prisma.product.findMany({
    where: { categories: { some: { id: categoryId } } },
  });
}

export function listProductsByStatus(status: ProductStatus) {
  return prisma.product.findMany({ where: { status } });
}
```

- [ ] **Step 5: Write the failing test**

Create `tests/unit/product-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createBrand } from "@/repositories/brand.repository";
import { createCategory } from "@/repositories/category.repository";
import {
  createProduct,
  findProductBySku,
  findProductBySlug,
  listProductsByCategory,
  listProductsByStatus,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
});

describe("product.repository", () => {
  it("creates a product and finds it by slug and sku", async () => {
    await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
      status: "Published",
    });

    expect((await findProductBySlug("curry-powder-100g"))?.sku).toBe("ORI-CP-100");
    expect((await findProductBySku("ORI-CP-100"))?.slug).toBe("curry-powder-100g");
  });

  it("rejects a duplicate SKU", async () => {
    await createProduct({ sku: "ORI-CP-100", slug: "curry-powder-100g", name: "A" });

    await expect(
      createProduct({ sku: "ORI-CP-100", slug: "different-slug", name: "B" }),
    ).rejects.toThrow();
  });

  it("links to a brand and category, and both list back", async () => {
    const brand = await createBrand({ name: "Oristor", slug: "oristor" });
    const category = await createCategory({ name: "Curry Powders", slug: "curry-powders" });

    await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
      status: "Published",
      brand: { connect: { id: brand.id } },
      categories: { connect: [{ id: category.id }] },
    });

    const byCategory = await listProductsByCategory(category.id);
    const byStatus = await listProductsByStatus("Published");

    expect(byCategory.map((p) => p.slug)).toEqual(["curry-powder-100g"]);
    expect(byStatus.map((p) => p.slug)).toEqual(["curry-powder-100g"]);
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- product-repository`
Expected: `3 passed`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/repositories/collection.repository.ts src/repositories/product.repository.ts tests/unit/product-repository.test.ts
git commit -m "feat: add Product model and repository with category/brand/collection relations"
```

---

### Task 5: Product media gallery (`ProductImage`, `ProductVideo`)

**Files:**
- Modify: `prisma/schema.prisma` (add `images`/`videos` to `Product`; append `MediaRole` enum and the two media models)
- Modify: `src/repositories/product.repository.ts` (append media functions)
- Test: `tests/unit/product-media-repository.test.ts`

**Interfaces:**
- Consumes: `Product` model from Task 4
- Produces: `addProductImage(data: Prisma.ProductImageCreateInput): Promise<ProductImage>`, `addProductVideo(data: Prisma.ProductVideoCreateInput): Promise<ProductVideo>`, `listProductImages(productId: string): Promise<ProductImage[]>`, `listProductVideos(productId: string): Promise<ProductVideo[]>` in `product.repository.ts` — consumed by seed data (Task 13) and later PDP work (STORY-011, out of scope here).

- [ ] **Step 1: Add media models to the schema**

In `model Product`, immediately before its closing `}`, add:
```prisma
  images ProductImage[]
  videos ProductVideo[]
```

Append after the closing `}` of `model Product`:

```prisma

enum MediaRole {
  Gallery
  Lifestyle
  Video
}

model ProductImage {
  id        String    @id @default(cuid())
  productId String
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  altText   String?
  isPrimary Boolean   @default(false)
  mediaRole MediaRole @default(Gallery)
  sortOrder Int       @default(0)

  createdAt DateTime @default(now())

  @@index([productId])
}

model ProductVideo {
  id        String    @id @default(cuid())
  productId String
  product   Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  altText   String?
  isPrimary Boolean   @default(false)
  mediaRole MediaRole @default(Video)
  sortOrder Int       @default(0)

  createdAt DateTime @default(now())

  @@index([productId])
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Add media functions to the product repository**

Append to `src/repositories/product.repository.ts`:

```ts

export function addProductImage(data: Prisma.ProductImageCreateInput) {
  return prisma.productImage.create({ data });
}

export function addProductVideo(data: Prisma.ProductVideoCreateInput) {
  return prisma.productVideo.create({ data });
}

export function listProductImages(productId: string) {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listProductVideos(productId: string) {
  return prisma.productVideo.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/product-media-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addProductImage,
  addProductVideo,
  createProduct,
  listProductImages,
  listProductVideos,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("product media", () => {
  it("adds and orders images and videos for a product", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });

    await addProductImage({
      product: { connect: { id: product.id } },
      url: "/images/curry-powder-2.jpg",
      isPrimary: false,
      sortOrder: 2,
    });
    await addProductImage({
      product: { connect: { id: product.id } },
      url: "/images/curry-powder-1.jpg",
      isPrimary: true,
      sortOrder: 1,
    });
    await addProductVideo({
      product: { connect: { id: product.id } },
      url: "/videos/curry-powder-demo.mp4",
      mediaRole: "Video",
    });

    const images = await listProductImages(product.id);
    const videos = await listProductVideos(product.id);

    expect(images.map((i) => i.url)).toEqual([
      "/images/curry-powder-1.jpg",
      "/images/curry-powder-2.jpg",
    ]);
    expect(images[0].isPrimary).toBe(true);
    expect(videos).toHaveLength(1);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- product-media-repository`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/product.repository.ts tests/unit/product-media-repository.test.ts
git commit -m "feat: add ProductImage and ProductVideo models"
```

---

### Task 6: Nutrition, ingredients, and allergens

**Files:**
- Modify: `prisma/schema.prisma` (add `nutrition`/`ingredients`/`allergens` to `Product`; append `ProductNutrition`, `ProductIngredient`, `Allergen` models)
- Modify: `src/repositories/product.repository.ts` (append nutrition/ingredient/allergen functions)
- Test: `tests/unit/product-nutrition-repository.test.ts`

**Interfaces:**
- Consumes: `Product` model from Task 4
- Produces: `setProductNutrition(data: Prisma.ProductNutritionCreateInput): Promise<ProductNutrition>`, `getProductNutrition(productId: string): Promise<ProductNutrition | null>`, `addProductIngredient(data: Prisma.ProductIngredientCreateInput): Promise<ProductIngredient>`, `listProductIngredients(productId: string): Promise<ProductIngredient[]>`, `createAllergen(data: Prisma.AllergenCreateInput): Promise<Allergen>`, `findAllergenByName(name: string): Promise<Allergen | null>`, `attachAllergen(productId: string, allergenId: string): Promise<Product>`, `listProductAllergens(productId: string): Promise<Allergen[]>` in `product.repository.ts` — consumed by seed data (Task 13). Note: `Allergen` is many-to-many with `Product` (the formal allergen taxonomy), which is a separate concept from `ProductIngredient.isAllergen` (a per-ingredient-line flag) — both exist per the AC and neither substitutes for the other.

- [ ] **Step 1: Add nutrition/ingredient/allergen models to the schema**

In `model Product`, immediately before its closing `}`, add:
```prisma
  nutrition   ProductNutrition?
  ingredients ProductIngredient[]
  allergens   Allergen[]
```

Append after the closing `}` of `model ProductVideo`:

```prisma

model ProductNutrition {
  id            String  @id @default(cuid())
  productId     String  @unique
  product       Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  servingSize   String
  calories      Decimal @db.Decimal(10, 2)
  protein       Decimal @db.Decimal(10, 2)
  fat           Decimal @db.Decimal(10, 2)
  saturatedFat  Decimal @db.Decimal(10, 2)
  carbohydrates Decimal @db.Decimal(10, 2)
  sugar         Decimal @db.Decimal(10, 2)
  fibre         Decimal @db.Decimal(10, 2)
  sodium        Decimal @db.Decimal(10, 2)
}

model ProductIngredient {
  id         String  @id @default(cuid())
  productId  String
  product    Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  name       String
  isAllergen Boolean @default(false)
  sortOrder  Int     @default(0)

  @@index([productId])
}

model Allergen {
  id       String    @id @default(cuid())
  name     String    @unique
  icon     String?
  products Product[]
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Add functions to the product repository**

Append to `src/repositories/product.repository.ts`:

```ts

export function setProductNutrition(data: Prisma.ProductNutritionCreateInput) {
  return prisma.productNutrition.create({ data });
}

export function getProductNutrition(productId: string) {
  return prisma.productNutrition.findUnique({ where: { productId } });
}

export function addProductIngredient(data: Prisma.ProductIngredientCreateInput) {
  return prisma.productIngredient.create({ data });
}

export function listProductIngredients(productId: string) {
  return prisma.productIngredient.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function createAllergen(data: Prisma.AllergenCreateInput) {
  return prisma.allergen.create({ data });
}

export function findAllergenByName(name: string) {
  return prisma.allergen.findUnique({ where: { name } });
}

export function attachAllergen(productId: string, allergenId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { allergens: { connect: { id: allergenId } } },
  });
}

export function listProductAllergens(productId: string) {
  return prisma.allergen.findMany({
    where: { products: { some: { id: productId } } },
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/product-nutrition-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addProductIngredient,
  attachAllergen,
  createAllergen,
  createProduct,
  getProductNutrition,
  listProductAllergens,
  listProductIngredients,
  setProductNutrition,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.allergen.deleteMany();
});

describe("product nutrition, ingredients, allergens", () => {
  it("attaches one nutrition record, an ordered ingredient list, and allergens", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const mustard = await createAllergen({ name: "Mustard" });

    await setProductNutrition({
      product: { connect: { id: product.id } },
      servingSize: "1 tsp (5g)",
      calories: "18.00",
      protein: "0.80",
      fat: "0.70",
      saturatedFat: "0.10",
      carbohydrates: "2.50",
      sugar: "0.30",
      fibre: "1.10",
      sodium: "2.00",
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Coriander",
      sortOrder: 1,
    });
    await addProductIngredient({
      product: { connect: { id: product.id } },
      name: "Mustard seed",
      isAllergen: true,
      sortOrder: 2,
    });
    await attachAllergen(product.id, mustard.id);

    const nutrition = await getProductNutrition(product.id);
    const ingredients = await listProductIngredients(product.id);
    const allergens = await listProductAllergens(product.id);

    expect(nutrition?.calories.toString()).toBe("18.00");
    expect(ingredients.map((i) => i.name)).toEqual(["Coriander", "Mustard seed"]);
    expect(ingredients[1].isAllergen).toBe(true);
    expect(allergens.map((a) => a.name)).toEqual(["Mustard"]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- product-nutrition-repository`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/product.repository.ts tests/unit/product-nutrition-repository.test.ts
git commit -m "feat: add ProductNutrition, ProductIngredient, and Allergen models"
```

---

### Task 7: Certifications

**Files:**
- Modify: `prisma/schema.prisma` (add `certifications` to `Product`; append `Certification` model)
- Modify: `src/repositories/product.repository.ts` (append certification functions)
- Test: `tests/unit/product-certification-repository.test.ts`

**Interfaces:**
- Consumes: `Product` model from Task 4
- Produces: `createCertification(data: Prisma.CertificationCreateInput): Promise<Certification>`, `attachCertification(productId: string, certificationId: string): Promise<Product>`, `listProductCertifications(productId: string): Promise<Certification[]>` in `product.repository.ts` — consumed by seed data (Task 13).

- [ ] **Step 1: Add the `Certification` model to the schema**

In `model Product`, immediately before its closing `}`, add:
```prisma
  certifications Certification[]
```

Append after the closing `}` of `model Allergen`:

```prisma

model Certification {
  id               String    @id @default(cuid())
  name             String
  certificateImage String?
  documentUrl      String?
  products         Product[]
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Add functions to the product repository**

Append to `src/repositories/product.repository.ts`:

```ts

export function createCertification(data: Prisma.CertificationCreateInput) {
  return prisma.certification.create({ data });
}

export function attachCertification(productId: string, certificationId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { certifications: { connect: { id: certificationId } } },
  });
}

export function listProductCertifications(productId: string) {
  return prisma.certification.findMany({
    where: { products: { some: { id: productId } } },
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/product-certification-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  attachCertification,
  createCertification,
  createProduct,
  listProductCertifications,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.certification.deleteMany();
});

describe("product certifications", () => {
  it("attaches a certification to a product and lists it back", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const haccp = await createCertification({ name: "HACCP" });

    await attachCertification(product.id, haccp.id);
    const certifications = await listProductCertifications(product.id);

    expect(certifications.map((c) => c.name)).toEqual(["HACCP"]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- product-certification-repository`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/product.repository.ts tests/unit/product-certification-repository.test.ts
git commit -m "feat: add Certification model"
```

---

### Task 8: Bundles and gift packs

**Files:**
- Modify: `prisma/schema.prisma` (add `bundle`/`bundleComponentOf` to `Product`; append `ProductBundle`, `BundleItem` models)
- Modify: `src/repositories/product.repository.ts` (append bundle functions)
- Test: `tests/unit/product-bundle-repository.test.ts`

**Interfaces:**
- Consumes: `Product` model from Task 4
- Produces: `createBundle(data: Prisma.ProductBundleCreateInput): Promise<ProductBundle>`, `addBundleItem(data: Prisma.BundleItemCreateInput): Promise<BundleItem>`, `getBundleWithItems(productId: string): Promise<(ProductBundle & { items: BundleItem[] }) | null>` in `product.repository.ts` — consumed by seed data (Task 13).

- [ ] **Step 1: Add bundle models to the schema**

In `model Product`, immediately before its closing `}`, add:
```prisma
  bundle            ProductBundle?
  bundleComponentOf BundleItem[]
```

Append after the closing `}` of `model Certification`:

```prisma

model ProductBundle {
  id            String       @id @default(cuid())
  productId     String       @unique
  product       Product      @relation(fields: [productId], references: [id], onDelete: Cascade)
  priceOverride Decimal?     @db.Decimal(10, 2)
  items         BundleItem[]
}

model BundleItem {
  id                 String        @id @default(cuid())
  bundleId           String
  bundle             ProductBundle @relation(fields: [bundleId], references: [id], onDelete: Cascade)
  componentProductId String
  componentProduct   Product       @relation(fields: [componentProductId], references: [id])
  quantity           Int           @default(1)

  @@index([bundleId])
  @@index([componentProductId])
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Add functions to the product repository**

Append to `src/repositories/product.repository.ts`:

```ts

export function createBundle(data: Prisma.ProductBundleCreateInput) {
  return prisma.productBundle.create({ data });
}

export function addBundleItem(data: Prisma.BundleItemCreateInput) {
  return prisma.bundleItem.create({ data });
}

export function getBundleWithItems(productId: string) {
  return prisma.productBundle.findUnique({
    where: { productId },
    include: { items: { include: { componentProduct: true } } },
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/product-bundle-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addBundleItem,
  createBundle,
  createProduct,
  getBundleWithItems,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("product bundles", () => {
  it("creates a bundle with component items", async () => {
    const curryPowder = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const chilliPowder = await createProduct({
      sku: "ORI-CHP-100",
      slug: "chilli-powder-100g",
      name: "Chilli Powder 100g",
    });
    const giftSet = await createProduct({
      sku: "ORI-GIFT-001",
      slug: "curry-gift-set",
      name: "Curry Powder Gift Set",
      productType: "Bundle",
    });

    const bundle = await createBundle({
      product: { connect: { id: giftSet.id } },
      priceOverride: "1200.00",
    });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: curryPowder.id } },
      quantity: 2,
    });
    await addBundleItem({
      bundle: { connect: { id: bundle.id } },
      componentProduct: { connect: { id: chilliPowder.id } },
      quantity: 1,
    });

    const found = await getBundleWithItems(giftSet.id);

    expect(found?.priceOverride?.toString()).toBe("1200.00");
    expect(found?.items).toHaveLength(2);
    expect(found?.items.map((i) => i.quantity).sort()).toEqual([1, 2]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- product-bundle-repository`
Expected: `1 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/product.repository.ts tests/unit/product-bundle-repository.test.ts
git commit -m "feat: add ProductBundle and BundleItem models"
```

---

### Task 9: Pricing engine schema and repository

**Files:**
- Modify: `prisma/schema.prisma` (add pricing relations to `Product`; append `CustomerGroup` enum and five pricing models)
- Create: `src/repositories/pricing.repository.ts`
- Test: `tests/unit/pricing-repository.test.ts`

**Interfaces:**
- Consumes: `Product` model from Task 4
- Produces (all in `src/repositories/pricing.repository.ts`, consumed by `pricing.service.ts` in Task 10): `createStandardPrice`, `createSalePrice`, `createCampaignPrice`, `createCustomerGroupPrice`, `createVolumeDiscountTier` (each `(data: Prisma.XCreateInput) => Promise<X>`); `getLatestStandardPrice(productId: string): Promise<StandardPrice | null>`; `getActiveSalePrices(productId: string, date: Date): Promise<SalePrice[]>`; `getActiveCampaignPrices(productId: string, date: Date): Promise<CampaignPrice[]>`; `getCustomerGroupPrice(productId: string, customerGroup: CustomerGroup): Promise<CustomerGroupPrice | null>`; `getApplicableVolumeDiscountTiers(productId: string, quantity: number): Promise<VolumeDiscountTier[]>`.

- [ ] **Step 1: Add pricing models to the schema**

In `model Product`, immediately before its closing `}`, add:
```prisma
  standardPrices      StandardPrice[]
  salePrices          SalePrice[]
  campaignPrices      CampaignPrice[]
  customerGroupPrices CustomerGroupPrice[]
  volumeDiscountTiers VolumeDiscountTier[]
```

Append after the closing `}` of `model BundleItem`:

```prisma

enum CustomerGroup {
  Retail
  Wholesale
  Distributor
  Export
  PrivateLabel
}

model StandardPrice {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  price     Decimal  @db.Decimal(10, 2)
  currency  String   @default("LKR")
  createdAt DateTime @default(now())

  @@index([productId])
}

model SalePrice {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  price     Decimal  @db.Decimal(10, 2)
  currency  String   @default("LKR")
  startDate DateTime
  endDate   DateTime
  createdAt DateTime @default(now())

  @@index([productId, startDate, endDate])
}

model CampaignPrice {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  campaignId String
  price      Decimal  @db.Decimal(10, 2)
  currency   String   @default("LKR")
  startDate  DateTime
  endDate    DateTime
  createdAt  DateTime @default(now())

  @@index([productId, startDate, endDate])
}

model CustomerGroupPrice {
  id            String        @id @default(cuid())
  productId     String
  product       Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerGroup CustomerGroup
  price         Decimal       @db.Decimal(10, 2)
  currency      String        @default("LKR")
  createdAt     DateTime      @default(now())

  @@unique([productId, customerGroup])
}

model VolumeDiscountTier {
  id              String   @id @default(cuid())
  productId       String
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  minQuantity     Int
  discountPrice   Decimal? @db.Decimal(10, 2)
  discountPercent Decimal? @db.Decimal(5, 2)
  currency        String   @default("LKR")
  createdAt       DateTime @default(now())

  @@index([productId, minQuantity])
}
```

- [ ] **Step 2: Push the schema**

Run: `npx prisma db push`
Expected: `Your database is now in sync with the Prisma schema.`

- [ ] **Step 3: Write the repository**

Create `src/repositories/pricing.repository.ts`:

```ts
import { prisma } from "@/lib/db";
import type { CustomerGroup, Prisma } from "@/generated/prisma/client";

export function createStandardPrice(data: Prisma.StandardPriceCreateInput) {
  return prisma.standardPrice.create({ data });
}

export function createSalePrice(data: Prisma.SalePriceCreateInput) {
  return prisma.salePrice.create({ data });
}

export function createCampaignPrice(data: Prisma.CampaignPriceCreateInput) {
  return prisma.campaignPrice.create({ data });
}

export function createCustomerGroupPrice(data: Prisma.CustomerGroupPriceCreateInput) {
  return prisma.customerGroupPrice.create({ data });
}

export function createVolumeDiscountTier(data: Prisma.VolumeDiscountTierCreateInput) {
  return prisma.volumeDiscountTier.create({ data });
}

export function getLatestStandardPrice(productId: string) {
  return prisma.standardPrice.findFirst({
    where: { productId },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveSalePrices(productId: string, date: Date) {
  return prisma.salePrice.findMany({
    where: { productId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getActiveCampaignPrices(productId: string, date: Date) {
  return prisma.campaignPrice.findMany({
    where: { productId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { createdAt: "desc" },
  });
}

export function getCustomerGroupPrice(productId: string, customerGroup: CustomerGroup) {
  return prisma.customerGroupPrice.findFirst({
    where: { productId, customerGroup },
    orderBy: { createdAt: "desc" },
  });
}

export function getApplicableVolumeDiscountTiers(productId: string, quantity: number) {
  return prisma.volumeDiscountTier.findMany({
    where: { productId, minQuantity: { lte: quantity } },
    orderBy: [{ minQuantity: "desc" }, { createdAt: "desc" }],
  });
}
```

- [ ] **Step 4: Write the failing test**

Create `tests/unit/pricing-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createCampaignPrice,
  createCustomerGroupPrice,
  createSalePrice,
  createStandardPrice,
  createVolumeDiscountTier,
  getActiveCampaignPrices,
  getActiveSalePrices,
  getApplicableVolumeDiscountTiers,
  getCustomerGroupPrice,
  getLatestStandardPrice,
} from "@/repositories/pricing.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("pricing.repository", () => {
  it("returns the most recently created standard price", async () => {
    const product = await createProduct({ sku: "SKU-1", slug: "sku-1", name: "A" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "550.00" });

    const latest = await getLatestStandardPrice(product.id);

    expect(latest?.price.toString()).toBe("550.00");
  });

  it("only returns sale and campaign prices active on the given date", async () => {
    const product = await createProduct({ sku: "SKU-2", slug: "sku-2", name: "B" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-10"),
    });
    await createCampaignPrice({
      product: { connect: { id: product.id } },
      campaignId: "avurudu-2026",
      price: "400.00",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    expect(await getActiveSalePrices(product.id, new Date("2026-07-05"))).toHaveLength(1);
    expect(await getActiveSalePrices(product.id, new Date("2026-07-15"))).toHaveLength(0);
    expect(await getActiveCampaignPrices(product.id, new Date("2026-04-15"))).toHaveLength(1);
    expect(await getActiveCampaignPrices(product.id, new Date("2026-07-15"))).toHaveLength(0);
  });

  it("looks up the price for a specific customer group", async () => {
    const product = await createProduct({ sku: "SKU-3", slug: "sku-3", name: "C" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });

    const wholesale = await getCustomerGroupPrice(product.id, "Wholesale");
    const distributor = await getCustomerGroupPrice(product.id, "Distributor");

    expect(wholesale?.price.toString()).toBe("420.00");
    expect(distributor).toBeNull();
  });

  it("returns volume discount tiers applicable to a quantity, deepest first", async () => {
    const product = await createProduct({ sku: "SKU-4", slug: "sku-4", name: "D" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPercent: "5.00",
    });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 50,
      discountPercent: "10.00",
    });

    const tiers = await getApplicableVolumeDiscountTiers(product.id, 60);
    const tiersBelowSecondTier = await getApplicableVolumeDiscountTiers(product.id, 20);

    expect(tiers.map((t) => t.minQuantity)).toEqual([50, 10]);
    expect(tiersBelowSecondTier.map((t) => t.minQuantity)).toEqual([10]);
  });
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- pricing-repository`
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/repositories/pricing.repository.ts tests/unit/pricing-repository.test.ts
git commit -m "feat: add pricing engine schema (5 tiers) and repository"
```

---

### Task 10: `pricing.service.ts` — `resolvePrice()`

**Files:**
- Create: `src/services/pricing.service.ts`
- Test: `tests/unit/pricing-service.test.ts`

**Interfaces:**
- Consumes: all functions from `src/repositories/pricing.repository.ts` (Task 9), `createProduct` from `product.repository.ts` (Task 4)
- Produces: `resolvePrice(params: ResolvePriceParams): Promise<ResolvedPrice | null>`, `ResolvePriceParams { productId: string; customerGroup?: CustomerGroup; quantity?: number; date?: Date }`, `ResolvedPrice { price: Prisma.Decimal; currency: string; tier: PriceTier; sourceId: string }`, `PriceTier = "campaign" | "sale" | "customerGroup" | "volumeDiscount" | "standard"` — consumed by STORY-010/011 (out of scope here) and directly exercised by this task's tests.

- [ ] **Step 1: Write the failing tests for every priority combination named in the AC**

Create `tests/unit/pricing-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  createCampaignPrice,
  createCustomerGroupPrice,
  createSalePrice,
  createStandardPrice,
  createVolumeDiscountTier,
} from "@/repositories/pricing.repository";
import { resolvePrice } from "@/services/pricing.service";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("resolvePrice", () => {
  it("falls back to standard price when nothing else applies", async () => {
    const product = await createProduct({ sku: "SKU-1", slug: "sku-1", name: "A" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });

    const resolved = await resolvePrice({ productId: product.id });

    expect(resolved?.tier).toBe("standard");
    expect(resolved?.price.toString()).toBe("500.00");
  });

  it("returns null when no price tier exists at all", async () => {
    const product = await createProduct({ sku: "SKU-2", slug: "sku-2", name: "B" });

    expect(await resolvePrice({ productId: product.id })).toBeNull();
  });

  it("prefers an active campaign price over an active sale price", async () => {
    const product = await createProduct({ sku: "SKU-3", slug: "sku-3", name: "C" });
    const date = new Date("2026-07-15");
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });
    await createCampaignPrice({
      product: { connect: { id: product.id } },
      campaignId: "flash-sale",
      price: "400.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePrice({ productId: product.id, date });

    expect(resolved?.tier).toBe("campaign");
    expect(resolved?.price.toString()).toBe("400.00");
  });

  it("prefers an active sale price over a customer-group price", async () => {
    const product = await createProduct({ sku: "SKU-4", slug: "sku-4", name: "D" });
    const date = new Date("2026-07-15");
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });
    await createSalePrice({
      product: { connect: { id: product.id } },
      price: "450.00",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-31"),
    });

    const resolved = await resolvePrice({
      productId: product.id,
      date,
      customerGroup: "Wholesale",
    });

    expect(resolved?.tier).toBe("sale");
    expect(resolved?.price.toString()).toBe("450.00");
  });

  it("gives a wholesale customer group price priority over a volume discount", async () => {
    const product = await createProduct({ sku: "SKU-5", slug: "sku-5", name: "E" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createCustomerGroupPrice({
      product: { connect: { id: product.id } },
      customerGroup: "Wholesale",
      price: "420.00",
    });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({
      productId: product.id,
      customerGroup: "Wholesale",
      quantity: 20,
    });

    expect(resolved?.tier).toBe("customerGroup");
    expect(resolved?.price.toString()).toBe("420.00");
  });

  it("applies a qualifying volume discount when no higher tier matches", async () => {
    const product = await createProduct({ sku: "SKU-6", slug: "sku-6", name: "F" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 15 });

    expect(resolved?.tier).toBe("volumeDiscount");
    expect(resolved?.price.toString()).toBe("410.00");
  });

  it("computes a percentage volume discount off the standard price", async () => {
    const product = await createProduct({ sku: "SKU-7", slug: "sku-7", name: "G" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPercent: "10.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 10 });

    expect(resolved?.tier).toBe("volumeDiscount");
    expect(resolved?.price.toString()).toBe("450");
  });

  it("does not apply a volume discount below its minimum quantity", async () => {
    const product = await createProduct({ sku: "SKU-8", slug: "sku-8", name: "H" });
    await createStandardPrice({ product: { connect: { id: product.id } }, price: "500.00" });
    await createVolumeDiscountTier({
      product: { connect: { id: product.id } },
      minQuantity: 10,
      discountPrice: "410.00",
    });

    const resolved = await resolvePrice({ productId: product.id, quantity: 5 });

    expect(resolved?.tier).toBe("standard");
    expect(resolved?.price.toString()).toBe("500.00");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- pricing-service`
Expected: FAIL with "Cannot find module '@/services/pricing.service'" (the file doesn't exist yet)

- [ ] **Step 3: Implement `resolvePrice()`**

Create `src/services/pricing.service.ts`:

```ts
import type { CustomerGroup, Prisma } from "@/generated/prisma/client";
import * as pricingRepository from "@/repositories/pricing.repository";

export interface ResolvePriceParams {
  productId: string;
  customerGroup?: CustomerGroup;
  quantity?: number;
  date?: Date;
}

export type PriceTier = "campaign" | "sale" | "customerGroup" | "volumeDiscount" | "standard";

export interface ResolvedPrice {
  price: Prisma.Decimal;
  currency: string;
  tier: PriceTier;
  sourceId: string;
}

interface PriceRow {
  id: string;
  price: Prisma.Decimal;
  currency: string;
}

/**
 * Resolves the price a customer pays for a product.
 *
 * Priority order (first match wins): campaign > sale > customer-group >
 * volume-discount > standard. Ties within a tier (e.g. two overlapping
 * SalePrice windows) are broken by most-recently-created row — the
 * repository layer's `getActive*` functions already return rows ordered
 * `createdAt desc`, so `[0]` is always the tie-break winner. Volume
 * discount tiers are the one exception: they're ordered by highest
 * `minQuantity` first (the deepest applicable discount), falling back to
 * most-recently-created only when two tiers share a `minQuantity`.
 *
 * Returns null if no tier applies at all (caller should treat this as
 * "no price configured for this product").
 */
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

function toResolvedPrice(row: PriceRow, tier: PriceTier): ResolvedPrice {
  return { price: row.price, currency: row.currency, tier, sourceId: row.id };
}

function computeVolumeDiscountPrice(
  tier: { discountPrice: Prisma.Decimal | null; discountPercent: Prisma.Decimal | null },
  standard: PriceRow | null,
): Prisma.Decimal {
  if (tier.discountPrice) return tier.discountPrice;
  if (tier.discountPercent && standard) {
    const { Decimal } = standard.price.constructor as typeof Prisma.Decimal;
    const multiplier = new Decimal(100).minus(tier.discountPercent).dividedBy(100);
    return standard.price.times(multiplier);
  }
  throw new Error(
    "VolumeDiscountTier has neither a discountPrice nor a standard price to apply discountPercent to",
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- pricing-service`
Expected: `8 passed`. If `computeVolumeDiscountPrice`'s `standard.price.constructor as typeof Prisma.Decimal` line raises a type error, replace it with a direct import instead — add `import { Prisma as PrismaRuntime } from "@/generated/prisma/client";` is redundant with the existing `Prisma` type import, so instead change the `Prisma` import at the top of the file from `import type { CustomerGroup, Prisma } from "@/generated/prisma/client";` to `import { Prisma, type CustomerGroup } from "@/generated/prisma/client";` (drop `type` from `Prisma` since it's now used as a value for `Prisma.Decimal`), then simplify the multiplier line to `const multiplier = new Prisma.Decimal(100).minus(tier.discountPercent).dividedBy(100);`.

- [ ] **Step 5: Commit**

```bash
git add src/services/pricing.service.ts tests/unit/pricing-service.test.ts
git commit -m "feat: implement resolvePrice() pricing engine"
```

---

### Task 11: `product.service.ts`, `category.service.ts`, `collection.service.ts`

**Files:**
- Create: `src/services/product.service.ts`
- Create: `src/services/category.service.ts`
- Create: `src/services/collection.service.ts`
- Test: `tests/unit/product-service.test.ts`
- Test: `tests/unit/category-service.test.ts`
- Test: `tests/unit/collection-service.test.ts`

**Interfaces:**
- Consumes: `product.repository.ts` (Task 4–8), `category.repository.ts` (Task 1), `collection.repository.ts` (Task 3–4)
- Produces: `getProductBySlug(slug: string): Promise<Product | null>` (storefront-safe, `Published` only), `getProductBySlugForAdmin(slug: string): Promise<Product | null>` (any status), `listPublishedProductsByCategory(categoryId: string): Promise<Product[]>` in `product.service.ts`; `getCategoryTreeForStorefront(): Promise<CategoryTreeNode[]>` (only `Active` nodes) in `category.service.ts`; `getPublishedCollectionBySlug(slug: string, date?: Date): Promise<Collection | null>` in `collection.service.ts`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/product-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { getProductBySlug, getProductBySlugForAdmin } from "@/services/product.service";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("product.service", () => {
  it("returns a published product to storefront callers", async () => {
    await createProduct({
      sku: "SKU-1",
      slug: "curry-powder",
      name: "Curry Powder",
      status: "Published",
    });

    const found = await getProductBySlug("curry-powder");

    expect(found?.slug).toBe("curry-powder");
  });

  it("hides a draft product from storefront callers", async () => {
    await createProduct({ sku: "SKU-2", slug: "wip-product", name: "WIP", status: "Draft" });

    expect(await getProductBySlug("wip-product")).toBeNull();
  });

  it("returns a draft product to admin callers", async () => {
    await createProduct({ sku: "SKU-3", slug: "wip-product-2", name: "WIP 2", status: "Draft" });

    const found = await getProductBySlugForAdmin("wip-product-2");

    expect(found?.slug).toBe("wip-product-2");
  });
});
```

Create `tests/unit/category-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCategory } from "@/repositories/category.repository";
import { getCategoryTreeForStorefront } from "@/services/category.service";

afterEach(async () => {
  await prisma.category.deleteMany();
});

describe("category.service", () => {
  it("excludes inactive categories from the storefront tree", async () => {
    await createCategory({ name: "Spices", slug: "spices", status: "Active" });
    await createCategory({ name: "Discontinued Line", slug: "discontinued", status: "Inactive" });

    const tree = await getCategoryTreeForStorefront();

    expect(tree.map((c) => c.slug)).toEqual(["spices"]);
  });
});
```

Create `tests/unit/collection-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCollection } from "@/repositories/collection.repository";
import { getPublishedCollectionBySlug } from "@/services/collection.service";

afterEach(async () => {
  await prisma.collection.deleteMany();
});

describe("collection.service", () => {
  it("returns an active collection within its date window", async () => {
    await createCollection({
      name: "Avurudu 2026",
      slug: "avurudu-2026",
      status: "Active",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    const found = await getPublishedCollectionBySlug("avurudu-2026", new Date("2026-04-15"));

    expect(found?.slug).toBe("avurudu-2026");
  });

  it("returns null for an inactive collection", async () => {
    await createCollection({ name: "Retired", slug: "retired", status: "Inactive" });

    expect(await getPublishedCollectionBySlug("retired")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- product-service category-service collection-service`
Expected: FAIL with "Cannot find module" errors for all three service files

- [ ] **Step 3: Implement the three services**

Create `src/services/product.service.ts`:

```ts
import * as productRepository from "@/repositories/product.repository";

export function getProductBySlug(slug: string) {
  return productRepository.findProductBySlug(slug).then((product) => {
    if (!product || product.status !== "Published") return null;
    return product;
  });
}

export function getProductBySlugForAdmin(slug: string) {
  return productRepository.findProductBySlug(slug);
}

export async function listPublishedProductsByCategory(categoryId: string) {
  const products = await productRepository.listProductsByCategory(categoryId);
  return products.filter((product) => product.status === "Published");
}
```

Create `src/services/category.service.ts`:

```ts
import * as categoryRepository from "@/repositories/category.repository";
import type { CategoryTreeNode } from "@/repositories/category.repository";

function pruneInactive(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes
    .filter((node) => node.status === "Active")
    .map((node) => ({ ...node, children: pruneInactive(node.children) }));
}

export async function getCategoryTreeForStorefront(): Promise<CategoryTreeNode[]> {
  const tree = await categoryRepository.getCategoryTree();
  return pruneInactive(tree);
}
```

Create `src/services/collection.service.ts`:

```ts
import * as collectionRepository from "@/repositories/collection.repository";

export async function getPublishedCollectionBySlug(slug: string, date: Date = new Date()) {
  const collection = await collectionRepository.findCollectionBySlug(slug);
  if (!collection || collection.status !== "Active") return null;
  if (collection.startDate && collection.endDate) {
    if (date < collection.startDate || date > collection.endDate) return null;
  }
  return collection;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- product-service category-service collection-service`
Expected: `3 passed`, `1 passed`, `2 passed`

- [ ] **Step 5: Commit**

```bash
git add src/services/product.service.ts src/services/category.service.ts src/services/collection.service.ts tests/unit/product-service.test.ts tests/unit/category-service.test.ts tests/unit/collection-service.test.ts
git commit -m "feat: add product, category, and collection services with published-only filtering"
```

---

### Task 12: Zod validation schemas

**Files:**
- Create: `src/validation/product.schema.ts`
- Create: `src/validation/pricing.schema.ts`
- Test: `tests/unit/product-schema.test.ts`
- Test: `tests/unit/pricing-schema.test.ts`

**Interfaces:**
- Consumes: nothing (pure Zod, no DB) — these are `@vitest-environment jsdom` (the default), not `node`
- Produces: `productCreateSchema`, `ProductCreateInput` (`z.infer`) in `product.schema.ts`; `standardPriceSchema`, `salePriceSchema`, `campaignPriceSchema`, `customerGroupPriceSchema`, `volumeDiscountTierSchema`, `resolvePriceParamsSchema` (each paired with a `z.infer` type) in `pricing.schema.ts` — consumed by STORY-040's admin UI (out of scope here).

Note on AC coverage: the story's AC lists "duplicate slug" among the invalid payloads Zod should reject. Zod validates shape, not database state, so it structurally cannot detect a duplicate slug — that's a DB-level unique-constraint concern. It's already covered by the repository tests in Task 1 (`category-repository.test.ts`, "rejects a duplicate slug") and Task 4 (`product-repository.test.ts`, "rejects a duplicate SKU"). This task's Zod tests cover the payload-shape validations the AC also lists: missing SKU, negative price, invalid date range.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/product-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { productCreateSchema } from "@/validation/product.schema";

const validProduct = {
  sku: "ORI-CP-100",
  slug: "curry-powder-100g",
  name: "Roasted Curry Powder 100g",
  status: "Published" as const,
  productType: "Standard" as const,
};

describe("productCreateSchema", () => {
  it("accepts a minimal valid product", () => {
    expect(productCreateSchema.safeParse(validProduct).success).toBe(true);
  });

  it("rejects a product with no SKU", () => {
    const { sku, ...withoutSku } = validProduct;
    void sku;

    expect(productCreateSchema.safeParse(withoutSku).success).toBe(false);
  });

  it("rejects an empty slug", () => {
    const result = productCreateSchema.safeParse({ ...validProduct, slug: "" });

    expect(result.success).toBe(false);
  });

  it("accepts nested nutrition data within range", () => {
    const result = productCreateSchema.safeParse({
      ...validProduct,
      nutrition: {
        servingSize: "1 tsp (5g)",
        calories: 18,
        protein: 0.8,
        fat: 0.7,
        saturatedFat: 0.1,
        carbohydrates: 2.5,
        sugar: 0.3,
        fibre: 1.1,
        sodium: 2,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative nutrition values", () => {
    const result = productCreateSchema.safeParse({
      ...validProduct,
      nutrition: {
        servingSize: "1 tsp (5g)",
        calories: -18,
        protein: 0.8,
        fat: 0.7,
        saturatedFat: 0.1,
        carbohydrates: 2.5,
        sugar: 0.3,
        fibre: 1.1,
        sodium: 2,
      },
    });

    expect(result.success).toBe(false);
  });
});
```

Create `tests/unit/pricing-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  resolvePriceParamsSchema,
  salePriceSchema,
  standardPriceSchema,
  volumeDiscountTierSchema,
} from "@/validation/pricing.schema";

describe("standardPriceSchema", () => {
  it("rejects a negative price", () => {
    expect(standardPriceSchema.safeParse({ productId: "p1", price: -5 }).success).toBe(false);
  });

  it("accepts a zero-or-positive price", () => {
    expect(standardPriceSchema.safeParse({ productId: "p1", price: 0 }).success).toBe(true);
  });
});

describe("salePriceSchema", () => {
  it("rejects an endDate before startDate", () => {
    const result = salePriceSchema.safeParse({
      productId: "p1",
      price: 100,
      startDate: new Date("2026-07-10"),
      endDate: new Date("2026-07-01"),
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid date range", () => {
    const result = salePriceSchema.safeParse({
      productId: "p1",
      price: 100,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-07-10"),
    });

    expect(result.success).toBe(true);
  });
});

describe("volumeDiscountTierSchema", () => {
  it("rejects a tier with neither discountPrice nor discountPercent", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a tier with both discountPrice and discountPercent", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
      discountPrice: 400,
      discountPercent: 10,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a tier with exactly one discount type", () => {
    const result = volumeDiscountTierSchema.safeParse({
      productId: "p1",
      minQuantity: 10,
      discountPercent: 10,
    });

    expect(result.success).toBe(true);
  });
});

describe("resolvePriceParamsSchema", () => {
  it("accepts params with only productId", () => {
    expect(resolvePriceParamsSchema.safeParse({ productId: "p1" }).success).toBe(true);
  });

  it("rejects a negative quantity", () => {
    expect(
      resolvePriceParamsSchema.safeParse({ productId: "p1", quantity: -1 }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- product-schema pricing-schema`
Expected: FAIL with "Cannot find module" errors for both schema files

- [ ] **Step 3: Implement `product.schema.ts`**

Create `src/validation/product.schema.ts`:

```ts
import { z } from "zod";

const nutritionSchema = z.object({
  servingSize: z.string().min(1),
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  saturatedFat: z.number().nonnegative(),
  carbohydrates: z.number().nonnegative(),
  sugar: z.number().nonnegative(),
  fibre: z.number().nonnegative(),
  sodium: z.number().nonnegative(),
});

const ingredientSchema = z.object({
  name: z.string().min(1),
  isAllergen: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

const imageSchema = z.object({
  url: z.string().min(1),
  altText: z.string().optional(),
  isPrimary: z.boolean().default(false),
  mediaRole: z.enum(["Gallery", "Lifestyle", "Video"]).default("Gallery"),
  sortOrder: z.number().int().nonnegative().default(0),
});

export const productCreateSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  slug: z.string().min(1, "Slug is required"),
  name: z.string().min(1, "Name is required"),
  shortDescription: z.string().optional(),
  story: z.string().optional(),
  status: z.enum(["Draft", "Review", "Published", "Archived", "Discontinued", "OutOfSeason"]),
  productType: z.enum(["Standard", "Bundle", "GiftPack", "Seasonal", "LimitedEdition"]),
  brandId: z.string().optional(),
  categoryIds: z.array(z.string()).default([]),
  collectionIds: z.array(z.string()).default([]),
  rewardPoints: z.number().int().nonnegative().default(0),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  canonicalUrl: z.string().optional(),
  ogImage: z.string().optional(),
  nutrition: nutritionSchema.optional(),
  ingredients: z.array(ingredientSchema).default([]),
  allergenIds: z.array(z.string()).default([]),
  certificationIds: z.array(z.string()).default([]),
  images: z.array(imageSchema).default([]),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
```

- [ ] **Step 4: Implement `pricing.schema.ts`**

Create `src/validation/pricing.schema.ts`:

```ts
import { z } from "zod";

const customerGroupEnum = z.enum(["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"]);

export const standardPriceSchema = z.object({
  productId: z.string().min(1),
  price: z.number().nonnegative(),
  currency: z.string().default("LKR"),
});

export type StandardPriceInput = z.infer<typeof standardPriceSchema>;

const dateRangeSchema = z
  .object({
    startDate: z.date(),
    endDate: z.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const salePriceSchema = z
  .object({
    productId: z.string().min(1),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
  })
  .and(dateRangeSchema);

export type SalePriceInput = z.infer<typeof salePriceSchema>;

export const campaignPriceSchema = z
  .object({
    productId: z.string().min(1),
    campaignId: z.string().min(1),
    price: z.number().nonnegative(),
    currency: z.string().default("LKR"),
  })
  .and(dateRangeSchema);

export type CampaignPriceInput = z.infer<typeof campaignPriceSchema>;

export const customerGroupPriceSchema = z.object({
  productId: z.string().min(1),
  customerGroup: customerGroupEnum,
  price: z.number().nonnegative(),
  currency: z.string().default("LKR"),
});

export type CustomerGroupPriceInput = z.infer<typeof customerGroupPriceSchema>;

export const volumeDiscountTierSchema = z
  .object({
    productId: z.string().min(1),
    minQuantity: z.number().int().positive(),
    discountPrice: z.number().nonnegative().optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    currency: z.string().default("LKR"),
  })
  .refine(
    (data) => (data.discountPrice !== undefined) !== (data.discountPercent !== undefined),
    {
      message: "Exactly one of discountPrice or discountPercent is required",
      path: ["discountPrice"],
    },
  );

export type VolumeDiscountTierInput = z.infer<typeof volumeDiscountTierSchema>;

export const resolvePriceParamsSchema = z.object({
  productId: z.string().min(1),
  customerGroup: customerGroupEnum.optional(),
  quantity: z.number().int().positive().optional(),
  date: z.date().optional(),
});

export type ResolvePriceParamsInput = z.infer<typeof resolvePriceParamsSchema>;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test -- product-schema pricing-schema`
Expected: `5 passed`, `8 passed`

- [ ] **Step 6: Commit**

```bash
git add src/validation/product.schema.ts src/validation/pricing.schema.ts tests/unit/product-schema.test.ts tests/unit/pricing-schema.test.ts
git commit -m "feat: add Zod validation schemas for product and pricing payloads"
```

---

### Task 13: Seed data

**Files:**
- Create: `prisma/seed.ts`
- Modify: `prisma.config.ts` (register the seed command)
- Modify: `package.json` (add `prisma.seed` config, if not using `prisma.config.ts` for it — see Step 2)

**Interfaces:**
- Consumes: every repository function from Tasks 1–9
- Produces: no exported interface — this is a standalone script run via `npx prisma db seed`

- [ ] **Step 1: Write the seed script**

Create `prisma/seed.ts`:

```ts
import { prisma } from "../src/lib/db";
import * as brandRepository from "../src/repositories/brand.repository";
import * as categoryRepository from "../src/repositories/category.repository";
import * as collectionRepository from "../src/repositories/collection.repository";
import * as productRepository from "../src/repositories/product.repository";
import * as pricingRepository from "../src/repositories/pricing.repository";

async function main() {
  const brand = await brandRepository.createBrand({
    name: "Oristor",
    slug: "oristor",
    description: "Premium Sri Lankan spices and food products.",
  });

  const spices = await categoryRepository.createCategory({
    name: "Spices & Curry Powders",
    slug: "spices-curry-powders",
  });
  const giftSets = await categoryRepository.createCategory({
    name: "Gift Sets",
    slug: "gift-sets",
  });

  const avurudu = await collectionRepository.createCollection({
    name: "Avurudu 2026",
    slug: "avurudu-2026",
    status: "Active",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-04-30"),
  });

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
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: spices.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: curryPowder.id } },
    price: "550.00",
  });
  await pricingRepository.createSalePrice({
    product: { connect: { id: curryPowder.id } },
    price: "495.00",
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-31"),
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Wholesale",
    price: "450.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Distributor",
    price: "420.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Export",
    price: "480.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "PrivateLabel",
    price: "410.00",
  });
  await pricingRepository.createVolumeDiscountTier({
    product: { connect: { id: curryPowder.id } },
    minQuantity: 24,
    discountPercent: "12.00",
  });
  await productRepository.setProductNutrition({
    product: { connect: { id: curryPowder.id } },
    servingSize: "1 tsp (5g)",
    calories: "18.00",
    protein: "0.80",
    fat: "0.70",
    saturatedFat: "0.10",
    carbohydrates: "2.50",
    sugar: "0.30",
    fibre: "1.10",
    sodium: "2.00",
  });
  await productRepository.addProductIngredient({
    product: { connect: { id: curryPowder.id } },
    name: "Coriander",
    sortOrder: 1,
  });
  await productRepository.addProductIngredient({
    product: { connect: { id: curryPowder.id } },
    name: "Cumin",
    sortOrder: 2,
  });
  await productRepository.addProductImage({
    product: { connect: { id: curryPowder.id } },
    url: "/images/products/roasted-curry-powder-100g.jpg",
    isPrimary: true,
    sortOrder: 1,
  });

  const chilliPowder = await productRepository.createProduct({
    sku: "ORI-CHP-100",
    slug: "chilli-powder-100g",
    name: "Chilli Powder 100g",
    status: "Published",
    productType: "Standard",
    publishedAt: new Date(),
    rewardPoints: 8,
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: spices.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: chilliPowder.id } },
    price: "480.00",
  });

  const giftSet = await productRepository.createProduct({
    sku: "ORI-GIFT-001",
    slug: "curry-lovers-gift-set",
    name: "Curry Lover's Gift Set",
    status: "Published",
    productType: "Bundle",
    publishedAt: new Date(),
    rewardPoints: 25,
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: giftSets.id }] },
  });
  const bundle = await productRepository.createBundle({
    product: { connect: { id: giftSet.id } },
    priceOverride: "1200.00",
  });
  await productRepository.addBundleItem({
    bundle: { connect: { id: bundle.id } },
    componentProduct: { connect: { id: curryPowder.id } },
    quantity: 2,
  });
  await productRepository.addBundleItem({
    bundle: { connect: { id: bundle.id } },
    componentProduct: { connect: { id: chilliPowder.id } },
    quantity: 1,
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: giftSet.id } },
    price: "1200.00",
  });

  const seasonalSweets = await productRepository.createProduct({
    sku: "ORI-AVU-001",
    slug: "avurudu-sweets-pack",
    name: "Avurudu Traditional Sweets Pack",
    status: "Published",
    productType: "Seasonal",
    publishedAt: new Date(),
    rewardPoints: 15,
    brand: { connect: { id: brand.id } },
    collections: { connect: [{ id: avurudu.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: seasonalSweets.id } },
    price: "1500.00",
  });
  await pricingRepository.createCampaignPrice({
    product: { connect: { id: seasonalSweets.id } },
    campaignId: "avurudu-2026-launch",
    price: "1350.00",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-04-15"),
  });

  console.log("Seed complete:", {
    brand: brand.slug,
    categories: [spices.slug, giftSets.slug],
    collection: avurudu.slug,
    products: [curryPowder.slug, chilliPowder.slug, giftSet.slug, seasonalSweets.slug],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: Register the seed command**

In `prisma.config.ts`, add a `migrations.seed` entry (Prisma 7's config-based seed registration — this project has no `prisma.seed` key in `package.json` yet, so it must go here):

```ts
// This file was generated by Prisma, and assumes you have installed the following:
// npm install --save-dev prisma dotenv
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

- [ ] **Step 3: Install `tsx` to run the TypeScript seed script**

Run: `npm install --save-dev tsx`
Expected: adds `tsx` to `devDependencies` in `package.json`

- [ ] **Step 4: Push the schema fresh and run the seed**

Run: `npx prisma db push --force-reset`
Run: `npx prisma db seed`
Expected: the `console.log("Seed complete:", ...)` output listing the brand, categories, collection, and four product slugs, with no errors

- [ ] **Step 5: Verify the seed data manually**

Run: `npx prisma studio` and check the `Product` table has 4 rows, `StandardPrice` has 4 rows, and `CustomerGroupPrice` has one row per `CustomerGroup` value (4 rows) — or verify without a browser via:

```bash
node -e "
const { PrismaClient } = require('./src/generated/prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
require('dotenv/config');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
prisma.product.count().then((n) => console.log('products:', n));
prisma.customerGroupPrice.count().then((n) => console.log('customerGroupPrices:', n));
"
```

Expected: `products: 4` and `customerGroupPrices: 4`

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts prisma.config.ts package.json package-lock.json
git commit -m "feat: add seed script covering every product type and pricing tier"
```

---

### Task 14: Consolidated migration file

**Files:**
- Create: `prisma/migrations/<timestamp>_product_catalogue/migration.sql`
- Delete: `prisma/migrations/20260715034109_init/` (superseded — see Step 1)
- Modify: `prisma/create_migrations_table.sql` (no change needed, reused as-is)

This is the one task that touches Prisma's migration history rather than just `db push`. Per `docs/architecture-decisions.md`, `prisma migrate dev` is unreliable in this environment beyond the very first call — and by this point in the plan, a migration already exists (`20260715034109_init`) plus many `db push` calls have happened, so a plain `migrate dev` here would hit exactly that bug. Instead, this task **regenerates one consolidated migration from the schema file directly** (`migrate diff --from-empty`, proven in this session to need zero database connection at all) and applies it to a completely fresh database, sidestepping the shadow-database bug entirely.

- [ ] **Step 1: Generate the consolidated migration SQL from the schema (no DB involved)**

Run:
```bash
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_product_catalogue"
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_product_catalogue/migration.sql"
```

`$TS` is captured once and reused in both the `mkdir` and the redirect, so the folder name and file always end up in the same directory. Note the resulting folder name (`${TS}_product_catalogue`) — later steps in this task refer back to it.

Expected: a `migration.sql` file containing `CREATE TABLE` statements for all 21 models (`User`, `Account`, `Session`, `VerificationToken`, `Category`, `Brand`, `Collection`, `Product`, `ProductImage`, `ProductVideo`, `ProductNutrition`, `ProductIngredient`, `Allergen`, `Certification`, `ProductBundle`, `BundleItem`, `StandardPrice`, `SalePrice`, `CampaignPrice`, `CustomerGroupPrice`, `VolumeDiscountTier`) plus all enums and indexes.

- [ ] **Step 2: Remove the old auth-only migration**

The new migration recreates `User`/`Account`/`Session`/`VerificationToken` too, so the old migration folder would create duplicates if both were ever replayed together.

Run: `rm -rf prisma/migrations/20260715034109_init`

- [ ] **Step 3: Apply the consolidated migration to a completely fresh local database**

Stop the running `prisma dev` server (find it with `tasklist | grep node` on Windows or `ps aux | grep prisma` elsewhere, then stop it), delete its local data directory so the next start is empty (`%LOCALAPPDATA%\prisma-dev-nodejs\Data` on Windows).

Start a fresh server in the background:

```bash
npx prisma dev
```

Once it logs "Your local Prisma Postgres server ... is now running", apply the migration in three steps against that fresh, empty database:

```bash
npx prisma db execute --file prisma/create_migrations_table.sql
npx prisma db execute --file "prisma/migrations/<the folder from Step 1>/migration.sql"
npx prisma migrate resolve --applied "<the folder name from Step 1>"
```

- [ ] **Step 4: Verify the migration is registered and the schema matches**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!` with the new migration listed as applied

Run: `npx prisma db push`
Expected: `The database is already in sync with the Prisma schema.` (confirms the manually-applied SQL exactly matches the schema — no drift)

- [ ] **Step 5: Re-seed and re-run the full test suite against the freshly migrated database**

Run: `npx prisma db seed`
Expected: same "Seed complete" output as Task 13

Run: `npm run test`
Expected: every test file from Tasks 1–13 passes (the global setup's `db push --force-reset` re-syncs before the run, so this also re-validates the schema independent of the manual migration apply)

- [ ] **Step 6: Commit**

```bash
git add prisma/migrations
git commit -m "feat: consolidate product catalogue schema into a single committed migration"
```

---

### Task 15: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md` (append a new dated entry)
- Modify: `docs/stories/03-product-platform/STORY-009-product-catalogue-data-model.md` (mark all acceptance criteria and tasks complete, update status)
- Modify: `docs/stories/README.md` (update STORY-009 status)

- [ ] **Step 1: Document the pricing priority order and schema summary**

Append to `docs/architecture-decisions.md`:

```markdown

## 2026-07-15 — STORY-009 Product Catalogue Data Model

**Schema summary (21 models):** `User`/`Account`/`Session`/`VerificationToken`
(Auth.js, STORY-001) plus 17 catalogue models added in this story —
`Category` (self-referential tree), `Brand`, `Collection` (manual or
rule-based via a `rules Json?` field), `Product` (the hub — FKs to `Brand`,
m2m to `Category`/`Collection`/`Allergen`/`Certification`, 1-1 to
`ProductNutrition`/`ProductBundle`), `ProductImage`/`ProductVideo`
(ordered gallery), `ProductIngredient`, `ProductBundle`/`BundleItem`, and
five pricing-tier models — `StandardPrice`, `SalePrice`, `CampaignPrice`,
`CustomerGroupPrice`, `VolumeDiscountTier`.

**Pricing priority order** (implemented in `src/services/pricing.service.ts`,
`resolvePrice()`): campaign > sale > customer-group > volume-discount >
standard — first tier with a currently-active, applicable row wins. Ties
within a tier (e.g. two overlapping `SalePrice` windows) are broken by
most-recently-created row. `VolumeDiscountTier` is the one tier with
additional internal ordering: the highest `minQuantity` that's still `<=`
the requested quantity wins (deepest applicable discount), falling back to
most-recently-created only when two tiers share a `minQuantity`. See the
doc comment directly above `resolvePrice()` for the authoritative
statement of this algorithm.

**Money representation:** every price field is `Decimal @db.Decimal(10, 2)`
(avoids floating-point rounding). Every price row also carries
`currency String @default("LKR")` — a forward-compatible column for the
multi-currency scope blueprint Section 10 leaves unresolved; no conversion
logic exists yet.

**Migration history note:** the original STORY-001 migration
(`20260715034109_init`, auth tables only) was superseded by this story's
consolidated migration, generated via `prisma migrate diff --from-empty
--to-schema` (no database connection needed — avoids the PGlite
shadow-database bug documented in this file's STORY-001 entry above) and
applied via `db execute` + `migrate resolve --applied`. See Task 14 of
`docs/superpowers/plans/2026-07-15-product-catalogue-data-model.md` for
the exact recipe if another consolidated migration is ever needed.

**Blueprint field coverage** (Section 5, Commerce/Catalogue/Pricing
engine paragraphs): SKU/barcode/slug/images/videos/nutrition/
ingredients/allergens/certifications/SEO fields/reward points — all
present on `Product` and its related models, per the acceptance criteria
in STORY-009. All nine pricing models named in the blueprint (standard,
sale, campaign, customer-group, wholesale, distributor, export,
private-label, volume-discount) are covered by the five schema models —
wholesale/distributor/export/private-label are the four `CustomerGroup`
enum values on `CustomerGroupPrice`, not four separate tables, per the
acceptance criteria's own model list.
```

- [ ] **Step 2: Mark STORY-009 acceptance criteria and tasks complete**

In `docs/stories/03-product-platform/STORY-009-product-catalogue-data-model.md`, change the `**Status:**` line from `Draft` to:

```markdown
**Status:** Done — implemented per `docs/superpowers/plans/2026-07-15-product-catalogue-data-model.md`
```

Change every `- [ ]` under "Acceptance Criteria" and "Tasks" to `- [x]`.

- [ ] **Step 3: Update the story backlog status table**

In `docs/stories/README.md`, change the STORY-009 row:

```markdown
| STORY-009 | Product Catalogue Data Model | Done |
```

- [ ] **Step 4: Run full verification**

Run: `npm run lint`
Expected: no errors

Run: `npx tsc --noEmit`
Expected: no errors

Run: `npm run test`
Expected: all tests pass (existing frontend tests + every test file added in Tasks 1–13)

Run: `npm run build`
Expected: production build succeeds

- [ ] **Step 5: Commit**

```bash
git add docs/architecture-decisions.md docs/stories/03-product-platform/STORY-009-product-catalogue-data-model.md docs/stories/README.md
git commit -m "docs: mark STORY-009 done, document pricing engine and schema summary"
```
