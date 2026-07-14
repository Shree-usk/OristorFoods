# STORY-058: Export Portal

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Export Manager, Sales Manager, Super Administrator

## User Story
As an Export Manager, I want to manage export enquiries from international distributors, importers, supermarkets, and hotels/restaurants in a dedicated portal, so that B2B leads are tracked and responded to without falling through the cracks.
As an Export Manager, I want to convert a won enquiry into a tracked distributor account, so that ongoing B2B relationships are managed distinctly from one-off retail customers.

## Description
This story delivers the admin-side console behind the "Export" primary navigation item in `docs/blueprint.md` Section 4 and serves the tertiary target market defined in Section 1 ("international food enthusiasts, importers, supermarkets, distributors, restaurants, hotels"). It is the internal counterpart to whatever storefront-facing Export enquiry submission form exists in the site's Export section: enquiry intake, status tracking, and B2B distributor account management, with results surfaced on the Admin Dashboard's (STORY-039) "Export Enquiries" widget.

## Acceptance Criteria
- [ ] Export enquiries list is filterable/searchable by status, country, enquiry date, company name, and product interest, with pagination
- [ ] Enquiry detail view shows company info, contact person, country, products of interest, an estimated quantity/volume, the submitted message, submission date, assigned Export Manager, and current status
- [ ] Status pipeline is New → In Discussion → Quoted → Won → Lost/Closed, with each transition timestamped and attributed to the acting admin
- [ ] An enquiry can be assigned to a specific Export Manager/staff member; an internal notes thread per enquiry is never visible to the enquirer
- [ ] A reply-to-enquiry action sends an email response to the enquirer's contact address and logs the reply in the enquiry's activity history
- [ ] A won enquiry can be converted into a tracked Distributor Account record (company profile, region, contact info, and a reference to a wholesale/distributor pricing tier per the pricing engine models in blueprint Section 5)
- [ ] Enquiry volume and conversion-rate summary (count by status, win rate) is surfaced for the Export Manager role
- [ ] Every status change, assignment, and note is logged to the audit log (STORY-057)

## Tasks
- [ ] **Database:** `ExportEnquiry` (companyName, contactName, contactEmail, country, productsOfInterest, volumeEstimate, message, status, assignedToId, createdAt), `ExportEnquiryNote` (enquiryId, authorId, body, createdAt), `DistributorAccount` (companyName, region, pricingTierRef, contactInfo, convertedFromEnquiryId).
- [ ] **API:** `/api/admin/export/enquiries` (list/detail/status/assign/reply/notes), `/api/admin/export/distributor-accounts`.
- [ ] **Service/Backend:** `export-enquiry.service.ts`, `distributor-account.service.ts`, integrating `notification.service` (STORY-032) for the reply-to-enquiry email action.
- [ ] **Frontend:** `src/app/(admin)/export/page.tsx` — enquiries list plus a detail drawer (status pipeline, notes, reply composer), a Distributor Accounts sub-view, and a summary stats panel.
- [ ] **Validation:** Zod schema for enquiry status transitions (fixed pipeline order, except Lost/Closed which can occur from any prior state) and the reply message body.
- [ ] **Testing:** Unit tests for the status pipeline transition guard and win-rate calculation; e2e test assigning an enquiry, replying to it, moving it through the pipeline to Won, and confirming it appears as a Distributor Account.
- [ ] **Documentation:** Cross-reference the storefront-facing Export enquiry submission form (blueprint Section 4 "Export" nav item) so both sides agree on the enquiry field contract; if that storefront story doesn't yet exist in the backlog, this story's `ExportEnquiry` model is the contract it must POST against once built.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions, including the Export Manager role's scoped access
- STORY-032 (Notifications) — the reply-to-enquiry email action

This story relies on a storefront-facing Export enquiry submission entry point (blueprint Section 4 "Export" nav item). No dedicated storefront story for that submission form currently exists elsewhere in this backlog — this story's `ExportEnquiry` model should be treated as the field contract that form is built against.

## References
- `docs/blueprint.md` Section 4 (Export primary nav item)
- `docs/blueprint.md` Section 1 (tertiary target market: importers, supermarkets, distributors, restaurants, hotels)
- `docs/blueprint.md` Section 5 (pricing engine — distributor/export/wholesale pricing tiers)
- `docs/blueprint.md` Section 7 (Admin Dashboard "Export Enquiries" widget)
