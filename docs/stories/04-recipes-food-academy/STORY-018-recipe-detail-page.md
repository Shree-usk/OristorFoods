# STORY-018: Recipe Detail Page

**Status:** Done
**Epic:** 04 — Recipes & Food Academy
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to view a recipe's full ingredients and step-by-step method with the products I need linked directly, so that I can cook the dish and buy anything I'm missing without leaving the page.
As a Busy Professional, I want to adjust the serving size and see nutrition info at a glance, so that I can quickly judge whether the recipe fits my meal plan.
As a Gourmet Food Enthusiast, I want to read chef notes and see related recipes, so that I can deepen my technique and discover what to cook next.

## Description
This story builds the customer-facing, read-only Recipe Detail Page reached from the Recipe Centre grid (STORY-017) and from product pages ("recipes using this product," `docs/blueprint.md` Section 4). It renders ingredients (with links to the Product Catalogue), method steps, nutrition, chef notes, a serving-size adjuster, print/share actions, and related recipes. This story is strictly the rendering and data-fetching layer for published recipes — the recipe *authoring* experience (draft → review → approval → publish, step/ingredient/nutrition/video/chef-notes editor) is owned by Epic 07's "Admin Recipes Workflow" (STORY-043) and is explicitly out of scope here.

_STORY-043 owns the authoring UI that populates every field this page reads (ingredients, steps, nutrition, chef notes, product links, gallery images)._

## Acceptance Criteria
- [x] `/recipes/[slug]` renders a single published recipe: hero image/gallery, title, category, cuisine tag, difficulty, prep/cook/total time, servings, dietary tags
- [x] Ingredients list renders each ingredient's quantity, unit, and name; ingredients that map to an Oristor product render as a link to that product's detail page (`/products/[slug]`) using the product reference defined by the Product Catalogue (STORY-009); ingredients with no matching product render as plain text
- [x] Step-by-step method renders as a numbered sequence, with any per-step images shown inline
- [x] Nutrition info panel renders (calories, macros, and any additional nutrition fields captured by the recipe model) per serving
- [x] Chef notes / tips section renders when present, visually distinct from the main method steps
- [x] Serving-size adjuster lets the customer scale servings up/down (e.g. stepper or input); ingredient quantities recalculate proportionally in the UI without a full page reload; nutrition values scale accordingly
- [x] Print action opens a print-friendly view/stylesheet containing ingredients + method (respecting the currently adjusted serving size) without site chrome (nav/footer/ads) _(done via print CSS on the main page, not a separate route)_
- [x] Share action exposes at least: copy link, and native Web Share API where supported, plus direct share links (e.g. WhatsApp, Facebook) consistent with the brand's social presence
- [x] "Related recipes" section shows 3–6 recipes sharing category/cuisine/dietary tags, each linking to its own detail page (reuses `RecipeCard` from STORY-017)
- [x] A "Recipes using this product" style reverse link is supported: given a product slug/ID, the product detail page (STORY-011, out of scope here) can query recipes referencing it — this story exposes the underlying service method/API that makes that possible _(via `registerRecipeSummaryProvider`, no public route)_
- [x] Requesting a slug that does not exist or is not `PUBLISHED` returns a proper 404 (Next.js `notFound()`), never a raw error or a draft/unapproved recipe
- [x] Page includes recipe structured data (schema.org `Recipe` JSON-LD: ingredients, instructions, nutrition, ratings, time) for SEO rich results
- [x] Page is a Server Component with server-rendered initial content for SEO/performance; serving-size adjuster and share actions are isolated Client Components
- [ ] Meets Lighthouse >95 and WCAG 2.1 AA (keyboard-navigable serving adjuster, accessible print/share buttons with labels) _(not measured yet)_

## Tasks

- [x] **Database:**
  - [x] Extend the `Recipe` model (introduced in STORY-017) with detail-page fields: `chefNotes` (rich text/markdown), `nutritionCalories`, `nutritionProtein`, `nutritionCarbs`, `nutritionFat`, `nutritionFiber`, `nutritionSodium` (or a structured `RecipeNutrition` sub-model), `galleryImageUrls`
  - [x] Define `RecipeIngredient` model: `id`, `recipeId`, `productId` (nullable FK to `Product`), `quantity`, `unit`, `displayText`, `sortOrder`
  - [x] Define `RecipeStep` model: `id`, `recipeId`, `stepNumber`, `instruction`, `imageUrl` (nullable)
  - [x] Add FK relation from `RecipeIngredient.productId` to the `Product` model owned by STORY-009; confirm nullable so ingredients without a catalogue match remain valid
  - [x] Migration + seed data updates so seeded recipes have realistic ingredients (some linked to seeded products, some not), multi-step methods, and nutrition values

- [x] **API:**
  - [x] `GET /api/recipes/[slug]` — returns full recipe detail payload (ingredients with resolved product summary, steps, nutrition, chef notes, related recipes) for `PUBLISHED` recipes only
  - [x] `GET /api/products/[productId]/recipes` (or equivalent service method consumed by STORY-011) — returns recipes referencing a given product, for the "recipes using this product" reverse link _(via `registerRecipeSummaryProvider`, no public route)_

- [x] **Service/Backend:**
  - [x] `recipe.service.ts`: `getRecipeBySlug(slug)` (throws/returns null for missing or non-published → maps to 404), `getRelatedRecipes(recipeId)`, `getRecipesByProductId(productId)`
  - [x] `recipe.repository.ts`: Prisma queries with `include` for ingredients (+ product summary), steps, nutrition, category
  - [x] Serving-size scaling logic implemented client-side from the base recipe's `servings` and ingredient quantities (no server round-trip needed) — expose the base data in a shape the client can scale cleanly (numeric quantity + unit, not pre-formatted strings, where possible)

- [x] **Frontend:**
  - [x] `src/app/(storefront)/recipes/[slug]/page.tsx` — Server Component; calls `notFound()` for missing/unpublished slugs; generates `generateMetadata` for SEO and injects `Recipe` JSON-LD
  - [x] `src/components/storefront/recipes/RecipeHero.tsx`, `IngredientsList.tsx`, `MethodSteps.tsx`, `NutritionPanel.tsx`, `ChefNotes.tsx`, `ServingSizeAdjuster.tsx` (Client Component), `RecipePrintShareBar.tsx` (Client Component), `RelatedRecipes.tsx`
  - [x] `src/app/(storefront)/recipes/[slug]/print/page.tsx` or a print-specific CSS media-query stylesheet toggled from the print button _(done via print CSS on the main page, not a separate route)_
  - [x] Ingredient-to-product linking renders via a small `IngredientLink` component that falls back to plain text gracefully when `productId` is null

- [x] **Validation:**
  - [x] Zod schema validating the `[slug]` route param shape before hitting the service (defensive, since slugs are user-navigable/typeable)
  - [x] Guard serving-size input (client) to a sane numeric range (e.g. 1–50) to prevent absurd scaling

- [x] **Testing:**
  - [x] Unit tests for the serving-size scaling calculation (quantities and nutrition scale correctly, including fractional/rounding edge cases)
  - [x] Unit tests confirming `getRecipeBySlug` returns null/throws for DRAFT/IN_REVIEW/ARCHIVED recipes
  - [x] Playwright e2e: visit a recipe detail page, adjust servings, confirm ingredient quantities update; click an ingredient with a linked product and confirm navigation to the product page; trigger print view; verify related recipes render and link correctly
  - [x] Playwright/e2e test for 404 behavior on an unpublished or nonexistent slug
  - [x] Accessibility test pass (axe) on the serving adjuster and print/share controls

- [x] **Documentation:**
  - [x] Document the `RecipeIngredient.productId` linking convention and the reverse "recipes by product" query in `docs/architecture-decisions.md`, since both STORY-011 (Product Detail Page) and STORY-043 (Admin Recipes Workflow) depend on this shape being stable
  - [x] Note in the story/architecture doc that STORY-043 owns the authoring UI that populates all fields this story reads

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-009 (Product Catalogue Data Model) — required for the `RecipeIngredient.productId` FK and "recipes using this product" linking
- STORY-017 (Recipe Centre & Listing) — provides the `Recipe`/`RecipeCategory` base model, `RecipeCard`, and the routing this page is reached from

## Out of Scope
- Recipe authoring/editing UI and the draft → review → approval → publish workflow (Epic 07, STORY-043 "Admin Recipes Workflow")
- Video recipe playback (STORY-019)
- Recipe rating/review submission and bookmarking (STORY-022)
- Rendering the reverse "recipes using this product" block on the product page itself (STORY-011 consumes the API/service built here)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Recipes; Product Detail Page "recipes using the product")
- `docs/blueprint.md` Section 5 (Content: recipes)
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/blueprint.md` Section 7 (Admin Console — Recipes module, for context on what NOT to build here)
- `docs/folder-structure.md`
