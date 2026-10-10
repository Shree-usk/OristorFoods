import type { CustomerGroup, ProductType } from "@/generated/prisma/client";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionService from "@/services/collection.service";
import * as pricingService from "@/services/pricing.service";
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
    const resolved = resolvedPrices.get(product.id);
    if (!resolved) continue; // no price configured — never shown on the storefront
    candidates.push({ product, price: resolved.price.toNumber(), currency: resolved.currency });
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
    imageSrc: primaryImage?.url ?? "",
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
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue;
    items.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
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
    const resolved = resolvedPrices.get(candidate.id);
    if (!resolved) continue;
    items.push(toProductListItem(candidate, resolved.price.toNumber(), resolved.currency));
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
export interface ProductDetailBundleItem {
  productId: string;
  name: string;
  slug: string;
  quantity: number;
  imageSrc: string;
  imageAlt: string;
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
  allergenNames: string[];
  certificationNames: string[];
  /** Richer than allergenNames/certificationNames above (name + icon/badge image) — for the PDP's own badge display; compare-view.tsx uses the plain name arrays instead, so those are left as-is rather than reshaped. */
  allergens: { name: string; icon: string | null }[];
  certifications: { name: string; certificateImage: string | null }[];
  bundleItems: ProductDetailBundleItem[];
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
  imageSrc: string;
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
export async function getProductDetail(
  slug: string,
  customerGroup?: CustomerGroup,
  userId?: string | null,
): Promise<ProductDetail | null> {
  const product = await productRepository.findProductDetailBySlug(slug);
  if (!product || product.status !== "Published") return null;

  const categoryIds = product.categories.map((category) => category.id);

  const [resolvedPrice, reviewSummary, qaSummary, recipeSummary, seoMeta] = await Promise.all([
    pricingService.resolvePrice({ productId: product.id, customerGroup: customerGroup ?? "Retail" }),
    getReviewSummary(product.id),
    getQaSummary(product.id),
    getRecipeSummary(product.id),
    seoRepository.findSeoMeta("Product", product.id),
  ]);

  if (!resolvedPrice) {
    // Renders identically to a genuinely-missing product (notFound()) from
    // the outside, so this is the only signal an admin/dev gets that the
    // product exists and is Published but has no resolvable price.
    console.warn(
      `getProductDetail: product ${product.id} (slug "${product.slug}") is Published but has no configured price; rendering as not found.`,
    );
    return null;
  }

  let originalPrice: number | null = null;
  if (resolvedPrice.tier !== "standard") {
    const standard = await pricingService.getStandardPrice(product.id);
    if (standard && standard.price > resolvedPrice.price.toNumber()) {
      originalPrice = standard.price;
    }
  }

  const categoryPath = product.categories[0]
    ? await categoryRepository.getCategoryAncestorPath(product.categories[0].id)
    : [];

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
    allergenNames: product.allergens.map((allergen) => allergen.name),
    certificationNames: product.certifications.map((certification) => certification.name),
    allergens: product.allergens.map((allergen) => ({ name: allergen.name, icon: allergen.icon })),
    certifications: product.certifications.map((certification) => ({ name: certification.name, certificateImage: certification.certificateImage })),
    bundleItems: (product.bundle?.items ?? []).map((item) => ({
      productId: item.componentProductId,
      name: item.componentProduct.name,
      slug: item.componentProduct.slug,
      quantity: item.quantity,
      imageSrc: item.componentProduct.images[0]?.url ?? "",
      imageAlt: item.componentProduct.images[0]?.altText ?? item.componentProduct.name,
    })),
    price: resolvedPrice.price.toNumber(),
    originalPrice,
    currency: resolvedPrice.currency,
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
      imageSrc: primaryImage?.url ?? "",
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
