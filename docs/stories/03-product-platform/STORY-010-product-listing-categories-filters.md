# STORY-010: Product Listing, Categories & Filters

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Distributor

## User Story
As a Home Cook, I want to browse products by category and collection with filters and sorting, so that I can quickly find what I need for tonight's meal.

As a Busy Professional, I want listing pages to load fast with clear pagination, so that I don't waste time scrolling through irrelevant products.

As a Distributor, I want to filter the catalogue by attributes relevant to bulk purchasing (brand, certifications), so that I can build a shortlist before requesting wholesale pricing.

## Description
This story delivers the customer-facing browse experience for the catalogue built in STORY-009: category landing pages, collection pages, filter and sort controls, and pagination. It corresponds to `docs/blueprint.md` Section 4 ("Products (Categories, Product Details, Reviews, Compare, Search)") and Section 9 item 3, which calls the Product Platform epic "done when customers can browse and discover products." This story covers browse/filter only — free-text search is STORY-012, and the Product Detail Page itself is STORY-011.

## Acceptance Criteria
- [ ] `/products` renders the full catalogue with category/collection navigation entry points
- [ ] `/products/[category-slug]` renders a category landing page listing only `Published` products in that category (and its subcategories, per STORY-009's nested category model)
- [ ] `/products/collections/[collection-slug]` renders a collection page, correctly excluding collections outside their `startDate`/`endDate` window
- [ ] Filter controls exist for: category, price range, allergen/dietary tags, certifications, brand, and availability (in stock / out of stock)
- [ ] Sort controls exist for: price ascending/descending, newest, best-selling, and average rating
- [ ] Selected filters and sort order and current page are reflected in the URL query string, so listing states are shareable and bookmarkable
- [ ] Pagination (or infinite scroll) works correctly at catalogue boundaries (first page, last page, zero results)
- [ ] A reusable `ProductCard` component is used across the listing grid and is built so STORY-011 (related/recently viewed), STORY-012 (search results), and STORY-014 (compare) can reuse it rather than rebuilding
- [ ] Product price shown on each card comes from `pricing.service.ts` `resolvePrice()` (STORY-009), using the `Retail` customer group for anonymous/guest visitors
- [ ] Listing data is fetched with TanStack Query using query keys that vary by category/collection/filters/sort/page, so cached pages don't leak into each other
- [ ] Loading state shows skeleton cards; zero-result state shows an explicit "no products match your filters" message with a control to clear filters
- [ ] Category and collection pages set `metaTitle`/`metaDescription`/canonical URL from STORY-009's SEO fields, and emit `ItemList` JSON-LD structured data
- [ ] Filter UI is keyboard-navigable and filter controls (checkboxes, range inputs, sort `<select>`) expose correct ARIA roles/labels
- [ ] Layout is responsive per the design system: filter sidebar on desktop, filter drawer/sheet on mobile, matching the responsive framework from STORY-003

## Tasks

- [ ] **API:**
  - [ ] `GET /api/products` route handler accepting category/collection/filter/sort/page query params, calling `product.service.ts` — never Prisma directly
  - [ ] Route handler returns pagination metadata (total count, page, pageSize, hasNextPage)

- [ ] **Service/Backend:**
  - [ ] Extend `product.service.ts` with a `listProducts(filters, sort, pagination)` function composing repository queries from STORY-009
  - [ ] Ensure only `Published` products and in-window collections are returned to storefront callers

- [ ] **Frontend:**
  - [ ] Build category landing page (`src/app/(storefront)/products/[category]/page.tsx`) and collection page route
  - [ ] Build `ProductCard`, `FilterSidebar`/`FilterDrawer`, `SortSelect`, and `Pagination` components under `src/components/storefront/`
  - [ ] Wire URL query-string state (e.g. via `useSearchParams`/`nuqs`-style pattern) to filters, sort, and page
  - [ ] Wire TanStack Query hooks (`useProductListing`) with query keys derived from the current filter/sort/page state

- [ ] **Validation:**
  - [ ] Add a Zod schema validating the listing query params (page bounds, allowed sort values, filter value shapes) shared between the route handler and the frontend query hook

- [ ] **Testing:**
  - [ ] Unit test `listProducts()` filter/sort composition logic
  - [ ] Playwright e2e test: apply a filter, change sort, paginate, and confirm the URL and rendered results update correctly
  - [ ] Accessibility check (axe or equivalent) on the filter drawer/sidebar

- [ ] **Documentation:**
  - [ ] Document the listing query-param contract (filters/sort/pagination shape) so STORY-012 (search) can reuse the same result-rendering components

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — provides the schema, repository, and pricing service this story queries

## Out of Scope
- Free-text/keyword search and typo-tolerance (STORY-012)
- Product Detail Page (STORY-011)
- Admin-side category/collection management UI (STORY-040, Epic 07)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Products)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
- `.claude/skills/add-product-page/SKILL.md`
