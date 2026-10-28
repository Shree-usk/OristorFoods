import { Prisma, type CustomerGroup, type ProductType } from "@/generated/prisma/client";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionService from "@/services/collection.service";
import { computeBundleDiscountedTotal } from "@/services/bundle-pricing.service";
import { isActiveAndInWindow } from "@/services/eligibility-window";
import * as giftOfferRepository from "@/repositories/gift-offer.repository";
import * as pricingService from "@/services/pricing.service";
import { resolveVariantPrice } from "@/services/product-variant.service";
import * as packagingRepository from "@/repositories/packaging.repository";
import * as productRepository from "@/repositories/product.repository";
import * as seoRepository from "@/repositories/seo.repository";
import {
  getQaSummary,
  getRecipeSummary,
  getReviewSummary,
  type QaSummary,
  type RecipeSummary,
  type ReviewSummary,
} from "@/services/product-detail-extensions";
import type { ProductListItem } from "@/types/product";

export async function getProductBySlug(slug: string) {
  const product = await productRepository.findProductBySlug(slug);
  if (!product || product.status !== "Published") return null;
  return product;
}

export function getProductBySlugForAdmin(slug: string) {
  return productRepository.findProductBySlug(slug);
}

export async function listPublishedProductsByCategory(categoryId: string) {
  const products = await productRepository.listProductsByCategory(categoryId);
  return products.filter((product) => product.status === "Published");
}

export type ProductSort = "relevance" | "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";

export interface ProductListingFiltersInput {
  priceMin?: number;
  priceMax?: number;
  /** Products containing ANY of these allergens are excluded. */
  allergens?: string[];
  /** Products with ANY of these certification ids are included. */
  certifications?: string[];
  /** Products with ANY of these brand slugs are included. */
  brands?: string[];
  inStock?: boolean;
}

export interface ProductListingParams {
  categorySlug?: string;
  collectionSlug?: string;
  filters?: ProductListingFiltersInput;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  customerGroup?: CustomerGroup;
}

export interface ProductListingResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

function emptyListingResult(page: number, pageSize: number): ProductListingResult {
  return { items: [], total: 0, page, pageSize, hasNextPage: false };
}

export async function listProducts(params: ProductListingParams): Promise<ProductListingResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const filters = params.filters ?? {};
  const sort = params.sort ?? "newest";

  let categoryIds: string[] | undefined;
  if (params.categorySlug) {
    const category = await categoryRepository.findCategoryBySlug(params.categorySlug);
    if (!category) return emptyListingResult(page, pageSize);
    categoryIds = await categoryRepository.listCategoryAndDescendantIds(category.id);
  }

  let collectionId: string | undefined;
  if (params.collectionSlug) {
    const collection = await collectionService.getPublishedCollectionBySlug(params.collectionSlug);
    if (!collection) return emptyListingResult(page, pageSize);
    collectionId = collection.id;
  }

  const products = await productRepository.findPublishedProductsForListing({
    categoryIds,
    collectionId,
    allergenNamesToExclude: filters.allergens,
    certificationIds: filters.certifications,
    brandSlugs: filters.brands,
    inStock: filters.inStock,
  });

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    products.map((product) => product.id),
    { customerGroup: params.customerGroup ?? "Retail" },
  );

  interface Candidate {
    product: (typeof products)[number];
    price: number;
    currency: string;
  }

  let candidates: Candidate[] = [];
  for (const product of products) {
    const variantPrice = resolveListingVariantPrice(product.variants);
    const resolved = resolvedPrices.get(product.id);
    if (variantPrice) {
      candidates.push({ product, price: variantPrice.price, currency: variantPrice.currency });
    } else if (resolved) {
      candidates.push({ product, price: resolved.price.toNumber(), currency: resolved.currency });
    } // else: no price configured — never shown on the storefront
  }

  if (filters.priceMin !== undefined) {
    const min = filters.priceMin;
    candidates = candidates.filter((candidate) => candidate.price >= min);
  }
  if (filters.priceMax !== undefined) {
    const max = filters.priceMax;
    candidates = candidates.filter((candidate) => candidate.price <= max);
  }

  candidates = sortCandidates(candidates, sort);

  const total = candidates.length;
  const start = (page - 1) * pageSize;
  const pageCandidates = candidates.slice(start, start + pageSize);

  const items: ProductListItem[] = pageCandidates.map(({ product, price, currency }) =>
    toProductListItem(product, price, currency),
  );

  return {
    items,
    total,
    page,
    pageSize,
    hasNextPage: start + pageSize < total,
  };
}

/**
 * A variant-driven product deliberately has no StandardPrice row (see
 * getProductDetail's own comment on this), so resolvePricesForProducts
 * alone can never price it — this mirrors getProductDetail's own
 * default-variant selection (first in-stock, else first overall) so
 * listProducts/listRelatedProducts/getProductsByIds stop silently
 * dropping a Published, in-stock, variant-driven product from every
 * listing. Bundle-driven products have the identical gap (no StandardPrice
 * either) but aren't fixed here — not the reported symptom, and bundle
 * pricing needs resolveBundleDetail's full discount computation, not a
 * flat bulk lookup; tracked as a known follow-up in architecture-decisions.md.
 */
export function resolveListingVariantPrice(
  variants: { price: Prisma.Decimal; promoPrice: Prisma.Decimal | null; currency: string; inStock: boolean; stockQuantity: number }[],
): { price: number; currency: string } | null {
  if (variants.length === 0) return null;
  const defaultVariant = variants.find((variant) => variant.inStock && variant.stockQuantity > 0) ?? variants[0];
  return resolveVariantPrice(defaultVariant);
}

export function sortCandidates<T extends { product: { publishedAt: Date | null }; price: number }>(
  candidates: T[],
  sort: ProductSort,
): T[] {
  const sorted = [...candidates];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    // "best-selling" and "rating" fall back to "newest" ordering: there's no
    // Order model yet (Commerce Platform epic), and sorting by
    // ProductRatingSummary (STORY-015) isn't wired into listings yet. See
    // docs/superpowers/specs/2026-07-16-product-listing-design.md.
    case "best-selling":
    case "rating":
    case "newest":
    default:
      return sorted.sort((a, b) => {
        const aTime = a.product.publishedAt?.getTime() ?? 0;
        const bTime = b.product.publishedAt?.getTime() ?? 0;
        return bTime - aTime;
      });
  }
}

export function toProductListItem(
  product: {
    id: string;
    name: string;
    slug: string;
    images: Array<{ url: string; altText: string | null }>;
    inStock: boolean;
  },
  price: number,
  currency: string,
): ProductListItem {
  const primaryImage = product.images[0];
  return {
    id: product.id,
    name: product.name,
    href: `/products/${product.slug}`,
    imageSrc: primaryImage?.url ?? null,
    imageAlt: primaryImage?.altText ?? product.name,
    price,
    currency,
    inStock: product.inStock,
  };
}

export async function listRelatedProducts(params: {
  productId: string;
  categoryIds: string[];
  customerGroup?: CustomerGroup;
  limit?: number;
}): Promise<ProductListItem[]> {
  if (params.categoryIds.length === 0) return [];
  const limit = params.limit ?? 8;

  // Buffer past `limit` since some candidates get dropped below for lacking
  // a resolved price — bounds the query instead of scanning the whole
  // category (which could be hundreds of products) on every PDP view.
  const candidates = await productRepository.findPublishedProductsForListing({
    categoryIds: params.categoryIds,
    excludeProductId: params.productId,
    take: limit * 3,
  });

  const resolvedPrices = await pricingService.resolvePricesForProducts(
    candidates.map((candidate) => candidate.id),
    { customerGroup: params.customerGroup ?? "Retail" },
  );

  const items: ProductListItem[] = [];
  for (const candidate of candidates) {
    const variantPrice = resolveListingVariantPrice(candidate.variants);
    const resolved = resolvedPrices.get(candidate.id);
    if (variantPrice) {
      items.push(toProductListItem(candidate, variantPrice.price, variantPrice.currency));
    } else if (resolved) {
      items.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
    } else {
      continue;
    }
    if (items.length >= limit) break;
  }
  return items;
}

export async function getProductsByIds(ids: string[], customerGroup?: CustomerGroup): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];

  const candidates = await productRepository.findProductsByIdsWithFilters(ids, {});
  const resolvedPrices = await pricingService.resolvePricesForProducts(
    candidates.map((candidate) => candidate.id),
    { customerGroup: customerGroup ?? "Retail" },
  );

  const items: ProductListItem[] = [];
  for (const candidate of candidates) {
    const variantPrice = resolveListingVariantPrice(candidate.variants);
    const resolved = resolvedPrices.get(candidate.id);
    if (variantPrice) {
      items.push(toProductListItem(candidate, variantPrice.price, variantPrice.currency));
    } else if (resolved) {
      items.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
    }
  }
  return items;
}

export interface ProductDetailImage {
  url: string;
  altText: string;
  isPrimary: boolean;
}
export interface ProductDetailVideo {
  url: string;
  altText: string;
}
export interface ProductDetailNutrition {
  servingSize: string;
  calories: number;
  protein: number;
  fat: number;
  saturatedFat: number;
  carbohydrates: number;
  sugar: number;
  fibre: number;
  sodium: number;
}
export interface ProductDetailIngredient {
  name: string;
  isAllergen: boolean;
}
export interface ProductDetailInspirationCard {
  id: string;
  imageUrl: string;
  imageAlt: string | null;
  title: string;
  description: string | null;
}
export interface ProductDetailFeaturedItem {
  id: string;
  imageUrl: string;
  imageAlt: string | null;
  title: string;
  description: string | null;
}
export interface ProductDetailBundleItem {
  bundleItemId: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string;
  quantity: number;
  imageSrc: string;
  imageAlt: string;
  /** Live, resolved price for ONE unit of this component — see getProductDetail. */
  price: number;
  inStock: boolean;
  isRequired: boolean;
  minQuantity: number;
  maxQuantity: number | null;
}

/** Story 2 (Bundles). Bundle-level metadata — null for a product with no bundle configured. */
export interface ProductDetailBundle {
  id: string;
  bundleType: "Fixed" | "Selectable" | "MixAndMatch";
  name: string;
  description: string | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  standaloneTotal: number;
  discountedTotal: number;
  currency: string;
  inStock: boolean;
}

/** Story 5 (Free Gift). Gift-offer metadata for the PDP — null for a product with no eligible gift offer configured. */
export interface ProductDetailGiftOffer {
  id: string;
  name: string;
  description: string | null;
  minQuantity: number | null;
  minSpend: number | null;
  giftProductName: string;
  giftProductImageSrc: string | null;
  giftProductImageAlt: string;
  giftQuantity: number;
  /** Live, resolved standalone price of ONE unit of the gift — display only ("worth LKR X"), never charged. */
  standaloneValue: number;
  currency: string;
  inStock: boolean;
}

export interface ProductDetailVariant {
  id: string;
  sku: string;
  name: string;
  netWeightGrams: number;
  price: number;
  promoPrice: number | null;
  currency: string;
  inStock: boolean;
  stockQuantity: number;
  images: { url: string; altText: string | null }[];
}

/** Story 3 (Custom Packaging). Customer-eligible (both option + method Active) packaging options for this product — see packaging.repository.ts::findEligiblePackagingOptionsForProduct. */
export interface ProductDetailPackagingOption {
  id: string;
  variantId: string | null;
  packagingMethodName: string;
  packagingMethodImage: string | null;
  chargeType: "Fixed" | "PerGram";
  charge: number;
  /** PerGram only — LKR per gram. Null under Fixed. */
  ratePerGram: number | null;
  /** PerGram only — minimum aggregate net weight (grams) required across every cart line sharing this option. Null under Fixed. */
  minOrderWeightGrams: number | null;
  /** PerGram only — floors the computed (weight x rate) charge. Null under Fixed. */
  minPackagingCharge: number | null;
  minQuantity: number | null;
  availability: "Local" | "Export" | "Both";
  leadTimeDays: number | null;
  shelfLifeDays: number | null;
  shelfLifeText: string | null;
  customerInstructions: string | null;
  /** Checkbox label on the PDP acknowledgement gate — null falls back to the storefront's default wording. */
  acknowledgementText: string | null;
}

export interface ProductDetail {
  id: string;
  sku: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  story: string | null;
  benefits: string[];
  servingSuggestions: string[];
  productType: ProductType;
  inStock: boolean;
  rewardPoints: number;
  images: ProductDetailImage[];
  videos: ProductDetailVideo[];
  nutrition: ProductDetailNutrition | null;
  ingredients: ProductDetailIngredient[];
  inspirationCards: ProductDetailInspirationCard[];
  featuredItems: ProductDetailFeaturedItem[];
  allergenNames: string[];
  certificationNames: string[];
  /** Richer than allergenNames/certificationNames above (name + icon/badge image) — for the PDP's own badge display; compare-view.tsx uses the plain name arrays instead, so those are left as-is rather than reshaped. */
  allergens: { name: string; icon: string | null }[];
  certifications: { name: string; certificateImage: string | null }[];
  bundleItems: ProductDetailBundleItem[];
  bundle: ProductDetailBundle | null;
  giftOffer: ProductDetailGiftOffer | null;
  /** Non-empty only for a variant-driven product — see getProductDetail for how price/currency below are then derived from the default-selected variant instead of the 5-tier pricing system. */
  variants: ProductDetailVariant[];
  /** Story 3 (Custom Packaging). Variant-scoped filtering happens client-side — avoids a round-trip on every size switch. */
  packagingOptions: ProductDetailPackagingOption[];
  price: number;
  originalPrice: number | null;
  currency: string;
  categoryPath: categoryRepository.CategoryPathItem[];
  categoryIds: string[];
  reviewSummary: ReviewSummary | null;
  qaSummary: QaSummary | null;
  recipeSummary: RecipeSummary | null;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  jsonLdOverride: unknown;
}

export interface CompareItem {
  id: string;
  slug: string;
  name: string;
  /** Null when the product has no image — render a placeholder, never an empty src. */
  imageSrc: string | null;
  imageAlt: string;
  brandName: string | null;
  price: number;
  currency: string;
  nutrition: ProductDetailNutrition | null;
  ingredients: ProductDetailIngredient[];
  allergenNames: string[];
  certificationNames: string[];
  rating: number | null;
  reviewCount: number | null;
}

/**
 * STORY-071: `customerGroup` is a plain primitive, not wrapped in an
 * options object — generateMetadata and the page body both call this
 * through the same `cache()` wrapper (see products/[slug]/page.tsx),
 * which dedupes by argument equality; a fresh object literal per call
 * would defeat that even when its value is identical. STORY-060's
 * `userId` param follows the same rule.
 *
 * "You May Also Like" is no longer computed here — it moved to
 * recommendation.service.ts::getSimilarProducts (precomputed
 * similarity, falling back to this file's own listRelatedProducts),
 * called directly by the PDP page using this function's `categoryIds`.
 * Keeping it here would create a circular import (recommendation.service.ts
 * already imports listRelatedProducts from this file as ITS OWN fallback).
 */
type ProductDetailBundleRow = NonNullable<Awaited<ReturnType<typeof productRepository.findProductDetailBySlug>>>["bundle"];

/**
 * The repository's `bundle` include has no `where` clause (a product has
 * at most one bundle row, active or not), so this status/date-window check
 * is the only thing standing between a Draft/Inactive/not-yet-started/
 * expired bundle and it rendering live on the PDP — required by the
 * Promotion Selector spec's "only active, eligible promotions" and
 * "expired, inactive... offers cannot be purchased" rules.
 */
function isBundleEligibleNow(bundle: NonNullable<ProductDetailBundleRow>): boolean {
  return isActiveAndInWindow(bundle);
}

/**
 * Resolves a bundle's component rows + headline standalone/discounted
 * total for the PDP. The headline total only ever reflects the bundle's
 * REQUIRED items (every item, for a Fixed bundle) — Selectable/
 * MixAndMatch bundles have nothing to total until the customer picks,
 * which bundle-display.tsx drives live via the public preview endpoint
 * instead of this static field.
 */
async function resolveBundleDetail(
  bundle: ProductDetailBundleRow,
  customerGroup: CustomerGroup,
): Promise<{ items: ProductDetailBundleItem[]; bundle: ProductDetailBundle | null }> {
  if (!bundle || !isBundleEligibleNow(bundle)) return { items: [], bundle: null };

  const items: ProductDetailBundleItem[] = [];
  for (const item of bundle.items) {
    let price: number;
    let inStock: boolean;
    if (item.componentVariant) {
      const resolved = resolveVariantPrice(item.componentVariant);
      price = resolved.price;
      inStock = item.componentVariant.isActive && item.componentVariant.inStock;
    } else {
      const resolved = await pricingService.resolvePrice({ productId: item.componentProductId, customerGroup });
      price = resolved?.price.toNumber() ?? 0;
      inStock = item.componentProduct.inStock;
    }
    items.push({
      bundleItemId: item.id,
      productId: item.componentProductId,
      variantId: item.componentVariantId,
      name: item.componentVariant ? `${item.componentProduct.name} — ${item.componentVariant.name}` : item.componentProduct.name,
      slug: item.componentProduct.slug,
      quantity: item.quantity,
      imageSrc: item.componentProduct.images[0]?.url ?? "",
      imageAlt: item.componentProduct.images[0]?.altText ?? item.componentProduct.name,
      price,
      inStock,
      isRequired: item.isRequired,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
    });
  }

  const requiredItems = items.filter((item) => item.isRequired);
  const standaloneTotal = requiredItems.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.price).times(item.quantity)), new Prisma.Decimal(0));
  const discountedTotal = computeBundleDiscountedTotal(standaloneTotal, bundle);

  return {
    items,
    bundle: {
      id: bundle.id,
      bundleType: bundle.bundleType,
      name: bundle.name,
      description: bundle.description,
      minQuantity: bundle.minQuantity,
      maxQuantity: bundle.maxQuantity,
      standaloneTotal: standaloneTotal.toNumber(),
      discountedTotal: discountedTotal.toNumber(),
      currency: "LKR",
      inStock: bundle.stockMode === "OwnStock" ? bundle.inStock && (bundle.stockQuantity ?? 0) > 0 : requiredItems.every((item) => item.inStock),
    },
  };
}

type ProductDetailGiftOfferRow = NonNullable<Awaited<ReturnType<typeof productRepository.findProductDetailBySlug>>>["giftOfferAsQualifier"];

/**
 * Resolves a product's eligible gift offer for the PDP — mirrors
 * resolveBundleDetail's shape. The gift product/variant's price is
 * resolved for DISPLAY ONLY ("worth LKR X, yours free") — a gift is never
 * priced like a purchase; see gift-offer.service.ts for the cart-side
 * enforcement that it's always added at unitPriceSnapshot "0.00".
 */
async function resolveGiftOfferDetail(giftOffer: ProductDetailGiftOfferRow, customerGroup: CustomerGroup): Promise<ProductDetailGiftOffer | null> {
  if (!giftOffer || !isActiveAndInWindow(giftOffer)) return null;

  let standaloneValue: number;
  let currency: string;
  let giftInStock: boolean;
  if (giftOffer.giftVariant) {
    const resolved = resolveVariantPrice(giftOffer.giftVariant);
    standaloneValue = resolved.price;
    currency = resolved.currency;
    giftInStock = giftOffer.giftVariant.isActive && giftOffer.giftVariant.inStock;
  } else {
    const resolved = await pricingService.resolvePrice({ productId: giftOffer.giftProductId, customerGroup });
    standaloneValue = resolved?.price.toNumber() ?? 0;
    currency = resolved?.currency ?? "LKR";
    giftInStock = giftOffer.giftProduct.inStock;
  }

  // giftStockLimit caps gift UNITS, not redemptions — each redemption
  // grants giftQuantity units (see gift-offer.service.ts::assertGiftOfferPurchasable).
  let stockLimitReached = false;
  if (giftOffer.giftStockLimit !== null) {
    const redeemed = await giftOfferRepository.countRedemptions(giftOffer.id);
    stockLimitReached = redeemed * giftOffer.giftQuantity >= giftOffer.giftStockLimit;
  }

  return {
    id: giftOffer.id,
    name: giftOffer.name,
    description: giftOffer.description,
    minQuantity: giftOffer.minQuantity,
    minSpend: giftOffer.minSpend?.toNumber() ?? null,
    giftProductName: giftOffer.giftProduct.name,
    giftProductImageSrc: giftOffer.giftProduct.images[0]?.url ?? null,
    giftProductImageAlt: giftOffer.giftProduct.images[0]?.altText ?? giftOffer.giftProduct.name,
    giftQuantity: giftOffer.giftQuantity,
    standaloneValue,
    currency,
    inStock: giftInStock && !stockLimitReached,
  };
}

export async function getProductDetail(
  slug: string,
  customerGroup?: CustomerGroup,
  userId?: string | null,
): Promise<ProductDetail | null> {
  const product = await productRepository.findProductDetailBySlug(slug);
  if (!product || product.status !== "Published") return null;

  const categoryIds = product.categories.map((category) => category.id);
  // A variant-driven product's price comes entirely from its variants
  // (see the Product Variants story's design decision) — the parent's
  // own StandardPrice/etc. rows are never consulted, and an admin isn't
  // required to set one once variants exist. Story 2 (Bundles): the same
  // rule applies to a bundle-driven product — its price comes from the
  // bundle definition, not the base Product's own StandardPrice, which
  // a real bundle configuration correctly leaves unset. Found live on
  // staging: without this, a genuinely well-configured bundle product
  // 404'd (the base-price gate below rejected it before bundle data was
  // ever consulted).
  const hasVariants = product.variants.length > 0;
  // Raw row presence isn't enough — a bundle that's Draft/Inactive or
  // outside its scheduled window (see isBundleEligibleNow) must not keep
  // the product's own StandardPrice unreachable, or the product silently
  // renders at a LKR 0 price once that bundle lapses. Checked once here
  // (resolveBundleDetail below re-derives the same thing for its own
  // return value — cheap, pure, not worth threading through).
  const hasEligibleBundle = product.bundle !== null && isBundleEligibleNow(product.bundle);

  const [resolvedPrice, reviewSummary, qaSummary, recipeSummary, seoMeta, packagingOptions] = await Promise.all([
    hasVariants || hasEligibleBundle ? null : pricingService.resolvePrice({ productId: product.id, customerGroup: customerGroup ?? "Retail" }),
    getReviewSummary(product.id),
    getQaSummary(product.id),
    getRecipeSummary(product.id),
    seoRepository.findSeoMeta("Product", product.id),
    packagingRepository.findEligiblePackagingOptionsForProduct(product.id),
  ]);

  if (!hasVariants && !hasEligibleBundle && !resolvedPrice) {
    // Renders identically to a genuinely-missing product (notFound()) from
    // the outside, so this is the only signal an admin/dev gets that the
    // product exists and is Published but has no resolvable price.
    console.warn(
      `getProductDetail: product ${product.id} (slug "${product.slug}") is Published but has no configured price; rendering as not found.`,
    );
    return null;
  }

  let originalPrice: number | null = null;
  if (resolvedPrice && resolvedPrice.tier !== "standard") {
    const standard = await pricingService.getStandardPrice(product.id);
    if (standard && standard.price > resolvedPrice.price.toNumber()) {
      originalPrice = standard.price;
    }
  }

  const defaultVariant = product.variants.find((variant) => variant.inStock && variant.stockQuantity > 0) ?? product.variants[0];
  const variantPrice = defaultVariant ? (defaultVariant.promoPrice ?? defaultVariant.price).toNumber() : null;
  const variantOriginalPrice = defaultVariant?.promoPrice ? defaultVariant.price.toNumber() : null;

  const categoryPath = product.categories[0]
    ? await categoryRepository.getCategoryAncestorPath(product.categories[0].id)
    : [];

  const bundleDetail = await resolveBundleDetail(product.bundle, customerGroup ?? "Retail");
  const bundleOriginalPrice = bundleDetail.bundle && bundleDetail.bundle.discountedTotal < bundleDetail.bundle.standaloneTotal ? bundleDetail.bundle.standaloneTotal : null;
  const giftOfferDetail = await resolveGiftOfferDetail(product.giftOfferAsQualifier, customerGroup ?? "Retail");

  const detail: ProductDetail = {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    shortDescription: product.shortDescription,
    story: product.story,
    benefits: product.benefits,
    servingSuggestions: product.servingSuggestions,
    productType: product.productType,
    inStock: product.inStock,
    rewardPoints: product.rewardPoints,
    images: product.images.map((image) => ({
      url: image.url,
      altText: image.altText ?? product.name,
      isPrimary: image.isPrimary,
    })),
    videos: product.videos.map((video) => ({ url: video.url, altText: video.altText ?? product.name })),
    nutrition: product.nutrition
      ? {
          servingSize: product.nutrition.servingSize,
          calories: product.nutrition.calories.toNumber(),
          protein: product.nutrition.protein.toNumber(),
          fat: product.nutrition.fat.toNumber(),
          saturatedFat: product.nutrition.saturatedFat.toNumber(),
          carbohydrates: product.nutrition.carbohydrates.toNumber(),
          sugar: product.nutrition.sugar.toNumber(),
          fibre: product.nutrition.fibre.toNumber(),
          sodium: product.nutrition.sodium.toNumber(),
        }
      : null,
    ingredients: product.ingredients.map((ingredient) => ({
      name: ingredient.name,
      isAllergen: ingredient.isAllergen,
    })),
    inspirationCards: product.inspirationCards.map((card) => ({
      id: card.id,
      imageUrl: card.imageUrl,
      imageAlt: card.imageAlt,
      title: card.title,
      description: card.description,
    })),
    featuredItems: product.featuredItems.map((item) => ({
      id: item.id,
      imageUrl: item.imageUrl,
      imageAlt: item.imageAlt,
      title: item.title,
      description: item.description,
    })),
    allergenNames: product.allergens.map((allergen) => allergen.name),
    certificationNames: product.certifications.map((certification) => certification.name),
    allergens: product.allergens.map((allergen) => ({ name: allergen.name, icon: allergen.icon })),
    certifications: product.certifications.map((certification) => ({ name: certification.name, certificateImage: certification.certificateImage })),
    bundleItems: bundleDetail.items,
    bundle: bundleDetail.bundle,
    giftOffer: giftOfferDetail,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      netWeightGrams: variant.netWeightGrams,
      price: variant.price.toNumber(),
      promoPrice: variant.promoPrice?.toNumber() ?? null,
      currency: variant.currency,
      inStock: variant.inStock,
      stockQuantity: variant.stockQuantity,
      images: variant.images.map((image) => ({ url: image.url, altText: image.altText })),
    })),
    packagingOptions: packagingOptions.map((option) => ({
      id: option.id,
      variantId: option.variantId,
      packagingMethodName: option.packagingMethod.name,
      packagingMethodImage: option.packagingMethod.image,
      chargeType: option.chargeType,
      charge: option.charge.toNumber(),
      ratePerGram: option.ratePerGram?.toNumber() ?? null,
      minOrderWeightGrams: option.minOrderWeightGrams,
      minPackagingCharge: option.minPackagingCharge?.toNumber() ?? null,
      minQuantity: option.minQuantity,
      availability: option.availability,
      leadTimeDays: option.leadTimeDays,
      shelfLifeDays: option.shelfLifeDays,
      shelfLifeText: option.shelfLifeText,
      customerInstructions: option.customerInstructions,
      acknowledgementText: option.acknowledgementText,
    })),
    price: hasVariants ? (variantPrice ?? 0) : hasEligibleBundle ? (bundleDetail.bundle?.discountedTotal ?? 0) : resolvedPrice!.price.toNumber(),
    originalPrice: hasVariants ? variantOriginalPrice : hasEligibleBundle ? bundleOriginalPrice : originalPrice,
    currency: hasVariants ? (defaultVariant?.currency ?? "LKR") : hasEligibleBundle ? (bundleDetail.bundle?.currency ?? "LKR") : resolvedPrice!.currency,
    categoryPath,
    categoryIds,
    reviewSummary,
    qaSummary,
    recipeSummary,
    metaTitle: seoMeta?.metaTitle ?? null,
    metaDescription: seoMeta?.metaDescription ?? null,
    canonicalUrl: seoMeta?.canonicalUrl ?? null,
    robotsIndex: seoMeta?.robotsIndex ?? true,
    robotsFollow: seoMeta?.robotsFollow ?? true,
    jsonLdOverride: seoMeta?.jsonLdOverride ?? null,
  };

  // Best-effort — never block the page render on a tracking write. The
  // whole function (not just trackInteraction's own promise) is guarded:
  // getSessionId() itself can reject (e.g. cookies() outside a request
  // scope, which every getProductDetail unit test hits directly), and an
  // unguarded rejection here would surface as an unhandled promise
  // rejection since this call is intentionally not awaited.
  recordProductView(product.id, userId ?? null).catch((error) => {
    console.error("[product] failed to record View interaction", error);
  });

  return detail;
}

async function recordProductView(productId: string, userId: string | null): Promise<void> {
  const { trackInteraction } = await import("@/services/recommendation.service");
  const sessionId = userId ? null : await (await import("@/lib/recommendation-session")).getSessionId();
  await trackInteraction({ customerId: userId, sessionId, productId, eventType: "View" });
}

export async function getProductsForCompare(productIds: string[], customerGroup?: CustomerGroup): Promise<CompareItem[]> {
  if (productIds.length === 0) return [];

  const candidates = await productRepository.findProductsForCompareByIds(productIds);
  const resolvedPrices = await pricingService.resolvePricesForProducts(
    candidates.map((candidate) => candidate.id),
    { customerGroup: customerGroup ?? "Retail" },
  );

  const byId = new Map<string, CompareItem>();
  for (const candidate of candidates) {
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue;

    const reviewSummary = await getReviewSummary(candidate.id);
    const primaryImage = candidate.images[0];

    byId.set(candidate.id, {
      id: candidate.id,
      slug: candidate.slug,
      name: candidate.name,
      imageSrc: primaryImage?.url ?? null,
      imageAlt: primaryImage?.altText ?? candidate.name,
      brandName: candidate.brand?.name ?? null,
      price: resolved.price.toNumber(),
      currency: resolved.currency,
      nutrition: candidate.nutrition
        ? {
            servingSize: candidate.nutrition.servingSize,
            calories: candidate.nutrition.calories.toNumber(),
            protein: candidate.nutrition.protein.toNumber(),
            fat: candidate.nutrition.fat.toNumber(),
            saturatedFat: candidate.nutrition.saturatedFat.toNumber(),
            carbohydrates: candidate.nutrition.carbohydrates.toNumber(),
            sugar: candidate.nutrition.sugar.toNumber(),
            fibre: candidate.nutrition.fibre.toNumber(),
            sodium: candidate.nutrition.sodium.toNumber(),
          }
        : null,
      ingredients: candidate.ingredients.map((ingredient) => ({
        name: ingredient.name,
        isAllergen: ingredient.isAllergen,
      })),
      allergenNames: candidate.allergens.map((allergen) => allergen.name),
      certificationNames: candidate.certifications.map((certification) => certification.name),
      rating: reviewSummary?.averageRating ?? null,
      reviewCount: reviewSummary?.reviewCount ?? null,
    });
  }

  // Preserve the caller's id order (the tray's insertion order), not
  // database/query order — a product dropped by the price/status filters
  // above is simply absent, not a gap in the array.
  return productIds.map((id) => byId.get(id)).filter((item): item is CompareItem => item !== undefined);
}
