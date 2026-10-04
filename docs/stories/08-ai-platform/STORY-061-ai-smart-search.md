# STORY-061: AI Smart Search

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the full write-up and scope decisions.

**Epic:** 08 — AI Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to search using natural phrases like "spicy curry powder for chicken," so that I find the right product even if I don't know its exact name.
As a Busy Professional, I want typo-tolerant search, so that a mistyped query like "chili pwder" still returns the right results.
As a Sri Lankan Expat, I want to search using familiar dish/ingredient names, so that I can find authentic products and recipes without knowing the site's exact category labels.
As a Gourmet Food Enthusiast, I want search to understand attribute-style queries (e.g. "gluten free sambol under Rs. 500"), so that I can narrow results without manually applying filters.

## Description
This story upgrades the baseline keyword search delivered in STORY-007 (Global Search) and STORY-012 (Product Search & Discovery) with AI-powered semantic/vector search, typo tolerance, and intent understanding, as called out in `docs/blueprint.md` Section 5 ("AI features: smart search") and Section 9 item 8 ("AI Platform"). It unifies products, recipes, and content (blog/Food Academy) into a single ranked result set and is the retrieval layer that the Recipe Assistant (STORY-062) and Customer Support Assistant (STORY-063) build on. It does not replace STORY-007/012's keyword search infrastructure — it sits alongside it and is the primary path, with keyword search as an explicit fallback when the AI service is degraded or unavailable.

## Acceptance Criteria
- [x] A single search query returns a ranked, unified result set spanning products, recipes, and blog/Food Academy content, grouped by type in the UI
- [x] Search is typo-tolerant (e.g. "chili pwder" still surfaces "Chilli Powder") without requiring an exact-match query — inherited from STORY-012's pg_trgm trigram matching (untouched), additionally reinforced by semantic similarity once the embedding provider has billing credits
- [x] Search understands synonyms and common intent mappings (e.g. "hot" → spicy, "curry mix" → curry powder category) beyond literal keyword matching — via the admin-curated `SearchGlossaryTerm` query-expansion mechanism (see Scope Decisions re: empty seed dataset)
- [ ] Search understands simple attribute-style queries (dietary tag + price constraint, e.g. "gluten free sambol under Rs. 500") and applies them as filters against the underlying catalogue/recipe data, not as free-text noise — **not implemented.** No free-text attribute/price-constraint parser was built; a query like this is only matched as plain keyword/semantic text today. Scoped out as a materially separate NLU problem — see Scope Decisions.
- [ ] Results are ranked by a blended score combining semantic similarity with business signals (in-stock status, popularity, published status) with configurable relative weighting — the blend itself exists (keyword-tier-primary, semantic-boosted union) and in-stock/published enforcement is real, but there is no configurable weighting knob; the blend strategy is fixed in code. See Scope Decisions.
- [x] Search-as-you-type autocomplete suggestions are returned within a low-latency budget (target <150ms) separate from the full semantic query budget (target <500ms), consistent with `docs/blueprint.md` Section 6 performance principles
- [x] All search queries are logged (query text, result count, zero-result flag) to support future search-quality tuning and admin visibility
- [x] If the AI search service is unavailable or times out, the system falls back to the STORY-007/STORY-012 keyword search path transparently, without a broken or empty results page
- [x] A curated glossary maps common Sinhala/Tamil dish and ingredient names/transliterations to their corresponding product/recipe records, so relevant results surface even when the on-site English label differs — the mechanism (admin CRUD + search-time expansion) is real and tested; ships with zero seeded entries (see Scope Decisions)
- [x] Only `PUBLISHED` products and recipes (per STORY-009 and STORY-017 status rules) are ever returned to the storefront, enforced at the service/repository level
- [x] Search UI (input, autocomplete dropdown, unified results page) is fully keyboard-operable and announces result counts to screen readers, meeting WCAG 2.1 AA

## Scope Decisions

- **Autocomplete and full search are two genuinely separate code paths, not one function serving both via a `pageSize` difference.** `GET /api/search/autocomplete` wraps the existing, untouched `searchCatalogue` (keyword-only, meets the <150ms budget by construction); `GET /api/search` calls the new semantic-blended `getSmartSearchResults` (<500ms budget). The header overlay's `useSearchSuggestions` hook now calls `/api/search/autocomplete`.
- **The semantic layer is additive, never a replacement.** Every existing keyword path (`findRankedProductMatches`, the recipe/blog/Food Academy ILIKE providers) runs exactly as it would without this story; a new embedding call runs alongside it (single attempt, ~2s timeout, no retry), and its result is merged in. If the embedding call fails (including this environment's real no-credits `429`, exercised directly in `embedding-service.test.ts`/`smart-search-service.test.ts` rather than mocked), the merge step is skipped and the result is the pure keyword-only result — "transparently," per AC #7, with no degraded-mode banner.
- **Attribute-style free-text queries (dietary tag + price constraint) and a configurable ranking-weight knob were not built.** Parsing "gluten free sambol under Rs. 500" into structured filters is a materially separate NLU problem from semantic/keyword blending, and a weighting UI/config surface wasn't requested by name in the task list. Both are honestly left unchecked above rather than approximated.
- **Blog and Food Academy get the same two-signal (keyword + semantic) treatment as recipes**, registered through `search-extensions.ts`'s existing provider registry (new `blog`/`foodAcademy` slots alongside the pre-existing `recipes` one), wired at startup in `instrumentation.ts`.
- **`SearchGlossaryTerm` ships as a real, working feature — model, service, admin CRUD at `/admin/search-glossary`, and search-time query expansion — with an empty seed dataset, not fabricated entries.** Unlike prior "no data exists yet" cases, glossary data *could* exist; this is a judgment call not to invent Sinhala/Tamil transliterations without domain confidence. The business populates it for real through the admin page.
- **Embeddings refresh two ways, the fourth time this session has hit the "no cron exists in this codebase" constraint (after STORY-050d/059c/060, all resolved the same way):** (1) a best-effort, fire-and-forget call at each content type's *existing* publish/update path for Product, Recipe, and BlogPost (`refreshProductEmbeddingBestEffort`/`refreshContentEmbeddingBestEffort`, each a single self-contained async call — the STORY-060 "guard the whole block, not just the inner promise" lesson applied proactively); (2) a real, gated `POST /api/admin/search/recompute-embeddings` for full backfill, also run once from `prisma/seed.ts`.
- **Food Academy has no admin CRUD service layer in this codebase** (`createFoodAcademyEntry` is called only by the seed script) — so it gets no inline best-effort hook. It's still covered by the full recompute, which embeds every Published entry directly.
- **Vector queries live in a new `embedding.repository.ts`, not `search.repository.ts`** — keeps the existing, tested trigram file untouched, matching STORY-060's own `recommendation.repository.ts` precedent.
- **Both AI-triggering endpoints are rate-limited using the existing `src/lib/rate-limit.ts::checkRateLimit`** (STORY-033, already used for login/password-reset) — `GET /api/search` at a per-minute cap keyed by customer id or IP; the admin recompute endpoint at a short per-admin cooldown. `/api/search/autocomplete` carries no AI-cost risk and isn't rate-limited.
- **Every embedding call logs OpenAI's own reported `usage.total_tokens`**, not an estimated dollar figure — `SearchQueryLog.embeddingTokens` (`Int?`, null when the semantic layer didn't run).
- **No shared "AI Gateway" is built in this story** — flagged as a cross-story recommendation in `docs/architecture-decisions.md` for whoever scopes STORY-062. This story's `EmbeddingProvider` interface is deliberately narrow (embeddings only).
- **pgvector verified working end-to-end against this project's local PGlite (`prisma dev`) instance**: `CREATE EXTENSION vector` via Prisma's native `datasource.extensions` array (no manual bootstrap needed), a `vector(1536)` column via `Unsupported("vector(1536)")`, the `<=>` cosine-distance operator, and `CREATE INDEX ... USING hnsw` all work — see `docs/architecture-decisions.md`.

## Tasks

- [x] **Database:**
  - [x] Enable the `pgvector` PostgreSQL extension for embedding storage/similarity search
  - [x] Define `ProductEmbedding` and `ContentEmbedding` models (covering recipes and blog/Food Academy content) storing `sourceId`, `sourceType`, `embedding` (vector column), `modelVersion`, `updatedAt`
  - [x] Define `SearchQueryLog` model: `id`, `query`, `resultCount`, `isZeroResult`, `embeddingTokens`, `customerId`/`sessionId`, `createdAt`
  - [x] Define `SearchGlossaryTerm` model for the Sinhala/Tamil transliteration/synonym glossary: `term`, `canonicalTerm`, `targetType`, `targetId`
  - [x] `npx prisma db push` + a recompute-on-seed call backfills embeddings for existing seeded products/recipes/content (no migration files in this project's `db push`-based local workflow)

- [x] **API:**
  - [x] `GET /api/search` — unified query endpoint accepting `q`; returns grouped, ranked results across products/recipes/blog/Food Academy
  - [x] `GET /api/search/autocomplete` — low-latency suggestion endpoint (unchanged `searchCatalogue`)
  - [x] `POST /api/admin/search/recompute-embeddings` and `/api/admin/search-glossary` CRUD routes
  - [x] All endpoints call the Service Layer only; enforce published/in-stock status at the service/repository level

- [x] **Service/Backend:**
  - [x] `smart-search.service.ts`: embedding generation for incoming queries via an abstracted `EmbeddingProvider` (OpenAI `text-embedding-3-small` today, swappable), hybrid ranking that blends vector similarity with keyword match, glossary term expansion before embedding
  - [x] `embedding.repository.ts` — pgvector similarity queries; the only file querying embeddings directly
  - [x] Embedding (re)generation hook triggered from each content type's existing create/update/publish service function (Product, Recipe, BlogPost — not Food Academy, see Scope Decisions)
  - [x] Fallback: the semantic layer's own failure path routes to the untouched keyword search result, transparently
  - [x] Zero-result query logging path feeding `SearchQueryLog`

- [x] **Frontend:**
  - [x] `useSearchSuggestions` now calls `/api/search/autocomplete`, rendering the same grouped suggestions as before (Products / Recipes)
  - [x] Unified `/search` results page grouping results by type (Products / Recipes / Blog / Food Academy)
  - [x] No degraded-mode UI state — the page looks identical whether the semantic layer ran (AC #7's "transparently")

- [x] **Validation:**
  - [x] `search.schema.ts` (pre-existing, untouched) and new `glossary-term.schema.ts` for the admin CRUD
  - [x] Query text reaches the embedding provider only as a plain string argument — no sanitization gap, since it is never interpolated into a shell/SQL/HTML context before the provider call

- [x] **Testing:**
  - [x] Unit tests for the best-effort refresh, the full recompute, and the blend logic (`embedding-service.test.ts`, `smart-search-service.test.ts`)
  - [x] Tests verifying a semantically-similar-but-keyword-unmatched item surfaces via a seeded vector + fixed fake provider
  - [x] Test verifying fallback to keyword search when the AI service errors — exercised against the real no-credits `429`, not a mock, in `recomputeAllEmbeddings`'s own test
  - [x] Test verifying non-Published content never gets an embedding generated (Draft skip)
  - [x] Rate-limit test (`smart-search-route.test.ts`)
  - [x] Glossary CRUD + permission-gating tests (`glossary-service.test.ts`)
  - [x] e2e: grouped multi-type results, no-results empty state, autocomplete unaffected (`tests/e2e/smart-search.spec.ts`); axe pass on the rebuilt results page

- [x] **Documentation:**
  - [x] This file's Scope Decisions section documents the embedding refresh pipeline
  - [x] The glossary maintenance process: admins manage terms at `/admin/search-glossary` (list/create/edit/delete) — no code change needed to add a term
  - [x] Ranking-weight configuration was not built (see Scope Decisions) — noted rather than silently omitted

## Dependencies
- STORY-007 (Global Search) — baseline keyword search this story upgrades and falls back to
- STORY-012 (Product Search & Discovery) — baseline product search/filter logic this story upgrades and falls back to
- STORY-009 (Product Catalogue Data Model) — source data and published-status rules for products
- STORY-017 (Recipe Centre & Listing) — source data and published-status rules for recipes
- STORY-021 (Blog) — source content for unified search results

## Out of Scope
- Multi-turn conversational search (belongs to the Recipe Assistant, STORY-062, and Customer Support Assistant, STORY-063)
- Voice search input
- Full multi-language UI translation (the glossary covers term-level mapping only, not full localization)

## References
- `docs/blueprint.md` Section 5 (AI features: smart search)
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/blueprint.md` Section 6 (performance principles — API response and Lighthouse targets)
- `docs/folder-structure.md` (`src/services/`, `src/repositories/`)
