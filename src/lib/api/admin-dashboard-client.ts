import type { DashboardSummary } from "@/services/admin-dashboard.service";

/** GET /api/admin/dashboard/summary — polled by AdminDashboardView every 60s. */
export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch("/api/admin/dashboard/summary");
  if (!response.ok) throw new Error(`Failed to load dashboard summary (${response.status})`);
  return response.json();
}
