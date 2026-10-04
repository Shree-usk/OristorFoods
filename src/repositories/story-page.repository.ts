import type { ContentAlignment, Prisma, StoryBlockType, StoryPage } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-074. The only place StoryPageBlock is queried/mutated. */

export function listBlocksForPage(page: StoryPage) {
  return prisma.storyPageBlock.findMany({ where: { page }, orderBy: [{ blockType: "asc" }, { sortOrder: "asc" }] });
}

export interface StoryPageBlockUpsertInput {
  blockKey: string;
  blockType: StoryBlockType;
  sortOrder: number;
  eyebrow?: string | null;
  title?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
  align?: ContentAlignment | null;
  letter?: string | null;
}

/** Replaces every block of a page in one transaction, upserted by (page, blockKey) — the admin editor saves a whole page's blocks in one submit, never one row at a time. */
export function replaceBlocksForPage(page: StoryPage, blocks: StoryPageBlockUpsertInput[]) {
  return prisma.$transaction(
    blocks.map((block) =>
      prisma.storyPageBlock.upsert({
        where: { page_blockKey: { page, blockKey: block.blockKey } },
        create: { page, ...block },
        update: block,
      } satisfies Prisma.StoryPageBlockUpsertArgs),
    ),
  );
}
