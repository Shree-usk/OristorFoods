# STORY-035: Reward Wallet & Referral Dashboard

**Status:** Draft
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
- [ ] `/account/rewards` shows the current point balance prominently, the customer's current tier/badge, and a progress bar toward the next tier's threshold
- [ ] Point history is a paginated table (date, description, source — order/review/referral/redemption/expiry, points delta, running balance), newest first
- [ ] Points expiring within the policy window (as surfaced by STORY-030) show a banner with the expiring amount and date
- [ ] Customer can view available redemption options (as defined by STORY-030's rules) and redeem points via a confirmation dialog that shows the resulting balance before committing
- [ ] Redemption is blocked with a clear message when the balance is insufficient for the selected option
- [ ] `/account/referrals` shows the customer's unique referral link/code with a copy-to-clipboard button and a native share action (Web Share API where supported, clipboard fallback otherwise)
- [ ] Referred-friends list shows each referral's status (Invited / Signed Up / First Purchase Completed / Reward Earned) with an anonymized identifier (first name + masked email, e.g. `j***@gmail.com`)
- [ ] Total referral rewards earned is displayed, linking to the corresponding entries in the point history table
- [ ] Both pages define an empty state: "You haven't earned any points yet — shop to start earning" and "You haven't referred anyone yet — share your link"
- [ ] Both pages are Server Components that stream data from `reward.service.ts` and `referral.service.ts` (owned by STORY-030/STORY-031); no direct Prisma access from these pages or their route handlers
- [ ] Layout is responsive at 375px–1440px and reuses STORY-003's `Container`/`Section` primitives

## Tasks
- [ ] **Database:** None new. This story reads the `RewardTransaction`, `RewardTier`, and `Referral` models owned by STORY-030 and STORY-031. If those stories haven't yet indexed for account-page listing, add `(userId, createdAt)` indexes as part of this story's database task rather than duplicating the tables.
- [ ] **API:** `GET /api/account/rewards/summary`, `GET /api/account/rewards/history` (paginated), `POST /api/account/rewards/redeem`, `GET /api/account/referrals/summary`, `POST /api/account/referrals/link` (regenerate link if supported by STORY-031).
- [ ] **Service:** `customer-rewards-dashboard.service.ts` and `customer-referrals-dashboard.service.ts` — thin composition/formatting layers that call `reward.service.ts` (STORY-030) and `referral.service.ts` (STORY-031); no point-calculation or referral-crediting logic is written in this story.
- [ ] **Frontend:** `src/app/(storefront)/account/rewards/page.tsx`, `account/referrals/page.tsx`; `RewardBalanceCard`, `TierProgressBar`, `PointHistoryTable`, `RedeemDialog`, `ReferralLinkCard`, `ReferredFriendsList` under `src/components/storefront/account/`.
- [ ] **Validation:** `src/validation/account/redeem-points.schema.ts` (redemption option id + balance-sufficiency check before calling the service).
- [ ] **Testing:** Vitest unit test for the tier-progress display calculation (percentage toward next threshold given current points and tier boundaries returned by STORY-030); Playwright e2e for viewing balance/history, redeeming points (against a mocked/stubbed rewards service), and copying the referral link.
- [ ] **Documentation:** Note in `docs/architecture-decisions.md` that this story is presentation-only and defers all point-earning, tier-threshold, expiry, and referral-crediting rules to STORY-030 and STORY-031 respectively — future rule changes belong there, not here.

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
