# STORY-039: Admin Dashboard

**Status:** Landed — 8 of 11 widgets show real data; Live Visitors, Export
Enquiries, and System Health render as "coming soon" placeholders since
none has any backing data source yet (confirmed by exhaustive grep, not
just "not built"). See the STORY-039 entry in `docs/architecture-decisions.md`
for the full widget-to-module mapping and every deviation.
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
- [x] "Today's Revenue & Orders" widget shows current-day revenue and order count. *No comparison delta vs. the prior day — not in the widget's data shape this pass; see architecture-decisions.md.*
- [ ] Deferred: "Live Visitors" widget shows a near-real-time count of active storefront sessions. *No session/pageview tracking exists anywhere in the codebase — renders "coming soon".*
- [x] "Pending Reviews / Questions / Comments" widget shows separate counts for each moderation queue. *Recipe Q&A omitted — not a distinct feature (only product Q&A exists). No links into the relevant consoles — STORY-044/045/046 don't exist yet.*
- [x] "Low Stock Alerts" widget lists a count of products at or below a threshold. *A documented constant (10), not an admin-configurable reorder threshold — no `Product` field or admin UI for one yet. No link into Products (STORY-040 doesn't exist yet).*
- [x] "Reward Redemptions" widget shows today's redemption count. *No link into Rewards & Referrals (STORY-049 doesn't exist yet).*
- [x] "Referral Signups" widget shows today's referral signup count. *Same link deferral as above.*
- [ ] Deferred: "Export Enquiries" widget shows new/unactioned B2B enquiry count. *No B2B enquiry model exists — Export Portal epic unbuilt. Renders "coming soon".*
- [x] "Support Tickets" widget shows ticket counts. *Broken down by `status`, not priority — `SupportTicket` has no `priority` field. No link into Customer Support (STORY-048 doesn't exist yet).*
- [x] "Failed Payments" widget shows today's failed payment count. *No link into Orders (STORY-047 doesn't exist yet).*
- [x] "ERP Sync Status" widget shows pending/failed counts and last successful sync time. *No queue-depth distinction beyond the pending count. No link into an ERP Integration Console (STORY-056 doesn't exist yet).*
- [ ] Deferred: "System Health" widget shows uptime, API error rate, and last backup timestamp. *No uptime/error-rate/backup tracking exists anywhere. Renders "coming soon".*
- [x] Widgets are permission-filtered: a role without view permission on a widget's source module never renders that widget — server-side (the API response omits the key entirely; nothing is sent then hidden by CSS).
- [x] If a widget's source module/data isn't implemented yet, the widget renders a "coming soon" placeholder rather than erroring the whole dashboard.
- [x] Dashboard auto-refreshes every 60 seconds without a full page reload (`useQuery({ refetchInterval: 60_000 })` — first use of polling in this codebase).
- [x] Dashboard is responsive (grid reflows to a single column on mobile). *No skeleton loading states — `initialData` from the Server Component means the first paint is never a loading state; the <300ms API budget wasn't independently measured this pass.*

## Tasks
- [x] **API:** `GET /api/admin/dashboard/summary` returns every permitted widget's payload in one aggregated call. *No separate `live-visitors` polling endpoint — nothing real to poll.*
- [x] **Service/Backend:** `admin-dashboard.service.ts::getDashboardSummary` composes ~10 new thin repository functions across the existing `order`/`payment`/`review`/`recipe-review`/`blog`/`qa`/`product`/`rewards`/`referral`/`support-ticket` repositories (Service Layer — no new Prisma access outside them) — each widget's fetch independently wrapped so one failing data source degrades to omitted rather than failing the whole response.
- [x] **Frontend:** `src/app/(admin)/admin/page.tsx` (the story doc's own `dashboard/page.tsx` path was stale — this is where STORY-038's placeholder already lived), one component per widget under `src/components/admin/dashboard/`, a permission-aware grid rendering only the keys present in the summary, TanStack Query polling for auto-refresh. *No Recharts sparkline — dropped, not an AC requirement; see architecture-decisions.md.*
- [x] **Testing:** `tests/unit/admin-dashboard-service.test.ts` (real data + permission-gating, including graceful degradation for ungranted/placeholder widgets); `tests/e2e/admin-dashboard.spec.ts` (a fixture granted every widget module vs. a fixture granted only `Orders` vs. a fixture with no permissions).
- [x] **Documentation:** Full widget-to-module mapping and every deviation documented in `docs/architecture-decisions.md`.

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
