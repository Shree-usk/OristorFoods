/** STORY-061. Fetch wrappers for /api/admin/search-glossary/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface GlossaryTerm {
  id: string;
  term: string;
  canonicalTerm: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryTermInput {
  term: string;
  canonicalTerm: string;
  targetType: string | null;
  targetId: string | null;
}

export async function fetchGlossaryTerms(): Promise<GlossaryTerm[]> {
  const response = await fetch("/api/admin/search-glossary");
  if (!response.ok) throw new Error(`Failed to load glossary terms (${response.status})`);
  return response.json();
}

export async function createGlossaryTermAdmin(input: GlossaryTermInput): Promise<GlossaryTerm> {
  const response = await fetch("/api/admin/search-glossary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the glossary term");
  return response.json();
}

export async function updateGlossaryTermAdmin(id: string, input: GlossaryTermInput): Promise<GlossaryTerm> {
  const response = await fetch(`/api/admin/search-glossary/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to save the glossary term");
  return response.json();
}

export async function deleteGlossaryTermAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/search-glossary/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the glossary term");
}
