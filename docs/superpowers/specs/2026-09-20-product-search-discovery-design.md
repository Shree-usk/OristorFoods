# Product Search & Discovery — Design

**Story:** `docs/stories/03-product-platform/STORY-012-product-search-discovery.md`
**Date:** 2026-09-20

## Summary

Builds the product-catalogue search engine: typo-tolerant, relevance-ranked
full-text search over products, reusing STORY-010's listing UI
(`ProductGrid`/`FilterSidebar`/`Pagination`) for a `/products/search`
results page, plus a lightweight suggestions endpoint. STORY-007's header
search overlay keeps its existing interface (`searchCatalogue`,
`SearchOverlay`, `/api/search`) unchanged; internally it upgrades to call
this story's `searchProducts()` for its product-matching, gaining better
relevance and typo-tolerance "for free" — confirmed with the user as the
integration approach, over fully rewiring the already-shipped overlay.

**Feasibility confirmed:** `pg_trgm` works on the local PGlite dev database
(`CREATE EXTENSION IF NOT EXISTS pg_trgm` + `similarity()` both succeed) —
verified directly before committing to this approach, since PGlite's
Postgres-compatibility has been a recurring source of surprises this
project (see `docs/architecture-decisions.md`'s STORY-001 entry).

## Schema Change

New migration enabling the extension:

```prisma
// prisma/schema.prisma — datasource block gains:
datasource db {
  provider   = "postgresql"
  extensions = [pg_trgm]
}
```

Applied via a real `prisma migrate dev` (not `db push` — this is exactly
the "producing a committed migration" case `docs/architecture-decisions.md`
already documents a workflow for: fresh `prisma dev` restart, pre-seed
`_prisma_migrations`, single `migrate dev` call). No new indexed columns
are added to `Product` itself — trigram/text matching runs against
existing columns (`name`, `shortDescription`, `story`, `sku`) and related
tables (`ProductIngredient.name`, `Category.name`, `Collection.name`) via
GIN trigram indexes created in the same migration:

```sql
CREATE INDEX product_name_trgm_idx ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX product_short_description_trgm_idx ON "Product" USING gin ("shortDescription" gin_trgm_ops);
```

(`story` and SKU are matched but not separately indexed — lower priority
tier, acceptable sequential-scan cost at current catalogue size; the final
whole-branch review on STORY-007 already flagged general `ILIKE` scan cost
as a "note for whichever story picks search up next," which is this one.)

## Data Flow

New `src/repositories/search.repository.ts` — the raw-SQL layer, kept
separate from `product.repository.ts` rather than extended into it, since
its queries are structurally different (raw SQL for ranking, not
Prisma's query builder) and deserve their own file per this project's
one-file-one-responsibility convention:

```ts
export interface RankedProductMatch {
  productId: string;
  rankTier: number;      // 4=exact name, 3=prefix, 2=fuzzy/contains, 1=other-field-only
  similarity: number;    // trigram similarity of the name field, for same-tier ordering
}

export function findRankedProductMatches(query: string): Promise<RankedProductMatch[]>
```

One raw query (`$queryRaw`) does the text matching, tiering, and trigram
similarity scoring across name/shortDescription/story/sku/ingredient
names/category+collection names, `status = 'Published'` only, returning
**ids and rank info only** — not full product rows. Relational filters
(allergens, certifications, brands, inStock) are NOT expressed in this raw
query; they're applied afterward via the existing Prisma-based filter
shape, for two reasons: (1) hand-joining every filterable relation into
raw SQL would duplicate logic `findPublishedProductsForListing` already
expresses cleanly, and (2) it keeps the raw-SQL surface — the riskiest,
least-typechecked part of this story — as small as possible.

New `src/services/search.service.ts` additions (this file already exists
from STORY-007; extending it, not replacing it):

```ts
export async function searchProducts(
  query: string,
  opts: {
    filters?: ProductListingFiltersInput; // reused verbatim from product.service.ts
    sort?: ProductSort;                    // reused verbatim, see Sort section below
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ProductListingResult> // reused verbatim from product.service.ts — same shape ProductGrid/Pagination already consume

export interface SearchSuggestion {
  id: string;
  label: string;
  href: string;
  type: "Product" | "Category";
}
export async function getSearchSuggestions(query: string, limit?: number): Promise<SearchSuggestion[]>
```

`searchProducts()`:
1. Blank/whitespace query → `emptyListingResult` (same pattern as
   `listProducts`/`searchCatalogue`), no DB call.
2. `findRankedProductMatches(query)` → ordered list of `{productId,
   rankTier, similarity}`.
3. If empty → return early with `items: []` (the "did you mean" fallback
   lives in the frontend/route layer, not here — see below).
4. Apply the same relational filters `findPublishedProductsForListing`
   uses, scoped to `id: { in: matchedIds }` — new
   `product.repository.ts` function `findProductsByIdsWithFilters(ids,
   filters)`, sharing the exact `where` filter-construction the sibling
   listing function already has (extracted into a small shared helper if
   the duplication would otherwise be verbatim — judgment call for the
   implementer, but the filter *shape* must not be re-typed from scratch).
5. Re-sort the filtered products back into rank order (a `Map<id, {tier,
   similarity}>` lookup, since Prisma's `id: { in: [...] }` doesn't
   preserve array order) — unless `opts.sort` is anything other than
   `"relevance"`, in which case skip rank-ordering and use the existing
   `sortCandidates()` logic instead (see Sort section).
6. Resolve prices (`pricingService.resolvePricesForProducts`), filter by
   `priceMin`/`priceMax` in JS — identical to `listProducts()`.
7. Paginate in JS, compute `total` from the filtered+priced candidate
   count (not the raw match count — a match that gets filtered out by
   price/allergen/stock must not inflate `total`), map to
   `ProductListItem` via `toProductListItem`.

## Sort

`productSortValues` (`src/lib/product-listing-params.ts`) gains
`"relevance"`, becoming `["relevance", "price-asc", "price-desc",
"newest", "best-selling", "rating"]`. It is the **default sort specifically
for `/products/search`**, not for category/collection listing pages
(`listProducts()`'s default stays `"newest"` — relevance has no meaning
without a query). `SortSelect` gains a `showRelevance?: boolean` prop
(default `false`); the search results page is the only caller that passes
`true`, so "Relevance" never appears as a confusing option on a plain
category page. Picking any other sort value on the search page still
searches (still `Published`-only, still text-filtered) but abandons rank
ordering for that explicit sort's ordering — matches how every other
storefront listing page already treats an explicit sort choice as
overriding the default ordering.

**Best-seller/rating boost:** `docs/blueprint.md`/AC #4 asks for a
secondary ranking boost from best-selling/highest-rated products. No Order
model (Commerce Platform epic) or Review/rating data (STORY-015) exists
yet — this is the *exact* gap `product.service.ts`'s `sortCandidates()`
already documents ("`best-selling` and `rating` fall back to `newest`
ordering... see `docs/superpowers/specs/2026-07-16-product-listing-design.md`").
This story follows that same precedent: no fabricated boost, rank tiers
break ties by `publishedAt desc` only, with a code comment pointing at the
same future stories that will supply real data.

## "Did You Mean"

Lives in `search.service.ts` as a small, separate function rather than
folded into `searchProducts()`'s control flow, since it's a distinct
query (product **names**, not full-text matching) triggered only on a
genuinely empty result:

```ts
export async function findDidYouMeanSuggestion(query: string): Promise<string | null>
```

Raw-SQL trigram similarity against `Product.name` and `Category.name`
(`Published` products / active categories only), threshold
`similarity > 0.3`, returns the single best match's display name (not an
id/href — the frontend re-runs an actual search with the corrected text
rather than linking directly, so a bad suggestion just yields another
empty state instead of a broken link). `/products/search/page.tsx` calls
this only when `searchProducts()` returns zero items, and renders "Did you
mean *ginger powder*?" as a link to `?q=ginger+powder`.

## Suggestions Endpoint

`getSearchSuggestions(query, limit = 8)`: top product-name and
category-name matches (tiers 4/3/2 only — prefix/exact/fuzzy, never
description-only matches, since a suggestion dropdown needs to look
obviously relevant at a glance). Reuses `findRankedProductMatches`, capped
and mapped to the lightweight `SearchSuggestion` shape — no price
resolution, no filters, no pagination. This is intentionally a *smaller*
function than `searchProducts()`, not a thin wrapper around it, since a
suggestions call happens on every debounced keystroke and doing full price
resolution for 8 suggestion rows would be wasted work (mirrors why
STORY-007's suggestions already use a small `pageSize` rather than a
separate code path duplicating logic — same principle, applied at the
query-shape level here since suggestions don't need prices at all, unlike
STORY-007's).

## STORY-007 Integration

Per the agreed "upgrade under the hood" approach:
`src/services/search.service.ts`'s existing `searchCatalogue()` (STORY-007)
replaces its call to `productRepository.searchPublishedProducts()` with a
call to this story's `searchProducts()` (passing no filters, `sort:
"relevance"`, and its own small `pageSize`), then keeps its existing
recipe-fetching and `SearchResultsPage` shape exactly as-is.
`searchPublishedProducts()` (the plain substring match STORY-007 built)
becomes dead code once this lands — **delete it** rather than leave two
product-search implementations side by side (CLAUDE.md: no duplicate
logic), along with its now-unused test file coverage (the coverage moves
to `search.repository.ts`'s tests, which test the same matching behavior
at a more capable level). `SearchOverlay`, `use-search-suggestions.ts`,
`/api/search/route.ts`, and their tests are **not touched** — same
external contract, better internals.

## API

- `GET /api/products/search` — Zod-validates `q` (via a new
  `productSearchQuerySchema` that extends the existing
  `productListingQuerySchema`'s shape with `q`, same `.catch()`-everywhere
  convention), delegates to `searchProducts()`.
- `GET /api/products/search/suggestions` — validates `q` only (reuses the
  `q` half of the same schema), delegates to `getSearchSuggestions()`.

Both are new routes, not an extension of the existing `/api/products`
route — matches the story's own explicit task list, and keeps
`/api/products` (already reviewed, STORY-010) completely untouched.

## Frontend

- `src/app/(storefront)/products/search/page.tsx` — Server Component,
  reads `q` + the shared `productListingParsers` (page/sort/filters) via
  `loadProductListingParams`, calls `searchProducts()` directly (no
  client fetch waterfall, same pattern as every other listing/search page
  in this codebase), renders `ProductGrid` with a new `query` field on
  `ProductListingScope` (`{ category?, collection?, query? }`) so
  `useProductListing`'s `buildSearchParams` adds `q=...` and points at
  `/api/products/search` instead of `/api/products` when `scope.query` is
  set — a small, additive change to an existing hook (a conditional
  endpoint, not a rewrite), not a new parallel hook.
  `generateMetadata` sets `title: "Search results for '...'"` and
  `robots: { index: false, follow: true }` (same convention this
  project's own final review on STORY-007 just established for `/search`).
- Empty-result state (0 items): if `findDidYouMeanSuggestion` returns a
  name, render the "Did you mean" link; else fall back to STORY-010's
  existing "no products match" copy pattern, adapted to reference the
  search query instead of "your filters."
- `src/hooks/use-product-search-suggestions.ts` — new, debounced (reusing
  STORY-007's `useDebouncedValue`), TanStack Query hook calling
  `/api/products/search/suggestions`, exposed for STORY-007's header
  search box to adopt *later* if desired — this story ships it and
  documents it (AC #25's "ready... without rebuilding ranking logic"); it
  does not itself rewire `SearchOverlay` to consume it, per the agreed
  integration scope.

## Analytics Hook

`emitProductSearchLogged({ query, resultCount })` — a plain typed function
call (not a UI, not a queue/event-bus, matching AC #28's literal
wording), stubbed to a `console.debug` call behind a `NODE_ENV !==
"production"` guard (mirrors how this codebase already gates
dev-diagnostic logging elsewhere) with a doc comment naming STORY-061/064
as the future real consumers. Called once per `searchProducts()`
invocation with a non-blank query, after results are computed (so
`resultCount` reflects the real, filtered count).

## Error Handling

- Blank query → empty result, no DB call, no error (same as STORY-007).
- Malformed/missing query params → schema `.catch()` degrades to
  sane defaults, never a 400 (same convention as every other listing
  route in this project).
- Zero results → "did you mean" or generic empty state, never an error.
- `findRankedProductMatches`'s raw SQL is the one place a malformed query
  string could theoretically matter for injection — mitigated by using
  Prisma's tagged-template `$queryRaw` (parameterized), never
  `$queryRawUnsafe` with interpolated user input.

## Testing

- Vitest: `search.repository.ts` — exact match ranks above prefix ranks
  above fuzzy/typo ranks above description-only match, against a small
  seeded product set; typo-tolerance against 3-5 known misspellings
  ("currry"→curry, "chili"→chilli); `Published`-only; ingredient/category
  name matches surface at the correct (lowest) tier.
- Vitest: `search.service.ts` — `searchProducts()` filter/sort/pagination
  composition (mirrors `listProducts()`'s existing test shape),
  `getSearchSuggestions()` shape and cap, `findDidYouMeanSuggestion()`
  threshold behavior (returns null below similarity 0.3).
- Vitest: `searchCatalogue()` regression test confirming it still returns
  the same `SearchResultsPage` shape after switching to call
  `searchProducts()` internally (STORY-007's existing tests should
  already catch a shape break, but one explicit test pins the "for free"
  quality upgrade — e.g. a typo-matched product now appearing where the
  old substring match would have missed it).
- Playwright e2e: search a known product by exact name → appears; search
  a known misspelling → "did you mean" surfaces the correct product and
  the corrected link works; apply a STORY-010 filter on top of search
  results → query stays in the URL, result set narrows correctly.

## Out of Scope (unchanged from story)

AI/semantic Smart Search and personalized ranking (STORY-061), the header
Global Search UI/box itself (STORY-007, already shipped), search analytics
dashboards (Epic 07/08 — this story only emits the logging hook).
