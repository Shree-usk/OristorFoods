# Global Search (Storefront Entry Point) — Design

**Story:** `docs/stories/02-core-ui/STORY-007-global-search.md`
**Date:** 2026-09-20

## Summary

Implements the header search entry point: a desktop overlay with live
suggestions, a mobile direct link, and a `/search` results page. No AI/
ranking logic — plain case-insensitive substring matching, structured so
STORY-061 (AI Smart Search) can later swap the matching logic behind the
same service interface. Recipes have no data model yet (Epic 04 unbuilt),
so recipe search uses the same registered-extension-point pattern STORY-011
established for PDP reviews/Q&A/recipes — until Epic 04 registers a
provider, the Recipes group is simply absent from suggestions/results, not
an empty/error state.

## Data Flow

New `src/services/search.service.ts`:

```ts
export interface SearchSuggestionItem {
  id: string;
  label: string;
  href: string;
  imageSrc?: string;
  type: "Product" | "Recipe";
}
export interface SearchSuggestions {
  products: SearchSuggestionItem[];
  recipes: SearchSuggestionItem[];
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestions>

export interface SearchResultsPage {
  query: string;
  products: ProductListItem[]; // reuses product.service.ts's existing type
  recipes: SearchSuggestionItem[]; // always [] until Epic 04 registers
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export async function searchCatalogue(
  query: string,
  opts: { page?: number; pageSize?: number } = {},
): Promise<SearchResultsPage>
```

Both short-circuit to an empty result for a blank/whitespace-only `query`
(no DB call). `getSearchSuggestions` caps at 5 products + 3 recipes (8
total, matching the AC's "5-8" range) and does no pagination.
`searchCatalogue` paginates products only (`pageSize` default 12).

## Repository Change

`product.repository.ts` gains:

```ts
export function searchPublishedProducts(query: string, opts: { take?: number; skip?: number } = {}) {
  return prisma.product.findMany({
    where: {
      status: "Published",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
      ],
    },
    include: { brand: true, images: { where: { isPrimary: true }, take: 1 } },
    orderBy: { publishedAt: "desc" }, // deterministic; same rationale as findPublishedProductsForListing
    take: opts.take,
    skip: opts.skip,
  });
}
```

`search.service.ts` resolves prices the same way `listProducts` does
(`pricingService.resolvePricesForProducts`) before mapping to
`ProductListItem` via the existing `toProductListItem` — no duplicated
mapping logic.

## Recipe Search Extension Point

New `src/services/search-extensions.ts`, same shape as
`product-detail-extensions.ts`:

```ts
export type SearchRecipes = (query: string, limit: number) => Promise<SearchSuggestionItem[]>;
// module-local stub returns [] until a provider registers
export function registerRecipeSearchProvider(fn: SearchRecipes): void
export function searchRecipes(query: string, limit: number): Promise<SearchSuggestionItem[]>
```

`search.service.ts` calls `searchRecipes()` for both suggestions and
results; STORY-017/061 call `registerRecipeSearchProvider` from their own
module init, exactly as STORY-015/016 will for the PDP extension points.

## API

`src/app/api/search/route.ts` — `GET`, Zod-validates `q` (required,
trimmed, min 1 char after trim) and `page` (optional, positive int) via
`src/validation/search.schema.ts`, delegates to `search.service.ts`. Route
handler never touches Prisma directly (Service Layer pattern).

A second `GET` at the same route is unnecessary — suggestions and full
results share one endpoint, `use-search-suggestions.ts` calling it without
`page` and the results page calling it with `page`. This avoids two nearly
identical route handlers.

## Frontend Components

New, under `src/components/storefront/search/`:

- `search-overlay.tsx` — Client Component, built on the existing
  `src/components/ui/dialog.tsx` primitive (from STORY-011) rather than a
  new modal implementation. Contains `search-input.tsx` + `search-suggestions.tsx`.
  Closes on `Escape`/outside click/close button, returns focus to the
  trigger (Dialog primitive already handles this per its STORY-011 usage).
- `search-input.tsx` — shared text input, used by both the overlay and the
  `/search` results page header (so mobile users, who land on `/search`
  directly via `nav-config.ts`'s existing link with no overlay step, can
  still type/change a query). Debounced (250-300ms) via a small
  `useDebouncedValue` hook (new, `src/hooks/use-debounced-value.ts`) shared
  by both the suggestions hook and results-page live updates.
- `search-suggestions.tsx` — dropdown, grouped "Products"/"Recipes"
  headings (Recipes heading omitted when empty), arrow-key navigable,
  `Enter` selects, `Escape` closes, each row is a real link.
- `use-search-suggestions.ts` — TanStack Query hook, same shape as
  `use-product-listing.ts`: `useQuery({ queryKey: ["search-suggestions", debouncedQuery], queryFn: () => fetch(...) })`,
  `enabled: debouncedQuery.length > 0`.
- `src/app/(storefront)/search/page.tsx` — Server Component, reads
  `q`/`page` searchParams, calls `searchCatalogue` directly (no fetch — it's
  already on the server), renders `search-input.tsx` (client) at top,
  loading is handled by Next's `loading.tsx` for this route, empty state
  ("No results found for '...'" + links to `/products` and `/recipes`),
  results grid using `ProductCard` for the products group. The Recipes
  group renders only when `recipes.length > 0` (i.e. never, until Epic 04
  registers a provider) — no dedicated recipe-card component is built now
  to render it, since that would be untested dead code per CLAUDE.md's
  "no placeholder code" rule; when Epic 04 lands, it adds both the provider
  registration and the small recipe-card markup together, in its own story.
- Wire `header-actions.tsx`'s existing `SearchTrigger` stub to open
  `search-overlay.tsx` (remove the placeholder comment, add
  `useState`-backed open control — the component doc-comment already
  flags exactly this as STORY-007's job).

## Recent Searches

New `src/lib/stores/recent-searches-store.ts`, same `persist`-backed
Zustand pattern as `recently-viewed-store.ts`: `{ queries: string[], add(query), }`,
capped at 5, deduplicated, most-recent first. Overlay shows these when the
input is empty; hidden entirely (not a blank overlay) only if the list is
also empty, in which case a small static "Try: curry powder, coconut milk"
hint row renders instead — satisfies the AC's "must not show a blank
overlay" without introducing an admin-managed popular-terms feature this
early.

## Validation

`src/validation/search.schema.ts`, following `product-listing.schema.ts`'s
established convention of `.catch()` (never a hard validation error) so a
malformed/missing query degrades to an empty result instead of a 400:

```ts
export const searchQuerySchema = z.object({
  q: z.string().trim().catch(""),
  page: z.coerce.number().int().positive().catch(1),
});
```

`search.service.ts`'s existing blank-query short-circuit (see Data Flow)
turns an empty/missing `q` into a 200 with empty results — the same
"a broken link elsewhere shouldn't break this page" rationale
`product-listing.schema.ts` documents.

## Error Handling

- Blank/whitespace query → empty result, no DB call, no error.
- No recipe provider registered → recipes array is `[]`, no error, section
  omitted from UI (not an empty-state message — matches PDP's precedent
  for not-yet-built modules).
- Malformed/missing `q` or `page` → schema `.catch()` degrades to `""`/`1`,
  which resolves through the same blank-query empty-result path, never a
  400 (matches `product-listing.schema.ts`'s convention).
- Suggestions fetch failure → dropdown shows nothing extra (no error toast
  inside a transient overlay); results-page fetch failure → inline retry
  message (this page is the durable destination, worth a visible error).

## Testing

- Vitest: `search.service.ts` — exact match, partial/substring match, no
  match, empty query, pagination math, unregistered-recipe-provider
  fallback. `product.repository.ts` — `searchPublishedProducts` matches
  name and SKU, case-insensitive, Published-only.
- Playwright e2e: open overlay from header, type a query, verify
  suggestions render, select one → navigates correctly; submit query →
  navigates to `/search?q=...` with results; mobile nav Search item →
  lands on `/search` with a usable input.
- Automated axe scan: overlay (open state) and `/search` results page,
  zero critical/serious violations.

## Out of Scope (unchanged from story)

AI/semantic ranking (STORY-061), full filtering/faceted search on results
(STORY-012), search analytics, voice/image search.
