# STORY-054: System Settings

**Status:** Done (additive/consolidation scope — see Scope Decision)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Super Administrator, Administrator, Finance Manager

## User Story
As a Super Administrator, I want to configure company info, currencies, languages, taxes, shipping defaults, payment methods, notification templates, and reward/referral defaults in one settings console, so that platform-wide configuration doesn't require a code change.
As a Super Administrator, I want feature flags I can toggle per environment, so that in-progress features can be enabled or disabled without a deploy.

## Description
This story delivers the System Settings console module from `docs/blueprint.md` Section 7: "company info, currencies, languages, taxes, shipping, payment methods, email/notification templates, reward/referral rules, feature flags." Delivery zone management is broken out as its own dedicated module (STORY-055) given the blueprint's explicit gap callout on zone-wise delivery charges, so this story owns the surrounding shipping settings (specifically the single global free-shipping threshold, per `.claude/skills/delivery-zone-pricing/SKILL.md`) and every other settings category listed above.

## Acceptance Criteria
- [x] Company Info section: legal name, brand name, logo (via Media Library), registered address, contact details, business registration/tax ID, social links
- [x] Currencies section: supported currency list, base currency, and exchange rate source/manual override — flagged that multi-currency scope for launch vs. future is an open item per `docs/blueprint.md` Section 10; this section delivers the settings surface regardless of final launch scope
- [x] Languages section: supported locale list and default locale
- [x] Taxes section: tax rate rules by region/category and a tax-inclusive vs. tax-exclusive pricing display toggle
- [x] Shipping section: the single global free-shipping threshold (order value above which shipping is free platform-wide, per the confirmed delivery-zone-pricing decision — not configurable per zone), with a link out to Delivery Zone Management (STORY-055) for zone-specific rates
- [x] Payment Methods section: enable/disable available payment methods in a provider-agnostic way — flagged that the specific gateway provider(s) are unconfirmed per blueprint Section 10, so this section lists configured methods rather than hardcoding one gateway's UI
- [x] Email/Notification Templates section: editable templates with merge-field support and a preview pane
- [x] Reward/Referral Rules section — see Scope Decision: a link-out card only, no duplicate defaults form
- [x] Feature Flags section lists togglable flags (key, enabled, description) that take effect without a deploy
- [x] Every settings change is logged to the audit log via `writeAuditLog`

## Scope Decision

Research before implementation found several ACs already substantially
covered by earlier stories, narrowing this story's real net-new work:

- **Rewards/Referral defaults** — fully built by STORY-049
  (`RewardSetting`/`ReferralSetting` + a complete admin UI at
  `/admin/rewards-referrals`). Rather than add a second, narrower
  "platform-wide defaults" form here that would fragment that single
  source of truth, this section is a link-out card only.
- **Notification Templates** — the data model (`NotificationTemplate`),
  seed data, and the merge-field render engine
  (`notification.service.ts::renderTemplate`) already existed from
  STORY-032, which deliberately deferred "the authoring UI" to this
  story. Only the admin CRUD + preview pane (`notification-template-admin.service.ts`) is new.
  Distinct from `notification.service.ts`'s own sending pipeline.
  Model naming note: `NotificationTemplate.channel` is the actual enum
  name in `prisma/schema.prisma` (the AC/task list above used
  "languages"/generic wording in a few places written before that
  schema existed).
- **Shipping** — `ShippingSetting` (the global free-shipping threshold)
  already existed with a seeded value and a read path consumed by
  checkout. Only the admin write surface (`updateFreeShippingThreshold`)
  is new.
- **Company Info** — `footer-config.ts`'s `contactInfo` was hardcoded
  with a comment explicitly flagging it for this story. `CompanySetting`
  replaces it via a zero-downtime cutover (`getResolvedCompanyInfo()`
  falls back to the old hardcoded values until an admin saves a row).
  `socialLinks` is captured in the admin form but deliberately **not**
  wired to the storefront's `<SocialLinks>` icon-bearing component —
  doing so would require passing a `LucideIcon` reference across the
  Server→Client boundary, which STORY-052 already hit and avoided by
  passing icon names as strings instead. Out of scope here; revisit if
  the storefront social links need to become admin-editable.
- **Low Stock threshold** (not in this story's own AC list, but
  `docs/blueprint.md`'s "Known deferred/leftover items" explicitly tied
  `admin-dashboard.service.ts`'s hardcoded `LOW_STOCK_THRESHOLD = 10`
  constant to this story) — folded in as one more singleton setting
  (`InventorySetting`), replacing that real, already-flagged hardcoded
  value.
- **Currencies, Languages, Taxes, Payment Methods, Feature Flags** are
  genuinely greenfield. Payment gateway provider and multi-currency
  launch scope are both still open per blueprint Section 10 — built
  provider/scope-agnostic (a settings shell, not a specific
  integration).

`AdminModule.SystemSettings` was a pre-reserved, zero-usage enum value
(the same situation `CMSWorkflow` was in before STORY-053) — this story
is its first real consumer.

## Tasks
- [x] **Database:** `CompanySetting`, `CurrencySetting`, `LocaleSetting`, `TaxSetting` + `TaxRateRule`, `PaymentMethodSetting`, `FeatureFlag`, `InventorySetting` — singleton-row pattern (`id: "global"`) for the single-record categories, plain list tables for the genuinely list-shaped ones. Reuses `ShippingSetting`, `RewardSetting`, `ReferralSetting`, `NotificationTemplate` as-is.
- [x] **API:** one route per category under `/api/admin/settings/{company,currencies,locales,taxes,tax-rules,tax-rules/[id],shipping,payment-methods,payment-methods/[id],feature-flags,feature-flags/[id],inventory,notification-templates,notification-templates/[id],notification-templates/preview}`.
- [x] **Service/Backend:** `system-settings.repository.ts` + `system-settings.service.ts` (one permission-gated, audit-logged function per category, mirroring `rewards.service.ts`'s shape) and `notification-template-admin.service.ts` (distinct from the STORY-032 sending pipeline).
- [x] **Frontend:** `src/app/(admin)/admin/settings/page.tsx` + `admin-settings-view.tsx`, a 9-tab layout (Company, Currencies, Languages, Taxes, Shipping & Inventory, Payment Methods, Notifications, Rewards & Referrals, Feature Flags), each tab a small self-contained panel.
- [x] **Validation:** `src/validation/system-settings.schema.ts` — one Zod schema per category; numeric bounds on tax rates; empty-string form fields normalized to `null` before persisting.
- [x] **Testing:** `tests/unit/system-settings-service.test.ts`, `tests/unit/notification-template-admin-service.test.ts`, an added assertion in `tests/unit/admin-dashboard-service.test.ts` proving the low-stock count reads the configured threshold rather than a hardcoded constant, and `tests/e2e/admin-system-settings.spec.ts` (Company Info → real footer, a Feature Flag toggle → API read, a notification template edit → preview → save).
- [x] **Documentation:** this doc, `docs/architecture-decisions.md`, `docs/blueprint.md` Section 9a.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-055 (Delivery Zone Management) — owns zone-specific shipping rates; this story owns only the global free-shipping threshold and links out to that console
- STORY-032 (Notifications) — consumes the notification templates this module manages

Note: payment gateway provider(s) and multi-currency launch scope are unconfirmed per `docs/blueprint.md` Section 10 — build the Payment Methods and Currencies settings surfaces provider-agnostic and do not hardcode a specific integration.

## References
- `docs/blueprint.md` Section 7 ("System Settings" console module bullet)
- `docs/blueprint.md` Section 10 (open items: payment gateway, multi-currency scope)
- `.claude/skills/delivery-zone-pricing/SKILL.md` (global free-shipping threshold decision)
