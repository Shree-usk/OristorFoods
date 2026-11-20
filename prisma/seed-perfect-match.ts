import { prisma } from "../src/lib/db";
import * as perfectMatchRepository from "../src/repositories/perfect-match.repository";
import * as pricingRepository from "../src/repositories/pricing.repository";
import * as productRepository from "../src/repositories/product.repository";

/**
 * Homepage "The Perfect Match" section — seeds the 4 real confirmed
 * products from the approved brief (`docs/ORISTOR_Perfect_Match_Claude_Implementation_Brief.md`)
 * and prototype (the brief's 5th named product, "Garlic Curry", does not
 * exist in the real catalogue and is deliberately excluded — confirmed
 * with the user, no fictional product gets created).
 *
 * Find-or-create by name, never duplicate: these 4 products exist for
 * real on staging under these exact names, so running this seed there
 * just links the existing rows. Locally they don't exist yet, so this
 * creates real minimal catalogue Product rows for them.
 *
 * Only "Raw Mango Pickle" has a real local packaging photo
 * (public/images/products/misc/Mango-Pickle-Large.webp) — the other
 * three exist only on staging, with no asset anywhere in this repo.
 * Rather than inventing a path or reusing an unrelated product's photo
 * (the brief explicitly forbids fabricating packaging art), they're left
 * imageless; PerfectMatchPanel already renders ImagePlaceholder
 * gracefully for a null product image, and an admin uploads the real
 * photo via that product's own Media tab whenever it's available.
 *
 * No PerfectMatchPairing rows are seeded either, for the same reason one
 * level down: none of the 16 meal-pairing dish photos (rotti, rice,
 * bread, hoppers, etc.) the brief's copy calls for exist in this repo,
 * and PerfectMatchPairing.imageUrl is a required field (unlike the
 * product's own optional image) — confirmed with the user to leave
 * pairings for an admin to add via Stage 3's UI rather than seed a
 * placeholder image. The pairings grid already hides itself gracefully
 * when a product has none (see perfect-match-section.tsx).
 */

interface PerfectMatchProductSeed {
  name: string;
  sku: string;
  slug: string;
  shortDescription: string;
  price: string;
  tabLabel: string;
  kicker: string;
  imageUrl?: string;
  isDefaultFeatured: boolean;
}

const PRODUCTS: PerfectMatchProductSeed[] = [
  {
    name: "Oristor Premium Muringa Thokku",
    sku: "ORI-MUR-200",
    slug: "oristor-premium-muringa-thokku",
    shortDescription:
      "A familiar heritage flavour made to bring warmth and character to everyday meals. Explore the combinations your table will love.",
    price: "650.00",
    tabLabel: "Muringa",
    kicker: "Rooted in Sri Lankan tradition",
    isDefaultFeatured: false,
  },
  {
    name: "Oristor Premium Red Onion Thokku",
    sku: "ORI-ONT-200",
    slug: "oristor-premium-red-onion-thokku",
    shortDescription:
      "Rich onion flavour with a traditional touch. A versatile condiment that turns familiar bites into something worth looking forward to.",
    price: "650.00",
    tabLabel: "Onion Thokku",
    kicker: "Sweet, savoury & full of character",
    isDefaultFeatured: false,
  },
  {
    name: "Oristor Premium Raw Mango Pickle",
    sku: "ORI-MNP-200",
    slug: "oristor-premium-raw-mango-pickle",
    shortDescription: "A bold, tangy favourite that brings a lively spark to the table. A little pickle can make familiar meals feel special.",
    price: "600.00",
    tabLabel: "Mango Pickle",
    kicker: "A taste of heritage",
    imageUrl: "/images/products/misc/Mango-Pickle-Large.webp",
    isDefaultFeatured: true,
  },
  {
    name: "Oristor Premium Seeni Sambol With Maldive Fish",
    sku: "ORI-SSM-200",
    slug: "oristor-premium-seeni-sambol-with-maldive-fish",
    shortDescription:
      "Golden onion richness with a sweet-spicy balance. A familiar favourite that brings a little celebration to everyday meals.",
    price: "700.00",
    tabLabel: "Seeni Sambol",
    kicker: "A much-loved Sri Lankan classic",
    isDefaultFeatured: false,
  },
];

export async function seedPerfectMatch() {
  await perfectMatchRepository.upsertPerfectMatchSetting({
    eyebrow: "A little inspiration from our kitchen",
    heading: "Ordinary Meals. Extraordinary Flavours.",
    description: "Discover how a spoonful of ORISTOR can transform the meals you already love. Choose a favourite and find its perfect match.",
  });

  let linked = 0;
  for (const [index, spec] of PRODUCTS.entries()) {
    let product = await prisma.product.findFirst({ where: { name: spec.name } });
    if (!product) {
      product = await productRepository.createProduct({
        sku: spec.sku,
        slug: spec.slug,
        name: spec.name,
        shortDescription: spec.shortDescription,
        status: "Published",
        productType: "Standard",
        publishedAt: new Date(),
        stockQuantity: 200,
      });
      await pricingRepository.createStandardPrice({ product: { connect: { id: product.id } }, price: spec.price });
      if (spec.imageUrl) {
        await productRepository.addProductImage({ product: { connect: { id: product.id } }, url: spec.imageUrl, isPrimary: true, sortOrder: 1 });
      }
    }

    const existingLink = await perfectMatchRepository.findPerfectMatchProductByProductId(product.id);
    if (!existingLink) {
      await perfectMatchRepository.createPerfectMatchProduct({
        product: { connect: { id: product.id } },
        tabLabel: spec.tabLabel,
        kicker: spec.kicker,
        isDefaultFeatured: spec.isDefaultFeatured,
        status: "Published",
        sortOrder: index,
      });
      linked += 1;
    } else if (!existingLink.tabLabel) {
      // Backfill only — tabLabel didn't exist as a field when earlier runs
      // of this seed created these links, so it's always null here, never
      // a real value an admin already set. Never touches any other field.
      await perfectMatchRepository.updatePerfectMatchProduct(existingLink.id, { tabLabel: spec.tabLabel });
    }
  }

  return { productsLinked: linked };
}
