# STORY-024: Shopping Cart

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a Home Cook browsing the site, I want to add, update, and remove items in my cart without creating an account, so that I can decide what to buy before committing to checkout.

As a Busy Professional or Sri Lankan Expat who is logged in, I want my cart to persist across sessions and devices, so that items I picked earlier are still there when I come back.

As a Distributor placing bulk orders, I want line-item quantities and pricing to reflect my customer-group/wholesale pricing tier as soon as I change quantity, so that the cart always shows what I will actually be charged.

## Description
This story covers the shopping cart that sits between product discovery (Epic 03) and checkout (STORY-025): adding/updating/removing line items, a guest (anonymous/session-based) cart, a persistent cart for logged-in customers, and merge behavior when a guest with an active cart logs in. It implements the "Add to Cart" step of the commerce lifecycle in `docs/blueprint.md` Section 5 and must respect the pricing engine described in the same section (standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, volume-discount) when computing line totals, plus the reward-points-earned figure shown per product on the Product Detail Page (Section 4). Cart data depends on the product/pricing/inventory data model defined in STORY-009.

## Acceptance Criteria
- [ ] A customer can add a product (with a specific variant/SKU, if applicable) to the cart from the Product Detail Page or a listing card, specifying quantity, and the cart line item reflects the correct unit price for their pricing tier (standard/sale/campaign/customer-group/wholesale/distributor).
- [ ] A customer can increase/decrease quantity or remove a line item directly from the cart drawer/page, with totals recalculating immediately (optimistic UI update, reconciled against the server response).
- [ ] Adding a quantity that exceeds available stock (per STORY-009 inventory/reservation data) is blocked with a clear message, and the cart never allows checkout with a quantity greater than currently available stock.
- [ ] An anonymous (not logged in) visitor gets a guest cart persisted via a signed, httpOnly session/cart-token cookie, surviving page reloads and new tabs on the same browser.
- [ ] A logged-in customer's cart is persisted server-side (associated with their account) and is available identically across devices/browsers after login.
- [ ] When a guest with an active, non-empty cart logs in or registers, the guest cart is merged into their account cart (quantities combined for matching SKUs, distinct SKUs appended), and the guest cart/cookie is cleared after a successful merge.
- [ ] Cart line totals, subtotal, applicable volume-discount thresholds, and estimated reward points earned recalculate automatically whenever a line item, quantity, or the customer's pricing tier changes — no stale totals shown.
- [ ] The cart displays a per-line and cart-level indicator of reward points that will be earned on purchase, sourced from the product's reward-points field (STORY-009), and this figure updates live with quantity changes.
- [ ] The cart persists applied delivery-zone selection state (if already chosen) and coupon codes (STORY-029) across navigation, but the delivery/shipping charge itself is computed at checkout (STORY-027), not owned by the cart.
- [ ] Removing the last item empties the cart and the UI shows an empty-cart state with a call to action back to Products.
- [ ] Cart state is never lost due to a price or availability change made in the admin console mid-session — instead the cart re-validates against current price/stock on every mutation and on checkout entry, surfacing a "price changed" or "no longer available" notice per affected line rather than silently charging a stale price.
- [ ] A cart icon/badge in the primary navigation (STORY-004, out of scope here to build, but this story exposes the item-count data it consumes) reflects the current total item count.

## Tasks
- [ ] **Database:** Add `Cart`, `CartItem` models to `prisma/schema.prisma` — `Cart` keyed by either `userId` (nullable, logged-in) or `guestToken` (nullable, anonymous), with `CartItem` referencing `productId`/`variantId` (per STORY-009 catalogue schema), `quantity`, and a snapshot of unit price at time of add (for audit/diff against live price). Add indexes on `userId` and `guestToken`.
- [ ] **Database:** Add a migration and a cart-expiry/cleanup strategy for abandoned guest carts (e.g. `updatedAt` + scheduled cleanup job, documented but not necessarily implemented as a running job in this story).
- [ ] **API:** `GET /api/cart` — returns the current cart (guest or authenticated), resolved via cookie or session.
- [ ] **API:** `POST /api/cart/items` — add a line item (`productId`/`variantId`, `quantity`).
- [ ] **API:** `PATCH /api/cart/items/:id` — update quantity.
- [ ] **API:** `DELETE /api/cart/items/:id` — remove a line item.
- [ ] **API:** `POST /api/cart/merge` — merges guest cart into the authenticated user's cart, invoked from the NextAuth sign-in flow.
- [ ] **Service/Backend:** `cart.service.ts` implementing add/update/remove/merge/revalidate operations, calling `cart.repository.ts`, `product.repository.ts`, and the pricing-engine service (per STORY-009's pricing model) to resolve live unit prices per customer pricing tier.
- [ ] **Service/Backend:** `cart.repository.ts` — the only place `Cart`/`CartItem` Prisma models are queried/mutated.
- [ ] **Service/Backend:** Cart revalidation logic that re-checks price and stock for every line item on cart read and before handing off to checkout, flagging diffs rather than silently applying them.
- [ ] **Service/Backend:** Reward-points calculation helper (per-line and cart-level) sourced from product reward-points field, reusable by STORY-030.
- [ ] **Frontend:** Cart drawer/mini-cart component (`src/components/storefront/cart/`) for quick add/remove without leaving the current page.
- [ ] **Frontend:** Full cart page at `src/app/(storefront)/cart/page.tsx` with line items, quantity steppers, remove action, subtotal, reward-points-earned summary, and "Proceed to Checkout" CTA.
- [ ] **Frontend:** Zustand store or TanStack Query cache for optimistic cart mutations with rollback on server rejection (e.g. stock conflict).
- [ ] **Frontend:** Empty-cart state and price/availability-change notice components.
- [ ] **Validation:** Zod schemas for add/update-quantity payloads (`src/validation/cart.schema.ts`), enforcing quantity is a positive integer within any per-product max-order-quantity rule.
- [ ] **Testing:** Vitest unit tests for `cart.service.ts` covering add/update/remove/merge/revalidate logic, including the stock-exceeded and price-changed edge cases.
- [ ] **Testing:** Playwright e2e test: add item as guest → reload → item persists → log in → guest cart merges into account cart.
- [ ] **Documentation:** Document the guest-cart cookie strategy (name, expiry, security flags) and the merge algorithm in `docs/architecture-decisions.md`.

## Dependencies
- STORY-001 (Project Foundation Setup), STORY-002 (Design System & Theming), STORY-003 (Global Layout & Responsive Framework) — base app, auth, and layout scaffolding.
- STORY-009 (Product Catalogue Data Model) — product/variant/SKU, pricing engine, inventory, and reward-points fields the cart reads from.

## Out of Scope
- Delivery/shipping charge calculation (STORY-027) and the multi-step checkout flow itself (STORY-025).
- Coupon/promotion validation logic (STORY-029) — the cart only stores an applied coupon code reference.
- Wishlist ("save for later") behavior (STORY-013).
- Cart abandonment email/notification campaigns (STORY-032 / Enterprise Marketing Console, STORY-050).

## References
- `docs/blueprint.md` Section 4 (Site Structure — Shopping Cart), Section 5 (Commerce, Commerce lifecycle, Pricing engine)
- `docs/folder-structure.md` (`src/app/(storefront)/cart/`, `src/services/`, `src/repositories/`)
