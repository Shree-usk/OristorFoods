# STORY-048: Admin Customers Console

**Status:** Done (core scope) — see `docs/architecture-decisions.md` 2026-10-01 entry for deviations (Suspended as a new AccountStatus value distinct from Deactivated, LoginEvent as new infrastructure, Coupon.restrictedToUserId for account-scoped issuance, the dropped "tags" filter).
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Customer Support, Sales Manager, Finance Manager, Super Administrator

## User Story
As Customer Support, I want to view a customer's full profile, purchase history, support history, and login history in one place, so that I can resolve issues quickly without switching between systems.
As Customer Support, I want to manually issue reward points or a coupon to a customer, so that I can resolve service-recovery cases on the spot.

## Description
This story delivers the Customers console module from `docs/blueprint.md` Section 7: "profiles, purchase/support/login history, suspend/activate, manual reward/coupon issuance." It is the admin-facing view over the customer data models built across STORY-033 (Customer Dashboard), STORY-034 (Profile, Addresses & Account Settings), and STORY-036 (Order History & Support).

## Acceptance Criteria
- [x] `/admin/customers` list view is searchable/filterable by name, email, status, and registration date, with pagination — "tags" dropped, no backing concept exists anywhere in this codebase (see architecture-decisions.md)
- [x] Customer detail view has tabs for: Profile (name/contact/addresses), Purchase History (orders, linking into STORY-047), Support History (past tickets), Login History (timestamps and device/IP where available), and a Rewards & Referrals summary
- [x] An admin can suspend or reactivate a customer account, capturing a required reason; a suspended customer cannot log in to the storefront
- [x] An admin can manually issue reward points to a customer (amount, reason, optional expiry), immediately reflected in the customer's reward wallet (STORY-035)
- [x] An admin can manually issue a coupon to a customer (single-use or account-scoped, value/type/expiry), immediately redeemable at checkout
- [x] An internal-only notes field per customer captures support context and is never visible to the customer
- [x] Every suspend/activate/manual-issuance action is recorded in the audit log

## Tasks
- [x] **Database:** `User` gained `suspendedReason`/`suspendedAt`/`suspendedById` and a new `Suspended` `AccountStatus` value (not reusing `Deactivated` — see architecture-decisions.md); new `LoginEvent` (userId, success, ipAddress, userAgent, createdAt) and `AdminNote` (customerId, authorId, body, createdAt) models; `Coupon` gained `restrictedToUserId` for account-scoped issuance.
- [x] **API:** `/api/admin/customers` (list), `/api/admin/customers/[id]` (detail), `/api/admin/customers/[id]/suspend`, `/reactivate`, `/api/admin/customers/[id]/rewards/grant`, `/api/admin/customers/[id]/coupons/issue`, `/api/admin/customers/[id]/notes`, `/api/admin/customers/[id]/login-history`.
- [x] **Service/Backend:** `customer-admin.service.ts` (extended from STORY-071) orchestrating suspend/reactivate (blocking storefront login via `auth.service.ts::verifyCredentials`) and delegating reward grants to `rewards.service.ts::grantManualPoints` and coupon issuance to a new `coupon.service.ts::issueCouponToCustomer` rather than duplicating that logic.
- [x] **Frontend:** `src/app/(admin)/admin/customers/page.tsx` (list) and `[id]/page.tsx` (tabbed detail view), suspend confirmation dialog with a required-reason field, manual reward/coupon issuance dialogs.
- [x] **Validation:** `customer-admin.schema.ts` — reward grant (points, reason, optional expiry), coupon issuance (discount type, value, expiry, usage limit), suspend reason, note body.
- [x] **Testing:** `tests/unit/customer-admin-service.test.ts` confirms a suspended customer is blocked from storefront login via a real `verifyCredentials` call; a manual reward grant is reflected in the wallet balance; `tests/e2e/admin-customers.spec.ts` issues a coupon and confirms it's redeemable only by the restricted customer.
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-01 entry documents the internal notes field's structural (not just UI) non-customer-visibility guarantee.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-033 (Customer Dashboard), STORY-034 (Profile, Addresses & Account Settings), STORY-036 (Order History & Support) — this console surfaces the data models those stories define
- STORY-030 (Rewards / Loyalty Club) and STORY-029 (Coupons & Promotions) — back the manual issuance actions

## References
- `docs/blueprint.md` Section 7 ("Customers" console module bullet)
