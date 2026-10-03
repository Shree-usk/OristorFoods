/** STORY-057. Fetch wrapper for /api/admin/system-health. */

export interface SystemHealth {
  erp: {
    orderOutbox: { pending: number; failed: number; lastProcessedAt: string | null };
    syncQueue: { queued: number; failed: number; succeededToday: number };
  };
  uptime: { available: false };
  errorRate: { available: false };
  lastBackupAt: { available: false };
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await fetch("/api/admin/system-health");
  if (!response.ok) throw new Error(`Failed to load system health (${response.status})`);
  return response.json();
}
