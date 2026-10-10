async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface AdminAllergen {
  id: string;
  name: string;
  icon: string | null;
}

export interface AdminCertification {
  id: string;
  name: string;
  certificateImage: string | null;
  documentUrl: string | null;
}

export async function fetchAdminAllergens(): Promise<AdminAllergen[]> {
  const response = await fetch("/api/admin/allergens");
  if (!response.ok) throw new Error(`Failed to load allergens (${response.status})`);
  return response.json();
}

export async function createAdminAllergen(input: { name: string; icon?: string | null }): Promise<AdminAllergen> {
  const response = await fetch("/api/admin/allergens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create allergen");
  return response.json();
}

export async function updateAdminAllergen(id: string, input: { name?: string; icon?: string | null }): Promise<AdminAllergen> {
  const response = await fetch(`/api/admin/allergens/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save allergen");
  return response.json();
}

export async function fetchAdminCertifications(): Promise<AdminCertification[]> {
  const response = await fetch("/api/admin/certifications");
  if (!response.ok) throw new Error(`Failed to load certifications (${response.status})`);
  return response.json();
}

export async function createAdminCertification(input: { name: string; certificateImage?: string | null; documentUrl?: string | null }): Promise<AdminCertification> {
  const response = await fetch("/api/admin/certifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create certification");
  return response.json();
}

export async function updateAdminCertification(id: string, input: { name?: string; certificateImage?: string | null; documentUrl?: string | null }): Promise<AdminCertification> {
  const response = await fetch(`/api/admin/certifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save certification");
  return response.json();
}
