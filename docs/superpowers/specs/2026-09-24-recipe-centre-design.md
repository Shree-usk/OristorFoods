# Recipe Centre Listing — Design

**Story:** `docs/stories/04-recipes-food-academy/STORY-017-recipe-centre-listing.md`
**Date:** 2026-09-24
**Branch:** `feature/story-017-recipe-centre`, based on
`feature/story-016-product-qa` (PR #4, stacked on #3 → #2). It reuses
STORY-016's `escapeLikePattern`, the `src/instrumentation.ts` provider
registration, and the product listing's filter components. Retarget to
`master` once the earlier PRs merge.

## Summary

`/recipes` becomes a real Recipe Centre: a server-rendered, paginated grid
of Published recipe cards with a category chip row, a filter sidebar
(a drawer on mobile) for difficulty, total time and dietary tags, a search
box, and four sorts. All state lives in the URL. The homepage "Featured
Recipes" section and the header search's recipe suggestions switch from
placeholder data to real recipes. This is the first story of Sprint 4
(Recipes & Food Academy); STORY-018 builds the detail page next.

Decisions confirmed with the user before design:

- **Listing fields only.** STORY-017 creates the `Recipe` columns the
  listing needs. STORY-018 adds ingredients, steps, chef tips, nutrition
  and product links. Until then search covers title and short
  description; ingredient search arrives with STORY-018's ingredient data.
- **Nav links.** "Quick & Easy" maps to real filters
  (`/recipes?difficulty=easy&time=under-15,15-30`). "Video Recipes" is
  removed from the mega-menu until STORY-019 builds video recipes, rather
  than labelling an unfiltered list.
- **Dietary tags are a lookup table** (`DietaryTag` + `RecipeDietaryTag`),
  not an enum, so admins can add tags without a migration (Admin Console
  principle).
- **Homepage Featured Recipes is wired now**, from an admin-controllable
  `isFeatured` flag. The placeholder fixtures are deleted.
- **Ratings are read-only here.** Cards show `avgRating`/`ratingCount` and
  "Highest Rated" sorts by them, but submitting reviews is STORY-022, which
  will maintain these columns the way `ProductRatingSummary` works for
  products. Story order stays 017 → 018; 022 comes later.
- **Approach A:** a separate recipe module that follows the product
  listing's patterns, with the generic product listing components moved to
  a shared `listing/` folder. Rejected: a config-driven listing engine for
  both (rewrites a working, tested product listing for a second use we only
  half understand), and copying the product components (breaks "no
  duplicate logic" and would fork the STORY-014 filter a11y fix).

## Data model

Naming follows the existing schema: PascalCase enum values
(`ProductStatus`), `cuid()` ids, `ContentStatus` for admin-hideable
taxonomy.

```prisma
// --- Recipes (STORY-017) ---

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
  totalTimeMinutes Int
  servings         Int
  status           RecipeStatus       @default(Draft)
  isFeatured       Boolean            @default(false)
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

- **Category vs cuisine.** `category` is the filterable taxonomy (Curries,
  Rice & Grains, Sweets & Desserts, Beverages, Snacks, Sambols &
  Condiments). `cuisine` ("Sri Lankan", "Fusion") is an optional free-text
  label shown on the card. There is no cuisine filter now; STORY-043 can
  add one if the content team needs it.
- **`totalTimeMinutes` is derived.** It is always `prepTimeMinutes +
  cookTimeMinutes`, computed by `computeTotalTimeMinutes()` in the service
  (and by the seed through the same function). It is stored so the time
  filter and sort can use an index. STORY-043's admin builder must write it
  through the same function.
- **Storefront visibility of taxonomy.** A category or dietary tag appears
  on the storefront only if it is `Active` **and** has at least one
  Published recipe, so admins can create taxonomy ahead of content without
  empty chips.
- **`publishedAt`** is set by the publishing workflow (STORY-043); the seed
  sets it for Published recipes. The Newest sort puts null values last.
- **`viewCount`, `avgRating`, `ratingCount`** are written by nothing yet.
  STORY-018 increments `viewCount` on the detail page; STORY-022 maintains
  the rating pair. The seed sets realistic values so the sorts are
  demonstrable.
- **Migration:** one committed migration, `add_recipes`, produced with
  `migrate dev` against a freshly restarted `prisma dev` server (see
  `docs/architecture-decisions.md`), with no BOM.

### Seed data

`prisma/seed.ts` gains a recipes section (after products):

- 6 categories (the list above, `sortOrder` 1–6) and 6 dietary tags
  (Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Spicy).
- 18 recipes: 16 Published, 1 Draft, 1 Archived. The two non-Published
  recipes deliberately share a category and tags with Published ones so the
  "Published only" tests are meaningful. Published recipes cover every
  category, every difficulty, and every time range (including exact
  boundary values 15, 30 and 60 minutes).
- 4 Published recipes have `isFeatured = true`; the Draft recipe also has
  `isFeatured = true` (it must not appear on the homepage).
- Some Published recipes have `ratingCount = 0` and `avgRating = null` (the
  card shows no rating for them).
- Hero images reuse existing Oristor product photos under
  `public/images/products/`, with honest alt text ("Oristor chili paste,
  used in this recipe"). Real photography is uploaded later through the
  admin Media Library.
- Sri Lankan dishes that use Oristor products, e.g. Chili Paste Deviled
  Prawns, Coconut Sambol with Maldive Fish, Spiced Mango Pickle Rice,
  Chicken Curry, Dhal Curry, Kiribath, Watalappan, Fish Ambul Thiyal,
  Pol Roti with Lunu Miris, Kottu Roti, Ginger Tea, Wood Apple Juice,
  Vegetable Samosas, Seeni Sambol, Brinjal Moju, Pumpkin Curry, Milk
  Toffee, Isso Vadai.

## URL and API contract

One parameter set for the page URL and the API:

| Param        | Values                                           | Semantics                                   |
| ------------ | ------------------------------------------------ | ------------------------------------------- |
| `category`   | a category slug                                  | single; set by the chip row                 |
| `difficulty` | `easy,medium,hard` (comma-separated)             | OR within the list                          |
| `time`       | `under-15,15-30,30-60,60-plus` (comma-separated) | OR within the list, on `totalTimeMinutes`   |
| `diet`       | dietary tag slugs (comma-separated)              | AND — a recipe must have every selected tag |
| `q`          | free text, trimmed, max 100 chars                | every word in title OR short description    |
| `sort`       | `newest` (default), `popular`, `rating`, `time`  | see Sorting                                 |
| `page`       | integer ≥ 1, default 1                           |                                             |
| `pageSize`   | API only, 1–48, default 12                       | not exposed in the page URL                 |

Different params combine with AND. Comma-separated lists match nuqs's
`parseAsArrayOf` serialization, as the product listing does.

Time ranges are half-open so boundaries fall in exactly one range:
`under-15` = `< 15`, `15-30` = `15 ≤ t < 30`, `30-60` = `30 ≤ t < 60`,
`60-plus` = `≥ 60`. UI labels: "Under 15 min", "15–30 min", "30–60 min",
"60+ min".

The story's `cookTimeMax` and `dietaryTags[]` params are replaced by `time`
and `diet`. Filtering and the "Cook Time" sort use total time (prep +
cook), which is what a weeknight cook actually waits for; the card shows
the same number.

**Resilience.** Parsing never fails the request. Every field uses
`.catch()` (as `productListingQuerySchema` does): a malformed `sort` or
`page` falls back to its default. Unknown `difficulty` / `time` values are
dropped from their lists. An unknown `diet` or `category` slug is kept and
simply matches nothing, which shows the empty state with "Clear filters".

## Backend

### Repository — `src/repositories/recipe.repository.ts`

The only recipe file that imports `@/lib/db`.

- `buildRecipeWhere(filters: RecipeFilters): Prisma.RecipeWhereInput` —
  pure. Always an `AND` array whose first element is
  `{ status: "Published" }`; then, only for filters that are present:
  - category: `{ category: { slug, status: "Active" } }`
  - difficulty: `{ difficulty: { in: [...] } }` (mapped to enum values)
  - time: `{ OR: [ ...one range condition per selected range ] }`
  - diet: one `{ dietaryTags: { some: { dietaryTag: { slug, status: "Active" } } } }`
    per selected tag
  - q: per word (split on whitespace, empty words dropped),
    `{ OR: [{ title: { contains, mode: "insensitive" } }, { shortDescription: { contains, mode: "insensitive" } }] }`
    with the word passed through `escapeLikePattern`.
- `buildRecipeOrderBy(sort: RecipeSort): Prisma.RecipeOrderByWithRelationInput[]` —
  pure, always ending with `{ id: "asc" }` for stable pagination:
  - `newest`: `publishedAt desc nulls last`
  - `popular`: `viewCount desc`
  - `rating`: `avgRating desc nulls last`, then `ratingCount desc`
  - `time`: `totalTimeMinutes asc`
- `findPublishedRecipes(where, orderBy, skip, take)` →
  `{ rows, total }` via one `$transaction([findMany, count])`, selecting
  only the card fields plus category name/slug and dietary tag names
  (ordered by tag `sortOrder`).
- `findActiveCategoriesWithPublishedRecipes()` and
  `findActiveDietaryTagsWithPublishedRecipes()` — ordered by `sortOrder`,
  then `name`.
- `findFeaturedRecipes(limit)` — Published and `isFeatured`, newest first.

`escapeLikePattern` moves from `qa.repository.ts` to
`src/lib/escape-like-pattern.ts` (exported, unit-tested); `qa.repository.ts`
imports it. Behaviour is unchanged.

### Service — `src/services/recipe.service.ts`

```ts
export interface RecipeCard {
  id: string;
  slug: string;
  href: string;              // `/recipes/${slug}`
  title: string;
  heroImage: string;
  heroImageAlt: string;
  categoryName: string;
  cuisine: string | null;
  difficulty: "Easy" | "Medium" | "Hard";
  totalTimeMinutes: number;
  avgRating: number | null;  // Decimal → number
  ratingCount: number;
  dietaryTags: string[];     // names
}

export interface RecipeListResult { recipes: RecipeCard[]; total: number; page: number; pageSize: number }
export interface RecipeFacets {
  categories: Array<{ name: string; slug: string }>;
  dietaryTags: Array<{ name: string; slug: string }>;
}
```

- `listRecipes(query: RecipeListingQuery): Promise<RecipeListResult>`
- `listRecipeFacets(): Promise<RecipeFacets>`
- `getFeaturedRecipes(limit = 4): Promise<RecipeCard[]>`
- `computeTotalTimeMinutes(prep, cook): number`
- `registerRecipeProviders()` — registers a header-search provider through
  `registerRecipeSearchProvider`: reuses `buildRecipeWhere({ q })`, returns
  up to `limit` suggestions `{ id, label: title, href, imageSrc: heroImage,
  type: "Recipe" }`, sorted by `popular`. Called from
  `src/instrumentation.ts` next to the review and Q&A providers.

`search-extensions.ts` currently keeps its provider in module scope.
STORY-015 found that instrumentation and route handlers can load separate
module instances, so it moves to `globalThis` exactly like
`product-detail-extensions.ts` (`__oristorSearchProviders`), with
`resetSearchExtensionsForTesting()` preserved.

### Validation — `src/validation/recipe-listing.schema.ts`

Zod 4 schema per the contract table, with `.transform()` placed before
`.optional()` so inferred keys stay optional. Exports
`recipeListingQuerySchema`, `RecipeListingQuery`, and the value tuples
`recipeSortValues`, `recipeDifficultyValues`, `recipeTimeValues`.

`src/lib/recipe-listing-params.ts` defines the nuqs parsers (`category`,
`difficulty`, `time`, `diet`, `q`, `sort`, `page`) from the same tuples;
`src/lib/recipe-listing-loader.ts` is the server `createLoader`, and
`src/hooks/use-recipe-listing-params.ts` the client `useQueryStates` —
the same trio as the product listing.

### API

- `GET /api/recipes` — parses `searchParams` with
  `recipeListingQuerySchema`, calls `listRecipes`, returns
  `RecipeListResult` as JSON.
- `GET /api/recipes/categories` — returns `RecipeFacets` (categories and
  dietary tags in one call; the path name comes from the story).

Both handlers only parse and call the service. An unexpected error is
logged and returned as a 500 with a generic message through a helper in
`src/lib/api/responses.ts` (new `serverErrorResponse()`, next to
`unauthorizedResponse` and `validationErrorResponse`).

## Frontend

### Page — `src/app/(storefront)/recipes/page.tsx`

Server Component. Loads params with `loadRecipeListingParams`, calls
`listRecipes` and `listRecipeFacets` in parallel, renders:

- `<h1>` "Recipe Centre" and a one-line intro
- `RecipeSearchBox`, `RecipeCategoryChips`
- desktop (`lg+`): filter sidebar left, results right; below `lg`: a
  "Filters" button opening the drawer
- results header: "N recipes" count and the sort select
- `RecipeListing` (client) with the server result as initial data

Metadata: title "Recipes | Oristor", description, canonical `/recipes`
(no filters). `ItemListJsonLd` for the recipes on the page (full `Recipe`
JSON-LD is STORY-018's detail page).

`src/app/(storefront)/recipes/error.tsx` — a client error boundary with a
short message and a "Try again" button (`reset()`), for a server-render
failure. `loading.tsx` renders the skeleton grid.

### Client state — `recipe-listing.tsx`

- `useRecipeListingParams()` for URL state; any filter/search/sort change
  resets `page` to 1.
- TanStack Query on `["recipes", params]` fetching `/api/recipes`;
  `initialData` only when the params equal the server-rendered params;
  `placeholderData: keepPreviousData`.
- On fetch error: keep showing the previous results **and** show an inline
  alert "Couldn't update recipes." with a Retry button. Never show
  unfiltered results as if they matched (the STORY-016 lesson).
- A polite live region announces "N recipes found" / "No recipes match
  those filters" after each settled fetch.
- Skeleton grid only when there is no data at all.
- `page` beyond the last page renders the empty state with a "Go to first
  page" action.

### Components — `src/components/storefront/recipes/`

- `recipe-card.tsx` — `<article>` with `next/image` hero (alt from
  `heroImageAlt`), whole card linked to `href`; category, title (`<h3>`),
  clock icon + "N min", difficulty badge (text, not colour alone), rating
  "★ 4.6 (23)" only when `ratingCount > 0` with an accessible label
  ("Rated 4.6 out of 5 from 23 ratings"). Used by the grid and the
  homepage.
- `recipe-category-chips.tsx` — "All" plus one chip per category, rendered
  as links (`/recipes?category=…`, preserving other params except `page`)
  with `aria-current="page"` on the selected one; horizontal scroll on
  mobile; wrapped in `<nav aria-label="Recipe categories">`.
- `recipe-filter-controls.tsx` — fieldsets with legends for Difficulty,
  Time and Dietary; checkboxes via the shared `CheckboxOption`; "Clear
  filters" resets every filter, category and `q`.
- `recipe-search-box.tsx` — labelled `type="search"` input, 300 ms
  debounce into `q`, clear button, `role="search"` wrapper.
- `recipe-grid.tsx` — responsive grid (1 / 2 / 3 columns) of `RecipeCard`.
- `recipe-empty-state.tsx` — "No recipes match those filters" plus a
  "Clear filters" button.
- `recipe-sort-select.tsx` — thin wrapper passing recipe options to the
  shared `SortSelect`: Newest, Most Popular, Highest Rated, Cook Time
  (shortest first); aria-label "Sort recipes".

### Shared listing components — `src/components/storefront/listing/`

- `checkbox-option.tsx` — moved out of `filter-controls.tsx` unchanged
  (keeps the STORY-014 `aria-labelledby` fix).
- `pagination.tsx` — moved unchanged.
- `filter-drawer.tsx` — now takes `children` and an optional `title`
  instead of product `FilterControls` props.
- `sort-select.tsx` — generic: `options: ReadonlyArray<{ value: T; label:
  string; disabled?: boolean }>`, `value`, `onValueChange`, `ariaLabel`.
  The product sort select becomes a wrapper passing the current product
  labels, disabled sorts and relevance behaviour, so product pages render
  exactly as today.

Product pages update imports only. Their existing unit and e2e tests
prove nothing changed.

### Homepage

`FeaturedRecipes` becomes an async Server Component calling
`getFeaturedRecipes(4)` and rendering `RecipeCard`s, with a "View all
recipes" link to `/recipes`. With no featured recipes the section renders
nothing. `featuredRecipes` is removed from `home-fixtures.ts` and
`RecipeCardData` from `src/types/home.ts`.

### Navigation

In `nav-config.ts`: "Quick & Easy" →
`/recipes?difficulty=easy&time=under-15,15-30`; "Video Recipes" removed
with a comment that STORY-019 restores it.

The PDP's "Recipes Using This Product" placeholder is unchanged (it needs
STORY-018's product links).

## Error handling

| Situation                               | Behaviour                                               |
| --------------------------------------- | ------------------------------------------------------- |
| Malformed / stale query string          | Defaults and dropped values; 200; never an error page   |
| Unknown category or dietary slug        | Matches nothing → empty state with "Clear filters"      |
| `page` past the last page               | Empty state with "Go to first page"                     |
| `/api/recipes` throws                   | Logged; 500 generic JSON; UI keeps prior results + alert |
| DB error during server render           | `recipes/error.tsx` boundary with "Try again"           |
| No featured recipes                     | Homepage section not rendered                           |

## Testing

**Unit (Vitest)**

- `escape-like-pattern.test.ts` — `%`, `_`, `\` escaped.
- `recipe-listing.schema.test.ts` — defaults, `.catch()` fallbacks,
  unknown difficulty/time dropped, `pageSize` cap, `q` trim/length.
- `recipe-query-builders.test.ts` (pure) — each filter alone; combined
  filters; `status: "Published"` is always the first `AND` element; time
  boundaries 14/15, 29/30, 59/60; multi-word `q`; wildcard escaping; every
  sort ends with the `id` tiebreaker.
- `recipe.repository.test.ts` / `recipe.service.test.ts` (database) —
  Published-only across a matrix of filter combinations including ones
  that match the Draft/Archived recipes' category and tags; pagination
  totals; facets exclude Inactive taxonomy and taxonomy with no Published
  recipes; featured excludes the featured Draft; Decimal → number mapping;
  `computeTotalTimeMinutes`; search provider results and hrefs.
- `search-extensions` — provider survives on `globalThis`; reset works.
- Route tests for both endpoints: 200 shape, bad params still 200, 500
  path.
- Shared components: `SortSelect` renders options/disabled state from
  props; `FilterDrawer` renders children. Existing product tests updated
  to the new import paths.

**E2E (Playwright, `tests/e2e/recipe-centre.spec.ts`)**

- `/recipes` renders the grid server-side (cards present in the initial
  HTML).
- Category chip + difficulty + dietary filter: URL reflects all three,
  every card matches, Back restores the previous state.
- A zero-result combination shows the empty state; "Clear filters"
  restores the full grid.
- Sort "Cook Time" orders cards by time ascending.
- Search box filters by title.
- Nav "Quick & Easy" lands on the mapped filters.
- Mobile viewport: the drawer opens and applies a filter.
- axe: desktop sidebar, open mobile drawer, category chips — no
  violations.
- Homepage shows 4 featured recipe cards linking to `/recipes/…`.
- Existing product listing e2e still passes.

## Documentation

- `docs/architecture-decisions.md` — a STORY-017 entry: recipe content
  model, category and dietary tag lists, the URL contract above (for
  STORY-018 related recipes and STORY-022 bookmarks), the total-time
  decision, `viewCount`/rating ownership (018/022), the shared
  `listing/` components, and `search-extensions` moving to `globalThis`.
- STORY-017 story file marked done, with the `time`/`diet` param rename
  noted.

## Out of scope

- Recipe detail page, ingredients, steps, product links, Recipe JSON-LD
  (STORY-018)
- Video recipes and the "Video Recipes" nav link (STORY-019)
- Recipe reviews, rating submission, bookmarking (STORY-022)
- Admin recipe builder and publishing workflow (STORY-043)
- AI / semantic search, ingredient search (STORY-061 / STORY-018)
- Infinite scroll (numbered pagination, matching products)
