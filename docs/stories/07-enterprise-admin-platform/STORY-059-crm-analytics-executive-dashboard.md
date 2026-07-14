# STORY-059: CRM, Analytics & Executive Dashboard

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Super Administrator, Sales Manager, Finance Manager, Marketing Manager, Executive (read-only strategic access under the RBAC model from STORY-038)

## User Story
As an Executive, I want a high-level insights dashboard summarizing revenue, customer, and operational trends across the business, so that I can make strategic decisions without digging through individual console modules.
As a Sales Manager, I want CRM features — customer segmentation, lifetime value, and purchase trends — integrated with analytics reporting, so that I can identify and act on high-value customer segments.

## Description
This story combines `docs/blueprint.md` Section 5's "Enterprise (internal): CMS, CRM, analytics, export portal, ERP integration, executive dashboard" and Section 9 item 7's "analytics, BI, executive dashboard" into one story covering CRM features, general BI/analytics reporting, and a dedicated executive-level dashboard. It directly serves the "Executive" persona from Section 1, who "needs dashboards/insights," and the 12-month success metrics defined there. This is distinct from STORY-039 (Admin Dashboard), which is an operational day-to-day landing screen; this story is strategic, trend-level reporting layered on top of data owned by other stories (Orders, Customers, Products, Recipes).

## Acceptance Criteria
- [ ] A CRM segmentation builder filters customers by purchase frequency, lifetime value, location, reward tier, and last-order-date, and saves named segments reusable by the Marketing Console (STORY-050) for campaign targeting
- [ ] Customer Lifetime Value (CLV) is calculated and displayed per customer and per segment
- [ ] Analytics/BI reports cover: sales trends (revenue/orders over time, by product/category/region), customer acquisition/retention, top products/recipes by engagement, and a conversion funnel (visit → cart → checkout → order)
- [ ] Every report is filterable by date range and exportable (CSV/PDF)
- [ ] A distinct Executive Dashboard (a separate route from STORY-039's operational dashboard) surfaces KPI trend charts against the blueprint Section 1 12-month success metrics — direct online revenue growth, returning-customer rate, average order value, loyalty program engagement, export enquiry volume, and Core Web Vitals — each with period-over-period comparison
- [ ] Executive Dashboard access is restricted to roles with view permission on the Analytics module under STORY-038's permission model (Super Administrator, Administrator, and any role explicitly granted Executive-level view access)
- [ ] Scheduled report emails (e.g. a weekly summary to Executives) are configurable through the notification system (STORY-032)

## Tasks
- [ ] **Database:** Analytics is computed primarily from existing operational data (Order, Customer, Product, Recipe, Review models owned by other stories) rather than duplicated storage; add `SavedSegment` (name, filterCriteria JSON, createdById) and `ScheduledReport` (reportType, recipients, frequency, lastSentAt).
- [ ] **API:** `/api/admin/crm/segments`, `/api/admin/analytics/sales`, `/api/admin/analytics/customers`, `/api/admin/analytics/funnel`, `/api/admin/analytics/executive-summary`, `/api/admin/analytics/scheduled-reports`.
- [ ] **Service/Backend:** `crm-segmentation.service.ts` (composes the filter query across customer/order data), `analytics.service.ts` (aggregation queries per report type, cached given aggregation cost), `clv.service.ts`.
- [ ] **Frontend:** `src/app/(admin)/crm/page.tsx` (segmentation builder + saved segments list), `src/app/(admin)/analytics/page.tsx` (reports hub with Recharts trend charts, filterable tables, export buttons), `src/app/(admin)/executive-dashboard/page.tsx` (KPI cards + trend charts distinct from STORY-039's operational widgets).
- [ ] **Validation:** Zod schema for segment filter criteria and scheduled report configuration (valid frequency, valid recipient emails).
- [ ] **Testing:** Unit tests for CLV calculation and segmentation filter query composition; unit test conversion funnel math; e2e test building a segment and confirming it's selectable as a target audience in Marketing Console (STORY-050) campaign creation; e2e test loading the Executive Dashboard and confirming KPI cards render correctly against a seeded data fixture.
- [ ] **Documentation:** Document the distinction between this story's Executive Dashboard and STORY-039's operational Admin Dashboard so future contributors don't conflate or duplicate them; document which blueprint Section 1 12-month success metric each KPI card maps to.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions and the Executive-level view restriction
- Draws on data models from STORY-028 (Order Management), STORY-033/STORY-034 (Customer Platform), STORY-040 (Products), STORY-017/STORY-018 (Recipes) — this story is read-mostly analytics over those models rather than owning new operational data
- STORY-050 (Marketing Console) — consumes saved CRM segments for campaign targeting
- STORY-032 (Notifications) — delivers scheduled report emails

## Out of Scope
- AI-driven business insights/forecasting (belongs to STORY-064, AI Business Insights & Personalization)
- Real-time streaming analytics (this story covers periodic/on-demand reporting, not live event streams)

## References
- `docs/blueprint.md` Section 1 (Executive persona, 12-month success metrics)
- `docs/blueprint.md` Section 5 ("Enterprise (internal): CMS, CRM, analytics, export portal, ERP integration, executive dashboard")
- `docs/blueprint.md` Section 9 item 7 ("Enterprise Platform")
