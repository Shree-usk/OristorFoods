# STORY-031: Referral Programme

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As an existing customer, I want a personal referral link/code I can share with friends and family, so that I can invite them to Oristor and be rewarded when they join and buy.

As a Sri Lankan Expat who wants to introduce family back home (or abroad) to Oristor, I want to know that my referral was tracked and rewarded once my referral completes a qualifying purchase, so that I trust the programme actually pays out.

As a new customer who signed up via a referral link, I want any welcome benefit tied to that referral to be applied automatically, so that I don't have to do anything extra to claim it.

## Description
This story implements the referral programme mechanics: generating a unique referral link/code per customer, tracking referred sign-ups against the referring customer, and triggering a reward payout when a referred customer completes a qualifying action (e.g. first purchase over a minimum value). It corresponds to "Referral Programme" in the site structure (`docs/blueprint.md` Section 4) and the "... → Rewards → Referral → Repeat Purchase" step of the commerce lifecycle (Section 5), and to the Section 7 admin capability "Rewards & Referrals — campaign creation, point rules, badges, fraud monitoring" (referral campaign rules are admin-configured, not hardcoded here). The customer-facing referral dashboard (share UI, referral status list) is **STORY-035 (Reward Wallet & Referral Dashboard)**, Customer Platform epic — this story owns the link/code generation, tracking, and payout mechanics that dashboard reads from.

## Acceptance Criteria
- [ ] Every registered customer has a unique, stable referral code and a shareable referral link (e.g. `https://oristor.com/?ref=<code>` or a dedicated landing path) generated automatically on account creation (or on first request if generated lazily), without requiring an admin action.
- [ ] Visiting the site via a referral link attributes the visit to the referring customer (e.g. via a signed cookie set on landing) for an admin-configurable attribution window, surviving a guest browsing session through to registration.
- [ ] A new customer who registers within the attribution window while carrying a valid referral attribution is recorded as "referred by" that referring customer — this relationship is stored once at registration and is not re-attributable afterward (no double-counting from a later visit via a different referral link).
- [ ] A referral code/link that doesn't match any customer, or has expired/been deactivated, does not block registration — it simply results in no referral attribution, with no visible error to the new user.
- [ ] A referral only becomes "qualifying" (payout-eligible) when the referred customer completes an admin-configured qualifying action (e.g. first order confirmed and above a minimum order value) — registration alone does not trigger payout, preventing trivial abuse.
- [ ] When a referral qualifies, the reward payout (points credited via STORY-030's ledger, and/or a coupon via STORY-029's redemption engine, per admin configuration) is issued to the referring customer exactly once per referred customer, with the transaction traceable back to the specific referral relationship.
- [ ] A referred customer's own welcome incentive (if the campaign configuration includes one), if any, is applied automatically at their qualifying action without manual redemption steps.
- [ ] Referral status is tracked and queryable per referring customer: e.g. `Link Shared`/`Clicked`, `Registered`, `Qualified/Rewarded`, so STORY-035's dashboard can show "3 friends joined, 1 has ordered" style progress.
- [ ] Self-referral (a customer using their own referral link/code to register a second account with the same identity signals — e.g. same email/payment method) and other obvious abuse patterns are detected and the referral is flagged/excluded from payout rather than silently rewarded — exact fraud-detection sophistication is admin-configurable/extensible, but at minimum same-email and same-account self-referral is blocked.
- [ ] Referral reward amounts, qualifying-action rules, attribution window, and fraud rules are all read from admin-managed configuration (STORY-049) — no referral reward value or qualifying threshold is hardcoded in this story's code.

## Tasks
- [ ] **Database:** Add `ReferralCode` (customer's unique code), `ReferralAttribution` (tracks a referred visitor/signup: referring customer, referred customer once registered, status, attribution timestamp, qualifying-action timestamp, reward-issued timestamp) models to `prisma/schema.prisma`. Reward rule configuration (qualifying action, payout amount/type, attribution window) references admin-managed models owned by STORY-049.
- [ ] **API:** `GET /api/referral/code` — returns (or lazily generates) the authenticated customer's referral code/link.
- [ ] **API:** `POST /api/referral/attribute` — records referral attribution from a landing-page visit (sets the signed cookie).
- [ ] **API:** Internal service hook invoked at registration to persist the `referredBy` relationship from any active attribution cookie.
- [ ] **API:** `GET /api/referral/status` — list of the authenticated customer's referrals and their status, consumed by STORY-035.
- [ ] **Service/Backend:** `referral.service.ts` — code generation, attribution-cookie handling, registration-time attribution recording, qualifying-action detection (subscribing to the `order.confirmed` integration event from STORY-028), payout triggering (via `rewards.service.ts`/`coupon.service.ts`), and self-referral/abuse detection.
- [ ] **Service/Backend:** `referral.repository.ts` — the only place `ReferralCode`/`ReferralAttribution` Prisma models are queried/mutated.
- [ ] **Frontend:** Referral link/code display and share affordance (copy link, share buttons) — base component built here, embedded into STORY-035's dashboard; this story owns the component, STORY-035 owns the surrounding dashboard page.
- [ ] **Frontend:** Landing-page attribution handling (reading `?ref=` query param, setting the attribution cookie via the API) wired into the root layout or middleware so any entry page can capture it, not just the homepage.
- [ ] **Validation:** Zod schema for the attribution and code-lookup payloads (`src/validation/referral.schema.ts`).
- [ ] **Testing:** Vitest unit tests for `referral.service.ts` covering: valid attribution → registration → qualifying order → payout issued exactly once; expired/invalid code → no attribution, no error; self-referral → blocked.
- [ ] **Testing:** Playwright e2e test simulating: visit via referral link → register → place a qualifying order → confirm referring customer's reward balance increases.
- [ ] **Documentation:** Document the attribution-cookie mechanism, qualifying-action trigger, and fraud-guard rules in `docs/architecture-decisions.md`.

## Dependencies
- STORY-028 (Order Management) — referral qualification is triggered off order-confirmed events.
- STORY-030 (Rewards / Loyalty Club) — referral payouts are credited through the reward ledger.
- STORY-029 (Coupons & Promotions) — if referral payout takes the form of a coupon rather than points, per admin configuration.
- STORY-001/002/003 — foundation, auth (NextAuth), layout for the registration flow attribution hooks into.
- STORY-049 (Rewards & Referrals Campaign Management, Admin epic) — related: referral reward amounts, qualifying-action rules, and attribution window are admin-configured there.

## Out of Scope
- Customer-facing referral dashboard page (share UI embedded in a full dashboard view, referral list/progress display) — STORY-035, Customer Platform epic.
- Admin referral campaign authoring and fraud-monitoring console — STORY-049.
- Multi-tier/pyramid-style referral chains (referrals of referrals) unless a future story explicitly scopes it — this story implements single-level (direct) referral attribution only.

## References
- `docs/blueprint.md` Section 4 (Site Structure — Referral Programme), Section 5 (Commerce lifecycle — Referral), Section 7 (Rewards & Referrals module)
