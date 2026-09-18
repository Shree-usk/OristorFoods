import { prisma } from "@/lib/db";
import type { Prisma, ProductStatus } from "@/generated/prisma/client";

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

export function findProductDetailBySlug(slug: string) {
  return prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      categories: true,
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
}

export function findPublishedProductsForListing(filters: ProductListingFilters) {
  return prisma.product.findMany({
    where: {
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
    },
    include: {
      brand: true,
      images: { where: { isPrimary: true }, take: 1 },
    },
  });
}

export function listAllergens() {
  return prisma.allergen.findMany({ orderBy: { name: "asc" } });
}

export function listCertifications() {
  return prisma.certification.findMany({ orderBy: { name: "asc" } });
}
