# STORY-007: Global Search (Storefront Entry Point)

**Status:** Done — see `src/services/search-extensions.ts` for the recipe
search provider contract Epic 04 and STORY-061 must implement
(`registerRecipeSearchProvider`), and
`docs/superpowers/plans/2026-09-20-global-search.md` for the full
implementation record.
**Epic:** 02 — Core UI
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Gourmet Food Enthusiast, Sri Lankan Expat

## User Story
As a Home Cook, I want to click a search icon in the header and get a search overlay with an input box, so that I can quickly look up a product or recipe by name.

As a Busy Professional, I want to see quick suggestions as I type, so that I can jump straight to a likely match without typing a full query.

As a Gourmet Food Enthusiast, I want my search query to take me to a results page listing what matched, so that I can browse and refine from there.

## Description
This story implements the header search entry point referenced in `docs/blueprint.md` Section 4 (primary nav item "Search", present on both desktop and mobile) — the overlay/UI shell, input handling, a basic suggestions dropdown, and query routing to a results page skeleton. It is deliberately scoped to the storefront UX shell only: it does NOT implement AI-powered smart search, ranking, or relevance logic (that is STORY-061, AI Smart Search, in Epic 08 — AI Platform). This story's suggestions and results can be powered by a simple substring/keyword match against available fixture or catalogue data, with the service layer structured so STORY-061 can later swap in an AI-backed implementation without changing the storefront UI contract.

## Acceptance Criteria
- [x] Clicking the Search icon in the header (from STORY-004) opens a search overlay/modal (`src/components/storefront/search/search-overlay.tsx`) with a focused text input, on desktop (`lg:` breakpoint and up); on mobile, the bottom-nav Search item links directly to `/search`, which has an equivalent search input — see the design spec for the rationale.
- [x] Search overlay closes on `Escape`, outside click, or explicit close button, and returns focus to the triggering search icon (WCAG focus management).
- [x] As the user types (debounced, e.g. 250-300ms), a suggestions dropdown (`src/components/storefront/search/search-suggestions.tsx`) shows up to N (e.g. 5-8) quick matches grouped by type (Products, Recipes) using fixture/lightweight catalogue data.
- [x] Suggestions dropdown is keyboard-navigable (Arrow Up/Down to move selection, `Enter` to select, `Escape` to close) and each suggestion links to the relevant detail page.
- [x] Submitting the search (via `Enter` or a submit button) navigates to `src/app/(storefront)/search/page.tsx` with the query in the URL as a search param (e.g. `/search?q=...`).
- [x] Search results page skeleton renders a query-echo heading ("Results for '...'"), a loading state, an empty-state ("No results found for ...") with a suggestion to browse Products/Recipes, and a basic results list/grid reusing the product/recipe card components established for the homepage (STORY-006).
- [x] Search input and results page are debounced/paginated in a way that avoids excessive re-render or request spam (client-side debounce; server-side the route handler accepts `q` and optional `page`).
- [x] A `search.service.ts` service layer method (e.g. `searchCatalogue(query: string)`) is called from the API route handler; the route handler never queries data sources directly, and no AI/LLM call is made from this story's implementation — matching the Service Layer pattern in blueprint Section 3 and leaving a clean seam for STORY-061 to later inject AI ranking behind the same interface.
- [x] Recent/empty query state (overlay opened with no input yet) shows either recent searches (if trivially available from local storage) or a small set of popular/suggested terms — implementer's choice, documented in the story's PR — but must not show a blank overlay.
- [x] Search overlay and results page pass an automated axe accessibility scan with zero critical/serious violations, including correct `role="search"`/`aria-label` usage on the input and `aria-live` announcement of result counts.
- [x] Search overlay trigger and dropdown are Client Components; the results page itself is a Server Component that reads the `q` search param and renders server-fetched results, per blueprint Section 3.

## Tasks
- [x] **API:** Add `src/app/api/search/route.ts` Route Handler accepting `q` (and optional `page`) query params, validating with Zod, and delegating to `search.service.ts`.
- [x] **Service/Backend:** Add `src/services/search.service.ts` with a `searchCatalogue(query: string): Promise<SearchResult[]>` method performing simple keyword/substring matching against available fixture or catalogue data (via a repository if a Product/Recipe repository already exists at implementation time, otherwise against typed fixtures), structured so the query/response contract can be reused when STORY-061 swaps in AI ranking.
- [x] **Frontend:** Build `src/components/storefront/search/search-overlay.tsx` (modal/overlay shell + input).
- [x] **Frontend:** Build `src/components/storefront/search/search-suggestions.tsx` (debounced live suggestions dropdown).
- [x] **Frontend:** Build `src/app/(storefront)/search/page.tsx` results page skeleton (loading, empty, and populated states) reusing card components from STORY-006.
- [x] **Frontend:** Wire the header Search icon trigger (STORY-004) to open `search-overlay.tsx`.
- [x] **Frontend:** Add a `src/hooks/use-search-suggestions.ts` hook using TanStack Query to fetch/debounce suggestion requests against `/api/search`.
- [x] **Validation:** Define `src/validation/search.schema.ts` Zod schema for the `q`/`page` query params, shared between client requests and the API route.
- [x] **Testing:** Vitest unit tests for `search.service.ts` matching logic (exact match, partial match, no match, empty query).
- [x] **Testing:** Playwright e2e test: open overlay from header, type a query, verify suggestions appear, select one or submit, verify navigation to `/search?q=...` and results render.
- [x] **Testing:** Automated accessibility scan (axe) on the overlay (open state) and the results page.
- [x] **Documentation:** Document the `search.service.ts` interface contract and explicitly note in code comments and `docs/architecture-decisions.md` that STORY-061 (AI Smart Search) will replace/extend the matching logic behind this same interface — not the storefront UI.

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-004 (Primary Navigation & Header) — provides the Search trigger icon
- STORY-006 (Homepage) — reuses product/recipe card components for suggestions and results

## Out of Scope
- AI-powered smart search, semantic ranking, typo-tolerance, and natural-language query understanding — see STORY-061 (Epic 08 — AI Platform).
- Full product/recipe filtering and faceted search on the results page — see STORY-012 (Product Search & Discovery).
- Search analytics/tracking of query popularity (Enterprise Platform epic).
- Voice search or image search.

## References
- `docs/blueprint.md` Section 4 (primary nav "Search" item, desktop and mobile)
- `docs/blueprint.md` Section 3 (Service Layer pattern; Server/Client Component split)
- `docs/blueprint.md` Section 5 (Core Feature Set — "AI features: ... smart search" noted as a distinct future capability)
- `docs/folder-structure.md` (`src/app/api/`, `src/services/`, `src/components/storefront/`)
