# STORY-060: AI Product Recommendations

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the full write-up and scope decisions.

**Epic:** 08 — AI Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to see products recommended to me based on what I've bought and browsed before, so that I discover new items relevant to how I actually cook.
As a Gourmet Food Enthusiast, I want a "You May Also Like" section on product pages, so that I can find complementary premium items I might not have searched for.
As a Busy Professional, I want relevant cross-sell suggestions while I'm in my cart, so that I can add what I'm likely to need in one trip instead of reordering later.

## Description
This story delivers the personalized product recommendation engine called out in `docs/blueprint.md` Section 1 ("AI & Data Intelligence" pillar), Section 5 ("AI features: recommendations"), and Section 9 item 8 ("AI Platform"). It surfaces recommendations in three places: the homepage's "Best Selling Products" section (upgraded to "Recommended for You" when personalized), "You May Also Like" / "Frequently Bought Together" sections on the Product Detail Page, and cross-sell suggestions in the cart. It is built as a Service Layer module with a swappable recommendation-strategy interface (rules-based fallback plus a co-occurrence/collaborative model) so the algorithm can evolve without touching call sites, and it consumes signals from the product catalogue (STORY-009), order history (STORY-028), wishlist (STORY-013), and browsing behavior. This is classical recommendation logic (SQL aggregation / co-occurrence counting) — no external AI/LLM provider is involved, and none is needed for this story.

## Acceptance Criteria
- [x] Homepage renders a "Recommended for You" rail for logged-in customers with sufficient interaction history (purchases, views, wishlist adds)
- [x] Anonymous visitors and new customers with no history see a cold-start fallback (best-sellers / trending-in-category) instead of an empty or broken rail
- [x] Product Detail Page renders a "You May Also Like" section (similar products by category/attributes) and a separate "Frequently Bought Together" section (co-purchase association)
- [x] Cart page/drawer renders cross-sell suggestions derived from current cart contents (complementary items, commonly-paired products)
- [x] Recommendations never include out-of-stock products or products already present in the customer's cart
- [x] Recommendation impressions, clicks, and resulting add-to-cart events are tracked to support future model evaluation and A/B testing
- [x] The active recommendation strategy (rules-based vs. behavior-based) is selectable via configuration/feature flag without a code deploy, consistent with the feature-flag capability described for System Settings in `docs/blueprint.md` Section 7
- [x] Recommendation results respect a defined recency window — recomputed via an admin-triggered batch action (no real cron exists in this codebase — see Scope Decisions), with live per-request ranking for the current visit
- [x] Recommendation API endpoints meet the platform's <300ms response budget (`docs/blueprint.md` Section 6), using precomputed/cached result sets rather than computing similarity at request time
- [x] No PII is included in recommendation API payloads or logs; only product IDs, scores, and anonymized/session identifiers
- [x] Recommendation rails/carousels are fully responsive and keyboard-navigable, meeting WCAG 2.1 AA

## Scope Decisions

- **`ProductInteractionEvent` tracks View/AddToCart/WishlistAdd only — no `Purchase` row.** `OrderItem` already captures purchases with full fidelity (userId via Order, productId, quantity, createdAt); duplicating it into a second table would be redundant storage with no added signal. Every strategy reads purchase signal from `OrderItem` directly — the same "don't duplicate an existing signal" call STORY-059a's CLV already made.
- **VIEW/ADD_TO_CART/WISHLIST_ADD are recorded server-side, inline, at their natural read/mutation point** (`product.service.ts::getProductDetail`, `cart.service.ts::addItem`, `wishlist.service.ts::addToWishlist`) — not via a generic client-side tracking POST, which is reserved for `RecommendationEvent` (impression/click/add-to-cart *of a recommended product specifically*, a signal only the client can report).
- **No cron exists in this codebase — `ProductAssociation` only recomputes when triggered.** The third time this session hit this constraint (after STORY-050d and STORY-059c, both resolved the same way): `POST /api/admin/recommendations/recompute` is a real, gated, callable endpoint (no placeholder), triggerable via curl/an ops runbook today and a real target for an actual cron once hosting is confirmed. No new admin console page — the AC never asked for one, and building one would be unrequested scope. Also run once from `prisma/seed.ts` so dev/demo/e2e environments always have real (if initially empty) `ProductAssociation` data.
- **Anonymous session correlation uses a lightweight, unsigned cookie (`rec_sid`)** — deliberately not a reuse of the cart's signed HMAC guest-token mechanism, which guards a materially higher-stakes concern (cart content integrity) than this soft personalization/telemetry signal.
- **"You May Also Like" absorbed the PDP's existing category-match "Related Products" section rather than duplicating it** — `recommendation.service.ts::getSimilarProducts` reads precomputed `Similar` associations when available, falling back to the exact same category-match query (`product.service.ts::listRelatedProducts`) a product with no association data yet already had. The old standalone `RelatedProducts` component was removed as redundant.
- **"Frequently Bought Together" is honestly omitted, not rules-based-fallback-filled, when there's no real co-purchase data** — same honesty standard this session has applied consistently to every missing-data case (059b's funnel, 059c's Core Web Vitals).
- **`getBestSellingProductIds` is new to `recommendation.repository.ts`, not a fix to `product.service.ts`'s existing `"best-selling"` list-sort option** — that sort is a known, separate, pre-existing no-op (silently falls back to "newest," per its own code comment, left over from before `Order` existed). Deliberately out of scope here to avoid touching an already-shipped, tested listing feature; noted as a related, still-open gap.

## Tasks

- [x] **Database:**
  - [x] `ProductInteractionEvent` (id, customerId?, sessionId?, productId, eventType [View/AddToCart/WishlistAdd], createdAt) — no Purchase type, see Scope Decisions
  - [x] `ProductAssociation` (sourceProductId, targetProductId, associationType [Similar/FrequentlyBoughtTogether], score, computedAt), unique on the (source, target, type) triple for upsert-by-replace
  - [x] `RecommendationEvent` (id, customerId?, sessionId?, placement [Homepage/Pdp/Cart], productId, action [Impression/Click/AddToCart], createdAt)
  - [x] Indexes on customerId/productId/sourceProductId+type/placement+action
  - [x] No migration file (this session's established `db push` dev workflow); seeded via `recomputeProductAssociations` run once at the end of `prisma/seed.ts`

- [x] **API:**
  - [x] `GET /api/recommendations/homepage`
  - [x] `GET /api/recommendations/product/[id]`
  - [x] `POST /api/recommendations/cart`
  - [x] `POST /api/recommendations/track`
  - [x] `POST /api/admin/recommendations/recompute` (the nightly-batch trigger — see Scope Decisions)
  - [x] All endpoints call the Service Layer only; stock and cart-exclusion filtering enforced server-side

- [x] **Service/Backend:**
  - [x] `recommendation.service.ts` — `RecommendationStrategy` interface, `RulesBasedStrategy` (best-sellers cold-start) and `CoOccurrenceStrategy` (precomputed associations), selected via `isFeatureEnabled("recommendations.behavior-based")` plus a cold-start interaction-count threshold
  - [x] `recommendation.repository.ts` — the only file querying the 3 new models directly
  - [x] Admin-triggered recompute (not a nightly cron — see Scope Decisions)
  - [x] Cold-start detection (interaction count below threshold forces the rules-based strategy)
  - [x] Precomputed `ProductAssociation` rows are the caching layer (no separate cache — this codebase has none anywhere; reading precomputed rows at request time meets the response-time budget the same way every other story's own "no cache" sections do)

- [x] **Frontend:**
  - [x] `RecommendationRail` (`src/components/storefront/recommendations/`), reused across homepage/PDP/cart with a `placement` prop
  - [x] Homepage: `BestSellingProducts` upgraded from a typed-fixture placeholder (STORY-042's deliberately-deferred scope) to a real, self-fetching async Server Component — same pattern `FeaturedRecipes` already established
  - [x] PDP: "You May Also Like" (absorbs the old `RelatedProducts`) and "Frequently Bought Together"
  - [x] Cart page and drawer cross-sell
  - [x] Impression tracking (IntersectionObserver) and click tracking wired to `/api/recommendations/track`

- [x] **Validation:**
  - [x] `recommendation.schema.ts` — capped product-ID array for the cart endpoint, placement/action enums for tracking

- [x] **Testing:**
  - [x] `tests/unit/recommendation-service.test.ts` — both strategies including cold-start threshold, out-of-stock/in-cart exclusion, the feature-flag switch, Similar-fallback-to-category-match, FrequentlyBoughtTogether honesty, `recomputeProductAssociations` directional pair-writing and permission gating (11 tests)
  - [x] `tests/e2e/recommendations.spec.ts` — real seeded co-purchase data driving the homepage cold-start rail, PDP Frequently Bought Together, cart cross-sell, and a recommended-product click navigating correctly; a dedicated axe accessibility pass on the homepage rail
  - [x] Regression-verified cart/wishlist/product-detail unit tests after the inline-tracking changes — caught and fixed a real bug along the way (see architecture-decisions.md: `cookies()` called outside a request scope)

- [x] **Documentation:**
  - [x] This file; `docs/architecture-decisions.md` 2026-10-04 entry documents the `RecommendationStrategy` interface, the 3 new models' shape, and how to add a new strategy without touching call sites

## Dependencies
- STORY-009 (Product Catalogue Data Model) — recommendations reference products, stock status, and categories
- STORY-011 (Product Detail Page) — hosts the "You May Also Like" / "Frequently Bought Together" sections
- STORY-024 (Shopping Cart) — hosts cross-sell suggestions and supplies current cart contents
- STORY-028 (Order Management) — purchase history is the primary signal for behavior-based recommendations
- STORY-013 (Wishlist) — secondary interaction signal
- STORY-006 (Homepage) — hosts the personalized rail
- STORY-054 (System Settings) — `isFeatureEnabled()`, reused directly for the strategy flag
- STORY-050d / STORY-059c — the "no cron exists, admin-triggered process-now action" pattern this story repeats a third time

## Out of Scope
- Demand forecasting / inventory prediction (deferred; see STORY-064)
- Email or WhatsApp recommendation campaigns (belongs to Marketing Console, STORY-050)
- Price optimization or dynamic pricing based on recommendation data
- Fixing `product.service.ts`'s pre-existing `"best-selling"` list-sort no-op (a separate, already-existing gap — see Scope Decisions)

## References
- `docs/blueprint.md` Section 1 (AI & Data Intelligence pillar)
- `docs/blueprint.md` Section 5 (AI features: recommendations)
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/architecture-decisions.md` 2026-10-04 entry
