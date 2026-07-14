# STORY-060: AI Product Recommendations

**Status:** Draft
**Epic:** 08 — AI Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to see products recommended to me based on what I've bought and browsed before, so that I discover new items relevant to how I actually cook.
As a Gourmet Food Enthusiast, I want a "You May Also Like" section on product pages, so that I can find complementary premium items I might not have searched for.
As a Busy Professional, I want relevant cross-sell suggestions while I'm in my cart, so that I can add what I'm likely to need in one trip instead of reordering later.

## Description
This story delivers the personalized product recommendation engine called out in `docs/blueprint.md` Section 1 ("AI & Data Intelligence" pillar), Section 5 ("AI features: recommendations"), and Section 9 item 8 ("AI Platform"). It surfaces recommendations in three places: a "Recommended for You" rail on the homepage, "You May Also Like" / "Frequently Bought Together" sections on the Product Detail Page, and cross-sell suggestions in the cart. It is built as a Service Layer module with a swappable recommendation-strategy interface (rules-based fallback plus a co-occurrence/collaborative model) so the algorithm can evolve without touching call sites, and it consumes signals from the product catalogue (STORY-009), order history (STORY-028), wishlist (STORY-013), and browsing behavior.

## Acceptance Criteria
- [ ] Homepage renders a "Recommended for You" rail for logged-in customers with sufficient interaction history (purchases, views, wishlist adds)
- [ ] Anonymous visitors and new customers with no history see a cold-start fallback (best-sellers / trending-in-category) instead of an empty or broken rail
- [ ] Product Detail Page renders a "You May Also Like" section (similar products by category/attributes) and a separate "Frequently Bought Together" section (co-purchase association)
- [ ] Cart page/drawer renders cross-sell suggestions derived from current cart contents (complementary items, commonly-paired products)
- [ ] Recommendations never include out-of-stock products or products already present in the customer's cart
- [ ] Recommendation impressions, clicks, and resulting add-to-cart events are tracked to support future model evaluation and A/B testing
- [ ] The active recommendation strategy (rules-based vs. behavior-based) is selectable via configuration/feature flag without a code deploy, consistent with the feature-flag capability described for System Settings in `docs/blueprint.md` Section 7
- [ ] Recommendation results respect a defined recency window — recomputed at least nightly via batch job, with session-level re-ranking for the current visit
- [ ] Recommendation API endpoints meet the platform's <300ms response budget (`docs/blueprint.md` Section 6), using precomputed/cached result sets rather than computing similarity at request time
- [ ] No PII is included in recommendation API payloads or logs; only product IDs, scores, and anonymized/session identifiers
- [ ] Recommendation rails/carousels are fully responsive and keyboard-navigable, meeting WCAG 2.1 AA

## Tasks

- [ ] **Database:**
  - [ ] Define `ProductInteractionEvent` model: `id`, `customerId` (nullable for anonymous), `sessionId`, `productId`, `eventType` (enum: VIEW, ADD_TO_CART, WISHLIST_ADD, PURCHASE), `createdAt`
  - [ ] Define `ProductAssociation` model (precomputed): `sourceProductId`, `targetProductId`, `associationType` (enum: SIMILAR, FREQUENTLY_BOUGHT_TOGETHER), `score`, `computedAt`
  - [ ] Define `RecommendationEvent` model for impression/click/conversion tracking: `id`, `customerId`/`sessionId`, `placement` (HOMEPAGE, PDP, CART), `productId`, `action` (IMPRESSION, CLICK, ADD_TO_CART), `createdAt`
  - [ ] Add indexes on `ProductInteractionEvent.customerId`, `ProductAssociation.sourceProductId`, and composite indexes supporting the batch recompute queries
  - [ ] Write a Prisma migration and seed a representative interaction/association dataset for local development and Playwright fixtures

- [ ] **API:**
  - [ ] `GET /api/recommendations/homepage` — returns personalized (or cold-start fallback) product set for the current customer/session
  - [ ] `GET /api/recommendations/product/[id]` — returns "similar" and "frequently bought together" sets for a given product
  - [ ] `POST /api/recommendations/cart` — accepts current cart product IDs, returns cross-sell suggestions
  - [ ] `POST /api/recommendations/track` — records impression/click/conversion events
  - [ ] All endpoints call the Service Layer only; stock and cart-exclusion filtering enforced server-side, not just in the UI

- [ ] **Service/Backend:**
  - [ ] `recommendation.service.ts` implementing a `RecommendationStrategy` interface with at least two strategies: rules-based (category affinity / best-sellers) and co-occurrence-based (built from `ProductAssociation`)
  - [ ] `recommendation.repository.ts` — the only file allowed to query `ProductInteractionEvent`/`ProductAssociation`/`RecommendationEvent` directly via Prisma
  - [ ] Nightly batch job (documented interim cron trigger, since Redis/BullMQ are marked "planned/future" in `docs/blueprint.md` Section 3) that recomputes `ProductAssociation` scores from recent order/interaction data
  - [ ] Cold-start detection logic (interaction count below threshold triggers fallback strategy)
  - [ ] Caching layer for popular recommendation sets to meet the response-time budget

- [ ] **Frontend:**
  - [ ] `src/components/storefront/recommendations/RecommendationRail.tsx` (carousel, reused across homepage/PDP/cart with a `placement` prop)
  - [ ] Homepage integration (`src/app/(storefront)/page.tsx` "Best Selling Products"/personalized section per `docs/blueprint.md` Section 4 homepage layout)
  - [ ] PDP integration: "You May Also Like" and "Frequently Bought Together" sections
  - [ ] Cart page/drawer integration for cross-sell suggestions
  - [ ] Impression tracking (on-scroll-into-view) and click/add-to-cart tracking wired to `/api/recommendations/track`

- [ ] **Validation:**
  - [ ] Zod schemas for all recommendation endpoint query/body params, including a capped product-ID array size for the cart endpoint

- [ ] **Testing:**
  - [ ] Unit tests for each `RecommendationStrategy` implementation, including cold-start fallback behavior
  - [ ] Unit tests confirming out-of-stock and in-cart products are always excluded from results
  - [ ] Integration test for the nightly batch recompute job
  - [ ] Playwright e2e: verify recommendation rails render on homepage, PDP, and cart, and that clicking a recommended product navigates correctly
  - [ ] Accessibility test pass (axe) on the recommendation carousel component

- [ ] **Documentation:**
  - [ ] Document the `RecommendationStrategy` interface and how to add a new algorithm without touching call sites
  - [ ] Document the `ProductInteractionEvent`/`RecommendationEvent` schema for future model-evaluation work

## Dependencies
- STORY-009 (Product Catalogue Data Model) — recommendations reference products, stock status, and categories
- STORY-011 (Product Detail Page) — hosts the "You May Also Like" / "Frequently Bought Together" sections
- STORY-024 (Shopping Cart) — hosts cross-sell suggestions and supplies current cart contents
- STORY-028 (Order Management) — purchase history is the primary signal for behavior-based recommendations
- STORY-013 (Wishlist) — secondary interaction signal
- STORY-006 (Homepage) — hosts the personalized rail

## Out of Scope
- Demand forecasting / inventory prediction (deferred; see STORY-064)
- Email or WhatsApp recommendation campaigns (belongs to Marketing Console, STORY-050)
- Price optimization or dynamic pricing based on recommendation data

## References
- `docs/blueprint.md` Section 1 (AI & Data Intelligence pillar)
- `docs/blueprint.md` Section 5 (AI features: recommendations)
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/folder-structure.md` (`src/services/`, `src/repositories/`, `src/components/storefront/`)
