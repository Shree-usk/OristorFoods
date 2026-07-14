# STORY-034: Profile, Addresses & Account Settings

**Status:** Draft
**Epic:** 06 — Customer Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer, I want to edit my profile information, so that my account details stay accurate.

As a customer, I want to save multiple billing and shipping addresses, so that checkout is fast and I don't have to re-enter details every time.

As a customer, I want to change my password and review my account security, so that I trust my account is protected.

As a customer, I want to control which notifications I receive and how, so that I only hear from Oristor about what matters to me.

As a Distributor or Sri Lankan Expat, I want to save a business address or an international shipping address, so that my orders route correctly regardless of where I am.

## Description
This story covers the self-service account management pages nested under the dashboard shell built in STORY-033: `/account/profile`, `/account/addresses`, `/account/security`, and `/account/notifications`. Saved addresses feed directly into Checkout's address selection (Commerce epic), so the address model and its default-address rules established here become a shared contract. It maps to `docs/blueprint.md` Section 5 ("profiles, addresses") and Section 4 (Customer Portal).

## Acceptance Criteria
- [ ] Profile page lets a customer edit name, phone number, date of birth (optional), and profile photo; changing email requires re-verification before the new email becomes active
- [ ] Address book lists all saved addresses with a label (Home/Work/Other), type (Shipping/Billing/Both), and a default badge; customer can add, edit, and delete addresses
- [ ] Address form validates required fields conditionally per country (Zod), supports both Sri Lankan address formats (city/district) and international formats (state/province, postal code) for the Sri Lankan Expat persona
- [ ] Customer can independently set a default billing address and a default shipping address; setting a new default automatically un-defaults the previous one (server-enforced, not just client state)
- [ ] A maximum of 10 saved addresses per account is enforced server-side with a clear error when exceeded
- [ ] Deleting an address that is referenced by a pending/in-progress order is blocked with an explanatory message rather than silently failing or breaking the order record
- [ ] Distributor persona can mark an address as a business address, adding company name and tax/VAT ID fields to the form
- [ ] Security page: change-password form requires current password, enforces the same complexity rule as registration (STORY-033), and invalidates other active sessions on success
- [ ] Security page shows a "Log out of all devices" action that revokes all NextAuth sessions except the current one
- [ ] Notifications page exposes toggles for order-update emails, promotional emails, SMS opt-in, WhatsApp opt-in, and reward/referral notifications; saved preferences are read by the Notifications story (STORY-032) when dispatching messages
- [ ] All forms show inline field-level validation errors, disable submit while pending, and show a success toast on save with no full-page reload
- [ ] An account deactivation request flow exists: confirmation modal with a reason field, submits a deactivation request (soft-delete flag on `User`, not a hard delete)

## Tasks
- [ ] **Database:** `Address` model (`userId`, `label`, `type` enum `[SHIPPING, BILLING, BOTH]`, `line1`, `line2`, `city`, `district`/`state`, `postcode`, `country`, `phone`, `isDefaultBilling`, `isDefaultShipping`, `companyName?`, `taxId?`, `createdAt`, `updatedAt`); `NotificationPreference` model (`userId`, `orderUpdates`, `promotions`, `smsOptIn`, `whatsappOptIn`, `rewardUpdates`); extend `User` with `phone`, `dateOfBirth`, `avatarUrl`, `status` enum `[ACTIVE, DEACTIVATION_REQUESTED, DEACTIVATED]`. Index `Address(userId)`. Migrations.
- [ ] **API:** `GET/PATCH /api/account/profile`, `GET/POST /api/account/addresses`, `PATCH/DELETE /api/account/addresses/[id]`, `PATCH /api/account/security/password`, `GET/DELETE /api/account/security/sessions`, `GET/PATCH /api/account/notifications`, `POST /api/account/deactivate`.
- [ ] **Service:** `profile.service.ts`; `address.service.ts` (default-address swap logic, max-address enforcement, in-use-by-order guard); `security.service.ts` (password change with bcrypt re-hash + session revocation); `notification-preference.service.ts`.
- [ ] **Repository:** `address.repository.ts`, `notification-preference.repository.ts` — the only place these tables are queried via Prisma, per the Service Layer + Repository pattern.
- [ ] **Frontend:** `src/app/(storefront)/account/profile/page.tsx`, `account/addresses/page.tsx`, `account/security/page.tsx`, `account/notifications/page.tsx`; `AddressCard`, `AddressFormDialog` (React Hook Form + Zod), `ChangePasswordForm`, `NotificationPreferencesForm` under `src/components/storefront/account/`.
- [ ] **Validation:** `src/validation/account/profile.schema.ts`, `address.schema.ts` (conditional per-country shape), `change-password.schema.ts`, `notification-preferences.schema.ts`, `deactivate-account.schema.ts`.
- [ ] **Testing:** Vitest unit tests for the default-address swap logic and the max-address-per-account guard; Playwright e2e covering add/edit/delete address, set-default-address, and change-password flows.
- [ ] **Documentation:** Document the `Address` model's default-address invariants (exactly one default billing, one default shipping per user) in `docs/architecture-decisions.md` so Checkout consumes it consistently.

## Dependencies
- STORY-001 (Project Foundation Setup) — Prisma/NextAuth scaffold.
- STORY-003 (Global Layout & Responsive Framework) — layout primitives.
- STORY-033 (Customer Dashboard) — provides the auth-guarded `/account` layout and sidebar nav this story's pages nest inside.

## Out of Scope
- Payment method storage (belongs to Payment Integration, STORY-026)
- Full GDPR-style data export / hard account deletion (candidate for the Quality & Security epic)
- Address autocomplete/geocoding integration (future enhancement, not in current scope)
- Actual notification delivery (owned by STORY-032 — this story only persists the preference)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Customer Portal)
- `docs/blueprint.md` Section 5 (Customer management: registration, login, profiles, addresses)
- `docs/blueprint.md` Section 9 item 6 (Customer Platform)
- `docs/folder-structure.md` (`src/app/(storefront)/account/`, `src/services/`, `src/repositories/`)
