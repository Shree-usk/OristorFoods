# STORY-030: Rewards / Loyalty Club

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a repeat customer, I want to earn reward points on my purchases and see my point balance grow, so that I'm rewarded for my loyalty to Oristor.

As an engaged customer, I want to reach loyalty tiers/badges based on my activity, so that I feel recognized and unlock better benefits over time.

As a customer with a reward balance, I want to redeem points toward a future order, so that my loyalty translates into real savings.

## Description
This story implements the points-earning and points-redemption rules engine, tier/badge progression, and the underlying reward-wallet balance that powers the "Rewards Club" feature named in `docs/blueprint.md` Section 4 (site structure) and Section 5 (Commerce lifecycle: "... → Delivery → Review → Rewards → Referral → Repeat Purchase"). It is the backend/rules engine for loyalty — the customer-facing reward-wallet dashboard view (balance history, redeem UI, tier progress visualization) is **STORY-035 (Reward Wallet & Referral Dashboard)** in the Customer Platform epic, referenced here as the consumer of this story's data, not duplicated. Point rules, tier thresholds, and badge criteria are admin-configurable per Section 7 ("Rewards & Referrals — campaign creation, point rules, badges, fraud monitoring"), so this story reads its rules from admin-managed configuration rather than hardcoding values.

## Acceptance Criteria
- [ ] A customer earns reward points automatically when an order reaches the `Confirmed` (or admin-configured qualifying) status (per STORY-028's order-status pipeline), calculated from each order line's reward-points-per-product field (STORY-009) and/or an order-value-based rule, per whichever rule set is admin-configured.
- [ ] Points earned per order are not credited until the order reaches its qualifying status, and are reversed/clawed back if the order is later cancelled or fully refunded (per STORY-028's cancellation flow), preventing point farming via buy-then-cancel.
- [ ] A customer's reward-point balance is queryable via a service/API and always reflects the sum of all earned, redeemed, expired, and reversed point transactions — the balance is derived from an auditable ledger, not a single mutable counter, so history can be reconstructed and disputes investigated.
- [ ] A customer can redeem available points toward an order at checkout (STORY-025), converting points to a discount using the admin-configured points-to-currency conversion rate, with redemption capped by both the customer's available balance and any admin-configured max-redemption-per-order rule.
- [ ] Attempting to redeem more points than the customer's current balance, or more than the per-order cap allows, is rejected with a clear message; redemption is validated server-side even if the client UI already constrains input.
- [ ] Redeeming points at checkout places a hold/deduction on the balance atomically with order placement (consistent with STORY-025's atomic order-placement requirement) — a failed order does not leave points debited with nothing to show for it.
- [ ] The rules engine evaluates a customer's tier (e.g. based on lifetime points earned, total spend, or order count — per admin-configured tier thresholds) and updates their current tier when a qualifying transaction changes their standing, without requiring a manual admin action per customer.
- [ ] Badges are awarded based on admin-configured criteria (e.g. first purchase, N orders, review milestones) evaluated at the relevant trigger point (order confirmed, review submitted, etc.), recorded per customer with the date earned.
- [ ] Point rules, tier thresholds, badge criteria, and the points-to-currency conversion rate are all read from admin-managed configuration (STORY-049, Rewards & Referrals Campaign Management) — this story's rules engine contains no hardcoded point values, tier cutoffs, or conversion rates.
- [ ] If admin-configured rules data is missing/unavailable, the rules engine fails safe (no points awarded/redeemed, order still completes) rather than blocking checkout or awarding an undefined amount.
- [ ] Points have an admin-configurable expiry window (if the business rule calls for one); expired points are removed from the redeemable balance via a documented process (scheduled job or on-read lazy expiry), and the ledger records the expiry as its own transaction type for auditability.

## Tasks
- [ ] **Database:** Add `RewardAccount` (or derive balance from ledger directly), `RewardTransaction` (type: `EARNED`/`REDEEMED`/`REVERSED`/`EXPIRED`, amount, source order/reference, timestamp), `RewardTier`, and `Badge`/`CustomerBadge` models to `prisma/schema.prisma`. Point rules, tier thresholds, and badge criteria reference admin-managed config models owned by STORY-049 — coordinate schema ownership rather than duplicating.
- [ ] **API:** `GET /api/rewards/balance` — current point balance and tier for the authenticated customer.
- [ ] **API:** `GET /api/rewards/transactions` — paginated ledger history, consumed by STORY-035.
- [ ] **API:** `POST /api/rewards/redeem` — validate and apply a point redemption to the in-progress checkout.
- [ ] **Service/Backend:** `rewards.service.ts` — earn calculation (triggered on order-confirmed event from STORY-028), redemption validation/application, tier evaluation, badge evaluation, and expiry handling, all driven by admin-configured rules rather than hardcoded constants.
- [ ] **Service/Backend:** `rewards.repository.ts` — the only place `RewardTransaction`/`RewardTier`/`Badge` Prisma models are queried/mutated.
- [ ] **Service/Backend:** Subscribe to/handle the `order.confirmed` and `order.cancelled` integration events emitted by `order.service.ts` (STORY-028) to trigger point award and clawback respectively, keeping rewards decoupled from order logic rather than order.service.ts reaching into rewards internals.
- [ ] **Frontend:** Points-earned indicator surfaced in cart (STORY-024) and checkout review (STORY-025) — this story supplies the calculation the earlier stories already reference; ensure calculation logic lives here as the single source of truth.
- [ ] **Frontend:** Redeem-points control in the checkout Payment/Review step (input capped by balance and per-order max, live discount preview).
- [ ] **Validation:** Zod schema for redemption requests (`src/validation/rewards.schema.ts`) enforcing positive integer point amount within allowed bounds.
- [ ] **Testing:** Vitest unit tests for `rewards.service.ts` covering earn calculation, redemption cap enforcement, clawback on cancellation, tier transition boundaries, badge-award triggers, and expiry.
- [ ] **Testing:** Playwright e2e test: complete an order → confirm points credited → redeem points on a subsequent order → confirm discount applied and balance decremented correctly.
- [ ] **Documentation:** Document the ledger-based balance model and the tier/badge rule-evaluation trigger points in `docs/architecture-decisions.md`.

## Dependencies
- STORY-028 (Order Management) — points are earned/reversed off order-status events.
- STORY-025 (Checkout) — redemption happens during checkout.
- STORY-009 (Product Catalogue Data Model) — per-product reward-points field.
- STORY-049 (Rewards & Referrals Campaign Management, Admin epic) — related: this story's rules engine reads point rules, tier thresholds, badge criteria, and conversion rate from admin-managed configuration owned there.

## Out of Scope
- Customer-facing reward wallet dashboard UI (balance history view, tier progress visualization, badge showcase) — STORY-035, Customer Platform epic.
- Admin campaign creation, point-rule authoring UI, and fraud-monitoring dashboards — STORY-049.
- Referral-specific reward payouts (STORY-031 covers referral mechanics separately, though it may call into this story's ledger to credit referral rewards).

## References
- `docs/blueprint.md` Section 4 (Site Structure — Rewards Club), Section 5 (Commerce lifecycle — Rewards), Section 7 (Rewards & Referrals module)
