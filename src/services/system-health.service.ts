import * as orderRepository from "@/repositories/order.repository";
import * as syncJobRepository from "@/repositories/sync-job.repository";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-057. The full-detail counterpart to the Admin Dashboard's
 * System Health summary widget. Only real data sources are reported —
 * uptime/API-error-rate/backup-timestamp have no monitoring or backup
 * infrastructure anywhere in this codebase, so those three are
 * explicit `available: false` fields rather than fabricated numbers,
 * the same honest-placeholder treatment admin-dashboard.service.ts
 * already uses for `liveVisitors`/`exportEnquiries`.
 */

export interface SystemHealth {
  erp: {
    orderOutbox: { pending: number; failed: number; lastProcessedAt: string | null };
    syncQueue: { queued: number; failed: number; succeededToday: number };
  };
  uptime: { available: false };
  errorRate: { available: false };
  lastBackupAt: { available: false };
}

export async function getSystemHealth(adminUserId: string): Promise<SystemHealth> {
  await requirePermission(adminUserId, "UsersRolesAudit", "View");

  const [orderOutbox, syncQueue] = await Promise.all([orderRepository.getErpSyncStatus(), syncJobRepository.getTodaySummary()]);

  return {
    erp: { orderOutbox, syncQueue },
    uptime: { available: false },
    errorRate: { available: false },
    lastBackupAt: { available: false },
  };
}
