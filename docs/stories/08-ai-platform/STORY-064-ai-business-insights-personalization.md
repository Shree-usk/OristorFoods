# STORY-064: AI Business Insights & Personalization

**Status:** Draft
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
- [ ] The Executive Dashboard (STORY-059) gains an "AI Insights" panel showing top emerging product/category trends (period-over-period comparison) and detected anomalies (e.g. unusual traffic or conversion drop), with a plain-language narrative summary
- [ ] Customers are scored for churn risk (Low/Medium/High) using recency/frequency/monetary purchase signals plus engagement signals (site visits, email opens where available); scores are viewable as a filterable, exportable list
- [ ] Churn-risk segments can be exported to/used as a targeting input by the Marketing Console (STORY-050) for win-back campaigns, without duplicating segment-building logic already owned by STORY-050
- [ ] The system proposes candidate campaign ideas (e.g. product/segment pairings) as human-reviewable suggestions only — suggestions are never auto-launched as live campaigns
- [ ] AI-derived personalization segments (customer clusters by purchase pattern/persona affinity) are viewable by Marketing and Executive roles and can be used as a targeting input in STORY-050 campaigns
- [ ] Every AI-generated number or claim in the panel links back to its underlying data query, so an Executive can drill into the source data — no unverifiable black-box claims
- [ ] Insight generation runs as a scheduled batch job (not computed per page-load), with a visible "last updated" timestamp on the panel
- [ ] The AI Insights panel is role-gated to Executive, Marketing Manager, and Super Administrator roles per the RBAC model in STORY-038; all other roles do not see it
- [ ] The panel uses Recharts for any charts, consistent with the rest of the Executive Dashboard, and is fully responsive
- [ ] No customer PII is displayed beyond what the viewing role is already permitted to see in the Admin Customers Console (STORY-048)

## Tasks

- [ ] **Database:**
  - [ ] Define `CustomerChurnScore` model: `customerId`, `score`, `riskTier` (LOW/MEDIUM/HIGH), `signalBreakdown` (JSON), `computedAt`
  - [ ] Define `BusinessInsightSnapshot` model: `id`, `period`, `metricType` (TREND/ANOMALY/CAMPAIGN_SUGGESTION), `narrativeText`, `sourceQueryRef`, `generatedAt`
  - [ ] Add indexes supporting filtering churn scores by `riskTier` and fetching the latest `BusinessInsightSnapshot` per `metricType`

- [ ] **API:**
  - [ ] `GET /api/admin/ai-insights/summary` — latest trend/anomaly narrative snapshot
  - [ ] `GET /api/admin/ai-insights/churn-risk` — paginated, filterable churn-risk list
  - [ ] `GET /api/admin/ai-insights/campaign-suggestions` — latest human-reviewable campaign suggestions
  - [ ] All endpoints enforce role-gating (Executive / Marketing Manager / Super Administrator only) via the STORY-038 permission checks and call the Service Layer only

- [ ] **Service/Backend:**
  - [ ] `business-insights.service.ts`: orchestrates the scheduled batch computation — period-over-period trend/anomaly aggregation plus LLM-generated narrative summarization, referencing the underlying source query for each claim
  - [ ] `churn-scoring.service.ts`: computes RFM-style (recency/frequency/monetary) plus engagement-signal churn scores; documented, recalibratable thresholds for LOW/MEDIUM/HIGH tiers
  - [ ] Campaign-suggestion generation: LLM prompted with current trend and segment data, producing structured (not freeform) suggestion records stored as `BusinessInsightSnapshot` rows with `metricType = CAMPAIGN_SUGGESTION`
  - [ ] Scheduled batch job trigger — since Redis/BullMQ are marked "planned/future" in `docs/blueprint.md` Section 3, implement an interim cron-style scheduled trigger (or documented manual "Recompute Now" admin action) with a clear migration path to a queue-based job runner later
  - [ ] `ai-insights.repository.ts` — the only file allowed to query `CustomerChurnScore`/`BusinessInsightSnapshot` directly via Prisma

- [ ] **Frontend:**
  - [ ] `AIInsightsPanel.tsx` embedded in the Executive Dashboard (STORY-059), showing the narrative summary and "last updated" timestamp
  - [ ] `ChurnRiskTable.tsx` with filtering by risk tier and an export action
  - [ ] `CampaignSuggestionCards.tsx` with a "Send to Marketing Console" action that hands off into STORY-050 rather than launching anything directly
  - [ ] Drill-down links from every displayed metric/claim to its source data view

- [ ] **Validation:**
  - [ ] Zod schemas for admin API filters (risk tier, date range, pagination)
  - [ ] RBAC guard reusing STORY-038's permission-check utilities on every endpoint and panel render

- [ ] **Testing:**
  - [ ] Unit tests for the churn scoring formula and threshold tiering
  - [ ] Unit tests for trend/anomaly detection logic
  - [ ] Unit tests confirming non-permitted roles are denied access to the panel and its APIs
  - [ ] Integration test for the scheduled batch job producing a `BusinessInsightSnapshot` and updating `CustomerChurnScore` rows
  - [ ] Snapshot/UI test for the AI Insights panel rendering with seeded data

- [ ] **Documentation:**
  - [ ] Document the churn-scoring model, its inputs, and how to recalibrate risk-tier thresholds
  - [ ] Document the batch job schedule and the manual re-run procedure
  - [ ] Explicitly document that demand forecasting is out of scope for this story and tracked as a distinct future phase per `docs/blueprint.md` Section 5

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
