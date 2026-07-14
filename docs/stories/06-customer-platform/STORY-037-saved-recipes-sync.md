# STORY-037: Saved Recipes & Sync

**Status:** Draft
**Epic:** 06 — Customer Platform
**Priority:** Low
**Persona(s):** Home Cook, Gourmet Food Enthusiast, Sri Lankan Expat

## User Story
As a Home Cook, I want to see every recipe I've bookmarked in one place in my account, so that I can find them again without re-searching the Recipe Centre.

As a Gourmet Food Enthusiast, I want to remove a recipe from my saved list directly from my account, and have it reflect immediately wherever else that recipe is shown, so that my saved list is never out of date.

As a Sri Lankan Expat, I want the recipes I save on one device to show up when I sign in on another, so that my saved list follows me, not the browser.

## Description
This story is the account-area presentation layer for the recipe bookmarking mechanism built in STORY-022 (Recipe Reviews & Bookmarks). It adds `/account/saved-recipes` under the account shell from STORY-033, and a "Saved Recipes" count on the Customer Dashboard's quick links. It deliberately does not build a new bookmark data model, a new toggle mechanism, or new save/unsave business logic — all of that is owned by STORY-022. This story only lists, filters, paginates, and unsaves against the model STORY-022 already exposes. Maps to `docs/blueprint.md` Section 4 (Recipes) and Section 9 item 6 (Customer Platform — "saved recipes" listed as part of self-service completeness).

## Acceptance Criteria
- [ ] `/account/saved-recipes` lists every recipe the logged-in customer has bookmarked, newest-bookmarked first, showing thumbnail, title, category, and prep time
- [ ] Customer can remove a bookmark directly from this list; the removal is persisted through STORY-022's bookmark service, so the recipe immediately shows as unbookmarked on the recipe detail page and recipe listing/cards elsewhere on the site (single source of truth — no locally-diverging state)
- [ ] List supports filtering by recipe category and sorting by date-saved or alphabetically
- [ ] List is paginated (or infinite-scroll) for customers with a large number of saved recipes
- [ ] Empty state ("You haven't saved any recipes yet") includes a CTA linking to the Recipe Centre (STORY-017)
- [ ] The saved-recipes count shown as a quick-link widget on the Customer Dashboard (STORY-033) always matches the count on this page (both read from the same service, not independently cached/computed)
- [ ] Bookmarking a recipe on one device/session and logging in on another device shows the same saved list — the data is server-persisted against the customer's account, not stored in `localStorage` or browser-only state
- [ ] Page reuses the existing recipe card component from the Recipes epic rather than introducing a second, diverging recipe-card implementation
- [ ] Layout is responsive at 375px–1440px, consistent with recipe card styling used elsewhere on the site

## Tasks
- [ ] **Database:** None new. This story reuses the bookmark/save model owned by STORY-022. Its only database task is confirming (or adding, if missing) an index on `(userId, createdAt)` on that model so this page's paginated, newest-first query is efficient — that index change belongs to STORY-022's schema, coordinated here since this is the consumer that needs it.
- [ ] **API:** `GET /api/account/saved-recipes` (paginated, filterable by category, sortable), `DELETE /api/account/saved-recipes/[recipeId]` (unbookmark) — both routes delegate to STORY-022's bookmark service rather than querying the bookmark table directly.
- [ ] **Service:** `customer-saved-recipes.service.ts` — thin composition only, calling `recipe-bookmark.service.ts` (owned by STORY-022) for both the listing query and the unsave action. No new bookmarking business logic is introduced in this story.
- [ ] **Frontend:** `src/app/(storefront)/account/saved-recipes/page.tsx`; reuse the existing `RecipeCard` component (from the Recipes & Food Academy epic) inside an account-scoped grid; `SavedRecipesFilterBar` under `src/components/storefront/account/`.
- [ ] **Validation:** `src/validation/account/saved-recipes-query.schema.ts` (category filter, sort, and pagination query params).
- [ ] **Testing:** Playwright e2e verifying a bookmark made from a recipe detail page appears on `/account/saved-recipes`, and that unsaving from either location keeps both in sync within the same session; Vitest unit test for the filter/sort/pagination query builder.
- [ ] **Documentation:** Note in `docs/architecture-decisions.md` that saved-recipes is a read-and-unsave view over STORY-022's bookmark model — any new bookmark fields or save-source tracking must be added in STORY-022, not duplicated here.

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-033 (Customer Dashboard) — provides the auth-guarded account shell this page nests inside and the quick-link count it must stay consistent with
- STORY-022 (Recipe Reviews & Bookmarks) — owns the bookmark data model and the save/unsave toggle mechanism this story reads and calls; this story cannot start meaningfully until STORY-022's bookmark service exists

## Out of Scope
- The bookmark/save toggle button on recipe cards and the recipe detail page itself (STORY-022)
- Recipe recommendations based on saved recipes (AI Platform epic — STORY-060/STORY-062)
- Organizing saved recipes into folders/collections (not in current scope; a possible future enhancement)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Recipes)
- `docs/blueprint.md` Section 9 item 6 (Customer Platform)
- `docs/folder-structure.md` (`src/app/(storefront)/account/`)
