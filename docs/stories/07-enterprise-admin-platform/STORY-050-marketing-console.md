# STORY-050: Marketing Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Content Editor, Super Administrator

## User Story
As a Marketing Manager, I want to create and manage seasonal campaigns, email/SMS/WhatsApp sends, coupons, landing pages, and popup campaigns from one console, so that I can run marketing initiatives independently of engineering.

## Description
This story delivers the Marketing Console module from `docs/blueprint.md` Section 7: "seasonal campaigns, email/SMS/WhatsApp campaigns, coupons, landing pages, popup campaigns, referral/reward campaigns." Popup campaigns are called out explicitly in the blueprint and are new relative to other stories in this epic. Coupon creation reuses the STORY-029 data model, referral/reward campaign creation reuses STORY-049's console, and landing pages reuse the Homepage Visual Builder's (STORY-042) section component library rather than duplicating a page-building system.

## Acceptance Criteria
- [ ] A seasonal campaign hub creates a named campaign with a date range that can tie together a coupon, a popup, a homepage section override, and an email/SMS/WhatsApp send under one umbrella
- [ ] An email/SMS/WhatsApp campaign builder supports audience segment selection, a message template with merge fields, schedule-send or send-now, and delivery status tracking
- [ ] Coupon management (create/edit/deactivate percentage/fixed/free-shipping codes, usage limits, minimum order value, applicable products/categories, stacking rules) is available from this console and reads/writes the same `Coupon` model STORY-029 defines
- [ ] A landing page builder creates a simple no-code page (headline, hero image via Media Library, content blocks, CTA, own URL slug) for campaign-specific traffic, reusing STORY-042's section component library
- [ ] A popup campaign builder configures trigger rules (time-on-page, exit-intent, scroll depth), display rules (page targeting, frequency cap per visitor), content (image/text/CTA via Media Library), a start/end schedule, and basic A/B variant support
- [ ] A performance summary (impressions/clicks/conversions where trackable) is surfaced per campaign
- [ ] All campaign types (seasonal, email/SMS/WhatsApp, coupon, landing page, popup) support Draft/Scheduled/Active/Ended status and are role-gated per STORY-038

## Tasks
- [ ] **Database:** `MarketingCampaign` (umbrella record), `EmailSmsCampaign` (audience, template, channel, schedule, deliveryStats), `LandingPage` (slug, sections JSON reusing STORY-042's section config shape), `PopupCampaign` (triggerType, targetPages, frequencyCap, content, schedule); link to `Coupon` (STORY-029) and `ReferralRule`/`RewardCampaign` (STORY-049) rather than redefining them.
- [ ] **API:** `/api/admin/marketing/campaigns`, `/api/admin/marketing/email-sms`, `/api/admin/marketing/landing-pages`, `/api/admin/marketing/popups`, `/api/admin/marketing/coupons` (thin wrapper over STORY-029's coupon API).
- [ ] **Service/Backend:** `marketing-campaign.service.ts`, `popup-campaign.service.ts`, `landing-page.service.ts` (delegating section rendering to STORY-042's section renderer), integrating `notification.service` (STORY-032) for email/SMS/WhatsApp delivery.
- [ ] **Frontend:** `src/app/(admin)/marketing/page.tsx` with tabs (Campaigns, Email/SMS/WhatsApp, Coupons, Landing Pages, Popups), a popup trigger/frequency-cap rule builder, and a landing page block editor that reuses STORY-042's section editor components.
- [ ] **Validation:** Zod schemas per campaign type; popup frequency-cap and trigger-rule bounds; coupon stacking-rule validation.
- [ ] **Testing:** Unit tests for popup trigger/frequency-cap logic and coupon stacking rules; e2e test creating a popup campaign and confirming it renders on the storefront once its configured trigger condition is met.
- [ ] **Documentation:** Document how the landing page builder reuses Homepage Builder section components to avoid duplicate rendering logic between STORY-042 and this story.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-029 (Coupons & Promotions) — coupon data model
- STORY-032 (Notifications) — email/SMS/WhatsApp delivery
- STORY-041 (Media Library) — campaign assets
- STORY-042 (Homepage Visual Builder) — the landing page block editor reuses its section component library instead of duplicating it
- STORY-049 (Rewards & Referrals Campaign Management) — referral/reward campaigns surfaced here link to that console's rules

## References
- `docs/blueprint.md` Section 7 ("Marketing Console" bullet, explicitly including "popup campaigns")
