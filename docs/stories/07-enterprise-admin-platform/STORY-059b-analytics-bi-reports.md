# STORY-059b: Analytics/BI Reports

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the 059a/b/c split rationale and scope decisions.

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator

## Context

The second of three sub-stories split out of STORY-059 (CRM, Analytics
& Executive Dashboard) — confirmed with the user 2026-10-03/04,
recorded in `docs/blueprint.md` Section 9a. 059a (CRM Segmentation) is
done and merged. This story covers the original STORY-059 AC's
"Analytics/BI reports" bullets: sales trends, customer acquisition/
retention, top products/recipes, and a conversion funnel, each
filterable by date range and exportable as CSV/PDF. See
`STORY-059-crm-analytics-executive-dashboard.md` for the full original
spec (left unmodified, per the STORY-050/051 precedent) and
`STORY-059c` for the remaining sub-story (Executive Dashboard +
Scheduled Reports).

Research before implementation found `AdminModule.CRMAnalytics`
already real from 059a's own segment CRUD — this story is its second
consumer, gated **View** only. No day/week/month date-truncation
existed anywhere in the codebase; `search.repository.ts`'s
`prisma.$queryRaw` tagged-template precedent (STORY-012) was reused
for it. No chart library existed either — Recharts was added as a new
dependency, as the original STORY-059 task list named it.

## Acceptance Criteria

- [x] Sales trends (revenue + order count over time, bucketed by day/
      week/month), broken down by product category and by delivery
      region, filterable by date range
- [x] Top products and top recipes, ranked and filterable by date
      range (products) / overall (recipes, by view count)
- [x] Customer acquisition (new customers over time) and retention
      (repeat-purchase rate) for a selected date range
- [x] A conversion funnel, honestly reporting only the stages this
      codebase actually has data for
- [x] Every report is exportable as CSV and as PDF

## Scope Decisions

- **The conversion funnel is honest, not fabricated.** Every real
  order in this codebase is created directly with `status:
  "Confirmed"` (`createOrderWithStockDecrement` never produces a
  distinct "checkout started" row), and there is no visit-tracking
  anywhere (the same gap already documented for Live Visitors / Core
  Web Vitals). The funnel reports exactly two real numbers — **Carts
  with items** (best-effort: distinct `Cart` rows with ≥1 `CartItem`,
  filtered by `updatedAt` in range — a current-state approximation
  since `Cart` is a mutable singleton per user/guest, not an event
  log, documented as such in the UI) and **Confirmed orders** (real,
  date-ranged, excluding Cancelled) — with **Visits** and **Checkout
  started** rendered as explicit "Not available" cards, the same
  treatment System Health gave its unavailable sections (STORY-057).
- **Retention is defined precisely:** of the customers who placed at
  least one non-Cancelled order in the selected range, what fraction
  have placed 2+ non-Cancelled orders all-time — a repeat-purchase
  rate anchored to the period's active customers, stated explicitly in
  the UI copy so the number is never ambiguous.
- **One shared CSV utility, one shared PDF report template** — not
  eight bespoke exporters for four reports × two formats.
  `src/lib/csv.ts::toCsv(headers, rows)` is reused by every CSV
  export in the codebase (this story's four reports, plus
  `audit-log-admin.service.ts`'s STORY-057 export, refactored to call
  it instead of its own inline copy — same output, one
  implementation). `analytics-pdf.service.tsx::renderAnalyticsReportPdf`
  is one `@react-pdf/renderer` template, reused by all four reports.
- **One tabbed reports hub page**, not four separate routes —
  Sales/Customers/Products & Recipes/Funnel are homogeneous in shape
  (aggregated read + chart + table + export), closer to Settings'
  tabs-in-one-route precedent than Marketing's separate-routes
  situation.
- **Date-range `to` is end-of-day inclusive, not midnight.** A bare
  date like `2026-10-04` parses to `00:00:00.000Z`, which would
  silently exclude anything created later that same day from a report
  a human reads as "through today." `analyticsQuerySchema` transforms
  `to` to `23:59:59.999` (UTC) after validating `from <= to` — caught
  live during the e2e-test pass, when today's own seeded order was
  missing from the Products & Recipes tab.
- **A near-miss, not a scope decision:** `src/lib/csv.ts` already
  existed (STORY-051b's `parseSimpleCsv`, used by the redirect bulk
  importer). An initial `Write` of the new `toCsv` export clobbered it;
  caught by `tsc` reporting a missing `parseSimpleCsv` export in two
  consuming files, fixed by merging both functions into one file.
  Noted here because the fix pattern (`Glob`/`Grep` before `Write`-ing
  a small, plausibly-already-used utility filename) is worth repeating.

## Tasks

- [x] **Shared utility:** `src/lib/csv.ts::toCsv` (new export,
      alongside STORY-051b's existing `parseSimpleCsv`);
      `audit-log-admin.service.ts` refactored to call it.
- [x] **Database:** none — pure reads over existing tables
      (`Order`/`OrderItem`/`Product`/`Category`/`Recipe`/`User`/
      `Cart`/`CartItem`).
- [x] **Backend:** `analytics.repository.ts` (8 reads: sales trend,
      sales by category, sales by region, top products, top recipes,
      customer acquisition, customer retention, conversion funnel);
      `analytics.service.ts` (one `CRMAnalytics:View`-gated function +
      CSV/PDF export pair per report, no audit logging — pure reads,
      matching 059a's own `previewSegment` convention);
      `analytics-pdf.service.tsx` (shared PDF template, mirroring
      `invoice-pdf.service.tsx`'s `@react-pdf/renderer` pattern).
- [x] **API:** `GET /api/admin/analytics/{sales,customers,
      products-recipes,funnel}`, each branching on `?format=csv|pdf`
      vs. plain JSON for the chart view.
- [x] **Frontend:** `/admin/analytics` — a `Tabs` hub (Sales /
      Customers / Products & Recipes / Funnel), each tab: a shared
      date-range + bucket picker, a Recharts chart, a data table, and
      CSV/PDF export buttons. `npm install recharts` — first chart
      library in this codebase.
- [x] **Validation:** `analyticsQuerySchema` (shared date-range +
      bucket + format + metric query params, end-of-day `to`
      transform).
- [x] **Testing:** `tests/unit/analytics-service.test.ts` (permission
      gating, day-bucketed sales trend with Cancelled-order exclusion,
      sales-by-category through the many-to-many relation, top-product
      ranking, top-recipe ranking by view count, retention's exact
      fraction against a seeded cohort, funnel's two real numbers plus
      the two unavailable placeholders, funnel CSV content);
      `tests/unit/csv.test.ts` extended with `toCsv` escaping tests
      (alongside the pre-existing `parseSimpleCsv` tests, since both
      now live in the same `src/lib/csv.ts`);
      `tests/e2e/admin-analytics.spec.ts` (real seeded order/product
      data through the actual UI, a real CSV download and content
      check, the funnel tab's honest-placeholder copy).
- [x] **Documentation:** This file; `docs/architecture-decisions.md`
      2026-10-04 entry.

## Dependencies

- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates `AdminModule.CRMAnalytics`
- STORY-059a (CRM Segmentation) — made `AdminModule.CRMAnalytics` real;
  this story is its second consumer

## References

- `docs/stories/07-enterprise-admin-platform/STORY-059-crm-analytics-executive-dashboard.md` (umbrella — unmodified)
- `docs/architecture-decisions.md` 2026-10-04 entry
