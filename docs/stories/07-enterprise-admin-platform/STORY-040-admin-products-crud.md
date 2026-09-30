# STORY-040: Admin Products Module (CRUD)

**Status:** Core landed — full CRUD, duplicate, every field group editable,
list view with filters/search/pagination, and bulk status actions
(publish/archive/delete) are done (see the STORY-040 entry in
`docs/architecture-decisions.md`). CSV bulk import/export and the
bulk-edit modal (category reassignment, price adjustment) are explicitly
deferred to a fast follow-up — confirmed with the user before starting;
neither blocks any other story. Not marked Done until that follow-up
lands.
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
- [x] `/admin/products` list view: table with thumbnail, name, SKU, category, price, stock level, status, last updated; filters for status/category/stock level; search by name/SKU/barcode; pagination; multi-row select for bulk actions
- [x] Bulk actions: bulk publish/archive/delete on a selection. *Bulk edit (category reassignment, price adjustment by amount/percent) and bulk import/export (CSV) are deferred — see the Status note.*
- [x] Create/Edit product form covers every field defined in STORY-009: name, slug, SKU, barcode, story/description, category and collection assignment, brand, all 5 pricing tiers from STORY-009 (standard, sale, campaign, customer-group [covers wholesale/distributor/export/private-label], volume-discount), ingredients, nutrition facts, allergens, certifications, SEO fields (meta title/description/OG image/canonical), reward points, stock/availability. *Image/video fields are plain URL entry, not a Media Library picker (STORY-041 doesn't exist yet); no schema markup field existed to begin with; related products deferred (storefront already computes them algorithmically). See architecture-decisions.md.*
- [x] "Duplicate" action clones an existing product into a new Draft product, forcing the admin to set a new unique slug and SKU before it can be saved. *Never copies pricing — deliberate, see architecture-decisions.md.*
- [x] Product status workflow is Draft → Published → Archived, enforced at the Service layer. *The transition whitelist is wider than the literal AC wording (also allows Draft→Archived and Archived→Draft/Published) — see architecture-decisions.md. Storefront queries already only return `Published` products (STORY-010/011/012's own existing filtering) — no change needed there.*
- [ ] Deferred: Bulk import validates every row before committing any, with a downloadable per-row error report.
- [ ] Deferred: Bulk export CSV matching the import template.
- [x] Every create/edit/duplicate/delete/publish/archive action is gated by STORY-038 permission checks (module: Products) and written to the audit log. *Audit log itself was STORY-038's own build; STORY-057's audit-log viewing UI doesn't exist yet, same as STORY-038's own note.*
- [ ] Deferred: Media Library asset picker (STORY-041 doesn't exist yet) — plain URL inputs for now.

## Tasks
- [x] **Database:** `Product.createdById`/`updatedById` (nullable FK to `AdminUser`, `onDelete: SetNull`) added for audit traceability. *No `ProductPriceTier` model added — STORY-009's 5 existing pricing models already cover every tier the AC lists; see architecture-decisions.md.*
- [x] **API:** `/api/admin/products` (list/create), `/api/admin/products/[id]` (get/update/delete), `/api/admin/products/[id]/duplicate`, `/api/admin/products/[id]/status`, `/api/admin/products/bulk-status`, `/api/admin/products/bulk-delete`, `/api/admin/products/[id]/pricing/*` (standard/sale/campaign/customer-group/volume-discount), `/api/admin/products/reference-data` (categories/brands/collections/allergens/certifications for the form's pickers). *`bulk-import`/`bulk-export` deferred.*
- [x] **Service/Backend:** `product-admin.service.ts` (`createProduct`, `updateProduct`, `duplicateProduct`, `changeProductStatus`, `bulkChangeStatus`, `deleteProduct`, `bulkDelete`, plus one function per pricing tier) built on `product.repository.ts`/`pricing.repository.ts` (both extended, not rebuilt) from STORY-009.
- [x] **Frontend:** `src/app/(admin)/admin/products/page.tsx` (list — the story doc's own `(admin)/products/page.tsx` path was stale, matching prior stories' own stale-task-list pattern; the real prefix is `/admin/products` per STORY-038/039's established `(admin)/admin/...` routes), `.../products/[id]/page.tsx`, `.../products/new/page.tsx`; a tabbed `AdminProductForm` (General / Pricing / Nutrition & Ingredients / Media / SEO / Rewards & Stock); bulk action toolbar on the list. *CSV import modal deferred.*
- [x] **Validation:** `product-admin.schema.ts` — one shared schema per form section, composed into `productAdminSchema` for create/update; separate schemas for duplicate/status-change/bulk actions/each pricing tier (the latter reusing STORY-009's own `pricing.schema.ts` where its shape wasn't a `ZodIntersection`).
- [x] **Testing:** `tests/unit/product-admin-service.test.ts` (field-group persistence, duplicate behavior, conflict errors, transition whitelist, bulk partial-success, permission denial, pricing ledger/upsert behaviors); `tests/e2e/admin-products.spec.ts` (full lifecycle; Viewer-only permission denial). *Bulk import happy-path/mixed-row e2e deferred alongside the feature.*
- [x] **Documentation:** Full deviation writeup in `docs/architecture-decisions.md`. *CSV column template documentation deferred alongside the feature it describes.*

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-009 (Product Catalogue Data Model) — this module is the admin write path for the model that story defines for the storefront
- STORY-041 (Media Library) — all image/video fields use its asset picker

## References
- `docs/blueprint.md` Section 7 ("Products" console module bullet)
- `docs/blueprint.md` Section 5 (pricing engine models, product field list)
- `.claude/skills/admin-console-module/SKILL.md`
