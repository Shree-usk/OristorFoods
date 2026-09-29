# STORY-037: Saved Recipes & Sync

**Status:** Done — see the STORY-037 entry in `docs/architecture-decisions.md`.
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
- [x] `/account/saved-recipes` lists every recipe the logged-in customer has bookmarked, newest-bookmarked first, showing thumbnail, title, category, and time. *`RecipeCard` (reused as-is) has no standalone "prep time" field — the type carries `totalTimeMinutes` (prep+cook combined), the same field used everywhere else the card renders, so that's what's shown here too.*
- [x] Customer can remove a bookmark directly from this list; the removal is persisted through STORY-022's bookmark service, so the recipe immediately shows as unbookmarked on the recipe detail page and recipe listing/cards elsewhere on the site (single source of truth — no locally-diverging state). *`RecipeCard`'s own built-in bookmark button already does this — see `docs/architecture-decisions.md`.*
- [x] List supports filtering by recipe category and sorting by date-saved or alphabetically
- [x] List is paginated (or infinite-scroll) for customers with a large number of saved recipes. *A client-side "Show more" button, per the AC's own "(or infinite-scroll)" allowance — see architecture-decisions.md for why no new paginated API was built.*
- [x] Empty state ("You haven't saved any recipes yet") includes a CTA linking to the Recipe Centre (STORY-017)
- [x] The saved-recipes count shown as a quick-link widget on the Customer Dashboard (STORY-033) always matches the count on this page (both read from the same service, not independently cached/computed)
- [x] Bookmarking a recipe on one device/session and logging in on another device shows the same saved list — the data is server-persisted against the customer's account, not stored in `localStorage` or browser-only state *(already true of STORY-022's bookmark model for signed-in customers)*
- [x] Page reuses the existing recipe card component from the Recipes epic rather than introducing a second, diverging recipe-card implementation
- [x] Layout is responsive at 375px–1440px, consistent with recipe card styling used elsewhere on the site *(reuses `RecipeGrid`'s own responsive grid classes unmodified)*

## Tasks
- [x] **Database:** Added the one missing index, `@@index([customerId, createdAt])`, to STORY-022's `RecipeBookmark` model (the field is `customerId`, not `userId`) — no other schema change.
- [x] **API:** None new. `GET /api/recipes/bookmarks` and `POST`/`DELETE /api/recipes/[slug]/bookmark` (both STORY-022) already cover listing and unsave, and reusing them (rather than building the task list's suggested `/api/account/saved-recipes*` routes) is what makes cross-page sync automatic — see `docs/architecture-decisions.md`.
- [x] **Service:** `customer-saved-recipes.service.ts` — thin composition only, calling `recipe-bookmark.service.ts::listBookmarksForCustomer` (owned by STORY-022) for the listing query. `src/lib/saved-recipes-filter.ts::filterAndSortSavedRecipes` — a separate, client-safe pure function for category/sort (kept out of the service file so the Client Component using it doesn't pull Prisma into the browser bundle — see `docs/architecture-decisions.md`). `customer-dashboard.service.ts::getSavedRecipesCountForDashboard` (STORY-033's file) added for the dashboard widget. No new bookmarking business logic anywhere.
- [x] **Frontend:** `src/app/(storefront)/account/(dashboard)/saved-recipes/page.tsx`; reuses the existing `RecipeGrid`/`RecipeCard` components as-is; `saved-recipes-view.tsx` (client, filter/sort/show-more) under `src/components/storefront/account/`; new `saved-recipes-card.tsx` dashboard widget; nav-link additions to `account-nav.tsx`/`quick-links-card.tsx`.
- [x] **Validation:** None new — no new route/request boundary exists to validate. See `docs/architecture-decisions.md`.
- [x] **Testing:** `tests/e2e/saved-recipes.spec.ts` — empty state, a bookmark made from a recipe detail page appearing on `/account/saved-recipes` and the dashboard count, unsaving syncing back to both the page and the detail page, and category filtering. `customer-saved-recipes-service.test.ts` — the pure filter/sort function.
- [x] **Documentation:** `docs/architecture-decisions.md` documents the no-new-API/no-new-validation decision and every other deviation above.

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
