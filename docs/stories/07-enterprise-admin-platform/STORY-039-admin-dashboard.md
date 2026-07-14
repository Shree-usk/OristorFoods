# STORY-039: Admin Dashboard

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Super Administrator, Administrator, Sales Manager, Finance Manager, Warehouse Manager, Marketing Manager, Customer Support, Viewer

## User Story
As an Administrator, I want a landing dashboard summarizing today's business activity across sales, content, and operations, so that I know what needs my attention the moment I log in.
As a Warehouse Manager, I want to see low stock alerts and ERP sync status on my dashboard, so that I can react to fulfillment problems without navigating multiple modules.
As a Viewer, I want to see a read-only summary of the widgets my role has permission to view, so that I get situational awareness without being able to take action.

## Description
This story delivers the admin console's landing screen exactly as specified in `docs/blueprint.md` Section 7: today's revenue/orders, live visitors, pending reviews/questions/comments, low stock alerts, reward redemptions, referral signups, export enquiries, support tickets, failed payments, ERP sync status, and system health. Each widget is a thin aggregation view over data owned by another story in this epic (Orders, Reviews, Q&A, Products/Inventory, Rewards & Referrals, Export Portal, Customer Support, Payments, ERP Integration, System Health) — this story does not own that underlying data, only the dashboard's read/aggregate/visibility layer, gated by STORY-038's RBAC so each widget only shows to roles with view permission on its source module.

## Acceptance Criteria
- [ ] "Today's Revenue & Orders" widget shows current-day revenue and order count with a comparison delta vs. the prior day
- [ ] "Live Visitors" widget shows a near-real-time count of active storefront sessions
- [ ] "Pending Reviews / Questions / Comments" widget shows separate counts for each moderation queue (product reviews, recipe reviews, blog/Food Academy comments, product Q&A, recipe Q&A) with a link into the relevant console (STORY-045, STORY-046, STORY-044)
- [ ] "Low Stock Alerts" widget lists products at or below their reorder threshold, linking into the Products module (STORY-040)
- [ ] "Reward Redemptions" widget shows recent redemption count/value, linking into Rewards & Referrals (STORY-049)
- [ ] "Referral Signups" widget shows recent referral signup count, linking into Rewards & Referrals (STORY-049)
- [ ] "Export Enquiries" widget shows new/unactioned B2B enquiry count, linking into the Export Portal (STORY-058)
- [ ] "Support Tickets" widget shows open ticket count broken down by priority, linking into Customer Support (STORY-048/STORY-036)
- [ ] "Failed Payments" widget shows recent failed payment attempts, linking into the Orders console (STORY-047)
- [ ] "ERP Sync Status" widget shows last successful sync time, queue depth, and failed-job count, linking into the ERP Integration Console (STORY-056)
- [ ] "System Health" widget shows uptime, API error rate, and last backup timestamp, linking into STORY-057's full System Health panel
- [ ] Widgets are permission-filtered: a role without view permission on a widget's source module never renders that widget (server-side filtering, not CSS hiding)
- [ ] If a widget's source module/data isn't implemented yet, the widget renders a "coming soon" placeholder rather than erroring the whole dashboard
- [ ] Dashboard auto-refreshes on a defined interval (e.g. every 60 seconds) without a full page reload
- [ ] Dashboard is responsive (grid reflows to single column on mobile) and loads within the <300ms API budget from `docs/blueprint.md` Section 6, with skeleton loading states per widget

## Tasks
- [ ] **API:** `GET /api/admin/dashboard/summary` returning all widget payloads in one aggregated call; `GET /api/admin/dashboard/live-visitors` as a lightweight polling endpoint refreshed more frequently than the rest of the dashboard.
- [ ] **Service/Backend:** `dashboard.service.ts` composing calls to `order.service`, `review.service`, `question.service`, `product.service` (stock levels), `reward.service`, `referral.service`, `export-enquiry.service`, `support.service`, `payment.service`, `sync-job.service`, `system-health.service` — each widget's data-fetch wrapped so a missing/unbuilt dependency degrades to a placeholder instead of failing the whole response.
- [ ] **Frontend:** `src/app/(admin)/dashboard/page.tsx`, one component per widget under `src/components/admin/dashboard/`, a permission-aware widget grid that only requests/renders widgets the current role can view, Recharts sparkline for the revenue trend, TanStack Query polling for auto-refresh.
- [ ] **Testing:** Unit tests for `dashboard.service.ts`'s graceful degradation when a source module is unavailable; unit tests for permission-based widget filtering; e2e test confirming a Viewer-role fixture sees a reduced widget set vs. a Super Administrator fixture.
- [ ] **Documentation:** Document the widget-to-source-module mapping and refresh intervals so future stories that own a widget's source data know they must keep this dashboard's aggregation contract in sync.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation) — base app/layout/design system
- STORY-038 (Admin Auth & RBAC) — gates every widget behind a role/permission check
- Widget data is owned by, and should evolve alongside: STORY-040 (low stock), STORY-045/STORY-046 (pending reviews/questions), STORY-047 (failed payments), STORY-048/STORY-036 (support tickets), STORY-049 (redemptions/referrals), STORY-056 (ERP sync status), STORY-057 (system health), STORY-058 (export enquiries). This dashboard should be revisited and its placeholders replaced as each of those modules ships.

## Out of Scope
- Deep analytics/BI trend reporting and the executive-level insights view (STORY-059)
- User-configurable/custom widget layout (fixed widget set per blueprint spec for this story)

## References
- `docs/blueprint.md` Section 7 ("Admin dashboard (landing screen)" bullet)
- `docs/blueprint.md` Section 6 (performance targets: API response <300ms)
