import { prisma } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";
import { escapeLikePattern } from "@/lib/escape-like-pattern";

export function createProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data });
}

export function findProductBySlug(slug: string) {
  return prisma.product.findUnique({ where: { slug } });
}

export function findProductBySku(sku: string) {
  return prisma.product.findUnique({ where: { sku } });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

// STORY-060. The /api/recommendations/product/[id] route's own lookup —
// just enough to drive getSimilarProducts' category-match fallback,
// not the full findProductById/findProductDetailBySlug payload.
export async function findProductCategoryIds(id: string): Promise<string[] | null> {
  const product = await prisma.product.findUnique({ where: { id }, select: { categories: { select: { id: true } } } });
  if (!product) return null;
  return product.categories.map((category) => category.id);
}

// STORY-036. Same include shape as cart.repository.ts's `withProduct` —
// one primary-image thumbnail per product, batched by id for order-history
// list/detail rendering and the reorder stock/status check, so both never
// need a second query per line item.
const withPrimaryImage = {
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1 },
} satisfies Prisma.ProductInclude;

export type ProductWithPrimaryImage = Prisma.ProductGetPayload<{ include: typeof withPrimaryImage }>;

export function findProductsByIdsWithPrimaryImage(ids: string[]): Promise<ProductWithPrimaryImage[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({ where: { id: { in: ids } }, include: withPrimaryImage });
}

export function findProductDetailBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      // Explicit ordering: Prisma relation includes have no guaranteed
      // order otherwise, and the PDP picks categories[0] as the "primary"
      // category for the breadcrumb trail — an unordered result would make
      // that choice nondeterministic between requests.
      categories: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      videos: { orderBy: { sortOrder: "asc" } },
      nutrition: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      allergens: true,
      certifications: true,
      bundle: {
        include: {
          items: {
            include: {
              componentProduct: {
                include: { images: { where: { isPrimary: true }, take: 1 } },
              },
            },
          },
        },
      },
    },
  });
}

export function listProductsByCategory(categoryId: string) {
  return prisma.product.findMany({
    where: { categories: { some: { id: categoryId } } },
  });
}

export function listProductsByStatus(status: ProductStatus) {
  return prisma.product.findMany({ where: { status } });
}

export function addProductImage(data: Prisma.ProductImageCreateInput) {
  return prisma.productImage.create({ data });
}

export function addProductVideo(data: Prisma.ProductVideoCreateInput) {
  return prisma.productVideo.create({ data });
}

export function listProductImages(productId: string) {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function listProductVideos(productId: string) {
  return prisma.productVideo.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function setProductNutrition(data: Prisma.ProductNutritionCreateInput) {
  return prisma.productNutrition.create({ data });
}

export function getProductNutrition(productId: string) {
  return prisma.productNutrition.findUnique({ where: { productId } });
}

export function addProductIngredient(data: Prisma.ProductIngredientCreateInput) {
  return prisma.productIngredient.create({ data });
}

export function listProductIngredients(productId: string) {
  return prisma.productIngredient.findMany({
    where: { productId },
    orderBy: { sortOrder: "asc" },
  });
}

export function createAllergen(data: Prisma.AllergenCreateInput) {
  return prisma.allergen.create({ data });
}

export function findAllergenByName(name: string) {
  return prisma.allergen.findUnique({ where: { name } });
}

export function attachAllergen(productId: string, allergenId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { allergens: { connect: { id: allergenId } } },
  });
}

export function listProductAllergens(productId: string) {
  return prisma.allergen.findMany({
    where: { products: { some: { id: productId } } },
  });
}

export function createCertification(data: Prisma.CertificationCreateInput) {
  return prisma.certification.create({ data });
}

export function attachCertification(productId: string, certificationId: string) {
  return prisma.product.update({
    where: { id: productId },
    data: { certifications: { connect: { id: certificationId } } },
  });
}

export function listProductCertifications(productId: string) {
  return prisma.certification.findMany({
    where: { products: { some: { id: productId } } },
  });
}

export function createBundle(data: Prisma.ProductBundleCreateInput) {
  return prisma.productBundle.create({ data });
}

export function addBundleItem(data: Prisma.BundleItemCreateInput) {
  return prisma.bundleItem.create({ data });
}

export function getBundleWithItems(productId: string) {
  return prisma.productBundle.findUnique({
    where: { productId },
    include: { items: { include: { componentProduct: true } } },
  });
}

export interface ProductListingFilters {
  categoryIds?: string[];
  collectionId?: string;
  allergenNamesToExclude?: string[];
  certificationIds?: string[];
  brandSlugs?: string[];
  inStock?: boolean;
  excludeProductId?: string;
  take?: number;
}

function buildProductListingWhere(filters: ProductListingFilters): Prisma.ProductWhereInput {
  return {
    status: "Published",
    ...(filters.excludeProductId ? { id: { not: filters.excludeProductId } } : {}),
    ...(filters.categoryIds?.length
      ? { categories: { some: { id: { in: filters.categoryIds } } } }
      : {}),
    ...(filters.collectionId ? { collections: { some: { id: filters.collectionId } } } : {}),
    ...(filters.allergenNamesToExclude?.length
      ? { allergens: { none: { name: { in: filters.allergenNamesToExclude } } } }
      : {}),
    ...(filters.certificationIds?.length
      ? { certifications: { some: { id: { in: filters.certificationIds } } } }
      : {}),
    ...(filters.brandSlugs?.length ? { brand: { slug: { in: filters.brandSlugs } } } : {}),
    ...(filters.inStock !== undefined ? { inStock: filters.inStock } : {}),
  };
}

export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
    take: filters.take,
    where: buildProductListingWhere(filters),
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
    // Deterministic ordering matches listProducts's "newest" default sort
    // (see product.service.ts's sortCandidates) — without this, Postgres
    // returns rows in unspecified order and callers that don't apply their
    // own sort (e.g. listRelatedProducts) would see results shuffle
    // between requests.
    orderBy: { publishedAt: "desc" },
  });
}

// Same relational filter shape as findPublishedProductsForListing, applied
// to a pre-computed id set instead of a fresh catalogue-wide query — used
// by search.service.ts's searchProducts()/getSearchSuggestions() (STORY-012)
// after search.repository.ts's raw-SQL ranking query has already narrowed
// down candidate ids. No orderBy: callers re-sort by rank order themselves.
export function findProductsByIdsWithFilters(
  ids: string[],
  filters: Pick<ProductListingFilters, "allergenNamesToExclude" | "certificationIds" | "brandSlugs" | "inStock">,
) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { ...buildProductListingWhere(filters), id: { in: ids } },
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });
}

export function findProductsForCompareByIds(ids: string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.product.findMany({
    where: { id: { in: ids }, status: "Published" },
    include: {
      brand: true,
      nutrition: true,
      ingredients: { orderBy: { sortOrder: "asc" } },
      allergens: true,
      certifications: true,
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
    },
  });
}

/** STORY-039. Dashboard's Low Stock Alerts widget — Published products only; a Draft/Archived product's stock isn't actionable inventory. */
export function countLowStockProducts(threshold: number) {
  return prisma.product.count({ where: { status: "Published", stockQuantity: { lte: threshold } } });
}

export function listAllergens() {
  return prisma.allergen.findMany({ orderBy: { name: "asc" } });
}

export function listCertifications() {
  return prisma.certification.findMany({ orderBy: { name: "asc" } });
}

// --- Admin CRUD (STORY-040) ---

const adminDetailInclude = {
  brand: true,
  categories: true,
  collections: true,
  images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
  videos: { orderBy: { sortOrder: "asc" } },
  nutrition: true,
  ingredients: { orderBy: { sortOrder: "asc" } },
  allergens: true,
  certifications: true,
  bundle: { include: { items: true } },
  standardPrices: { orderBy: { createdAt: "desc" }, take: 1 },
  salePrices: { orderBy: { createdAt: "desc" } },
  campaignPrices: { orderBy: { createdAt: "desc" } },
  customerGroupPrices: true,
  volumeDiscountTiers: { orderBy: { minQuantity: "asc" } },
} satisfies Prisma.ProductInclude;

export type ProductAdminDetail = Prisma.ProductGetPayload<{ include: typeof adminDetailInclude }>;

/** The edit form's GET — every field group in one query. */
export function findProductAdminDetailById(id: string): Promise<ProductAdminDetail | null> {
  return prisma.product.findUnique({ where: { id }, include: adminDetailInclude });
}

/**
 * `data` is assembled by product-admin.service.ts, including any nested
 * writes (images/videos/nutrition/ingredients create, allergens/
 * certifications/categories/collections connect) — this function is a thin
 * wrapper, matching this file's own createProduct/pricing.repository.ts's
 * createXxx convention of taking a raw Prisma *CreateInput directly, unlike
 * order.repository.ts's custom-shaped inputs (which exist because order
 * creation has real multi-step transactional logic; a product create/update
 * does not).
 */
export function createProductAdmin(data: Prisma.ProductCreateInput): Promise<ProductAdminDetail> {
  return prisma.product.create({ data, include: adminDetailInclude });
}

export function updateProductAdmin(id: string, data: Prisma.ProductUpdateInput): Promise<ProductAdminDetail> {
  return prisma.product.update({ where: { id }, data, include: adminDetailInclude });
}

export function deleteProductById(id: string) {
  return prisma.product.delete({ where: { id } });
}

export function updateProductStatus(id: string, status: ProductStatus, publishedAt: Date | null) {
  return prisma.product.update({ where: { id }, data: { status, publishedAt } });
}

export interface AdminProductListFilters {
  status?: ProductStatus;
  categoryId?: string;
  stockLevel?: "in_stock" | "low_stock" | "out_of_stock";
  /** Matches name, SKU, or barcode (case-insensitive substring). */
  search?: string;
}

export interface AdminProductListRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  status: ProductStatus;
  inStock: boolean;
  stockQuantity: number;
  updatedAt: Date;
  brand: { name: string } | null;
  categories: { name: string }[];
  images: { url: string; altText: string | null }[];
  standardPrices: { price: Prisma.Decimal; currency: string }[];
}

function buildAdminListWhere(filters: AdminProductListFilters, lowStockThreshold: number): Prisma.ProductWhereInput {
  const stockWhere: Prisma.ProductWhereInput | undefined =
    filters.stockLevel === "out_of_stock"
      ? { OR: [{ inStock: false }, { stockQuantity: { lte: 0 } }] }
      : filters.stockLevel === "low_stock"
        ? { inStock: true, stockQuantity: { gt: 0, lte: lowStockThreshold } }
        : filters.stockLevel === "in_stock"
          ? { inStock: true, stockQuantity: { gt: lowStockThreshold } }
          : undefined;

  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categories: { some: { id: filters.categoryId } } } : {}),
    ...(stockWhere ?? {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } },
            { sku: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } },
            { barcode: { contains: escapeLikePattern(filters.search), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

export async function listProductsForAdmin(
  filters: AdminProductListFilters,
  page: number,
  pageSize: number,
  lowStockThreshold: number,
): Promise<{ items: AdminProductListRow[]; total: number }> {
  const where = buildAdminListWhere(filters, lowStockThreshold);
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        slug: true,
        name: true,
        status: true,
        inStock: true,
        stockQuantity: true,
        updatedAt: true,
        brand: { select: { name: true } },
        categories: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true, altText: true } },
        standardPrices: { orderBy: { createdAt: "desc" }, take: 1, select: { price: true, currency: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

/** Reads the full detail row a duplicate copies from — product-admin.service.ts decides what to carry over (never pricing). */
export function findProductForDuplication(id: string) {
  return prisma.product.findUnique({ where: { id }, include: adminDetailInclude });
}
