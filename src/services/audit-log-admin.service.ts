import type { AuditLogFilters } from "@/repositories/audit-log.repository";
import * as auditLogRepository from "@/repositories/audit-log.repository";
import { requirePermission } from "@/services/permission.service";

/** STORY-057. Read-only viewer over the existing AuditLog table — gated on the `Audit`/`Export` actions, which exist in AdminAction specifically for this. */

export async function listAuditLogs(adminUserId: string, filters: AuditLogFilters, page: number) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Audit");
  return auditLogRepository.list(filters, page);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function exportAuditLogsCsv(adminUserId: string, filters: AuditLogFilters): Promise<string> {
  await requirePermission(adminUserId, "UsersRolesAudit", "Export");
  const rows = await auditLogRepository.listForExport(filters);

  const header = ["Timestamp", "Actor", "Action", "Module", "Target Type", "Target ID", "Metadata"];
  const lines = rows.map((row) =>
    [
      row.createdAt.toISOString(),
      row.actor?.email ?? "(system)",
      row.action,
      row.module ?? "",
      row.targetType ?? "",
      row.targetId ?? "",
      row.metadata ? JSON.stringify(row.metadata) : "",
    ]
      .map((value) => csvEscape(String(value)))
      .join(","),
  );

  return [header.join(","), ...lines].join("\n");
}
