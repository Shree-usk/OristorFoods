import { prisma } from "@/lib/db";

export interface RankedProductMatch {
  productId: string;
  rankTier: number; // 4=exact name, 3=prefix, 2=fuzzy/contains, 1=other-field-only
  similarity: number;
}

/**
 * Ranked product search via pg_trgm (STORY-012). Returns ids and rank info
 * only — never full product rows — so relational filters (allergens,
 * certifications, brands, inStock) stay in product.repository.ts's
 * existing Prisma-based filter shape instead of being hand-joined into
 * raw SQL here. See docs/superpowers/specs/2026-09-20-product-search-discovery-design.md.
 */
export async function findRankedProductMatches(query: string): Promise<RankedProductMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return prisma.$queryRaw<RankedProductMatch[]>`
    WITH matches AS (
      SELECT
        p.id AS "productId",
        CASE
          WHEN lower(p.name) = lower(${trimmed}) THEN 4
          WHEN lower(p.name) LIKE lower(${trimmed}) || '%' THEN 3
          WHEN lower(p.name) LIKE '%' || lower(${trimmed}) || '%'
            OR similarity(p.name, ${trimmed}) > 0.3
          THEN 2
          WHEN
            p."shortDescription" ILIKE '%' || ${trimmed} || '%'
            OR p.story ILIKE '%' || ${trimmed} || '%'
            OR p.sku ILIKE '%' || ${trimmed} || '%'
            OR EXISTS (
              SELECT 1 FROM "ProductIngredient" pi
              WHERE pi."productId" = p.id AND pi.name ILIKE '%' || ${trimmed} || '%'
            )
            OR EXISTS (
              SELECT 1 FROM "_CategoryToProduct" ctp
              JOIN "Category" c ON c.id = ctp."A"
              WHERE ctp."B" = p.id AND c.name ILIKE '%' || ${trimmed} || '%'
            )
            OR EXISTS (
              SELECT 1 FROM "_CollectionToProduct" cop
              JOIN "Collection" col ON col.id = cop."A"
              WHERE cop."B" = p.id AND col.name ILIKE '%' || ${trimmed} || '%'
            )
          THEN 1
          ELSE 0
        END AS "rankTier",
        similarity(p.name, ${trimmed}) AS similarity
      FROM "Product" p
      WHERE p.status = 'Published'
    )
    SELECT "productId", "rankTier", similarity
    FROM matches
    WHERE "rankTier" > 0
    ORDER BY "rankTier" DESC, similarity DESC, "productId" ASC
  `;
}

/**
 * Trigram similarity lookup against Published product names and Active
 * category names, for the "did you mean" empty-search-result state
 * (STORY-012). Returns a display name to re-run a corrected search with,
 * not an id/href — a bad suggestion just yields another empty state
 * instead of a broken link.
 */
export async function findClosestNameSuggestion(query: string): Promise<string | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const rows = await prisma.$queryRaw<{ name: string; similarity: number }[]>`
    SELECT name, similarity(name, ${trimmed}) AS similarity
    FROM (
      SELECT name FROM "Product" WHERE status = 'Published'
      UNION ALL
      SELECT name FROM "Category" WHERE status = 'Active'
    ) AS names
    WHERE similarity(name, ${trimmed}) > 0.3
    ORDER BY similarity DESC
    LIMIT 1
  `;

  return rows[0]?.name ?? null;
}
