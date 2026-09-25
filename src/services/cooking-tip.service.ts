import * as cookingTipRepository from "@/repositories/cooking-tip.repository";
import type { CookingTipCardRow, CookingTipDetailRow } from "@/repositories/cooking-tip.repository";
import type { CookingTipCard, CookingTipDetail, CookingTipListResult } from "@/types/cooking-tip";
import type { CookingTipListQuery } from "@/validation/cooking-tip.schema";

function tipHref(slug: string): string {
  return `/recipes/cooking-tips/${slug}`;
}

function toCookingTipCard(row: CookingTipCardRow | CookingTipDetailRow): CookingTipCard {
  return {
    id: row.id,
    slug: row.slug,
    href: tipHref(row.slug),
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    hasVideo: row.videoUrl !== null,
    topicTag: row.topicTag,
  };
}

export async function listCookingTips(query: CookingTipListQuery): Promise<CookingTipListResult> {
  const { page, pageSize, topic } = query;
  const { rows, total } = await cookingTipRepository.findPublishedCookingTips({
    where: topic ? { topicTag: topic } : {},
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { tips: rows.map(toCookingTipCard), total, page, pageSize };
}

export function listCookingTipTopics() {
  return cookingTipRepository.findActiveTopicTagsWithPublishedTips();
}

export async function getCookingTipBySlug(slug: string): Promise<CookingTipDetail | null> {
  const row = await cookingTipRepository.findPublishedCookingTipBySlug(slug);
  if (!row) return null;

  const relatedRows = await cookingTipRepository.findRelatedCookingTips({ id: row.id, topicTag: row.topicTag }, 6);

  return {
    ...toCookingTipCard(row),
    bodyContent: row.bodyContent,
    video: row.videoUrl === null || row.videoProvider === null ? null : { url: row.videoUrl, provider: row.videoProvider },
    relatedTips: relatedRows.map(toCookingTipCard),
    products: row.productRefs.map((ref) => ref.product),
  };
}
