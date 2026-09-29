# STORY-035: Reward Wallet & Referral Dashboard

**Status:** Done — see the STORY-035 entry in `docs/architecture-decisions.md`.
**Epic:** 06 — Customer Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer, I want to see my reward point balance, how I earned it, and how close I am to the next loyalty tier, so that I understand and stay engaged with the Rewards Club.

As a customer, I want to redeem my reward points for a benefit, so that my loyalty is worth something tangible.

As a Sri Lankan Expat sharing Oristor with family and friends abroad, I want a referral dashboard with my personal referral link and the status of everyone I've referred, so that I can track my referral rewards in one place.

## Description
This story is the customer-facing presentation layer for two engines built elsewhere in the Commerce epic: the points/tiers rules engine (STORY-030, Rewards / Loyalty Club) and the referral tracking and crediting logic (STORY-031, Referral Programme). It adds `/account/rewards` and `/account/referrals` under the account shell from STORY-033. This story does not define point values, tier thresholds, expiry rules, or referral payout amounts — it reads and displays what STORY-030/STORY-031 compute, and forwards redemption/share actions to their services. Maps to `docs/blueprint.md` Section 4 (Rewards Club, Referral Programme) and Section 9 item 6.

## Acceptance Criteria
- [x] `/account/rewards` shows the current point balance prominently, the customer's current tier/badge, and a progress bar toward the next tier's threshold
- [x] Point history is a paginated table (date, description, source — order/referral/redemption/expiry — points delta, running balance), newest first. No "review" source exists in the ledger's type enum (confirmed by reading it) — the other five are covered.
- [x] Points expiring within the policy window show a banner with the expiring amount and date
- [x] Customer can view available redemption options and see a resulting-balance preview before committing. Redemption itself is preview-only, not a mutation from this page — confirmed with the user: the rewards engine has no standalone (cart-independent) redemption mechanism, only checkout-time. See `docs/architecture-decisions.md`.
- [x] ~~Redemption is blocked with a clear message when the balance is insufficient~~ — n/a under the preview-only scope above: the dialog is disabled entirely when the balance is zero or redemption is unconfigured, and the live preview simply shows less value once the cap binds; there's no submit action to block.
- [x] `/account/referrals` shows the customer's unique referral link/code with a copy-to-clipboard button and a native share action (Web Share API where supported)
- [x] Referred-friends list shows each referral's status with a masked email. Two real states exist in the data model (Signed Up / Reward Earned), not the AC's four — see `docs/architecture-decisions.md` for why "Invited" and a distinct "purchase completed" state don't apply.
- [x] Total referral rewards earned is displayed, linking to the point history table
- [x] Both pages define an empty state per the AC's wording
- [x] Both pages are Server Components that call `rewards.service.ts`/`referral.service.ts` directly; no direct Prisma access from either page
- [x] Layout is responsive and reuses STORY-003's `Container`/`Section` primitives (via the STORY-033 account shell)

## Tasks
- [x] **Database:** None new — confirmed zero schema changes, zero migrations, zero `db push` needed for this story.
- [x] **API:** Reused STORY-030/031's existing `GET /api/rewards/balance`, `GET /api/referral/code`, `GET /api/referral/status` directly (each already anticipated this in its own doc comment). New: `GET /api/account/rewards/history` (running-balance history, a genuinely new shape STORY-030's own route doesn't provide). Dropped `POST /api/account/rewards/redeem` (nothing to call — preview-only) and `POST /api/account/referrals/link` (no regenerate capability exists in STORY-031). See `docs/architecture-decisions.md`.
- [x] **Service:** `customer-rewards-dashboard.service.ts` and `customer-referrals-dashboard.service.ts` — composition/formatting only, calling `rewards.service.ts`/`referral.service.ts`.
- [x] **Frontend:** `src/app/(storefront)/account/(dashboard)/{rewards,referrals}/page.tsx`; `TierProgressBar`, `PointHistoryTable`, `RedeemPointsDialog`, `ReferralLinkCard`, `ReferredFriendsList` under `src/components/storefront/account/`.
- [x] **Validation:** None new — the redemption preview needed no schema (client-side pure calculation, no request); `/api/account/rewards/history`'s query reuses STORY-030's existing `listRewardTransactionsQuerySchema`.
- [x] **Testing:** `customer-rewards-dashboard-service.test.ts` (tier-progress calculation, running balance + pagination, expiring-soon window); `customer-referrals-dashboard-service.test.ts` (status mapping, masking, referral-total aggregation); `tests/e2e/rewards-referrals-dashboard.spec.ts` (empty states, balance/history/redemption preview, referral link copy + a referred friend's status).
- [x] **Documentation:** Documented in `docs/architecture-decisions.md`: presentation-only scope, the preview-only redemption decision, the two-state (not four) referral status mapping, and the API-route reuse-vs-new-route decisions.

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-033 (Customer Dashboard) — provides the auth-guarded account shell this story nests inside, and the summary widgets this story's pages are linked from
- STORY-030 (Rewards / Loyalty Club) — owns the point rules, tiers, and redemption engine this story displays
- STORY-031 (Referral Programme) — owns referral link generation, friend-status tracking, and reward crediting this story displays

## Out of Scope
- Defining point-earning rules, tier thresholds, or point expiry policy (STORY-030)
- Defining referral reward amounts or fraud detection (STORY-031)
- Admin-side rewards/referral campaign management (Enterprise/Admin Platform epic, STORY-049)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Rewards Club, Referral Programme)
- `docs/blueprint.md` Section 5 (Customer management: rewards)
- `docs/blueprint.md` Section 9 item 6 (Customer Platform)
