# STORY-071: Customer Group & Pricing Context

**Status:** Draft
**Epic:** 06 — Customer Platform
**Priority:** Medium
**Persona(s):** Distributor, Executive (admin), Home Cook (as the default Retail case)

## User Story
As a Distributor (or Wholesale/Export/Private-Label buyer), I want my account's commercial relationship with Oristor reflected automatically wherever I shop, so that I see the pricing tier I'm actually entitled to instead of always seeing Retail pricing.

As an Administrator, I want a customer's group stored on their account, so that assigning it once (today via a minimal admin path; later via STORY-048's full console) correctly drives pricing everywhere without per-page configuration.

## Description
The pricing engine's `CustomerGroupPrice` tier (one of five pricing models — standard, sale, campaign, customer-group, volume-discount — built in STORY-009) has always worked correctly *if* the right `CustomerGroup` value is passed to `resolvePrice()`. It never has been: every call site across the storefront hardcodes `customerGroup: "Retail"` because `User` has no `customerGroup` field. This was flagged as a known limitation as early as STORY-024 (Shopping Cart) and re-confirmed as still outstanding after STORY-033/034/038 all shipped without addressing it (see `docs/architecture-decisions.md`'s STORY-024 entry and the 2026-09-30 deferred-items review).

This story closes that specific gap: add the field, wire the existing hardcoded call sites to read it from the authenticated customer, and test that a non-Retail customer actually receives non-Retail pricing end-to-end. It explicitly does **not** build a new pricing engine, per-customer negotiated pricing, or a group-management UI — `CustomerGroupPrice` and its five-value `CustomerGroup` enum already exist and are reused as-is.

## Acceptance Criteria
- [ ] `User` has a `customerGroup CustomerGroup @default(Retail)` field, reusing the existing `CustomerGroup` enum (`Retail`/`Wholesale`/`Distributor`/`Export`/`PrivateLabel`) already defined for `CustomerGroupPrice` — no new enum.
- [ ] Every call site currently hardcoding `customerGroup: "Retail"` resolves it from the authenticated customer's actual `customerGroup` instead, where a customer is known:
  `cart.service.ts` (4 call sites), `customer-order-history.service.ts` (1), `product.service.ts` (4, one of which already accepts an optional `customerGroup` param that nothing currently populates), `wishlist.service.ts` (1).
- [ ] A guest / unauthenticated session continues to resolve as `Retail` (there's no customer record to read a group from) — this is not a regression, just the existing default made explicit.
- [ ] At least one minimal way for an admin to set a customer's group exists (a script, or a small authenticated endpoint gated the same way STORY-038's permission system gates other admin actions) — full group-assignment UI is explicitly out of scope (see below).
- [ ] New test coverage: a seeded non-Retail customer resolves a different price than Retail for a product that has a `CustomerGroupPrice` row for that group, across each of the four wired call sites (not just a unit test on `resolvePrice()` in isolation, which already passes today).
- [ ] Existing cart/wishlist/product/search pricing tests continue to pass unmodified for the Retail/guest path.

## Tasks
- [ ] **Database:** add `User.customerGroup CustomerGroup @default(Retail)` (reuses the existing enum — no migration risk to `CustomerGroupPrice` itself).
- [ ] **Service/Backend:** update the 10 hardcoded call sites listed above to read `customerGroup` from the resolved session/customer where available, falling back to `Retail` for guests. Minimal admin path to set the field (script or single endpoint) — see Out of Scope.
- [ ] **API:** if a minimal admin endpoint is added rather than a script, follow STORY-038's `requirePermission` pattern; expose the field on whatever customer-profile read the storefront/account area already uses so a signed-in customer can at least see their own group.
- [ ] **Testing:** integration tests per call site (cart line pricing, order-history repricing, product/PDP pricing, wishlist pricing) proving a non-Retail group actually changes the resolved price; guest-path regression coverage.
- [ ] **Documentation:** update `docs/architecture-decisions.md`'s STORY-024 entry (which documents the hardcoded-Retail limitation this story resolves) with a forward reference once shipped; add this story's own dated entry.

## Dependencies
- STORY-009 (Product Catalogue Data Model) — `CustomerGroup` enum and `CustomerGroupPrice` model already exist; this story only wires them up. Done.
- STORY-033 (Customer Dashboard) — establishes the authenticated customer session this story reads from. Done.

## Out of Scope
- A full customer-specific/negotiated pricing engine beyond the five existing group tiers.
- The admin UI for assigning/changing a customer's group — that's STORY-048 (Admin Customers Console). This story ships only the data field and a minimal (script or single-endpoint) way to set it in the meantime, so STORY-048 has a real field to build its UI on top of when it's reached in build order.
- Multi-group / per-product-category group overrides — one group per customer, matching the existing enum's shape.

## References
- `docs/blueprint.md` Section 5 ("Pricing engine: standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, and volume-discount pricing models")
- `docs/architecture-decisions.md` — STORY-024 Shopping Cart entry (documents the current hardcoded-`"Retail"` limitation) and the 2026-09-30 deferred-items review (re-confirms it's still outstanding)
- `prisma/schema.prisma` — `CustomerGroup` enum, `CustomerGroupPrice` model
