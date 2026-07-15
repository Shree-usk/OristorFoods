# STORY-009: Product Catalogue Data Model

**Status:** Done — implemented per `docs/superpowers/plans/2026-07-15-product-catalogue-data-model.md`
**Epic:** 03 — Product Platform
**Priority:** High
**Persona(s):** Development Team / Platform (foundational data-model story), Distributor, Gourmet Food Enthusiast

## User Story
As a developer on the Oristor platform team, I want a complete Prisma schema and Service/Repository layer for the product catalogue, so that every other Product Platform story (listing, PDP, search, wishlist, compare, reviews, Q&A) has a consistent, validated data source to build on.

As a Distributor, I want the catalogue to model wholesale, distributor, export, and private-label pricing tiers alongside standard/sale pricing, so that once storefront pricing display is wired up I see pricing appropriate to my account type.

As a Gourmet Food Enthusiast, I want each product to carry rich content (story, ingredients, nutrition, allergens, certifications) directly in the data model, so that later Product Detail Page work can surface trustworthy, detailed product information without ad-hoc schema patches.

## Description
This story is the backend foundation for the entire Product Platform epic (`docs/blueprint.md` Section 9 item 3). It implements the catalogue and pricing-engine data model described in Section 5 ("Commerce" and "Pricing engine" paragraphs) — products, categories, collections, brands, bundles, gift packs, and seasonal/limited-edition items, each carrying SKU, barcode, slug, images/videos, nutrition, ingredients, allergens, certifications, SEO fields, and reward points — plus the nine pricing models (standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, volume-discount). It also delivers the Repository + Service layer per the architecture principle in Section 3 ("route handlers and components never call Prisma directly"). No route handlers, admin UI, or storefront pages are built here — this story only produces the schema, migrations, seed data, repository/service functions, and their Zod validation contracts that STORY-010 through STORY-016 will consume.

## Acceptance Criteria
- [x] `Category` model exists (id, name, slug, description, self-relation `parentId` for nested categories, image, SEO fields, `sortOrder`, status) and supports arbitrary-depth nesting
- [x] `Collection` model exists supporting curated/manual and rule-based groupings, slug, SEO fields, and optional `startDate`/`endDate` for seasonal or limited-time collections
- [x] `Brand` model exists (Oristor plus any sub-brand/private-label brands) with logo, description, slug
- [x] `Product` model exists with unique `sku`, unique nullable `barcode`, unique `slug`, name, short description, long description/story, `brandId`, `status` enum (`Draft`/`Review`/`Published`/`Archived`/`Discontinued`/`OutOfSeason`), `productType` enum (`Standard`/`Bundle`/`GiftPack`/`Seasonal`/`LimitedEdition`), and `publishedAt`
- [x] `Product` has many-to-many relations to `Category` and `Collection`
- [x] `ProductImage` and `ProductVideo` models support an ordered gallery with `altText`, `isPrimary`, and a `mediaRole` (gallery/lifestyle/video) field
- [x] `ProductNutrition` model captures serving size and per-serving nutrient values (calories, protein, fat, saturated fat, carbohydrates, sugar, fibre, sodium) linked one-to-one with `Product`
- [x] `ProductIngredient` model stores an ordered ingredient list per product with an `isAllergen` flag; `Allergen` model provides a standard allergen taxonomy (nuts, gluten, dairy, soy, etc.) joined many-to-many to `Product`
- [x] `Certification` model (ISO, HACCP, Organic, Halal, etc.) is joined many-to-many to `Product` and stores a certificate image/document reference
- [x] `Product` carries SEO fields (`metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`) either inline or via a dedicated `ProductSeo` model
- [x] `Product` carries a `rewardPoints` field (or `RewardPointRule` relation) capturing points earned per purchase, structured to align with the future Rewards/Loyalty epic's point model
- [x] `ProductBundle`/`BundleItem` models represent multi-product bundles and gift packs, each with component products, per-component quantity, and an optional bundle-level price override
- [x] Pricing engine models exist for all nine tiers named in the blueprint: `StandardPrice`, `SalePrice` (with `startDate`/`endDate`), `CampaignPrice` (linked to a campaign identifier), `CustomerGroupPrice` (keyed by a `CustomerGroup` enum: `Retail`/`Wholesale`/`Distributor`/`Export`/`PrivateLabel`), and `VolumeDiscountTier` (minimum quantity → discounted price or percentage)
- [x] `pricing.service.ts` exposes `resolvePrice(productId, { customerGroup, quantity, date })`, implementing and documenting a fixed priority order (campaign > sale > customer-group/wholesale/distributor/export > volume discount > standard) with deterministic tie-breaking
- [x] Repository layer (`src/repositories/product.repository.ts`, `category.repository.ts`, `collection.repository.ts`, `brand.repository.ts`, `pricing.repository.ts`) is the only code importing the Prisma client for catalogue entities
- [x] Service layer (`src/services/product.service.ts`, `category.service.ts`, `collection.service.ts`, `pricing.service.ts`) exposes typed functions consumed by later stories (e.g. `getProductBySlug`, `listProductsByCategory`, `resolvePrice`) — no route handlers are added in this story
- [x] Zod schemas exist under `src/validation/` for creating/updating a `Product` and its nested pricing, media, nutrition, ingredient, and certification data, ready for reuse by the future Admin Products module (STORY-040)
- [x] `npx prisma migrate dev` runs cleanly against the full schema and a seed script inserts a realistic sample catalogue (curry powders, spice blends, a bundle, a gift pack, a seasonal item) covering every pricing tier

## Tasks

- [x] **Database:**
  - [x] Add `Category`, `Collection`, `Brand`, `Product`, `ProductImage`, `ProductVideo`, `ProductNutrition`, `ProductIngredient`, `Allergen`, `Certification`, `ProductBundle`, `BundleItem` models and all enums (`ProductStatus`, `ProductType`, `CustomerGroup`) to `prisma/schema.prisma`
  - [x] Add `StandardPrice`, `SalePrice`, `CampaignPrice`, `CustomerGroupPrice`, `VolumeDiscountTier` pricing models with correct foreign keys and date-range fields
  - [x] Add unique indexes on `sku`, `barcode`, `slug`; add supporting indexes for category/collection lookups and price-resolution queries
  - [x] Run `npx prisma migrate dev --name product-catalogue` and confirm a clean migration
  - [x] Write `prisma/seed.ts` (or extend the existing seed script) with sample products covering every pricing tier and product type

- [x] **Service/Backend:**
  - [x] Implement repository functions (CRUD + lookup-by-slug/sku, category tree traversal, collection membership, price-tier queries) — Prisma is only ever called here
  - [x] Implement `product.service.ts`, `category.service.ts`, `collection.service.ts` wrapping repositories with business rules (e.g. only `Published` products returned to storefront callers)
  - [x] Implement `pricing.service.ts` with `resolvePrice()` and document the priority-order algorithm inline
  - [x] Implement seed data generation covering bundles, gift packs, and seasonal/limited-edition items

- [x] **Validation:**
  - [x] Add Zod schemas under `src/validation/` for `Product` create/update (including nested media, nutrition, ingredients, allergens, certifications, SEO fields)
  - [x] Add Zod schemas for each pricing tier's create/update payload
  - [x] Add Zod schema for `resolvePrice()` input parameters

- [x] **Testing:**
  - [x] Unit test repository functions against a test database or Prisma mock
  - [x] Unit test `resolvePrice()` against every priority-order combination (e.g. active campaign + active sale, wholesale customer with a volume discount, no applicable tier falling back to standard)
  - [x] Unit test Zod schemas reject invalid payloads (missing SKU, duplicate slug, negative price, invalid date range)

- [x] **Documentation:**
  - [x] Document the pricing priority order and a schema summary/ERD in `docs/architecture-decisions.md`
  - [x] Map each schema field back to the blueprint Section 5 field list so reviewers can trace coverage

## Dependencies
- STORY-001 (Project Foundation Setup) — Prisma/PostgreSQL scaffolding, folder structure
- STORY-002 (Design System & Theming) — none functionally, but listed per epic sequencing
- STORY-003 (Global Layout & Responsive Framework) — none functionally, but listed per epic sequencing

## Out of Scope
- Admin CRUD UI/API for managing products (belongs to STORY-040, Epic 07)
- Storefront browse/listing/detail pages that consume this data (STORY-010, STORY-011)
- Warehouse/stock/batch/expiry inventory tracking (a separate inventory concern referenced in blueprint Section 5, not part of this catalogue schema)
- Media Library upload/transcoding pipeline (belongs to STORY-041, Epic 07) — this story only models the `ProductImage`/`ProductVideo` references

## References
- `docs/blueprint.md` Section 4 (Site Structure — Products, Product Detail Page requirements list)
- `docs/blueprint.md` Section 5 (Core Feature Set — Commerce/Catalogue/Pricing engine paragraphs)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
- `docs/folder-structure.md` (`services/`, `repositories/`, `prisma/schema.prisma`)
- `.claude/skills/add-product-page/SKILL.md`
