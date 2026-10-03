import type { Prisma } from "@/generated/prisma/client";
import * as customerSegmentRepository from "@/repositories/customer-segment.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import * as savedSegmentRepository from "@/repositories/saved-segment.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { SegmentNotFoundError } from "@/services/crm-segmentation.errors";
import { requirePermission } from "@/services/permission.service";
import type { CreateSegmentInput, SegmentFilterCriteria, UpdateSegmentInput } from "@/validation/crm-segmentation.schema";

/**
 * STORY-059a. CRM Segmentation — permission-gated (CRMAnalytics,
 * View/Edit/Delete; its first real use) and audit-logged. Segments are
 * live, not snapshotted — previewSegment/resolveSegmentMembers both
 * re-run the same filterCustomers() combination against current data,
 * never a frozen member list.
 */

/**
 * SegmentFilterCriteria's date fields are real JS Dates (Zod's
 * z.coerce.date()) — not valid Prisma.InputJsonValue and not what a
 * stored Json column round-trips back as. Serialize to ISO strings at
 * the write boundary, parse back to Date at the read boundary, so
 * filterCustomers() always operates on real Dates regardless of
 * whether criteria came from a live request or a stored segment.
 */
function serializeCriteria(criteria: SegmentFilterCriteria): Prisma.InputJsonValue {
  return {
    ...criteria,
    lastOrderAfter: criteria.lastOrderAfter?.toISOString(),
    lastOrderBefore: criteria.lastOrderBefore?.toISOString(),
  };
}

function deserializeCriteria(stored: Prisma.JsonValue): SegmentFilterCriteria {
  const raw = stored as Record<string, unknown>;
  return {
    ...raw,
    lastOrderAfter: typeof raw.lastOrderAfter === "string" ? new Date(raw.lastOrderAfter) : undefined,
    lastOrderBefore: typeof raw.lastOrderBefore === "string" ? new Date(raw.lastOrderBefore) : undefined,
  } as SegmentFilterCriteria;
}

interface SegmentMember {
  id: string;
  name: string | null;
  email: string | null;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: Date | null;
}

async function filterCustomers(criteria: SegmentFilterCriteria): Promise<SegmentMember[]> {
  const [candidates, metricsByUser] = await Promise.all([
    customerSegmentRepository.listCandidateUsers({
      rewardTierId: criteria.rewardTierId,
      city: criteria.city,
      customerGroup: criteria.customerGroup,
    }),
    customerSegmentRepository.getCustomerMetrics(),
  ]);

  const members: SegmentMember[] = [];
  for (const candidate of candidates) {
    const metrics = metricsByUser.get(candidate.id) ?? { orderCount: 0, totalSpent: 0, lastOrderAt: null };

    if (criteria.minOrderCount !== undefined && metrics.orderCount < criteria.minOrderCount) continue;
    if (criteria.maxOrderCount !== undefined && metrics.orderCount > criteria.maxOrderCount) continue;
    if (criteria.minLifetimeValue !== undefined && metrics.totalSpent < criteria.minLifetimeValue) continue;
    if (criteria.maxLifetimeValue !== undefined && metrics.totalSpent > criteria.maxLifetimeValue) continue;
    if (criteria.lastOrderAfter !== undefined && (!metrics.lastOrderAt || metrics.lastOrderAt < criteria.lastOrderAfter)) continue;
    if (criteria.lastOrderBefore !== undefined && (!metrics.lastOrderAt || metrics.lastOrderAt > criteria.lastOrderBefore)) continue;

    members.push({ id: candidate.id, name: candidate.name, email: candidate.email, ...metrics });
  }
  return members;
}

export interface SegmentPreview {
  members: SegmentMember[];
  count: number;
  totalClv: number;
  averageClv: number;
}

function toPreview(members: SegmentMember[]): SegmentPreview {
  const totalClv = members.reduce((sum, member) => sum + member.totalSpent, 0);
  return { members, count: members.length, totalClv, averageClv: members.length > 0 ? totalClv / members.length : 0 };
}

export async function previewSegment(adminUserId: string, criteria: SegmentFilterCriteria): Promise<SegmentPreview> {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  return toPreview(await filterCustomers(criteria));
}

/** Called from an already-gated campaign-send path (email-sms-campaign.service.ts) — same trust boundary as the existing LoyaltyMembers/ReferralMembers resolution branches, no separate permission check. */
export async function resolveSegmentMembers(segmentId: string): Promise<string[]> {
  const segment = await savedSegmentRepository.findById(segmentId);
  if (!segment) return [];
  const members = await filterCustomers(deserializeCriteria(segment.filterCriteria));
  return members.map((member) => member.id);
}

export async function listSegments(adminUserId: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  return savedSegmentRepository.listAll();
}

async function requireSegment(id: string) {
  const segment = await savedSegmentRepository.findById(id);
  if (!segment) throw new SegmentNotFoundError();
  return segment;
}

export async function getSegment(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const segment = await requireSegment(id);
  const preview = await toPreview(await filterCustomers(deserializeCriteria(segment.filterCriteria)));
  return { segment, preview };
}

export async function createSegment(adminUserId: string, input: CreateSegmentInput) {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");
  const segment = await savedSegmentRepository.create({ name: input.name, filterCriteria: serializeCriteria(input.filterCriteria), createdById: adminUserId });
  await writeAuditLog({ actorId: adminUserId, action: "crm_segment_created", module: "CRMAnalytics", targetType: "SavedSegment", targetId: segment.id, metadata: { name: segment.name } });
  return segment;
}

export async function updateSegment(adminUserId: string, id: string, input: UpdateSegmentInput) {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");
  await requireSegment(id);
  const segment = await savedSegmentRepository.update(id, { name: input.name, filterCriteria: input.filterCriteria ? serializeCriteria(input.filterCriteria) : undefined });
  await writeAuditLog({ actorId: adminUserId, action: "crm_segment_updated", module: "CRMAnalytics", targetType: "SavedSegment", targetId: id });
  return segment;
}

export async function deleteSegment(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "Delete");
  await requireSegment(id);
  await savedSegmentRepository.deleteSegment(id);
  await writeAuditLog({ actorId: adminUserId, action: "crm_segment_deleted", module: "CRMAnalytics", targetType: "SavedSegment", targetId: id });
}

/**
 * Reuses rewards.repository.ts directly, not rewards.service.ts's own
 * listTiersForAdmin — that wrapper is gated on RewardsReferrals:View, an
 * unrelated module an admin building a segment shouldn't need (the exact
 * cross-module-permission-reuse bug STORY-058's assignee picker hit).
 */
export async function listRewardTiersForSegmentation(adminUserId: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  return rewardsRepository.listTiersForAdmin();
}

/** Surfaces on the existing admin Customer detail page (STORY-048) — gated on Customers:View, not CRMAnalytics, since that's the module the rest of that page already requires. */
export async function getCustomerClv(adminUserId: string, customerId: string) {
  await requirePermission(adminUserId, "Customers", "View");
  return customerSegmentRepository.getCustomerMetricsFor(customerId);
}
