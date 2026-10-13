async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface AdminPackagingMethod {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  status: "Active" | "Inactive";
}

export type PackagingMethodAdminInput = Partial<Omit<AdminPackagingMethod, "id">>;

export async function fetchAdminPackagingMethods(): Promise<AdminPackagingMethod[]> {
  const response = await fetch("/api/admin/packaging-methods");
  if (!response.ok) throw new Error(`Failed to load packaging methods (${response.status})`);
  return response.json();
}

export async function createAdminPackagingMethod(input: PackagingMethodAdminInput): Promise<AdminPackagingMethod> {
  const response = await fetch("/api/admin/packaging-methods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create packaging method");
  return response.json();
}

export async function updateAdminPackagingMethod(id: string, input: PackagingMethodAdminInput): Promise<AdminPackagingMethod> {
  const response = await fetch(`/api/admin/packaging-methods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save packaging method");
  return response.json();
}
