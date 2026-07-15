# STORY-009: Product Catalogue Data Model — Design

**Date:** 2026-07-15
**Story:** `docs/stories/03-product-platform/STORY-009-product-catalogue-data-model.md`
**Status:** Approved, ready for implementation planning

## Purpose

Backend foundation for the entire Product Platform epic: Prisma schema, Repository
layer, Service layer, and Zod validation for the product catalogue and pricing
engine. No route handlers, admin UI, or storefront pages — those are STORY-010
through STORY-016 and STORY-040.

## Decisions Made This Session

These were the genuinely open questions in STORY-009's acceptance criteria
(everything else in this design follows directly from the AC as written):

| Decision | Choice | Why |
|---|---|---|
| Currency | Single currency (LKR) now, but every price row carries a `currency String @default("LKR")` column | Blueprint Section 10 explicitly leaves multi-currency scope unresolved. A forward-compatible column costs nothing now and avoids a schema migration touching every price table later if Export pricing needs USD. |
| Reward points | Simple `rewardPoints Int @default(0)` field on `Product` | STORY-030 (Rewards/Loyalty epic) isn't designed yet. A static per-product point value satisfies the AC literally without guessing at a rules engine shape that doesn't exist yet. |
| SEO fields | Inline columns on `Product`, `Category`, `Collection` (`metaTitle`, `metaDescription`, `canonicalUrl`, `ogImage`) | Four fields with no independent lifecycle don't justify a separate one-to-one table per entity. |
| Testing | Real local Postgres via `prisma db push`, not mocked Prisma Client | Local DB connectivity was just fixed and confirmed reliable (see `docs/architecture-decisions.md`). Real DB tests catch constraint/query bugs that mocks can't. |
| Money type | `Decimal @db.Decimal(10,2)` on every price field | Avoids floating-point rounding errors, standard for currency in Postgres/Prisma. |
| `resolvePrice()` architecture | Parallel fetch (`Promise.all`) of all five pricing tiers, priority resolved in application code, ties broken by most-recently-created row within a tier | AC explicitly names five separate tier models rather than one polymorphic table — kept that structure. Parallel fetch avoids five sequential round-trips. |

## Data Model

### Catalogue structure

- **`Category`** — self-relation (`parentId Category?`) for arbitrary-depth nesting; `slug` unique; `name`, `description`, `image`, `sortOrder`, `status`; inline SEO fields
- **`Collection`** — `slug` unique; `startDate`/`endDate` nullable for seasonal/limited-time; supports manual curation (explicit `Product` join) and rule-based grouping via a `rules Json?` field storing filter criteria (rule *evaluation* is out of scope — STORY-010's concern); inline SEO fields
- **`Brand`** — `slug` unique; `name`, `logo`, `description`
- **`Product`** — `sku` unique, `barcode` unique nullable, `slug` unique; `name`, `shortDescription`, `story` (long description); `brandId`; `status` enum (`Draft/Review/Published/Archived/Discontinued/OutOfSeason`); `productType` enum (`Standard/Bundle/GiftPack/Seasonal/LimitedEdition`); `publishedAt` nullable; `rewardPoints Int @default(0)`; inline SEO fields; many-to-many to `Category` and `Collection`

### Rich content

- **`ProductImage`** / **`ProductVideo`** — `productId`, `url`, `altText`, `isPrimary Boolean`, `mediaRole` enum (`Gallery/Lifestyle/Video`), `sortOrder`
- **`ProductNutrition`** — one-to-one with `Product`; `servingSize`, `calories`, `protein`, `fat`, `saturatedFat`, `carbohydrates`, `sugar`, `fibre`, `sodium` (all `Decimal`)
- **`ProductIngredient`** — ordered (`sortOrder`) list per product; `name`, `isAllergen Boolean`
- **`Allergen`** — standard taxonomy (`name`, `icon`); many-to-many to `Product`
- **`Certification`** — `name`, `certificateImage`/`documentUrl`; many-to-many to `Product`

### Bundles

- **`ProductBundle`** — one-to-one extension of a `Product` where `productType` is `Bundle`/`GiftPack`; `priceOverride Decimal? @db.Decimal(10,2)`
- **`BundleItem`** — `bundleId`, `componentProductId`, `quantity`

### Pricing engine

All money fields: `Decimal @db.Decimal(10,2)`. All price rows: `currency String @default("LKR")`.

- **`StandardPrice`** — one active row per product, the fallback tier
- **`SalePrice`** — `startDate`/`endDate`
- **`CampaignPrice`** — `campaignId String` (free-text identifier; no `Campaign` model yet — belongs to STORY-029/050); `startDate`/`endDate`
- **`CustomerGroupPrice`** — `customerGroup` enum (`Retail/Wholesale/Distributor/Export/PrivateLabel`)
- **`VolumeDiscountTier`** — `minQuantity Int`; either `discountPrice` or `discountPercent` (exactly one required — enforced by Zod, not a DB constraint)

### `resolvePrice(productId, { customerGroup, quantity, date })`

1. Fetch all five tiers for `productId` in parallel (`Promise.all`)
2. Filter each tier's rows to those currently active for the given `date` (and, for `VolumeDiscountTier`, `quantity >= minQuantity`)
3. Walk tiers in priority order, return the first match: **campaign → sale → customer-group → volume-discount → standard**
4. Within a tier, if multiple rows match, break ties by most-recently-created (`createdAt desc`)
5. Priority order and tie-break rule are documented as a comment block directly above the function

## Repository / Service / Validation Layers

- **`src/repositories/`** — `product.repository.ts`, `category.repository.ts`, `collection.repository.ts`, `brand.repository.ts`, `pricing.repository.ts`. Thin Prisma wrappers only: CRUD plus the specific lookups the AC names (`findBySlug`, `findBySku`, category tree fetch, price-tier queries). Prisma is only ever imported here for catalogue entities.
- **`src/services/`** — `product.service.ts`, `category.service.ts`, `collection.service.ts` wrap repositories with business rules (e.g. storefront callers only ever see `status: Published`); `pricing.service.ts` implements `resolvePrice()`.
- **`src/validation/`** — Zod schemas for `Product` create/update (with nested media/nutrition/ingredients/allergens/certifications), one schema per pricing tier, and a schema for `resolvePrice()`'s input params. Reused by STORY-040's admin UI later.

## Testing

- Vitest `globalSetup` runs `prisma db push --force-reset` once before the suite, against the local `prisma dev` server, so tests start from a known-empty schema.
- Repository tests: CRUD, plus uniqueness constraints (duplicate slug/SKU rejected at the DB level).
- `resolvePrice()` tests: one case per priority combination named in the AC — active campaign + active sale (campaign wins), wholesale customer with a qualifying volume discount (customer-group wins per the documented order), nothing matches (falls back to standard).
- Zod tests: invalid payloads rejected (missing SKU, negative price, `endDate` before `startDate`, volume tier missing both `discountPrice` and `discountPercent`).

## Seed Data

`prisma/seed.ts` — realistic Sri Lankan food catalogue: several standalone products (curry powder, roasted curry powder, chilli powder) each with full nutrition/ingredients/allergens; one `ProductBundle` (curry-powder gift set); one `GiftPack`; one `Seasonal` product (e.g. an Avurudu/New Year sweets pack). Across these: at least one `StandardPrice`, `SalePrice`, `CampaignPrice`, one `CustomerGroupPrice` per `CustomerGroup` value, and one `VolumeDiscountTier` — every pricing tier gets real coverage.

## Out of Scope (unchanged from story)

- Admin CRUD UI/API (STORY-040)
- Storefront browse/listing/detail pages (STORY-010, STORY-011)
- Warehouse/stock/batch/expiry inventory tracking
- Media Library upload/transcoding pipeline (STORY-041)
- Collection rule *evaluation* logic (stored in this story, evaluated in STORY-010)
- Campaign management (STORY-029/050) — `CampaignPrice.campaignId` is a free-text identifier only
