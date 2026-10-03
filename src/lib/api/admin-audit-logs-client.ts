/** STORY-057. Fetch wrappers for /api/admin/audit-logs/*. */

import type { AdminModuleValue } from "@/lib/api/admin-roles-client";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actor: { id: string; email: string; name: string } | null;
  action: string;
  module: AdminModuleValue | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogFilters {
  actorId?: string;
  module?: AdminModuleValue;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  targetId?: string;
  page?: number;
}

export interface AuditLogPage {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

function toSearchParams(filters: AuditLogFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}

export async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogPage> {
  const response = await fetch(`/api/admin/audit-logs?${toSearchParams(filters).toString()}`);
  if (!response.ok) throw new Error(`Failed to load the audit log (${response.status})`);
  return response.json();
}

export function auditLogExportUrl(filters: Omit<AuditLogFilters, "page">): string {
  return `/api/admin/audit-logs/export?${toSearchParams(filters).toString()}`;
}
