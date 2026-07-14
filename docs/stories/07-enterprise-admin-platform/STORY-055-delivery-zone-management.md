# STORY-055: Delivery Zone Management

**Status:** Draft
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
- [ ] Admin can create, edit, and delete a `DeliveryZone`, each assigned a list of covered cities — not postcode ranges, districts, or countries, per the confirmed skill decision
- [ ] Each zone has its own `DeliveryRate` record with a rate type chosen independently per zone: Flat Rate, Weight-Based (rate per weight bracket), or Order-Value-Based (rate per value bracket); changing one zone's rate type has no effect on any other zone
- [ ] The zone list view shows each zone's city coverage, active rate type, and active/inactive status; saving a zone is blocked if it would assign a city to more than one currently-active zone (conflict validation)
- [ ] Admin can activate or deactivate a zone (e.g. temporarily stop delivering to a city) without deleting its configuration
- [ ] Admin can create a `DeliveryRateOverride` scoped to a zone and a date range, tied to a marketing campaign (STORY-050), specifying either an override rate or a free-shipping flag; overrides are stored separately from base rates and never modify the base `DeliveryRate` record
- [ ] A zone with an active override clearly shows "Override active until [date]" alongside its base rate in the admin UI, so precedence is visible at a glance
- [ ] No zone-level free-shipping threshold field exists anywhere in this module — the free-shipping threshold is a single global value owned by System Settings (STORY-054), and this module only links out to it
- [ ] Saving a zone configuration surfaces any city with no matching active zone (a coverage gap), so admins can see and fix gaps proactively rather than customers discovering them at checkout via the fallback "contact us for a shipping quote" behavior
- [ ] Every zone/rate/override create/edit/delete/activate/deactivate action is logged to the audit log (STORY-057)
- [ ] This module provides full CRUD, city-list bulk editing, and a complete audit trail — the same level of admin control as the Products (STORY-040) and Recipes (STORY-043) modules, not a lightweight settings form

## Tasks
- [ ] **Database:** `DeliveryZone` (id, name, cities as a string array or a normalized join table, active boolean), `DeliveryRate` (zoneId, rateType enum FLAT/WEIGHT/VALUE, rate value(s)/brackets), `DeliveryRateOverride` (zoneId, startDate, endDate, overrideRate or freeShipping flag, campaignId referencing STORY-050's `MarketingCampaign`) — matching the model split specified in `.claude/skills/delivery-zone-pricing/SKILL.md` Section 1 (zone definition and rate definition kept as separate models since rates change far more often than city coverage).
- [ ] **API:** `/api/admin/settings/shipping/zones` (CRUD), `/api/admin/settings/shipping/zones/[id]/rates`, `/api/admin/settings/shipping/zones/[id]/overrides`, `/api/admin/settings/shipping/zones/[id]/activate`, `/deactivate`.
- [ ] **Service/Backend:** `delivery-zone.service.ts` (zone CRUD, city-conflict validation across active zones), `delivery-rate.service.ts` (rate CRUD per rate type), `delivery-override.service.ts` (override CRUD, date-range validation) — these are the write-side services that back the resolution logic (`shipping.service.ts`) consumed at checkout per the skill's Section 2 precedence rules (override wins if active and in date range, else base rate, then global free-shipping threshold applied last).
- [ ] **Frontend:** `src/app/(admin)/settings/shipping/zones/page.tsx` (zone list with coverage-gap warnings) and `[id]/page.tsx` (zone detail: city multi-select, rate type selector with a type-specific bracket editor, an override scheduler tied to a campaign picker sourced from STORY-050).
- [ ] **Validation:** Zod schemas per rate type (flat: a single positive number; weight/value: ordered, non-overlapping brackets); a city-uniqueness-across-active-zones guard; an override date range that cannot start in the past on creation.
- [ ] **Testing:** Unit tests directly covering the skill's required test cases — zone resolution for a city matching no zone and for a city that would match multiple zones (should never happen, but must be tested); rate calculation for each of the three rate types; override precedence (active override wins, expired override falls back to base rate). E2e test: create two zones with different rate types plus one active campaign override, then verify checkout (STORY-027) computes the correct cost for each.
- [ ] **Documentation:** Cross-reference `.claude/skills/delivery-zone-pricing/SKILL.md` as the source of truth for the data model and precedence rules — this story's docs should point at the skill file rather than re-describing the rules in a second place that can drift out of sync.

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
