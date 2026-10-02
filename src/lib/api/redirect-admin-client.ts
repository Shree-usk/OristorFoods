/** STORY-051b. Fetch wrappers for /api/admin/seo/redirects/*. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface RedirectAdmin {
  id: string;
  sourcePath: string;
  destinationPath: string;
  statusCode: number;
  active: boolean;
  createdAt: string;
}

export type RedirectFormInput = Omit<RedirectAdmin, "id" | "createdAt">;

export async function fetchRedirects(): Promise<{ redirects: RedirectAdmin[] }> {
  const response = await fetch("/api/admin/seo/redirects");
  assertOk(response, "Failed to load redirects");
  return response.json();
}

export async function fetchRedirect(id: string): Promise<RedirectAdmin> {
  const response = await fetch(`/api/admin/seo/redirects/${id}`);
  assertOk(response, "Failed to load the redirect");
  return response.json();
}

export async function createRedirectAdmin(input: RedirectFormInput): Promise<RedirectAdmin> {
  const response = await fetch("/api/admin/seo/redirects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the redirect");
  return response.json();
}

export async function updateRedirectAdmin(id: string, input: Partial<RedirectFormInput>): Promise<RedirectAdmin> {
  const response = await fetch(`/api/admin/seo/redirects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the redirect");
  return response.json();
}

export async function deleteRedirectAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/seo/redirects/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the redirect");
}

export interface BulkImportRowResult {
  line: number;
  sourcePath: string;
  error?: string;
}

export interface BulkImportResult {
  succeeded: BulkImportRowResult[];
  failed: BulkImportRowResult[];
}

export async function bulkImportRedirectsAdmin(csv: string): Promise<BulkImportResult> {
  const response = await fetch("/api/admin/seo/redirects/bulk-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
  await assertOkWithServerMessage(response, "Failed to import the CSV file");
  return response.json();
}
