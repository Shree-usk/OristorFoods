# STORY-059a: CRM Segmentation

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the 059a/b/c split rationale and scope decisions.

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Sales Manager, Marketing Manager, Super Administrator

## Context

The first of three sub-stories split out of STORY-059 (CRM, Analytics
& Executive Dashboard) — confirmed with the user 2026-10-03/04,
recorded in `docs/blueprint.md` Section 9a. STORY-059 combined three
loosely-coupled surfaces (CRM segmentation, general BI/analytics
reports, and a distinct Executive Dashboard + scheduled reports), each
needing its own new aggregation logic, with two of the three
(conversion funnel, Core Web Vitals) having no backing data anywhere
in this codebase — the same shape that triggered the STORY-050/051
splits. This story covers only the CRM segmentation + CLV half of the
original AC. See `STORY-059-crm-analytics-executive-dashboard.md` for
the full original spec (left as the umbrella reference, unmodified,
per the STORY-050/051 precedent) and `STORY-059b`/`STORY-059c` for the
remaining two sub-stories.

Research before implementation found `AdminModule.CRMAnalytics`
already existed with exactly one consumer (the Admin Dashboard's
`liveVisitors` placeholder boolean) and that no customer-spend
aggregation existed anywhere — the admin Customers console (STORY-048)
was a plain filtered list with no order joins. STORY-071 had already
shipped the `CustomerGroup`/`CustomerGroupPrice` pricing-tier model
this story's segmentation reuses for its customer-group filter.

## Acceptance Criteria

- [x] A CRM segmentation builder filters customers by purchase
      frequency (min/max order count), lifetime value (min/max CLV),
      location (city, via default shipping address), reward tier, and
      last-order-date, and saves named segments reusable by the
      Marketing Console (STORY-050d) for campaign targeting
- [x] Customer Lifetime Value (CLV) is calculated and displayed per
      customer (on the existing admin Customer detail page) and per
      segment (the builder's live preview — total and average)

## Scope Decisions

- **CLV excludes Cancelled orders** — `SUM(order.grandTotal) WHERE
  status != "Cancelled"`, the exact inclusion rule
  `admin-dashboard.service.ts`'s `revenueToday` already uses, so this
  figure and the dashboard's revenue stay consistent with each other.
- **Segmentation is a two-step aggregate + in-memory filter, not raw
  SQL.** Prisma can't filter `where` on a relation's `SUM`/`COUNT`
  directly. `customer-segment.repository.ts::getCustomerMetrics()`
  does one `groupBy` for every customer's order stats;
  `listCandidateUsers()` does a plain `where` for reward tier/city/
  customer group; `crm-segmentation.service.ts::filterCustomers()`
  intersects both in memory. Reasonable at this business's scale.
- **Segments are live, not snapshotted.** `resolveSegmentMembers(id)`
  re-runs the same filter at campaign-send time, matching how
  `LoyaltyMembers`/`ReferralMembers` already resolve live today.
- **Segment CRUD is View/Edit/Delete, no Approve** — saving a segment
  has no money/visibility-moving effect (unlike a campaign *send*,
  which stays gated Approve, untouched by this story).
- **Marketing Console integration is real, not just described:**
  `CampaignAudienceTarget` gained a `SavedSegment` value,
  `EmailSmsCampaign` gained `targetSegmentId`, and
  `email-sms-campaign.service.ts::resolveCandidates()` gained a case
  calling `resolveSegmentMembers()` then the existing
  `listCustomersByIds()` — the same resolution shape every other
  audience type already uses.
- **A dedicated `listRewardTiersForSegmentation`, not a reuse of
  `rewards.service.ts::listTiersForAdmin`** — that function is gated
  on `RewardsReferrals:View`, an unrelated module an admin building a
  segment shouldn't need. New function gated on `CRMAnalytics:View`
  instead, reusing the `rewards.repository.ts` read directly.
- **Fixed a pre-existing cosmetic bug while touching the campaign
  form:** the Audience and Customer-group `<Select>`s in
  `admin-email-sms-campaigns-view.tsx` used a bare `<SelectValue />`
  with no label-mapping children function (the same Base UI gotcha
  fixed in STORY-055), showing the raw enum value instead of its
  label. Fixed for both, in the same edit that added the
  `SavedSegment` case.

## Tasks

- [x] **Database:** `SavedSegment` (name, filterCriteria Json,
      createdById); `CampaignAudienceTarget.SavedSegment` +
      `EmailSmsCampaign.targetSegmentId` (additive).
- [x] **API:** `/api/admin/crm/segments` (list/create),
      `/api/admin/crm/segments/[id]` (get/update/delete),
      `/api/admin/crm/segments/preview` (preview unsaved criteria),
      `/api/admin/crm/reward-tiers`.
- [x] **Service/Backend:** `crm-segmentation.service.ts` (segment CRUD,
      `previewSegment`, `resolveSegmentMembers`,
      `listRewardTiersForSegmentation`, `getCustomerClv`);
      `customer-segment.repository.ts` (the CLV/filter aggregation);
      `saved-segment.repository.ts`; the `email-sms-campaign.service.ts`
      and `customer-admin.service.ts` integration points above.
- [x] **Frontend:** `/admin/crm` (segment list), `/admin/crm/new` +
      `/admin/crm/[id]` (shared builder with a debounced live
      preview), a CLV line on the existing admin Customer detail page,
      the Marketing Console campaign form's new Saved Segment picker.
- [x] **Validation:** `segmentFilterCriteriaSchema` (all filters
      optional), `createSegmentSchema`/`updateSegmentSchema`.
- [x] **Testing:** Unit tests for CLV calculation (Cancelled-order
      exclusion), each filter dimension in isolation and combined,
      segment CRUD + audit log coverage, `resolveSegmentMembers`
      parity with `previewSegment`, permission gating including the
      cross-module reward-tier fix; a campaign-audience-resolution
      unit test for the `SavedSegment` case; an e2e test building a
      segment through the real UI, confirming the live preview,
      saving it, targeting it from a real campaign, and confirming
      CLV on the customer detail page.
- [x] **Documentation:** This file; `docs/architecture-decisions.md`
      2026-10-04 entry.

## Dependencies

- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates `AdminModule.CRMAnalytics`,
  its first real use
- STORY-048 (Admin Customers Console) — the CLV line surfaces on its
  existing customer detail page
- STORY-050d (Email/SMS/WhatsApp Campaign Builder) — the real audience-
  targeting integration point
- STORY-071 (Customer Group & Pricing Context) — `CustomerGroup`,
  reused directly as a segment filter dimension

## References

- `docs/stories/07-enterprise-admin-platform/STORY-059-crm-analytics-executive-dashboard.md` (umbrella — unmodified)
- `docs/architecture-decisions.md` 2026-10-04 entry
