# STORY-040: Admin Products Module (CRUD)

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Content Editor, Administrator, Super Administrator, Marketing Manager, Sales Manager, Warehouse Manager

## User Story
As a Content Editor, I want to create, edit, duplicate, and archive products with every field editable in one form, so that the catalogue can be maintained without a developer touching code.
As an Administrator, I want to bulk import, export, publish, and archive products, so that I can manage a large catalogue efficiently.
As a Sales Manager, I want to configure every pricing tier (standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, volume-discount) on a product, so that different customer segments see the correct price.

## Description
This story is the admin authoring counterpart to the customer-facing product catalogue defined in STORY-009 (Product Catalogue Data Model). It delivers full CRUD, duplication, and bulk operations over every product field called out in `docs/blueprint.md` Section 7 ("Products — full CRUD, duplicate, bulk edit/import/export/publish/archive; every field (pricing tiers, ingredients, nutrition, images, SEO, reward points) editable") and Section 5's pricing engine. This module is the sole write path for the `Product` model that STORY-010/STORY-011/STORY-012 read from on the storefront.

## Acceptance Criteria
- [ ] `/admin/products` list view: table with thumbnail, name, SKU, category, price, stock level, status, last updated; filters for status/category/stock level; search by name/SKU/barcode; pagination; multi-row select for bulk actions
- [ ] Bulk actions available on a filtered/selected set: bulk edit (category reassignment, price adjustment by amount/percent, status change), bulk import (CSV/Excel upload), bulk export (CSV), bulk publish, bulk archive
- [ ] Create/Edit product form covers every field defined in STORY-009: name, slug, SKU, barcode, product story/description, category and collection assignment, brand, image/video gallery (via Media Library, STORY-041), all pricing tiers from blueprint Section 5 (standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, volume-discount), ingredients, nutrition facts, allergens, certifications, SEO fields (meta title/description/OG image/canonical/schema), reward points earned, stock/availability, related products
- [ ] "Duplicate" action clones an existing product into a new Draft product, forcing the admin to set a new unique slug and SKU before it can be saved
- [ ] Product status workflow is Draft → Published → Archived; only `PUBLISHED` products are ever returned by storefront queries (STORY-010/011/012), enforced at the Service/Repository level
- [ ] Bulk import validates every row against the product schema before committing any row, and produces a downloadable per-row error report for rows that fail validation (no partial/silent failures)
- [ ] Bulk export produces a CSV matching the exact column template used for bulk import, so export → edit → re-import is a supported round trip
- [ ] Every create/edit/duplicate/delete/publish/archive action is gated by STORY-038 permission checks (module: Products) and written to the audit log (STORY-057)
- [ ] All image/video fields on the product form open the shared Media Library asset picker (STORY-041) rather than a raw file input

## Tasks
- [ ] **Database:** Confirm/extend the `Product` model from STORY-009 with the full field set above; add `ProductPriceTier` (productId, tierType enum, price, minQty for volume discounts, customerGroupId/currency where relevant); add `createdById`/`updatedById` for audit traceability.
- [ ] **API:** `/api/admin/products` (list/create), `/api/admin/products/[id]` (get/update/delete), `/api/admin/products/[id]/duplicate`, `/api/admin/products/bulk-import`, `/api/admin/products/bulk-export`, `/api/admin/products/bulk-action`.
- [ ] **Service/Backend:** `product-admin.service.ts` (`createProduct`, `updateProduct`, `duplicateProduct`, `bulkImport`, `bulkExport`, `bulkStatusChange`) built on top of `product.repository.ts` from STORY-009; import pipeline validates the full batch before any write (transactional).
- [ ] **Frontend:** `src/app/(admin)/products/page.tsx` (list), `src/app/(admin)/products/[id]/page.tsx` (edit), `src/app/(admin)/products/new/page.tsx`; a tabbed `ProductForm` (General / Pricing / Ingredients & Nutrition / Media / SEO / Rewards); bulk action toolbar; CSV import modal with per-row error display.
- [ ] **Validation:** Zod schemas per form section (General/Pricing/Nutrition/SEO); a separate per-row import schema that collects (not throws on first) validation errors across a batch.
- [ ] **Testing:** Unit tests for duplicate-with-forced-new-slug/SKU behavior and bulk-import row validation/error reporting; e2e test create → edit every field group → publish → archive; e2e test bulk import happy path and a mixed valid/invalid-row path.
- [ ] **Documentation:** Document the CSV import/export column template and the pricing-tier field contract shared with the checkout/pricing engine.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-009 (Product Catalogue Data Model) — this module is the admin write path for the model that story defines for the storefront
- STORY-041 (Media Library) — all image/video fields use its asset picker

## References
- `docs/blueprint.md` Section 7 ("Products" console module bullet)
- `docs/blueprint.md` Section 5 (pricing engine models, product field list)
- `.claude/skills/admin-console-module/SKILL.md`
