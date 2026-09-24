# STORY-017: Recipe Centre & Listing

**Status:** Done
**Epic:** 04 — Recipes & Food Academy
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to browse a Recipe Centre with categories, filters, and sorting, so that I can quickly find recipes that match what I want to cook.
As a Busy Professional, I want to filter recipes by cook time and difficulty, so that I can find something realistic for a weeknight without reading every recipe individually.
As a Sri Lankan Expat, I want to browse recipes by cuisine/category, so that I can find authentic dishes that remind me of home.

## Description
This story delivers the customer-facing Recipe Centre landing/listing experience described in `docs/blueprint.md` Section 4 ("Recipes (Categories, Details, Video Recipes, Cooking Tips)") and Section 9 item 4 ("Recipes & Food Academy"). It covers the recipe data model (read side), the category taxonomy, the browse/filter/sort UI, and the recipe card grid that customers land on from the primary navigation ("Recipes") and from homepage "Featured Recipes." It is the entry point into all recipe content built in the rest of this epic (STORY-018 detail pages, STORY-019 video recipes, STORY-022 reviews/bookmarks) and sits alongside the admin-side recipe authoring workflow (Epic 07, STORY-043) which produces the data this page reads.

## Acceptance Criteria
- [x] `/recipes` route renders a paginated (or infinite-scroll) grid of published recipe cards, each showing hero image, title, category, cook time, difficulty badge, and average rating
- [x] Recipes are organized into categories (e.g. Curries, Rice & Grains, Sweets & Desserts, Beverages, Snacks, Sambols & Condiments) sourced from a `RecipeCategory` model, with a category chip/tab row above the grid
- [x] Customers can filter recipes by: cuisine/category, difficulty (Easy/Medium/Hard), cook time range (e.g. under 15 / 15–30 / 30–60 / 60+ min), and dietary tags (e.g. Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Spicy)
- [x] Multiple filters can be combined simultaneously (AND logic) and the active filter set is reflected in the URL query string so results are shareable/bookmarkable and support browser back/forward
- [x] Customers can sort results by: Newest, Most Popular (views or saves), Highest Rated, and Cook Time (ascending)
- [x] A text search box on the Recipe Centre filters by recipe title/ingredient keyword (client-side or API-backed; full AI-powered smart search is out of scope, see STORY-061)
- [x] Only recipes with `status = PUBLISHED` are ever returned to the storefront API/queries — draft/in-review/archived recipes (owned by the admin workflow in STORY-043) are excluded
- [x] Empty state is shown when a filter combination returns zero recipes, with a "clear filters" action
- [x] Recipe card grid, category tabs, and filter panel are fully responsive (mobile: filters collapse into a sheet/drawer; desktop: filters shown as a sidebar) and meet WCAG 2.1 AA contrast/keyboard-navigation requirements
- [x] Page achieves Lighthouse score >95 and initial recipe list data is server-rendered (Next.js Server Component) for fast first paint and SEO per `docs/blueprint.md` Section 6
- [x] Each recipe card links to its detail page at `/recipes/[slug]` (built in STORY-018)

## Tasks

> Implemented with `time` (total-time ranges) and `diet` (dietary tag slugs) in place of `cookTimeMax` and `dietaryTags[]`. See the STORY-017 entry in `docs/architecture-decisions.md`. Search covers title and short description; ingredient search follows STORY-018's ingredient data.

- [x] **Database:**
  - [x] Define `Recipe` Prisma model (read-relevant fields for this story): `id`, `slug`, `title`, `heroImageUrl`, `categoryId`, `cuisineTag`, `difficulty` (enum: EASY/MEDIUM/HARD), `prepTimeMinutes`, `cookTimeMinutes`, `totalTimeMinutes`, `servings`, `dietaryTags` (string array or join table), `status` (enum: DRAFT/IN_REVIEW/APPROVED/PUBLISHED/ARCHIVED), `viewCount`, `avgRating`, `publishedAt`, `createdAt`, `updatedAt`
  - [x] Define `RecipeCategory` model (`id`, `name`, `slug`, `description`, `iconUrl`, `sortOrder`)
  - [x] Define `DietaryTag` lookup model or enum, with a many-to-many join table `RecipeDietaryTag` if modeled relationally
  - [x] Add indexes on `Recipe.status`, `Recipe.categoryId`, `Recipe.slug` (unique), and a composite index supporting the common filter+sort query patterns
  - [x] Write a Prisma migration and seed data (at least 15–20 sample recipes across categories/difficulties/dietary tags) for local development and Playwright fixtures

- [x] **API:**
  - [x] `GET /api/recipes` — list endpoint accepting query params: `category`, `difficulty`, `cookTimeMax`, `dietaryTags[]`, `sort`, `search`, `page`, `pageSize`; returns paginated recipe cards + total count
  - [x] `GET /api/recipes/categories` — returns the category taxonomy for the tab/chip row
  - [x] Both endpoints call the Service Layer only (no direct Prisma in route handlers) and enforce `status = PUBLISHED` at the service/repository level, not just the UI

- [x] **Service/Backend:**
  - [x] `recipe.service.ts`: `listRecipes(filters, sort, pagination)`, `listRecipeCategories()`
  - [x] `recipe.repository.ts`: Prisma queries encapsulating the filter/sort/pagination logic; the only file in the module allowed to import Prisma directly
  - [x] Implement combinable filter logic (category + difficulty + cook time + dietary tags) as a single composed `where` clause builder, unit-testable independent of Prisma

- [x] **Frontend:**
  - [x] `src/app/(storefront)/recipes/page.tsx` — Server Component that reads searchParams, calls the service, and renders the initial grid
  - [x] `src/components/storefront/recipes/RecipeCard.tsx`, `RecipeCategoryTabs.tsx`, `RecipeFilterPanel.tsx` (mobile sheet + desktop sidebar variants), `RecipeSortSelect.tsx`, `RecipeGrid.tsx`, `RecipeSearchBox.tsx`
  - [x] Wire filter/sort state to the URL query string (e.g. via `useSearchParams`/`useRouter` or `nuqs`) so state is shareable and shallow-navigable without full reload
  - [x] Use TanStack Query for client-side re-fetching on filter/sort change after the initial server render; Skeleton loading state for the grid
  - [x] Empty-state component with "clear filters" CTA

- [x] **Validation:**
  - [x] Zod schema for the `/api/recipes` query params (enumerate valid `sort` values, `difficulty` enum, cap `pageSize`)
  - [x] Reject/ignore unknown dietary tag values rather than erroring, to keep the UI resilient to stale bookmarked URLs

- [x] **Testing:**
  - [x] Unit tests (Vitest) for the filter/sort query-builder logic in `recipe.service.ts`
  - [x] Unit tests confirming non-published recipes are never returned regardless of filter combination
  - [x] Playwright e2e: load `/recipes`, apply a category + difficulty + dietary filter combo, confirm URL reflects state and grid updates; test empty-state; test sort order changes results
  - [x] Accessibility test pass (axe) on the filter panel (mobile sheet and desktop sidebar) and category tabs

- [x] **Documentation:**
  - [x] Document the `RecipeCategory` taxonomy and dietary tag list in `docs/architecture-decisions.md` (or a dedicated content-model note) so admin content editors (STORY-043) and this storefront story stay in sync
  - [x] Document the URL query-param contract (filter/sort param names) so STORY-018 "related recipes" and STORY-022 bookmarking can link back into pre-filtered views consistently

## Dependencies
- STORY-001 (Project Foundation Setup) — Next.js/Prisma/TypeScript base must exist
- STORY-002 (Design System & Theming) — card, tab, badge, and filter components should use the shared design tokens
- STORY-003 (Global Layout & Responsive Framework) — page renders inside the shared storefront layout/shell
- STORY-009 (Product Catalogue Data Model) — recipe cards and detail pages will eventually cross-link to products ("recipes using this product"); the product slug/ID reference shape should match what STORY-009 defines

## Out of Scope
- Recipe authoring, draft/review/approval workflow (belongs to Epic 07 STORY-043 "Admin Recipes Workflow")
- Recipe detail page rendering (STORY-018)
- Video playback and cooking tips content type (STORY-019)
- AI-powered smart/semantic search (STORY-061)
- Recipe reviews, ratings submission, and bookmarking (STORY-022)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Recipes)
- `docs/blueprint.md` Section 5 (Content: recipes)
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/folder-structure.md` (`src/app/(storefront)/recipes/`, `src/services/recipe.service.ts`, `src/repositories/recipe.repository.ts`)
