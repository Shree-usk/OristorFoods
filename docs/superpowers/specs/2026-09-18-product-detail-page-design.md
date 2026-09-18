# Product Detail Page — Design

**Story:** `docs/stories/03-product-platform/STORY-011-product-detail-page.md`
**Date:** 2026-09-18

## Summary

Builds the storefront Product Detail Page (PDP) at `/products/[slug]`,
rendering all sections `docs/blueprint.md` Section 4 requires, sourced from
a single aggregated server-side call. Reviews, Q&A, and recipe content
don't exist yet (STORY-015, STORY-016, Epic 04) — this design defines
extension points so those stories can plug in later without PDP code
changes, and specifies graceful empty/coming-soon states until they do.

## Schema Change

`Product` model gains two fields (`prisma/schema.prisma`):

```prisma
benefits           String[] @default([])
servingSuggestions String[] @default([])
```

Bullet-point lists (not long-form text like `story`), matching how these
are actually authored/displayed. Applied via `npx prisma db push` per the
documented local-DB workflow (`docs/architecture-decisions.md`). Admin-console
editing of these fields is out of scope for this story (no admin Products
module exists yet — STORY-040); they're seeded/edited directly until then.

## Data Flow

`product.service.ts` gains:

```ts
export interface ProductDetail {
  // catalogue fields (name, slug, story, benefits, servingSuggestions,
  // ingredients, allergens, certifications, nutrition, images, videos,
  // productType, bundle items if applicable, rewardPoints, SEO fields)
  // + resolved price (via pricingService.resolvePrice)
  // + relatedProductIds: string[]
  // + reviewSummary: ReviewSummary | null
  // + qaSummary: QaSummary | null
  // + recipeSummary: RecipeSummary | null
}

export async function getProductDetail(
  slug: string,
  opts: { customerGroup?: CustomerGroup } = {},
): Promise<ProductDetail | null>
```

Composes, in one call: `productRepository.findProductBySlug` (extended to
include nutrition/ingredients/allergens/certifications/images/videos/bundle
relations), `pricingService.resolvePrice()`, a related-products lookup
(same category, published, excluding self, capped e.g. 8), and the three
extension-point providers below. No client-side waterfalling — the PDP
route is a Server Component that calls this once.

## Extension Points

New file `src/services/product-detail-extensions.ts`. Each future module
registers a provider function; until registered, a stub returns `null` and
the corresponding PDP section renders its documented empty state.

```ts
export interface ReviewPreview {
  id: string; authorName: string; rating: number; title: string;
  body: string; createdAt: Date;
}
export interface ReviewSummary {
  averageRating: number; reviewCount: number; previewReviews: ReviewPreview[];
}
export type GetReviewSummary = (productId: string) => Promise<ReviewSummary | null>;

export interface QaPreview { id: string; question: string; answer: string; createdAt: Date; }
export interface QaSummary { previewItems: QaPreview[]; totalCount: number; }
export type GetQaSummary = (productId: string) => Promise<QaSummary | null>;

export interface RecipePreview { id: string; title: string; slug: string; imageSrc: string; }
export interface RecipeSummary { recipes: RecipePreview[]; }
export type GetRecipeSummary = (productId: string) => Promise<RecipeSummary | null>;

// Each has: a module-local stub implementation returning null/empty,
// a `register*Provider(fn)` export, and a `get*Summary(productId)` export
// that product.service.ts calls. STORY-015/016 and the Recipe module call
// `register*Provider` from their own service's module init.
```

This keeps `product.service.ts` free of imports into modules that don't
exist yet, while giving STORY-015/016/Epic-04 a documented contract to
fulfil (satisfies STORY-011's "document the integration point" task).

## Wishlist Integration

`useWishlist(productId)` client hook (`src/hooks/use-wishlist.ts`), stubbed:

```ts
export function useWishlist(productId: string) {
  return { isWishlisted: false, isAvailable: false, toggle: () => {} };
}
```

The heart-icon control renders disabled/placeholder when `isAvailable` is
`false`. STORY-013 replaces this hook's implementation; the PDP component
consuming it doesn't change.

## Frontend Components

All new, under `src/components/storefront/product/` unless noted:

- `page.tsx` at `src/app/(storefront)/products/[slug]/page.tsx` — Server
  Component, calls `getProductDetail`, 404s via `notFound()` if absent or
  unpublished, renders `Product` JSON-LD + metadata from SEO fields.
- `ProductGallery` — lightbox modal on click (not hover-zoom), keyboard/ESC
  dismissible, primary image first, uses `altText`.
- `NutritionTable` — structured facts table from `ProductNutrition`.
- `IngredientsList` — ordered list, allergen ingredients visually flagged.
- `BenefitsList`, `ServingSuggestions` — simple bullet renderers for the
  new fields.
- `ShareButtons` — copy-link, WhatsApp, Facebook, X, email; plain links/
  `navigator.clipboard`, no external SDK.
- `RelatedProducts`, `RecentlyViewed` — both reuse `ProductCard`
  (`src/components/storefront/product/product-card.tsx`, from STORY-010).
- Reviews/Q&A/Recipes preview sections — render from the extension-point
  summaries; empty-state copy when `null`.
- Bundle/gift-pack section — renders `BundleItem`s distinctly when
  `productType` is `Bundle`/`GiftPack`.

## Recently Viewed

New Zustand store `src/stores/recently-viewed.store.ts` with `persist`
middleware (localStorage-backed), per CLAUDE.md's Zustand-for-client-state
convention. Capped list (e.g. 12), deduplicated by product id, most-recent
first. `RecentlyViewed` component reads the store, excludes the current
product, renders via `ProductCard`.

## Error Handling

- Unknown/unpublished slug → Next.js `notFound()` → 404 page.
- Missing optional data (no nutrition row, no images) → section omitted or
  shows a minimal fallback, never throws.
- Extension-point providers return `null` → documented empty state, never
  an error.
- Out-of-stock → add-to-cart disabled, clear "out of stock" label; wishlist
  and share remain available.

## Testing

- Vitest: `getProductDetail()` aggregation — full data present, partial
  data (missing nutrition/images), unregistered extension points (fallback
  paths), unpublished/missing slug → `null`.
- Playwright e2e: full PDP render for a seeded product asserting every AC
  section is present; add-to-cart interaction; gallery lightbox open/close.

## Out of Scope (unchanged from story)

Review/Q&A submission UI, wishlist persistence, recipe content, cart/
checkout persistence — all deferred to their own stories per STORY-011.
