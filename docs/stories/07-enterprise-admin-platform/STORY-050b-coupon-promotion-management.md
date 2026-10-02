# STORY-050b: Coupon & Promotion Management UI

**Status:** Done. See `docs/architecture-decisions.md` 2026-10-02 entry
for the `createCoupon` input-extension decision, the restricted-coupon
list exclusion, and a real pre-existing `isUniqueCodeViolation` bug
found and fixed while testing this story.

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Marketing Manager, Super Administrator

## Context

The second of five sub-stories split out of STORY-050 (Marketing
Console) — confirmed with the user 2026-10-02, recorded in
`docs/blueprint.md` Section 9a: *"admin CRUD over the existing Coupon/
Promotion models (STORY-029), no admin UI exists yet."* STORY-050a
(Promotional Pop-up Manager) shipped first.

Unlike STORY-050a, this story has no capability gap to scope around —
`Coupon`/`Promotion` (STORY-029) and `discount.service.ts`'s
`couponToRule`/`promotionToRule` (read live at checkout) already
support every field this story's AC asks for. This story is purely the
missing admin surface over an already-complete, already-live model.

## Acceptance Criteria

- [x] Admin can create, edit, and deactivate coupons (percentage,
      fixed-amount, or free-shipping discount; usage limits; minimum
      order value; applicable products/categories; stacking)
- [x] Admin can create, edit, and deactivate promotions (the same
      discount/scope/stacking shape, auto-applied rather than
      code-redeemed, with a priority tie-break)
- [x] Changes take effect at checkout without a redeploy — already
      true today via `discount.service.ts`, confirmed (not assumed) by
      a real cart-level test applying an admin-created coupon
- [x] RBAC is enforced (`Marketing`: `View` for reads, `Edit` for all
      writes — no `Approve` tier, since a coupon/promotion has had no
      distinct "make it live" step beyond `isActive` + its date range
      since STORY-029)
- [x] Every coupon/promotion create/update is audit-logged
- [x] A STORY-048 customer-restricted coupon (issued from the
      Customers console) is excluded from this general console's list
      and detail view

## Tasks

- [x] **Database:** none — `Coupon`/`Promotion` and their
      `*ScopeProduct`/`*ScopeCategory` join tables already exist.
- [x] **Repository:** `coupon.repository.ts` — extended
      `CreateCouponInput` (additive/optional fields, defaulting to
      STORY-048's exact prior behavior when omitted) rather than a
      second creation function; added `listCouponsForAdmin`,
      `updateCoupon`, and the `Promotion` equivalents
      (`listPromotionsForAdmin`, `createPromotion`, `updatePromotion`,
      `findPromotionById`).
- [x] **API:** `/api/admin/marketing/coupons` (list/create), `/[id]`
      (detail/update); `/api/admin/marketing/promotions` (list/
      create), `/[id]` (detail/update) — following STORY-050a's exact
      route-handler shape.
- [x] **Service/Backend:** `coupon-admin.service.ts` — permission
      gating + audit logging for both models; a `CouponCodeTakenError`
      for a duplicate admin-entered code.
- [x] **Frontend:** `/admin/marketing/coupons` (Coupons / Promotions
      tabs, matching STORY-049's tabbed-console shape), each tab a
      list + a create/edit dialog; `coupon-scope-product-picker.tsx`
      (a new multi-select, reusing the admin products search endpoint
      STORY-040 already built); the scope-category field reuses the
      existing category checkbox-list pattern from
      `admin-product-form.tsx`.
- [x] **Validation:** `coupon-admin.schema.ts` — discount-type/scope
      conditional field requirements, `startDate < endDate`.
- [x] **Testing:** `tests/unit/coupon-admin-service.test.ts` (10
      tests — permission gating, CRUD + audit logging for both
      models, duplicate-code rejection, restricted-coupon exclusion,
      and a real admin-created product-scoped coupon proven live at
      checkout via `applyCouponToCart`); `tests/e2e/admin-coupons.spec.ts`
      (the same proof end-to-end through the real admin UI and the
      real storefront cart page). Full coupon/checkout/cart regression
      (83 tests) confirmed unaffected.
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry.

## Dependencies

- STORY-029 (Coupons & Promotions) — the models and
  `discount.service.ts` this story adds an admin surface over
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-040 (Admin Products Console) — the products search endpoint
  the scope-product picker reuses
- STORY-048 (Admin Customers Console) — `createCoupon`'s prior,
  narrower call site; the restricted-coupon exclusion this story adds

## Out of scope (left for later STORY-050 sub-stories)

- Tying a coupon to a popup, homepage section, or bulk send — STORY-050c
  (Seasonal campaign hub)
- A full experimentation/analytics layer beyond the existing
  `CouponRedemption` ledger

## References

- `docs/stories/07-enterprise-admin-platform/STORY-050-marketing-console.md`
  (the umbrella story)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
