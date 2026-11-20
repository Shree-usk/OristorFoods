import { perfectMatchDefaults } from "@/lib/fixtures/home-fixtures";
import * as perfectMatchRepository from "@/repositories/perfect-match.repository";
import type { PerfectMatchData, PerfectMatchPairingData, PerfectMatchProductData } from "@/types/home";

// --- Storefront (public, no permission gate) ---

/**
 * Resolves the homepage "Perfect Match" section: per-field "never blank"
 * intro copy merge (same pattern as getExportHeroForStorefront), plus the
 * ordered list of Published products with their Published pairings
 * attached. A product whose underlying catalogue Product is no longer
 * Published is dropped here, same "frontend only shows published and
 * active content" rule every other admin-linked storefront section in
 * this codebase follows (e.g. product.service.ts::getProductsByIds).
 */
export async function getPerfectMatchForStorefront(): Promise<PerfectMatchData> {
  const [setting, rows] = await Promise.all([
    perfectMatchRepository.getPerfectMatchSetting(),
    perfectMatchRepository.listPublishedPerfectMatchProducts(),
  ]);

  const products: PerfectMatchProductData[] = rows.filter((row) => row.product.status === "Published").map(toProductData);

  return {
    eyebrow: setting?.eyebrow ?? perfectMatchDefaults.eyebrow,
    heading: setting?.heading ?? perfectMatchDefaults.heading,
    description: setting?.description ?? perfectMatchDefaults.description,
    products,
  };
}

function toProductData(row: Awaited<ReturnType<typeof perfectMatchRepository.listPublishedPerfectMatchProducts>>[number]): PerfectMatchProductData {
  const image = row.product.images[0];
  return {
    id: row.id,
    productId: row.productId,
    name: row.product.name,
    tabLabel: row.tabLabel ?? row.product.name,
    href: `/products/${row.product.slug}`,
    kicker: row.kicker,
    description: row.promoDescriptionOverride ?? row.product.shortDescription ?? "",
    imageSrc: image?.url ?? null,
    imageAlt: image?.altText ?? row.product.name,
    pairings: row.pairings.map(toPairingData),
  };
}

function toPairingData(pairing: Awaited<ReturnType<typeof perfectMatchRepository.listPublishedPerfectMatchProducts>>[number]["pairings"][number]): PerfectMatchPairingData {
  return {
    id: pairing.id,
    title: pairing.title,
    description: pairing.description,
    imageSrc: pairing.imageUrl,
    imageAlt: pairing.imageAlt ?? pairing.title,
    categoryLabel: pairing.categoryLabel,
    supportingTag: pairing.supportingTag,
  };
}
