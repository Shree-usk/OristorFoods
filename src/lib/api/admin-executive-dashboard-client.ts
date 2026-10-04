/** STORY-059c. Admin fetch wrappers for /api/admin/analytics/executive-summary and /api/admin/analytics/scheduled-reports — mirrors campaign-admin-client.ts's exact shape. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface KpiComparison {
  current: number;
  previous: number;
  changePercent: number | null;
}

export interface ExecutiveSummary {
  revenue: KpiComparison;
  returningCustomerRate: KpiComparison;
  averageOrderValue: KpiComparison;
  loyaltyEngagement: KpiComparison;
  exportEnquiryVolume: KpiComparison;
  coreWebVitals: { available: false };
}

export async function fetchExecutiveSummary(from: string, to: string): Promise<ExecutiveSummary> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/admin/analytics/executive-summary?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load the executive summary");
  return response.json();
}

export type ScheduledReportTypeValue = "sales" | "customers" | "products-recipes" | "funnel" | "executive-summary";
export type ScheduledReportFrequencyValue = "Weekly" | "Monthly";

export interface ScheduledReport {
  id: string;
  reportType: ScheduledReportTypeValue;
  recipients: string[];
  frequency: ScheduledReportFrequencyValue;
  lastSentAt: string | null;
  createdAt: string;
}

export interface ScheduledReportFormInput {
  reportType: ScheduledReportTypeValue;
  recipients: string[];
  frequency: ScheduledReportFrequencyValue;
}

export async function fetchScheduledReports(): Promise<ScheduledReport[]> {
  const response = await fetch("/api/admin/analytics/scheduled-reports");
  if (!response.ok) throw new Error("Failed to load scheduled reports");
  return response.json();
}

export async function createScheduledReportAdmin(input: ScheduledReportFormInput): Promise<ScheduledReport> {
  const response = await fetch("/api/admin/analytics/scheduled-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the scheduled report");
  return response.json();
}

export async function updateScheduledReportAdmin(id: string, input: Partial<ScheduledReportFormInput>): Promise<ScheduledReport> {
  const response = await fetch(`/api/admin/analytics/scheduled-reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the scheduled report");
  return response.json();
}

export async function deleteScheduledReportAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/analytics/scheduled-reports/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the scheduled report");
}

export async function processDueScheduledReportsAdmin(): Promise<{ processed: number }> {
  const response = await fetch("/api/admin/analytics/scheduled-reports/process-due", { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to process due scheduled reports");
  return response.json();
}
