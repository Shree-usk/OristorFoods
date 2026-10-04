/** STORY-072. Fetch wrappers for /api/contact-enquiries and /api/admin/contact-enquiries/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type ContactEnquiryTypeValue =
  | "General"
  | "Product"
  | "CustomerSupport"
  | "Wholesale"
  | "Distributor"
  | "Export"
  | "RetailPartnership"
  | "FoodService"
  | "Media"
  | "Careers"
  | "Other";

export type ContactEnquiryStatusValue = "New" | "InProgress" | "Responded" | "Closed" | "Spam";

export interface SubmitContactEnquiryInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  enquiryType: ContactEnquiryTypeValue;
  companyName?: string;
  country?: string;
  businessType?: string;
  productInterest?: string;
  estimatedRequirement?: string;
  message: string;
  honeypot: string;
}

export async function submitContactEnquiry(input: SubmitContactEnquiryInput): Promise<{ submitted: boolean }> {
  const response = await fetch("/api/contact-enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to send your enquiry. Please try again.");
  return response.json();
}

export interface ContactEnquiryRow {
  id: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  companyName: string | null;
  country: string | null;
  enquiryType: ContactEnquiryTypeValue;
  businessType: string | null;
  productInterest: string | null;
  message: string;
  status: ContactEnquiryStatusValue;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactEnquiryList {
  rows: ContactEnquiryRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchContactEnquiries(filters: { status?: ContactEnquiryStatusValue; enquiryType?: ContactEnquiryTypeValue; search?: string; page?: number } = {}): Promise<ContactEnquiryList> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.enquiryType) params.set("enquiryType", filters.enquiryType);
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  const response = await fetch(`/api/admin/contact-enquiries?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to load contact enquiries");
  return response.json();
}

export async function fetchContactEnquiry(id: string): Promise<ContactEnquiryRow> {
  const response = await fetch(`/api/admin/contact-enquiries/${id}`);
  if (!response.ok) throw new Error("Failed to load the enquiry");
  return response.json();
}

export async function updateContactEnquiryStatus(id: string, status: ContactEnquiryStatusValue): Promise<ContactEnquiryRow> {
  const response = await fetch(`/api/admin/contact-enquiries/${id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await assertOkWithServerMessage(response, "Failed to update the enquiry status.");
  return response.json();
}
