import type { CustomerGroup } from "@/generated/prisma/client";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionService from "@/services/collection.service";
import * as pricingService from "@/services/pricing.service";
import * as productRepository from "@/repositories/product.repository";
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

export type ProductSort = "price-asc" | "price-desc" | "newest" | "best-selling" | "rating";

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

  const items: ProductListItem[] = pageCandidates.map(({ product, price, currency }) => {
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
  });

  return {
    items,
    total,
    page,
    pageSize,
    hasNextPage: start + pageSize < total,
  };
}

function sortCandidates<T extends { product: { publishedAt: Date | null }; price: number }>(
  candidates: T[],
  sort: ProductSort,
): T[] {
  const sorted = [...candidates];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    // "best-selling" and "rating" fall back to "newest" ordering — no Order
    // model (Commerce Platform epic) or reviews/ratings data (STORY-015)
    // exists yet to sort by. See
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
