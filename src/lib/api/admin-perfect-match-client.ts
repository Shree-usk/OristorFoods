/** Fetch wrappers for /api/admin/perfect-match/**. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type PerfectMatchStatus = "Draft" | "Published";

export interface PerfectMatchSetting {
  id: string;
  eyebrow: string | null;
  heading: string | null;
  description: string | null;
  updatedAt: string;
}

export type PerfectMatchSettingInput = Omit<PerfectMatchSetting, "id" | "updatedAt">;

export async function fetchPerfectMatchSetting(): Promise<PerfectMatchSetting | null> {
  const response = await fetch("/api/admin/perfect-match/settings");
  if (!response.ok) throw new Error(`Failed to load Perfect Match settings (${response.status})`);
  return response.json();
}

export async function savePerfectMatchSetting(input: PerfectMatchSettingInput): Promise<PerfectMatchSetting> {
  const response = await fetch("/api/admin/perfect-match/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save Perfect Match settings.");
  return response.json();
}

export interface PerfectMatchLinkedProduct {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  status: string;
  images: { url: string; altText: string | null }[];
}

export interface PerfectMatchProduct {
  id: string;
  productId: string;
  kicker: string | null;
  promoDescriptionOverride: string | null;
  isDefaultFeatured: boolean;
  status: PerfectMatchStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  product: PerfectMatchLinkedProduct;
}

export interface PerfectMatchProductInput {
  productId: string;
  kicker: string | null;
  promoDescriptionOverride: string | null;
  isDefaultFeatured: boolean;
  status?: PerfectMatchStatus;
}

export async function fetchPerfectMatchProducts(): Promise<PerfectMatchProduct[]> {
  const response = await fetch("/api/admin/perfect-match/products");
  if (!response.ok) throw new Error(`Failed to load Perfect Match products (${response.status})`);
  return response.json();
}

export async function fetchPerfectMatchProduct(id: string): Promise<PerfectMatchProduct> {
  const response = await fetch(`/api/admin/perfect-match/products/${id}`);
  if (!response.ok) throw new Error(`Failed to load the product (${response.status})`);
  return response.json();
}

export async function addPerfectMatchProduct(input: PerfectMatchProductInput): Promise<PerfectMatchProduct> {
  const response = await fetch("/api/admin/perfect-match/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to add the product.");
  return response.json();
}

export async function updatePerfectMatchProduct(id: string, input: PerfectMatchProductInput): Promise<PerfectMatchProduct> {
  const response = await fetch(`/api/admin/perfect-match/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to update the product.");
  return response.json();
}

export async function deletePerfectMatchProduct(id: string): Promise<void> {
  const response = await fetch(`/api/admin/perfect-match/products/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to remove the product.");
}

export async function reorderPerfectMatchProducts(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/admin/perfect-match/products/reorder", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  await assertOkWithServerMessage(response, "Failed to reorder products.");
}

export interface PerfectMatchPairing {
  id: string;
  perfectMatchProductId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  imageAlt: string | null;
  categoryLabel: string | null;
  supportingTag: string | null;
  status: PerfectMatchStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type PerfectMatchPairingInput = Pick<PerfectMatchPairing, "title" | "description" | "imageUrl" | "imageAlt" | "categoryLabel" | "supportingTag" | "status">;

export async function fetchPerfectMatchPairings(productId: string): Promise<PerfectMatchPairing[]> {
  const response = await fetch(`/api/admin/perfect-match/products/${productId}/pairings`);
  if (!response.ok) throw new Error(`Failed to load meal pairings (${response.status})`);
  return response.json();
}

export async function addPerfectMatchPairing(productId: string, input: PerfectMatchPairingInput): Promise<PerfectMatchPairing> {
  const response = await fetch(`/api/admin/perfect-match/products/${productId}/pairings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to add the meal pairing.");
  return response.json();
}

export async function updatePerfectMatchPairing(id: string, input: PerfectMatchPairingInput): Promise<PerfectMatchPairing> {
  const response = await fetch(`/api/admin/perfect-match/pairings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to update the meal pairing.");
  return response.json();
}

export async function deletePerfectMatchPairing(id: string): Promise<void> {
  const response = await fetch(`/api/admin/perfect-match/pairings/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the meal pairing.");
}

export async function reorderPerfectMatchPairings(productId: string, orderedIds: string[]): Promise<void> {
  const response = await fetch(`/api/admin/perfect-match/products/${productId}/pairings/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  await assertOkWithServerMessage(response, "Failed to reorder meal pairings.");
}
