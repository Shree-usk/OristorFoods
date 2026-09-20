# STORY-012: Product Search & Discovery

**Status:** Done — see `src/repositories/search.repository.ts` for the
trigram-ranking query and `src/services/search.service.ts` for
`searchProducts()`/`getSearchSuggestions()`, and
`docs/superpowers/plans/2026-09-20-product-search-discovery.md` for the
full implementation record.
**Epic:** 03 — Product Platform
**Priority:** Medium
**Persona(s):** Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Busy Professional, I want to type a product name or ingredient and get accurate results even if I mistype, so that I don't waste time browsing categories.

As a Sri Lankan Expat, I want to search for products by their Sinhala/Tamil or English names and still find the right item, so that I can find familiar products by whichever name I remember.

As a Gourmet Food Enthusiast, I want search results I can further filter and sort, so that I can narrow a broad search down to exactly what I'm looking for.

## Description
This story implements the product-catalogue-specific search backend and results page: keyword matching, typo-tolerance, and relevance ranking over the data modelled in STORY-009. It is deliberately scoped apart from two related-but-different pieces of the platform: the header **Global Search** entry point (STORY-007, Epic 02), which is the UI chrome and cross-content-type search box, and the future **AI Smart Search** (STORY-061, Epic 08), which layers semantic/AI-driven query understanding on top. This story is the product-search engine and results experience those other stories call into and build upon — corresponding to `docs/blueprint.md` Section 4 ("Products (... Search)") and Section 9 item 3.

## Acceptance Criteria
- [x] `/products/search?q=<query>` renders a results page reusing STORY-010's listing UI (product grid, filter sidebar, sort, pagination) scoped to the search query
- [x] Search matches against product name, short/long description, ingredients, SKU, and category/collection names
- [x] Search is typo-tolerant (e.g. "currry" still returns curry products) via PostgreSQL trigram similarity or equivalent fuzzy matching
- [x] Results are ranked by relevance: exact/prefix name matches rank above description/ingredient matches, with a secondary boost for best-selling/highest-rated products
- [x] Filters and sort from STORY-010 apply on top of search results without losing the search query in the URL
- [x] A `searchProducts(query, { filters, sort, pagination })` function in `search.service.ts` is the single entry point both this page and the STORY-007 header search-suggestion dropdown can call
- [x] Search-as-you-type suggestions (top N product name/category matches) are exposed via a lightweight suggestions endpoint, ready for the STORY-007 header search box to consume without rebuilding ranking logic
- [x] Empty-result state suggests corrected spelling ("did you mean...") when a close trigram match exists, and/or suggests popular categories
- [x] Query input is debounced client-side to avoid excessive requests while typing
- [x] Every search request (query text + result count) is logged/emitted through a hook point intended for future analytics/AI consumption (STORY-061, STORY-064), without this story building any analytics UI itself
- [x] Only `Published` products are returned in results
- [x] Search results page sets an appropriate `metaTitle` (e.g. "Search results for '...'") and is marked `noindex` (search result pages should not be indexed by search engines)

## Tasks

- [x] **Database:**
  - [x] Enable the PostgreSQL `pg_trgm` extension (or equivalent) via a Prisma migration
  - [x] Add a `tsvector`/GIN index (or trigram indexes on the relevant columns) to support fast fuzzy/full-text search across `Product` name, description, and ingredients

- [x] **API:**
  - [x] `GET /api/products/search` route handler accepting `q`, filters, sort, and pagination params
  - [x] `GET /api/products/search/suggestions` lightweight endpoint returning top-N name/category matches for search-as-you-type

- [x] **Service/Backend:**
  - [x] Implement `search.service.ts` with `searchProducts()` and `getSearchSuggestions()`, composing a new `search.repository.ts` (or extending `product.repository.ts`) for the trigram/full-text queries
  - [x] Implement the relevance-ranking algorithm (match-field weighting + best-seller/rating boost) and document its scoring order
  - [x] Implement the "did you mean" correction lookup using trigram similarity against known product/category names
  - [x] Emit a query-logged event/hook (e.g. a typed function call, not a UI) for future analytics/AI consumption

- [x] **Frontend:**
  - [x] Build the search results page (`src/app/(storefront)/products/search/page.tsx`) reusing STORY-010 listing components
  - [x] Build a debounced search-suggestions hook consumable by the STORY-007 header search box
  - [x] Build the empty-result / "did you mean" state component

- [x] **Validation:**
  - [x] Zod schema for the search query param (minimum length, max length, sanitization) shared between the results page and the suggestions endpoint

- [x] **Testing:**
  - [x] Unit test ranking logic (exact match beats partial match beats description-only match)
  - [x] Unit test typo-tolerance against a known set of common misspellings
  - [x] Playwright e2e test: search a known product, confirm it appears in results; search a misspelled query, confirm "did you mean" surfaces the correct product

- [x] **Documentation:**
  - [x] Document the `searchProducts()`/`getSearchSuggestions()` contract so STORY-007 (header search) and future STORY-061 (AI Smart Search) know what to call versus what to replace

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — the data this story indexes and searches
- STORY-010 (Product Listing, Categories & Filters) — reused for the results page UI
- STORY-007 (Global Search) — the header entry point this story's suggestions endpoint feeds

## Out of Scope
- The header Global Search UI/box itself (STORY-007, Epic 02) — this story only provides the backend it calls
- AI/semantic Smart Search, natural-language query understanding, and personalized ranking (STORY-061, Epic 08)
- Search analytics dashboards (Epic 07/08) — this story only emits the underlying event hook

## References
- `docs/blueprint.md` Section 4 (Site Structure — Products, Search)
- `docs/blueprint.md` Section 5 (Core Feature Set — Commerce: catalogue, search)
- `docs/blueprint.md` Section 9 item 3 (Product Platform) and item 8 (AI Platform — Smart Search)
