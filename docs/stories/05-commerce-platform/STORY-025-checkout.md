# STORY-025: Checkout

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a Home Cook or Busy Professional with items in my cart, I want a clear, multi-step checkout (address, delivery, payment, review), so that I can complete my purchase quickly and with confidence that my order is correct before I pay.

As a Sri Lankan Expat ordering for delivery within Sri Lanka, I want to see the correct delivery zone and charge for my chosen address before I pay, so that there are no surprises at the payment step.

As a Distributor, I want checkout to reflect my negotiated pricing tier and let me enter/select a business delivery address, so that my order matches what was agreed.

## Description
This story implements the checkout flow that converts a cart (STORY-024) into a confirmed order (STORY-028): a multi-step wizard covering delivery address, delivery method/zone selection with pricing (STORY-027), payment (STORY-026), and a final review step, ending in order creation. It corresponds to the "Checkout → Payment → Order Confirmation" steps of the commerce lifecycle in `docs/blueprint.md` Section 5, and the Checkout entry in Section 4's site structure. Checkout is the orchestration layer — it does not own pricing-zone logic (STORY-027), payment-provider logic (STORY-026), or post-order status/ERP handling (STORY-028), but it is the flow that calls each of them in sequence and creates the order record.

## Acceptance Criteria
- [ ] Checkout is only reachable with a non-empty, revalidated cart (per STORY-024's revalidation logic); an empty cart redirects to the cart page.
- [ ] Checkout is a multi-step flow with clearly indicated steps: (1) Delivery Address, (2) Delivery Method/Zone, (3) Payment, (4) Review & Place Order — each step is individually validated before the customer can advance.
- [ ] Step 1 (Address): logged-in customers can select a saved address or enter a new one; guests must enter a delivery address inline (guest checkout is supported — an account is not required to purchase). Address form captures city/district (required for delivery-zone resolution per STORY-027) and validates required fields before proceeding.
- [ ] Step 2 (Delivery Method/Zone): the delivery zone is resolved from the entered address (per STORY-027) and the applicable delivery charge, estimated delivery window, and any free-shipping-threshold messaging are shown before the customer proceeds to payment.
- [ ] Step 3 (Payment): the customer selects a payment method and completes payment via the abstraction defined in STORY-026; checkout does not embed provider-specific logic directly (see STORY-026 for why the concrete gateway is not yet finalized).
- [ ] Step 4 (Review): the customer sees a final summary — line items, applied coupon (STORY-029) if any, delivery charge, applicable taxes, reward points to be earned, and grand total — before confirming.
- [ ] Placing the order is atomic: cart contents, resolved delivery charge, applied coupon, and payment confirmation are combined into a single Order record (STORY-028) with stock decremented/reserved as part of the same transaction; a failure at any point does not leave a partial/ghost order.
- [ ] On successful order placement, the customer is shown an order confirmation with an order number/reference and is redirected to the order confirmation view (STORY-028); the cart is then cleared.
- [ ] If payment fails or is declined, the customer is returned to the Payment step with a clear error and the cart/checkout state (address, zone, coupon) is preserved so they don't have to re-enter everything.
- [ ] Checkout re-validates price, stock, and coupon validity at the Review step (not just at cart level) immediately before order placement, to catch changes made mid-checkout.
- [ ] Checkout works for both guest and authenticated customers, and a guest is offered an optional "create an account" step post-order-confirmation without blocking the purchase.
- [ ] All checkout steps meet WCAG-appropriate form labeling, keyboard navigation, and error messaging (per blueprint Section 6 accessibility principle), and each step is usable at mobile breakpoints down to 375px.

## Tasks
- [ ] **Database:** Extend `prisma/schema.prisma` as needed for `Address` (if not already modeled in STORY-034/customer platform — coordinate to avoid duplication) with fields sufficient for delivery-zone resolution (city/district, postal code, country). Add a `CheckoutSession` concept only if state needs server-side persistence across steps (evaluate vs. client-side step state before adding a table).
- [ ] **API:** `POST /api/checkout/address` — validate and attach delivery address to the in-progress checkout.
- [ ] **API:** `POST /api/checkout/delivery` — resolve delivery zone/charge for the given address (delegates to STORY-027's shipping service).
- [ ] **API:** `POST /api/checkout/payment/intent` — create a payment intent/session via the payment service abstraction (STORY-026).
- [ ] **API:** `POST /api/checkout/place-order` — final step: revalidate cart/price/stock/coupon, confirm payment, create the Order (delegates to STORY-028's order service), clear the cart, return the order reference.
- [ ] **Service/Backend:** `checkout.service.ts` orchestrating the four steps, calling `cart.service.ts` (STORY-024), `shipping.service.ts` (STORY-027), `payment.service.ts` (STORY-026), `coupon.service.ts` (STORY-029), and `order.service.ts` (STORY-028) — checkout itself holds no pricing, zone, or payment-provider logic.
- [ ] **Service/Backend:** Transactional order-placement logic (Prisma `$transaction`) covering order creation, stock decrement/reservation, and coupon/reward-points application as a single atomic unit.
- [ ] **Frontend:** Multi-step checkout UI at `src/app/(storefront)/checkout/` with a step indicator, per-step forms (address, delivery, payment, review), and shared checkout state (React Hook Form + Zod per step, coordinated via a checkout context/store).
- [ ] **Frontend:** Guest checkout path (no forced login) with an inline "log in for faster checkout" affordance that does not block progress.
- [ ] **Frontend:** Order confirmation screen consuming the response from `place-order`.
- [ ] **Validation:** Zod schemas per step (`src/validation/checkout.schema.ts`) — address schema, delivery-selection schema, payment-method schema — each enforced both client-side (RHF) and server-side (API route) before advancing.
- [ ] **Testing:** Vitest unit tests for `checkout.service.ts` covering the happy path and the price/stock/coupon-changed-mid-checkout rejection path.
- [ ] **Testing:** Playwright e2e test covering the full guest checkout flow end to end using the sandbox/mock payment provider from STORY-026.
- [ ] **Documentation:** Document the checkout state machine (steps, allowed transitions, validation gates) in `docs/architecture-decisions.md`.

## Dependencies
- STORY-024 (Shopping Cart) — checkout consumes and clears the cart.
- STORY-026 (Payment Integration) — checkout's payment step calls the payment-service abstraction; note STORY-026 itself is blocked on a gateway-provider decision (blueprint Section 10), so checkout's payment step must be built against the abstraction/mock provider, not a named gateway.
- STORY-027 (Shipping & Delivery Zone Pricing) — checkout's delivery step calls the zone/rate resolution service.
- STORY-001/002/003 — foundation, design system, layout.
- STORY-009 (Product Catalogue Data Model) — pricing/stock data checkout revalidates against.

## Out of Scope
- Payment gateway-specific integration details (STORY-026).
- Delivery zone/rate admin configuration (STORY-055, admin epic).
- Post-order status pipeline, invoices, and ERP sync (STORY-028).
- Coupon rule authoring (STORY-029 covers redemption; campaign authoring is admin epic STORY-050).

## References
- `docs/blueprint.md` Section 4 (Site Structure — Checkout), Section 5 (Commerce lifecycle: Checkout → Payment → Order Confirmation)
- `docs/folder-structure.md` (`src/app/(storefront)/checkout/`)
