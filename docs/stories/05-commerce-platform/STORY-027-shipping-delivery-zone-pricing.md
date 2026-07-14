# STORY-027: Shipping & Delivery Zone Pricing

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer entering my delivery address at checkout, I want to see the correct delivery zone, delivery charge, and estimated delivery window for my address, so that I know exactly what I'll pay before I complete payment.

As a Home Cook ordering a large basket, I want to be told when I qualify for free shipping, so that I can decide whether to add more items to reach the threshold.

## Description
This story implements the **customer-facing/checkout-facing half** of delivery-zone pricing: resolving a customer's delivery address to a zone, computing the delivery charge for that zone using the zone's configured rate model, applying the platform-wide free-shipping threshold, and applying any active campaign rate override — then surfacing that charge inside the checkout Delivery step (STORY-025). `docs/blueprint.md` Section 7 originally flagged zone-wise delivery charges as a spec gap ("Gap: Zone-wise delivery charges") because the source spec only said shipping zones are "configurable" without a defined rate model. Section 10 records that this gap is now **confirmed**: zones are defined by city; each zone's rate model is flat, weight-based, or order-value-based (configured per zone); the free-shipping threshold is global (not per zone); and marketing campaigns can temporarily override a zone's rate.

At the time this story was written, `CLAUDE.md` and `docs/folder-structure.md` both reference a `.claude/skills/delivery-zone-pricing/SKILL.md` file as the source of the full confirmed model — **that file was not found in the repository at the time of writing this story.** The acceptance criteria below are derived directly from the confirmed summary in `docs/blueprint.md` Section 10. Before implementation begins, re-check for `.claude/skills/delivery-zone-pricing/SKILL.md` and reconcile against it if it has since been added; if it still doesn't exist, flag this to the team rather than inventing rate-model details not covered by Section 10.

This story owns zone **resolution and rate calculation for the storefront**. The admin CRUD for creating/editing zones, their rate tables, and campaign overrides is a separate module — **STORY-055 (Delivery Zone Management)** in the Admin/Enterprise epic — referenced here as the system of record this story reads from, not duplicated.

## Acceptance Criteria
- [ ] Given a delivery address with a city, the system resolves the matching delivery zone by city (per the confirmed model — zones are defined by city, not postcode/district/country) and returns "no zone configured" gracefully (with a clear customer-facing message and no charge silently defaulting to zero) if the city has no zone mapping.
- [ ] Each zone's delivery charge is computed using that zone's configured rate model: **flat rate** (fixed charge regardless of order), **weight-based** (charge derived from total cart weight against the zone's weight-rate table), or **order-value-based** (charge derived from cart subtotal against the zone's value-rate table) — the calculation logic supports all three models per zone, selecting whichever model that specific zone is configured with.
- [ ] A single, platform-wide free-shipping threshold (order subtotal) is evaluated after zone/rate resolution — if the cart subtotal meets or exceeds the threshold, delivery charge is reduced to zero regardless of which zone or rate model applies, and the checkout UI communicates "You qualify for free shipping" (or "Add [amount] more for free shipping" when below it).
- [ ] If an active marketing campaign defines a rate override for the resolved zone, the override is applied instead of the zone's standard rate for the duration of the campaign, and the override still respects (or explicitly is documented not to respect, if the campaign is configured to override the free-shipping threshold too) the global free-shipping rule — the precedence order (campaign override → free-shipping threshold → standard zone rate) is explicit and tested.
- [ ] The checkout Delivery step (STORY-025) displays: resolved zone name/label, delivery charge (or "Free"), and an estimated delivery window if configured for the zone, before the customer proceeds to payment.
- [ ] Delivery charge recalculates automatically if the customer changes their delivery address or cart contents while still in checkout, without requiring a full checkout restart.
- [ ] Distributor/wholesale customers see delivery pricing computed the same way as retail customers unless a zone or campaign explicitly defines a distributor-specific rate — this story does not invent a separate distributor shipping model beyond what the confirmed zone/rate structure supports.
- [ ] Zone, rate-table, free-shipping-threshold, and campaign-override data are all read from the admin-managed source of truth (STORY-055) — this story contains no hardcoded zone list, rate numbers, or threshold value in application code.
- [ ] If zone/rate configuration data is unavailable or malformed (e.g. STORY-055 admin data incomplete), checkout fails safe: the customer sees a clear "delivery pricing unavailable for this address, please contact support" state rather than an incorrect ₨0 or crashed checkout step.

## Tasks
- [ ] **Database:** Confirm/align with STORY-055's `DeliveryZone`, `DeliveryRate` (or equivalent), and `ShippingSettings` (global free-shipping threshold) models in `prisma/schema.prisma` — this story consumes these models read-only; if STORY-055 hasn't landed yet, coordinate the schema shape so both stories agree on one model rather than each defining its own.
- [ ] **API:** `POST /api/shipping/resolve` — accepts a delivery address (at minimum city) and cart summary (subtotal, total weight), returns the resolved zone, computed delivery charge, applied free-shipping/campaign-override status, and estimated delivery window.
- [ ] **Service/Backend:** `shipping.service.ts` implementing zone resolution by city, rate calculation for all three rate models (flat/weight/value-based), free-shipping-threshold evaluation, and campaign-override precedence logic, called by `checkout.service.ts` (STORY-025).
- [ ] **Service/Backend:** `shipping.repository.ts` (or reuse STORY-055's repository) — read-only access to zone/rate/threshold/campaign-override data for this story.
- [ ] **Service/Backend:** Precedence-resolution unit exposed as a pure, independently testable function (campaign override → free-shipping threshold → standard zone rate) given the risk of getting this order wrong.
- [ ] **Frontend:** Delivery Method/Zone step UI within checkout (STORY-025) rendering resolved zone, charge, free-shipping messaging, and estimated window.
- [ ] **Frontend:** Live recalculation of delivery charge when address or cart contents change mid-checkout (re-invokes `/api/shipping/resolve`).
- [ ] **Validation:** Zod schema for the shipping-resolve request/response shape (`src/validation/shipping.schema.ts`).
- [ ] **Testing:** Vitest unit tests for `shipping.service.ts` covering all three rate models, the free-shipping threshold boundary (exactly at, just below, just above), campaign-override precedence, and the "no zone configured" / "config unavailable" fail-safe paths.
- [ ] **Testing:** Playwright e2e test: enter an address in a known zone at checkout, confirm displayed delivery charge matches the expected rate-model calculation, then add items to cross the free-shipping threshold and confirm charge drops to zero.
- [ ] **Documentation:** Document the resolved rate-model precedence order and the city-to-zone resolution rule in `docs/architecture-decisions.md`, and note the missing `.claude/skills/delivery-zone-pricing/SKILL.md` file so it gets created/reconciled alongside STORY-055.

## Dependencies
- STORY-024 (Shopping Cart) — cart subtotal/weight feeds rate calculation.
- STORY-025 (Checkout) — this story's resolution logic is surfaced inside the checkout Delivery step.
- STORY-055 (Delivery Zone Management, Admin epic) — **related, not duplicated:** STORY-055 owns admin CRUD for zones, rate tables, free-shipping threshold, and campaign overrides; this story is the storefront-facing consumer of that data.
- STORY-009 (Product Catalogue Data Model) — product weight (if used for weight-based zones) must exist on the product schema.

## Out of Scope
- Admin CRUD for creating/editing delivery zones, rate tables, or campaign overrides (STORY-055).
- Real-world carrier integrations (courier booking, tracking numbers, label generation) — blueprint Section 10 lists "shipping/carrier integrations" as a separate unconfirmed open item; this story computes a customer-facing charge only, it does not book a physical shipment.
- International/export shipping pricing beyond the confirmed city-zone model, unless/until the export flow (Section 4 "Export") defines its own requirements.

## References
- `docs/blueprint.md` Section 7 ("⚠️ Gap: Zone-wise delivery charges" callout), Section 10 (confirmed delivery-zone rate structure)
- `.claude/skills/delivery-zone-pricing/SKILL.md` — referenced by `CLAUDE.md` and `docs/folder-structure.md` as the source of the full confirmed model; **not found in the repository as of this story's authoring — verify before implementation.**
- Related: STORY-055 (Delivery Zone Management, admin epic)
