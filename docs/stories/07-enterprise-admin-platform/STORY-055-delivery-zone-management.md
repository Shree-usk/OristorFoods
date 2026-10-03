# STORY-055: Delivery Zone Management

**Status:** Done (admin write-side only — see Scope Decision)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Super Administrator, Administrator, Warehouse Manager, Finance Manager

## User Story
As an Administrator, I want to create, edit, and delete delivery zones with their own independent rate tables, so that shipping costs are accurate per destination without hardcoding logic in the checkout flow.
As a Marketing Manager, I want to schedule a temporary rate override on a specific zone tied to a campaign, so that I can run promotions like free delivery to a city for a limited time.
As a Warehouse Manager, I want to see which cities currently have no assigned delivery zone, so that fulfillment gaps are caught before a customer hits an error at checkout.

## Description
`docs/blueprint.md` Section 7 explicitly flags zone-wise delivery charges as underspecified in the source PRD ("the source spec only says shipping zones are 'configurable'... it does **not** spec a dedicated CRUD workflow the way it does for products, recipes, or reviews") and calls for Delivery Zone Management to be treated as its own module under System Settings / Shipping with the same level of admin control as Products or Recipes. The open questions have since been confirmed and are documented in `.claude/skills/delivery-zone-pricing/SKILL.md`: zones are defined by **city** (not postcode, district, or country), each zone independently chooses a flat/weight/value-based rate model, the free-shipping threshold is global (owned by STORY-054, not per zone), and marketing campaigns can temporarily override a zone's rate. This story is the admin authoring module for that confirmed model; STORY-027 is the related storefront-facing half that displays the resolved shipping cost at checkout.

## Acceptance Criteria
- [x] Admin can create, edit, and delete a `DeliveryZone`, each assigned a list of covered cities — not postcode ranges, districts, or countries, per the confirmed skill decision
- [x] Each zone has its own `DeliveryRate` record with a rate type chosen independently per zone: Flat Rate, Weight-Based (rate per weight bracket), or Order-Value-Based (rate per value bracket); changing one zone's rate type has no effect on any other zone
- [x] The zone list view shows each zone's city coverage, active rate type, and active/inactive status; saving a zone (or activating it) is blocked if it would assign a city to more than one currently-active zone (conflict validation)
- [x] Admin can activate or deactivate a zone (e.g. temporarily stop delivering to a city) without deleting its configuration
- [x] Admin can create a `DeliveryRateOverride` scoped to a zone and a date range, tied to a marketing campaign — see Scope Decision for how "tied to" is satisfied without a new FK — specifying either an override rate or a free-shipping flag; overrides are stored separately from base rates and never modify the base `DeliveryRate` record
- [x] A zone with an active override clearly shows "Override active until [date]" alongside its base rate in the admin UI
- [x] No zone-level free-shipping threshold field exists anywhere in this module — the free-shipping threshold is the single global value owned by System Settings (STORY-054); the Shipping & Inventory settings panel already links out to this module
- [x] Saving a zone configuration surfaces any city with no matching active zone — see Scope Decision for the "real observed data" source used instead of a speculative master city list
- [x] Every zone/rate/override create/edit/delete/activate/deactivate action is logged to the audit log via `writeAuditLog`
- [x] This module is its own top-level admin section (`/admin/delivery-zones`, gated on `AdminModule.DeliveryZones`) with full CRUD and an audit trail — the same level of admin control as Products/Recipes, not a System Settings tab

## Scope Decision

Research before implementation found the underlying data model
(`DeliveryZone`/`DeliveryRate`/`DeliveryRateOverride`) and the entire
checkout-side resolution logic (`shipping.service.ts::resolveDelivery`/
`calculateDeliveryCharge`) **already built by STORY-027**, with
`shipping.repository.ts`'s own header comment explicitly deferring the
admin CRUD to this story. So STORY-055's real scope was the admin
write-side only — no schema change to the resolution model, no change
to checkout logic, no new/duplicate tests for resolution (already
covered by `tests/unit/shipping-calc.test.ts`/`shipping-resolve.test.ts`).

Two decisions, both additive/zero-risk to the existing checkout code:
- **Campaign linkage** — `DeliveryRateOverride.campaignName` is a plain
  string column (STORY-027). Rather than add a new FK for the AC's
  loose "tied to a marketing campaign" wording, the override form's
  Campaign field is a picker over live `SeasonalCampaign` rows (a
  direct repository call, bypassing `Marketing:View`) plus a free-text
  fallback, writing the chosen name into the existing column.
- **Coverage-gap detection** — there is no master Sri-Lanka-city list
  anywhere in this codebase (city is free text throughout). Coverage
  gaps are computed from real observed data instead: distinct
  `Address.city` + `Order.shipCity` values with no matching active
  zone, normalized via `shipping.service.ts`'s existing exported
  `normalizeCity()`.

## Tasks
- [x] **Database:** no schema change — `DeliveryZone`/`DeliveryRate`/`DeliveryRateOverride` already existed (STORY-027).
- [x] **API:** `/api/admin/delivery-zones` (CRUD), `/[id]/activate`, `/[id]/deactivate`, `/[id]/rate`, `/[id]/overrides` (+ `/[overrideId]`), `/coverage-gaps`, `/campaigns` — a top-level module, not nested under `/api/admin/settings/shipping`, matching the dedicated `AdminModule.DeliveryZones` gate.
- [x] **Service/Backend:** `delivery-zone.service.ts` (zone CRUD, city-conflict validation re-checked on activate), `delivery-rate.service.ts` (rate upsert per type), `delivery-override.service.ts` (override CRUD, date-range validation) — all read/write through the admin side only; `shipping.service.ts`'s resolution logic and its precedence rules (override → base rate → global threshold, applied last) are untouched.
- [x] **Frontend:** `src/app/(admin)/admin/delivery-zones/page.tsx` (list, with a coverage-gap panel) + `new/page.tsx`/`[id]/page.tsx` (one form: zone fields, a rate-type-specific editor, and — existing zones only — an overrides panel).
- [x] **Validation:** `src/validation/delivery-zone.schema.ts` — rate-type-specific requirements, an exactly-one-of XOR on `freeShipping`/`overrideAmount` (reusing the exact idiom from `product-admin.schema.ts`'s volume-discount-tier schema), `endsAt > startsAt`; "not in the past on creation" enforced in the service, not the schema (comparing against the request's own `Date.now()`, not a frozen schema-time value).
- [x] **Testing:** `tests/unit/delivery-zone-service.test.ts` (CRUD, city-conflict on create/activate, deactivate always allowed, coverage-gap detection against real `Address` fixtures, permission denial), `tests/unit/delivery-rate-service.test.ts` (per-rate-type upsert + Zod-layer rejections), `tests/unit/delivery-override-service.test.ts` (CRUD, past-date rejection, Zod-layer XOR rejections), `tests/e2e/admin-delivery-zones.spec.ts` (create two zones through the real UI with different rate types, add an override, confirm the activation conflict guard via a real 409).
- [x] **Documentation:** this doc, `docs/architecture-decisions.md`, `docs/blueprint.md` Section 9a.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-054 (System Settings) — this module lives under System Settings → Shipping and links to the global free-shipping threshold owned there
- STORY-050 (Marketing Console) — rate overrides tie to a marketing campaign defined there

**Related (not blocking):** STORY-027 (Shipping & Delivery Zone Pricing) is the storefront-facing half — it resolves and displays shipping cost at checkout by reading the `DeliveryZone`/`DeliveryRate`/`DeliveryRateOverride` models this admin module manages. The two stories share the same underlying schema; coordinate so it is defined once, not twice.

## Out of Scope
- Carrier-specific label generation and shipment tracking integration (shipping carrier integrations are an unconfirmed open item per blueprint Section 10)
- Postcode-, district-, or country-based zoning — explicitly ruled out; zones are city-based only, per the confirmed decision in `.claude/skills/delivery-zone-pricing/SKILL.md`
- Per-zone free-shipping thresholds — the threshold is global only (STORY-054)

## References
- `docs/blueprint.md` Section 7 ("⚠️ Gap: Zone-wise delivery charges" callout, in full)
- `docs/blueprint.md` Section 10 (confirmed decision note pointing to the skill file)
- `.claude/skills/delivery-zone-pricing/SKILL.md` (full data model, precedence rules, and required test cases)
