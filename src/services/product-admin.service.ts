import { Prisma, type CustomerGroup, type MediaRole, type ProductStatus, type ProductType } from "@/generated/prisma/client";
import * as brandRepository from "@/repositories/brand.repository";
import * as categoryRepository from "@/repositories/category.repository";
import * as collectionRepository from "@/repositories/collection.repository";
import * as pricingRepository from "@/repositories/pricing.repository";
import * as productRepository from "@/repositories/product.repository";
import type { AdminProductListFilters, ProductAdminDetail } from "@/repositories/product.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { refreshProductEmbeddingBestEffort } from "@/services/embedding.service";
import { requirePermission } from "@/services/permission.service";
import { getLowStockThreshold } from "@/services/system-settings.service";
import {
  ProductAdminIllegalTransitionError,
  ProductAdminNotFoundError,
  ProductAdminSkuConflictError,
  ProductAdminSlugConflictError,
} from "@/services/product-admin.errors";

/**
 * The admin write path for the `Product` model STORY-009 built for the
 * storefront. Every mutating function here requires `Products:Edit` (or
 * `:Delete` for hard deletes) and writes an audit-log entry — the same
 * "permission check + audit log, always" shape every admin module follows
 * (`.claude/skills/admin-console-module/SKILL.md`).
 */

export interface ProductImageInput {
  url: string;
  altText?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
  mediaRole?: MediaRole;
}

export interface ProductVideoInput {
  url: string;
  altText?: string | null;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface ProductNutritionInput {
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

export interface ProductIngredientInput {
  name: string;
  isAllergen?: boolean;
  sortOrder?: number;
}

export interface ProductAdminInput {
  name: string;
  slug: string;
  sku: string;
  barcode?: string | null;
  shortDescription?: string | null;
  story?: string | null;
  productType?: ProductType;
  brandId?: string | null;
  categoryIds: string[];
  collectionIds?: string[];
  benefits?: string[];
  servingSuggestions?: string[];
  rewardPoints?: number;
  inStock?: boolean;
  stockQuantity?: number;
  weightGrams?: number | null;
  images: ProductImageInput[];
  videos?: ProductVideoInput[];
  nutrition: ProductNutritionInput;
  ingredients?: ProductIngredientInput[];
  allergenIds?: string[];
  certificationIds?: string[];
}

function isUniqueConstraintViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * The `@prisma/adapter-pg` driver reports a P2002's violated column(s) under
 * `meta.driverAdapterError.cause.constraint.fields` (verified against this
 * project's actual adapter — NOT the classic `meta.target` shape Prisma's
 * own docs describe for the built-in query engine), so both are checked.
 */
function conflictField(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const meta = error.meta as { target?: unknown; driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } } | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields) && typeof adapterFields[0] === "string") return adapterFields[0];

  const target = meta?.target;
  if (Array.isArray(target)) return target[0] as string;
  if (typeof target === "string") return target;
  return undefined;
}

function mapWriteError(error: unknown, input: Pick<ProductAdminInput, "slug" | "sku">): never {
  if (isUniqueConstraintViolation(error)) {
    const field = conflictField(error);
    if (field === "slug") throw new ProductAdminSlugConflictError(input.slug);
    if (field === "sku") throw new ProductAdminSkuConflictError(input.sku);
  }
  throw error;
}

function toImageCreate(image: ProductImageInput, index: number): Prisma.ProductImageCreateWithoutProductInput {
  return {
    url: image.url,
    altText: image.altText ?? null,
    isPrimary: image.isPrimary ?? index === 0,
    sortOrder: image.sortOrder ?? index,
    mediaRole: image.mediaRole ?? "Gallery",
  };
}

function toVideoCreate(video: ProductVideoInput, index: number): Prisma.ProductVideoCreateWithoutProductInput {
  return {
    url: video.url,
    altText: video.altText ?? null,
    isPrimary: video.isPrimary ?? false,
    sortOrder: video.sortOrder ?? index,
    mediaRole: "Video",
  };
}

function toNutritionCreate(nutrition: ProductNutritionInput): Prisma.ProductNutritionCreateWithoutProductInput {
  return { ...nutrition };
}

function toIngredientCreate(ingredient: ProductIngredientInput, index: number): Prisma.ProductIngredientCreateWithoutProductInput {
  return { name: ingredient.name, isAllergen: ingredient.isAllergen ?? false, sortOrder: ingredient.sortOrder ?? index };
}

function scalarFields(input: ProductAdminInput) {
  return {
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    barcode: input.barcode ?? null,
    shortDescription: input.shortDescription ?? null,
    story: input.story ?? null,
    productType: input.productType ?? "Standard",
    benefits: input.benefits ?? [],
    servingSuggestions: input.servingSuggestions ?? [],
    rewardPoints: input.rewardPoints ?? 0,
    inStock: input.inStock ?? true,
    stockQuantity: input.stockQuantity ?? 0,
    weightGrams: input.weightGrams ?? null,
  };
}

/** Feeds the product form's category/brand/collection/allergen/certification pickers — one call, no per-field round trip. */
export async function getProductFormReferenceData(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  const [categories, brands, collections, allergens, certifications] = await Promise.all([
    categoryRepository.listAllCategories(),
    brandRepository.listBrands(),
    collectionRepository.listActiveCollections(),
    productRepository.listAllergens(),
    productRepository.listCertifications(),
  ]);
  return { categories, brands, collections, allergens, certifications };
}

export async function listProductsForAdmin(adminUserId: string, filters: AdminProductListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Products", "View");
  const lowStockThreshold = await getLowStockThreshold();
  return productRepository.listProductsForAdmin(filters, page, pageSize, lowStockThreshold);
}

export async function getProductForAdmin(adminUserId: string, id: string): Promise<ProductAdminDetail> {
  await requirePermission(adminUserId, "Products", "View");
  const product = await productRepository.findProductAdminDetailById(id);
  if (!product) throw new ProductAdminNotFoundError();
  return product;
}

export async function createProduct(adminUserId: string, input: ProductAdminInput): Promise<ProductAdminDetail> {
  await requirePermission(adminUserId, "Products", "Edit");

  const data: Prisma.ProductCreateInput = {
    ...scalarFields(input),
    brand: input.brandId ? { connect: { id: input.brandId } } : undefined,
    categories: input.categoryIds.length ? { connect: input.categoryIds.map((id) => ({ id })) } : undefined,
    collections: input.collectionIds?.length ? { connect: input.collectionIds.map((id) => ({ id })) } : undefined,
    images: input.images.length ? { create: input.images.map(toImageCreate) } : undefined,
    videos: input.videos?.length ? { create: input.videos.map(toVideoCreate) } : undefined,
    nutrition: { create: toNutritionCreate(input.nutrition) },
    ingredients: input.ingredients?.length ? { create: input.ingredients.map(toIngredientCreate) } : undefined,
    allergens: input.allergenIds?.length ? { connect: input.allergenIds.map((id) => ({ id })) } : undefined,
    certifications: input.certificationIds?.length ? { connect: input.certificationIds.map((id) => ({ id })) } : undefined,
    createdBy: { connect: { id: adminUserId } },
    updatedBy: { connect: { id: adminUserId } },
  };

  try {
    const created = await productRepository.createProductAdmin(data);
    await writeAuditLog({ actorId: adminUserId, action: "product_created", module: "Products", targetType: "Product", targetId: created.id });
    // STORY-061. Best-effort — never blocks this mutation; no-ops internally for a non-Published product.
    void refreshProductEmbeddingBestEffort(created.id);
    return created;
  } catch (error) {
    mapWriteError(error, input);
  }
}

export async function updateProduct(adminUserId: string, id: string, input: ProductAdminInput): Promise<ProductAdminDetail> {
  await requirePermission(adminUserId, "Products", "Edit");

  const existing = await productRepository.findProductAdminDetailById(id);
  if (!existing) throw new ProductAdminNotFoundError();

  const data: Prisma.ProductUpdateInput = {
    ...scalarFields(input),
    brand: input.brandId ? { connect: { id: input.brandId } } : { disconnect: true },
    categories: { set: input.categoryIds.map((categoryId) => ({ id: categoryId })) },
    collections: { set: (input.collectionIds ?? []).map((collectionId) => ({ id: collectionId })) },
    // Wholesale replace — the form edits every image/video/ingredient row at
    // once, never a single row in isolation, so a diffing update would add
    // complexity for no real benefit here (unlike e.g. Order, which has real
    // incremental transactional writes).
    images: { deleteMany: {}, create: input.images.map(toImageCreate) },
    videos: { deleteMany: {}, create: (input.videos ?? []).map(toVideoCreate) },
    nutrition: { upsert: { create: toNutritionCreate(input.nutrition), update: toNutritionCreate(input.nutrition) } },
    ingredients: { deleteMany: {}, create: (input.ingredients ?? []).map(toIngredientCreate) },
    allergens: { set: (input.allergenIds ?? []).map((allergenId) => ({ id: allergenId })) },
    certifications: { set: (input.certificationIds ?? []).map((certificationId) => ({ id: certificationId })) },
    updatedBy: { connect: { id: adminUserId } },
  };

  try {
    const updated = await productRepository.updateProductAdmin(id, data);
    await writeAuditLog({ actorId: adminUserId, action: "product_updated", module: "Products", targetType: "Product", targetId: id });
    // STORY-061. Best-effort — never blocks this mutation; no-ops internally for a non-Published product.
    void refreshProductEmbeddingBestEffort(id);
    return updated;
  } catch (error) {
    mapWriteError(error, input);
  }
}

/**
 * Clones every content field (images/videos/nutrition/ingredients/
 * allergens/certifications/bundle) into a new Draft product under the
 * caller-supplied slug/SKU — never auto-generated, so the admin must
 * deliberately choose both (AC). Deliberately never copies pricing: a
 * cloned product starting silently priced the same as its source risks an
 * unnoticed wrong price going live; the admin must set pricing explicitly
 * on the duplicate.
 */
export async function duplicateProduct(adminUserId: string, id: string, newSlug: string, newSku: string): Promise<ProductAdminDetail> {
  await requirePermission(adminUserId, "Products", "Edit");

  const source = await productRepository.findProductForDuplication(id);
  if (!source) throw new ProductAdminNotFoundError();

  const data: Prisma.ProductCreateInput = {
    name: `${source.name} (Copy)`,
    slug: newSlug,
    sku: newSku,
    barcode: null,
    shortDescription: source.shortDescription,
    story: source.story,
    productType: source.productType,
    benefits: source.benefits,
    servingSuggestions: source.servingSuggestions,
    rewardPoints: source.rewardPoints,
    inStock: source.inStock,
    stockQuantity: source.stockQuantity,
    weightGrams: source.weightGrams,
    brand: source.brand ? { connect: { id: source.brand.id } } : undefined,
    categories: source.categories.length ? { connect: source.categories.map((category) => ({ id: category.id })) } : undefined,
    collections: source.collections.length ? { connect: source.collections.map((collection) => ({ id: collection.id })) } : undefined,
    images: source.images.length
      ? { create: source.images.map((image) => ({ url: image.url, altText: image.altText, isPrimary: image.isPrimary, sortOrder: image.sortOrder, mediaRole: image.mediaRole })) }
      : undefined,
    videos: source.videos.length
      ? { create: source.videos.map((video) => ({ url: video.url, altText: video.altText, isPrimary: video.isPrimary, sortOrder: video.sortOrder, mediaRole: video.mediaRole })) }
      : undefined,
    nutrition: source.nutrition
      ? {
          create: {
            servingSize: source.nutrition.servingSize,
            calories: source.nutrition.calories,
            protein: source.nutrition.protein,
            fat: source.nutrition.fat,
            saturatedFat: source.nutrition.saturatedFat,
            carbohydrates: source.nutrition.carbohydrates,
            sugar: source.nutrition.sugar,
            fibre: source.nutrition.fibre,
            sodium: source.nutrition.sodium,
          },
        }
      : undefined,
    ingredients: source.ingredients.length
      ? { create: source.ingredients.map((ingredient) => ({ name: ingredient.name, isAllergen: ingredient.isAllergen, sortOrder: ingredient.sortOrder })) }
      : undefined,
    allergens: source.allergens.length ? { connect: source.allergens.map((allergen) => ({ id: allergen.id })) } : undefined,
    certifications: source.certifications.length ? { connect: source.certifications.map((certification) => ({ id: certification.id })) } : undefined,
    bundle: source.bundle
      ? {
          create: {
            priceOverride: source.bundle.priceOverride,
            items: { create: source.bundle.items.map((item) => ({ componentProductId: item.componentProductId, quantity: item.quantity })) },
          },
        }
      : undefined,
    createdBy: { connect: { id: adminUserId } },
    updatedBy: { connect: { id: adminUserId } },
  };

  try {
    const duplicate = await productRepository.createProductAdmin(data);
    await writeAuditLog({
      actorId: adminUserId,
      action: "product_duplicated",
      module: "Products",
      targetType: "Product",
      targetId: duplicate.id,
      metadata: { sourceProductId: id },
    });
    return duplicate;
  } catch (error) {
    mapWriteError(error, { slug: newSlug, sku: newSku });
  }
}

/**
 * Draft/Published/Archived, but a real admin needs more than the AC's
 * literal linear "Draft → Published → Archived" wording: discarding a
 * draft without ever publishing it, and reopening an archived product for
 * further edits before republishing. This whitelist is the documented
 * clarification — see docs/architecture-decisions.md.
 */
const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  Draft: ["Published", "Archived"],
  Published: ["Archived"],
  Archived: ["Draft", "Published"],
  // Discontinued/OutOfSeason/Review exist on the enum for future stories'
  // use (STORY-009's own scope) but aren't reachable through this story's
  // transition set.
  Discontinued: [],
  OutOfSeason: [],
  Review: [],
};

export async function changeProductStatus(adminUserId: string, id: string, status: ProductStatus): Promise<ProductAdminDetail> {
  await requirePermission(adminUserId, "Products", "Edit");

  const product = await productRepository.findProductAdminDetailById(id);
  if (!product) throw new ProductAdminNotFoundError();
  if (!ALLOWED_TRANSITIONS[product.status].includes(status)) {
    throw new ProductAdminIllegalTransitionError(product.status, status);
  }

  const publishedAt = status === "Published" ? new Date() : product.publishedAt;
  await productRepository.updateProductStatus(id, status, publishedAt);
  await writeAuditLog({
    actorId: adminUserId,
    action: "product_status_changed",
    module: "Products",
    targetType: "Product",
    targetId: id,
    metadata: { from: product.status, to: status },
  });

  const updated = await productRepository.findProductAdminDetailById(id);
  if (!updated) throw new ProductAdminNotFoundError();
  return updated;
}

export interface BulkStatusResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

/**
 * A heterogeneous selection (some already Archived, some not) shouldn't
 * abort the whole batch on the first illegal transition — each id is
 * attempted independently and the caller gets a per-row result, mirroring
 * the "no partial/silent failures, but no all-or-nothing either" shape a
 * bulk toolbar action needs (distinct from bulk CSV import's stricter
 * all-or-nothing contract, deferred to a follow-up).
 */
export async function bulkChangeStatus(adminUserId: string, ids: string[], status: ProductStatus): Promise<BulkStatusResult> {
  await requirePermission(adminUserId, "Products", "Edit");

  const result: BulkStatusResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      await changeProductStatus(adminUserId, id, status);
      result.succeeded.push(id);
    } catch (error) {
      const reason = error instanceof ProductAdminNotFoundError ? "not_found" : error instanceof ProductAdminIllegalTransitionError ? "illegal_transition" : "error";
      result.failed.push({ id, reason });
    }
  }
  return result;
}

export async function deleteProduct(adminUserId: string, id: string): Promise<void> {
  await requirePermission(adminUserId, "Products", "Delete");
  const product = await productRepository.findProductAdminDetailById(id);
  if (!product) throw new ProductAdminNotFoundError();
  await productRepository.deleteProductById(id);
  await writeAuditLog({ actorId: adminUserId, action: "product_deleted", module: "Products", targetType: "Product", targetId: id });
}

export async function bulkDelete(adminUserId: string, ids: string[]): Promise<BulkStatusResult> {
  await requirePermission(adminUserId, "Products", "Delete");
  const result: BulkStatusResult = { succeeded: [], failed: [] };
  for (const id of ids) {
    try {
      await deleteProduct(adminUserId, id);
      result.succeeded.push(id);
    } catch {
      result.failed.push({ id, reason: "error" });
    }
  }
  return result;
}

// --- Pricing (STORY-040) ---
// Each function guards Products:Edit independently — the pricing tab's
// mutations are separate calls from the main product save (see
// docs/architecture-decisions.md for why pricing isn't bundled into
// createProduct/updateProduct's payload).

export async function setStandardPrice(adminUserId: string, productId: string, price: number, currency: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  const result = await pricingRepository.createStandardPrice({ product: { connect: { id: productId } }, price, currency });
  await writeAuditLog({ actorId: adminUserId, action: "product_price_set", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "standard" } });
  return result;
}

export interface SalePriceInput {
  price: number;
  currency: string;
  startDate: Date;
  endDate: Date;
}

export async function upsertSalePrice(adminUserId: string, productId: string, id: string | null, input: SalePriceInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const result = id
    ? await pricingRepository.updateSalePrice(id, input)
    : await pricingRepository.createSalePrice({ product: { connect: { id: productId } }, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "product_price_set", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "sale" } });
  return result;
}

export async function removeSalePrice(adminUserId: string, productId: string, id: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  await pricingRepository.deleteSalePrice(id);
  await writeAuditLog({ actorId: adminUserId, action: "product_price_removed", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "sale" } });
}

export interface CampaignPriceInput {
  campaignId: string;
  price: number;
  currency: string;
  startDate: Date;
  endDate: Date;
}

export async function upsertCampaignPrice(adminUserId: string, productId: string, id: string | null, input: CampaignPriceInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const result = id
    ? await pricingRepository.updateCampaignPrice(id, input)
    : await pricingRepository.createCampaignPrice({ product: { connect: { id: productId } }, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "product_price_set", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "campaign" } });
  return result;
}

export async function removeCampaignPrice(adminUserId: string, productId: string, id: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  await pricingRepository.deleteCampaignPrice(id);
  await writeAuditLog({ actorId: adminUserId, action: "product_price_removed", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "campaign" } });
}

export async function setCustomerGroupPrice(adminUserId: string, productId: string, customerGroup: CustomerGroup, price: number, currency: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  const result = await pricingRepository.upsertCustomerGroupPrice(productId, customerGroup, price, currency);
  await writeAuditLog({
    actorId: adminUserId,
    action: "product_price_set",
    module: "Products",
    targetType: "Product",
    targetId: productId,
    metadata: { tier: "customerGroup", customerGroup },
  });
  return result;
}

export interface VolumeDiscountTierInput {
  minQuantity: number;
  discountPrice?: number | null;
  discountPercent?: number | null;
  currency: string;
}

export async function upsertVolumeDiscountTier(adminUserId: string, productId: string, id: string | null, input: VolumeDiscountTierInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  const result = id
    ? await pricingRepository.updateVolumeDiscountTier(id, input)
    : await pricingRepository.createVolumeDiscountTier({ product: { connect: { id: productId } }, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "product_price_set", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "volumeDiscount" } });
  return result;
}

export async function removeVolumeDiscountTier(adminUserId: string, productId: string, id: string) {
  await requirePermission(adminUserId, "Products", "Edit");
  await pricingRepository.deleteVolumeDiscountTier(id);
  await writeAuditLog({ actorId: adminUserId, action: "product_price_removed", module: "Products", targetType: "Product", targetId: productId, metadata: { tier: "volumeDiscount" } });
}
