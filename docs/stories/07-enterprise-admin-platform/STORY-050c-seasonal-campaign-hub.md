# STORY-050c: Seasonal Campaign Hub

**Status:** Done (core scope) — see `docs/architecture-decisions.md`
2026-10-02 entry for deviations (pure linking + reporting record, no
cascading status automation into linked entities; a new
`SeasonalCampaignStatus` enum rather than reusing a sibling one; the
homepage-section picker as a two-round-trip client-side read rather
than a new admin endpoint).

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator

## Context

The last of five sub-stories split out of STORY-050 (Marketing
Console) — confirmed with the user 2026-10-02, recorded in
`docs/blueprint.md` Section 9a. Built last deliberately: its AC asks
it to "tie together a coupon, a popup, a homepage section override,
and an email/SMS/WhatsApp send" — all four of those are built by
050a/050b/050d/050e respectively, so this story only had to exist once
they did. It covers AC bullet 1 and the shared Draft/Scheduled/Active/
Ended + role-gating + performance-summary bullets from
`docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`.

## Acceptance Criteria

- [x] A seasonal campaign hub creates a named campaign with a date
      range (start/end) that can optionally link a popup, a coupon, an
      email/SMS/WhatsApp campaign, and a homepage section — each
      already created in its own console; this hub does not create or
      publish any of them itself
- [x] Draft → Scheduled → Active → Ended status workflow, plus
      Archived as a terminal housekeeping move from any non-Archived
      state
- [x] RBAC is enforced (View/Edit/Approve — Approve specifically gates
      Scheduled → Active and Active → Ended, the same "makes it live or
      takes it down" bar every other admin console in this epic uses)
- [x] Every create/update/status-change is audit-logged
- [x] A performance summary is surfaced per campaign — a per-channel
      breakdown (linked popup's impressions/clicks/dismissals, linked
      coupon's redemption count, linked email/SMS campaign's sent/
      failed/skipped counts), not one blended number

## Tasks

- [x] **Database:** `SeasonalCampaign` (name, status, date range, four
      nullable FKs to `PromotionalPopup`/`Coupon`/`EmailSmsCampaign`/
      `HomepageSection`, each `onDelete: SetNull`) and a new
      `SeasonalCampaignStatus` enum.
- [x] **API:** `/api/admin/marketing/seasonal-campaigns` (list/
      create), `/[id]` (detail/update), `/[id]/status`, `/[id]/
      performance`.
- [x] **Service/Backend:** `seasonal-campaign.service.ts` — admin CRUD,
      the status-transition table, `getSeasonalCampaignPerformanceSummary`
      (fans out to each linked item's own existing performance read
      rather than building a second analytics system).
- [x] **Frontend:** `src/app/(admin)/admin/marketing/seasonal-campaigns/`
      (list + new + edit), `admin-seasonal-campaign-editor-view.tsx`
      (date range, status actions, four link pickers reusing each
      module's existing admin list endpoint, performance panel).
- [x] **Validation:** `seasonal-campaign.schema.ts` — name/date-range
      required, `endDate > startDate`, the four link fields optional.
- [x] **Testing:** `tests/unit/seasonal-campaign-service.test.ts` (9
      tests — CRUD, status-transition permission gating, illegal-
      transition rejection, date-range validation, performance
      aggregation against real linked fixtures);
      `tests/e2e/admin-seasonal-campaigns.spec.ts` (full workflow:
      permission-denied Active transition, link an existing published
      popup, walk the real UI through every status, performance panel
      reflects real recorded impressions throughout).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry documents the no-cascade scope decision, the new status
      enum, the per-channel performance summary, and the homepage-
      section picker's two-round-trip approach.

## Dependencies

- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-050a (Promotional Pop-up Manager) — linked popup + its
  performance summary
- STORY-050b (Coupon & Promotion Management UI) — linked coupon
- STORY-050d (Email/SMS/WhatsApp Campaign Builder) — linked campaign +
  its delivery summary
- STORY-050e (Landing Page Builder) — unblocked this story per the
  confirmed sub-story build order, no direct code dependency
- STORY-042 (Homepage Visual Builder) — linked homepage section, read
  via its existing admin layout endpoints (no new endpoint added)

## Out of scope (left for future work, or deliberately not built)

- Any cascading automation between the hub's status and a linked
  item's own status — the admin manages each linked item's lifecycle
  in its own console; see the architecture-decisions.md entry for the
  full reasoning
- A dedicated "list sections for the current layout" admin endpoint —
  the picker does two existing-endpoint round trips instead; worth
  promoting to a real endpoint only if a second caller needs the same
  read
- A single blended "performance score" across channels — the summary
  stays a per-channel breakdown since the numbers aren't comparable

## References

- `docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`
  (the umbrella story)
- `docs/blueprint.md` Section 9a (the sub-story split decision and
  build order)
