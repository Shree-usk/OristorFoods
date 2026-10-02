# STORY-050d: Email/SMS/WhatsApp Campaign Builder

**Status:** Done (core scope). See `docs/architecture-decisions.md`
2026-10-02 entry for the no-cron/manual-trigger decision, the
`NotificationLog` reuse for dedup + delivery tracking, and the
`marketingOptIn`-vs-`emailOptIn` consent distinction.

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator

## Context

The fourth of five sub-stories split out of STORY-050 (Marketing
Console) — confirmed with the user 2026-10-02, recorded in
`docs/blueprint.md` Section 9a. STORY-050c (Seasonal campaign hub)
explicitly depends on this story and STORY-050e existing first, so
this landed before it. STORY-050a (Popups) and STORY-050b (Coupons/
Promotions) are already merged.

AC bullet (STORY-050's umbrella doc): *"An email/SMS/WhatsApp campaign
builder supports audience segment selection, a message template with
merge fields, schedule-send or send-now, and delivery status
tracking."* `notification.service.ts`'s own header comment already
flagged the gap this fills: *"Transactional (event-triggered,
one-to-one) notifications only — bulk marketing campaigns are
STORY-050's."*

## Acceptance Criteria

- [x] Admin can create a campaign (name, channel, audience segment, a
      message template with `{{name}}` merge field, Email also takes a
      subject)
- [x] Audience segment selection: all customers, a specific
      `CustomerGroup`, loyalty members (positive lifetime points), or
      referral members (has referred or been referred)
- [x] Send now, or schedule for later — a scheduled campaign is only
      actually dispatched when an admin explicitly triggers "Send due
      campaigns" (no cron infrastructure exists in this codebase; see
      the architecture-decisions entry for why that's the deliberate,
      user-confirmed scope for this pass)
- [x] Delivery status tracking — a per-campaign summary (sent/failed/
      skipped-no-consent), backed by the existing `NotificationLog`
      table, not a second ledger
- [x] RBAC: `View` for reads, `Edit` for draft content, `Approve`
      specifically for whatever actually sends (send-now and
      process-due)
- [x] Every campaign create/update/send is audit-logged
- [x] Consent is respected per channel: Email gates on
      `User.marketingOptIn`; SMS/WhatsApp gate on the existing
      `smsOptIn`/`whatsappOptIn` + a phone on file

## Tasks

- [x] **Database:** `EmailSmsCampaign` (name, channel, audienceTarget,
      targetCustomerGroup, subject, body, status, scheduledAt, sentAt,
      createdById) + `CampaignAudienceTarget`/`CampaignStatus` enums.
      No changes to `NotificationLog`/`NotificationTemplate` — both
      reused as-is.
- [x] **Repository:** `campaign.repository.ts` (CRUD + `
      listDueCampaigns`), `campaign-audience.repository.ts` (bulk
      segment resolution — `listAllCustomers`, `listCustomersByGroup`,
      `listLoyaltyMemberUserIds`, `listReferralMemberUserIds`), a new
      `getDeliverySummaryByTriggeringEventId` added to the existing
      `notification.repository.ts`.
- [x] **API:** `/api/admin/marketing/email-sms` (list/create), `/[id]`
      (detail/update), `/[id]/send` (send now), `/[id]/performance`,
      `/process-due` (send all due scheduled campaigns).
- [x] **Service/Backend:** `email-sms-campaign.service.ts` — CRUD,
      audience resolution + consent filtering, `sendCampaignNow`/
      `processDueCampaigns`, delivery summary. `notification.service.ts`
      gained one exported function (`sendCampaignMessage`) reusing a
      shared `dispatchAndLog` helper extracted from the existing
      `sendToChannel` — the transactional path's behavior is
      unchanged, confirmed by the full existing notification test
      suite passing unmodified.
- [x] **Frontend:** `/admin/marketing/email-sms` — a list + create/edit
      dialog (channel-conditional subject, audience-conditional
      customer-group select, a merge-field-aware body textarea,
      optional schedule), per-row "Send now", and a top-of-page "Send
      due campaigns" action.
- [x] **Validation:** `campaign.schema.ts` — channel-conditional
      subject requirement, audience-conditional customer-group
      requirement.
- [x] **Testing:** `tests/unit/email-sms-campaign-service.test.ts` (14
      tests — permission gating, all four audience segments against
      real seeded data, consent filtering, real dedup via
      `NotificationLog`'s own unique constraint, `processDueCampaigns`
      correctness, merge-field rendering, edit-blocked-once-Sent);
      regression on `notification-service`/`notification-routes`/
      `qa-notifications` (22 tests, confirming the `sendToChannel`
      refactor is behavior-preserving); `tests/e2e/
      admin-email-sms-campaigns.spec.ts` (a real SMS campaign created
      and sent through the console, segment + consent filtering
      verified against real `NotificationLog` rows).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry.

## Dependencies

- STORY-032 (Notifications) — `notification.service.ts`'s provider
  abstraction, `NotificationLog`/`NotificationPreference` models, all
  reused directly
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-034 — `User.marketingOptIn`, the consent flag Email campaigns
  gate on
- STORY-030/031 — `RewardTransaction`/`ReferralAttribution`, the data
  the `LoyaltyMembers`/`ReferralMembers` segments resolve against

## Out of scope (deliberate, documented, not silently skipped)

- **Real unattended scheduled sending** — this codebase has no cron/
  background-job infrastructure anywhere, and hosting/cloud provider
  is still an open item (`docs/blueprint.md` Section 10). Surfaced to
  and resolved with the user before implementation: a "Send due
  campaigns" admin action is the trigger for now; real automation is
  an ops task for once hosting is confirmed.
- A/B variants, click-through tracking, or a richer templating engine
  beyond `{{key}}` substitution — not asked for by this story's AC.

## References

- `docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`
  (the umbrella story)
- `docs/blueprint.md` Section 9a (the sub-story split decision) and
  Section 10 (hosting/cloud provider — the unresolved item this
  story's scheduling scope decision is tied to)
