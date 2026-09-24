# Recipe Centre Listing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/recipes`, a server-rendered, filterable, sortable, searchable Recipe Centre backed by new `Recipe` / `RecipeCategory` / `DietaryTag` models. Also connect the homepage "Featured Recipes" section and the header search recipe suggestions to real data.

**Architecture:**
- A new recipe module follows the existing Service Layer pattern:
  - repository: pure `where`/`orderBy` builders plus Prisma queries;
  - service: maps rows to the `RecipeCard` shape, registers the search provider;
  - thin API routes;
  - a Server Component page seeding a TanStack Query + nuqs client listing.
- Generic listing UI moves from `components/storefront/product/` to `components/storefront/listing/`, so products and recipes share one copy: checkbox option, pagination, filter drawer, filter sidebar, and sort select.

**Tech Stack:** Next.js 16.2.10 App Router, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`), Zod 4, nuqs 2.9, TanStack Query 5, Base UI / shadcn, Tailwind v4, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-09-24-recipe-centre-design.md`

## Global Constraints

**Workspace**
- Branch `feature/story-017-recipe-centre`, worktree `.claude/worktrees/story-017-recipe-centre`, based on `feature/story-016-product-qa`.

**Architecture**
- Only files in `src/repositories/` may import `@/lib/db`. Services, routes and components never import Prisma at runtime. A type-only `import type … from "@/generated/prisma/client"` is allowed anywhere.
- No `any`. TypeScript strict. `npx tsc --noEmit` covers `tests/` too.

**Data**
- `RecipeStatus` values are exactly `Draft`, `Review`, `Approved`, `Published`, `Archived`. `RecipeDifficulty` values are exactly `Easy`, `Medium`, `Hard`.
- The storefront only ever returns recipes with `status = "Published"`. `buildRecipeWhere` always starts its `AND` array with `{ status: "Published" }`.
- `totalTimeMinutes` is always `computeTotalTimeMinutes(prep, cook)` (`src/lib/recipe-time.ts`). It is never typed by hand.

**URL / API contract**
- Parameters: `category`, `difficulty`, `time`, `diet`, `q`, `sort`, `page`, plus API-only `pageSize`.
- Values:
  - `difficulty`: `easy|medium|hard`.
  - `time`: `under-15|15-30|30-60|60-plus`.
  - `sort`: `newest|popular|rating|time`, default `newest`.
  - `pageSize`: default `12`, max `48`.
  - `q`: trimmed, max 100 chars.
- Lists are comma-separated.
- Filter semantics: `difficulty` and `time` are OR within their list; `diet` is AND (every tag); different params combine with AND.
- Time ranges are half-open: `under-15` `< 15`; `15-30` `15 ≤ t < 30`; `30-60` `30 ≤ t < 60`; `60-plus` `≥ 60`.
- Every sort ends with an `{ id: "asc" }` tiebreaker. `newest` = `publishedAt desc nulls last`; `popular` = `viewCount desc`; `rating` = `avgRating desc nulls last`, then `ratingCount desc`; `time` = `totalTimeMinutes asc`.
- A malformed or stale query never errors. Invalid values fall back to their defaults; unknown `difficulty`/`time` values are dropped; unknown `diet`/`category` slugs match nothing.

**UI copy (exact strings; tests depend on them)**
- Page `<h1>`: `Recipe Centre`.
- Sidebar `aria-label`: `Filter recipes`.
- Chip nav `aria-label`: `Recipe categories`; first chip: `All`.
- Sort trigger `aria-label`: `Sort recipes`.
- Sort labels: `Newest`, `Most Popular`, `Highest Rated`, `Cook Time (shortest first)`.
- Search input label: `Search recipes`; its clear button: `Clear search`.
- Fieldset legends: `Difficulty`, `Time`, `Dietary`. Time option labels: `Under 15 min`, `15–30 min`, `30–60 min`, `60+ min` (en dashes).
- Clear button in the filter controls: `Clear filters`.
- Empty state: `No recipes match those filters.` with action `Clear all filters`.
- Page past the end: `There are no recipes on this page.` with action `Go to first page`.
- Fetch error alert: `Couldn't update recipes.` with button `Retry`.
- Count: `N recipes` (`1 recipe`).
- Results region heading (visually hidden): `Recipe results`.

**Product listing must not change**
- Keep `aria-label="Filter products"`, `aria-label="Sort products"`, the `Filters` drawer button, and the `Clear all filters` / `Clear filters` texts.

**Tests**
- Unit tests must not produce console noise. Spy on `console.error` with `mockImplementation(() => {})` wherever an error path logs.

**Commits**
- Conventional Commits, each ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Local DB**
- PGlite `prisma dev` on port 51214, and this worktree's `.env` has `DATABASE_POOL_MAX=1`.
- Run database-backed test files one command at a time (`npx vitest run tests/unit/<file>`).
- If a run fails with `P1001`, `ConnectionClosed` or `Connection terminated unexpectedly`, that's the documented PGlite limitation. Report it; don't change code.
- Only the controller restarts the DB or the dev server.

---

## File map

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | New enums and models (appended) |
| `prisma/migrations/20260924090000_add_recipes/migration.sql` | Committed migration |
| `src/lib/escape-like-pattern.ts` | ILIKE wildcard escaping (moved out of `qa.repository.ts`) |
| `src/lib/toggle-value.ts` | Add/remove a value in a list (moved out of product `filter-controls.tsx`) |
| `src/lib/api/responses.ts` | + `serverErrorResponse()` |
| `src/services/search-extensions.ts` | Provider registry moves to `globalThis` |
| `src/lib/recipe-listing-values.ts` | Value tuples, labels, `RecipeFilters` type |
| `src/lib/recipe-time.ts` | `computeTotalTimeMinutes`, `formatRecipeTime` |
| `src/validation/recipe-listing.schema.ts` | Zod query schema for page + API |
| `src/lib/recipe-listing-params.ts` | nuqs parsers + URL serializer |
| `src/hooks/use-recipe-listing-params.ts` | Client URL state hook |
| `src/repositories/recipe.repository.ts` | Builders + all recipe Prisma access |
| `src/types/recipe.ts` | `RecipeCard`, `RecipeListResult`, `RecipeFacets` |
| `src/services/recipe.service.ts` | `listRecipes`, `listRecipeFacets`, `getFeaturedRecipes`, `createRecipe`, search provider |
| `src/instrumentation.ts` | + `registerRecipeProviders()` |
| `src/app/api/recipes/route.ts`, `src/app/api/recipes/categories/route.ts` | API |
| `prisma/seed-recipes.ts`, `prisma/seed.ts` | Seed taxonomy + 18 recipes |
| `src/components/storefront/listing/*` | Shared checkbox option, pagination, drawer, sidebar, sort select |
| `src/components/storefront/product/product-sort-select.tsx` | Product sort options on the shared select |
| `src/components/storefront/recipes/*` | Card, chips, filter controls, search box, empty state, sort select, grid, listing |
| `src/hooks/use-recipe-listing.ts` | TanStack Query fetch + last-good result |
| `src/app/(storefront)/recipes/{page,loading,error}.tsx` | Route |
| `src/components/storefront/home/featured-recipes.tsx`, `src/app/(storefront)/page.tsx` | Real featured recipes |
| `src/lib/nav-config.ts`, `src/lib/fixtures/home-fixtures.ts`, `src/types/home.ts` | Nav mapping; fixture removal |
| `tests/unit/recipe-fixtures.ts` | DB fixture helpers (not a test file) |
| `tests/e2e/recipe-centre.spec.ts` | E2E |
| `docs/architecture-decisions.md`, story file, `.claude/skills/add-recipe/SKILL.md` | Docs |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (append at the end)
- Create: `prisma/migrations/20260924090000_add_recipes/migration.sql`

**Interfaces:**
- Produces: Prisma models `recipe`, `recipeCategory`, `dietaryTag`, `recipeDietaryTag`; enums `RecipeStatus`, `RecipeDifficulty`.

- [ ] **Step 1: Append at the end of `prisma/schema.prisma`**

```prisma
// --- Recipes (STORY-017) ---
// Listing fields only. STORY-018 adds ingredients, steps, tips, nutrition and
// product links. Design: docs/superpowers/specs/2026-09-24-recipe-centre-design.md

// Publishing workflow (add-recipe skill). Only Published is ever shown on the
// storefront; STORY-043 owns the transitions.
enum RecipeStatus {
  Draft
  Review
  Approved
  Published
  Archived
}

enum RecipeDifficulty {
  Easy
  Medium
  Hard
}

model RecipeCategory {
  id              String        @id @default(cuid())
  name            String
  slug            String        @unique
  description     String?
  image           String?
  sortOrder       Int           @default(0)
  status          ContentStatus @default(Active)
  metaTitle       String?
  metaDescription String?
  recipes         Recipe[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
}

model DietaryTag {
  id        String             @id @default(cuid())
  name      String             @unique
  slug      String             @unique
  icon      String?
  sortOrder Int                @default(0)
  status    ContentStatus      @default(Active)
  recipes   RecipeDietaryTag[]
}

model RecipeDietaryTag {
  recipeId     String
  recipe       Recipe     @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  dietaryTagId String
  dietaryTag   DietaryTag @relation(fields: [dietaryTagId], references: [id], onDelete: Cascade)

  @@id([recipeId, dietaryTagId])
  @@index([dietaryTagId])
}

model Recipe {
  id               String             @id @default(cuid())
  slug             String             @unique
  title            String
  shortDescription String
  heroImage        String
  heroImageAlt     String
  categoryId       String
  category         RecipeCategory     @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  cuisine          String?
  difficulty       RecipeDifficulty
  prepTimeMinutes  Int
  cookTimeMinutes  Int
  // Always prep + cook, via computeTotalTimeMinutes() (src/lib/recipe-time.ts).
  // Stored so the time filter and sort can use an index.
  totalTimeMinutes Int
  servings         Int
  status           RecipeStatus       @default(Draft)
  isFeatured       Boolean            @default(false)
  // Written by STORY-018 (views) and STORY-022 (ratings); seed values until then.
  viewCount        Int                @default(0)
  avgRating        Decimal?           @db.Decimal(2, 1)
  ratingCount      Int                @default(0)
  metaTitle        String?
  metaDescription  String?
  dietaryTags      RecipeDietaryTag[]
  publishedAt      DateTime?
  createdAt        DateTime           @default(now())
  updatedAt        DateTime           @updatedAt

  @@index([status, publishedAt])
  @@index([status, categoryId])
  @@index([status, totalTimeMinutes])
  @@index([status, viewCount])
  @@index([status, isFeatured])
}
```

- [ ] **Step 2: Validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

Run `git diff --stat prisma/schema.prisma` and confirm only additions at the end of the file. Do not run `prisma format` on the whole file.

- [ ] **Step 3: Generate the migration offline**

```bash
git show HEAD:prisma/schema.prisma > "$TEMP/schema-before-recipes.prisma"
mkdir -p prisma/migrations/20260924090000_add_recipes
npx prisma migrate diff --from-schema "$TEMP/schema-before-recipes.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20260924090000_add_recipes/migration.sql
head -3 prisma/migrations/20260924090000_add_recipes/migration.sql
grep -cE 'CREATE TYPE "RecipeStatus"|CREATE TYPE "RecipeDifficulty"|CREATE TABLE "RecipeCategory" \(|CREATE TABLE "DietaryTag" \(|CREATE TABLE "RecipeDietaryTag" \(|CREATE TABLE "Recipe" \(' prisma/migrations/20260924090000_add_recipes/migration.sql
```

Expected: the first line is `-- CreateEnum` and the count is `6`. If a `Loaded Prisma config` line appears at the top of the file, delete it. The file must not start with a BOM. Use the Bash tool for the redirect, never PowerShell `>`.

- [ ] **Step 4: Apply locally and regenerate the client**

```bash
npx prisma generate
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add prisma/schema.prisma prisma/migrations/20260924090000_add_recipes/migration.sql
git commit -m "feat: add Recipe, RecipeCategory and DietaryTag models" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `tsc` prints nothing.

---

### Task 2: Shared helpers (escape, toggle, 500 response, search registry)

**Files:**
- Create: `src/lib/escape-like-pattern.ts`, `src/lib/toggle-value.ts`
- Modify: `src/repositories/qa.repository.ts` (remove local `escapeLikePattern`, import the shared one)
- Modify: `src/components/storefront/product/filter-controls.tsx` (remove local `toggleValue`, import the shared one)
- Modify: `src/lib/api/responses.ts` (add `serverErrorResponse`)
- Modify: `src/services/search-extensions.ts` (registry on `globalThis`)
- Test: `tests/unit/escape-like-pattern.test.ts`, `tests/unit/toggle-value.test.ts`, `tests/unit/api-responses.test.ts`, `tests/unit/search-extensions.test.ts` (add one test)

**Interfaces:**
- Produces:
  - `escapeLikePattern(word: string): string`
  - `toggleValue<T>(list: readonly T[], value: T): T[]`
  - `serverErrorResponse(error: unknown, context: string): NextResponse`
  - `search-extensions.ts`: the same exports as today (`registerRecipeSearchProvider`, `searchRecipes`, `resetSearchExtensionsForTesting`, `SearchSuggestionItem`, `SearchRecipes`)

- [ ] **Step 1: Write the failing tests**

`tests/unit/escape-like-pattern.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "@/lib/escape-like-pattern";

describe("escapeLikePattern", () => {
  it("leaves ordinary words unchanged", () => {
    expect(escapeLikePattern("sambol")).toBe("sambol");
  });

  it("escapes %, _ and backslash so they match literally", () => {
    expect(escapeLikePattern("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
```

`tests/unit/toggle-value.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toggleValue } from "@/lib/toggle-value";

describe("toggleValue", () => {
  it("adds a value that isn't in the list", () => {
    expect(toggleValue(["easy"], "hard")).toEqual(["easy", "hard"]);
  });

  it("removes a value that is in the list", () => {
    expect(toggleValue(["easy", "hard"], "easy")).toEqual(["hard"]);
  });

  it("does not mutate the input list", () => {
    const list = ["easy"] as const;
    toggleValue(list, "hard");
    expect(list).toEqual(["easy"]);
  });
});
```

`tests/unit/api-responses.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { serverErrorResponse } from "@/lib/api/responses";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("serverErrorResponse", () => {
  it("logs the real error with its context and returns a generic 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("connection refused");

    const response = serverErrorResponse(failure, "GET /api/recipes");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes]", failure);
  });
});
```

Append this test inside the existing `describe("search-extensions", …)` block in `tests/unit/search-extensions.test.ts`, and add `vi` to its `vitest` import:

```ts
  it("keeps the provider on globalThis so a separately bundled copy of the module sees it", async () => {
    const item = { id: "r1", label: "Dhal Curry", href: "/recipes/dhal-curry", type: "Recipe" as const };
    registerRecipeSearchProvider(async () => [item]);

    vi.resetModules();
    const freshCopy = await import("@/services/search-extensions");

    expect(await freshCopy.searchRecipes("dhal", 3)).toEqual([item]);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/escape-like-pattern.test.ts tests/unit/toggle-value.test.ts tests/unit/api-responses.test.ts tests/unit/search-extensions.test.ts`
Expected: FAIL. The first three can't resolve their modules or export, and the new search-extensions test gets `[]`.

- [ ] **Step 3: Create `src/lib/escape-like-pattern.ts`**

```ts
/**
 * Prisma's `contains` becomes ILIKE, where `%` and `_` are wildcards and `\`
 * is the escape character. Escape all three so user search words match
 * literally. Shared by the Q&A and recipe search filters.
 */
export function escapeLikePattern(word: string): string {
  return word.replace(/[\\%_]/g, (character) => `\\${character}`);
}
```

In `src/repositories/qa.repository.ts`, delete the local `escapeLikePattern` function and its comment, and add `import { escapeLikePattern } from "@/lib/escape-like-pattern";` after the `@/lib/db` import.

- [ ] **Step 4: Create `src/lib/toggle-value.ts`**

```ts
/** Returns a new list with `value` removed if present, or appended if not. */
export function toggleValue<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
```

In `src/components/storefront/product/filter-controls.tsx`, delete the local `toggleValue` function and add `import { toggleValue } from "@/lib/toggle-value";` to the imports.

- [ ] **Step 5: Add `serverErrorResponse` to `src/lib/api/responses.ts`**

Change the file's top comment from `/** Shared by the reviews and questions route handlers. */` so it sits on `unauthorizedResponse` as before. Then append:

```ts
/**
 * For unexpected failures: logs the real error server-side (with a context
 * label such as "GET /api/recipes") and returns a generic 500 body, so no
 * internal detail reaches the browser.
 */
export function serverErrorResponse(error: unknown, context: string) {
  console.error(`[${context}]`, error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
```

- [ ] **Step 6: Move the search registry to `globalThis`**

Replace the provider variable and the three functions in `src/services/search-extensions.ts` (keep `SearchSuggestionItem` and `SearchRecipes` unchanged above them):

```ts
interface SearchProviders {
  recipes: SearchRecipes;
}

function defaultProviders(): SearchProviders {
  return { recipes: async () => [] };
}

// Kept on globalThis, not in module scope. Providers register at server
// startup from src/instrumentation.ts, which Next.js bundles separately from
// the route code that reads them, so each bundle gets its own copy of this
// module. globalThis is shared by both within the server process (same
// reason as product-detail-extensions.ts).
const globalForSearch = globalThis as unknown as { __oristorSearchProviders?: SearchProviders };
const providers = (globalForSearch.__oristorSearchProviders ??= defaultProviders());

/**
 * Epic 04 (Recipes & Food Academy) registers this through
 * registerRecipeProviders() in src/instrumentation.ts (and later STORY-061,
 * AI Smart Search), so search.service.ts never imports recipe code.
 */
export function registerRecipeSearchProvider(provider: SearchRecipes) {
  providers.recipes = provider;
}

export function searchRecipes(query: string, limit: number) {
  return providers.recipes(query, limit);
}

/** Test-only: restores the provider to its default stub. */
export function resetSearchExtensionsForTesting() {
  providers.recipes = defaultProviders().recipes;
}
```

- [ ] **Step 7: Run the tests, plus the suites that use the moved code**

Run each on its own:
- `npx vitest run tests/unit/escape-like-pattern.test.ts tests/unit/toggle-value.test.ts tests/unit/api-responses.test.ts tests/unit/search-extensions.test.ts tests/unit/search-service.test.ts tests/unit/filter-controls.test.tsx`
- `npx vitest run tests/unit/qa-repository.test.ts`

Expected: all PASS.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/lib/escape-like-pattern.ts src/lib/toggle-value.ts src/lib/api/responses.ts src/services/search-extensions.ts src/repositories/qa.repository.ts src/components/storefront/product/filter-controls.tsx tests/unit/escape-like-pattern.test.ts tests/unit/toggle-value.test.ts tests/unit/api-responses.test.ts tests/unit/search-extensions.test.ts
git commit -m "refactor: share LIKE escaping, list toggling, 500 responses and a globalThis search registry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Listing values, time helpers, query schema and URL state

**Files:**
- Create: `src/lib/recipe-listing-values.ts`, `src/lib/recipe-time.ts`, `src/validation/recipe-listing.schema.ts`, `src/lib/recipe-listing-params.ts`, `src/hooks/use-recipe-listing-params.ts`
- Test: `tests/unit/recipe-time.test.ts`, `tests/unit/recipe-listing-schema.test.ts`, `tests/unit/use-recipe-listing-params.test.tsx`

**Interfaces:**
- Produces, from `recipe-listing-values.ts`:
  - tuples `recipeSortValues`, `recipeDifficultyValues`, `recipeTimeValues`;
  - types `RecipeSort`, `RecipeDifficultyParam`, `RecipeTimeRange`, `RecipeFilters`;
  - label maps `recipeSortLabels`, `recipeDifficultyLabels`, `recipeTimeLabels`.
- Produces, from `recipe-time.ts`: `computeTotalTimeMinutes(prep: number, cook: number): number` and `formatRecipeTime(minutes: number): string`.
- Produces, from `recipe-listing.schema.ts`: `recipeListingQuerySchema` and `type RecipeListingQuery`.
- Produces, from `recipe-listing-params.ts`: `recipeListingParsers` and `serializeRecipeListing(base: string, values): string`.
- Produces, from `use-recipe-listing-params.ts`: `useRecipeListingParams()` (default history `push`) and `type RecipeListingParams`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/recipe-time.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { computeTotalTimeMinutes, formatRecipeTime } from "@/lib/recipe-time";

describe("computeTotalTimeMinutes", () => {
  it("adds prep and cook time", () => {
    expect(computeTotalTimeMinutes(15, 45)).toBe(60);
    expect(computeTotalTimeMinutes(10, 0)).toBe(10);
  });
});

describe("formatRecipeTime", () => {
  it("shows minutes under an hour", () => {
    expect(formatRecipeTime(45)).toBe("45 min");
  });

  it("shows whole hours without minutes", () => {
    expect(formatRecipeTime(60)).toBe("1 hr");
    expect(formatRecipeTime(120)).toBe("2 hr");
  });

  it("shows hours and minutes", () => {
    expect(formatRecipeTime(90)).toBe("1 hr 30 min");
  });
});
```

`tests/unit/recipe-listing-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

describe("recipeListingQuerySchema", () => {
  it("applies defaults for an empty query", () => {
    expect(recipeListingQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12, sort: "newest" });
  });

  it("parses every filter", () => {
    const query = recipeListingQuerySchema.parse({
      category: "curries",
      difficulty: "easy,hard",
      time: "under-15,60-plus",
      diet: "vegan,spicy",
      q: "  deviled prawns ",
      sort: "time",
      page: "2",
      pageSize: "24",
    });

    expect(query).toEqual({
      category: "curries",
      difficulty: ["easy", "hard"],
      time: ["under-15", "60-plus"],
      diet: ["vegan", "spicy"],
      q: "deviled prawns",
      sort: "time",
      page: 2,
      pageSize: 24,
    });
  });

  it("drops unknown difficulty and time values but keeps unknown diet slugs", () => {
    const query = recipeListingQuerySchema.parse({ difficulty: "easy,expert", time: "forever", diet: "keto" });

    expect(query.difficulty).toEqual(["easy"]);
    expect(query.time).toEqual([]);
    expect(query.diet).toEqual(["keto"]);
  });

  it("falls back to defaults for malformed values instead of failing", () => {
    const query = recipeListingQuerySchema.parse({ sort: "spiciest", page: "-3", pageSize: "500" });

    expect(query.sort).toBe("newest");
    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(12);
  });

  it("treats blank category and q as absent and caps q at 100 characters", () => {
    expect(recipeListingQuerySchema.parse({ category: "  ", q: "   " })).toEqual({ page: 1, pageSize: 12, sort: "newest" });
    expect(recipeListingQuerySchema.parse({ q: "a".repeat(150) }).q).toHaveLength(100);
  });

  it("ignores repeated keys (arrays) rather than failing", () => {
    expect(recipeListingQuerySchema.parse({ category: ["curries", "snacks"] }).category).toBeUndefined();
  });
});
```

`tests/unit/use-recipe-listing-params.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";

import { useRecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { serializeRecipeListing } from "@/lib/recipe-listing-params";

describe("useRecipeListingParams", () => {
  it("defaults sort to newest and page to 1", () => {
    const { result } = renderHook(() => useRecipeListingParams(), { wrapper: withNuqsTestingAdapter() });
    const [params] = result.current;

    expect(params.sort).toBe("newest");
    expect(params.page).toBe(1);
    expect(params.category).toBeNull();
  });

  it("reads comma-separated lists from the URL", () => {
    const { result } = renderHook(() => useRecipeListingParams(), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?difficulty=easy,medium&time=15-30&diet=vegan,spicy&category=curries" }),
    });
    const [params] = result.current;

    expect(params.difficulty).toEqual(["easy", "medium"]);
    expect(params.time).toEqual(["15-30"]);
    expect(params.diet).toEqual(["vegan", "spicy"]);
    expect(params.category).toBe("curries");
  });

  it("pushes a history entry by default so Back restores the previous filters", async () => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useRecipeListingParams(), {
      wrapper: withNuqsTestingAdapter({ onUrlUpdate }),
    });

    await act(async () => {
      await result.current[1]({ category: "curries" });
    });

    expect(onUrlUpdate).toHaveBeenCalledWith(expect.objectContaining({ queryString: "?category=curries" }));
    expect(onUrlUpdate.mock.calls[0][0].options.history).toBe("push");
  });
});

describe("serializeRecipeListing", () => {
  it("omits defaults and empty values", () => {
    expect(serializeRecipeListing("/recipes", { category: "curries", sort: "newest", page: 1 })).toBe("/recipes?category=curries");
    expect(serializeRecipeListing("/recipes", { category: null })).toBe("/recipes");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/recipe-time.test.ts tests/unit/recipe-listing-schema.test.ts tests/unit/use-recipe-listing-params.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `src/lib/recipe-listing-values.ts`**

```ts
/**
 * The recipe listing's URL/API contract (STORY-017). Shared by the Zod query
 * schema, the nuqs URL parsers, the repository's query builders and the
 * filter UI, so every layer agrees on the same values and labels.
 */
export const recipeSortValues = ["newest", "popular", "rating", "time"] as const;
export type RecipeSort = (typeof recipeSortValues)[number];

export const recipeDifficultyValues = ["easy", "medium", "hard"] as const;
export type RecipeDifficultyParam = (typeof recipeDifficultyValues)[number];

/** Half-open ranges on total time: under-15 < 15 ≤ 15-30 < 30 ≤ 30-60 < 60 ≤ 60-plus. */
export const recipeTimeValues = ["under-15", "15-30", "30-60", "60-plus"] as const;
export type RecipeTimeRange = (typeof recipeTimeValues)[number];

export const recipeSortLabels: Record<RecipeSort, string> = {
  newest: "Newest",
  popular: "Most Popular",
  rating: "Highest Rated",
  time: "Cook Time (shortest first)",
};

export const recipeDifficultyLabels: Record<RecipeDifficultyParam, "Easy" | "Medium" | "Hard"> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const recipeTimeLabels: Record<RecipeTimeRange, string> = {
  "under-15": "Under 15 min",
  "15-30": "15–30 min",
  "30-60": "30–60 min",
  "60-plus": "60+ min",
};

/** Filters only; sort and pagination travel separately. */
export interface RecipeFilters {
  category?: string;
  difficulty?: RecipeDifficultyParam[];
  time?: RecipeTimeRange[];
  /** Dietary tag slugs; a recipe must have every one. */
  diet?: string[];
  q?: string;
}
```

- [ ] **Step 4: Create `src/lib/recipe-time.ts`**

```ts
/**
 * The only place total time is derived. The seed, the service's
 * createRecipe() and STORY-043's admin builder all go through it, so the
 * stored Recipe.totalTimeMinutes can never drift from prep + cook.
 */
export function computeTotalTimeMinutes(prepTimeMinutes: number, cookTimeMinutes: number): number {
  return prepTimeMinutes + cookTimeMinutes;
}

/** "45 min", "1 hr", "1 hr 30 min". */
export function formatRecipeTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
```

- [ ] **Step 5: Create `src/validation/recipe-listing.schema.ts`**

```ts
import { z } from "zod";

import { recipeDifficultyValues, recipeSortValues, recipeTimeValues } from "@/lib/recipe-listing-values";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Comma-separated list restricted to known values. Unknown values are
 * dropped, not rejected, so a stale bookmark still loads.
 */
function knownValues<const T extends readonly string[]>(allowed: T) {
  return z
    .string()
    .transform((value) =>
      splitList(value).filter((item): item is T[number] => (allowed as readonly string[]).includes(item)),
    )
    .optional()
    .catch(undefined);
}

/**
 * Query contract for /recipes and GET /api/recipes. Every field uses
 * `.catch()`, so a malformed or stale query never fails the request. It
 * falls back to defaults instead (same policy as productListingQuerySchema).
 * `.transform()` comes before `.optional()` so inferred keys stay optional.
 */
export const recipeListingQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  difficulty: knownValues(recipeDifficultyValues),
  time: knownValues(recipeTimeValues),
  // Unknown dietary slugs are kept: they simply match no recipes.
  diet: z.string().transform(splitList).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, 100))
    .optional()
    .catch(undefined),
  sort: z.enum(recipeSortValues).catch("newest"),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});

export type RecipeListingQuery = z.infer<typeof recipeListingQuerySchema>;
```

Note: `z.string().trim().min(1)` on `"  "` fails `min(1)` after trimming, and `.catch(undefined)` then yields `undefined`. The first schema test's `toEqual` relies on absent keys being `undefined`; `toEqual` treats `undefined` properties as absent.

- [ ] **Step 6: Create `src/lib/recipe-listing-params.ts`**

```ts
import {
  createSerializer,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { recipeDifficultyValues, recipeSortValues, recipeTimeValues } from "@/lib/recipe-listing-values";

/**
 * The recipe listing's URL state (see recipe-listing-values.ts for the
 * contract). Client-safe: nuqs/server's parsers and serializer have no
 * server-only dependencies (product-listing-params.ts does the same).
 * `pageSize` is API-only and never in the page URL.
 */
export const recipeListingParsers = {
  category: parseAsString,
  difficulty: parseAsArrayOf(parseAsStringLiteral(recipeDifficultyValues)),
  time: parseAsArrayOf(parseAsStringLiteral(recipeTimeValues)),
  diet: parseAsArrayOf(parseAsString),
  q: parseAsString,
  sort: parseAsStringLiteral(recipeSortValues).withDefault("newest"),
  page: parseAsInteger.withDefault(1),
};

/** Builds `/recipes?...` hrefs (e.g. category chips) with defaults omitted. */
export const serializeRecipeListing = createSerializer(recipeListingParsers);
```

- [ ] **Step 7: Create `src/hooks/use-recipe-listing-params.ts`**

```ts
"use client";

import { useQueryStates, type Values } from "nuqs";

import { recipeListingParsers } from "@/lib/recipe-listing-params";

export type RecipeListingParams = Values<typeof recipeListingParsers>;

/**
 * Filter, sort and page changes push a history entry so Back/Forward walk
 * through them. The search box overrides this with `{ history: "replace" }`
 * so typing doesn't create one entry per keystroke.
 */
export function useRecipeListingParams() {
  return useQueryStates(recipeListingParsers, { history: "push" });
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run tests/unit/recipe-time.test.ts tests/unit/recipe-listing-schema.test.ts tests/unit/use-recipe-listing-params.test.tsx`
Expected: PASS.

If the serializer test fails only because nuqs renders the empty query as `/recipes?`, adjust the assertion to what nuqs 2.9 actually returns for an all-null input, and note that in your report. Don't wrap the serializer.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/lib/recipe-listing-values.ts src/lib/recipe-time.ts src/validation/recipe-listing.schema.ts src/lib/recipe-listing-params.ts src/hooks/use-recipe-listing-params.ts tests/unit/recipe-time.test.ts tests/unit/recipe-listing-schema.test.ts tests/unit/use-recipe-listing-params.test.tsx
git commit -m "feat: add recipe listing query contract, URL state and time helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Recipe repository

**Files:**
- Create: `src/repositories/recipe.repository.ts`
- Create: `tests/unit/recipe-fixtures.ts` (helpers, not a test file)
- Test: `tests/unit/recipe-query-builders.test.ts`, `tests/unit/recipe-repository.test.ts`

**Interfaces:**
- Consumes: `RecipeFilters`, `RecipeSort`, `RecipeDifficultyParam`, `RecipeTimeRange` (Task 3), `escapeLikePattern` (Task 2), `computeTotalTimeMinutes` (Task 3, fixtures only).
- Produces:
  - `buildRecipeWhere(filters: RecipeFilters): { AND: Prisma.RecipeWhereInput[] }`
  - `buildRecipeOrderBy(sort: RecipeSort): Prisma.RecipeOrderByWithRelationInput[]`
  - `recipeCardSelect` and `type RecipeCardRow`
  - `findPublishedRecipes(args: { where: Prisma.RecipeWhereInput; orderBy: Prisma.RecipeOrderByWithRelationInput[]; skip: number; take: number }): Promise<{ rows: RecipeCardRow[]; total: number }>`
  - `findActiveCategoriesWithPublishedRecipes(): Promise<Array<{ name: string; slug: string }>>`
  - `findActiveDietaryTagsWithPublishedRecipes(): Promise<Array<{ name: string; slug: string }>>`
  - `findFeaturedRecipes(limit: number): Promise<RecipeCardRow[]>`
  - `createRecipeCategory(data: Prisma.RecipeCategoryCreateInput)`, `createDietaryTag(data: Prisma.DietaryTagCreateInput)`, `createRecipe(data: Prisma.RecipeUncheckedCreateInput)`
- Produces (tests): `makeCategory`, `makeDietaryTag`, `makeRecipe`, `cleanupRecipes` from `tests/unit/recipe-fixtures.ts`.

- [ ] **Step 1: Create `tests/unit/recipe-fixtures.ts`**

```ts
import type { ContentStatus, RecipeDifficulty, RecipeStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createDietaryTag, createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

let sequence = 0;

function nextNumber() {
  sequence += 1;
  return sequence;
}

interface TaxonomyOverrides {
  name?: string;
  slug?: string;
  status?: ContentStatus;
  sortOrder?: number;
}

export function makeCategory(overrides: TaxonomyOverrides = {}) {
  const n = nextNumber();
  return createRecipeCategory({
    name: overrides.name ?? `Category ${n}`,
    slug: overrides.slug ?? `category-${n}`,
    status: overrides.status,
    sortOrder: overrides.sortOrder,
  });
}

export function makeDietaryTag(overrides: TaxonomyOverrides = {}) {
  const n = nextNumber();
  return createDietaryTag({
    name: overrides.name ?? `Tag ${n}`,
    slug: overrides.slug ?? `tag-${n}`,
    status: overrides.status,
    sortOrder: overrides.sortOrder,
  });
}

export interface RecipeFixtureOverrides {
  slug?: string;
  title?: string;
  shortDescription?: string;
  cuisine?: string | null;
  difficulty?: RecipeDifficulty;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  status?: RecipeStatus;
  isFeatured?: boolean;
  viewCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  publishedAt?: Date | null;
  dietaryTagIds?: string[];
}

/** Test fixture: writes a recipe in any state directly. Defaults to Published, Easy, 30 minutes. */
export function makeRecipe(categoryId: string, overrides: RecipeFixtureOverrides = {}) {
  const n = nextNumber();
  const prep = overrides.prepTimeMinutes ?? 10;
  const cook = overrides.cookTimeMinutes ?? 20;
  return createRecipe({
    slug: overrides.slug ?? `recipe-${n}`,
    title: overrides.title ?? `Recipe ${n}`,
    shortDescription: overrides.shortDescription ?? "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId,
    cuisine: overrides.cuisine ?? null,
    difficulty: overrides.difficulty ?? "Easy",
    prepTimeMinutes: prep,
    cookTimeMinutes: cook,
    totalTimeMinutes: computeTotalTimeMinutes(prep, cook),
    servings: 4,
    status: overrides.status ?? "Published",
    isFeatured: overrides.isFeatured ?? false,
    viewCount: overrides.viewCount ?? 0,
    avgRating: overrides.avgRating ?? null,
    ratingCount: overrides.ratingCount ?? 0,
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    dietaryTags: { create: (overrides.dietaryTagIds ?? []).map((dietaryTagId) => ({ dietaryTagId })) },
  });
}

export async function cleanupRecipes() {
  await prisma.recipe.deleteMany();
  await prisma.dietaryTag.deleteMany();
  await prisma.recipeCategory.deleteMany();
}
```

- [ ] **Step 2: Write the failing pure builder tests**

`tests/unit/recipe-query-builders.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { recipeSortValues } from "@/lib/recipe-listing-values";
import { buildRecipeOrderBy, buildRecipeWhere } from "@/repositories/recipe.repository";

describe("buildRecipeWhere", () => {
  it("filters on Published only when no filters are given", () => {
    expect(buildRecipeWhere({})).toEqual({ AND: [{ status: "Published" }] });
  });

  it("always keeps Published as the first condition", () => {
    const where = buildRecipeWhere({
      category: "curries",
      difficulty: ["easy"],
      time: ["under-15"],
      diet: ["vegan"],
      q: "dhal",
    });

    expect(where.AND[0]).toEqual({ status: "Published" });
    expect(where.AND).toHaveLength(6);
  });

  it("filters an Active category by slug", () => {
    expect(buildRecipeWhere({ category: "curries" }).AND).toContainEqual({
      category: { is: { slug: "curries", status: "Active" } },
    });
  });

  it("maps difficulty params to enum values (OR)", () => {
    expect(buildRecipeWhere({ difficulty: ["easy", "hard"] }).AND).toContainEqual({
      difficulty: { in: ["Easy", "Hard"] },
    });
  });

  it("ORs half-open time ranges on totalTimeMinutes", () => {
    expect(buildRecipeWhere({ time: ["under-15", "30-60", "60-plus"] }).AND).toContainEqual({
      OR: [
        { totalTimeMinutes: { lt: 15 } },
        { totalTimeMinutes: { gte: 30, lt: 60 } },
        { totalTimeMinutes: { gte: 60 } },
      ],
    });
  });

  it("requires every selected dietary tag (one condition per tag)", () => {
    const and = buildRecipeWhere({ diet: ["vegan", "spicy"] }).AND;

    expect(and).toContainEqual({ dietaryTags: { some: { dietaryTag: { slug: "vegan", status: "Active" } } } });
    expect(and).toContainEqual({ dietaryTags: { some: { dietaryTag: { slug: "spicy", status: "Active" } } } });
  });

  it("requires every search word in the title or short description, with wildcards escaped", () => {
    const and = buildRecipeWhere({ q: "  deviled   100% " }).AND;

    expect(and).toContainEqual({
      OR: [
        { title: { contains: "deviled", mode: "insensitive" } },
        { shortDescription: { contains: "deviled", mode: "insensitive" } },
      ],
    });
    expect(and).toContainEqual({
      OR: [
        { title: { contains: "100\\%", mode: "insensitive" } },
        { shortDescription: { contains: "100\\%", mode: "insensitive" } },
      ],
    });
    expect(and).toHaveLength(3);
  });

  it("ignores empty lists and blank search", () => {
    expect(buildRecipeWhere({ difficulty: [], time: [], diet: [], q: "   " })).toEqual({ AND: [{ status: "Published" }] });
  });
});

describe("buildRecipeOrderBy", () => {
  it("orders each sort as specified", () => {
    expect(buildRecipeOrderBy("newest")).toEqual([{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }]);
    expect(buildRecipeOrderBy("popular")).toEqual([{ viewCount: "desc" }, { id: "asc" }]);
    expect(buildRecipeOrderBy("rating")).toEqual([
      { avgRating: { sort: "desc", nulls: "last" } },
      { ratingCount: "desc" },
      { id: "asc" },
    ]);
    expect(buildRecipeOrderBy("time")).toEqual([{ totalTimeMinutes: "asc" }, { id: "asc" }]);
  });

  it("ends every sort with the id tiebreaker", () => {
    for (const sort of recipeSortValues) {
      expect(buildRecipeOrderBy(sort).at(-1)).toEqual({ id: "asc" });
    }
  });
});
```

- [ ] **Step 3: Write the failing database tests**

`tests/unit/recipe-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { RecipeFilters } from "@/lib/recipe-listing-values";
import {
  buildRecipeOrderBy,
  buildRecipeWhere,
  findActiveCategoriesWithPublishedRecipes,
  findActiveDietaryTagsWithPublishedRecipes,
  findFeaturedRecipes,
  findPublishedRecipes,
} from "@/repositories/recipe.repository";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

async function titlesFor(filters: RecipeFilters, sort: Parameters<typeof buildRecipeOrderBy>[0] = "newest") {
  const { rows } = await findPublishedRecipes({
    where: buildRecipeWhere(filters),
    orderBy: buildRecipeOrderBy(sort),
    skip: 0,
    take: 50,
  });
  return rows.map((row) => row.title);
}

describe("Published only", () => {
  it("never returns Draft, Review, Approved or Archived recipes, whatever the filters", async () => {
    const category = await makeCategory({ slug: "shared-category" });
    const tag = await makeDietaryTag({ slug: "shared-tag" });
    const shared = { difficulty: "Easy" as const, prepTimeMinutes: 5, cookTimeMinutes: 5, dietaryTagIds: [tag.id], isFeatured: true };
    await makeRecipe(category.id, { ...shared, title: "Shared Published" });
    for (const status of ["Draft", "Review", "Approved", "Archived"] as const) {
      await makeRecipe(category.id, { ...shared, title: `Shared ${status}`, status });
    }

    const combinations: RecipeFilters[] = [
      {},
      { category: "shared-category" },
      { difficulty: ["easy"] },
      { time: ["under-15"] },
      { diet: ["shared-tag"] },
      { q: "shared" },
      { category: "shared-category", difficulty: ["easy"], time: ["under-15"], diet: ["shared-tag"], q: "shared" },
    ];
    for (const filters of combinations) {
      expect(await titlesFor(filters)).toEqual(["Shared Published"]);
    }
    expect((await findFeaturedRecipes(10)).map((row) => row.title)).toEqual(["Shared Published"]);
  });
});

describe("filters", () => {
  it("puts boundary times into exactly one range", async () => {
    const category = await makeCategory();
    for (const total of [14, 15, 29, 30, 59, 60]) {
      await makeRecipe(category.id, { title: `T${total}`, prepTimeMinutes: 0, cookTimeMinutes: total });
    }

    expect(await titlesFor({ time: ["under-15"] }, "time")).toEqual(["T14"]);
    expect(await titlesFor({ time: ["15-30"] }, "time")).toEqual(["T15", "T29"]);
    expect(await titlesFor({ time: ["30-60"] }, "time")).toEqual(["T30", "T59"]);
    expect(await titlesFor({ time: ["60-plus"] }, "time")).toEqual(["T60"]);
    expect(await titlesFor({ time: ["under-15", "60-plus"] }, "time")).toEqual(["T14", "T60"]);
  });

  it("requires every dietary tag (AND) but any difficulty (OR)", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ slug: "vegan" });
    const spicy = await makeDietaryTag({ slug: "spicy" });
    await makeRecipe(category.id, { title: "Both", difficulty: "Easy", dietaryTagIds: [vegan.id, spicy.id] });
    await makeRecipe(category.id, { title: "Vegan only", difficulty: "Hard", dietaryTagIds: [vegan.id] });
    await makeRecipe(category.id, { title: "Medium", difficulty: "Medium" });

    expect(await titlesFor({ diet: ["vegan", "spicy"] })).toEqual(["Both"]);
    expect((await titlesFor({ diet: ["vegan"] })).sort()).toEqual(["Both", "Vegan only"]);
    expect((await titlesFor({ difficulty: ["easy", "hard"] })).sort()).toEqual(["Both", "Vegan only"]);
    expect(await titlesFor({ diet: ["unknown-tag"] })).toEqual([]);
  });

  it("ignores an Inactive dietary tag when filtering", async () => {
    const category = await makeCategory();
    const hidden = await makeDietaryTag({ slug: "hidden", status: "Inactive" });
    await makeRecipe(category.id, { title: "Tagged", dietaryTagIds: [hidden.id] });

    expect(await titlesFor({ diet: ["hidden"] })).toEqual([]);
  });

  it("matches nothing for an Inactive or unknown category", async () => {
    const inactive = await makeCategory({ slug: "retired", status: "Inactive" });
    await makeRecipe(inactive.id, { title: "In retired category" });

    expect(await titlesFor({ category: "retired" })).toEqual([]);
    expect(await titlesFor({ category: "no-such-category" })).toEqual([]);
    expect(await titlesFor({})).toEqual(["In retired category"]);
  });

  it("searches title and short description case-insensitively, every word required, wildcards literal", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Coconut Sambol", shortDescription: "Fresh coconut with chilli." });
    await makeRecipe(category.id, { title: "Dhal Curry", shortDescription: "Lentils with COCONUT milk." });
    await makeRecipe(category.id, { title: "100% Kithul Treacle Pudding" });
    await makeRecipe(category.id, { title: "1000 Layer Cake" });

    expect((await titlesFor({ q: "coconut" })).sort()).toEqual(["Coconut Sambol", "Dhal Curry"]);
    expect(await titlesFor({ q: "coconut lentils" })).toEqual(["Dhal Curry"]);
    expect(await titlesFor({ q: "100%" })).toEqual(["100% Kithul Treacle Pudding"]);
  });
});

describe("sorting and pagination", () => {
  it("sorts by views, rating (nulls last) and newest (nulls last)", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "A", viewCount: 10, avgRating: 4.2, ratingCount: 3, publishedAt: new Date("2026-01-01") });
    await makeRecipe(category.id, { title: "B", viewCount: 30, avgRating: null, ratingCount: 0, publishedAt: null });
    await makeRecipe(category.id, { title: "C", viewCount: 20, avgRating: 4.8, ratingCount: 9, publishedAt: new Date("2026-06-01") });

    expect(await titlesFor({}, "popular")).toEqual(["B", "C", "A"]);
    expect(await titlesFor({}, "rating")).toEqual(["C", "A", "B"]);
    expect(await titlesFor({}, "newest")).toEqual(["C", "A", "B"]);
  });

  it("pages with a correct total", async () => {
    const category = await makeCategory();
    for (let i = 1; i <= 5; i += 1) {
      await makeRecipe(category.id, { title: `P${i}`, prepTimeMinutes: 0, cookTimeMinutes: i });
    }

    const { rows, total } = await findPublishedRecipes({
      where: buildRecipeWhere({}),
      orderBy: buildRecipeOrderBy("time"),
      skip: 2,
      take: 2,
    });

    expect(total).toBe(5);
    expect(rows.map((row) => row.title)).toEqual(["P3", "P4"]);
  });

  it("selects card fields with category name and Active tag names in tag sortOrder", async () => {
    const category = await makeCategory({ name: "Curries" });
    const spicy = await makeDietaryTag({ name: "Spicy", sortOrder: 2 });
    const vegan = await makeDietaryTag({ name: "Vegan", sortOrder: 1 });
    const hidden = await makeDietaryTag({ name: "Hidden", status: "Inactive" });
    await makeRecipe(category.id, { title: "Card", dietaryTagIds: [spicy.id, vegan.id, hidden.id], avgRating: 4.5, ratingCount: 2 });

    const { rows } = await findPublishedRecipes({ where: buildRecipeWhere({}), orderBy: buildRecipeOrderBy("newest"), skip: 0, take: 1 });

    expect(rows[0].category.name).toBe("Curries");
    expect(rows[0].dietaryTags.map((link) => link.dietaryTag.name)).toEqual(["Vegan", "Spicy"]);
    expect(rows[0].avgRating?.toNumber()).toBe(4.5);
  });
});

describe("facets", () => {
  it("lists only Active categories and tags that have a Published recipe, in sortOrder", async () => {
    const snacks = await makeCategory({ name: "Snacks", slug: "snacks", sortOrder: 2 });
    const curries = await makeCategory({ name: "Curries", slug: "curries", sortOrder: 1 });
    const draftOnly = await makeCategory({ name: "Draft only", slug: "draft-only" });
    const inactive = await makeCategory({ name: "Inactive", slug: "inactive", status: "Inactive" });
    await makeCategory({ name: "Empty", slug: "empty" });
    const vegan = await makeDietaryTag({ name: "Vegan", slug: "vegan" });
    const unused = await makeDietaryTag({ name: "Unused", slug: "unused" });
    const retired = await makeDietaryTag({ name: "Retired", slug: "retired", status: "Inactive" });

    await makeRecipe(snacks.id, { dietaryTagIds: [vegan.id, retired.id] });
    await makeRecipe(curries.id);
    await makeRecipe(draftOnly.id, { status: "Draft", dietaryTagIds: [unused.id] });
    await makeRecipe(inactive.id);

    expect(await findActiveCategoriesWithPublishedRecipes()).toEqual([
      { name: "Curries", slug: "curries" },
      { name: "Snacks", slug: "snacks" },
    ]);
    expect(await findActiveDietaryTagsWithPublishedRecipes()).toEqual([{ name: "Vegan", slug: "vegan" }]);
  });
});

describe("findFeaturedRecipes", () => {
  it("returns Published featured recipes, newest first, up to the limit", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Old", isFeatured: true, publishedAt: new Date("2026-01-01") });
    await makeRecipe(category.id, { title: "New", isFeatured: true, publishedAt: new Date("2026-06-01") });
    await makeRecipe(category.id, { title: "Newest", isFeatured: true, publishedAt: new Date("2026-09-01") });
    await makeRecipe(category.id, { title: "Not featured" });
    await makeRecipe(category.id, { title: "Draft", status: "Draft", isFeatured: true });

    expect((await findFeaturedRecipes(2)).map((row) => row.title)).toEqual(["Newest", "New"]);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run tests/unit/recipe-query-builders.test.ts`
Expected: FAIL (module `@/repositories/recipe.repository` not found).

- [ ] **Step 5: Create `src/repositories/recipe.repository.ts`**

```ts
import type { Prisma, RecipeDifficulty } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { escapeLikePattern } from "@/lib/escape-like-pattern";
import type { RecipeDifficultyParam, RecipeFilters, RecipeSort, RecipeTimeRange } from "@/lib/recipe-listing-values";

const difficultyByParam: Record<RecipeDifficultyParam, RecipeDifficulty> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

// Half-open, so a boundary value (15, 30, 60) falls into exactly one range.
const timeRangeBounds: Record<RecipeTimeRange, Prisma.IntFilter<"Recipe">> = {
  "under-15": { lt: 15 },
  "15-30": { gte: 15, lt: 30 },
  "30-60": { gte: 30, lt: 60 },
  "60-plus": { gte: 60 },
};

function searchWords(q: string | undefined): string[] {
  return (q ?? "").split(/\s+/).filter(Boolean);
}

/**
 * The storefront's single recipe filter. Pure, so it's unit-testable without
 * a database. The first condition is always `status: "Published"`: nothing
 * else in the storefront can widen it.
 */
export function buildRecipeWhere(filters: RecipeFilters): { AND: Prisma.RecipeWhereInput[] } {
  const and: Prisma.RecipeWhereInput[] = [{ status: "Published" }];

  if (filters.category) {
    and.push({ category: { is: { slug: filters.category, status: "Active" } } });
  }
  if (filters.difficulty && filters.difficulty.length > 0) {
    and.push({ difficulty: { in: filters.difficulty.map((param) => difficultyByParam[param]) } });
  }
  if (filters.time && filters.time.length > 0) {
    and.push({ OR: filters.time.map((range) => ({ totalTimeMinutes: timeRangeBounds[range] })) });
  }
  for (const slug of filters.diet ?? []) {
    and.push({ dietaryTags: { some: { dietaryTag: { slug, status: "Active" } } } });
  }
  for (const word of searchWords(filters.q)) {
    const escaped = escapeLikePattern(word);
    and.push({
      OR: [
        { title: { contains: escaped, mode: "insensitive" } },
        { shortDescription: { contains: escaped, mode: "insensitive" } },
      ],
    });
  }

  return { AND: and };
}

/** Every sort ends with `id` so pagination never repeats or skips a recipe. */
export function buildRecipeOrderBy(sort: RecipeSort): Prisma.RecipeOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ viewCount: "desc" }, { id: "asc" }];
    case "rating":
      return [{ avgRating: { sort: "desc", nulls: "last" } }, { ratingCount: "desc" }, { id: "asc" }];
    case "time":
      return [{ totalTimeMinutes: "asc" }, { id: "asc" }];
    case "newest":
      return [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }];
  }
}

export const recipeCardSelect = {
  id: true,
  slug: true,
  title: true,
  heroImage: true,
  heroImageAlt: true,
  cuisine: true,
  difficulty: true,
  totalTimeMinutes: true,
  avgRating: true,
  ratingCount: true,
  category: { select: { name: true } },
  dietaryTags: {
    where: { dietaryTag: { status: "Active" } },
    orderBy: { dietaryTag: { sortOrder: "asc" } },
    select: { dietaryTag: { select: { name: true } } },
  },
} satisfies Prisma.RecipeSelect;

export type RecipeCardRow = Prisma.RecipeGetPayload<{ select: typeof recipeCardSelect }>;

export async function findPublishedRecipes(args: {
  where: Prisma.RecipeWhereInput;
  orderBy: Prisma.RecipeOrderByWithRelationInput[];
  skip: number;
  take: number;
}): Promise<{ rows: RecipeCardRow[]; total: number }> {
  const [rows, total] = await prisma.$transaction([
    prisma.recipe.findMany({
      where: args.where,
      orderBy: args.orderBy,
      skip: args.skip,
      take: args.take,
      select: recipeCardSelect,
    }),
    prisma.recipe.count({ where: args.where }),
  ]);
  return { rows, total };
}

const facetOrder = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/** Admins can create categories ahead of content; empty ones stay off the storefront. */
export function findActiveCategoriesWithPublishedRecipes() {
  return prisma.recipeCategory.findMany({
    where: { status: "Active", recipes: { some: { status: "Published" } } },
    orderBy: facetOrder,
    select: { name: true, slug: true },
  });
}

export function findActiveDietaryTagsWithPublishedRecipes() {
  return prisma.dietaryTag.findMany({
    where: { status: "Active", recipes: { some: { recipe: { status: "Published" } } } },
    orderBy: facetOrder,
    select: { name: true, slug: true },
  });
}

export function findFeaturedRecipes(limit: number) {
  return prisma.recipe.findMany({
    where: { status: "Published", isFeatured: true },
    orderBy: buildRecipeOrderBy("newest"),
    take: limit,
    select: recipeCardSelect,
  });
}

// Writes. Used by the seed and tests now; STORY-043's admin builder later.

export function createRecipeCategory(data: Prisma.RecipeCategoryCreateInput) {
  return prisma.recipeCategory.create({ data });
}

export function createDietaryTag(data: Prisma.DietaryTagCreateInput) {
  return prisma.dietaryTag.create({ data });
}

export function createRecipe(data: Prisma.RecipeUncheckedCreateInput) {
  return prisma.recipe.create({ data });
}
```

If `Prisma.IntFilter<"Recipe">` doesn't exist in the generated client (the generic parameter varies by Prisma version), use `Prisma.IntFilter` without a type argument.

- [ ] **Step 5b: Check the published-only test's setup**

In the "Published only" test, the non-Published recipes get the same `isFeatured: true`, category, tag, difficulty and time as the Published one. That is deliberate: every filter combination would match them if the status guard were missing.

- [ ] **Step 6: Run the tests**

Run these one at a time:
- `npx vitest run tests/unit/recipe-query-builders.test.ts`
- `npx vitest run tests/unit/recipe-repository.test.ts`

Expected: PASS.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/repositories/recipe.repository.ts tests/unit/recipe-fixtures.ts tests/unit/recipe-query-builders.test.ts tests/unit/recipe-repository.test.ts
git commit -m "feat: add recipe repository with published-only filter and sort builders" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Recipe service and header-search provider

**Files:**
- Create: `src/types/recipe.ts`, `src/services/recipe.service.ts`
- Modify: `src/instrumentation.ts`
- Test: `tests/unit/recipe-service.test.ts`

**Interfaces:**
- Consumes: Task 4 repository exports; `registerRecipeSearchProvider`, `searchRecipes`, `resetSearchExtensionsForTesting`, `SearchSuggestionItem` (Task 2); `RecipeListingQuery` (Task 3); `computeTotalTimeMinutes` (Task 3).
- Produces, from `src/types/recipe.ts`: `RecipeCard`, `RecipeListResult`, `RecipeFacetOption`, `RecipeFacets` (exact shapes below).
- Produces, from `src/services/recipe.service.ts`:
  - `listRecipes(query: RecipeListingQuery): Promise<RecipeListResult>`
  - `listRecipeFacets(): Promise<RecipeFacets>`
  - `getFeaturedRecipes(limit?: number): Promise<RecipeCard[]>` (default 4)
  - `createRecipe(input: NewRecipeInput)` and `type NewRecipeInput`
  - `searchRecipeSuggestions(query: string, limit: number): Promise<SearchSuggestionItem[]>`
  - `registerRecipeProviders(): void`

- [ ] **Step 1: Create `src/types/recipe.ts`**

```ts
/** One recipe card, used by the /recipes grid, the homepage and GET /api/recipes. */
export interface RecipeCard {
  id: string;
  slug: string;
  /** `/recipes/${slug}` (the detail page is STORY-018). */
  href: string;
  title: string;
  heroImage: string;
  heroImageAlt: string;
  categoryName: string;
  cuisine: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  totalTimeMinutes: number;
  /** null until the recipe has ratings (STORY-022). */
  avgRating: number | null;
  ratingCount: number;
  /** Active dietary tag names, in tag sortOrder. */
  dietaryTags: string[];
}

export interface RecipeListResult {
  recipes: RecipeCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecipeFacetOption {
  name: string;
  slug: string;
}

export interface RecipeFacets {
  categories: RecipeFacetOption[];
  dietaryTags: RecipeFacetOption[];
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/recipe-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createRecipe,
  getFeaturedRecipes,
  listRecipeFacets,
  listRecipes,
  registerRecipeProviders,
  searchRecipeSuggestions,
} from "@/services/recipe.service";
import { resetSearchExtensionsForTesting, searchRecipes } from "@/services/search-extensions";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  resetSearchExtensionsForTesting();
  await cleanupRecipes();
});

describe("createRecipe", () => {
  it("derives totalTimeMinutes from prep + cook and links dietary tags", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ name: "Vegan" });

    const recipe = await createRecipe({
      slug: "dhal-curry",
      title: "Dhal Curry",
      shortDescription: "Red lentils in coconut milk.",
      heroImage: "/images/products/export/turmeric-powder.webp",
      heroImageAlt: "Oristor turmeric powder, used in this recipe",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 5,
      cookTimeMinutes: 25,
      servings: 4,
      status: "Published",
      dietaryTagIds: [vegan.id],
    });

    expect(recipe.totalTimeMinutes).toBe(30);
    expect(await prisma.recipeDietaryTag.count({ where: { recipeId: recipe.id } })).toBe(1);
  });
});

describe("listRecipes", () => {
  it("maps rows to RecipeCard and echoes page and pageSize", async () => {
    const category = await makeCategory({ name: "Curries" });
    const spicy = await makeDietaryTag({ name: "Spicy" });
    await makeRecipe(category.id, {
      slug: "chicken-curry",
      title: "Chicken Curry",
      cuisine: "Sri Lankan",
      difficulty: "Medium",
      prepTimeMinutes: 15,
      cookTimeMinutes: 45,
      avgRating: 4.9,
      ratingCount: 58,
      dietaryTagIds: [spicy.id],
    });

    const result = await listRecipes(recipeListingQuerySchema.parse({}));

    expect(result).toEqual({
      recipes: [
        {
          id: expect.any(String),
          slug: "chicken-curry",
          href: "/recipes/chicken-curry",
          title: "Chicken Curry",
          heroImage: "/images/products/export/curry-powder.webp",
          heroImageAlt: "Test hero image",
          categoryName: "Curries",
          cuisine: "Sri Lankan",
          difficulty: "Medium",
          totalTimeMinutes: 60,
          avgRating: 4.9,
          ratingCount: 58,
          dietaryTags: ["Spicy"],
        },
      ],
      total: 1,
      page: 1,
      pageSize: 12,
    });
  });

  it("keeps a missing rating as null", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id);

    const result = await listRecipes(recipeListingQuerySchema.parse({}));

    expect(result.recipes[0].avgRating).toBeNull();
    expect(result.recipes[0].ratingCount).toBe(0);
  });

  it("applies filters, sort and paging from the query", async () => {
    const category = await makeCategory({ slug: "curries" });
    for (let i = 1; i <= 3; i += 1) {
      await makeRecipe(category.id, { title: `Curry ${i}`, prepTimeMinutes: 0, cookTimeMinutes: i });
    }
    await makeRecipe((await makeCategory()).id, { title: "Elsewhere" });

    const result = await listRecipes(
      recipeListingQuerySchema.parse({ category: "curries", sort: "time", page: "2", pageSize: "2" }),
    );

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.recipes.map((recipe) => recipe.title)).toEqual(["Curry 3"]);
  });
});

describe("listRecipeFacets", () => {
  it("returns categories and dietary tags as name/slug pairs", async () => {
    const category = await makeCategory({ name: "Snacks", slug: "snacks" });
    const vegan = await makeDietaryTag({ name: "Vegan", slug: "vegan" });
    await makeRecipe(category.id, { dietaryTagIds: [vegan.id] });

    expect(await listRecipeFacets()).toEqual({
      categories: [{ name: "Snacks", slug: "snacks" }],
      dietaryTags: [{ name: "Vegan", slug: "vegan" }],
    });
  });
});

describe("getFeaturedRecipes", () => {
  it("returns at most 4 featured Published recipes by default", async () => {
    const category = await makeCategory();
    for (let i = 1; i <= 5; i += 1) {
      await makeRecipe(category.id, { title: `Featured ${i}`, isFeatured: true });
    }

    expect(await getFeaturedRecipes()).toHaveLength(4);
  });
});

describe("recipe search provider", () => {
  it("returns Published matches as suggestions, most viewed first, up to the limit", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "coconut-sambol", title: "Coconut Sambol", viewCount: 5 });
    await makeRecipe(category.id, { slug: "seeni-sambol", title: "Seeni Sambol", viewCount: 50 });
    await makeRecipe(category.id, { slug: "draft-sambol", title: "Draft Sambol", status: "Draft" });

    expect(await searchRecipeSuggestions("sambol", 5)).toEqual([
      { id: expect.any(String), label: "Seeni Sambol", href: "/recipes/seeni-sambol", imageSrc: "/images/products/export/curry-powder.webp", type: "Recipe" },
      { id: expect.any(String), label: "Coconut Sambol", href: "/recipes/coconut-sambol", imageSrc: "/images/products/export/curry-powder.webp", type: "Recipe" },
    ]);
    expect(await searchRecipeSuggestions("sambol", 1)).toHaveLength(1);
    expect(await searchRecipeSuggestions("   ", 5)).toEqual([]);
  });

  it("is what Global Search uses once registerRecipeProviders() runs", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { slug: "dhal-curry", title: "Dhal Curry" });

    expect(await searchRecipes("dhal", 5)).toEqual([]);
    registerRecipeProviders();
    expect((await searchRecipes("dhal", 5)).map((item) => item.href)).toEqual(["/recipes/dhal-curry"]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/unit/recipe-service.test.ts`
Expected: FAIL (module `@/services/recipe.service` not found).

- [ ] **Step 4: Create `src/services/recipe.service.ts`**

```ts
import type { RecipeDifficulty, RecipeStatus } from "@/generated/prisma/client";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import * as recipeRepository from "@/repositories/recipe.repository";
import type { RecipeCardRow } from "@/repositories/recipe.repository";
import { registerRecipeSearchProvider, type SearchSuggestionItem } from "@/services/search-extensions";
import type { RecipeCard, RecipeFacets, RecipeListResult } from "@/types/recipe";
import type { RecipeListingQuery } from "@/validation/recipe-listing.schema";

function recipeHref(slug: string) {
  return `/recipes/${slug}`;
}

function toRecipeCard(row: RecipeCardRow): RecipeCard {
  return {
    id: row.id,
    slug: row.slug,
    href: recipeHref(row.slug),
    title: row.title,
    heroImage: row.heroImage,
    heroImageAlt: row.heroImageAlt,
    categoryName: row.category.name,
    cuisine: row.cuisine,
    difficulty: row.difficulty,
    totalTimeMinutes: row.totalTimeMinutes,
    avgRating: row.avgRating === null ? null : row.avgRating.toNumber(),
    ratingCount: row.ratingCount,
    dietaryTags: row.dietaryTags.map((link) => link.dietaryTag.name),
  };
}

export async function listRecipes(query: RecipeListingQuery): Promise<RecipeListResult> {
  const { page, pageSize, sort, ...filters } = query;
  const { rows, total } = await recipeRepository.findPublishedRecipes({
    where: recipeRepository.buildRecipeWhere(filters),
    orderBy: recipeRepository.buildRecipeOrderBy(sort),
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { recipes: rows.map(toRecipeCard), total, page, pageSize };
}

export async function listRecipeFacets(): Promise<RecipeFacets> {
  const [categories, dietaryTags] = await Promise.all([
    recipeRepository.findActiveCategoriesWithPublishedRecipes(),
    recipeRepository.findActiveDietaryTagsWithPublishedRecipes(),
  ]);
  return { categories, dietaryTags };
}

/** Homepage "Featured Recipes": admins flag recipes with isFeatured. */
export async function getFeaturedRecipes(limit = 4): Promise<RecipeCard[]> {
  const rows = await recipeRepository.findFeaturedRecipes(limit);
  return rows.map(toRecipeCard);
}

export interface NewRecipeInput {
  slug: string;
  title: string;
  shortDescription: string;
  heroImage: string;
  heroImageAlt: string;
  categoryId: string;
  cuisine?: string | null;
  difficulty: RecipeDifficulty;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  status?: RecipeStatus;
  isFeatured?: boolean;
  viewCount?: number;
  avgRating?: number | null;
  ratingCount?: number;
  publishedAt?: Date | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  dietaryTagIds?: string[];
}

/** Used by the seed now and by STORY-043's admin builder later. */
export function createRecipe(input: NewRecipeInput) {
  const { dietaryTagIds = [], ...fields } = input;
  return recipeRepository.createRecipe({
    ...fields,
    totalTimeMinutes: computeTotalTimeMinutes(fields.prepTimeMinutes, fields.cookTimeMinutes),
    dietaryTags: { create: dietaryTagIds.map((dietaryTagId) => ({ dietaryTagId })) },
  });
}

/** Header search suggestions: same title/description match as the listing, most viewed first. */
export async function searchRecipeSuggestions(query: string, limit: number): Promise<SearchSuggestionItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { rows } = await recipeRepository.findPublishedRecipes({
    where: recipeRepository.buildRecipeWhere({ q }),
    orderBy: recipeRepository.buildRecipeOrderBy("popular"),
    skip: 0,
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    href: recipeHref(row.slug),
    imageSrc: row.heroImage,
    type: "Recipe",
  }));
}

/** Called once from src/instrumentation.ts. */
export function registerRecipeProviders(): void {
  registerRecipeSearchProvider(searchRecipeSuggestions);
}
```

- [ ] **Step 5: Register in `src/instrumentation.ts`**

Replace the body of the `if` block with:

```ts
    const [{ registerReviewProviders }, { registerQaProviders }, { registerRecipeProviders }] = await Promise.all([
      import("@/services/review.service"),
      import("@/services/qa.service"),
      import("@/services/recipe.service"),
    ]);
    registerReviewProviders();
    registerQaProviders();
    registerRecipeProviders();
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run tests/unit/recipe-service.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/types/recipe.ts src/services/recipe.service.ts src/instrumentation.ts tests/unit/recipe-service.test.ts
git commit -m "feat: add recipe service and register recipe search suggestions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Recipe API routes

**Files:**
- Create: `src/app/api/recipes/route.ts`, `src/app/api/recipes/categories/route.ts`
- Test: `tests/unit/recipes-route.test.ts`, `tests/unit/recipes-route-errors.test.ts`

**Interfaces:**
- Consumes: `listRecipes`, `listRecipeFacets` (Task 5); `recipeListingQuerySchema` (Task 3); `serverErrorResponse` (Task 2).
- Produces:
  - `GET /api/recipes` returns `RecipeListResult` JSON.
  - `GET /api/recipes/categories` returns `RecipeFacets` JSON.
  - Both return 500 `{ error: "Something went wrong. Please try again." }` on failure.

- [ ] **Step 1: Write the failing tests**

`tests/unit/recipes-route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { GET as getCategories } from "@/app/api/recipes/categories/route";
import { GET as getRecipes } from "@/app/api/recipes/route";
import { cleanupRecipes, makeCategory, makeDietaryTag, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/recipes", () => {
  it("returns Published recipe cards with paging metadata", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Dhal Curry" });
    await makeRecipe(category.id, { title: "Hidden Draft", status: "Draft" });

    const response = await getRecipes(new Request("http://localhost/api/recipes"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recipes.map((recipe: { title: string }) => recipe.title)).toEqual(["Dhal Curry"]);
    expect(body).toMatchObject({ total: 1, page: 1, pageSize: 12 });
  });

  it("applies query filters", async () => {
    const category = await makeCategory();
    const vegan = await makeDietaryTag({ slug: "vegan" });
    await makeRecipe(category.id, { title: "Vegan Dhal", dietaryTagIds: [vegan.id] });
    await makeRecipe(category.id, { title: "Chicken Curry" });

    const response = await getRecipes(new Request("http://localhost/api/recipes?diet=vegan"));
    const body = await response.json();

    expect(body.recipes.map((recipe: { title: string }) => recipe.title)).toEqual(["Vegan Dhal"]);
  });

  it("returns 200 with defaults for a malformed query", async () => {
    const response = await getRecipes(new Request("http://localhost/api/recipes?sort=spiciest&page=-1&difficulty=expert"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("GET /api/recipes/categories", () => {
  it("returns categories and dietary tags that have Published recipes", async () => {
    const category = await makeCategory({ name: "Curries", slug: "curries" });
    const spicy = await makeDietaryTag({ name: "Spicy", slug: "spicy" });
    await makeRecipe(category.id, { dietaryTagIds: [spicy.id] });

    const response = await getCategories();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      categories: [{ name: "Curries", slug: "curries" }],
      dietaryTags: [{ name: "Spicy", slug: "spicy" }],
    });
  });
});
```

`tests/unit/recipes-route-errors.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/recipe.service", () => ({
  listRecipes: vi.fn().mockRejectedValue(new Error("database unavailable")),
  listRecipeFacets: vi.fn().mockRejectedValue(new Error("database unavailable")),
}));

import { GET as getCategories } from "@/app/api/recipes/categories/route";
import { GET as getRecipes } from "@/app/api/recipes/route";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("recipe routes on failure", () => {
  it("GET /api/recipes returns a generic 500 and logs the error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getRecipes(new Request("http://localhost/api/recipes"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Something went wrong. Please try again." });
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes]", expect.any(Error));
  });

  it("GET /api/recipes/categories returns a generic 500 and logs the error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await getCategories();

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith("[GET /api/recipes/categories]", expect.any(Error));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/recipes-route-errors.test.ts`
Expected: FAIL (route modules not found).

- [ ] **Step 3: Create `src/app/api/recipes/route.ts`**

```ts
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listRecipes } from "@/services/recipe.service";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

export async function GET(request: Request) {
  // Every field in the schema has a .catch() fallback, so parsing never throws.
  const query = recipeListingQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listRecipes(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes");
  }
}
```

- [ ] **Step 4: Create `src/app/api/recipes/categories/route.ts`**

```ts
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listRecipeFacets } from "@/services/recipe.service";

/** The category chip row and the dietary filter options, in one call. */
export async function GET() {
  try {
    return NextResponse.json(await listRecipeFacets());
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes/categories");
  }
}
```

- [ ] **Step 5: Run the tests**

Run these one at a time:
- `npx vitest run tests/unit/recipes-route-errors.test.ts`
- `npx vitest run tests/unit/recipes-route.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx next typegen
npx tsc --noEmit
npm run lint
git add src/app/api/recipes tests/unit/recipes-route.test.ts tests/unit/recipes-route-errors.test.ts
git commit -m "feat: add GET /api/recipes and /api/recipes/categories" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Seed recipe taxonomy and 18 recipes

**Files:**
- Create: `prisma/seed-recipes.ts`
- Modify: `prisma/seed.ts` (call `seedRecipes()`, include it in the final log)

**Interfaces:**
- Consumes: `createRecipeCategory`, `createDietaryTag` (Task 4); `createRecipe` (Task 5).
- Produces: `seedRecipes(): Promise<{ recipes: number; published: number }>`. The e2e tests in Task 12 depend on this exact data: titles, categories, difficulties, times, tags, dates and featured flags.

- [ ] **Step 1: Create `prisma/seed-recipes.ts`**

```ts
import type { RecipeDifficulty, RecipeStatus } from "../src/generated/prisma/client";
import * as recipeRepository from "../src/repositories/recipe.repository";
import { createRecipe } from "../src/services/recipe.service";

// Recipe Centre demo content (STORY-017). tests/e2e/recipe-centre.spec.ts
// depends on these exact values. Hero images reuse Oristor product photos
// until real recipe photography is uploaded through the Media Library.

const categories = [
  { slug: "curries", name: "Curries" },
  { slug: "rice-grains", name: "Rice & Grains" },
  { slug: "sweets-desserts", name: "Sweets & Desserts" },
  { slug: "beverages", name: "Beverages" },
  { slug: "snacks", name: "Snacks" },
  { slug: "sambols-condiments", name: "Sambols & Condiments" },
] as const;

const dietaryTags = [
  { slug: "vegetarian", name: "Vegetarian" },
  { slug: "vegan", name: "Vegan" },
  { slug: "gluten-free", name: "Gluten-Free" },
  { slug: "dairy-free", name: "Dairy-Free" },
  { slug: "nut-free", name: "Nut-Free" },
  { slug: "spicy", name: "Spicy" },
] as const;

type CategorySlug = (typeof categories)[number]["slug"];
type DietarySlug = (typeof dietaryTags)[number]["slug"];

interface SeedRecipe {
  slug: string;
  title: string;
  shortDescription: string;
  heroImage: string;
  heroImageAlt: string;
  category: CategorySlug;
  cuisine: string;
  difficulty: RecipeDifficulty;
  prep: number;
  cook: number;
  servings: number;
  tags: DietarySlug[];
  status: RecipeStatus;
  isFeatured: boolean;
  viewCount: number;
  avgRating: number | null;
  ratingCount: number;
  publishedAt: string | null;
}

const recipes: SeedRecipe[] = [
  {
    slug: "chili-paste-deviled-prawns",
    title: "Chili Paste Deviled Prawns",
    shortDescription: "Juicy prawns tossed with onions, capsicum and Oristor chili paste in a sticky, fiery sauce.",
    heroImage: "/images/products/best-sellers/Chili-Paste-Large.png",
    heroImageAlt: "Oristor stemless chili paste, used in this recipe",
    category: "curries",
    cuisine: "Sri Lankan Chinese",
    difficulty: "Medium",
    prep: 10,
    cook: 15,
    servings: 4,
    tags: ["gluten-free", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: true,
    viewCount: 1840,
    avgRating: 4.7,
    ratingCount: 32,
    publishedAt: "2026-09-01",
  },
  {
    slug: "coconut-sambol-maldive-fish",
    title: "Coconut Sambol with Maldive Fish",
    shortDescription: "Freshly grated coconut pounded with chilli, lime, red onion and Maldive fish. Ready in minutes.",
    heroImage: "/images/products/best-sellers/Maldives-Large.webp",
    heroImageAlt: "Oristor Maldive fish flakes, used in this recipe",
    category: "sambols-condiments",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 10,
    cook: 0,
    servings: 4,
    tags: ["gluten-free", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: true,
    viewCount: 2210,
    avgRating: 4.8,
    ratingCount: 41,
    publishedAt: "2026-08-20",
  },
  {
    slug: "spiced-mango-pickle-rice",
    title: "Spiced Mango Pickle Rice",
    shortDescription: "Fragrant basmati rice stirred through with Oristor mango pickle, curry leaves and mustard seeds.",
    heroImage: "/images/products/best-sellers/Mango-Pickle-Large.webp",
    heroImageAlt: "Oristor mango pickle, used in this recipe",
    category: "rice-grains",
    cuisine: "Fusion",
    difficulty: "Medium",
    prep: 10,
    cook: 25,
    servings: 4,
    tags: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: true,
    viewCount: 960,
    avgRating: 4.5,
    ratingCount: 12,
    publishedAt: "2026-09-10",
  },
  {
    slug: "sri-lankan-chicken-curry",
    title: "Sri Lankan Chicken Curry",
    shortDescription: "A rich, dark-roasted chicken curry simmered in coconut milk with Oristor chicken masala.",
    heroImage: "/images/products/export/chicken-masala.png",
    heroImageAlt: "Oristor chicken masala, used in this recipe",
    category: "curries",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 15,
    cook: 45,
    servings: 6,
    tags: ["gluten-free", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: true,
    viewCount: 3120,
    avgRating: 4.9,
    ratingCount: 58,
    publishedAt: "2026-07-15",
  },
  {
    slug: "dhal-curry-parippu",
    title: "Dhal Curry (Parippu)",
    shortDescription: "Creamy red lentils cooked with turmeric and coconut milk, finished with mustard seeds and curry leaves.",
    heroImage: "/images/products/export/turmeric-powder.webp",
    heroImageAlt: "Oristor turmeric powder, used in this recipe",
    category: "curries",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 5,
    cook: 25,
    servings: 4,
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 2650,
    avgRating: 4.6,
    ratingCount: 47,
    publishedAt: "2026-06-30",
  },
  {
    slug: "kiribath-milk-rice",
    title: "Kiribath (Milk Rice)",
    shortDescription: "Traditional coconut milk rice cut into diamonds, served for celebrations with spicy lunu miris.",
    heroImage: "/images/products/export/chili-piece.webp",
    heroImageAlt: "Oristor chili pieces, used in the lunu miris served with this recipe",
    category: "rice-grains",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 5,
    cook: 25,
    servings: 6,
    tags: ["vegetarian", "gluten-free", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 1400,
    avgRating: null,
    ratingCount: 0,
    publishedAt: "2026-04-20",
  },
  {
    slug: "watalappan",
    title: "Watalappan",
    shortDescription: "A silky steamed custard of coconut milk, eggs and kithul jaggery, spiced with cardamom and nutmeg.",
    heroImage: "/images/products/export/Kithul-Jaggery-500g.png",
    heroImageAlt: "Oristor kithul jaggery, used in this recipe",
    category: "sweets-desserts",
    cuisine: "Sri Lankan",
    difficulty: "Hard",
    prep: 20,
    cook: 50,
    servings: 8,
    tags: ["vegetarian", "gluten-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 880,
    avgRating: 4.4,
    ratingCount: 9,
    publishedAt: "2026-05-12",
  },
  {
    slug: "fish-ambul-thiyal",
    title: "Fish Ambul Thiyal",
    shortDescription: "Southern-style sour fish curry, slow-cooked dry with goraka and black pepper until deeply flavoured.",
    heroImage: "/images/products/export/fish-masala.png",
    heroImageAlt: "Oristor fish masala, used in this recipe",
    category: "curries",
    cuisine: "Sri Lankan",
    difficulty: "Hard",
    prep: 20,
    cook: 70,
    servings: 4,
    tags: ["gluten-free", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: false,
    viewCount: 1210,
    avgRating: 4.7,
    ratingCount: 15,
    publishedAt: "2026-08-05",
  },
  {
    slug: "pol-roti-lunu-miris",
    title: "Pol Roti with Lunu Miris",
    shortDescription: "Soft coconut flatbreads cooked on a hot griddle, served with lunu miris, a fiery onion and chilli relish.",
    heroImage: "/images/products/export/chili-powder.webp",
    heroImageAlt: "Oristor chili powder, used in this recipe",
    category: "rice-grains",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 10,
    cook: 5,
    servings: 4,
    tags: ["vegetarian", "vegan", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: false,
    viewCount: 1730,
    avgRating: null,
    ratingCount: 0,
    publishedAt: "2026-09-15",
  },
  {
    slug: "chicken-kottu-roti",
    title: "Chicken Kottu Roti",
    shortDescription: "Chopped godamba roti stir-fried on a hot plate with chicken, egg, vegetables and curry spices.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Oristor curry powder, used in this recipe",
    category: "rice-grains",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 15,
    cook: 20,
    servings: 2,
    tags: ["dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: false,
    viewCount: 2980,
    avgRating: 4.6,
    ratingCount: 36,
    publishedAt: "2026-09-18",
  },
  {
    slug: "sri-lankan-ginger-tea",
    title: "Sri Lankan Ginger Tea",
    shortDescription: "Strong Ceylon tea brewed with fresh ginger and a pinch of black pepper, sweetened with jaggery.",
    heroImage: "/images/products/export/pepper.webp",
    heroImageAlt: "Oristor black pepper, used in this recipe",
    category: "beverages",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 2,
    cook: 8,
    servings: 2,
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 640,
    avgRating: 4.2,
    ratingCount: 5,
    publishedAt: "2026-04-02",
  },
  {
    slug: "wood-apple-juice",
    title: "Wood Apple Juice",
    shortDescription: "A cooling drink of ripe wood apple pulp blended with coconut milk and kithul treacle.",
    heroImage: "/images/products/export/KithulBottle2.png",
    heroImageAlt: "Oristor kithul treacle, used in this recipe",
    category: "beverages",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 10,
    cook: 0,
    servings: 2,
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 410,
    avgRating: null,
    ratingCount: 0,
    publishedAt: "2026-03-18",
  },
  {
    slug: "vegetable-samosas",
    title: "Vegetable Samosas",
    shortDescription: "Crisp pastry parcels filled with spiced potato, carrot and leeks, fried until golden.",
    heroImage: "/images/products/misc/Masala.webp",
    heroImageAlt: "Oristor masala blend, used in this recipe",
    category: "snacks",
    cuisine: "Sri Lankan",
    difficulty: "Hard",
    prep: 30,
    cook: 20,
    servings: 6,
    tags: ["vegetarian", "vegan", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 1520,
    avgRating: 4.3,
    ratingCount: 21,
    publishedAt: "2026-07-01",
  },
  {
    slug: "seeni-sambol",
    title: "Seeni Sambol",
    shortDescription: "Onions slow-cooked until jammy with chilli, tamarind and a touch of sugar. Sweet, sour and hot.",
    heroImage: "/images/products/domestic/Chili-Paste-Small.webp",
    heroImageAlt: "Oristor chili paste, used in this recipe",
    category: "sambols-condiments",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 10,
    cook: 35,
    servings: 6,
    tags: ["gluten-free", "dairy-free", "nut-free", "spicy"],
    status: "Published",
    isFeatured: false,
    viewCount: 1980,
    avgRating: 4.8,
    ratingCount: 29,
    publishedAt: "2026-06-10",
  },
  {
    slug: "brinjal-moju",
    title: "Brinjal Moju",
    shortDescription: "Fried aubergine pickled with mustard, vinegar, shallots and green chillies. Keeps for days.",
    heroImage: "/images/products/misc/Mango-Pickle-Large.webp",
    heroImageAlt: "Oristor mango pickle, served with this recipe",
    category: "sambols-condiments",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 15,
    cook: 25,
    servings: 6,
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    status: "Published",
    isFeatured: false,
    viewCount: 1130,
    avgRating: 4.5,
    ratingCount: 14,
    publishedAt: "2026-05-25",
  },
  {
    slug: "isso-vadai",
    title: "Isso Vadai (Prawn Fritters)",
    shortDescription: "Crunchy lentil fritters topped with whole prawns, a Galle Face street-food favourite.",
    heroImage: "/images/products/best-sellers/Koonisso-Large.webp",
    heroImageAlt: "Oristor koonisso (dried shrimp), used in this recipe",
    category: "snacks",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 20,
    cook: 15,
    servings: 4,
    tags: ["gluten-free", "dairy-free", "spicy"],
    status: "Published",
    isFeatured: false,
    viewCount: 1760,
    avgRating: 4.6,
    ratingCount: 19,
    publishedAt: "2026-08-28",
  },
  // Not Published: must never appear on the storefront. The Draft is flagged
  // featured on purpose (the homepage must still skip it).
  {
    slug: "pumpkin-curry",
    title: "Pumpkin Curry",
    shortDescription: "Sweet pumpkin simmered in coconut milk with roasted curry powder and mustard seeds.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Oristor curry powder, used in this recipe",
    category: "curries",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    prep: 10,
    cook: 20,
    servings: 4,
    tags: ["vegetarian", "vegan", "gluten-free", "dairy-free", "nut-free"],
    status: "Draft",
    isFeatured: true,
    viewCount: 0,
    avgRating: null,
    ratingCount: 0,
    publishedAt: null,
  },
  {
    slug: "milk-toffee",
    title: "Milk Toffee",
    shortDescription: "Condensed milk and sugar cooked to a fudge-like set, flavoured with cardamom and cashew.",
    heroImage: "/images/products/export/Kithul-Jaggery-500g.png",
    heroImageAlt: "Oristor kithul jaggery, used in this recipe",
    category: "sweets-desserts",
    cuisine: "Sri Lankan",
    difficulty: "Medium",
    prep: 5,
    cook: 40,
    servings: 12,
    tags: ["vegetarian", "gluten-free"],
    status: "Archived",
    isFeatured: false,
    viewCount: 900,
    avgRating: 4.1,
    ratingCount: 7,
    publishedAt: "2025-12-01",
  },
];

export async function seedRecipes(): Promise<{ recipes: number; published: number }> {
  const categoryIds = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const created = await recipeRepository.createRecipeCategory({ ...category, sortOrder: index + 1 });
    categoryIds.set(category.slug, created.id);
  }

  const tagIds = new Map<string, string>();
  for (const [index, tag] of dietaryTags.entries()) {
    const created = await recipeRepository.createDietaryTag({ ...tag, sortOrder: index + 1 });
    tagIds.set(tag.slug, created.id);
  }

  for (const recipe of recipes) {
    await createRecipe({
      slug: recipe.slug,
      title: recipe.title,
      shortDescription: recipe.shortDescription,
      heroImage: recipe.heroImage,
      heroImageAlt: recipe.heroImageAlt,
      categoryId: categoryIds.get(recipe.category)!,
      cuisine: recipe.cuisine,
      difficulty: recipe.difficulty,
      prepTimeMinutes: recipe.prep,
      cookTimeMinutes: recipe.cook,
      servings: recipe.servings,
      status: recipe.status,
      isFeatured: recipe.isFeatured,
      viewCount: recipe.viewCount,
      avgRating: recipe.avgRating,
      ratingCount: recipe.ratingCount,
      publishedAt: recipe.publishedAt ? new Date(`${recipe.publishedAt}T09:00:00Z`) : null,
      dietaryTagIds: recipe.tags.map((slug) => tagIds.get(slug)!),
    });
  }

  return { recipes: recipes.length, published: recipes.filter((recipe) => recipe.status === "Published").length };
}
```

If lint rejects the non-null assertions (`!`), replace each with a small `requireId(map, slug)` helper in this file that throws `new Error(\`Unknown seed slug: ${slug}\`)`.

- [ ] **Step 2: Call it from `prisma/seed.ts`**

Add `import { seedRecipes } from "./seed-recipes";` after the existing imports. Directly before the final `console.log("Seed complete:", …)`, add:

```ts
  // Recipe Centre (STORY-017).
  const recipeSeed = await seedRecipes();
```

Then add `recipes: recipeSeed,` as the last property of the object logged by `console.log("Seed complete:", { … })`.

- [ ] **Step 3: Run the seed against a clean database**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx prisma db seed
```

Expected: the output ends with `Seed complete:` and includes `recipes: { recipes: 18, published: 16 }`, and the command exits with code 0. If it fails with a connection error, report it (PGlite); don't change code.

- [ ] **Step 4: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add prisma/seed-recipes.ts prisma/seed.ts
git commit -m "feat: seed recipe categories, dietary tags and 18 demo recipes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Shared listing components (refactor, no product behaviour change)

**Files:**
- Create: `src/components/storefront/listing/checkbox-option.tsx`, `pagination.tsx`, `filter-drawer.tsx`, `filter-sidebar.tsx`, `sort-select.tsx`
- Create: `src/components/storefront/product/product-sort-select.tsx`
- Delete: `src/components/storefront/product/pagination.tsx`, `filter-drawer.tsx`, `filter-sidebar.tsx`, `sort-select.tsx`
- Modify: `src/components/storefront/product/filter-controls.tsx` (import `CheckboxOption`), `src/components/storefront/product/product-grid.tsx`
- Tests:
  - `git mv tests/unit/pagination.test.tsx tests/unit/listing-pagination.test.tsx` and update its import;
  - `git mv tests/unit/sort-select.test.tsx tests/unit/product-sort-select.test.tsx` and update it;
  - create `tests/unit/listing-sort-select.test.tsx`, `tests/unit/listing-filter-panels.test.tsx`, `tests/unit/checkbox-option.test.tsx`.

**Interfaces:**
- Produces:
  - `CheckboxOption({ label, checked, onCheckedChange })`
  - `Pagination({ page, pageSize, total, onPageChange })` (unchanged)
  - `FilterDrawer({ children, title? })` (title defaults to `"Filters"`)
  - `FilterSidebar({ label, children })`
  - `SortSelect<T extends string>({ value, options, onValueChange, ariaLabel })` and `interface SortOption<T> { value: T; label: string; disabled?: boolean }`
  - `ProductSortSelect({ value, onValueChange, showRelevance? })`

- [ ] **Step 1: Move `CheckboxOption`**

Create `src/components/storefront/listing/checkbox-option.tsx` with the `CheckboxOptionProps` interface and the `CheckboxOption` function cut from `product/filter-controls.tsx`, including its doc comment. Add `"use client";` and the `useId` and `Checkbox` imports at the top, and `export` the function. In `product/filter-controls.tsx`, delete them and add `import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";`. Remove the now-unused `useId` and `Checkbox` imports there.

- [ ] **Step 2: Move `Pagination` unchanged**

Run `git mv src/components/storefront/product/pagination.tsx src/components/storefront/listing/pagination.tsx`.

- [ ] **Step 3: Replace the drawer and sidebar with children-based versions**

Run `git rm src/components/storefront/product/filter-drawer.tsx src/components/storefront/product/filter-sidebar.tsx`, then create:

`src/components/storefront/listing/filter-drawer.tsx`:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface FilterDrawerProps {
  children: ReactNode;
  title?: string;
}

/** Mobile (below lg) filter sheet. Pairs with FilterSidebar, which shows the same controls on desktop. */
export function FilterDrawer({ children, title = "Filters" }: FilterDrawerProps) {
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
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{children}</div>
          <Button type="button" className="mx-4 mb-4" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

`src/components/storefront/listing/filter-sidebar.tsx`:

```tsx
import type { ReactNode } from "react";

interface FilterSidebarProps {
  /** Accessible name for the landmark, e.g. "Filter products". */
  label: string;
  children: ReactNode;
}

/** Desktop (lg and up) filter column. Pairs with FilterDrawer on mobile. */
export function FilterSidebar({ label, children }: FilterSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label={label}>
      {children}
    </aside>
  );
}
```

- [ ] **Step 4: Generic `SortSelect` plus the product wrapper**

Run `git rm src/components/storefront/product/sort-select.tsx`, then create:

`src/components/storefront/listing/sort-select.tsx`:

```tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SortOption<T extends string> {
  value: T;
  label: string;
  /** Shown as "<label> (coming soon)" and not selectable. */
  disabled?: boolean;
}

interface SortSelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<SortOption<T>>;
  onValueChange: (value: T) => void;
  ariaLabel: string;
}

export function SortSelect<T extends string>({ value, options, onValueChange, ariaLabel }: SortSelectProps<T>) {
  const labelFor = (selected: T) => options.find((option) => option.value === selected)?.label ?? selected;

  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder="Sort by">
          {(selected: T | null) => (selected ? labelFor(selected) : "Sort by")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.disabled ? `${option.label} (coming soon)` : option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

`src/components/storefront/product/product-sort-select.tsx`:

```tsx
"use client";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";
import type { ProductSort } from "@/services/product.service";

const sortLabels: Record<ProductSort, string> = {
  relevance: "Relevance",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest",
  "best-selling": "Best Selling",
  rating: "Average Rating",
};

// No sales data yet (Commerce Platform epic) for "best-selling". "rating"
// could now read ProductRatingSummary (STORY-015), but the listing query
// doesn't support it yet — both stay disabled until they're built.
const disabledSorts: ProductSort[] = ["best-selling", "rating"];

// "Relevance" only means something with a search query behind it (STORY-012)
// — every other listing page (category/collection browsing) defaults to
// "newest" and would show a confusing, non-functional option otherwise.
const baseSorts = (Object.keys(sortLabels) as ProductSort[]).filter((sort) => sort !== "relevance");

interface ProductSortSelectProps {
  value: ProductSort;
  onValueChange: (value: ProductSort) => void;
  showRelevance?: boolean;
}

export function ProductSortSelect({ value, onValueChange, showRelevance = false }: ProductSortSelectProps) {
  const sorts: ProductSort[] = showRelevance ? ["relevance", ...baseSorts] : baseSorts;
  const options: SortOption<ProductSort>[] = sorts.map((sort) => ({
    value: sort,
    label: sortLabels[sort],
    disabled: disabledSorts.includes(sort),
  }));

  return <SortSelect value={value} options={options} onValueChange={onValueChange} ariaLabel="Sort products" />;
}
```

- [ ] **Step 5: Update `product-grid.tsx`**

Replace the four sibling imports (`./filter-sidebar`, `./filter-drawer`, `./sort-select`, `./pagination`) with:

```tsx
import { FilterDrawer } from "@/components/storefront/listing/filter-drawer";
import { FilterSidebar } from "@/components/storefront/listing/filter-sidebar";
import { Pagination } from "@/components/storefront/listing/pagination";
import { FilterControls, type FilterOptionGroup, type FilterValues } from "./filter-controls";
import { ProductSortSelect } from "./product-sort-select";
```

Remove the old `import type { FilterOptionGroup, FilterValues } from "./filter-controls";` line. Then change the JSX:
- `<FilterSidebar {...filterProps} />` becomes `<FilterSidebar label="Filter products"><FilterControls {...filterProps} /></FilterSidebar>`
- `<FilterDrawer {...filterProps} />` becomes `<FilterDrawer><FilterControls {...filterProps} /></FilterDrawer>`
- `<SortSelect … />` becomes `<ProductSortSelect … />`, with the same props.

- [ ] **Step 6: Update the moved tests and add new ones**

```bash
git mv tests/unit/pagination.test.tsx tests/unit/listing-pagination.test.tsx
git mv tests/unit/sort-select.test.tsx tests/unit/product-sort-select.test.tsx
```

In `listing-pagination.test.tsx`, change the import to `@/components/storefront/listing/pagination`. In `product-sort-select.test.tsx`, change the import to `import { ProductSortSelect } from "@/components/storefront/product/product-sort-select";`, rename every `SortSelect` to `ProductSortSelect`, and rename `describe("SortSelect"` to `describe("ProductSortSelect"`. Then add this test to that describe block:

```tsx
  it("labels the trigger for screen readers", () => {
    render(<ProductSortSelect value="newest" onValueChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Sort products" })).toBeInTheDocument();
  });
```

Create `tests/unit/listing-sort-select.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";

type Sort = "a" | "b" | "c";
const options: SortOption<Sort>[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma", disabled: true },
];

describe("SortSelect (shared)", () => {
  it("shows the selected option's label and the given aria-label", () => {
    render(<SortSelect value="b" options={options} onValueChange={vi.fn()} ariaLabel="Sort things" />);
    expect(screen.getByRole("combobox", { name: "Sort things" })).toHaveTextContent("Beta");
  });

  it("calls onValueChange with the chosen value", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SortSelect value="a" options={options} onValueChange={onValueChange} ariaLabel="Sort things" />);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Beta" }));

    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("marks disabled options as coming soon", async () => {
    const user = userEvent.setup();
    render(<SortSelect value="a" options={options} onValueChange={vi.fn()} ariaLabel="Sort things" />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Gamma (coming soon)" })).toHaveAttribute("aria-disabled", "true");
  });
});
```

Create `tests/unit/listing-filter-panels.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FilterDrawer } from "@/components/storefront/listing/filter-drawer";
import { FilterSidebar } from "@/components/storefront/listing/filter-sidebar";

describe("FilterSidebar", () => {
  it("renders its children in a labelled complementary landmark", () => {
    render(
      <FilterSidebar label="Filter recipes">
        <p>controls</p>
      </FilterSidebar>,
    );

    expect(screen.getByRole("complementary", { name: "Filter recipes" })).toHaveTextContent("controls");
  });
});

describe("FilterDrawer", () => {
  it("shows its children in a dialog once opened", async () => {
    const user = userEvent.setup();
    render(
      <FilterDrawer>
        <p>drawer controls</p>
      </FilterDrawer>,
    );

    expect(screen.queryByText("drawer controls")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Filters" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("drawer controls");
    expect(dialog).toHaveTextContent("Filters");
  });
});
```

Create `tests/unit/checkbox-option.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";

describe("CheckboxOption", () => {
  it("names the checkbox by its visible label and toggles when the label is clicked", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<CheckboxOption label="Vegan" checked={false} onCheckedChange={onCheckedChange} />);

    expect(screen.getByRole("checkbox", { name: "Vegan" })).not.toBeChecked();
    await user.click(screen.getByText("Vegan"));

    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
```

If Base UI's `onCheckedChange` is called with a single argument in this version, change the assertion to `toHaveBeenCalledWith(true)`. Check what `filter-controls.test.tsx` already does for the in-stock checkbox.

- [ ] **Step 7: Run the affected tests**

Run: `npx vitest run tests/unit/listing-pagination.test.tsx tests/unit/product-sort-select.test.tsx tests/unit/listing-sort-select.test.tsx tests/unit/listing-filter-panels.test.tsx tests/unit/checkbox-option.test.tsx tests/unit/filter-controls.test.tsx tests/unit/product-grid.test.tsx`
Expected: all PASS.

Then run `grep -rn "product/pagination\|product/sort-select\|product/filter-drawer\|product/filter-sidebar" src tests`. Expected: no output.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add -A src/components/storefront/listing src/components/storefront/product tests/unit/listing-pagination.test.tsx tests/unit/product-sort-select.test.tsx tests/unit/listing-sort-select.test.tsx tests/unit/listing-filter-panels.test.tsx tests/unit/checkbox-option.test.tsx tests/unit/pagination.test.tsx tests/unit/sort-select.test.tsx
git commit -m "refactor: move generic listing controls to components/storefront/listing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Recipe presentational components

**Files:**
- Create in `src/components/storefront/recipes/`: `recipe-card.tsx`, `recipe-grid.tsx`, `recipe-category-chips.tsx`, `recipe-filter-controls.tsx`, `recipe-search-box.tsx`, `recipe-empty-state.tsx`, `recipe-sort-select.tsx`
- Test: `tests/unit/recipe-card.test.tsx`, `tests/unit/recipe-controls.test.tsx`

**Interfaces:**
- Consumes: `RecipeCard`, `RecipeFacetOption` (Task 5 types); `CheckboxOption`, `SortSelect` (Task 8); `toggleValue` (Task 2); value tuples and labels plus `formatRecipeTime` (Task 3).
- Produces:
  - `RecipeCard({ recipe, headingLevel? })`: `headingLevel` is `"h2" | "h3"`, default `"h3"`.
  - `RecipeGrid({ recipes })`
  - `RecipeCategoryChips({ categories, selected, hrefFor, onSelect })`, where `selected: string | null`, `hrefFor: (slug: string | null) => string`, `onSelect: (slug: string | null) => void`.
  - `interface RecipeFilterValues { difficulty: RecipeDifficultyParam[]; time: RecipeTimeRange[]; diet: string[] }`
  - `RecipeFilterControls({ values, onChange, dietaryTagOptions, onClear })`
  - `RecipeSearchBox({ value, onChange })`
  - `RecipeEmptyState({ message, actionLabel, onAction })`
  - `RecipeSortSelect({ value, onValueChange })`

- [ ] **Step 1: Write the failing tests**

`tests/unit/recipe-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import { RecipeGrid } from "@/components/storefront/recipes/recipe-grid";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

const recipe: RecipeCardData = {
  id: "r1",
  slug: "sri-lankan-chicken-curry",
  href: "/recipes/sri-lankan-chicken-curry",
  title: "Sri Lankan Chicken Curry",
  heroImage: "/images/products/export/chicken-masala.png",
  heroImageAlt: "Oristor chicken masala, used in this recipe",
  categoryName: "Curries",
  cuisine: "Sri Lankan",
  difficulty: "Medium",
  totalTimeMinutes: 90,
  avgRating: 4.9,
  ratingCount: 58,
  dietaryTags: ["Gluten-Free", "Spicy"],
};

describe("RecipeCard", () => {
  it("links the title to the recipe detail page", () => {
    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByRole("link", { name: "Sri Lankan Chicken Curry" })).toHaveAttribute(
      "href",
      "/recipes/sri-lankan-chicken-curry",
    );
    expect(screen.getByRole("heading", { level: 3, name: "Sri Lankan Chicken Curry" })).toBeInTheDocument();
  });

  it("shows the hero image with its alt text, category, cuisine, time and difficulty", () => {
    render(<RecipeCard recipe={recipe} />);

    expect(screen.getByAltText("Oristor chicken masala, used in this recipe")).toBeInTheDocument();
    expect(screen.getByText("Curries")).toBeInTheDocument();
    expect(screen.getByText("Sri Lankan")).toBeInTheDocument();
    expect(screen.getByText("1 hr 30 min")).toBeInTheDocument();
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("shows an accessible rating when the recipe has ratings", () => {
    render(<RecipeCard recipe={recipe} />);
    expect(screen.getByRole("img", { name: "Rated 4.9 out of 5 from 58 ratings" })).toBeInTheDocument();
  });

  it("hides the rating when there are no ratings yet", () => {
    render(<RecipeCard recipe={{ ...recipe, avgRating: null, ratingCount: 0 }} />);
    expect(screen.queryByRole("img", { name: /Rated/ })).not.toBeInTheDocument();
  });

  it("uses singular wording for one rating and supports an h2 heading", () => {
    render(<RecipeCard recipe={{ ...recipe, avgRating: 5, ratingCount: 1 }} headingLevel="h2" />);

    expect(screen.getByRole("img", { name: "Rated 5.0 out of 5 from 1 rating" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("RecipeGrid", () => {
  it("renders one list item per recipe", () => {
    render(<RecipeGrid recipes={[recipe, { ...recipe, id: "r2", title: "Dhal Curry" }]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
```

`tests/unit/recipe-controls.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RecipeCategoryChips } from "@/components/storefront/recipes/recipe-category-chips";
import { RecipeEmptyState } from "@/components/storefront/recipes/recipe-empty-state";
import { RecipeFilterControls, type RecipeFilterValues } from "@/components/storefront/recipes/recipe-filter-controls";
import { RecipeSearchBox } from "@/components/storefront/recipes/recipe-search-box";
import { RecipeSortSelect } from "@/components/storefront/recipes/recipe-sort-select";

const categories = [
  { name: "Curries", slug: "curries" },
  { name: "Snacks", slug: "snacks" },
];
const hrefFor = (slug: string | null) => (slug ? `/recipes?category=${slug}` : "/recipes");
const noFilters: RecipeFilterValues = { difficulty: [], time: [], diet: [] };

describe("RecipeCategoryChips", () => {
  it("renders All plus one link per category, marking the selected one", () => {
    render(<RecipeCategoryChips categories={categories} selected="curries" hrefFor={hrefFor} onSelect={vi.fn()} />);

    const nav = screen.getByRole("navigation", { name: "Recipe categories" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("href", "/recipes");
    expect(screen.getByRole("link", { name: "Curries" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Snacks" })).not.toHaveAttribute("aria-current");
  });

  it("marks All as current when no category is selected", () => {
    render(<RecipeCategoryChips categories={categories} selected={null} hrefFor={hrefFor} onSelect={vi.fn()} />);
    expect(screen.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  });

  it("selects in place on a plain click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RecipeCategoryChips categories={categories} selected={null} hrefFor={hrefFor} onSelect={onSelect} />);

    await user.click(screen.getByRole("link", { name: "Snacks" }));
    await user.click(screen.getByRole("link", { name: "All" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "snacks");
    expect(onSelect).toHaveBeenNthCalledWith(2, null);
  });
});

describe("RecipeFilterControls", () => {
  it("renders the three fieldsets with their options", () => {
    render(
      <RecipeFilterControls values={noFilters} onChange={vi.fn()} onClear={vi.fn()} dietaryTagOptions={[{ name: "Vegan", slug: "vegan" }]} />,
    );

    expect(screen.getByRole("group", { name: "Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Dietary" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "15–30 min" })).toBeInTheDocument();
  });

  it("toggles difficulty, time and diet values", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RecipeFilterControls
        values={{ difficulty: ["easy"], time: [], diet: [] }}
        onChange={onChange}
        onClear={vi.fn()}
        dietaryTagOptions={[{ name: "Vegan", slug: "vegan" }]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));
    await user.click(screen.getByRole("checkbox", { name: "Under 15 min" }));
    await user.click(screen.getByRole("checkbox", { name: "Vegan" }));

    expect(onChange).toHaveBeenNthCalledWith(1, { difficulty: [], time: [], diet: [] });
    expect(onChange).toHaveBeenNthCalledWith(2, { difficulty: ["easy"], time: ["under-15"], diet: [] });
    expect(onChange).toHaveBeenNthCalledWith(3, { difficulty: ["easy"], time: [], diet: ["vegan"] });
  });

  it("omits the Dietary fieldset when there are no tags, and clears on request", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<RecipeFilterControls values={noFilters} onChange={vi.fn()} onClear={onClear} dietaryTagOptions={[]} />);

    expect(screen.queryByRole("group", { name: "Dietary" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe("RecipeSearchBox", () => {
  it("reports each change and clears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<RecipeSearchBox value="" onChange={onChange} />);

    await user.type(screen.getByRole("searchbox", { name: "Search recipes" }), "d");
    expect(onChange).toHaveBeenLastCalledWith("d");
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    rerender(<RecipeSearchBox value="dhal" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });
});

describe("RecipeEmptyState", () => {
  it("shows the message and runs the action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<RecipeEmptyState message="No recipes match those filters." actionLabel="Clear all filters" onAction={onAction} />);

    expect(screen.getByText("No recipes match those filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});

describe("RecipeSortSelect", () => {
  it("offers the four recipe sorts", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RecipeSortSelect value="newest" onValueChange={onValueChange} />);

    await user.click(screen.getByRole("combobox", { name: "Sort recipes" }));
    for (const label of ["Newest", "Most Popular", "Highest Rated", "Cook Time (shortest first)"]) {
      expect(await screen.findByRole("option", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("option", { name: "Cook Time (shortest first)" }));
    expect(onValueChange).toHaveBeenCalledWith("time");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/recipe-card.test.tsx tests/unit/recipe-controls.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `recipe-card.tsx`**

```tsx
import Image from "next/image";
import Link from "next/link";
import { Clock, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatRecipeTime } from "@/lib/recipe-time";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

interface RecipeCardProps {
  recipe: RecipeCardData;
  /** h3 under a section h2 (the default); h2 where the card sits directly under the page h1. */
  headingLevel?: "h2" | "h3";
}

/**
 * Shared by the Recipe Centre grid and the homepage. No client hooks, so it
 * renders as a Server Component on the homepage and inside the client
 * listing on /recipes. The title link stretches over the whole card.
 */
export function RecipeCard({ recipe, headingLevel: Heading = "h3" }: RecipeCardProps) {
  const hasRating = recipe.avgRating !== null && recipe.ratingCount > 0;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        <Image
          src={recipe.heroImage}
          alt={recipe.heroImageAlt}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">
        <span>{recipe.categoryName}</span>
        {recipe.cuisine && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="text-charcoal/70">{recipe.cuisine}</span>
          </>
        )}
      </p>
      <Heading className="mt-1 text-h4 font-heading text-charcoal">
        <Link
          href={recipe.href}
          className="after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {recipe.title}
        </Link>
      </Heading>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-small text-charcoal/80">
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Total time: </span>
          <span>{formatRecipeTime(recipe.totalTimeMinutes)}</span>
        </span>
        <Badge variant="outline">
          <span className="sr-only">Difficulty: </span>
          <span>{recipe.difficulty}</span>
        </Badge>
        {hasRating && recipe.avgRating !== null && (
          <span
            role="img"
            aria-label={`Rated ${recipe.avgRating.toFixed(1)} out of 5 from ${recipe.ratingCount} ${recipe.ratingCount === 1 ? "rating" : "ratings"}`}
            className="flex items-center gap-1"
          >
            <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
            <span aria-hidden="true">
              {recipe.avgRating.toFixed(1)} ({recipe.ratingCount})
            </span>
          </span>
        )}
      </div>
    </article>
  );
}
```

Note: the category name, time text and difficulty each sit in their own `<span>` on purpose. Testing Library's `getByText` matches an element's whole text, so an element holding both `Difficulty: ` (sr-only) and `Medium` would never match `"Medium"`.

- [ ] **Step 4: Create `recipe-grid.tsx`**

```tsx
import type { RecipeCard as RecipeCardData } from "@/types/recipe";
import { RecipeCard } from "./recipe-card";

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <RecipeCard recipe={recipe} />
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: Create `recipe-category-chips.tsx`**

```tsx
"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";
import type { RecipeFacetOption } from "@/types/recipe";

interface RecipeCategoryChipsProps {
  categories: RecipeFacetOption[];
  selected: string | null;
  hrefFor: (slug: string | null) => string;
  onSelect: (slug: string | null) => void;
}

/**
 * Real links (crawlable, open-in-new-tab works), but a plain click updates
 * the URL state in place instead of a full navigation.
 */
export function RecipeCategoryChips({ categories, selected, hrefFor, onSelect }: RecipeCategoryChipsProps) {
  const chips: Array<{ slug: string | null; name: string }> = [{ slug: null, name: "All" }, ...categories];

  function handleClick(event: MouseEvent<HTMLAnchorElement>, slug: string | null) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onSelect(slug);
  }

  return (
    <nav aria-label="Recipe categories">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        {chips.map((chip) => {
          const isSelected = chip.slug === selected;
          return (
            <li key={chip.slug ?? "all"} className="shrink-0">
              <Link
                href={hrefFor(chip.slug)}
                onClick={(event) => handleClick(event, chip.slug)}
                aria-current={isSelected ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center rounded-full border px-4 text-small transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-charcoal hover:bg-muted",
                )}
              >
                {chip.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 6: Create `recipe-filter-controls.tsx`**

```tsx
"use client";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Button } from "@/components/ui/button";
import {
  recipeDifficultyLabels,
  recipeDifficultyValues,
  recipeTimeLabels,
  recipeTimeValues,
  type RecipeDifficultyParam,
  type RecipeTimeRange,
} from "@/lib/recipe-listing-values";
import { toggleValue } from "@/lib/toggle-value";
import type { RecipeFacetOption } from "@/types/recipe";

export interface RecipeFilterValues {
  difficulty: RecipeDifficultyParam[];
  time: RecipeTimeRange[];
  /** Dietary tag slugs. */
  diet: string[];
}

interface RecipeFilterControlsProps {
  values: RecipeFilterValues;
  onChange: (values: RecipeFilterValues) => void;
  dietaryTagOptions: RecipeFacetOption[];
  /** Clears every filter, the category and the search. */
  onClear: () => void;
}

export function RecipeFilterControls({ values, onChange, dietaryTagOptions, onClear }: RecipeFilterControlsProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-medium text-charcoal">Difficulty</legend>
        {recipeDifficultyValues.map((difficulty) => (
          <CheckboxOption
            key={difficulty}
            label={recipeDifficultyLabels[difficulty]}
            checked={values.difficulty.includes(difficulty)}
            onCheckedChange={() => onChange({ ...values, difficulty: toggleValue(values.difficulty, difficulty) })}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-medium text-charcoal">Time</legend>
        {recipeTimeValues.map((range) => (
          <CheckboxOption
            key={range}
            label={recipeTimeLabels[range]}
            checked={values.time.includes(range)}
            onCheckedChange={() => onChange({ ...values, time: toggleValue(values.time, range) })}
          />
        ))}
      </fieldset>

      {dietaryTagOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-small font-medium text-charcoal">Dietary</legend>
          {dietaryTagOptions.map((tag) => (
            <CheckboxOption
              key={tag.slug}
              label={tag.name}
              checked={values.diet.includes(tag.slug)}
              onCheckedChange={() => onChange({ ...values, diet: toggleValue(values.diet, tag.slug) })}
            />
          ))}
        </fieldset>
      )}

      <Button type="button" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
```

- [ ] **Step 7: Create `recipe-search-box.tsx`**

```tsx
"use client";

import { useId } from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

interface RecipeSearchBoxProps {
  value: string;
  /** Called on every keystroke; the listing debounces the fetch, not the input. */
  onChange: (value: string) => void;
}

export function RecipeSearchBox({ value, onChange }: RecipeSearchBoxProps) {
  const inputId = useId();

  return (
    <div role="search" className="relative w-full max-w-md">
      <label htmlFor={inputId} className="sr-only">
        Search recipes
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-charcoal/60"
        aria-hidden="true"
      />
      <Input
        id={inputId}
        type="search"
        value={value}
        maxLength={100}
        placeholder="Search recipes"
        onChange={(event) => onChange(event.target.value)}
        className="h-11 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-charcoal/70 hover:bg-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create `recipe-empty-state.tsx` and `recipe-sort-select.tsx`**

`recipe-empty-state.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

interface RecipeEmptyStateProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function RecipeEmptyState({ message, actionLabel, onAction }: RecipeEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-input py-16 text-center">
      <p className="text-body text-charcoal">{message}</p>
      <Button type="button" variant="outline" onClick={onAction}>
        {actionLabel}
      </Button>
    </div>
  );
}
```

`recipe-sort-select.tsx`:

```tsx
"use client";

import { SortSelect, type SortOption } from "@/components/storefront/listing/sort-select";
import { recipeSortLabels, recipeSortValues, type RecipeSort } from "@/lib/recipe-listing-values";

const options: SortOption<RecipeSort>[] = recipeSortValues.map((sort) => ({ value: sort, label: recipeSortLabels[sort] }));

interface RecipeSortSelectProps {
  value: RecipeSort;
  onValueChange: (value: RecipeSort) => void;
}

export function RecipeSortSelect({ value, onValueChange }: RecipeSortSelectProps) {
  return <SortSelect value={value} options={options} onValueChange={onValueChange} ariaLabel="Sort recipes" />;
}
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run tests/unit/recipe-card.test.tsx tests/unit/recipe-controls.test.tsx`
Expected: PASS.

- [ ] **Step 10: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/components/storefront/recipes tests/unit/recipe-card.test.tsx tests/unit/recipe-controls.test.tsx
git commit -m "feat: add recipe card, category chips, filter controls, search and sort components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Recipe Centre page and client listing

**Files:**
- Create: `src/hooks/use-recipe-listing.ts`, `src/components/storefront/recipes/recipe-listing.tsx`
- Create: `src/app/(storefront)/recipes/page.tsx`, `loading.tsx`, `error.tsx`
- Test: `tests/unit/use-recipe-listing.test.ts`, `tests/unit/recipe-listing.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3, 5, 8 and 9.
- Produces:
  - `buildRecipeApiSearch(params: RecipeListingParams, pageSize: number): string`
  - `useRecipeListing(params, initialData): { result: RecipeListResult; isError: boolean; isFetching: boolean; retry: () => void }`
  - `RecipeListing({ initialData, facets })`
  - the `/recipes` route

- [ ] **Step 1: Write the failing tests**

`tests/unit/use-recipe-listing.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { RecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { buildRecipeApiSearch } from "@/hooks/use-recipe-listing";

const base: RecipeListingParams = {
  category: null,
  difficulty: null,
  time: null,
  diet: null,
  q: null,
  sort: "newest",
  page: 1,
};

describe("buildRecipeApiSearch", () => {
  it("always sends sort, page and pageSize", () => {
    expect(buildRecipeApiSearch(base, 12)).toBe("sort=newest&page=1&pageSize=12");
  });

  it("sends set filters as comma lists and trims q", () => {
    const search = new URLSearchParams(
      buildRecipeApiSearch(
        { ...base, category: "curries", difficulty: ["easy", "hard"], time: ["15-30"], diet: ["vegan"], q: "  dhal " },
        12,
      ),
    );

    expect(search.get("category")).toBe("curries");
    expect(search.get("difficulty")).toBe("easy,hard");
    expect(search.get("time")).toBe("15-30");
    expect(search.get("diet")).toBe("vegan");
    expect(search.get("q")).toBe("dhal");
  });

  it("omits empty lists and blank q", () => {
    const search = new URLSearchParams(buildRecipeApiSearch({ ...base, difficulty: [], diet: [], q: "   " }, 12));
    expect(search.has("difficulty")).toBe(false);
    expect(search.has("diet")).toBe(false);
    expect(search.has("q")).toBe(false);
  });
});
```

`tests/unit/recipe-listing.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RecipeListing } from "@/components/storefront/recipes/recipe-listing";
import type { RecipeCard, RecipeFacets, RecipeListResult } from "@/types/recipe";

function card(id: string, title: string): RecipeCard {
  return {
    id,
    slug: id,
    href: `/recipes/${id}`,
    title,
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: `${title} image`,
    categoryName: "Curries",
    cuisine: null,
    difficulty: "Easy",
    totalTimeMinutes: 30,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
  };
}

const initialData: RecipeListResult = { recipes: [card("dhal", "Dhal Curry"), card("kottu", "Chicken Kottu Roti")], total: 2, page: 1, pageSize: 12 };
const facets: RecipeFacets = {
  categories: [{ name: "Curries", slug: "curries" }],
  dietaryTags: [{ name: "Vegan", slug: "vegan" }],
};

function renderListing(data: RecipeListResult = initialData, searchParams = "") {
  const onUrlUpdate = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RecipeListing initialData={data} facets={facets} />
    </QueryClientProvider>,
    { wrapper: withNuqsTestingAdapter({ searchParams, hasMemory: true, onUrlUpdate }) },
  );
  return { onUrlUpdate };
}

function respondWith(body: RecipeListResult) {
  return vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  vi.stubGlobal("fetch", respondWith(initialData));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RecipeListing", () => {
  it("renders the server-provided recipes and count without fetching", () => {
    renderListing();

    expect(screen.getByRole("link", { name: "Dhal Curry" })).toBeInTheDocument();
    expect(screen.getByText("2 recipes")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Recipe results" })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refetches with the new filter and resets to page 1", async () => {
    const user = userEvent.setup();
    const filtered: RecipeListResult = { ...initialData, recipes: [card("dhal", "Dhal Curry")], total: 1 };
    vi.stubGlobal("fetch", respondWith(filtered));
    const { onUrlUpdate } = renderListing(initialData, "?page=2");

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));

    await waitFor(() => expect(screen.getByText("1 recipe")).toBeInTheDocument());
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain("difficulty=easy");
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?difficulty=easy");
  });

  it("selects a category chip in place and builds real hrefs", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing();

    expect(screen.getByRole("link", { name: "Curries" })).toHaveAttribute("href", "/recipes?category=curries");
    await user.click(screen.getByRole("link", { name: "Curries" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?category=curries");
  });

  it("shows the empty state and clears every filter but keeps the sort", async () => {
    const user = userEvent.setup();
    const empty: RecipeListResult = { recipes: [], total: 0, page: 1, pageSize: 12 };
    const { onUrlUpdate } = renderListing(empty, "?category=beverages&diet=spicy&sort=time");

    expect(screen.getByText("No recipes match those filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("?sort=time");
  });

  it("offers a way back when the page is past the end", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing({ recipes: [], total: 16, page: 9, pageSize: 12 }, "?page=9");

    expect(screen.getByText("There are no recipes on this page.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Go to first page" }));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].queryString).toBe("");
  });

  it("keeps the previous results and shows a retry alert when a refetch fails", async () => {
    const user = userEvent.setup();
    const failing = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", failing);
    renderListing();

    await user.click(screen.getByRole("checkbox", { name: "Easy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't update recipes.");
    expect(screen.getByRole("link", { name: "Dhal Curry" })).toBeInTheDocument();

    const callsBefore = failing.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(failing.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("debounces search before fetching and replaces rather than pushes history", async () => {
    const user = userEvent.setup();
    const { onUrlUpdate } = renderListing();

    await user.type(screen.getByRole("searchbox", { name: "Search recipes" }), "dhal");

    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe("replace");
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain("q=dhal"));
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes("q=d&")).length).toBe(0);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/use-recipe-listing.test.ts tests/unit/recipe-listing.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Create `src/hooks/use-recipe-listing.ts`**

```ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { RecipeListingParams } from "@/hooks/use-recipe-listing-params";
import type { RecipeListResult } from "@/types/recipe";

const SEARCH_DEBOUNCE_MS = 300;

/** Query string for GET /api/recipes. The server re-validates everything. */
export function buildRecipeApiSearch(params: RecipeListingParams, pageSize: number): string {
  const search = new URLSearchParams();
  if (params.category) search.set("category", params.category);
  if (params.difficulty && params.difficulty.length > 0) search.set("difficulty", params.difficulty.join(","));
  if (params.time && params.time.length > 0) search.set("time", params.time.join(","));
  if (params.diet && params.diet.length > 0) search.set("diet", params.diet.join(","));
  const q = params.q?.trim();
  if (q) search.set("q", q);
  search.set("sort", params.sort);
  search.set("page", String(params.page));
  search.set("pageSize", String(pageSize));
  return search.toString();
}

/**
 * Fetches the listing for the current URL state. The search text is
 * debounced here (not in the input), so the URL and the box stay in sync
 * with Back/Forward while typing doesn't fire a request per keystroke.
 *
 * `result` is never empty-handed: while a new request is in flight it's the
 * previous results (keepPreviousData), and if that request fails it stays
 * the last successful result, so the page never shows an unfiltered list
 * under a filter the customer just picked. `isError` drives the retry alert.
 */
export function useRecipeListing(params: RecipeListingParams, initialData: RecipeListResult) {
  const pageSize = initialData.pageSize;
  const debouncedQ = useDebouncedValue(params.q, SEARCH_DEBOUNCE_MS);
  const search = buildRecipeApiSearch({ ...params, q: debouncedQ }, pageSize);

  // Same idea as useProductListing: the server's data seeds only the
  // request it was rendered for, never a later filter change.
  const initialSearch = useRef(search).current;

  const query = useQuery({
    queryKey: ["recipes", search],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/recipes?${search}`, { signal });
      if (!response.ok) throw new Error("Failed to load recipes");
      return (await response.json()) as RecipeListResult;
    },
    initialData: () => (search === initialSearch ? initialData : undefined),
    placeholderData: keepPreviousData,
  });

  // Keep the last successful result for the error state. Adjusting state
  // during render (not in an effect) is React's documented pattern for this.
  const [lastResult, setLastResult] = useState(initialData);
  if (query.data && query.data !== lastResult) {
    setLastResult(query.data);
  }

  return {
    result: query.data ?? lastResult,
    isError: query.isError,
    isFetching: query.isFetching,
    retry: () => void query.refetch(),
  };
}
```

- [ ] **Step 4: Create `src/components/storefront/recipes/recipe-listing.tsx`**

```tsx
"use client";

import { FilterDrawer } from "@/components/storefront/listing/filter-drawer";
import { FilterSidebar } from "@/components/storefront/listing/filter-sidebar";
import { Pagination } from "@/components/storefront/listing/pagination";
import { Button } from "@/components/ui/button";
import { useRecipeListing } from "@/hooks/use-recipe-listing";
import { useRecipeListingParams } from "@/hooks/use-recipe-listing-params";
import { serializeRecipeListing } from "@/lib/recipe-listing-params";
import { cn } from "@/lib/utils";
import type { RecipeFacets, RecipeListResult } from "@/types/recipe";
import { RecipeCategoryChips } from "./recipe-category-chips";
import { RecipeEmptyState } from "./recipe-empty-state";
import { RecipeFilterControls, type RecipeFilterValues } from "./recipe-filter-controls";
import { RecipeGrid } from "./recipe-grid";
import { RecipeSearchBox } from "./recipe-search-box";
import { RecipeSortSelect } from "./recipe-sort-select";

interface RecipeListingProps {
  initialData: RecipeListResult;
  facets: RecipeFacets;
}

function countLabel(total: number) {
  return `${total} ${total === 1 ? "recipe" : "recipes"}`;
}

export function RecipeListing({ initialData, facets }: RecipeListingProps) {
  const [params, setParams] = useRecipeListingParams();
  const { result, isError, isFetching, retry } = useRecipeListing(params, initialData);

  const filterValues: RecipeFilterValues = {
    difficulty: params.difficulty ?? [],
    time: params.time ?? [],
    diet: params.diet ?? [],
  };

  function handleFilterChange(next: RecipeFilterValues) {
    void setParams({
      page: null,
      difficulty: next.difficulty.length > 0 ? next.difficulty : null,
      time: next.time.length > 0 ? next.time : null,
      diet: next.diet.length > 0 ? next.diet : null,
    });
  }

  function clearFilters() {
    void setParams({ page: null, category: null, difficulty: null, time: null, diet: null, q: null });
  }

  const filters = (
    <RecipeFilterControls
      values={filterValues}
      onChange={handleFilterChange}
      dietaryTagOptions={facets.dietaryTags}
      onClear={clearFilters}
    />
  );

  const pageCount = Math.ceil(result.total / result.pageSize);

  return (
    <div className="flex flex-col gap-6">
      <RecipeSearchBox
        value={params.q ?? ""}
        onChange={(q) => void setParams({ q: q === "" ? null : q, page: null }, { history: "replace" })}
      />
      <RecipeCategoryChips
        categories={facets.categories}
        selected={params.category}
        hrefFor={(slug) => serializeRecipeListing("/recipes", { ...params, category: slug, page: null })}
        onSelect={(slug) => void setParams({ category: slug, page: null })}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <FilterSidebar label="Filter recipes">{filters}</FilterSidebar>

        <section aria-labelledby="recipe-results-heading" className="min-w-0 flex-1">
          <h2 id="recipe-results-heading" className="sr-only">
            Recipe results
          </h2>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <p aria-live="polite" className="text-small text-charcoal/70">
              {countLabel(result.total)}
            </p>
            <div className="flex items-center gap-2">
              <FilterDrawer>{filters}</FilterDrawer>
              <RecipeSortSelect value={params.sort} onValueChange={(sort) => void setParams({ sort, page: null })} />
            </div>
          </div>

          {isError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-small text-charcoal"
            >
              <p>Couldn&apos;t update recipes.</p>
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            </div>
          )}

          <div aria-busy={isFetching} className={cn("transition-opacity", isFetching && "opacity-60")}>
            {result.recipes.length > 0 ? (
              <>
                <RecipeGrid recipes={result.recipes} />
                {pageCount > 1 && (
                  <Pagination
                    page={result.page}
                    pageSize={result.pageSize}
                    total={result.total}
                    onPageChange={(page) => void setParams({ page })}
                  />
                )}
              </>
            ) : result.total === 0 ? (
              <RecipeEmptyState message="No recipes match those filters." actionLabel="Clear all filters" onAction={clearFilters} />
            ) : (
              <RecipeEmptyState
                message="There are no recipes on this page."
                actionLabel="Go to first page"
                onAction={() => void setParams({ page: null })}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create the route files**

`src/app/(storefront)/recipes/page.tsx`:

```tsx
import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { ItemListJsonLd } from "@/components/storefront/product/item-list-json-ld";
import { RecipeListing } from "@/components/storefront/recipes/recipe-listing";
import { listRecipeFacets, listRecipes } from "@/services/recipe.service";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Authentic Sri Lankan recipes made with Oristor products: curries, rice, sambols, snacks, sweets and drinks. Filter by time, difficulty and dietary needs.",
  alternates: { canonical: "/recipes" },
};

interface RecipesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  // Same schema as GET /api/recipes, so the first render and every later
  // client fetch agree on filters, defaults and fallbacks.
  const query = recipeListingQuerySchema.parse(await searchParams);
  const [result, facets] = await Promise.all([listRecipes(query), listRecipeFacets()]);

  return (
    <Section>
      <ItemListJsonLd items={result.recipes.map((recipe) => ({ href: recipe.href, name: recipe.title }))} />
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <p className="mt-2 max-w-2xl text-body text-charcoal/80">
        Authentic Sri Lankan dishes, from weeknight curries to festival sweets, made with Oristor spices and pantry staples.
      </p>
      <div className="mt-8">
        <RecipeListing initialData={result} facets={facets} />
      </div>
    </Section>
  );
}
```

`src/app/(storefront)/recipes/loading.tsx`:

```tsx
import { Section } from "@/components/storefront/layout/section";

export default function RecipesLoading() {
  return (
    <Section aria-busy="true">
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <p className="sr-only">Loading recipes…</p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="aspect-4/3 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </Section>
  );
}
```

`src/app/(storefront)/recipes/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { Section } from "@/components/storefront/layout/section";
import { Button } from "@/components/ui/button";

// Next.js 16 passes `unstable_retry` (not the older `reset`) to error boundaries.
export default function RecipesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <div role="alert" className="mt-8 flex flex-col items-start gap-4">
        <p className="text-body text-charcoal">We couldn&apos;t load recipes right now.</p>
        <Button type="button" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </div>
    </Section>
  );
}
```

Check that `Section` passes arbitrary HTML attributes (such as `aria-busy`) to its element; its props extend `React.HTMLAttributes<HTMLElement>`. If it doesn't spread them, wrap the loading content in a `<div aria-busy="true">` instead.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/use-recipe-listing.test.ts tests/unit/recipe-listing.test.tsx`
Expected: PASS.

If the history test fails because the nuqs testing adapter reports options under a different property than `options.history`, log `onUrlUpdate.mock.calls[0][0]` once, fix the property path in this test and in Task 3's hook test, and note it in your report.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx next typegen
npx tsc --noEmit
npm run lint
git add src/hooks/use-recipe-listing.ts src/components/storefront/recipes/recipe-listing.tsx "src/app/(storefront)/recipes" tests/unit/use-recipe-listing.test.ts tests/unit/recipe-listing.test.tsx
git commit -m "feat: add the Recipe Centre page with URL-driven filters, sort and search" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Homepage featured recipes and navigation

**Files:**
- Modify: `src/components/storefront/home/featured-recipes.tsx`, `src/app/(storefront)/page.tsx`
- Modify: `src/lib/fixtures/home-fixtures.ts` (delete `featuredRecipes` and the `RecipeCardData` import), `src/types/home.ts` (delete `RecipeCardData`)
- Modify: `src/lib/nav-config.ts`
- Test: `tests/unit/featured-recipes.test.tsx`

**Interfaces:**
- Consumes: `getFeaturedRecipes` (Task 5), `RecipeCard` component (Task 9).
- Produces: `FeaturedRecipes()`, an async Server Component with no props.

- [ ] **Step 1: Write the failing test**

`tests/unit/featured-recipes.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeCard } from "@/types/recipe";

vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/services/recipe.service", () => ({ getFeaturedRecipes: vi.fn() }));

import { FeaturedRecipes } from "@/components/storefront/home/featured-recipes";
import { getFeaturedRecipes } from "@/services/recipe.service";

function card(slug: string, title: string): RecipeCard {
  return {
    id: slug,
    slug,
    href: `/recipes/${slug}`,
    title,
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: `${title} image`,
    categoryName: "Curries",
    cuisine: "Sri Lankan",
    difficulty: "Easy",
    totalTimeMinutes: 30,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
  };
}

beforeEach(() => {
  vi.mocked(getFeaturedRecipes).mockReset();
});

describe("FeaturedRecipes", () => {
  it("renders the featured recipes as cards linking to their pages", async () => {
    vi.mocked(getFeaturedRecipes).mockResolvedValue([card("dhal-curry", "Dhal Curry"), card("seeni-sambol", "Seeni Sambol")]);

    render(await FeaturedRecipes());

    expect(getFeaturedRecipes).toHaveBeenCalledWith(4);
    expect(screen.getByRole("heading", { level: 2, name: "Featured Recipes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dhal Curry" })).toHaveAttribute("href", "/recipes/dhal-curry");
    expect(screen.getByRole("link", { name: "View all recipes" })).toHaveAttribute("href", "/recipes");
  });

  it("renders nothing when no recipe is featured", async () => {
    vi.mocked(getFeaturedRecipes).mockResolvedValue([]);

    expect(await FeaturedRecipes()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/featured-recipes.test.tsx`
Expected: FAIL. The current component takes a `recipes` prop and doesn't call the service.

- [ ] **Step 3: Rewrite `src/components/storefront/home/featured-recipes.tsx`**

```tsx
import Link from "next/link";
import { connection } from "next/server";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { RecipeCard } from "@/components/storefront/recipes/recipe-card";
import { getFeaturedRecipes } from "@/services/recipe.service";

/**
 * Admins choose featured recipes with Recipe.isFeatured (STORY-043's
 * builder). Render per request so a newly featured recipe shows up
 * without a rebuild, and skip the section entirely when none is featured.
 */
export async function FeaturedRecipes() {
  await connection();
  const recipes = await getFeaturedRecipes(4);
  if (recipes.length === 0) return null;

  return (
    <Section className="bg-beige">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-h2 font-heading text-charcoal">Featured Recipes</h2>
        <Link href="/recipes" className="text-small text-chilli hover:underline">
          View all recipes
        </Link>
      </div>
      <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {recipes.map((recipe, index) => (
          <li key={recipe.id}>
            <ScrollReveal delay={index * 0.05}>
              <RecipeCard recipe={recipe} />
            </ScrollReveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
```

- [ ] **Step 4: Update the homepage and remove the fixture**

In `src/app/(storefront)/page.tsx`:
- remove `featuredRecipes,` from the `home-fixtures` import;
- change `<FeaturedRecipes recipes={featuredRecipes} />` to `<FeaturedRecipes />`;
- in the doc comment, change "All content below Hero is typed fixture data" to "Content below Hero is typed fixture data, except Featured Recipes (real recipes since STORY-017)".

In `src/lib/fixtures/home-fixtures.ts`, delete the whole `export const featuredRecipes: RecipeCardData[] = [ … ];` block and remove `RecipeCardData,` from its type import. In `src/types/home.ts`, delete the `RecipeCardData` interface.

Run: `grep -rn "RecipeCardData\|featuredRecipes" src tests`
Expected: no output.

- [ ] **Step 5: Update the Recipes mega-menu in `src/lib/nav-config.ts`**

Replace the two links:

```ts
      { label: "Quick & Easy", href: "/recipes?difficulty=easy&time=under-15,15-30" },
      // "Video Recipes" returns with STORY-019 (video recipes).
```

(Delete the `Video Recipes` line; keep `All Recipes` and `Food Academy` unchanged.)

Run: `grep -rn "Video Recipes\|tag=quick-easy\|type=video" src tests`
Expected: only the new comment line in `nav-config.ts`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/featured-recipes.test.tsx tests/unit/nav-stores.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit
npm run lint
git add src/components/storefront/home/featured-recipes.tsx "src/app/(storefront)/page.tsx" src/lib/fixtures/home-fixtures.ts src/types/home.ts src/lib/nav-config.ts tests/unit/featured-recipes.test.tsx
git commit -m "feat: show real featured recipes on the homepage and map Quick & Easy to recipe filters" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end tests

**Files:**
- Create: `tests/e2e/recipe-centre.spec.ts`

**Interfaces:**
- Consumes: the seed data from Task 7 (exact titles and values) and the UI copy in Global Constraints.

**Prerequisite (controller):**
1. Reseed: `npx prisma db execute --file tests/unit/truncate-all.sql`, then `npx prisma db seed`.
2. Make sure the dev server on port 3000 is running **from this worktree**, restarted after the reseed.

The implementer doesn't restart servers. If `/recipes` returns 404 or 500, report it.

- [ ] **Step 1: Create `tests/e2e/recipe-centre.spec.ts`**

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Depends on prisma/seed-recipes.ts: 16 Published recipes (12 per page), plus
// one Draft and one Archived that must never appear.

function resultTitles(page: Page) {
  return page.getByRole("region", { name: "Recipe results" }).locator("article h3");
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("renders the first page of recipes on the server", async ({ page }) => {
    const response = await page.request.get("/recipes");
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain("Chicken Kottu Roti");
    expect(html).not.toContain("Pumpkin Curry");
    expect(html).not.toContain("Milk Toffee");
  });

  test("combines category, difficulty and dietary filters in the URL, and Back restores them", async ({ page }) => {
    await page.goto("/recipes");
    await expect(page.getByRole("heading", { level: 1, name: "Recipe Centre" })).toBeVisible();
    await expect(page.getByText("16 recipes")).toBeVisible();

    await page.getByRole("navigation", { name: "Recipe categories" }).getByRole("link", { name: "Curries" }).click();
    await expect(page).toHaveURL(/category=curries/);

    const sidebar = page.getByRole("complementary", { name: "Filter recipes" });
    await sidebar.getByRole("checkbox", { name: "Medium" }).click();
    await expect(page).toHaveURL(/difficulty=medium/);
    await sidebar.getByRole("checkbox", { name: "Spicy" }).click();
    await expect(page).toHaveURL(/diet=spicy/);

    await expect(resultTitles(page)).toHaveText(["Chili Paste Deviled Prawns", "Sri Lankan Chicken Curry"]);

    // Back undoes one filter at a time: first Spicy, then Medium.
    await page.goBack();
    await expect(page).not.toHaveURL(/diet=spicy/);
    await expect(page).toHaveURL(/difficulty=medium/);

    await page.goBack();
    await expect(page).not.toHaveURL(/difficulty=/);
    await expect(page).toHaveURL(/category=curries/);
    await expect(resultTitles(page)).toHaveText([
      "Chili Paste Deviled Prawns",
      "Fish Ambul Thiyal",
      "Sri Lankan Chicken Curry",
      "Dhal Curry (Parippu)",
    ]);
  });

  test("shows the empty state for a zero-result combination and clears it", async ({ page }) => {
    await page.goto("/recipes?category=beverages&diet=spicy");

    await expect(page.getByText("No recipes match those filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear all filters" }).click();

    await expect(page).not.toHaveURL(/category=|diet=/);
    await expect(page.getByText("16 recipes")).toBeVisible();
    await expect(resultTitles(page)).toHaveCount(12);
  });

  test("sorting by cook time orders cards by total time", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("combobox", { name: "Sort recipes" }).click();
    await page.getByRole("option", { name: "Cook Time (shortest first)" }).click();
    await expect(page).toHaveURL(/sort=time/);

    const api = (await (await page.request.get("/api/recipes?sort=time")).json()) as {
      recipes: Array<{ title: string; totalTimeMinutes: number }>;
    };
    const times = api.recipes.map((recipe) => recipe.totalTimeMinutes);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    await expect(resultTitles(page)).toHaveText(api.recipes.map((recipe) => recipe.title));
  });

  test("search filters by title", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("searchbox", { name: "Search recipes" }).fill("sambol");

    await expect(page).toHaveURL(/q=sambol/);
    await expect(resultTitles(page)).toHaveText(["Coconut Sambol with Maldive Fish", "Seeni Sambol"]);
  });

  test("the Quick & Easy menu link lands on easy recipes under 30 minutes", async ({ page }) => {
    await page.goto("/");

    await page.locator("header").getByRole("button", { name: "Recipes" }).click();
    await page.getByRole("link", { name: "Quick & Easy" }).click();

    await expect(page).toHaveURL(/\/recipes\?difficulty=easy&time=under-15(,|%2C)15-30/);
    await expect(page.getByRole("complementary", { name: "Filter recipes" }).getByRole("checkbox", { name: "Easy" })).toBeChecked();
    await expect(resultTitles(page)).toHaveText([
      "Pol Roti with Lunu Miris",
      "Coconut Sambol with Maldive Fish",
      "Sri Lankan Ginger Tea",
      "Wood Apple Juice",
    ]);
  });

  test("pagination moves to page 2", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("navigation", { name: "Pagination" }).getByRole("button", { name: "2" }).click();

    await expect(page).toHaveURL(/page=2/);
    await expect(resultTitles(page)).toHaveText(["Watalappan", "Kiribath (Milk Rice)", "Sri Lankan Ginger Tea", "Wood Apple Juice"]);
  });

  test("filter sidebar and category chips have no detectable accessibility violations", async ({ page }) => {
    await page.goto("/recipes");
    await expect(resultTitles(page)).toHaveCount(12);

    const results = await new AxeBuilder({ page })
      .include('aside[aria-label="Filter recipes"]')
      .include('nav[aria-label="Recipe categories"]')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test("homepage shows four featured recipes linking into the Recipe Centre", async ({ page }) => {
    await page.goto("/");

    const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Featured Recipes" }) });
    const links = section.locator("article h3 a");
    await expect(links).toHaveCount(4);
    for (const href of await links.evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")))) {
      expect(href).toMatch(/^\/recipes\/[a-z0-9-]+$/);
    }
    await expect(section.getByText("Pumpkin Curry")).toHaveCount(0);
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the filter drawer applies a dietary filter and has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/recipes");

    await page.getByRole("button", { name: "Filters", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(results.violations).toEqual([]);

    await dialog.getByRole("checkbox", { name: "Vegan" }).click();
    await dialog.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/diet=vegan/);
    await expect(page.getByText("7 recipes")).toBeVisible();
  });
});
```

Seed facts these assertions rely on:
- 16 Published recipes. Newest page 1 starts with Chicken Kottu Roti (2026-09-18), and page 2 is Watalappan, Kiribath, Ginger Tea, Wood Apple Juice.
- Curries + Medium + Spicy matches Deviled Prawns (2026-09-01) and Chicken Curry (2026-07-15).
- Easy recipes under 30 minutes: Pol Roti (15 min), Coconut Sambol, Ginger Tea and Wood Apple (10 min each). Dhal and Kiribath are exactly 30, so they're excluded.
- 7 Published recipes are vegan.
- Only two titles contain "sambol", and no description does.

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test tests/e2e/recipe-centre.spec.ts --workers=1`
Expected: 10 passed.

If the Back-navigation test fails because Back also removes `difficulty=medium`, nuqs coalesced the two checkbox clicks into one history entry. Add `await expect(page).toHaveURL(/difficulty=medium/)` before clicking Spicy (it's already there) and re-run. If it still coalesces, report it; don't change the test's intent.

- [ ] **Step 3: Run the neighbouring specs that this story touches**

Run: `npx playwright test tests/e2e/product-listing.spec.ts tests/e2e/homepage.spec.ts tests/e2e/header.spec.ts tests/e2e/search.spec.ts --workers=1`
Expected: all pass. The homepage test's section order still includes "Featured Recipes", because the seed features 4 recipes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/recipe-centre.spec.ts
git commit -m "test: add Recipe Centre e2e coverage" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Documentation and story status

**Files:**
- Modify: `docs/architecture-decisions.md` (append an entry)
- Modify: `docs/stories/04-recipes-food-academy/STORY-017-recipe-centre-listing.md`
- Modify: `.claude/skills/add-recipe/SKILL.md`

- [ ] **Step 1: Append to `docs/architecture-decisions.md`**

```markdown
## 2026-09-24 — STORY-017 Recipe Centre Listing

**Content model.** `Recipe` (listing fields only; STORY-018 adds
ingredients, steps, tips, nutrition and product links), `RecipeCategory`,
and dietary tags as a lookup table (`DietaryTag` + `RecipeDietaryTag`), so
admins add tags without a migration. `RecipeStatus` is
`Draft → Review → Approved → Published → Archived` (STORY-043 owns the
transitions). The storefront shows Published recipes only:
`buildRecipeWhere()` always starts with `status: "Published"`. A category
or tag appears on the storefront only if it is Active and has at least one
Published recipe.

Seeded taxonomy: categories Curries, Rice & Grains, Sweets & Desserts,
Beverages, Snacks, Sambols & Condiments; dietary tags Vegetarian, Vegan,
Gluten-Free, Dairy-Free, Nut-Free, Spicy. `cuisine` is a free-text label
on the card, not a filter.

**URL contract** (for STORY-018 related recipes and STORY-022 bookmarks):
`/recipes?category=<slug>&difficulty=easy,medium,hard&time=under-15,15-30,30-60,60-plus&diet=<slug>,<slug>&q=<text>&sort=newest|popular|rating|time&page=<n>`.
`difficulty` and `time` are OR within the list, `diet` is AND (every tag),
and different params AND together. Time ranges are half-open (`15-30` is
15 ≤ t < 30). `GET /api/recipes` takes the same params plus `pageSize`
(default 12, max 48). A malformed or stale query never errors
(`recipeListingQuerySchema` uses `.catch()` everywhere). The story's
`cookTimeMax` / `dietaryTags[]` became `time` / `diet`.

**Total time, not cook time.** Filtering, the "Cook Time" sort and the
card all use `totalTimeMinutes` (prep + cook), which is what a weeknight
cook actually waits for. It's stored for indexing and always derived by
`computeTotalTimeMinutes()` (`src/lib/recipe-time.ts`). STORY-043's
builder must write it through that function.

**Views and ratings.** `viewCount`, `avgRating` and `ratingCount` are
placeholders written only by the seed. STORY-018 increments views on the
detail page. STORY-022 maintains the rating pair, the way
`ProductRatingSummary` works for products.

**Featured recipes.** `Recipe.isFeatured` drives the homepage section
(newest four Published). The section calls `connection()` so it renders
per request, not at build time, and it disappears when nothing is
featured.

**Shared listing components.** `CheckboxOption`, `Pagination`,
`FilterDrawer` (now children-based), `FilterSidebar` (children + label) and
a generic `SortSelect` live in `src/components/storefront/listing/`.
Products use them through `ProductSortSelect`. `toggleValue` and
`escapeLikePattern` moved to `src/lib/`.

**Search registry on globalThis.** `search-extensions.ts` now keeps its
provider on `globalThis` (as `product-detail-extensions.ts` does), because
`src/instrumentation.ts` and route code load separate module copies. The
recipe provider is registered there and feeds header search suggestions.

**Nav.** "Quick & Easy" is `/recipes?difficulty=easy&time=under-15,15-30`.
"Video Recipes" is removed until STORY-019.
```

- [ ] **Step 2: Update the story file**

In `docs/stories/04-recipes-food-academy/STORY-017-recipe-centre-listing.md`:
- change `**Status:** Draft` to `**Status:** Done`;
- tick (`- [x]`) every acceptance criterion and task checkbox;
- add this line directly under the `## Tasks` heading:

```markdown
> Implemented with `time` (total-time ranges) and `diet` (dietary tag slugs) in place of `cookTimeMax` and `dietaryTags[]`. See the STORY-017 entry in `docs/architecture-decisions.md`. Search covers title and short description; ingredient search follows STORY-018's ingredient data.
```

- [ ] **Step 3: Update `.claude/skills/add-recipe/SKILL.md`**

Replace the line `- Recipe Centre listing page: filter by category, difficulty, prep time.` with:

```markdown
- Recipe Centre listing page (built in STORY-017): filter by category,
  difficulty, total time (prep + cook) and dietary tags; see the URL
  contract in docs/architecture-decisions.md (STORY-017). New recipes must
  set totalTimeMinutes via computeTotalTimeMinutes() and choose tags from
  the DietaryTag table.
```

- [ ] **Step 4: Commit**

```bash
git add docs/architecture-decisions.md docs/stories/04-recipes-food-academy/STORY-017-recipe-centre-listing.md .claude/skills/add-recipe/SKILL.md
git commit -m "docs: record the recipe content model and listing URL contract; mark STORY-017 done" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:**

  | Spec item | Task |
  | --- | --- |
  | Data model and migration | 1 |
  | Shared helpers (escape, 500 response, `globalThis` search registry) | 2 |
  | Contract, schema and parsers | 3 |
  | Repository builders and queries | 4 |
  | Service and header search provider | 5 |
  | API | 6 |
  | Seed | 7 |
  | Shared listing components | 8 |
  | Recipe components | 9 |
  | Page, client state, error and loading | 10 |
  | Homepage and nav | 11 |
  | E2E and axe | 12 |
  | Docs | 13 |

- **Deliberate deviations from the spec text**, recorded in the spec in the same commit as this plan:
  - no separate `recipe-listing-loader.ts`: the page parses `searchParams` with the same Zod schema as the API, and nuqs's loader isn't needed;
  - the migration is generated offline with `migrate diff` (the STORY-016 approach) instead of `migrate dev`;
  - the search debounce lives in `useRecipeListing`, so the input and URL stay in sync with Back/Forward;
  - the error boundary uses Next 16's `unstable_retry`;
  - the client never shows a skeleton after hydration: `loading.tsx` covers navigation, and the listing always has the initial or last-good data.
- **Type consistency:**
  - `RecipeFilters` (Task 3) is what `buildRecipeWhere` takes (Task 4).
  - The keys of `RecipeListingQuery` minus `page`/`pageSize`/`sort` match `RecipeFilters` (Task 5's destructure).
  - `RecipeListingParams` (Task 3) feeds `buildRecipeApiSearch`, `useRecipeListing` and `serializeRecipeListing` (Task 10).
  - `RecipeFacetOption` is `{ name, slug }` everywhere.
  - `RecipeCard.difficulty` is the `"Easy" | "Medium" | "Hard"` union that the Prisma enum type satisfies.
