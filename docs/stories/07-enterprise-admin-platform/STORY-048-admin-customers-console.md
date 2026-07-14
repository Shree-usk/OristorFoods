# STORY-048: Admin Customers Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Sales Manager, Finance Manager, Super Administrator

## User Story
As Customer Support, I want to view a customer's full profile, purchase history, support history, and login history in one place, so that I can resolve issues quickly without switching between systems.
As Customer Support, I want to manually issue reward points or a coupon to a customer, so that I can resolve service-recovery cases on the spot.

## Description
This story delivers the Customers console module from `docs/blueprint.md` Section 7: "profiles, purchase/support/login history, suspend/activate, manual reward/coupon issuance." It is the admin-facing view over the customer data models built across STORY-033 (Customer Dashboard), STORY-034 (Profile, Addresses & Account Settings), and STORY-036 (Order History & Support).

## Acceptance Criteria
- [ ] `/admin/customers` list view is searchable/filterable by name, email, status, registration date, and tags, with pagination
- [ ] Customer detail view has tabs for: Profile (name/contact/addresses), Purchase History (orders, linking into STORY-047), Support History (past tickets), Login History (timestamps and device/IP where available), and a Rewards & Referrals summary
- [ ] An admin can suspend or reactivate a customer account, capturing a required reason; a suspended customer cannot log in to the storefront
- [ ] An admin can manually issue reward points to a customer (amount, reason, optional expiry), immediately reflected in the customer's reward wallet (STORY-035)
- [ ] An admin can manually issue a coupon to a customer (single-use or account-scoped, value/type/expiry), immediately redeemable at checkout
- [ ] An internal-only notes field per customer captures support context and is never visible to the customer
- [ ] Every suspend/activate/manual-issuance action is recorded in the audit log (STORY-057)

## Tasks
- [ ] **Database:** Extend the `Customer`/`User` model with `suspendedAt`/`suspendedReason`; add `AdminNote` (customerId, authorId, body, createdAt), `ManualRewardGrant`, and `ManualCouponGrant` records for traceability.
- [ ] **API:** `/api/admin/customers` (list/detail), `/api/admin/customers/[id]/suspend`, `/activate`, `/api/admin/customers/[id]/rewards/grant`, `/api/admin/customers/[id]/coupons/issue`, `/api/admin/customers/[id]/notes`.
- [ ] **Service/Backend:** `customer-admin.service.ts` orchestrating suspend/activate (blocking storefront login) and delegating reward grants to `reward.service` (STORY-030) and coupon issuance to `coupon.service` (STORY-029) rather than duplicating that logic.
- [ ] **Frontend:** `src/app/(admin)/customers/page.tsx` (list) and `[id]/page.tsx` (tabbed detail view), suspend/activate confirmation modal with a required-reason field, manual reward/coupon issuance modals.
- [ ] **Validation:** Zod schemas bounding manual reward grant amounts and coupon parameters (value, expiry, usage limit).
- [ ] **Testing:** Unit tests confirming a suspended customer is blocked from storefront login; unit test that a manual reward grant is reflected in the wallet balance; e2e test issuing a coupon and confirming it is redeemable at checkout.
- [ ] **Documentation:** Document the internal notes field's non-customer-visibility guarantee.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-033 (Customer Dashboard), STORY-034 (Profile, Addresses & Account Settings), STORY-036 (Order History & Support) — this console surfaces the data models those stories define
- STORY-030 (Rewards / Loyalty Club) and STORY-029 (Coupons & Promotions) — back the manual issuance actions

## References
- `docs/blueprint.md` Section 7 ("Customers" console module bullet)
