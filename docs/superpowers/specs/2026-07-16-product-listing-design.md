# STORY-010: Product Listing, Categories & Filters — Design

**Date:** 2026-07-16
**Story:** `docs/stories/03-product-platform/STORY-010-product-listing-categories-filters.md`
**Status:** Approved, ready for implementation planning

## Purpose

Customer-facing browse experience built on STORY-009's catalogue data model:
`/products`, category landing pages, collection landing pages, filters, sort,
pagination, and a reusable `ProductCard`. Free-text search (STORY-012) and the
Product Detail Page (STORY-011) are out of scope.

## Decisions Made This Session

These were the genuinely open questions in STORY-010's acceptance criteria
(everything else in this design follows directly from the AC as written):

| Decision | Choice | Why |
|---|---|---|
| Pagination vs. infinite scroll | Classic numbered pagination, `page` query param | AC requires shareable/bookmarkable URL state and explicit first/last/zero-result boundary behavior — both fit numbered pagination more directly than infinite scroll. |
| URL state library | Add `nuqs` | Story doc itself names a "nuqs-style pattern"; purpose-built for typed App Router search-param state, less hand-rolled parsing/serialization code than a manual `useSearchParams` hook. |
| `ProductCard` data shape | Extend the existing `ProductCardData` (`src/types/home.ts`) with `inStock: boolean`, rather than a new independent type | `src/types/home.ts` already documents `ProductCardData` as the intended contract for when STORY-009/010 land with real data, so the homepage teasers (STORY-006) can later swap fixtures for real queries without a props rewrite. This story does not touch the homepage teaser components themselves. |
| `best-selling` / `average rating` sort | Implement the UI/URL contract now; both values silently resolve to `newest` ordering server-side | No Order model (Commerce Platform epic) or reviews/ratings data (STORY-015) exists yet to sort by. Shipping the final option set now means STORY-015/Commerce only need to swap the query, not the contract. Rendered as disabled options with a "coming soon" affordance rather than removed from the UI. |
| `inStock` availability filter | Add `inStock Boolean @default(true)` directly to `Product` now | Unlike sales-count/rating, stock status is a plausible admin-set flag today (matches the Admin Console principle — manageable without a redeploy) and needs no other epic's data first. |
| Price range filter control | Twin min/max number inputs, not a dual-thumb slider | Simpler, more keyboard/screen-reader accessible than a slider, no new interaction pattern to build and test. |
| Rendering architecture | Server Component fetches + renders first page via `product.service.ts` directly; client `ProductGrid` island hydrates with that data as TanStack Query `initialData` and owns subsequent filter/sort/page refetches against `GET /api/products` | CLAUDE.md mandates Server Components by default and non-optional SEO. A fully client-rendered listing (rejected alternative) would leave the mandatory `ItemList` JSON-LD invisible to non-JS crawlers on first load. A fully static/client-filtered listing (rejected alternative) can't support server-side pagination at catalogue scale. |

## Routing

- `src/app/(storefront)/products/page.tsx` — full catalogue, all categories/collections as nav entry points, no scope filter applied server-side beyond `status: Published`
- `src/app/(storefront)/products/[category]/page.tsx` — category landing; includes the category's subcategories per STORY-009's nested `Category` model
- `src/app/(storefront)/products/collections/[collection]/page.tsx` — collection landing; 404s if the collection exists but is outside its `startDate`/`endDate` window (treated as not-found, not as an empty page)

Each of the three routes:

1. Reads and validates `searchParams` (filters/sort/page) against one shared Zod
   schema (`src/validation/product-listing.schema.ts`); invalid/malformed
   values fall back to schema defaults rather than erroring.
2. Calls `product.service.ts`'s `listProducts()` directly (no self-HTTP call
   to the app's own API).
3. Renders the first page of results as real HTML, plus `ItemList` JSON-LD and
   `metaTitle`/`metaDescription`/canonical URL sourced from the
   category/collection's STORY-009 SEO fields.
4. Passes the result into a client `<ProductGrid>` as TanStack Query
   `initialData`. Query key: `["products", scope, filters, sort, page]`,
   where `scope` is `{all}` / `{category: slug}` / `{collection: slug}`, so
   cached pages never leak across scopes.
5. Any filter/sort/page change updates the URL via `nuqs` (shallow) and
   triggers a client refetch against `GET /api/products`, which accepts
   `category`/`collection`/filter/sort/page params and itself calls the same
   `listProducts()`. On `[category]`/`collections/[collection]` pages, the
   route param is not duplicated into the URL query string — the client
   `ProductGrid` reads its scope from a prop passed down by the Server
   Component and includes it as a `category`/`collection` param only in the
   *internal* fetch call to `/api/products`, never reflected back into the
   page's own URL.

## Schema Changes

Additive migration on STORY-009's `Product` model:

```prisma
inStock Boolean @default(true)
```

Add `@@index([status, inStock])` alongside the existing `@@index([status])`,
since every storefront listing query filters on both.

## Service Layer

`product.service.ts` gains:

```ts
listProducts(params: {
  categorySlug?: string;      // includes subcategories
  collectionSlug?: string;    // only if within date window
  filters: {
    priceMin?: number; priceMax?: number;
    allergens?: string[]; certifications?: string[]; brands?: string[];
    inStock?: boolean;
  };
  sort: "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";
  page: number; pageSize: number;
}): Promise<{
  items: ProductListItem[]; total: number; page: number;
  pageSize: number; hasNextPage: boolean;
}>
```

- Always filters `status: Published` — storefront callers never see other
  statuses, matching STORY-009's established service-layer rule.
- `sort: "best-selling" | "rating"` falls back to `"newest"` ordering; the
  fallback is a one-line comment marking the STORY-015/Commerce hook point.
- Price resolution avoids N+1: the repository fetches raw price rows for the
  whole result page in one query (not per-product), and `listProducts()`
  resolves each product's price in-memory using the same priority logic as
  `pricing.service.ts`'s `resolvePrice()` (reused as a pure function, not
  re-run as separate DB round-trips per product).

## Validation

`src/validation/product-listing.schema.ts` — one Zod schema validating `page`
(positive int, default 1), `pageSize` (positive int, default 24, max 60),
`sort` (enum, default `newest`), and every filter field. Shared verbatim by
the API route handler, the Server Components' `searchParams` parsing, and the
client `nuqs` parsers, so there is exactly one definition of valid query
state.

## Components

`src/components/storefront/product/` (new directory):

- **`product-card.tsx`** — props satisfy `ProductCardData` (`src/types/home.ts`)
  plus `inStock`. Receives an already-resolved price; contains no pricing
  logic itself. Out-of-stock products render a dimmed image and an
  "Out of stock" badge in place of the price.
- **`product-grid.tsx`** — client component; owns the TanStack Query hook,
  renders the responsive `ProductCard` grid, the loading-skeleton state, and
  the zero-result "no products match your filters" state with a
  clear-filters control.
- **`filter-sidebar.tsx`** / **`filter-drawer.tsx`** — share one inner
  `<FilterControls>` (checkboxes for category/allergen/certification/brand,
  twin min/max price inputs, an in-stock toggle). `filter-sidebar.tsx` is the
  desktop `<aside>`; `filter-drawer.tsx` wraps the same controls in the
  existing `Sheet` primitive for mobile. No duplicated filter-rendering logic.
- **`sort-select.tsx`** — wraps a new Shadcn `Select` primitive (not yet
  present in `src/components/ui/`). `best-selling`/`rating` render as
  disabled options with a "coming soon" affordance.
- **`pagination.tsx`** — numbered controls + prev/next, correct disabled
  states at first/last page.

**New Shadcn primitives to add:** `checkbox`, `select`.

**URL state:** one `useProductListingParams()` hook built on `nuqs`'s
`useQueryStates`, defining parsers once and shared by both the server-side
`searchParams` parsing and the client hook, so both sides agree on
defaults/shapes. `category`/`collection` stay route params, not query params
— only filters/sort/page live in the query string.

## Error Handling

- Out-of-range `page` (beyond last page, zero, negative): schema
  clamps/rejects at the boundary; service returns the nearest valid page's
  data and the pagination UI reflects the corrected page in the URL, rather
  than crashing or silently rendering nothing.
- Zero results with valid filters: explicit empty state, not a blank grid.
- Malformed query params (garbage `sort` value, non-numeric `priceMin`):
  Zod schema substitutes defaults; the request still returns 200, since a
  broken filter link from elsewhere shouldn't break the page for the visitor
  who clicked it.
- Collection outside its date window: 404, matching STORY-009's "in-window
  only" rule rather than showing an expired collection page.

## Accessibility

- Filter checkboxes/inputs: `<label>` association, `fieldset`/`legend`
  grouping per filter category.
- `sort-select.tsx`: Shadcn's Radix-based `Select` (accessible by default)
  with a visible `<label>`.
- `pagination.tsx`: `nav aria-label="Pagination"`, current page marked
  `aria-current="page"`.
- Filter drawer (mobile): reuses `Sheet`, which already handles focus
  trap/`Escape`-to-close (established in STORY-004's mobile nav drawer) — no
  new plumbing needed.
- Automated check: `@axe-core/playwright` (already a dependency) run against
  the filter sidebar (desktop viewport) and drawer (mobile viewport) states.

## Testing

- **Unit (Vitest, real local Postgres per STORY-009's pattern):**
  `listProducts()` — category (including subcategory inclusion), collection
  (including date-window exclusion), each filter dimension individually and
  combined, each sort mode (including the best-selling/rating fallback),
  pagination boundaries (first page, last page, page-beyond-range,
  zero-result page); Zod schema valid/invalid/malformed parsing; the bulk
  price-resolution helper against the same cases STORY-009 covered for
  `resolvePrice()`.
- **E2E (Playwright):** apply a filter → URL and results update; change sort
  → URL and result order update; paginate → URL/results update, boundary
  pages show correct disabled controls; zero-result state with working
  clear-filters; axe scan on filter sidebar and drawer.
- **Docs:** the listing query-param contract (field names, types, defaults)
  gets a short written record so STORY-012 (search) can reuse the same
  result-rendering components without re-deriving the shape.

## Out of Scope (unchanged from story)

- Free-text/keyword search and typo-tolerance (STORY-012)
- Product Detail Page (STORY-011)
- Admin-side category/collection management UI (STORY-040, Epic 07)
- Real best-selling/rating data sources (Commerce Platform epic, STORY-015)
- Homepage teaser components (STORY-006) — not modified in this story, even
  though `ProductCard`'s shape is chosen to make that swap easy later
