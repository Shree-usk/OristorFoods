# STORY-029: Coupons & Promotions

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer with a coupon code, I want to apply it at my cart or at checkout and immediately see the discount reflected in my total, so that I know I'm getting the promised deal before I pay.

As a customer browsing during a seasonal campaign, I want qualifying discounts to be applied automatically where appropriate, so that I don't have to hunt for a code to get an advertised price.

## Description
This story implements coupon-code redemption and campaign-based promotion evaluation at cart (STORY-024) and checkout (STORY-025): validating a code, computing its discount against the current cart, and applying campaign-driven promotions (e.g. automatic percentage-off during a sale window) alongside the pricing engine from `docs/blueprint.md` Section 5. It corresponds to the "Marketing Console" campaigns and coupons capability in Section 7 (admin authoring — seasonal campaigns, coupons, referral/reward campaigns) — this story is the customer-facing redemption/evaluation side; campaign and coupon *authoring* is an admin-console concern (STORY-050, Marketing Console) and is referenced, not duplicated, here.

## Acceptance Criteria
- [ ] A customer can enter a coupon code at the cart or at the checkout Review step; the code is validated server-side (existence, active date range, usage limits, minimum-order-value rule, applicable product/category scope, and per-customer redemption limit) before being applied.
- [ ] An invalid, expired, exhausted, or not-yet-eligible (e.g. minimum order value not met) coupon code shows a specific, actionable error message rather than a generic "invalid code."
- [ ] A valid coupon's discount (percentage-off, fixed-amount-off, or free-shipping-equivalent — matching whatever discount types the admin campaign model, STORY-050, supports) is calculated against the current cart contents and reflected in the cart/checkout total immediately, recalculating automatically if cart contents change while the coupon is applied.
- [ ] A coupon can be removed by the customer before payment, reverting the total to the pre-discount amount.
- [ ] Only one coupon code may be active per order unless the admin campaign model explicitly allows stacking (default: no stacking) — the system enforces whatever the campaign configuration specifies rather than hardcoding a single global rule that can't be changed without a redeploy.
- [ ] Campaign-based automatic promotions (no code required — e.g. "10% off all products this week") configured in the admin Marketing Console are evaluated against the cart and applied automatically at cart/checkout without requiring the customer to do anything, and are clearly labeled in the order summary as to why the discount applied.
- [ ] If both a manually-entered coupon and an automatic campaign promotion could apply, the interaction (stack, take-best, or campaign-takes-precedence) is resolved deterministically per the admin campaign configuration, and the applied outcome is transparent to the customer in the order summary (what discount came from what source).
- [ ] Coupon redemption is recorded (which customer, which order, which coupon, discount amount) so per-customer and global usage-limit enforcement is accurate for subsequent redemption attempts, and so the admin console (STORY-050) can report redemption counts.
- [ ] Coupon/promotion validity is re-checked at checkout's final Review step (not just when first applied to the cart) to catch a coupon expiring or exhausting its usage limit mid-checkout, consistent with STORY-025's re-validation requirement.
- [ ] Distributor/wholesale customer-group pricing (STORY-009's pricing engine) and coupon discounts compose correctly and predictably — the acceptance criteria for exactly how (e.g. coupon applies after tier pricing, or is restricted from wholesale orders) is explicit in the implementation rather than left ambiguous.

## Tasks
- [ ] **Database:** Add `Coupon`, `CouponRedemption`, and `Promotion` (or `Campaign`) models to `prisma/schema.prisma` (or extend the models STORY-050 defines for admin authoring — coordinate schema ownership so this story doesn't duplicate it) — `Coupon` includes code, discount type/value, active date range, min-order-value, usage limits (global/per-customer), scope (all products / specific categories / specific products); `CouponRedemption` links `couponId`, `customerId`/`guestId`, `orderId`, `discountAmount`.
- [ ] **API:** `POST /api/cart/coupon` — validate and apply a coupon code to the current cart.
- [ ] **API:** `DELETE /api/cart/coupon` — remove the applied coupon.
- [ ] **API:** Internal service call (not necessarily a public endpoint) used by `checkout.service.ts` to re-validate the applied coupon and evaluate active automatic promotions at the Review step.
- [ ] **Service/Backend:** `coupon.service.ts` — code validation (existence, date range, usage limits, min-order-value, scope), discount calculation against cart contents, and redemption recording.
- [ ] **Service/Backend:** `promotion.service.ts` — evaluates active campaign-based automatic promotions against a cart and returns applicable discounts plus their precedence relative to manually-applied coupons.
- [ ] **Service/Backend:** `coupon.repository.ts` — the only place `Coupon`/`CouponRedemption`/`Promotion` Prisma models are queried/mutated from this story's services.
- [ ] **Frontend:** Coupon-code input component in the cart drawer/page and the checkout Review step, with inline validation feedback and a "remove" action.
- [ ] **Frontend:** Order-summary line items clearly labeling each applied discount and its source (coupon code vs. automatic campaign name).
- [ ] **Validation:** Zod schema for coupon-code submission (`src/validation/coupon.schema.ts`) — code format, required cart context.
- [ ] **Testing:** Vitest unit tests for `coupon.service.ts` covering valid/expired/exhausted/min-value-not-met/wrong-scope cases, and `promotion.service.ts` covering the stacking/take-best/precedence rule.
- [ ] **Testing:** Playwright e2e test: add items below min-order-value → coupon rejected with reason → add more items → coupon accepted → total reflects discount → proceed through checkout with discount intact.
- [ ] **Documentation:** Document the discount-composition rule (tier pricing vs. coupon vs. campaign promotion, and the precedence/stacking decision) in `docs/architecture-decisions.md`.

## Dependencies
- STORY-024 (Shopping Cart) — coupon application happens at cart level.
- STORY-025 (Checkout) — coupon re-validated at Review step.
- STORY-009 (Product Catalogue Data Model) — pricing engine and category/product scoping for coupon eligibility.
- STORY-050 (Marketing Console, Admin epic) — related: campaign/coupon authoring UI is admin-side; this story is the customer-facing redemption/evaluation engine consuming that data, not duplicating its authoring workflow.

## Out of Scope
- Admin coupon/campaign creation UI, bulk coupon generation, and redemption reporting dashboards (STORY-050).
- Referral-specific reward coupons (STORY-031 covers referral payout mechanics; if referral rewards take the form of a coupon, it reuses this story's redemption engine rather than building a separate one).
- A/B testing or targeted/segmented promotion delivery.

## References
- `docs/blueprint.md` Section 5 (Pricing engine), Section 7 (Marketing Console — coupons, seasonal campaigns)
