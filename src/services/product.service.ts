import * as productRepository from "@/repositories/product.repository";

export function getProductBySlug(slug: string) {
  return productRepository.findProductBySlug(slug).then((product) => {
    if (!product || product.status !== "Published") return null;
    return product;
  });
}

export function getProductBySlugForAdmin(slug: string) {
  return productRepository.findProductBySlug(slug);
}

export async function listPublishedProductsByCategory(categoryId: string) {
  const products = await productRepository.listProductsByCategory(categoryId);
  return products.filter((product) => product.status === "Published");
}
