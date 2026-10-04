import { Prisma } from "@/generated/prisma/client";
import * as policyDocumentRepository from "@/repositories/policy-document.repository";
import type { PolicyDocumentInput } from "@/repositories/policy-document.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { PolicyDocumentDuplicateSlugError, PolicyDocumentNotFoundError } from "@/services/policy-document.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-063. The single canonical policy content source (AC #4),
 * admin-managed under System Settings — one permission-gated
 * (SystemSettings, View/Edit), audit-logged function per operation,
 * mirroring system-settings.service.ts's own FeatureFlag CRUD shape
 * exactly. Ships with no seeded content; see docs/architecture-decisions.md.
 */

export async function listPolicyDocuments(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return policyDocumentRepository.listPolicyDocuments();
}

async function requirePolicyDocumentRow(id: string) {
  const document = await policyDocumentRepository.findPolicyDocumentById(id);
  if (!document) throw new PolicyDocumentNotFoundError();
  return document;
}

export async function createPolicyDocument(adminUserId: string, input: PolicyDocumentInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  try {
    const document = await policyDocumentRepository.createPolicyDocument(input, adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "policy_document_created", module: "SystemSettings", targetType: "PolicyDocument", targetId: document.id });
    return document;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PolicyDocumentDuplicateSlugError();
    throw error;
  }
}

export async function updatePolicyDocument(adminUserId: string, id: string, input: Partial<PolicyDocumentInput>) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await requirePolicyDocumentRow(id);
  try {
    const document = await policyDocumentRepository.updatePolicyDocument(id, input, adminUserId);
    await writeAuditLog({ actorId: adminUserId, action: "policy_document_updated", module: "SystemSettings", targetType: "PolicyDocument", targetId: id });
    return document;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new PolicyDocumentDuplicateSlugError();
    throw error;
  }
}

export async function deletePolicyDocument(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await requirePolicyDocumentRow(id);
  await policyDocumentRepository.deletePolicyDocument(id);
  await writeAuditLog({ actorId: adminUserId, action: "policy_document_deleted", module: "SystemSettings", targetType: "PolicyDocument", targetId: id });
}

/** No permission check — the Support Assistant's own grounding read, same "generic helper any code can call" precedent as system-settings.service.ts::isFeatureEnabled. Null when nothing has been authored yet; never fabricated. */
export function getPolicyDocumentBySlug(slug: string) {
  return policyDocumentRepository.findPolicyDocumentBySlug(slug);
}
