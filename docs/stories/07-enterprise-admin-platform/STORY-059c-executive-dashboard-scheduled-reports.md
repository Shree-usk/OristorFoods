# STORY-059c: Executive Dashboard + Scheduled Reports

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the 059a/b/c split rationale and scope decisions. **Closes Epic 07 (Enterprise/Admin Platform).**

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Executive, Super Administrator

## Context

The third and final sub-story split out of STORY-059 (CRM, Analytics &
Executive Dashboard) — confirmed with the user 2026-10-03/04. 059a
(CRM Segmentation) and 059b (Analytics/BI Reports) are both done and
merged. This story covers the original STORY-059 AC's remaining two
bullets: a distinct, strategic-level Executive Dashboard (separate
from STORY-039's operational Admin Dashboard) and scheduled report
emails. See `STORY-059-crm-analytics-executive-dashboard.md` for the
full original spec (left unmodified, per the 059a/b precedent).

Research before implementation confirmed this is not a duplicate of
STORY-039's dashboard — `admin-dashboard.service.ts` is an operational
"today" snapshot at `/admin`; this story's dashboard lives at a
separate route (`/admin/executive-dashboard`) and is strategic/
trend-level, composing period-over-period KPIs. It also confirmed, by
reading `email-sms-campaign.service.ts`'s own header comment, that no
cron/scheduler infrastructure exists anywhere in this codebase —
STORY-050d already hit and resolved this exact constraint with its
"Send due campaigns" admin-triggered action, a pattern this story
repeats for scheduled reports rather than re-litigating.

## Acceptance Criteria

- [x] A distinct Executive Dashboard (a separate route from
      STORY-039's operational dashboard) surfaces KPI trend charts
      against the blueprint Section 1 12-month success metrics —
      direct online revenue growth, returning-customer rate, average
      order value, loyalty program engagement, export enquiry volume,
      and Core Web Vitals — each with period-over-period comparison
- [x] Executive Dashboard access is restricted to roles with view
      permission on the Analytics module under STORY-038's permission
      model
- [x] Scheduled report emails (e.g. a weekly summary to Executives)
      are configurable through the notification system (STORY-032)

## Scope Decisions

- **Core Web Vitals is an honest `available: false` placeholder, not
  fabricated.** No performance/visit tracking exists anywhere in this
  codebase — the same confirmed gap as 059b's funnel Visits/Checkout
  and STORY-057's System Health uptime. The other 5 KPIs are all real.
- **Period-over-period comparison is "this period vs. the immediately
  preceding period of equal length"** (e.g. the last 30 days vs. the
  30 days before that), computed once (`executive-dashboard.service.ts::priorPeriod`)
  and reused by every KPI. A `changePercent` of `null` (not a
  fabricated number) is reported when the prior period was zero and
  the current period is not — "grew from zero" has no meaningful
  percentage.
- **The dashboard composes existing reads, it doesn't duplicate
  aggregation logic.** Revenue/AOV reuse STORY-039's
  `order.repository.ts::getOrderSummaryForRange`; returning-customer
  rate reuses 059b's `analytics.repository.ts::getCustomerRetention`.
  Only loyalty engagement and export-enquiry volume needed new,
  period-ranged reads (`executive-dashboard.repository.ts`) — small
  siblings of STORY-039's existing "since X" dashboard reads, not
  changes to those already-shipped functions.
- **No cron exists in this codebase — `ScheduledReport` rows only
  actually send when an admin triggers "Send due reports now."** This
  is a direct repeat of STORY-050d's own `processDueCampaigns`
  pattern (gated Approve, looked up via a `listDue(now)` read,
  dispatched in a loop, audit-logged as a batch), not a new open
  question — see `email-sms-campaign.service.ts`'s own header comment
  for the original constraint.
- **`ScheduledReport.reportType` covers all 5 report shapes this
  codebase now has** (`sales`/`customers`/`products-recipes`/`funnel`
  from 059b, plus `executive-summary` from this story) — a free
  string, matching `OrderIntegrationEvent.eventType`/
  `NotificationTemplate.templateKey`'s established precedent, not a
  closed enum. `frequency` is a small `Weekly`/`Monthly` enum — the
  AC's own example is "a weekly summary"; daily/custom-cron would
  overstate what a manually-triggered action can honestly promise.
- **The report email body is a plain-text summary, not a PDF
  attachment.** `notification.service.ts::sendTransactionalEmail`'s
  underlying `EmailProvider.send` has no attachment support; for the
  4 report types from 059b, the body reuses their existing CSV export
  string directly (already-tested logic, one less formatter to
  maintain); the executive summary gets its own small text formatter.
- **Scheduled Report CRUD is View/Edit/Delete; `processDueScheduledReports`
  is gated Approve** — the same money/visibility-moving bar
  STORY-050d's campaign-send and STORY-047's refund already use, since
  this action dispatches real emails to real recipients.

## Tasks

- [x] **Database:** `ScheduledReport` (reportType, recipients
      String[], frequency, lastSentAt, createdById); new
      `ScheduledReportFrequency` enum (Weekly, Monthly).
- [x] **Backend:** `executive-dashboard.repository.ts` (the two new
      period-ranged reads); `executive-dashboard.service.ts`
      (`getExecutiveSummary`, gated `CRMAnalytics:View`, no audit
      logging — pure reads, matching 059a/b's convention);
      `scheduled-report.repository.ts` (CRUD + `listDueScheduledReports`);
      `scheduled-report.service.ts` (CRUD, audit-logged, gated
      `CRMAnalytics` View/Edit/Delete; `processDueScheduledReports`
      gated Approve, reuses 059b's report CSV exporters for the email
      body).
- [x] **API:** `GET /api/admin/analytics/executive-summary`;
      `GET/POST /api/admin/analytics/scheduled-reports`,
      `PATCH/DELETE /api/admin/analytics/scheduled-reports/[id]`,
      `POST /api/admin/analytics/scheduled-reports/process-due`.
- [x] **Frontend:** `/admin/executive-dashboard` — 6 KPI cards (5 real
      with period-over-period %, Core Web Vitals honest-unavailable),
      a Recharts revenue trend chart reusing 059b's sales-trend data,
      and a Scheduled Reports section (table, create/edit dialog,
      "Send due reports now" button mirroring the Marketing Console's
      "Send due campaigns").
- [x] **Validation:** `executiveSummaryQuerySchema` (date range, same
      end-of-day `to` transform as 059b's `analyticsQuerySchema`);
      `scheduledReportSchema` (reportType enum of 5 values, recipients
      as a non-empty array of valid emails, frequency enum).
- [x] **Testing:** `tests/unit/executive-dashboard-service.test.ts`
      (period-over-period math, the null/zero changePercent edge
      cases, Core Web Vitals honesty, permission gating);
      `tests/unit/scheduled-report-service.test.ts` (CRUD + audit
      logging, `listDue` frequency/lastSentAt logic, a real end-to-end
      send via `processDueScheduledReports` confirming `lastSentAt`
      stamping and Approve-gate enforcement);
      `tests/e2e/admin-executive-dashboard.spec.ts` (real seeded
      orders across two periods confirming the KPI math through the
      UI, creating a scheduled report, and triggering a real send).
- [x] **Documentation:** This file; `docs/architecture-decisions.md`
      2026-10-04 entry.

## Dependencies

- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates `AdminModule.CRMAnalytics`
- STORY-039 (Admin Dashboard) — the operational dashboard this story
  is explicitly distinct from; also the source of
  `getOrderSummaryForRange` and the rewards/export-enquiry "since X"
  reads this story's own period-ranged siblings mirror
- STORY-059a (CRM Segmentation), STORY-059b (Analytics/BI Reports) —
  made `AdminModule.CRMAnalytics` real and built the report reads this
  story composes
- STORY-050d (Email/SMS/WhatsApp Campaign Builder) — the
  "no cron, admin-triggered processDueX" pattern this story repeats
- STORY-032 (Notifications) — `sendTransactionalEmail`, reused for
  report delivery

## References

- `docs/stories/07-enterprise-admin-platform/STORY-059-crm-analytics-executive-dashboard.md` (umbrella — unmodified)
- `docs/architecture-decisions.md` 2026-10-04 entry
