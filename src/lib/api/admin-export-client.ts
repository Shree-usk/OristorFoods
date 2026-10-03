/** STORY-058. Fetch wrappers for /api/admin/export/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type ExportEnquiryStatusValue = "New" | "InDiscussion" | "Quoted" | "Won" | "Lost";

export interface ExportEnquiryAssignee {
  id: string;
  name: string;
  email: string;
}

export interface ExportEnquiryListItem {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  country: string;
  productsOfInterest: string;
  volumeEstimate: string | null;
  message: string;
  status: ExportEnquiryStatusValue;
  assignedTo: ExportEnquiryAssignee | null;
  distributorAccount: { id: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExportEnquiryNote {
  id: string;
  body: string;
  author: ExportEnquiryAssignee;
  createdAt: string;
}

export interface ExportEnquiryDetail extends ExportEnquiryListItem {
  notes: ExportEnquiryNote[];
}

export interface ExportEnquiryFilters {
  status?: ExportEnquiryStatusValue;
  country?: string;
  companyName?: string;
  productsOfInterest?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
}

export interface ExportEnquiryPage {
  rows: ExportEnquiryListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function toSearchParams(filters: ExportEnquiryFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}

export async function fetchEnquiries(filters: ExportEnquiryFilters): Promise<ExportEnquiryPage> {
  const response = await fetch(`/api/admin/export/enquiries?${toSearchParams(filters).toString()}`);
  if (!response.ok) throw new Error(`Failed to load export enquiries (${response.status})`);
  return response.json();
}

export async function fetchEnquiry(id: string): Promise<ExportEnquiryDetail> {
  const response = await fetch(`/api/admin/export/enquiries/${id}`);
  if (!response.ok) throw new Error(`Failed to load the enquiry (${response.status})`);
  return response.json();
}

export async function fetchAssignableAdmins(): Promise<ExportEnquiryAssignee[]> {
  const response = await fetch("/api/admin/export/admins");
  if (!response.ok) throw new Error(`Failed to load assignable admins (${response.status})`);
  return response.json();
}

export interface AuditLogActivityEntry {
  id: string;
  action: string;
  actor: { id: string; email: string; name: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export async function fetchEnquiryActivity(id: string): Promise<AuditLogActivityEntry[]> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/activity`);
  if (!response.ok) throw new Error(`Failed to load the enquiry's activity (${response.status})`);
  return response.json();
}

export async function updateEnquiryStatus(id: string, status: ExportEnquiryStatusValue): Promise<ExportEnquiryListItem> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
  await assertOkWithServerMessage(response, "Failed to update the enquiry's status");
  return response.json();
}

export async function assignEnquiry(id: string, assignedToId: string | null): Promise<ExportEnquiryListItem> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToId }) });
  await assertOkWithServerMessage(response, "Failed to assign the enquiry");
  return response.json();
}

export async function addEnquiryNote(id: string, body: string): Promise<ExportEnquiryNote> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
  await assertOkWithServerMessage(response, "Failed to add the note");
  return response.json();
}

export async function replyToEnquiry(id: string, subject: string, body: string): Promise<void> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) });
  await assertOkWithServerMessage(response, "Failed to send the reply");
}

export interface DistributorAccount {
  id: string;
  companyName: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  user: { id: string; email: string; customerGroup: string };
  createdBy: ExportEnquiryAssignee;
  convertedFromEnquiry: { id: string; companyName: string };
  createdAt: string;
}

export async function convertToDistributorAccount(id: string, region: string): Promise<DistributorAccount> {
  const response = await fetch(`/api/admin/export/enquiries/${id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ region }) });
  await assertOkWithServerMessage(response, "Failed to convert this enquiry");
  return response.json();
}

export async function fetchDistributorAccounts(): Promise<DistributorAccount[]> {
  const response = await fetch("/api/admin/export/distributor-accounts");
  if (!response.ok) throw new Error(`Failed to load distributor accounts (${response.status})`);
  return response.json();
}
