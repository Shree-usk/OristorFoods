---
name: delivery-zone-pricing
description: Build or modify zone-based delivery/shipping pricing — creating delivery zones, setting per-zone rates, and calculating shipping cost at checkout. Use for any shipping cost, delivery zone, or checkout shipping-calculation task.
---

# Delivery Zone Pricing

This module was flagged as underspecified in the source blueprint. The
business owner has since confirmed the open questions — decisions below.

## Confirmed decisions
- Zones are defined by **city** (not postcode ranges, districts, or
  countries).
- Rate model varies **per zone** — each zone independently chooses
  flat-rate, weight-based, or order-value-based pricing. Don't assume one
  rate model platform-wide; store the rate type on the zone's rate record.
- Free-shipping thresholds apply **globally** — one threshold for the
  whole platform, not configurable per zone.
- Marketing campaigns can **temporarily override** a zone's rate (e.g.
  seasonal free delivery to a city, or a discounted flat rate).

## 1. Database
- `DeliveryZone` model: name, list of covered cities, active status.
- `DeliveryRate` model: linked to a zone, rate type (flat/weight/
  value-based), rate value(s). No per-zone free-shipping field — that
  lives globally (see below).
- Global free-shipping threshold: a single setting (System Settings, not
  a per-zone model field) — order value above which shipping is free
  regardless of zone.
- `DeliveryRateOverride` (or similar): linked to a zone, effective
  date range, override rate/free-shipping flag, linked campaign. Keep
  this separate from `DeliveryRate` — overrides are temporary and
  time-bound, base rates are not.
- Keep zone definition and rate definition as separate models — a zone's
  cities rarely change, but its rates change often (seasonal campaigns).

## 2. Backend
- Shipping Service: given a destination city + cart (weight, value):
  1. Resolve the matching zone by city.
  2. Check for an active `DeliveryRateOverride` on that zone (campaign
     override wins if present and in date range).
  3. Otherwise apply the zone's base `DeliveryRate` per its rate type.
  4. Apply the global free-shipping threshold last — if cart value
     exceeds it, shipping is free regardless of zone/override.
- If no zone matches a city, define a fallback (e.g. "contact us for a
  shipping quote") rather than failing silently.

## 3. Admin Console
- New "Delivery Zones" section under System Settings → Shipping:
  - List/create/edit/delete zones, each a list of assigned cities
  - Set/edit the rate table per zone, choosing that zone's rate type
    independently of other zones
  - Activate/deactivate a zone (e.g. temporarily stop delivering to a city)
  - Create/schedule/end a rate override tied to a marketing campaign
    (start/end date, override rate or free-shipping flag, target zone)
- Global free-shipping threshold set once under System Settings →
  Shipping (not per zone).

## 4. Checkout
- Once the customer selects a delivery city, resolve and display the
  shipping cost (override-aware) before payment — never surprise the
  customer at the final step.
- Show estimated delivery time per zone if that data exists.

## 5. Tests
- Unit test zone resolution for edge cases (city matches no zone, city
  matches multiple zones — should never happen, but test for it).
- Unit test rate calculation for each rate type, per zone.
- Unit test override precedence (override active → override wins; override
  expired → falls back to base rate; cart above global threshold → free
  regardless of zone/override).
- E2E test: checkout with addresses in at least two different zones (one
  with an active campaign override) and confirm correct shipping costs.
