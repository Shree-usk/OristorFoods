# STORY-032: Notifications (Email/SMS/WhatsApp)

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer who just placed an order, I want to receive a confirmation notification (email, and SMS/WhatsApp if I've opted in), so that I have a record of my purchase and trust that it went through.

As a customer waiting for delivery, I want to be notified when my order ships and when it's delivered, so that I know what's happening without checking the site.

As a customer who earns reward points, I want to be notified when I earn or am close to a new tier, so that the loyalty programme feels responsive rather than invisible.

## Description
This story implements the transactional notification service that other commerce stories trigger off of: order confirmation, shipment/dispatch, delivery, reward-earned, and other lifecycle events, delivered across email, SMS, and WhatsApp channels. It corresponds to the "email/notification templates" line under System Settings (`docs/blueprint.md` Section 7) and the "Marketing Console — email/SMS/WhatsApp campaigns" capability, though this story is specifically the **transactional** (event-triggered, one-to-one) notification path, not bulk marketing campaigns. Templates themselves are admin-managed content (Section 7's "email/notification templates" under System Settings) — this story defines the template *contract* (what variables/placeholders a given notification type must support) and the delivery mechanism, and depends on the admin template-management capability rather than hardcoding message copy in application code.

## Acceptance Criteria
- [ ] A provider-agnostic notification-service interface exists (e.g. `send(channel, templateKey, recipient, variables)`) so email, SMS, and WhatsApp providers are each implemented as swappable adapters behind a common contract — consistent with the abstraction pattern used for payments (STORY-026), since concrete SMS/WhatsApp provider selection is not confirmed by the blueprint and should not be guessed at.
- [ ] At minimum, an email adapter is implemented against a real or sandbox-capable provider (e.g. an SMTP/dev-catcher setup suitable for local development) so the notification flow can be exercised end to end without requiring a production email service to be configured.
- [ ] SMS and WhatsApp channels are implemented behind the same interface using a mock/sandbox adapter for development and testing (mirroring STORY-026's mock-provider approach), since no SMS/WhatsApp provider is named in the blueprint; concrete provider integration is a follow-up story once a provider is selected.
- [ ] The following transactional notification types are supported end to end (template key defined, trigger wired, variables populated): order confirmation, order dispatched/shipped, order delivered, order cancelled, reward points earned, referral qualified/rewarded (STORY-031) — each triggered by the corresponding event already emitted by STORY-028/STORY-030/STORY-031 rather than this story polling for state changes.
- [ ] Each notification type has a defined, documented variable contract (e.g. order-confirmation requires order number, item list, total, delivery estimate) that the admin template-management module (Section 7, admin epic) fills in — this story does not hardcode message text, only the trigger, the required variables, and the delivery mechanism.
- [ ] A customer's channel preferences (e.g. opted in to SMS/WhatsApp or email-only) and contact details are respected — a channel is never used without the customer having a valid, opted-in contact method on file for that channel.
- [ ] Failed notification delivery (provider error, invalid contact info) is logged with enough detail to diagnose and does not block or roll back the triggering business action (e.g. a failed shipment SMS never prevents the order status from updating to "Dispatched").
- [ ] Notification delivery attempts and outcomes are recorded (per customer, per notification type, per channel, status: sent/failed/skipped-no-consent) so the admin console's "failed payments... system health" style visibility (Section 7 dashboard) has a data source, and so a customer support agent (future story) can look up "did this customer receive their order confirmation."
- [ ] Duplicate-send protection exists so the same triggering event does not fire the same notification twice (e.g. due to a retried webhook or duplicate event emission from STORY-028's integration hook).
- [ ] The notification service is called from other services (`order.service.ts`, `rewards.service.ts`, `referral.service.ts`) via the shared interface, not by each of those services independently deciding how to format or send a message — keeping template/channel logic centralized in this module.

## Tasks
- [ ] **Database:** Add a `NotificationLog` model to `prisma/schema.prisma` (recipient, channel, templateKey, status, providerReference, triggeringEvent/orderId reference, timestamps) and a `NotificationPreference` model (or fields on the customer/user model) capturing per-channel opt-in status.
- [ ] **API:** `POST /api/notifications/preferences` — customer updates their channel opt-in preferences (used by STORY-034's account settings, this story exposes the underlying capability).
- [ ] **API:** Internal-only trigger surface (no public endpoint needed) — other services call `notification.service.ts` directly as a module-level dependency, not over HTTP, since it's an internal cross-service call within the same Next.js app.
- [ ] **Service/Backend:** Define `src/services/notification/notification-provider.interface.ts` (the channel-adapter contract: `send(recipient, templateKey, variables)` returning a delivery result).
- [ ] **Service/Backend:** Implement `src/services/notification/email.provider.ts` against a real/dev-sandbox-capable email service, and `src/services/notification/sms.provider.ts` / `whatsapp.provider.ts` as mock/sandbox adapters (mirroring STORY-026's `MockPaymentProvider` pattern) pending provider selection.
- [ ] **Service/Backend:** Implement `notification.service.ts` — resolves the customer's channel preference and contact info, selects the template key + variable payload for a given event type, calls the appropriate provider adapter, and writes to `NotificationLog` (including duplicate-send guard keyed on triggering-event id + templateKey + recipient).
- [ ] **Service/Backend:** `notification.repository.ts` — the only place `NotificationLog`/`NotificationPreference` Prisma models are queried/mutated.
- [ ] **Service/Backend:** Wire notification triggers into `order.service.ts` (confirmation/dispatched/delivered/cancelled events), `rewards.service.ts` (points-earned event), and `referral.service.ts` (referral-qualified event) from STORY-028/030/031, calling `notification.service.ts` rather than duplicating trigger logic per caller.
- [ ] **Frontend:** Notification-preferences UI control (email/SMS/WhatsApp opt-in toggles) — base component built here for reuse by STORY-034 (Account Settings, Customer Platform epic), which owns the surrounding settings page.
- [ ] **Validation:** Zod schema for preference updates (`src/validation/notification.schema.ts`).
- [ ] **Testing:** Vitest unit tests for `notification.service.ts` covering: correct template/variable selection per event type, opted-out channel is skipped (not attempted), duplicate-send guard prevents a second send for the same event, and provider failure is logged without throwing back to the caller.
- [ ] **Testing:** Playwright/integration test asserting an order-confirmation notification is logged (via the dev/sandbox email adapter) after a successful checkout in the e2e suite.
- [ ] **Documentation:** Document the per-notification-type variable contract (a table: notification type → required variables → trigger source) and the provider-adapter pattern in `docs/architecture-decisions.md`, explicitly noting SMS/WhatsApp provider selection is pending (mirrors the payment-gateway open item in blueprint Section 10, even though Section 10 doesn't name SMS/WhatsApp explicitly — flag it as the same category of decision).

## Dependencies
- STORY-028 (Order Management) — order-lifecycle events trigger order-related notifications.
- STORY-030 (Rewards / Loyalty Club) — points-earned events trigger reward notifications.
- STORY-031 (Referral Programme) — referral-qualified events trigger referral notifications.
- STORY-026 (Payment Integration) — the mock/sandbox-provider abstraction pattern this story mirrors for SMS/WhatsApp.
- Admin template-management module (Section 7, "email/notification templates" under System Settings, admin epic — likely part of STORY-054) — related: this story depends on admin-authored template content for the copy each `templateKey` resolves to; it does not hardcode message text.

## Out of Scope
- Bulk/marketing email-SMS-WhatsApp campaigns (Marketing Console, STORY-050) — this story is transactional, one-to-one notifications only.
- Admin template-authoring UI (rich text/variable editor for notification templates) — admin epic, likely STORY-054 (System Settings).
- Concrete SMS/WhatsApp provider integration (e.g. Twilio, WhatsApp Business API) — mocked/sandboxed here pending a provider decision, mirroring STORY-026's payment-gateway scoping.
- Push notifications (not named in the blueprint's current channel set).

## References
- `docs/blueprint.md` Section 5 (Commerce lifecycle — notifications implied at Order Confirmation/Shipment/Delivery/Rewards/Referral steps), Section 7 (System Settings — "email/notification templates"; Marketing Console — "email/SMS/WhatsApp campaigns")
