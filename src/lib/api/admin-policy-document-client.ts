/** STORY-063. Fetch wrappers for /api/admin/policy-documents/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface PolicyDocument {
  id: string;
  slug: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyDocumentInput {
  slug: string;
  title: string;
  content: string;
}

export async function fetchPolicyDocuments(): Promise<PolicyDocument[]> {
  const response = await fetch("/api/admin/policy-documents");
  if (!response.ok) throw new Error(`Failed to load policy documents (${response.status})`);
  return response.json();
}

export async function createPolicyDocumentAdmin(input: PolicyDocumentInput): Promise<PolicyDocument> {
  const response = await fetch("/api/admin/policy-documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the policy document");
  return response.json();
}

export async function updatePolicyDocumentAdmin(id: string, input: PolicyDocumentInput): Promise<PolicyDocument> {
  const response = await fetch(`/api/admin/policy-documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the policy document");
  return response.json();
}

export async function deletePolicyDocumentAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/policy-documents/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the policy document");
}
