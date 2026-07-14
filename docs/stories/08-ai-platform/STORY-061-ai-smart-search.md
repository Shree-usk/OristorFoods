# STORY-061: AI Smart Search

**Status:** Draft
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
- [ ] A single search query returns a ranked, unified result set spanning products, recipes, and blog/Food Academy content, grouped by type in the UI
- [ ] Search is typo-tolerant (e.g. "chili pwder" still surfaces "Chilli Powder") without requiring an exact-match query
- [ ] Search understands synonyms and common intent mappings (e.g. "hot" → spicy, "curry mix" → curry powder category) beyond literal keyword matching
- [ ] Search understands simple attribute-style queries (dietary tag + price constraint, e.g. "gluten free sambol under Rs. 500") and applies them as filters against the underlying catalogue/recipe data, not as free-text noise
- [ ] Results are ranked by a blended score combining semantic similarity with business signals (in-stock status, popularity, published status) with configurable relative weighting
- [ ] Search-as-you-type autocomplete suggestions are returned within a low-latency budget (target <150ms) separate from the full semantic query budget (target <500ms), consistent with `docs/blueprint.md` Section 6 performance principles
- [ ] All search queries are logged (query text, result count, zero-result flag) to support future search-quality tuning and admin visibility
- [ ] If the AI search service is unavailable or times out, the system falls back to the STORY-007/STORY-012 keyword search path transparently, without a broken or empty results page
- [ ] A curated glossary maps common Sinhala/Tamil dish and ingredient names/transliterations to their corresponding product/recipe records, so relevant results surface even when the on-site English label differs
- [ ] Only `PUBLISHED` products and recipes (per STORY-009 and STORY-017 status rules) are ever returned to the storefront, enforced at the service/repository level
- [ ] Search UI (input, autocomplete dropdown, unified results page) is fully keyboard-operable and announces result counts to screen readers, meeting WCAG 2.1 AA

## Tasks

- [ ] **Database:**
  - [ ] Enable the `pgvector` PostgreSQL extension for embedding storage/similarity search
  - [ ] Define `ProductEmbedding` and `ContentEmbedding` models (covering recipes and blog/Food Academy content) storing `sourceId`, `sourceType`, `embedding` (vector column), `modelVersion`, `updatedAt`
  - [ ] Define `SearchQueryLog` model: `id`, `query`, `resultCount`, `isZeroResult`, `customerId`/`sessionId`, `createdAt`
  - [ ] Define `SearchGlossaryTerm` model for the Sinhala/Tamil transliteration/synonym glossary: `term`, `canonicalTerm`, `targetType`, `targetId` (or category mapping)
  - [ ] Add a migration and a script to backfill embeddings for existing seeded products/recipes/content

- [ ] **API:**
  - [ ] `GET /api/search` — unified query endpoint accepting `q`, optional type filters, pagination; returns grouped, ranked results
  - [ ] `GET /api/search/autocomplete` — low-latency suggestion endpoint
  - [ ] Both endpoints call the Service Layer only; enforce published/in-stock status at the service/repository level

- [ ] **Service/Backend:**
  - [ ] `search.service.ts`: embedding generation for incoming queries (via an abstracted embedding-provider client so the LLM/embedding vendor is swappable), hybrid ranking that blends vector similarity with keyword match and business signals, glossary term expansion before embedding
  - [ ] `search.repository.ts` — pgvector similarity queries and keyword-search queries; the only file allowed to query embeddings directly
  - [ ] Embedding (re)generation hook triggered when a product/recipe/content record is created, updated, or published (coordinate with STORY-009 and STORY-017 write paths)
  - [ ] Fallback controller that detects AI service failure/timeout and routes the request to the existing STORY-007/STORY-012 keyword search service
  - [ ] Zero-result query logging path feeding `SearchQueryLog`

- [ ] **Frontend:**
  - [ ] Enhance the global search bar/autocomplete component (STORY-007) to call `/api/search/autocomplete` and render grouped suggestions (Products / Recipes / Content)
  - [ ] Unified search results page grouping results by type with matched-term highlighting
  - [ ] Loading and degraded-mode (fallback) states clearly distinguishable in the UI without alarming the user

- [ ] **Validation:**
  - [ ] Zod schema for search query params (query length limits, allowed type filters, pagination caps)
  - [ ] Input sanitization on query text before it is sent to any external embedding/LLM provider

- [ ] **Testing:**
  - [ ] Unit tests for the hybrid ranking/blend logic
  - [ ] Integration tests with a seeded embedding set verifying known queries (including typo and synonym cases) return expected results
  - [ ] Test verifying fallback to keyword search when the AI service errors or times out
  - [ ] Test verifying non-published products/recipes never appear in results
  - [ ] Accessibility test pass (axe) on the search input, autocomplete dropdown, and results page

- [ ] **Documentation:**
  - [ ] Document the embedding generation/refresh pipeline (when embeddings are created/updated) for future content types
  - [ ] Document the glossary maintenance process so admin content editors know how to add new transliteration/synonym terms
  - [ ] Document the ranking weight configuration so it can be tuned without a code change

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
