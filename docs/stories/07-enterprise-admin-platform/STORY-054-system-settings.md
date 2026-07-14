# STORY-054: System Settings

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Super Administrator, Administrator, Finance Manager

## User Story
As a Super Administrator, I want to configure company info, currencies, languages, taxes, shipping defaults, payment methods, notification templates, and reward/referral defaults in one settings console, so that platform-wide configuration doesn't require a code change.
As a Super Administrator, I want feature flags I can toggle per environment, so that in-progress features can be enabled or disabled without a deploy.

## Description
This story delivers the System Settings console module from `docs/blueprint.md` Section 7: "company info, currencies, languages, taxes, shipping, payment methods, email/notification templates, reward/referral rules, feature flags." Delivery zone management is broken out as its own dedicated module (STORY-055) given the blueprint's explicit gap callout on zone-wise delivery charges, so this story owns the surrounding shipping settings (specifically the single global free-shipping threshold, per `.claude/skills/delivery-zone-pricing/SKILL.md`) and every other settings category listed above.

## Acceptance Criteria
- [ ] Company Info section: legal name, brand name, logo (via Media Library), registered address, contact details, business registration/tax ID, social links
- [ ] Currencies section: supported currency list, base currency, and exchange rate source/manual override — flagged that multi-currency scope for launch vs. future is an open item per `docs/blueprint.md` Section 10; this section delivers the settings surface regardless of final launch scope
- [ ] Languages section: supported locale list and default locale
- [ ] Taxes section: tax rate rules by region/category and a tax-inclusive vs. tax-exclusive pricing display toggle
- [ ] Shipping section: the single global free-shipping threshold (order value above which shipping is free platform-wide, per the confirmed delivery-zone-pricing decision — not configurable per zone), with a link out to Delivery Zone Management (STORY-055) for zone-specific rates
- [ ] Payment Methods section: enable/disable available payment methods in a provider-agnostic way — flagged that the specific gateway provider(s) are unconfirmed per blueprint Section 10, so this section lists configured methods rather than hardcoding one gateway's UI
- [ ] Email/Notification Templates section: editable templates (order confirmation, shipping update, password reset, review-approved, question-answered, etc.) with merge-field support and a preview pane
- [ ] Reward/Referral Rules section holds only platform-wide defaults (e.g. default point expiry) and links to STORY-049's dedicated console for the detailed rule builder, rather than duplicating that UI
- [ ] Feature Flags section lists togglable flags (key, enabled, description) that take effect without a deploy
- [ ] Every settings change is logged to the audit log (STORY-057) with before/after values

## Tasks
- [ ] **Database:** `SystemSetting` (typed key-value with category, or dedicated per-category tables where structure warrants it — e.g. `NotificationTemplate` as its own table), `FeatureFlag` (key, enabled, description).
- [ ] **API:** `/api/admin/settings/company`, `/api/admin/settings/currencies`, `/api/admin/settings/languages`, `/api/admin/settings/taxes`, `/api/admin/settings/shipping`, `/api/admin/settings/payment-methods`, `/api/admin/settings/notification-templates`, `/api/admin/settings/feature-flags`.
- [ ] **Service/Backend:** `system-settings.service.ts` (typed get/set per category with cache invalidation on write, since settings are read frequently across the app) and `notification-template.service.ts`.
- [ ] **Frontend:** `src/app/(admin)/settings/page.tsx` with a category sidebar, a notification template editor with a merge-field picker and preview pane, and a feature-flag toggle list.
- [ ] **Validation:** Zod schema per settings category; numeric bounds on tax rates and exchange rates.
- [ ] **Testing:** Unit tests for typed settings get/set and cache invalidation; unit test template merge-field rendering; e2e test changing the global free-shipping threshold and confirming it affects checkout shipping calculation (STORY-027/STORY-055).
- [ ] **Documentation:** Document each settings category's field contract, and explicitly flag payment-method provider and multi-currency scope as pending client confirmation per blueprint Section 10.

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
