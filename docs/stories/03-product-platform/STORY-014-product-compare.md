# STORY-014: Product Compare

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** Low
**Persona(s):** Gourmet Food Enthusiast, Distributor

## User Story
As a Gourmet Food Enthusiast, I want to compare several products side by side on ingredients, nutrition, and price, so that I can decide which one best fits what I'm looking for.

As a Distributor, I want to compare products across brand, certifications, and pricing tier attributes, so that I can evaluate options for a bulk order.

## Description
This story implements the Product Compare feature referenced in `docs/blueprint.md` Section 4 ("Products (Categories, Product Details, Reviews, Compare, Search)") and Section 9 item 3. Customers can add up to a fixed number of products to a comparison tray from the listing grid or the Product Detail Page, then view them side by side across key attributes sourced from STORY-009's catalogue schema. This is a lightweight, mostly client-side feature — it does not introduce new persisted server-side state beyond a batch product-fetch endpoint.

## Acceptance Criteria
- [ ] A "Compare" control is available on `ProductCard` (STORY-010) and the Product Detail Page (STORY-011)
- [ ] Up to 4 products can be added to the compare tray at once; attempting to add a 5th prompts the user to remove one first (or offers to replace the oldest)
- [ ] The compare tray persists across navigation within the browser session (client-side state, e.g. Zustand), and is cleared explicitly by the user or on session end — not persisted server-side
- [ ] A compare tray indicator (with count) is visible while at least one product is selected, with quick access to the full compare page
- [ ] `/products/compare?ids=...` renders a side-by-side comparison of all selected products
- [ ] Comparison table/cards include at minimum: image, name, resolved price (via `pricing.service.ts`), nutrition facts, ingredients, allergens, certifications, brand, and average rating (rating gracefully omitted/zeroed if STORY-015 is not yet available)
- [ ] Individual products can be removed from the comparison view without leaving the page
- [ ] Comparison layout is responsive: a stacked/scrollable card layout on mobile, a table layout on desktop
- [ ] An empty state is shown if the compare page is loaded with zero or one product selected, prompting the user to add more products
- [ ] Selecting "Compare" on a product already in the tray is a no-op (no duplicate entries)

## Tasks

- [ ] **API:**
  - [ ] `GET /api/products/compare?ids=id1,id2,id3` route handler batch-fetching full comparison data for up to 4 product IDs

- [ ] **Service/Backend:**
  - [ ] Add `getProductsForCompare(productIds)` to `product.service.ts`, reusing STORY-009's repository and `pricing.service.ts` rather than duplicating catalogue-fetch logic

- [ ] **Frontend:**
  - [ ] Build the compare-tray Zustand store (session-scoped, max-4 enforcement, replace/prompt behavior)
  - [ ] Build the "Compare" toggle control shared by `ProductCard` and the PDP
  - [ ] Build the compare tray indicator/mini-drawer
  - [ ] Build the `/products/compare` page: responsive table/card comparison layout, per-item remove, empty state

- [ ] **Validation:**
  - [ ] Zod schema for the `ids` query param (max 4 valid product IDs, deduplicated)

- [ ] **Testing:**
  - [ ] Unit test the compare-tray store's max-4 and no-duplicate-entry behavior
  - [ ] Playwright e2e test: add 3 products from the listing grid, open compare, confirm all three render with correct attributes; remove one, confirm it drops from the view

- [ ] **Documentation:**
  - [ ] Document the compare-tray client-state shape and the `getProductsForCompare()` contract

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — attributes being compared
- STORY-010 (Product Listing, Categories & Filters) — `ProductCard` hosts the "Compare" control

## Out of Scope
- Persisting compare selections server-side or across devices/sessions
- Comparing more than 4 products at once
- Rating data if STORY-015 (Product Reviews & Ratings) has not shipped yet — comparison degrades gracefully without it

## References
- `docs/blueprint.md` Section 4 (Site Structure — Products: Compare)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
