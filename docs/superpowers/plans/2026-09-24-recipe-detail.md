# STORY-018 Recipe Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the customer-facing `/recipes/[slug]` Recipe Detail Page: ingredients (with product links), method steps, nutrition, chef notes, a client-side serving-size adjuster, print/share actions, related recipes, and the "recipes using this product" reverse lookup consumed by the Product Detail Page.

**Architecture:** Server Component page (`recipes/[slug]/page.tsx`) fetches one aggregated detail payload through `recipe.service.ts` → `recipe.repository.ts` (Prisma). Two new child tables (`RecipeIngredient`, `RecipeStep`) extend the `Recipe` model added in STORY-017. Serving-size scaling and the print/share bar are isolated Client Components; scaling math is a pure, server-independent function. The "recipes using this product" link reuses the extension-point pattern STORY-015/016 already established in `product-detail-extensions.ts` — no new public route.

**Tech Stack:** Next.js 16 Server/Client Components, Prisma 7 (`@prisma/adapter-pg`), Zod, Vitest, Playwright, Tailwind v4.

**Spec:** `docs/stories/04-recipes-food-academy/STORY-018-recipe-detail-page.md` (acceptance criteria/tasks) and `docs/superpowers/specs/2026-09-24-recipe-detail-design.md` (design decisions this plan implements — print approach, nutrition shape, extension-point reuse, share-button reuse). Executors read both.

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types.
- Database access only through the Repository layer; routes/components call Services, Services call Repositories (`CLAUDE.md`).
- `Recipe.totalTimeMinutes` is always derived via `computeTotalTimeMinutes()` — never set directly.
- Only `status: "Published"` recipes are ever visible on the storefront (same invariant as `buildRecipeWhere` in STORY-017).
- Every sort/order query ends with a tiebreaker on a unique column (existing pattern in `buildRecipeOrderBy`).
- New Client Components stay isolated (`ServingSizeAdjuster`, `RecipePrintShareBar`); the page itself and all read-only display components (`RecipeHero`, `IngredientsList`, `MethodSteps`, `NutritionPanel`, `ChefNotes`, `RelatedRecipes`) are Server Components.
- `DATABASE_POOL_MAX=1` must be set in this worktree's `.env` (PGlite supports one connection) — already done during worktree setup.
- Conventional Commits for every commit (`feat:`, `test:`, `fix:`, `docs:`).

## Review Focus

- **Non-existent or unpublished slug** → the route must call Next's `notFound()` and render the 404 page, never leak a raw 500 or a Draft/Review recipe's content. Covered in Task 7 (route) and Task 11 (page) tests.
- **Ingredient with no matching product** (`productId: null`) → renders as plain text, not a broken/empty link. Covered in Task 9 (`IngredientLink`).
- **Serving size at the extremes (1 and 50)** and a **fractional base quantity** (e.g. `0.5 cup`) → scaling must not divide by zero, go negative, or render `NaN`/`Infinity`. Covered in Task 3 (`recipe-scaling.ts` unit tests).
- **`navigator.share` unavailable** (most desktop browsers) → the native share button must not render at all, not render disabled or throw. Covered in Task 8 (`ShareButtons`).
- **A recipe with zero related recipes** (unique category/cuisine/tags) → `RelatedRecipes` must render nothing (no empty heading, no broken grid), not crash. Covered in Task 9.

---

## Task 1: Database — extend `Recipe`, add `RecipeIngredient` and `RecipeStep`

**Files:**
- Modify: `prisma/schema.prisma` (the `Recipe` model, plus two new models)
- Create: `prisma/migrations/<timestamp>_add_recipe_detail/migration.sql` (generated, not hand-written)
- Modify: `prisma/seed-recipes.ts` (add ingredients/steps/nutrition to every seeded recipe)

**Interfaces:**
- Produces: `Recipe.chefNotes: String?`, `nutritionCalories/Protein/Carbs/Fat/Fiber/Sodium: Int?`, `galleryImageUrls: String[]`; `RecipeIngredient { id, recipeId, productId?, quantity: Decimal, unit: String, displayText: String, sortOrder: Int }`; `RecipeStep { id, recipeId, stepNumber: Int, instruction: String, imageUrl: String? }`. Later tasks' Prisma queries (Task 2) select these fields/relations by these exact names.

- [ ] **Step 1: Add the new fields and models to the schema**

In `prisma/schema.prisma`, extend the existing `Recipe` model (after `metaDescription`, before `dietaryTags`):

```prisma
  metaTitle        String?
  metaDescription  String?
  chefNotes        String?
  nutritionCalories Int?
  nutritionProtein  Int?
  nutritionCarbs    Int?
  nutritionFat      Int?
  nutritionFiber    Int?
  nutritionSodium   Int?
  galleryImageUrls String[]           @default([])
  ingredients      RecipeIngredient[]
  steps            RecipeStep[]
  dietaryTags      RecipeDietaryTag[]
```

Add two new models below the `Recipe` model:

```prisma
model RecipeIngredient {
  id        String   @id @default(cuid())
  recipeId  String
  recipe    Recipe   @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  productId String?
  product   Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  quantity  Decimal? @db.Decimal(8, 2)
  unit      String?
  // Name/description ONLY — never includes quantity or unit. The rendered
  // line is always composed at read time as "{scaled quantity} {unit}
  // {displayText}" when quantity+unit are set, else just "{displayText}"
  // (see IngredientLink in Task 9). Baking "2 tbsp" into this field would
  // double up with the scaled quantity once servings are adjusted.
  displayText String
  sortOrder   Int

  @@index([recipeId, sortOrder])
  @@index([productId])
}

model RecipeStep {
  id          String  @id @default(cuid())
  recipeId    String
  recipe      Recipe  @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  stepNumber  Int
  instruction String
  imageUrl    String?

  @@unique([recipeId, stepNumber])
}
```

`quantity` is nullable `Decimal` (not a required numeric) because some ingredients are "to taste" / "a pinch" with no scalable amount — `displayText` always carries the human-readable form ("2 cups basmati rice", "Salt, to taste"), and the scaling function (Task 3) only touches ingredients that have both `quantity` and `unit`.

Add the inverse relation on `Product` (find the `Product` model's relation list, e.g. near `categories`/`collections`) — add one line:

```prisma
  recipeIngredients RecipeIngredient[]
```

- [ ] **Step 2: Restart the local DB and generate the migration**

Per `CLAUDE.md`'s local DB workflow, `db push` is for iteration but a real migration file must be generated and committed. From this worktree:

```bash
npx prisma migrate dev --name add_recipe_detail
```

Expected: Prisma detects the diff, writes `prisma/migrations/<timestamp>_add_recipe_detail/migration.sql`, and applies it. If it fails with a PGlite lock error, restart the dev DB server first (`npx prisma dev --detach --db-port 51214 --shadow-db-port 51215`, waiting ~20s after any prior kill), then retry.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client ... to .\src\generated\prisma` with no errors, and `RecipeIngredient` / `RecipeStep` types now exist in `@/generated/prisma/client`.

- [ ] **Step 4: Add ingredients, steps and nutrition to the seed data**

Open `prisma/seed-recipes.ts`. Each seeded recipe object currently ends after its dietary tags / base fields. For every recipe in the seed array, add:

```typescript
  chefNotes: "Toast the spices whole and grind them fresh — it makes a real difference to the final flavour.",
  nutritionCalories: 420,
  nutritionProtein: 18,
  nutritionCarbs: 52,
  nutritionFat: 14,
  nutritionFiber: 6,
  nutritionSodium: 680,
  // displayText is the ingredient NAME only — see the schema comment on
  // RecipeIngredient.displayText. Quantity/unit are composed onto it at
  // render time, so they are never repeated inside displayText itself.
  ingredients: [
    { productId: curryPowderProductId, quantity: 2, unit: "tbsp", displayText: "Oristor Curry Powder", sortOrder: 1 },
    { productId: null, quantity: 1, unit: "cup", displayText: "Basmati rice", sortOrder: 2 },
    { productId: null, quantity: null, unit: null, displayText: "Salt, to taste", sortOrder: 3 },
  ],
  steps: [
    { stepNumber: 1, instruction: "Rinse the rice until the water runs clear, then soak for 20 minutes." },
    { stepNumber: 2, instruction: "Heat oil in a heavy-bottomed pot and toast the curry powder for 30 seconds.", imageUrl: null },
  ],
```

Vary the exact values per recipe (at least one ingredient linked to a real seeded `Product` id from `prisma/seed.ts`'s product list, at least one unlinked, at least one with no `quantity`/`unit`; 3-6 steps per recipe) so Task 2's queries and Task 9's `IngredientLink` component have real linked/unlinked cases to render against in manual testing. Update the `prisma.recipe.create` call (or however recipes are currently inserted) to pass `ingredients: { create: [...] }` and `steps: { create: [...] }` as nested writes alongside the existing fields.

- [ ] **Step 5: Reseed and verify**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx prisma/seed.ts
```

Expected: exits 0. Then spot-check with `npx prisma studio` (or a one-off query) that at least one `Recipe` row has `steps.length > 0` and `ingredients.length > 0`, with at least one ingredient's `productId` populated.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed-recipes.ts
git commit -m "feat: add RecipeIngredient, RecipeStep and nutrition/chef-notes fields"
```

---

## Task 2: Repository — detail, related, and by-product queries

**Files:**
- Modify: `src/repositories/recipe.repository.ts`
- Test: `tests/unit/recipe-repository.test.ts` (existing file — add to it)

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`; `recipeCardSelect`, `RecipeCardRow`, `buildRecipeOrderBy` (existing, Task-1-independent).
- Produces: `recipeDetailSelect` (Prisma select object), `RecipeDetailRow` (its payload type), `findPublishedRecipeBySlug(slug: string): Promise<RecipeDetailRow | null>`, `findRelatedRecipes(recipe: { id: string; categoryId: string; cuisine: string | null }, limit: number): Promise<RecipeCardRow[]>`, `findRecipesByProductId(productId: string, limit: number): Promise<RecipeCardRow[]>`, `incrementRecipeViewCount(recipeId: string): Promise<void>`. Task 5's service imports all five by these exact names.

- [ ] **Step 1: Write the failing repository test**

Add to `tests/unit/recipe-repository.test.ts` (it already has a Prisma-backed setup/teardown for other `recipe.repository.ts` tests — follow that file's existing `beforeEach`/seeding helpers for category/product/recipe fixtures):

```typescript
describe("findPublishedRecipeBySlug", () => {
  it("returns null for a slug that doesn't exist", async () => {
    const result = await findPublishedRecipeBySlug("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns null for a Draft recipe", async () => {
    const draft = await createTestRecipe({ status: "Draft", slug: "draft-recipe" });
    const result = await findPublishedRecipeBySlug("draft-recipe");
    expect(result).toBeNull();
  });

  it("returns ingredients ordered by sortOrder and steps ordered by stepNumber", async () => {
    const recipe = await createTestRecipe({
      status: "Published",
      slug: "ordered-recipe",
      ingredients: [
        { displayText: "Second", sortOrder: 2 },
        { displayText: "First", sortOrder: 1 },
      ],
      steps: [
        { stepNumber: 2, instruction: "Second step" },
        { stepNumber: 1, instruction: "First step" },
      ],
    });
    const result = await findPublishedRecipeBySlug("ordered-recipe");
    expect(result?.ingredients.map((i) => i.displayText)).toEqual(["First", "Second"]);
    expect(result?.steps.map((s) => s.instruction)).toEqual(["First step", "Second step"]);
  });
});

describe("findRelatedRecipes", () => {
  it("excludes the recipe itself and returns only Published recipes sharing category or cuisine", async () => {
    const target = await createTestRecipe({ status: "Published", slug: "target", cuisine: "Sri Lankan" });
    await createTestRecipe({ status: "Published", slug: "same-category", categoryId: target.categoryId });
    await createTestRecipe({ status: "Draft", slug: "draft-same-category", categoryId: target.categoryId });

    const related = await findRelatedRecipes(
      { id: target.id, categoryId: target.categoryId, cuisine: target.cuisine },
      6,
    );

    expect(related.map((r) => r.slug)).toContain("same-category");
    expect(related.map((r) => r.slug)).not.toContain("target");
    expect(related.map((r) => r.slug)).not.toContain("draft-same-category");
  });
});

describe("findRecipesByProductId", () => {
  it("returns Published recipes whose ingredients reference the product", async () => {
    const product = await createTestProduct({});
    const recipe = await createTestRecipe({
      status: "Published",
      slug: "uses-product",
      ingredients: [{ productId: product.id, displayText: "1 unit" }],
    });
    const result = await findRecipesByProductId(product.id, 6);
    expect(result.map((r) => r.slug)).toEqual(["uses-product"]);
  });
});

describe("incrementRecipeViewCount", () => {
  it("increments viewCount by 1", async () => {
    const recipe = await createTestRecipe({ status: "Published", slug: "view-me", viewCount: 5 });
    await incrementRecipeViewCount(recipe.id);
    const updated = await prisma.recipe.findUniqueOrThrow({ where: { id: recipe.id } });
    expect(updated.viewCount).toBe(6);
  });
});
```

If `createTestRecipe`/`createTestProduct` fixture helpers don't already exist in this test file or `tests/unit/recipe-fixtures.ts`, add minimal ones there that wrap `prisma.recipe.create`/`prisma.product.create` with sane defaults, matching the style of existing fixtures in that file (check `tests/unit/recipe-fixtures.ts` first — STORY-017 already built recipe fixtures for the listing tests; extend rather than duplicate).

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/recipe-repository.test.ts
```

Expected: FAIL — `findPublishedRecipeBySlug is not a function` (etc.).

- [ ] **Step 3: Implement the repository functions**

Add to `src/repositories/recipe.repository.ts`:

```typescript
export const recipeDetailSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  heroImage: true,
  heroImageAlt: true,
  galleryImageUrls: true,
  categoryId: true,
  cuisine: true,
  difficulty: true,
  prepTimeMinutes: true,
  cookTimeMinutes: true,
  totalTimeMinutes: true,
  servings: true,
  avgRating: true,
  ratingCount: true,
  chefNotes: true,
  nutritionCalories: true,
  nutritionProtein: true,
  nutritionCarbs: true,
  nutritionFat: true,
  nutritionFiber: true,
  nutritionSodium: true,
  metaTitle: true,
  metaDescription: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  dietaryTags: {
    where: { dietaryTag: { status: "Active" } },
    orderBy: { dietaryTag: { sortOrder: "asc" } },
    select: { dietaryTag: { select: { name: true, slug: true } } },
  },
  ingredients: {
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      quantity: true,
      unit: true,
      displayText: true,
      product: { select: { id: true, slug: true, name: true } },
    },
  },
  steps: {
    orderBy: { stepNumber: "asc" },
    select: { id: true, stepNumber: true, instruction: true, imageUrl: true },
  },
} satisfies Prisma.RecipeSelect;

export type RecipeDetailRow = Prisma.RecipeGetPayload<{ select: typeof recipeDetailSelect }>;

export function findPublishedRecipeBySlug(slug: string): Promise<RecipeDetailRow | null> {
  return prisma.recipe.findFirst({
    where: { slug, status: "Published" },
    select: recipeDetailSelect,
  });
}

export function findRelatedRecipes(
  recipe: { id: string; categoryId: string; cuisine: string | null },
  limit: number,
): Promise<RecipeCardRow[]> {
  return prisma.recipe.findMany({
    where: {
      status: "Published",
      id: { not: recipe.id },
      OR: [{ categoryId: recipe.categoryId }, ...(recipe.cuisine ? [{ cuisine: recipe.cuisine }] : [])],
    },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}

export function findRecipesByProductId(productId: string, limit: number): Promise<RecipeCardRow[]> {
  return prisma.recipe.findMany({
    where: { status: "Published", ingredients: { some: { productId } } },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}

export async function incrementRecipeViewCount(recipeId: string): Promise<void> {
  await prisma.recipe.update({ where: { id: recipeId }, data: { viewCount: { increment: 1 } } });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/recipe-repository.test.ts
```

Expected: PASS, all new + existing tests in the file.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/recipe.repository.ts tests/unit/recipe-repository.test.ts tests/unit/recipe-fixtures.ts
git commit -m "feat: add recipe detail, related and by-product repository queries"
```

---

## Task 3: Serving-size scaling (pure function)

**Files:**
- Create: `src/lib/recipe-scaling.ts`
- Test: `tests/unit/recipe-scaling.test.ts`

**Interfaces:**
- Produces: `scaleQuantity(baseQuantity: number, baseServings: number, targetServings: number): number`, `formatScaledQuantity(scaled: number, unit: string | null): string`, `scaleNutritionValue(baseValue: number | null, baseServings: number, targetServings: number): number | null`. Task 9's `ServingSizeAdjuster`/`IngredientsList`/`NutritionPanel` import these by these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { formatScaledQuantity, scaleNutritionValue, scaleQuantity } from "@/lib/recipe-scaling";

describe("scaleQuantity", () => {
  it("scales proportionally", () => {
    expect(scaleQuantity(2, 4, 8)).toBe(4);
    expect(scaleQuantity(1, 4, 2)).toBe(0.5);
  });

  it("returns the base value unchanged when target equals base", () => {
    expect(scaleQuantity(3, 4, 4)).toBe(3);
  });

  it("never returns a negative or infinite value at the extremes", () => {
    expect(scaleQuantity(1, 4, 1)).toBeGreaterThan(0);
    expect(scaleQuantity(1, 4, 50)).toBeLessThan(Infinity);
  });
});

describe("formatScaledQuantity", () => {
  it("rounds whole-count units to whole numbers", () => {
    expect(formatScaledQuantity(2.6, "egg")).toBe("3");
  });

  it("rounds other units to one decimal place, dropping a trailing .0", () => {
    expect(formatScaledQuantity(1.5, "cup")).toBe("1.5");
    expect(formatScaledQuantity(2, "tbsp")).toBe("2");
  });
});

describe("scaleNutritionValue", () => {
  it("scales proportionally to the new serving count", () => {
    expect(scaleNutritionValue(400, 4, 8)).toBe(800);
  });

  it("returns null for a null base value", () => {
    expect(scaleNutritionValue(null, 4, 8)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/recipe-scaling.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
const WHOLE_COUNT_UNITS = new Set(["egg", "eggs", "clove", "cloves", "piece", "pieces"]);

/** Pure scaling math — no rounding here; `formatScaledQuantity` rounds for display. */
export function scaleQuantity(baseQuantity: number, baseServings: number, targetServings: number): number {
  if (baseServings <= 0) return baseQuantity;
  return baseQuantity * (targetServings / baseServings);
}

/** "3" for whole-count units, "1.5" (never "1.50") for everything else. */
export function formatScaledQuantity(scaled: number, unit: string | null): string {
  if (unit && WHOLE_COUNT_UNITS.has(unit.toLowerCase())) {
    return String(Math.round(scaled));
  }
  return String(Math.round(scaled * 10) / 10);
}

export function scaleNutritionValue(
  baseValue: number | null,
  baseServings: number,
  targetServings: number,
): number | null {
  if (baseValue === null) return null;
  return Math.round(scaleQuantity(baseValue, baseServings, targetServings));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/recipe-scaling.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recipe-scaling.ts tests/unit/recipe-scaling.test.ts
git commit -m "feat: add pure serving-size scaling functions"
```

---

## Task 4: Recipe detail types

**Files:**
- Modify: `src/types/recipe.ts`

**Interfaces:**
- Produces: `RecipeIngredientItem`, `RecipeStepItem`, `RecipeNutrition`, `RecipeDetail`. Task 5's service, Task 7's route, and Task 9/11's components import these by these exact names.

- [ ] **Step 1: Add the types**

Append to `src/types/recipe.ts`:

```typescript
export interface RecipeIngredientItem {
  id: string;
  /** null when the ingredient has no scalable amount ("Salt, to taste"). */
  quantity: number | null;
  unit: string | null;
  displayText: string;
  /** null when this ingredient has no matching Oristor product. */
  product: { id: string; slug: string; name: string } | null;
}

export interface RecipeStepItem {
  stepNumber: number;
  instruction: string;
  imageUrl: string | null;
}

export interface RecipeNutrition {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sodium: number | null;
}

export interface RecipeDetail {
  id: string;
  slug: string;
  href: string;
  title: string;
  shortDescription: string;
  heroImage: string;
  heroImageAlt: string;
  galleryImageUrls: string[];
  categoryName: string;
  categorySlug: string;
  cuisine: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  servings: number;
  avgRating: number | null;
  ratingCount: number;
  dietaryTags: RecipeFacetOption[];
  chefNotes: string | null;
  nutrition: RecipeNutrition;
  ingredients: RecipeIngredientItem[];
  steps: RecipeStepItem[];
  metaTitle: string | null;
  metaDescription: string | null;
  publishedAt: string | null;
  relatedRecipes: RecipeCard[];
}
```

This step has no test of its own — it's exercised by Task 5's service test.

- [ ] **Step 2: Commit**

```bash
git add src/types/recipe.ts
git commit -m "feat: add RecipeDetail and related recipe detail types"
```

---

## Task 5: Service — `getRecipeBySlug`, `getRelatedRecipes`, `getRecipesByProductId`

**Files:**
- Modify: `src/services/recipe.service.ts`
- Test: `tests/unit/recipe-service.test.ts` (existing file — add to it)

**Interfaces:**
- Consumes: Task 2's repository functions; Task 4's types; `registerRecipeSummaryProvider`, `type RecipePreview` from `@/services/product-detail-extensions` (already exists, built by STORY-011).
- Produces: `getRecipeBySlug(slug: string): Promise<RecipeDetail | null>`, `getRelatedRecipes(recipe: RecipeDetailRow, limit?: number): Promise<RecipeCard[]>` (used internally by `getRecipeBySlug`, exported for the unit test), `getRecipesByProductId(productId: string): Promise<RecipePreview[]>`. Task 7's route and Task 11's page call `getRecipeBySlug`.

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/recipe-service.test.ts`:

```typescript
describe("getRecipeBySlug", () => {
  it("returns null for a missing or unpublished slug", async () => {
    vi.spyOn(recipeRepository, "findPublishedRecipeBySlug").mockResolvedValue(null);
    const result = await getRecipeBySlug("nope");
    expect(result).toBeNull();
  });

  it("maps ingredients, steps, nutrition and increments the view count", async () => {
    const row = buildRecipeDetailRow({
      ingredients: [
        { id: "i1", quantity: "2" as unknown as Prisma.Decimal, unit: "tbsp", displayText: "X", product: { id: "p1", slug: "x", name: "X" } },
        { id: "i2", quantity: null, unit: null, displayText: "Salt, to taste", product: null },
      ],
      steps: [{ id: "s1", stepNumber: 1, instruction: "Do it", imageUrl: null }],
    });
    vi.spyOn(recipeRepository, "findPublishedRecipeBySlug").mockResolvedValue(row);
    vi.spyOn(recipeRepository, "findRelatedRecipes").mockResolvedValue([]);
    const incrementSpy = vi.spyOn(recipeRepository, "incrementRecipeViewCount").mockResolvedValue();

    const result = await getRecipeBySlug(row.slug);

    expect(result?.ingredients[0]).toMatchObject({ quantity: 2, product: { slug: "x" } });
    expect(result?.ingredients[1]).toMatchObject({ quantity: null, product: null });
    expect(result?.steps).toEqual([{ stepNumber: 1, instruction: "Do it", imageUrl: null }]);
    expect(incrementSpy).toHaveBeenCalledWith(row.id);
  });
});

describe("getRecipesByProductId", () => {
  it("maps repository rows to RecipePreview shape", async () => {
    vi.spyOn(recipeRepository, "findRecipesByProductId").mockResolvedValue([
      buildRecipeCardRow({ id: "r1", title: "Dhal", slug: "dhal", heroImage: "/img.webp" }),
    ]);
    const result = await getRecipesByProductId("p1");
    expect(result).toEqual([{ id: "r1", title: "Dhal", slug: "dhal", imageSrc: "/img.webp" }]);
  });
});
```

Use this file's existing mocking style for `recipeRepository` (check how `listRecipes`/`getFeaturedRecipes` are already tested above in the same file) and add `buildRecipeDetailRow`/`buildRecipeCardRow` fixture builders to `tests/unit/recipe-fixtures.ts` if no equivalent exists yet, matching the shape of `recipeDetailSelect`/`recipeCardSelect` from Task 2.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/recipe-service.test.ts
```

Expected: FAIL — `getRecipeBySlug is not a function`.

- [ ] **Step 3: Implement**

Add to `src/services/recipe.service.ts` (imports at top get `import { registerRecipeSummaryProvider, type RecipePreview } from "@/services/product-detail-extensions";` and `import type { RecipeDetail, RecipeIngredientItem, RecipeStepItem } from "@/types/recipe";` and `import type { RecipeDetailRow } from "@/repositories/recipe.repository";`):

```typescript
function toIngredientItem(row: RecipeDetailRow["ingredients"][number]): RecipeIngredientItem {
  return {
    id: row.id,
    quantity: row.quantity === null ? null : row.quantity.toNumber(),
    unit: row.unit,
    displayText: row.displayText,
    product: row.product,
  };
}

function toStepItem(row: RecipeDetailRow["steps"][number]): RecipeStepItem {
  return { stepNumber: row.stepNumber, instruction: row.instruction, imageUrl: row.imageUrl };
}

export async function getRecipeBySlug(slug: string): Promise<RecipeDetail | null> {
  const row = await recipeRepository.findPublishedRecipeBySlug(slug);
  if (!row) return null;

  const [relatedRows] = await Promise.all([
    recipeRepository.findRelatedRecipes({ id: row.id, categoryId: row.categoryId, cuisine: row.cuisine }, 6),
    recipeRepository.incrementRecipeViewCount(row.id),
  ]);

  return {
    id: row.id,
    slug: row.slug,
    href: recipeHref(row.slug),
    title: row.title,
    shortDescription: row.shortDescription,
    heroImage: row.heroImage,
    heroImageAlt: row.heroImageAlt,
    galleryImageUrls: row.galleryImageUrls,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    prepTimeMinutes: row.prepTimeMinutes,
    cookTimeMinutes: row.cookTimeMinutes,
    totalTimeMinutes: row.totalTimeMinutes,
    servings: row.servings,
    avgRating: row.avgRating === null ? null : row.avgRating.toNumber(),
    ratingCount: row.ratingCount,
    dietaryTags: row.dietaryTags.map((link) => ({ name: link.dietaryTag.name, slug: link.dietaryTag.slug })),
    chefNotes: row.chefNotes,
    nutrition: {
      calories: row.nutritionCalories,
      protein: row.nutritionProtein,
      carbs: row.nutritionCarbs,
      fat: row.nutritionFat,
      fiber: row.nutritionFiber,
      sodium: row.nutritionSodium,
    },
    ingredients: row.ingredients.map(toIngredientItem),
    steps: row.steps.map(toStepItem),
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    relatedRecipes: relatedRows.map(toRecipeCard),
  };
}

export async function getRecipesByProductId(productId: string): Promise<RecipePreview[]> {
  const rows = await recipeRepository.findRecipesByProductId(productId, 6);
  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, imageSrc: row.heroImage }));
}
```

Update `registerRecipeProviders()` to also register the PDP extension point:

```typescript
export function registerRecipeProviders(): void {
  registerRecipeSearchProvider(searchRecipeSuggestions);
  registerRecipeSummaryProvider(async (productId) => {
    const recipes = await getRecipesByProductId(productId);
    return recipes.length > 0 ? { recipes } : null;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/recipe-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/recipe.service.ts tests/unit/recipe-service.test.ts tests/unit/recipe-fixtures.ts
git commit -m "feat: add getRecipeBySlug/getRecipesByProductId and register PDP extension"
```

---

## Task 6: Slug validation schema

**Files:**
- Create: `src/validation/recipe-detail.schema.ts`
- Test: `tests/unit/recipe-detail-schema.test.ts`

**Interfaces:**
- Produces: `recipeSlugParamSchema: z.ZodObject<{ slug: z.ZodString }>`. Task 7's route imports this. Mirrors the existing, established convention in `src/validation/product-detail.schema.ts`'s `productSlugParamSchema` exactly — same shape, same minimal validation — rather than inventing a stricter one for this route alone.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { recipeSlugParamSchema } from "@/validation/recipe-detail.schema";

describe("recipeSlugParamSchema", () => {
  it("accepts an object with a non-empty slug", () => {
    expect(recipeSlugParamSchema.safeParse({ slug: "dhal-curry" }).success).toBe(true);
  });

  it("rejects an empty slug", () => {
    expect(recipeSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/recipe-detail-schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { z } from "zod";

export const recipeSlugParamSchema = z.object({
  slug: z.string().min(1),
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/recipe-detail-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validation/recipe-detail.schema.ts tests/unit/recipe-detail-schema.test.ts
git commit -m "feat: add recipe slug param validation schema"
```

---

## Task 7: API route `GET /api/recipes/[slug]`

**Files:**
- Create: `src/app/api/recipes/[slug]/route.ts`
- Test: `tests/unit/recipes-slug-route.test.ts`

**Interfaces:**
- Consumes: `getRecipeBySlug` (Task 5), `recipeSlugParamSchema` (Task 6), `serverErrorResponse` from `@/lib/api/responses` (existing — same helper `GET /api/recipes` already uses for its 500 path).

- [ ] **Step 1: Write the failing test**

Check `tests/unit/recipes-route.test.ts` (existing, for `GET /api/recipes`) for this codebase's route-testing pattern (how it constructs a `Request`, mocks the service layer) and mirror it:

```typescript
import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/recipes/[slug]/route";
import * as recipeService from "@/services/recipe.service";

vi.mock("@/services/recipe.service");

describe("GET /api/recipes/[slug]", () => {
  it("returns 200 with the recipe detail for a valid published slug", async () => {
    vi.mocked(recipeService.getRecipeBySlug).mockResolvedValue({ slug: "dhal-curry" } as never);
    const response = await GET(new Request("http://localhost/api/recipes/dhal-curry"), {
      params: Promise.resolve({ slug: "dhal-curry" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.slug).toBe("dhal-curry");
  });

  it("returns 404 when the service returns null", async () => {
    vi.mocked(recipeService.getRecipeBySlug).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/recipes/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/recipes-slug-route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Same shape as the existing `src/app/api/products/[slug]/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { getRecipeBySlug } from "@/services/recipe.service";
import { recipeSlugParamSchema } from "@/validation/recipe-detail.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = recipeSlugParamSchema.parse(await params);

  const recipe = await getRecipeBySlug(slug);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(recipe, { status: 200 });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/recipes-slug-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/recipes/[slug]/route.ts tests/unit/recipes-slug-route.test.ts
git commit -m "feat: add GET /api/recipes/[slug]"
```

---

## Task 8: `ShareButtons` — add native Web Share support

**Files:**
- Modify: `src/components/storefront/product/share-buttons.tsx`
- Test: `tests/unit/share-buttons.test.tsx` (create if it doesn't already exist; check first)

**Interfaces:**
- No signature change to `ShareButtonsProps` — purely additive rendering behavior.

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "@/components/storefront/product/share-buttons";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ShareButtons", () => {
  it("does not render a native share button when navigator.share is unavailable", () => {
    render(<ShareButtons url="https://oristor.com/recipes/dhal" title="Dhal Curry" />);
    expect(screen.queryByRole("button", { name: /share via/i })).not.toBeInTheDocument();
  });

  it("calls navigator.share with the title and url when available", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<ShareButtons url="https://oristor.com/recipes/dhal" title="Dhal Curry" />);
    await user.click(screen.getByRole("button", { name: /share via/i }));
    expect(share).toHaveBeenCalledWith({ title: "Dhal Curry", url: "https://oristor.com/recipes/dhal" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/share-buttons.test.tsx
```

Expected: FAIL — no "Share via" button exists yet.

- [ ] **Step 3: Implement**

In `src/components/storefront/product/share-buttons.tsx`, add a `Share2` icon import from `lucide-react`, and inside the component body:

```typescript
const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

function handleNativeShare() {
  void navigator.share({ title, url });
}
```

Render before the existing Copy-link button:

```tsx
{canNativeShare && (
  <Button type="button" variant="outline" size="icon-sm" onClick={handleNativeShare} aria-label="Share via device">
    <Share2 />
  </Button>
)}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/share-buttons.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/product/share-buttons.tsx tests/unit/share-buttons.test.tsx
git commit -m "feat: add native Web Share API support to ShareButtons"
```

---

## Task 9: Detail-page display components

**Files:**
- Create: `src/components/storefront/recipes/recipe-hero.tsx`
- Create: `src/components/storefront/recipes/ingredient-link.tsx`
- Create: `src/components/storefront/recipes/ingredients-list.tsx`
- Create: `src/components/storefront/recipes/method-steps.tsx`
- Create: `src/components/storefront/recipes/nutrition-panel.tsx`
- Create: `src/components/storefront/recipes/chef-notes.tsx`
- Create: `src/components/storefront/recipes/serving-size-adjuster.tsx` (Client Component)
- Create: `src/components/storefront/recipes/recipe-print-share-bar.tsx` (Client Component)
- Create: `src/components/storefront/recipes/related-recipes.tsx`
- Test: `tests/unit/ingredient-link.test.tsx`
- Test: `tests/unit/serving-size-adjuster.test.tsx`
- Test: `tests/unit/related-recipes.test.tsx`

**Interfaces:**
- Consumes: `RecipeDetail`, `RecipeIngredientItem` (Task 4); `scaleQuantity`, `formatScaledQuantity`, `scaleNutritionValue` (Task 3); `ShareButtons` (Task 8, reused as-is); `RecipeCard` component (existing, STORY-017).
- Produces: each component's default export, consumed by Task 11's page.

- [ ] **Step 1: Write the failing tests**

`tests/unit/ingredient-link.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IngredientLink } from "@/components/storefront/recipes/ingredient-link";

describe("IngredientLink", () => {
  it("renders a link to the product page when a product is linked", () => {
    render(
      <IngredientLink
        ingredient={{ id: "i1", quantity: 2, unit: "tbsp", displayText: "2 tbsp Curry Powder", product: { id: "p1", slug: "curry-powder", name: "Curry Powder" } }}
        scaledQuantity={2}
      />,
    );
    expect(screen.getByRole("link", { name: /curry powder/i })).toHaveAttribute("href", "/products/curry-powder");
  });

  it("renders plain text when no product is linked", () => {
    render(<IngredientLink ingredient={{ id: "i2", quantity: null, unit: null, displayText: "Salt, to taste", product: null }} scaledQuantity={null} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Salt, to taste")).toBeInTheDocument();
  });
});
```

`tests/unit/serving-size-adjuster.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ServingSizeAdjuster } from "@/components/storefront/recipes/serving-size-adjuster";

describe("ServingSizeAdjuster", () => {
  it("calls onChange with servings + 1 when the increment button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ServingSizeAdjuster servings={4} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /increase servings/i }));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("never calls onChange below 1 or above 50", async () => {
    const user = userEvent.setup();
    const onChangeAtMin = vi.fn();
    render(<ServingSizeAdjuster servings={1} onChange={onChangeAtMin} />);
    await user.click(screen.getByRole("button", { name: /decrease servings/i }));
    expect(onChangeAtMin).not.toHaveBeenCalled();
  });
});
```

`tests/unit/related-recipes.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedRecipes } from "@/components/storefront/recipes/related-recipes";

describe("RelatedRecipes", () => {
  it("renders nothing when there are no related recipes", () => {
    const { container } = render(<RelatedRecipes recipes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a RecipeCard per related recipe", () => {
    render(
      <RelatedRecipes
        recipes={[
          { id: "r1", slug: "r1", href: "/recipes/r1", title: "R1", heroImage: "/a.webp", heroImageAlt: "a", categoryName: "Curries", cuisine: null, difficulty: "Easy", totalTimeMinutes: 30, avgRating: null, ratingCount: 0, dietaryTags: [] },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "R1" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/ingredient-link.test.tsx tests/unit/serving-size-adjuster.test.tsx tests/unit/related-recipes.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement each component**

`src/components/storefront/recipes/ingredient-link.tsx`:

```tsx
import Link from "next/link";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientLinkProps {
  ingredient: RecipeIngredientItem;
  /** Pre-scaled display quantity, or null when the ingredient has no scalable amount. */
  scaledQuantity: number | null;
}

export function IngredientLink({ ingredient, scaledQuantity }: IngredientLinkProps) {
  // Always displayText, never product.name — displayText is the
  // recipe-authored ingredient name; the linked product's catalog name can
  // legitimately differ (e.g. "Oristor chilli powder" vs. the product's
  // "Chilli Powder 100g") and substituting it here would silently rewrite
  // what the recipe author wrote.
  const label = scaledQuantity !== null && ingredient.unit
    ? `${scaledQuantity} ${ingredient.unit} ${ingredient.displayText}`
    : ingredient.displayText;

  if (!ingredient.product) return <span>{label}</span>;

  return (
    <Link href={`/products/${ingredient.product.slug}`} className="text-chilli underline-offset-2 hover:underline">
      {label}
    </Link>
  );
}
```

`src/components/storefront/recipes/ingredients-list.tsx`:

```tsx
import { IngredientLink } from "@/components/storefront/recipes/ingredient-link";
import { formatScaledQuantity, scaleQuantity } from "@/lib/recipe-scaling";
import type { RecipeIngredientItem } from "@/types/recipe";

interface IngredientsListProps {
  ingredients: RecipeIngredientItem[];
  baseServings: number;
  servings: number;
}

export function IngredientsList({ ingredients, baseServings, servings }: IngredientsListProps) {
  return (
    <ul className="space-y-2 text-body text-charcoal">
      {ingredients.map((ingredient) => {
        const scaledQuantity =
          ingredient.quantity !== null
            ? Number(formatScaledQuantity(scaleQuantity(ingredient.quantity, baseServings, servings), ingredient.unit))
            : null;
        return (
          <li key={ingredient.id}>
            <IngredientLink ingredient={ingredient} scaledQuantity={scaledQuantity} />
          </li>
        );
      })}
    </ul>
  );
}
```

`src/components/storefront/recipes/method-steps.tsx`:

```tsx
import Image from "next/image";
import type { RecipeStepItem } from "@/types/recipe";

export function MethodSteps({ steps }: { steps: RecipeStepItem[] }) {
  return (
    <ol className="space-y-6">
      {steps.map((step) => (
        <li key={step.stepNumber} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chilli font-number text-small text-white">
            {step.stepNumber}
          </span>
          <div className="flex-1">
            <p className="text-body text-charcoal">{step.instruction}</p>
            {step.imageUrl && (
              <div className="relative mt-3 aspect-video overflow-hidden rounded-lg">
                <Image src={step.imageUrl} alt={`Step ${step.stepNumber}`} fill className="object-cover" />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

`src/components/storefront/recipes/nutrition-panel.tsx`:

```tsx
import { scaleNutritionValue } from "@/lib/recipe-scaling";
import type { RecipeNutrition } from "@/types/recipe";

interface NutritionPanelProps {
  nutrition: RecipeNutrition;
  baseServings: number;
  servings: number;
}

const ROWS: { key: keyof RecipeNutrition; label: string; suffix: string }[] = [
  { key: "calories", label: "Calories", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbs", label: "Carbohydrates", suffix: "g" },
  { key: "fat", label: "Fat", suffix: "g" },
  { key: "fiber", label: "Fiber", suffix: "g" },
  { key: "sodium", label: "Sodium", suffix: "mg" },
];

export function NutritionPanel({ nutrition, baseServings, servings }: NutritionPanelProps) {
  const hasAnyValue = ROWS.some((row) => nutrition[row.key] !== null);
  if (!hasAnyValue) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 text-small text-charcoal sm:grid-cols-3">
      {ROWS.filter((row) => nutrition[row.key] !== null).map((row) => (
        <div key={row.key} className="rounded-lg border border-input p-3">
          <dt className="text-caption text-charcoal/70">{row.label}</dt>
          <dd className="font-number text-body">
            {scaleNutritionValue(nutrition[row.key], baseServings, servings)} {row.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

`src/components/storefront/recipes/chef-notes.tsx`:

```tsx
export function ChefNotes({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return (
    <div className="rounded-lg border-l-4 border-gold bg-cream/60 p-4">
      <h2 className="text-h4 font-heading text-charcoal">Chef&apos;s Notes</h2>
      <p className="mt-2 text-body text-charcoal/90">{notes}</p>
    </div>
  );
}
```

`src/components/storefront/recipes/serving-size-adjuster.tsx`:

```tsx
"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const MIN_SERVINGS = 1;
const MAX_SERVINGS = 50;

interface ServingSizeAdjusterProps {
  servings: number;
  onChange: (servings: number) => void;
}

export function ServingSizeAdjuster({ servings, onChange }: ServingSizeAdjusterProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-small text-charcoal/70">Servings</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Decrease servings"
          disabled={servings <= MIN_SERVINGS}
          onClick={() => onChange(Math.max(MIN_SERVINGS, servings - 1))}
        >
          <Minus />
        </Button>
        <span className="w-6 text-center font-number text-body" aria-live="polite">
          {servings}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Increase servings"
          disabled={servings >= MAX_SERVINGS}
          onClick={() => onChange(Math.min(MAX_SERVINGS, servings + 1))}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
```

`src/components/storefront/recipes/recipe-print-share-bar.tsx`:

```tsx
"use client";

import { Printer } from "lucide-react";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { Button } from "@/components/ui/button";

interface RecipePrintShareBarProps {
  url: string;
  title: string;
}

export function RecipePrintShareBar({ url, title }: RecipePrintShareBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Print
      </Button>
      <ShareButtons url={url} title={title} />
    </div>
  );
}
```

`src/components/storefront/recipes/related-recipes.tsx`:

```tsx
import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

export function RelatedRecipes({ recipes }: { recipes: RecipeCardData[] }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="related-recipes-heading" className="print:hidden">
      <h2 id="related-recipes-heading" className="text-h3 font-heading text-charcoal">
        You might also like
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
        {recipes.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} headingLevel="h3" />
        ))}
      </div>
    </section>
  );
}
```

`src/components/storefront/recipes/recipe-hero.tsx` — hero image plus an optional thumbnail strip for `galleryImageUrls`:

```tsx
import Image from "next/image";

interface RecipeHeroProps {
  heroImage: string;
  heroImageAlt: string;
  galleryImageUrls: string[];
}

export function RecipeHero({ heroImage, heroImageAlt, galleryImageUrls }: RecipeHeroProps) {
  return (
    <div>
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
        <Image src={heroImage} alt={heroImageAlt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      {galleryImageUrls.length > 0 && (
        <div className="mt-3 flex gap-2 print:hidden">
          {galleryImageUrls.map((url) => (
            <div key={url} className="relative size-16 overflow-hidden rounded-md bg-cream">
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/ingredient-link.test.tsx tests/unit/serving-size-adjuster.test.tsx tests/unit/related-recipes.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/recipes/recipe-hero.tsx src/components/storefront/recipes/ingredient-link.tsx src/components/storefront/recipes/ingredients-list.tsx src/components/storefront/recipes/method-steps.tsx src/components/storefront/recipes/nutrition-panel.tsx src/components/storefront/recipes/chef-notes.tsx src/components/storefront/recipes/serving-size-adjuster.tsx src/components/storefront/recipes/recipe-print-share-bar.tsx src/components/storefront/recipes/related-recipes.tsx tests/unit/ingredient-link.test.tsx tests/unit/serving-size-adjuster.test.tsx tests/unit/related-recipes.test.tsx
git commit -m "feat: add recipe detail page display components"
```

---

## Task 10: `RecipeJsonLd` structured data

**Files:**
- Create: `src/components/storefront/recipes/recipe-json-ld.tsx`
- Test: `tests/unit/recipe-json-ld.test.tsx`

**Interfaces:**
- Consumes: `JsonLdScript` (existing, `@/components/storefront/product/json-ld-script`).

- [ ] **Step 1: Write the failing test**

```typescript
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeJsonLd } from "@/components/storefront/recipes/recipe-json-ld";

describe("RecipeJsonLd", () => {
  it("renders a schema.org Recipe script with ingredients and instructions", () => {
    const { container } = render(
      <RecipeJsonLd
        name="Dhal Curry"
        description="A hearty dhal."
        imageUrls={["/img.webp"]}
        totalTimeMinutes={45}
        recipeYield={4}
        ingredientTexts={["2 tbsp Curry Powder"]}
        instructionTexts={["Rinse the rice."]}
        nutritionCalories={420}
        averageRating={4.5}
        ratingCount={12}
      />,
    );
    const script = container.querySelector("script[type='application/ld+json']");
    const json = JSON.parse(script?.textContent ?? "{}");
    expect(json["@type"]).toBe("Recipe");
    expect(json.recipeIngredient).toEqual(["2 tbsp Curry Powder"]);
    expect(json.recipeInstructions[0].text).toBe("Rinse the rice.");
    expect(json.aggregateRating.ratingValue).toBe(4.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/recipe-json-ld.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface RecipeJsonLdProps {
  name: string;
  description: string;
  imageUrls: string[];
  totalTimeMinutes: number;
  recipeYield: number;
  ingredientTexts: string[];
  instructionTexts: string[];
  nutritionCalories: number | null;
  averageRating?: number;
  ratingCount?: number;
}

export function RecipeJsonLd(props: RecipeJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: props.name,
    description: props.description,
    image: props.imageUrls,
    totalTime: `PT${props.totalTimeMinutes}M`,
    recipeYield: String(props.recipeYield),
    recipeIngredient: props.ingredientTexts,
    recipeInstructions: props.instructionTexts.map((text) => ({ "@type": "HowToStep", text })),
    ...(props.nutritionCalories !== null
      ? { nutrition: { "@type": "NutritionInformation", calories: `${props.nutritionCalories} calories` } }
      : {}),
    ...(props.averageRating !== undefined && props.ratingCount !== undefined
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: props.averageRating, reviewCount: props.ratingCount } }
      : {}),
  };

  return <JsonLdScript data={json} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/recipe-json-ld.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/recipes/recipe-json-ld.tsx tests/unit/recipe-json-ld.test.tsx
git commit -m "feat: add Recipe schema.org JSON-LD component"
```

---

## Task 11: The page — `recipes/[slug]/page.tsx`, print CSS, serving-size wiring

**Files:**
- Create: `src/app/(storefront)/recipes/[slug]/page.tsx`
- Create: `src/components/storefront/recipes/recipe-detail-view.tsx` (Client Component — owns the `servings` state that `ServingSizeAdjuster`, `IngredientsList` and `NutritionPanel` all need)
- Modify: `src/app/(storefront)/layout.tsx` (print:hidden on chrome)
- Test: `tests/unit/recipe-detail-view.test.tsx`

**Interfaces:**
- Consumes: `getRecipeBySlug` (Task 5), all Task 9/10 components, `RecipeDetail` (Task 4).

- [ ] **Step 1: Write the failing test for the client view's serving-size wiring**

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { RecipeDetailView } from "@/components/storefront/recipes/recipe-detail-view";
import { buildRecipeDetail } from "./recipe-fixtures";

describe("RecipeDetailView", () => {
  it("recalculates ingredient quantities when servings is adjusted", async () => {
    const user = userEvent.setup();
    const recipe = buildRecipeDetail({
      servings: 4,
      ingredients: [{ id: "i1", quantity: 2, unit: "cup", displayText: "Rice", product: null }],
    });
    render(<RecipeDetailView recipe={recipe} pageUrl="https://oristor.com/recipes/rice" />);

    expect(screen.getByText(/2 cup Rice/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /increase servings/i }));
    expect(screen.getByText(/2.5 cup Rice/)).toBeInTheDocument();
  });
});
```

Add `buildRecipeDetail` to `tests/unit/recipe-fixtures.ts` if it doesn't already exist from Task 5, returning a complete `RecipeDetail` with sane defaults overridable per-field.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/recipe-detail-view.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `RecipeDetailView`**

Only the parts that actually react to the serving-size state — the adjuster, the ingredients list, and the nutrition panel — go inside the Client Component, per AC "serving-size adjuster and share actions are isolated Client Components." `MethodSteps`, `ChefNotes` and `RelatedRecipes` don't depend on servings, so the page (Server Component, Step 5) renders them directly and they stay server-rendered.

```tsx
"use client";

import { useState } from "react";
import { IngredientsList } from "@/components/storefront/recipes/ingredients-list";
import { NutritionPanel } from "@/components/storefront/recipes/nutrition-panel";
import { RecipePrintShareBar } from "@/components/storefront/recipes/recipe-print-share-bar";
import { ServingSizeAdjuster } from "@/components/storefront/recipes/serving-size-adjuster";
import type { RecipeDetail } from "@/types/recipe";

export function RecipeDetailView({ recipe, pageUrl }: { recipe: RecipeDetail; pageUrl: string }) {
  const [servings, setServings] = useState(recipe.servings);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ServingSizeAdjuster servings={servings} onChange={setServings} />
          <RecipePrintShareBar url={pageUrl} title={recipe.title} />
        </div>
        <h2 className="mt-8 text-h3 font-heading text-charcoal">Ingredients</h2>
        <div className="mt-3">
          <IngredientsList ingredients={recipe.ingredients} baseServings={recipe.servings} servings={servings} />
        </div>
      </div>
      <div>
        <h2 className="text-h4 font-heading text-charcoal">Nutrition per serving</h2>
        <div className="mt-3">
          <NutritionPanel nutrition={recipe.nutrition} baseServings={recipe.servings} servings={servings} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/recipe-detail-view.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Write the page**

```tsx
import type { Metadata } from "next";
import { Clock, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { ChefNotes } from "@/components/storefront/recipes/chef-notes";
import { MethodSteps } from "@/components/storefront/recipes/method-steps";
import { RecipeDetailView } from "@/components/storefront/recipes/recipe-detail-view";
import { RecipeHero } from "@/components/storefront/recipes/recipe-hero";
import { RecipeJsonLd } from "@/components/storefront/recipes/recipe-json-ld";
import { RelatedRecipes } from "@/components/storefront/recipes/related-recipes";
import { formatRecipeTime } from "@/lib/recipe-time";
import { getRecipeBySlug } from "@/services/recipe.service";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com";

const getCachedRecipe = cache(getRecipeBySlug);

interface RecipeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RecipeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getCachedRecipe(slug);
  if (!recipe) return {};
  return {
    title: recipe.metaTitle ?? recipe.title,
    description: recipe.metaDescription ?? recipe.shortDescription,
  };
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { slug } = await params;
  const recipe = await getCachedRecipe(slug);
  if (!recipe) notFound();

  const pageUrl = `${SITE_URL}/recipes/${recipe.slug}`;

  return (
    <Section>
      <RecipeJsonLd
        name={recipe.title}
        description={recipe.shortDescription}
        imageUrls={[recipe.heroImage, ...recipe.galleryImageUrls]}
        totalTimeMinutes={recipe.totalTimeMinutes}
        recipeYield={recipe.servings}
        ingredientTexts={recipe.ingredients.map((i) => i.displayText)}
        instructionTexts={recipe.steps.map((s) => s.instruction)}
        nutritionCalories={recipe.nutrition.calories}
        averageRating={recipe.avgRating ?? undefined}
        ratingCount={recipe.ratingCount > 0 ? recipe.ratingCount : undefined}
      />
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: recipe.categoryName, href: `/recipes?category=${recipe.categorySlug}` },
            { name: recipe.title, href: recipe.href },
          ]}
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <RecipeHero heroImage={recipe.heroImage} heroImageAlt={recipe.heroImageAlt} galleryImageUrls={recipe.galleryImageUrls} />
        <div>
          <p className="text-caption font-medium text-chilli">
            <span>{recipe.categoryName}</span>
            {recipe.cuisine && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-charcoal/70">{recipe.cuisine}</span>
              </>
            )}
          </p>
          <h1 className="mt-1 text-h1 font-heading text-charcoal">{recipe.title}</h1>
          <p className="mt-2 text-body text-charcoal/80">{recipe.shortDescription}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-small text-charcoal/80">
            <Badge variant="outline">{recipe.difficulty}</Badge>
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden="true" />
              Prep {formatRecipeTime(recipe.prepTimeMinutes)} · Cook {formatRecipeTime(recipe.cookTimeMinutes)} · Total{" "}
              {formatRecipeTime(recipe.totalTimeMinutes)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-4" aria-hidden="true" />
              Serves {recipe.servings}
            </span>
          </div>

          {recipe.dietaryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.dietaryTags.map((tag) => (
                <Badge key={tag.slug} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-10">
        <RecipeDetailView recipe={recipe} pageUrl={pageUrl} />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-h3 font-heading text-charcoal">Method</h2>
          <div className="mt-3">
            <MethodSteps steps={recipe.steps} />
          </div>
          <div className="mt-8">
            <ChefNotes notes={recipe.chefNotes} />
          </div>
        </div>
      </div>
      <div className="mt-10">
        <RelatedRecipes recipes={recipe.relatedRecipes} />
      </div>
    </Section>
  );
}
```

`Breadcrumbs` takes `items: { name: string; href: string }[]` and `Badge` supports `variant="outline"`/`variant="secondary"` — both confirmed against the current source of `breadcrumbs.tsx` and `badge.tsx`.

- [ ] **Step 6: Add `print:hidden` to site chrome**

In `src/app/(storefront)/layout.tsx`, wrap `<Header />` and `<Footer />`:

```tsx
<div className="print:hidden">
  <Header />
</div>
<main id="main-content" className="flex-1 pb-16 lg:pb-0">
  {children}
</main>
<div className="print:hidden">
  <Footer />
</div>
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

Visit `/recipes/<a-seeded-slug>`: confirm hero renders, ingredients list shows linked products as clickable links and unlinked ones as plain text, servings adjuster changes displayed quantities and nutrition values live, chef notes render distinctly, and `window.print()` (Print button) hides header/footer/breadcrumbs/related-recipes/share bar. Visit `/recipes/does-not-exist`: confirm the 404 page renders. Stop the dev server after checking.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(storefront)/recipes/[slug]/page.tsx" src/components/storefront/recipes/recipe-detail-view.tsx "src/app/(storefront)/layout.tsx" tests/unit/recipe-detail-view.test.tsx tests/unit/recipe-fixtures.ts
git commit -m "feat: add the recipe detail page"
```

---

## Task 12: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/recipe-detail.spec.ts`

- [ ] **Step 1: Write the e2e test**

Check `tests/e2e/recipe-centre.spec.ts` (STORY-017) for this project's e2e setup/fixture conventions (base URL, seeded-data assumptions) and mirror them:

```typescript
import { expect, test } from "@playwright/test";

test("recipe detail: adjust servings, follow a linked ingredient, print, view related recipes", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("link", { name: /dhal curry/i }).click();
  await expect(page).toHaveURL(/\/recipes\/[a-z0-9-]+$/);

  const servingsValue = page.getByText(/^\d+$/).first();
  const before = await servingsValue.textContent();
  await page.getByRole("button", { name: /increase servings/i }).click();
  await expect(servingsValue).not.toHaveText(before ?? "");

  const productLink = page.getByRole("link", { name: /curry powder/i }).first();
  await productLink.click();
  await expect(page).toHaveURL(/\/products\//);
  await page.goBack();

  await expect(page.getByRole("heading", { name: /you might also like/i })).toBeVisible();
});

test("recipe detail: 404 for a nonexistent slug", async ({ page }) => {
  const response = await page.goto("/recipes/does-not-exist-at-all");
  expect(response?.status()).toBe(404);
});
```

Adjust the recipe/ingredient/product names to match whatever Task 1's seed data actually contains.

- [ ] **Step 2: Run the e2e test**

```bash
npx playwright test tests/e2e/recipe-detail.spec.ts
```

Expected: PASS. If the dev server isn't already configured to auto-start for Playwright, confirm `playwright.config.ts`'s `webServer` handles it (it already does for other e2e specs in this repo).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/recipe-detail.spec.ts
git commit -m "test: add Playwright e2e coverage for the recipe detail page"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`
- Modify: `docs/stories/04-recipes-food-academy/STORY-018-recipe-detail-page.md`

- [ ] **Step 1: Document the ingredient-product linking contract**

Add an entry to `docs/architecture-decisions.md` (follow the file's existing per-story entry format) documenting: `RecipeIngredient.productId` is nullable and set at authoring time (STORY-043 owns the UI); `getRecipesByProductId` is consumed by `product.service.ts` through the `registerRecipeSummaryProvider` extension point (not a public route) — both STORY-011 and STORY-043 depend on this shape staying stable; the print view is CSS-driven off the live DOM, not a separate route, so it always reflects the currently adjusted serving size.

- [ ] **Step 2: Mark the story done**

In `docs/stories/04-recipes-food-academy/STORY-018-recipe-detail-page.md`, change `**Status:** Draft` to `**Status:** Done`, and check off every acceptance criterion and task item that was actually completed (leave any genuinely deferred item unchecked with a one-line note, matching how STORY-014 documented its one deferred item).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture-decisions.md "docs/stories/04-recipes-food-academy/STORY-018-recipe-detail-page.md"
git commit -m "docs: mark STORY-018 done; document recipe-product linking contract"
```

---

## Final Verification

- [ ] `npx eslint .` — 0 errors
- [ ] `npx next typegen && npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` (sharded per the memory note on PGlite load, or full run if the local DB holds up) — all green
- [ ] `npx playwright test` — all green
- [ ] Manual check in the browser per Task 11 Step 7
