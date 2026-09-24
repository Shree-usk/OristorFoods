# STORY-018 Recipe Detail Page — Design Decisions

The story's acceptance criteria and task list (`docs/stories/04-recipes-food-academy/STORY-018-recipe-detail-page.md`)
are already fully specified. This note resolves the handful of
implementation choices the story leaves open, and records the existing
codebase patterns this story reuses instead of reinventing.

## 1. Print view: CSS media query, not a separate route

The story offers both options. A separate `/recipes/[slug]/print` route would
need the currently-adjusted serving size passed through the URL (or
re-derived) to satisfy AC "respecting the currently adjusted serving size" —
extra plumbing for no benefit. Instead:

- `<Header />` and `<Footer />` in `src/app/(storefront)/layout.tsx` are
  wrapped in `print:hidden` (site-wide — no page currently defines print
  behavior, and hiding chrome on print is correct everywhere, not just here).
- The recipe page's own filter sidebar / related-recipes / share bar /
  breadcrumbs get `print:hidden` where they're not useful on paper.
- `RecipePrintShareBar`'s Print button calls `window.print()`. Because the
  print stylesheet runs against the live DOM, the serving-size adjuster's
  already-scaled quantities print as shown — no extra state threading.

## 2. Nutrition: flat fields on `Recipe`, not a sub-model

The story's own DB task lists flat field names first (`nutritionCalories`,
`nutritionProtein`, ...) with a sub-model as a parenthetical alternative.
Nutrition is inherent, one-to-one recipe data (not aggregate/computed like
`ProductRatingSummary`, which is a separate model because it's
transactionally recomputed from a child table). Flat nullable fields on
`Recipe` avoid an unneeded join and match STORY-017's existing flat-field
style on the same model.

## 3. Ingredient → product linking reuses the STORY-011 extension point

STORY-011 already pre-wired `registerRecipeSummaryProvider` /
`getRecipeSummary` in `src/services/product-detail-extensions.ts` for
exactly this story to fill in (the same pattern STORY-015/016 used for
`registerReviewSummaryProvider` / `registerQaSummaryProvider`). This
story:

- Implements `getRecipesByProductId(productId)` in `recipe.service.ts`.
- Registers it via `registerRecipeSummaryProvider` inside
  `registerRecipeProviders()` (already called from `src/instrumentation.ts`).

No new `/api/products/[productId]/recipes` REST route is needed — the
provider *is* "the underlying service method/API" the story's AC asks for,
consumed in-process by `product.service.ts`. This matches how reviews and
Q&A already expose their PDP summaries.

## 4. Share actions reuse and extend the existing `ShareButtons`

`src/components/storefront/product/share-buttons.tsx` already implements
copy-link, WhatsApp, Facebook, X, and email share for the PDP — exactly
what this story's AC asks for except the native Web Share API. Rather than
building a second share component:

- `ShareButtons` gains an additional native-share button, rendered only
  when `typeof navigator !== "undefined" && navigator.share` is truthy (feature
  detection; the button calls `navigator.share({ title, url })`).
- The recipe page imports and reuses this same component. Both PDP and
  recipe detail page benefit from the Web Share addition.
- `RecipePrintShareBar` is a thin wrapper that renders `ShareButtons` plus
  the print button, not a reimplementation of share logic.

## 5. Related recipes reuse `RecipeCard` from STORY-017

`src/components/storefront/recipes/recipe-card.tsx` already renders the
card shape (image, title, category, time, difficulty, rating) used by the
Recipe Centre grid. `RelatedRecipes` renders a `RecipeCard` per related
recipe — no new card component.

## 6. View count

The `Recipe.viewCount` field's existing schema comment says "Written by
STORY-018 (views)". `getRecipeBySlug` increments it (fire-and-forget,
non-blocking of the response) on every successful published-recipe fetch,
matching how the Recipe Centre's "Most Popular" sort already reads this
column.

## 7. Ingredient/step ordering

`RecipeIngredient.sortOrder` and `RecipeStep.stepNumber` are both plain
integers assigned at seed/authoring time; the repository always queries
with `orderBy` on these fields rather than relying on insertion order.

## 8. Serving-size scaling

Scaling is pure client-side arithmetic (no server round-trip, per the
story's own task list): `scaledQuantity = baseQuantity * (targetServings /
baseServings)`, rounded for display per the unit (whole numbers for count
units like "eggs", one decimal place otherwise). This lives in
`src/lib/recipe-scaling.ts` as a pure, unit-tested function so the
`ServingSizeAdjuster` component stays a thin UI shell.
