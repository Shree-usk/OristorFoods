# STORY-034: Profile, Addresses & Account Settings

**Status:** Done — see the STORY-034 entry in `docs/architecture-decisions.md`.
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
- [x] Profile page lets a customer edit name, phone number, date of birth (optional), and profile photo; changing email requires re-verification before the new email becomes active
- [x] Address book lists all saved addresses with a label (Home/Work/Other), type (Shipping/Billing/Both), and a default badge; customer can add, edit, and delete addresses
- [x] Address form validates required fields conditionally per country (Zod), supports both Sri Lankan address formats (city/district) and international formats (state/province, postal code) for the Sri Lankan Expat persona
- [x] Customer can independently set a default billing address and a default shipping address; setting a new default automatically un-defaults the previous one (server-enforced, not just client state)
- [x] A maximum of 10 saved addresses per account is enforced server-side with a clear error when exceeded
- [x] ~~Deleting an address that is referenced by a pending/in-progress order is blocked~~ — confirmed inapplicable: `Order` stores an immutable snapshot with no FK to `Address` at all, so deleting a saved address can never affect an existing order's record. See `docs/architecture-decisions.md`.
- [x] Distributor persona can mark an address as a business address, adding company name and tax/VAT ID fields to the form
- [x] Security page: change-password form requires current password, enforces the same complexity rule as registration (STORY-033). Invalidates **every** active session, including the current one (not "other sessions only") — no per-session tracking exists to distinguish devices; confirmed with the user as a deliberate scope decision. See `docs/architecture-decisions.md`.
- [x] Security page shows a "Log out of all devices" action — same global-invalidation scope as above (revokes every session, including the current one, not "except the current one")
- [x] Notifications page exposes toggles for order-update emails, promotional emails, SMS opt-in, WhatsApp opt-in, and reward/referral notifications; saved preferences are read by the Notifications story (STORY-032) when dispatching messages
- [x] All forms show inline field-level validation errors, disable submit while pending, and show a success toast on save with no full-page reload
- [x] An account deactivation request flow exists: confirmation modal with a reason field, submits a deactivation request (soft-delete flag on `User`, not a hard delete)

## Tasks
- [x] **Database:** Extended the pre-existing `Address` model (STORY-025) with `label`, `type`, `country`, `companyName`, `taxId`, and split `isDefault` into `isDefaultBilling`/`isDefaultShipping`; extended the pre-existing `NotificationPreference` model (STORY-032) with `rewardUpdatesOptIn` ("promotional emails" reuses `User.marketingOptIn`, already added by STORY-033 — no new field); extended `User` with `phone`, `dateOfBirth`, `pendingEmail`, `status` (`AccountStatus` enum), `deactivationReason`, `deactivationRequestedAt` (profile photo reuses the existing `User.image` column). `Address(userId)` was already indexed. Applied via `db push` — see the no-migration-file note below.
- [x] **API:** `GET/PATCH /api/account/profile`, `POST /api/account/profile/email` + `POST /api/account/profile/email/confirm`, `GET/POST /api/account/addresses`, `PATCH/DELETE /api/account/addresses/[id]`, `PATCH /api/account/security/password`, `POST /api/account/security/logout-all` (no session-list endpoint — no per-session tracking exists), `POST /api/account/deactivate`. Notifications reuses STORY-032's existing `GET/POST /api/notifications/preferences` (its own doc comment already anticipated this story).
- [x] **Service:** `profile.service.ts` (profile edit, email-change request/confirm, deactivation request); `address.service.ts` (default-address swap logic, max-address enforcement); `security.service.ts` (password change + logout-all-devices, both via the shared session-invalidation stamp). No separate `notification-preference.service.ts` — extended the existing functions in `notification.service.ts` instead (STORY-032 already owned this).
- [x] **Repository:** `address.repository.ts` (rewritten, full CRUD); `user.repository.ts` extended (profile/email-change/deactivation); reused `password-reset.repository.ts`'s generic `VerificationToken` wrapper for email-change tokens rather than a new repository.
- [x] **Frontend:** `src/app/(storefront)/account/(dashboard)/{profile,addresses,security,notifications}/page.tsx` + `(public)/profile/verify-email/page.tsx`; `AddressCard`, `AddressFormDialog`, `ChangePasswordForm`, `LogoutAllDevicesButton`, `ProfileForm`, `EmailChangeForm`, `DeactivateAccountDialog`, `VerifyEmailPanel`, and the extended `NotificationPreferencesForm` under `src/components/storefront/account/`. New `src/components/ui/toast.tsx` (Base UI's own Toast primitive — see architecture-decisions.md).
- [x] **Validation:** `src/validation/profile.schema.ts`, `address.schema.ts` (conditional per-country shape), `security.schema.ts` (reuses `auth.schema.ts`'s shared `passwordSchema`); extended `notification.schema.ts`. Kept flat under `src/validation/` rather than a new `account/` subfolder — matches STORY-033's existing convention (`auth.schema.ts` wasn't split into subfolders either).
- [x] **Testing:** `address-service.test.ts` (default-swap logic, max-address guard, ownership checks), `profile-service.test.ts` (profile edit, full email-change lifecycle, deactivation), `security-service.test.ts` (password change, logout-all); `tests/e2e/account-settings.spec.ts` covering add/edit/set-default/delete address and the full change-password round trip.
- [x] **Documentation:** Documented the `Address` model's default-address invariants, the notification-preference field mapping, the session-revocation scope decision, and the no-upload/photo-as-URL decision in `docs/architecture-decisions.md`.

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
