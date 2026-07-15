import { prisma } from "../src/lib/db";
import * as brandRepository from "../src/repositories/brand.repository";
import * as categoryRepository from "../src/repositories/category.repository";
import * as collectionRepository from "../src/repositories/collection.repository";
import * as productRepository from "../src/repositories/product.repository";
import * as pricingRepository from "../src/repositories/pricing.repository";

async function main() {
  const brand = await brandRepository.createBrand({
    name: "Oristor",
    slug: "oristor",
    description: "Premium Sri Lankan spices and food products.",
  });

  const spices = await categoryRepository.createCategory({
    name: "Spices & Curry Powders",
    slug: "spices-curry-powders",
  });
  const giftSets = await categoryRepository.createCategory({
    name: "Gift Sets",
    slug: "gift-sets",
  });

  const avurudu = await collectionRepository.createCollection({
    name: "Avurudu 2026",
    slug: "avurudu-2026",
    status: "Active",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-04-30"),
  });

  const curryPowder = await productRepository.createProduct({
    sku: "ORI-CP-100",
    slug: "roasted-curry-powder-100g",
    name: "Roasted Curry Powder 100g",
    shortDescription: "Our signature roasted curry powder blend.",
    story: "Roasted in small batches using a recipe passed down for three generations.",
    status: "Published",
    productType: "Standard",
    publishedAt: new Date(),
    rewardPoints: 10,
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: spices.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: curryPowder.id } },
    price: "550.00",
  });
  await pricingRepository.createSalePrice({
    product: { connect: { id: curryPowder.id } },
    price: "495.00",
    startDate: new Date("2026-07-01"),
    endDate: new Date("2026-07-31"),
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Wholesale",
    price: "450.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Distributor",
    price: "420.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "Export",
    price: "480.00",
  });
  await pricingRepository.createCustomerGroupPrice({
    product: { connect: { id: curryPowder.id } },
    customerGroup: "PrivateLabel",
    price: "410.00",
  });
  await pricingRepository.createVolumeDiscountTier({
    product: { connect: { id: curryPowder.id } },
    minQuantity: 24,
    discountPercent: "12.00",
  });
  await productRepository.setProductNutrition({
    product: { connect: { id: curryPowder.id } },
    servingSize: "1 tsp (5g)",
    calories: "18.00",
    protein: "0.80",
    fat: "0.70",
    saturatedFat: "0.10",
    carbohydrates: "2.50",
    sugar: "0.30",
    fibre: "1.10",
    sodium: "2.00",
  });
  await productRepository.addProductIngredient({
    product: { connect: { id: curryPowder.id } },
    name: "Coriander",
    sortOrder: 1,
  });
  await productRepository.addProductIngredient({
    product: { connect: { id: curryPowder.id } },
    name: "Cumin",
    sortOrder: 2,
  });
  await productRepository.addProductImage({
    product: { connect: { id: curryPowder.id } },
    url: "/images/products/roasted-curry-powder-100g.jpg",
    isPrimary: true,
    sortOrder: 1,
  });

  const chilliPowder = await productRepository.createProduct({
    sku: "ORI-CHP-100",
    slug: "chilli-powder-100g",
    name: "Chilli Powder 100g",
    status: "Published",
    productType: "Standard",
    publishedAt: new Date(),
    rewardPoints: 8,
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: spices.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: chilliPowder.id } },
    price: "480.00",
  });

  const giftSet = await productRepository.createProduct({
    sku: "ORI-GIFT-001",
    slug: "curry-lovers-gift-set",
    name: "Curry Lover's Gift Set",
    status: "Published",
    productType: "Bundle",
    publishedAt: new Date(),
    rewardPoints: 25,
    brand: { connect: { id: brand.id } },
    categories: { connect: [{ id: giftSets.id }] },
  });
  const bundle = await productRepository.createBundle({
    product: { connect: { id: giftSet.id } },
    priceOverride: "1200.00",
  });
  await productRepository.addBundleItem({
    bundle: { connect: { id: bundle.id } },
    componentProduct: { connect: { id: curryPowder.id } },
    quantity: 2,
  });
  await productRepository.addBundleItem({
    bundle: { connect: { id: bundle.id } },
    componentProduct: { connect: { id: chilliPowder.id } },
    quantity: 1,
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: giftSet.id } },
    price: "1200.00",
  });

  const seasonalSweets = await productRepository.createProduct({
    sku: "ORI-AVU-001",
    slug: "avurudu-sweets-pack",
    name: "Avurudu Traditional Sweets Pack",
    status: "Published",
    productType: "Seasonal",
    publishedAt: new Date(),
    rewardPoints: 15,
    brand: { connect: { id: brand.id } },
    collections: { connect: [{ id: avurudu.id }] },
  });
  await pricingRepository.createStandardPrice({
    product: { connect: { id: seasonalSweets.id } },
    price: "1500.00",
  });
  await pricingRepository.createCampaignPrice({
    product: { connect: { id: seasonalSweets.id } },
    campaignId: "avurudu-2026-launch",
    price: "1350.00",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2026-04-15"),
  });

  console.log("Seed complete:", {
    brand: brand.slug,
    categories: [spices.slug, giftSets.slug],
    collection: avurudu.slug,
    products: [curryPowder.slug, chilliPowder.slug, giftSet.slug, seasonalSweets.slug],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
