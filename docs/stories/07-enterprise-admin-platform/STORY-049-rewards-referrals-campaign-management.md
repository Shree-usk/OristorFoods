# STORY-049: Rewards & Referrals Campaign Management

**Status:** Done (core scope) — see `docs/architecture-decisions.md` 2026-10-02 entry for deviations (shared-address check moved to the referral's qualifying step rather than registration; orderValuePointsRate wired additively, not as a replacement earning mode; "shared payment method" fraud check deferred — no real payment data exists while the gateway is unconfirmed).
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator, Finance Manager

## User Story
As a Marketing Manager, I want to create reward campaigns, point-earning rules, and loyalty badges, so that I can drive engagement without engineering involvement.
As a Super Administrator, I want fraud monitoring on rewards and referrals, so that abuse like self-referral or fake accounts is caught before it costs the business.

## Description
This story delivers the Rewards & Referrals console module from `docs/blueprint.md` Section 7: "campaign creation, point rules, badges, fraud monitoring." It is the admin configuration surface for the rules that the storefront Rewards / Loyalty Club (STORY-030) and Referral Programme (STORY-031) run on, and is consumed by STORY-045 (Reviews Moderation) and STORY-048 (Customers Console) for their reward-customer/manual-grant actions.

## Acceptance Criteria
- [x] A campaign builder creates a named reward campaign with a date range, target audience (all customers or a segment), and a point multiplier, with an active/inactive toggle — audience reuses the existing `CustomerGroup` segmentation (STORY-071) rather than a new concept; "bonus rule" is covered by the multiplier (no separate flat-bonus mode)
- [x] Point rule configuration defines how points are earned (per-product, already shipped; an additive per-currency-spent bonus, new) and how they're redeemed (points-to-currency ratio, minimum/max redemption, expiry period) — all via `RewardSetting`
- [x] Badge/tier management defines loyalty tiers with qualifying thresholds, plus one-off achievement badges — via `RewardTier`/`Badge` CRUD
- [x] Referral rule configuration defines the referrer reward, referee welcome bonus, the qualifying order value, and fraud thresholds (max referrals per customer per period)
- [x] A fraud monitoring view flags suspicious patterns (shared referrer/referred address, referral velocity, redemption velocity) in a review queue, with actions to approve or reverse a flagged reward — "shared payment method" is explicitly not implemented, no real payment data exists while the gateway is unconfirmed (blueprint Section 10)
- [x] Campaign, point rule, tier/badge, and referral rule changes take effect without a redeploy — all are live DB config, read fresh on every relevant cart/referral operation
- [x] Every campaign/rule/tier/badge CRUD action and fraud-flag resolution is recorded in the audit log

## Tasks
- [x] **Database:** `RewardCampaign` (name, startDate, endDate, targetCustomerGroup, pointsMultiplier, isActive); `FraudFlag` (customerId, type, details, relatedRewardTransactionId, relatedReferralAttributionId, status, resolvedById); `ReferralSetting` gained `maxReferralsPerPeriod`/`referralPeriodDays`. No new PointRule/LoyaltyTier/ReferralRule models — `RewardSetting`/`RewardTier`/`Badge`/`ReferralSetting` already existed from STORY-030/031, just without a write path.
- [x] **API:** `/api/admin/rewards/campaigns`, `/api/admin/rewards/settings`, `/api/admin/rewards/tiers`, `/api/admin/rewards/badges`, `/api/admin/referrals/settings`, `/api/admin/rewards/fraud-flags` (+`/approve`, `/reverse`).
- [x] **Service/Backend:** `reward-campaign.service.ts`, extensions to `rewards.service.ts`/`referral.service.ts` for admin CRUD, and `fraud-detection.service.ts` implementing rule-based heuristics (velocity limits, shared address) — each heuristic documented as a concrete candidate for future AI-assisted scoring (STORY-064).
- [x] **Frontend:** `src/app/(admin)/admin/rewards-referrals/page.tsx` with tabs for Campaigns, Point Rules, Tiers & Badges, Referral Rules, and a Fraud Queue.
- [x] **Validation:** `reward-campaign.schema.ts`, `rewards-admin.schema.ts`, `referral-admin.schema.ts`, `fraud-flag.schema.ts` — positive multipliers/rates, valid date ranges, bounded thresholds.
- [x] **Testing:** `tests/unit/reward-campaign-service.test.ts`, `rewards-admin-service.test.ts`, `referral-admin-service.test.ts`, `fraud-detection-service.test.ts`; `tests/e2e/admin-rewards-referrals.spec.ts` creates a campaign and confirms a real cart's point accrual reflects the new multiplier via the live `/api/cart` route.
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02 entry documents the v1 fraud heuristics implemented, the deferred shared-payment-method check, and both tie to STORY-064.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-030 (Rewards / Loyalty Club), STORY-031 (Referral Programme) — this console configures the rules those storefront features run on

## References
- `docs/blueprint.md` Section 7 ("Rewards & Referrals" console module bullet)
