# STORY-058: Export Portal

**Status:** Done
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Export Manager, Sales Manager, Super Administrator

## User Story
As an Export Manager, I want to manage export enquiries from international distributors, importers, supermarkets, and hotels/restaurants in a dedicated portal, so that B2B leads are tracked and responded to without falling through the cracks.
As an Export Manager, I want to convert a won enquiry into a tracked distributor account, so that ongoing B2B relationships are managed distinctly from one-off retail customers.

## Description
This story delivers the admin-side console behind the "Export" primary navigation item in `docs/blueprint.md` Section 4 and serves the tertiary target market defined in Section 1 ("international food enthusiasts, importers, supermarkets, distributors, restaurants, hotels"). It is the internal counterpart to the storefront-facing Export enquiry submission form this story also builds (see Scope Decision — no other story owned it): enquiry intake, status tracking, and B2B distributor account management, with results surfaced on the Admin Dashboard's (STORY-039) "Export Enquiries" widget.

## Acceptance Criteria
- [x] Export enquiries list is filterable/searchable by status, country, enquiry date, company name, and product interest, with pagination
- [x] Enquiry detail view shows company info, contact person, country, products of interest, an estimated quantity/volume, the submitted message, submission date, assigned Export Manager, and current status
- [x] Status pipeline is New → In Discussion → Quoted → Won → Lost/Closed, with each transition timestamped and attributed to the acting admin
- [x] An enquiry can be assigned to a specific Export Manager/staff member; an internal notes thread per enquiry is never visible to the enquirer
- [x] A reply-to-enquiry action sends an email response to the enquirer's contact address and logs the reply in the enquiry's activity history
- [x] A won enquiry can be converted into a tracked Distributor Account record (company profile, region, contact info, and a reference to a wholesale/distributor pricing tier per the pricing engine models in blueprint Section 5)
- [x] Enquiry volume and conversion-rate summary (count by status, win rate) is surfaced for the Export Manager role
- [x] Every status change, assignment, and note is logged to the audit log (STORY-057)

## Scope Decision

Research before implementation found `AdminModule.ExportPortal` already
existed with exactly one consumer — `admin-dashboard.service.ts`'s
`placeholders.exportEnquiries` boolean, rendered as a `ComingSoonCard`
("the B2B Export Portal hasn't been built yet") — and that `/export`
itself 404'd: the homepage's own "Export Solutions" teaser section
(STORY-006) already linked a real-looking CTA there. STORY-071's
Customer Group & Pricing Context had already shipped the
`CustomerGroup` enum (with real `Distributor`/`Export`/`Wholesale`
values) and `CustomerGroupPrice` tiered pricing end to end. Confirmed
with the user:

- **This story builds both the admin console and the storefront
  `/export` enquiry form**, rather than deferring the storefront half
  as the story doc's own "no dedicated storefront story exists"
  caveat allowed. `/export` now renders real marketing copy (reusing
  `home-fixtures.ts`'s `exportSolutions` teaser copy) plus a React
  Hook Form + Zod submission form, posting to a public, rate-limited
  `/api/export/enquiries` endpoint — same shape as
  `newsletter-form.tsx`, with `checkRateLimit` added (newsletter's
  route has none).
- **`DistributorAccount` links a real `User`, not a CRM-only record.**
  `pricingTierRef` from the story doc's own schema sketch is realized
  as `user.customerGroup` directly — reusing STORY-071's
  `CustomerGroup`/`CustomerGroupPrice` rather than inventing a second
  pricing-tier model. Converting a Won enquiry either creates a new
  `User` (a random, unusable placeholder bcrypt hash, exactly STORY-057's
  `inviteAdminUser` pattern) and calls `requestPasswordReset` so they
  get a real "set your password" email through the *existing* customer
  flow, or — if a `User` already exists for that email — just upgrades
  their `customerGroup` to `Distributor` and links them, no new email.
  Both branches run inside one `prisma.$transaction` alongside the
  `DistributorAccount` row, for atomicity.
- **No separate status-history table.** The existing shared `AuditLog`
  (STORY-057's `writeAuditLog()`) is the system of record for "every
  status change, assignment, and note is logged" — the detail view's
  Activity panel reads it directly via the audit log *repository*
  (not `audit-log-admin.service.ts`'s `listAuditLogs`, which is gated
  on `UsersRolesAudit:Audit` — a different module an Export Manager
  shouldn't need).
- **Permission actions used meaningfully:** View (list/detail/
  Distributor Accounts), Edit (status/assign/notes/reply), and
  **Approve** for the Won→Distributor Account conversion — a one-way
  benefit-grant action (new pricing entitlement), the same convention
  this codebase reserves `Approve` for elsewhere (publish-approval,
  reward grants), distinct from `customer-admin.service.ts`'s plain
  `setCustomerGroup` (`Edit`), which isn't itself a conversion.
- **A dedicated `listAssignableAdmins`, not a reuse of STORY-057's
  admin list.** `admin-user-admin.service.ts::listUsersForAdmin`
  requires `UsersRolesAudit:View` — an unrelated module permission an
  Export Manager shouldn't need just to see assignable staff. Added a
  minimal `GET /api/admin/export/admins`, gated on `ExportPortal:Edit`
  instead.
- **Reply-to-enquiry and internal notes stay structurally distinct** —
  `ExportEnquiryNote` is strictly internal (per the AC); a sent reply
  is tracked as an audit log entry (`export_enquiry_replied`) instead
  of a second notes-like table.

## Tasks
- [x] **Database:** `ExportEnquiryStatus` enum, `ExportEnquiry` (companyName, contactName, contactEmail, contactPhone, country, productsOfInterest, volumeEstimate, message, status, assignedToId, createdAt), `ExportEnquiryNote` (enquiryId, authorId, body, createdAt), `DistributorAccount` (companyName, region, contactName/Email/Phone, userId, convertedFromEnquiryId, createdById).
- [x] **API:** `/api/admin/export/enquiries` (list/detail/status/assign/reply/notes/activity/convert), `/api/admin/export/distributor-accounts`, `/api/admin/export/admins`, plus the public `/api/export/enquiries`.
- [x] **Service/Backend:** `export-enquiry.service.ts` (covers both enquiries and conversion — a separate `distributor-account.service.ts` wasn't warranted, since every write to that model happens inside the conversion flow), integrating `notification.service` (STORY-032) for the reply-to-enquiry email and `auth.service.ts`'s `requestPasswordReset` for the new distributor's account setup.
- [x] **Frontend:** `src/app/(admin)/admin/export/page.tsx` (list + filters + stats), `.../export/[id]/page.tsx` (detail: status pipeline, assignment, reply, notes, activity, convert), `.../export/distributor-accounts/page.tsx`; the storefront `src/app/(storefront)/export/page.tsx` + enquiry form.
- [x] **Validation:** Zod schemas for the public submission, admin status/assign/note/reply/convert actions, and list filters — status transitions enforced in the service (`assertValidStatusTransition`-style guard), not just the UI.
- [x] **Testing:** Unit tests for the status pipeline transition guard, permission gating per action (View/Edit/Approve), rate limiting, and both Distributor Account conversion branches (new User vs. existing User upgrade); e2e test submitting a real enquiry through the storefront form, assigning it, moving it through the pipeline to Won, converting it, and confirming the resulting User/Distributor Account — plus a second enquiry moved to Lost.
- [x] **Documentation:** This Scope Decision section; `docs/architecture-decisions.md` entry.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions, including the Export Manager role's scoped access
- STORY-032 (Notifications) — the reply-to-enquiry email action
- STORY-057 (Users, Roles & Audit Logs) — the shared `writeAuditLog()`/audit log repository this story's Activity panel and transition logging reuse
- STORY-071 (Customer Group & Pricing Context) — `CustomerGroup`/`CustomerGroupPrice`, reused directly for the Distributor Account's pricing tier

## References
- `docs/blueprint.md` Section 4 (Export primary nav item)
- `docs/blueprint.md` Section 1 (tertiary target market: importers, supermarkets, distributors, restaurants, hotels)
- `docs/blueprint.md` Section 5 (pricing engine — distributor/export/wholesale pricing tiers)
- `docs/blueprint.md` Section 7 (Admin Dashboard "Export Enquiries" widget)
