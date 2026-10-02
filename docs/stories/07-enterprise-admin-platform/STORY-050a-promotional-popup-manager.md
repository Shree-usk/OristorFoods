# STORY-050a: Promotional Pop-up Manager

**Status:** Done (core scope) — see `docs/architecture-decisions.md`
2026-10-02 entry for deviations (View/Edit/Approve permission reuse
instead of the suggested granular scheme, new-vs-returning-visitor
targeting resolved as "don't exclude" server-side, guest frequency
capping is client-side only, the display-only `couponCode` field's
boundary with STORY-050b).

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Content Editor, Super Administrator

## Context

The first of five sub-stories split out of STORY-050 (Marketing
Console) — confirmed with the user 2026-10-02, recorded in
`docs/blueprint.md` Section 9a. The full feature spec lives in
`docs/stories/07-enterprise-admin-platform/STORY-Additional.md`
("PROJECT CINNAMON — ADMIN CMS ENHANCEMENT"), sections 3–9
(Promotional Pop-up Manager, Display Targeting, Audience Targeting,
Triggers, Frequency Control, Scheduling, Workflow) plus the
cross-cutting sections 10–13 (Preview, Analytics-readiness, RBAC,
Audit) that apply to both Hero Banners and Popups. This story covers
only the Popup half of that document — Hero Banner management
(sections 1–2) was already delivered by STORY-042 (Homepage Visual
Builder) and STORY-041 (Media Library).

## Acceptance Criteria

- [x] Admin can create and manage promotional pop-ups (title,
      description, image, mobile image, video, CTA + optional
      secondary CTA, an optional display-only coupon code)
- [x] Admin can select where a popup appears (all pages, homepage,
      products, recipes, blog)
- [x] Admin can configure audience targeting (all visitors, new/
      returning visitors — best-effort only, no visitor-session
      architecture exists — authenticated customers, a specific
      customer group, loyalty members, referral members)
- [x] Admin can configure triggers (immediate, time delay, scroll
      depth, exit intent, page views, add-to-cart, before-checkout)
- [x] Admin can configure frequency (once per session/day/week/
      customer, until dismissed) — real server-side enforcement for
      authenticated customers; guest `OncePerSession` capping is
      client-side only
- [x] Admin can schedule a popup (start/end date) through a Draft →
      Scheduled → Published → Paused → Unpublished/Archived workflow
- [x] Admin can preview a popup (desktop/tablet/mobile) before
      publishing, without affecting live analytics or frequency caps
- [x] RBAC is enforced (View/Edit/Approve — Approve specifically gates
      publish and unpublish)
- [x] Every popup create/update/status-change is audit-logged
- [x] A performance summary (impressions/clicks/dismissals) is
      surfaced per popup — basic A/B variant support (a shared
      `variantGroupId` + weighted traffic split) is included
- [x] Responsive behavior (desktop/mobile image variants) and
      accessibility (alt text) are supported

## Tasks

- [x] **Database:** `PromotionalPopup` (content, targeting, trigger,
      frequency cap, schedule, status, A/B variant fields) and
      `PopupInteraction` (popupId, userId, type: Impression/Click/
      Dismissal) — serving both frequency-cap enforcement and the
      performance summary, per the source doc's own "don't build a
      second analytics system" instruction.
- [x] **API:** `/api/admin/marketing/popups` (list/create), `/[id]`
      (detail/update), `/[id]/status` (the single status-writing
      endpoint for publish/pause/unpublish/archive), `/[id]/
      performance`; storefront-facing `GET /api/popups/eligible?
      page=...` and `POST /api/popups/[id]/interactions`.
- [x] **Service/Backend:** `popup.service.ts` — admin CRUD, the
      status-transition table, `resolveEligiblePopup` (page/audience/
      schedule/frequency resolution, pure over pre-fetched state,
      mirroring `reward-campaign.service.ts::resolveActiveMultiplier`
      from STORY-049), `recordInteraction`.
- [x] **Frontend:** `src/app/(admin)/admin/marketing/popups/` (list +
      new + edit), `admin-popup-editor-view.tsx` (content via
      `AssetPickerDialog`, targeting/trigger/frequency/schedule form,
      status actions, preview dialog, performance panel); storefront
      `popup-overlay.tsx` (the live render, reused identically by
      admin Preview) and `popup-trigger-controller.tsx` (mounted once
      in the storefront layout, owns client-side trigger timing).
- [x] **Validation:** `popup.schema.ts` — content/targeting/trigger/
      frequency/schedule field bounds, `startAt < endAt`,
      `triggerValue` required/bounded per `triggerType`.
- [x] **Testing:** `tests/unit/popup-service.test.ts` (16 tests —
      CRUD, status-transition permission gating, every audience-target
      heuristic, schedule-window boundaries, a real authenticated
      frequency-cap block, variant-group weighted pick);
      `tests/e2e/admin-popups.spec.ts` (full workflow: permission-
      denied publish, create → publish → real storefront render →
      impression recorded → dismiss → frequency cap confirmed).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry documents the permission-model reuse, the two honestly-
      bounded gaps, and the `AddToCart`/`BeforeCheckout` trigger
      wiring decisions.

## Dependencies

- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-041 (Media Library) — `AssetPickerDialog` for popup content
- STORY-071 (Customer Group & Pricing Context) — `CustomerGroup` reused
  for audience segmentation
- STORY-049 (Rewards & Referrals Campaign Management) —
  `resolveEligiblePopup`'s shape mirrors `resolveActiveMultiplier`;
  `RewardTransaction`/`ReferralAttribution` back the LoyaltyMembers/
  ReferralMembers audience checks

## Out of scope (left for later STORY-050 sub-stories or future work)

- Live coupon validation for the `couponCode` field — STORY-050b
  (coupon management UI)
- Real new-vs-returning-visitor detection — would require building
  visitor/session-tracking infrastructure, not yet planned
- A full experimentation platform (statistical significance,
  conversion-goal tracking) — the A/B variant support here is a
  traffic-split only

## References

- `docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`
  (the umbrella story)
- `docs/stories/07-enterprise-admin-platform/STORY-Additional.md` §3–13
- `docs/blueprint.md` Section 9a (the sub-story split decision)
