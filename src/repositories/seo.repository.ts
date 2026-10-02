import type { SeoEntityType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-051a. The only place SeoMeta is queried/mutated. Polymorphic via (entityType, entityId) — see schema.prisma's own comment for why this isn't a typed Prisma relation. */

export function findSeoMeta(entityType: SeoEntityType, entityId: string) {
  return prisma.seoMeta.findUnique({ where: { entityType_entityId: { entityType, entityId } } });
}

export interface SeoMetaInput {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  focusKeyword: string | null;
}

/** A row may not exist yet (an entity created before this story, or any entity whose SEO fields were never explicitly saved) — real upsert on the (entityType, entityId) unique key, not a create-or-404. */
export function upsertSeoMeta(entityType: SeoEntityType, entityId: string, input: SeoMetaInput) {
  return prisma.seoMeta.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { entityType, entityId, ...input },
    update: { ...input },
  });
}
