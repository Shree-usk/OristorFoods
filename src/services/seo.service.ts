import type { SeoEntityType } from "@/generated/prisma/client";
import * as seoRepository from "@/repositories/seo.repository";
import type { SeoMetaInput } from "@/repositories/seo.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-051a. Per-page SEO fields — a thin CRUD layer over the polymorphic
 * SeoMeta table. No Approve tier: unlike a popup's publish step, saving
 * SEO fields has no distinct "make it live" action beyond the entity's own
 * publish state (same reasoning coupon-admin.service.ts already used for
 * its own plain View/Edit shape).
 */

export async function getSeoMeta(adminUserId: string, entityType: SeoEntityType, entityId: string) {
  await requirePermission(adminUserId, "SEO", "View");
  return seoRepository.findSeoMeta(entityType, entityId);
}

export async function updateSeoMeta(adminUserId: string, entityType: SeoEntityType, entityId: string, input: SeoMetaInput) {
  await requirePermission(adminUserId, "SEO", "Edit");
  const seoMeta = await seoRepository.upsertSeoMeta(entityType, entityId, input);
  await writeAuditLog({ actorId: adminUserId, action: "seo_meta_updated", module: "SEO", targetType: "SeoMeta", targetId: seoMeta.id, metadata: { entityType, entityId } });
  return seoMeta;
}
