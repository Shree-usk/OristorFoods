import * as auditLogRepository from "@/repositories/audit-log.repository";
import type { CreateAuditLogInput } from "@/repositories/audit-log.repository";

/**
 * STORY-038. Thin wrapper — every admin auth/permission event this story
 * writes, and every future admin-module story's create/edit/delete/approve
 * action, goes through this single function so the audit trail is never
 * duplicated or written inconsistently. Never throws outward: a failed
 * audit write must not block the action it's recording.
 */
export async function writeAuditLog(entry: CreateAuditLogInput): Promise<void> {
  try {
    await auditLogRepository.create(entry);
  } catch (error) {
    console.error("[audit-log] failed to write entry", entry.action, error);
  }
}
