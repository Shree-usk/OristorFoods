# STORY-049: Rewards & Referrals Campaign Management

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator, Finance Manager

## User Story
As a Marketing Manager, I want to create reward campaigns, point-earning rules, and loyalty badges, so that I can drive engagement without engineering involvement.
As a Super Administrator, I want fraud monitoring on rewards and referrals, so that abuse like self-referral or fake accounts is caught before it costs the business.

## Description
This story delivers the Rewards & Referrals console module from `docs/blueprint.md` Section 7: "campaign creation, point rules, badges, fraud monitoring." It is the admin configuration surface for the rules that the storefront Rewards / Loyalty Club (STORY-030) and Referral Programme (STORY-031) run on, and is consumed by STORY-045 (Reviews Moderation) and STORY-048 (Customers Console) for their reward-customer/manual-grant actions.

## Acceptance Criteria
- [ ] A campaign builder creates a named reward campaign with a date range, target audience (all customers or a segment), and a point multiplier or bonus rule, with an active/inactive toggle
- [ ] Point rule configuration defines how points are earned (per currency spent, per action such as review/referral/signup) and how they're redeemed (points-to-currency ratio, minimum redemption amount, expiry period)
- [ ] Badge/tier management defines loyalty tiers (e.g. Bronze/Silver/Gold) with qualifying thresholds and perks, plus one-off achievement badges
- [ ] Referral rule configuration defines the referrer reward, referee reward, the qualifying action (e.g. referee's first purchase), and fraud thresholds (e.g. maximum referrals per customer per period)
- [ ] A fraud monitoring view flags suspicious patterns (shared address/payment method between referrer and referee, abnormal redemption velocity) in a review queue, with actions to approve or reverse a flagged reward
- [ ] Campaign, point rule, and badge changes take effect without a redeploy
- [ ] Every campaign/rule/badge CRUD action and fraud-flag resolution is recorded in the audit log (STORY-057)

## Tasks
- [ ] **Database:** `RewardCampaign` (name, dateRange, audience, multiplier/bonus, active), `PointRule`, `LoyaltyTier`, `Badge`, `ReferralRule` (referrerReward, refereeReward, qualifyingAction, fraudThresholds), `FraudFlag` (customerId, type, details, status, resolvedById).
- [ ] **API:** `/api/admin/rewards/campaigns`, `/api/admin/rewards/point-rules`, `/api/admin/rewards/tiers`, `/api/admin/rewards/badges`, `/api/admin/referrals/rules`, `/api/admin/rewards/fraud-flags`.
- [ ] **Service/Backend:** `reward-campaign.service.ts`, `referral-rule.service.ts`, and `fraud-detection.service.ts` implementing rule-based heuristics (velocity limits, shared identifiers), designed to be extensible for future AI-assisted scoring (STORY-064).
- [ ] **Frontend:** `src/app/(admin)/marketing/rewards-referrals/page.tsx` with tabs for Campaigns, Point Rules, Tiers & Badges, Referral Rules, and a Fraud Queue.
- [ ] **Validation:** Zod schemas enforcing positive point ratios, valid date ranges, and bounded fraud thresholds.
- [ ] **Testing:** Unit tests for point-rule calculation and fraud-heuristic trigger conditions; e2e test creating a campaign and confirming point accrual reflects the new multiplier on a test purchase.
- [ ] **Documentation:** Document the v1 fraud heuristics implemented here and flag which are candidates for future AI-assisted detection (ties to STORY-064).

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-030 (Rewards / Loyalty Club), STORY-031 (Referral Programme) — this console configures the rules those storefront features run on

## References
- `docs/blueprint.md` Section 7 ("Rewards & Referrals" console module bullet)
