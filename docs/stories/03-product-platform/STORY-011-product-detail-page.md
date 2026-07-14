# STORY-011: Product Detail Page

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** High
**Persona(s):** Home Cook, Gourmet Food Enthusiast, Sri Lankan Expat

## User Story
As a Home Cook, I want a product page with clear ingredients, nutrition, and serving suggestions, so that I can decide whether a product fits my meal plan before buying.

As a Gourmet Food Enthusiast, I want to see the product's story, certifications, and related recipes, so that I understand the provenance and quality behind what I'm buying.

As a Sri Lankan Expat, I want to see availability and delivery information up front on the product page, so that I know whether the product can reach me before I add it to cart.

## Description
This story builds the Product Detail Page (PDP), the single most detail-dense page in the storefront. `docs/blueprint.md` Section 4 explicitly lists everything the PDP "must include": gallery + zoom, product story, ingredients, nutrition, benefits, serving suggestions, recipes using the product, customer reviews, Q&A, related/recently viewed products, share buttons, availability, delivery info, and reward points earned. This story implements the page shell and every section that reads from STORY-009's catalogue data; it also defines the integration points for STORY-013 (wishlist toggle), STORY-015 (reviews), and STORY-016 (Q&A), which ship their own submission UI separately.

## Acceptance Criteria
- [ ] `/products/[slug]` renders using data from a single aggregated product-detail service call (not multiple client-side waterfalled requests)
- [ ] Image/video gallery with zoom-on-hover or lightbox zoom, using `ProductImage`/`ProductVideo` data from STORY-009, correct `altText`, and the primary image first
- [ ] Product story section renders the long description/story field
- [ ] Ingredients section lists `ProductIngredient` data in order, visually flagging allergen ingredients
- [ ] Nutrition section renders `ProductNutrition` as a structured nutrition-facts table (serving size + all captured nutrients)
- [ ] Benefits and serving-suggestions sections render their respective content fields
- [ ] "Recipes using this product" section queries related recipes by product reference; if no Recipe module exists yet (Epic 04 not yet built), the section renders an empty/"coming soon" state rather than erroring
- [ ] Customer reviews section shows the aggregate rating and a preview list of `Published` reviews, sourced via the integration point STORY-015 defines; if no reviews module is present yet, the section renders a "no reviews yet" state
- [ ] Q&A section shows a preview list of `Published` questions/answers via the integration point STORY-016 defines, with a graceful empty state if not yet present
- [ ] "Related products" and "Recently viewed products" sections render using the shared `ProductCard` component from STORY-010; recently viewed is tracked client-side (e.g. via `localStorage`/Zustand) and does not require login
- [ ] Share buttons (at minimum: copy link, WhatsApp, Facebook, X/Twitter, email) are present and functional
- [ ] Availability state (in stock / low stock / out of stock) and delivery information (e.g. estimated delivery, applicable delivery zones) are displayed
- [ ] Reward points earned for purchasing the product are displayed, sourced from STORY-009's `rewardPoints` field
- [ ] Price is displayed via `pricing.service.ts` `resolvePrice()` (STORY-009), reflecting sale/campaign pricing when active, with a struck-through standard price when a discount applies
- [ ] Add-to-cart and add-to-wishlist controls are present; wishlist toggle calls into the STORY-013 integration point (heart icon reflects current wishlist state if STORY-013 is available, otherwise degrades to a disabled/placeholder state)
- [ ] Out-of-stock products disable add-to-cart and show a clear "out of stock" indicator instead
- [ ] Breadcrumb navigation reflects the product's category path
- [ ] Page emits `Product` JSON-LD structured data (price, availability, rating, SKU) and sets `metaTitle`/`metaDescription`/canonical URL from STORY-009's SEO fields
- [ ] Bundle and gift-pack product types render their component items distinctly (e.g. "This bundle includes...")

## Tasks

- [ ] **API:**
  - [ ] `GET /api/products/[slug]` route handler returning the full aggregated product-detail payload (product, media, nutrition, ingredients, allergens, certifications, resolved price, reward points, related product IDs)

- [ ] **Service/Backend:**
  - [ ] Add `getProductDetail(slug, { customerGroup })` to `product.service.ts`, composing catalogue data, resolved pricing, and related-product lookups in one call
  - [ ] Define typed extension points (interfaces) for review-summary and Q&A-summary data so STORY-015/STORY-016 can plug in without reshaping this service

- [ ] **Frontend:**
  - [ ] Build the PDP route (`src/app/(storefront)/products/[slug]/page.tsx`) as a Server Component fetching via the aggregated service
  - [ ] Build `ProductGallery` (zoom), `NutritionTable`, `IngredientsList`, `ShareButtons`, `RelatedProducts`, and `RecentlyViewed` components under `src/components/storefront/`
  - [ ] Implement client-side "recently viewed" tracking (Zustand store or `localStorage`, capped list, deduplicated)
  - [ ] Wire wishlist toggle and add-to-cart controls to their respective (future) client mutations, with defensive handling if those modules aren't installed yet

- [ ] **Validation:**
  - [ ] Zod schema for the `[slug]` route param and any client-side "recently viewed" persisted shape

- [ ] **Testing:**
  - [ ] Unit test `getProductDetail()` aggregation, including the "module not yet available" fallback paths for recipes/reviews/Q&A
  - [ ] Playwright e2e test rendering a full PDP for a seeded product and asserting every required section (per the AC list above) is present
  - [ ] Playwright e2e test for the add-to-cart and gallery zoom interactions

- [ ] **Documentation:**
  - [ ] Document the review-summary and Q&A-summary integration point interfaces so STORY-015/STORY-016 implementers know the contract to fulfil

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — source of all core PDP content
- STORY-010 (Product Listing, Categories & Filters) — reuses `ProductCard` for related/recently-viewed sections
- STORY-013 (Wishlist), STORY-015 (Product Reviews & Ratings), STORY-016 (Product Q&A) — soft dependencies: this story defines their integration points and renders gracefully without them, but the PDP is not feature-complete until they land

## Out of Scope
- Review and Q&A submission forms and moderation (STORY-015, STORY-016)
- Wishlist add/remove persistence logic (STORY-013)
- Recipe content and recipe-detail pages (Epic 04)
- Add-to-cart persistence/checkout flow (Epic 05)

## References
- `docs/blueprint.md` Section 4 (Product Detail Page requirements list)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
- `.claude/skills/add-product-page/SKILL.md`
