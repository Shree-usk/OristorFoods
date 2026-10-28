/** Story 5 (Free Gift). Admin fetch wrappers for /api/admin/gift-offers — mirrors coupon-admin-client.ts's exact shape. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type GiftOfferStatusValue = "Active" | "Inactive";

export interface GiftOfferAdmin {
  id: string;
  productId: string;
  product: { id: string; name: string; slug: string };
  qualifyingVariantId: string | null;
  qualifyingVariant: { id: string; name: string } | null;
  name: string;
  description: string | null;
  status: GiftOfferStatusValue;
  startDate: string | null;
  endDate: string | null;
  minQuantity: number | null;
  minSpend: string | null;
  giftProductId: string;
  giftProduct: { id: string; name: string; slug: string };
  giftVariantId: string | null;
  giftVariant: { id: string; name: string } | null;
  giftQuantity: number;
  giftStockLimit: number | null;
  redemptionLimitGlobal: number | null;
  redemptionLimitPerCustomer: number | null;
  autoInclude: boolean;
  stackable: boolean;
  createdAt: string;
}

export interface CreateGiftOfferFormInput {
  productId: string;
  qualifyingVariantId: string | null;
  name: string;
  description: string | null;
  status?: GiftOfferStatusValue;
  startDate?: string | null;
  endDate?: string | null;
  minQuantity: number | null;
  minSpend: number | null;
  giftProductId: string;
  giftVariantId: string | null;
  giftQuantity: number;
  giftStockLimit: number | null;
  redemptionLimitGlobal: number | null;
  redemptionLimitPerCustomer: number | null;
  stackable: boolean;
}

export type UpdateGiftOfferFormInput = Partial<Omit<CreateGiftOfferFormInput, "productId" | "qualifyingVariantId">>;

export async function fetchGiftOffers(): Promise<{ giftOffers: GiftOfferAdmin[] }> {
  const response = await fetch("/api/admin/gift-offers");
  if (!response.ok) throw new Error("Failed to load gift offers");
  return response.json();
}

export async function createGiftOfferAdmin(input: CreateGiftOfferFormInput): Promise<GiftOfferAdmin> {
  const response = await fetch("/api/admin/gift-offers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the gift offer");
  return response.json();
}

export async function updateGiftOfferAdmin(id: string, input: UpdateGiftOfferFormInput): Promise<GiftOfferAdmin> {
  const response = await fetch(`/api/admin/gift-offers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the gift offer");
  return response.json();
}
