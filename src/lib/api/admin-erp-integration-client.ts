/** STORY-056. Fetch wrappers for /api/admin/erp-integration/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type SyncJobStatusValue = "Queued" | "Processing" | "Success" | "Failed";

export interface SyncJobAttempt {
  id: string;
  attemptNumber: number;
  result: SyncJobStatusValue;
  errorDetail: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface SyncJob {
  id: string;
  jobType: string;
  status: SyncJobStatusValue;
  targetEntityType: string | null;
  targetEntityId: string | null;
  payload: Record<string, unknown> | null;
  errorMessage: string | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncJobDetail extends SyncJob {
  attempts: SyncJobAttempt[];
}

export interface SyncJobFilters {
  jobType?: string;
  status?: SyncJobStatusValue;
  dateFrom?: string;
  dateTo?: string;
  targetEntityId?: string;
}

export async function fetchJobs(filters: SyncJobFilters): Promise<SyncJob[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const response = await fetch(`/api/admin/erp-integration/jobs?${params.toString()}`);
  if (!response.ok) throw new Error(`Failed to load sync jobs (${response.status})`);
  return response.json();
}

export async function fetchJob(id: string): Promise<SyncJobDetail> {
  const response = await fetch(`/api/admin/erp-integration/jobs/${id}`);
  if (!response.ok) throw new Error(`Failed to load the sync job (${response.status})`);
  return response.json();
}

export interface TriggerSyncInput {
  jobType: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  payload?: Record<string, unknown> | null;
}

export async function triggerSync(input: TriggerSyncInput): Promise<SyncJob> {
  const response = await fetch("/api/admin/erp-integration/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to trigger the sync");
  return response.json();
}

export async function retryJob(id: string): Promise<SyncJob> {
  const response = await fetch(`/api/admin/erp-integration/jobs/${id}/retry`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to retry the sync job");
  return response.json();
}

export interface SyncQueueSummary {
  queued: number;
  failed: number;
  succeededToday: number;
}

export async function fetchSummary(): Promise<SyncQueueSummary> {
  const response = await fetch("/api/admin/erp-integration/summary");
  if (!response.ok) throw new Error(`Failed to load the sync summary (${response.status})`);
  return response.json();
}
