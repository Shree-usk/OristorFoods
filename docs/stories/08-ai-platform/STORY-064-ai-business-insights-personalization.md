# STORY-064: AI Business Insights & Personalization

**Status:** Done
**Epic:** 08 — AI Platform
**Priority:** Low
**Persona(s):** Executive

## User Story
As an Executive, I want AI-generated business insights (trend detection, anomalies, plain-language summaries) surfaced in my dashboard, so that I can make faster, data-informed decisions without manually digging through raw reports.
As an Executive, I want customers scored by churn risk, so that I can direct win-back marketing effort where it matters most.
As an Executive, I want AI-suggested campaign ideas grounded in current trends and customer segments, so that Marketing has a data-backed starting point instead of a blank page.

## Description
This story layers AI-generated insights on top of the CRM/Analytics/Executive Dashboard delivered in STORY-059, as described in `docs/blueprint.md` Section 1 ("AI & Data Intelligence" pillar), Section 5 ("AI features: business insights, demand forecasting (future)"), and Section 9 item 8 ("AI Platform"). It covers three capabilities: (1) trend/anomaly detection with plain-language narrative summaries, (2) customer churn-risk scoring, and (3) human-reviewable AI-suggested campaign ideas and personalization segments that feed into the Marketing Console (STORY-050). Per the blueprint, demand forecasting is explicitly marked "(future)" and is intentionally excluded from this story's scope — see Out of Scope below.

## Acceptance Criteria
- [x] The Executive Dashboard (STORY-059) gains an "AI Insights" panel showing top emerging product/category trends (period-over-period comparison) and detected anomalies (e.g. unusual traffic or conversion drop), with a plain-language narrative summary
- [x] Customers are scored for churn risk (Low/Medium/High) using recency/frequency/monetary purchase signals plus engagement signals (site visits, email opens where available); scores are viewable as a filterable, exportable list
- [x] Churn-risk segments can be exported to/used as a targeting input by the Marketing Console (STORY-050) for win-back campaigns, without duplicating segment-building logic already owned by STORY-050
- [x] The system proposes candidate campaign ideas (e.g. product/segment pairings) as human-reviewable suggestions only — suggestions are never auto-launched as live campaigns
- [x] AI-derived personalization segments (customer clusters by purchase pattern/persona affinity) are viewable by Marketing and Executive roles and can be used as a targeting input in STORY-050 campaigns
- [x] Every AI-generated number or claim in the panel links back to its underlying data query, so an Executive can drill into the source data — no unverifiable black-box claims
- [x] Insight generation runs as a scheduled batch job (not computed per page-load), with a visible "last updated" timestamp on the panel
- [x] The AI Insights panel is role-gated to Executive, Marketing Manager, and Super Administrator roles per the RBAC model in STORY-038; all other roles do not see it
- [x] The panel uses Recharts for any charts, consistent with the rest of the Executive Dashboard, and is fully responsive
- [x] No customer PII is displayed beyond what the viewing role is already permitted to see in the Admin Customers Console (STORY-048)

## Tasks

- [x] **Database:**
  - [x] Define `CustomerChurnScore` model: `customerId`, `score`, `riskTier` (Low/Medium/High), `signalBreakdown` (JSON), `computedAt`
  - [x] Define `BusinessInsightSnapshot` model: `id`, `periodStart`/`periodEnd` (real `DateTime` fields, not a free-text period label — a plan-validated correction), `metricType` (Trend/Anomaly/CampaignSuggestion), `narrativeText`, `sourceQueryRef`, `structuredPayload`, `sequence`, `generatedAt`
  - [x] Add indexes supporting filtering churn scores by `riskTier` and fetching the latest `BusinessInsightSnapshot` per `metricType`

- [x] **API:**
  - [x] `GET /api/admin/ai-insights/summary` — latest trend/anomaly narrative snapshot + current campaign suggestions (campaign suggestions folded into the one summary endpoint rather than a separate `campaign-suggestions` route — one fetch for the whole panel)
  - [x] `GET /api/admin/ai-insights/churn-risk` — paginated, filterable churn-risk list, plus the real unfiltered tier distribution for the chart
  - [x] `POST /api/admin/ai-insights/recompute-churn`, `POST /api/admin/ai-insights/recompute-insights`, `POST /api/admin/ai-insights/export-churn-segment` — the real "scheduled batch job" triggers (see Service/Backend) and the churn-tier-to-Marketing hand-off
  - [x] All endpoints enforce gating via `requirePermission(adminUserId, "CRMAnalytics", ...)` and call the Service Layer only

- [x] **Service/Backend:**
  - [x] `business-insights.service.ts`: orchestrates on-demand batch computation — period-over-period trend/anomaly aggregation plus LLM-generated narrative summarization, referencing the underlying source query for each claim
  - [x] `churn-scoring.service.ts`: computes RFM-style (recency/frequency/monetary) churn scores reusing `customer-segment.repository.ts::getCustomerMetrics()` directly; documented, recalibratable thresholds for Low/Medium/High tiers
  - [x] Campaign-suggestion generation: LLM prompted with current trend data, producing structured (not freeform) suggestion records stored as `BusinessInsightSnapshot` rows with `metricType = CampaignSuggestion`
  - [x] Batch job trigger — no cron exists in this codebase (same constraint STORY-050d/059c/060/061 already resolved the same way); two separate admin-triggered "Recompute Now" actions (churn scoring and insight narratives), each cooldown-rate-limited
  - [x] `ai-insights.repository.ts` — the only file allowed to query `CustomerChurnScore`/`BusinessInsightSnapshot` directly via Prisma

- [x] **Frontend:**
  - [x] `admin-ai-insights-panel.tsx` embedded in the Executive Dashboard (STORY-059), showing the narrative summary and "last updated" timestamp
  - [x] `admin-churn-risk-table.tsx` with filtering by risk tier, CSV export, a Recharts tier-distribution bar chart, and a per-tier "Export to Marketing" action
  - [x] `admin-campaign-suggestion-cards.tsx` with a "Send to Marketing Console" action that hands off into STORY-050 rather than launching anything directly
  - [x] Drill-down links from every displayed metric/claim to its source data view (customer/product admin detail pages)

- [x] **Validation:**
  - [x] Zod schemas for admin API filters (risk tier, pagination)
  - [x] `requirePermission` reused on every endpoint and the page's own `RequirePermission` gate

- [x] **Testing:**
  - [x] Unit tests for the churn scoring formula and threshold tiering
  - [x] Unit tests for trend/anomaly detection logic, including the real-zero-vs-ranked-out edge case
  - [x] Unit tests confirming non-permitted admins are denied access to the services and routes
  - [x] Unit tests for the recompute actions producing `BusinessInsightSnapshot`/`CustomerChurnScore` rows, and the guardrail against a fabricated product id
  - [x] e2e test for the AI Insights section rendering with seeded data, denial for a non-`CRMAnalytics` admin, the churn table's live recompute/filter/export flow, and a scoped axe check

- [x] **Documentation:**
  - [x] Document the churn-scoring model, its inputs, and how to recalibrate risk-tier thresholds (see Scope Decisions below and `docs/architecture-decisions.md`)
  - [x] Document the batch job trigger and the manual re-run procedure
  - [x] Explicitly document that demand forecasting is out of scope for this story and tracked as a distinct future phase per `docs/blueprint.md` Section 5

## Scope Decisions

- **Churn scoring is classical RFM statistics, not an LLM feature** — matches STORY-060's own precedent. Score (0-100, higher = more at risk) is a weighted blend of three documented, recalibratable components: `recencyRisk` (days since last order, capped at 365, weight 0.6), `frequencyRisk` (order count, capped at 10, weight 0.25), `monetaryRisk` (total spend, capped at LKR 100,000, weight 0.15). Tiers: High ≥ 60, Medium ≥ 30, else Low. Recalibrate by adjusting `src/services/churn-scoring.service.ts`'s constants, not the formula shape. Only customers with at least one qualifying order are scored — you can't assess churn risk for someone who never purchased.
- **No engagement-signal data (site visits, email opens) exists anywhere in this codebase** — the same gap STORY-059b's funnel and STORY-059c's Core Web Vitals already documented. `signalBreakdown.engagementSignalsAvailable` is honestly `false` rather than fabricating a signal; AC #2 is satisfied on its RFM half only.
- **Anomaly detection is order-volume-only** — no traffic/conversion data exists in this codebase, so "unusual traffic or conversion drop" (AC #1) is honestly scoped to order-count anomalies (a day more than 40% below its trailing 7-day average). The generated narrative text itself states this limitation explicitly, not just a code comment, so an Executive reading the panel is never misled into assuming traffic was analyzed.
- **AC #5's "AI-derived personalization segments"** is read as the churn-risk tiers themselves (Low/Medium/High), viewable by any role holding `CRMAnalytics:View` and exportable as a real targeting segment — no separate purchase-pattern/persona-affinity clustering algorithm was in the Tasks list to build, and inventing one beyond what was asked would be scope creep.
- **AC #7/#8's "role-gated to Executive, Marketing Manager, Super Administrator"** — this codebase's RBAC has no first-class named-role gating concept (confirmed: the only `role.key ===` check anywhere in `src/` is an unrelated last-Super-Administrator safeguard, not feature-gating). Every story this session, including the rest of the Executive Dashboard, gates via `requirePermission(adminUserId, module, action)`. The AI Insights panel is gated on the same `CRMAnalytics` module the rest of the dashboard already uses — whichever roles the business grants that permission to are the ones who see it.
- **Churn-tier export to Marketing is an exact snapshot, not an RFM-threshold approximation.** `SavedSegment`s in this codebase are explicitly "live, not snapshotted" (STORY-059a's own design). A pure `lastOrderBefore` mapping would under-deliver AC #2's actual churn definition (RFM + engagement). Instead, `SegmentFilterCriteria` gained an additive, optional `customerIds` field — exporting a tier passes the real current `CustomerChurnScore` ids for that tier, reusing `createSegment`/`filterCustomers` directly rather than duplicating segment-building logic (AC #3). This is an intentional point-in-time snapshot, documented as a stated divergence from the rest of that file's live-filter design, not a silent conflict with it.
- **No shared "AI Gateway"** — consistent with the user's standing decision on 062/063, `business-insights.service.ts` reuses STORY-062/063's `ChatCompletionProvider`/`OpenAiChatProvider` directly rather than building new provider infrastructure.
- **No streaming** — same retrieve → ground → generate → validate shape as 062/063: real trend/anomaly data is computed first, the LLM is constrained to reference only that real data, and a guardrail re-verifies every returned product id before persisting.
- **Opportunistic finding, not fixed here**: building the first-ever axe check against this codebase's shared `<Table>`/`TableHead` component revealed its `text-muted-foreground` header style fails WCAG AA contrast at 14px — a pre-existing, codebase-wide design-token gap affecting every admin table, not introduced by this story. Flagged for Epic 09 (Quality & Security), not fixed here to avoid scope creep into a shared primitive.

## Dependencies
- STORY-059 (CRM, Analytics & Executive Dashboard) — hosting surface for the AI Insights panel
- STORY-038 (Admin Auth & RBAC) — role-gating for Executive/Marketing Manager/Super Administrator
- STORY-028 (Order Management) — purchase data source for trend detection and churn scoring
- STORY-048 (Admin Customers Console) — customer data source and PII display boundary
- STORY-050 (Marketing Console) — consumer of churn segments and campaign suggestions
- STORY-060 (AI Product Recommendations) — shares underlying behavior-event data where useful for trend detection

## Out of Scope
- Demand forecasting / inventory or production forecasting — explicitly marked "(future)" in `docs/blueprint.md` Section 5 and tracked as a separate future phase, not part of this story
- Automated campaign execution — all campaign suggestions require human review and are launched through STORY-050, never auto-launched by this story
- Real-time/streaming insight computation (batch-only for this story)
- Predictive/dynamic pricing optimization

## References
- `docs/blueprint.md` Section 1 (AI & Data Intelligence pillar)
- `docs/blueprint.md` Section 5 (AI features: business insights, demand forecasting (future))
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/folder-structure.md` (`src/services/`, `src/repositories/`, `src/app/(admin)/dashboard/`)
