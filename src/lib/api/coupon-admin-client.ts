/** STORY-050b. Admin fetch wrappers for /api/admin/marketing/coupons|promotions — mirrors popup-admin-client.ts's exact shape (STORY-050a). */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type CouponDiscountTypeValue = "PercentageOff" | "FixedAmountOff" | "FreeShipping";
export type CouponScopeValue = "AllProducts" | "Category" | "Product";

export interface CouponAdmin {
  id: string;
  code: string;
  discountType: CouponDiscountTypeValue;
  percentOff: string | null;
  amountOff: string | null;
  currency: string;
  startDate: string;
  endDate: string;
  minOrderValue: string | null;
  usageLimitGlobal: number | null;
  usageLimitPerCustomer: number | null;
  scope: CouponScopeValue;
  stackable: boolean;
  isActive: boolean;
  createdAt: string;
  scopeProducts: { productId: string }[];
  scopeCategories: { categoryId: string }[];
}

export interface CouponFormInput {
  code: string;
  discountType: CouponDiscountTypeValue;
  percentOff: number | null;
  amountOff: number | null;
  startDate: string;
  endDate: string;
  minOrderValue: number | null;
  usageLimitGlobal: number | null;
  usageLimitPerCustomer: number | null;
  scope: CouponScopeValue;
  stackable: boolean;
  scopeProductIds: string[];
  scopeCategoryIds: string[];
}

export async function fetchCoupons(): Promise<{ coupons: CouponAdmin[] }> {
  const response = await fetch("/api/admin/marketing/coupons");
  if (!response.ok) throw new Error("Failed to load coupons");
  return response.json();
}

export async function createCouponAdmin(input: CouponFormInput): Promise<CouponAdmin> {
  const response = await fetch("/api/admin/marketing/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the coupon");
  return response.json();
}

export async function updateCouponAdmin(id: string, input: Partial<CouponFormInput> & { isActive?: boolean }): Promise<CouponAdmin> {
  const response = await fetch(`/api/admin/marketing/coupons/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the coupon");
  return response.json();
}

export interface PromotionAdmin {
  id: string;
  name: string;
  displayLabel: string;
  discountType: CouponDiscountTypeValue;
  percentOff: string | null;
  amountOff: string | null;
  currency: string;
  startDate: string;
  endDate: string;
  minOrderValue: string | null;
  scope: CouponScopeValue;
  stackable: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
  scopeProducts: { productId: string }[];
  scopeCategories: { categoryId: string }[];
}

export interface PromotionFormInput {
  name: string;
  displayLabel: string;
  discountType: CouponDiscountTypeValue;
  percentOff: number | null;
  amountOff: number | null;
  startDate: string;
  endDate: string;
  minOrderValue: number | null;
  scope: CouponScopeValue;
  stackable: boolean;
  priority: number;
  scopeProductIds: string[];
  scopeCategoryIds: string[];
}

export async function fetchPromotions(): Promise<{ promotions: PromotionAdmin[] }> {
  const response = await fetch("/api/admin/marketing/promotions");
  if (!response.ok) throw new Error("Failed to load promotions");
  return response.json();
}

export async function createPromotionAdmin(input: PromotionFormInput): Promise<PromotionAdmin> {
  const response = await fetch("/api/admin/marketing/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to create the promotion");
  return response.json();
}

export async function updatePromotionAdmin(id: string, input: Partial<PromotionFormInput> & { isActive?: boolean }): Promise<PromotionAdmin> {
  const response = await fetch(`/api/admin/marketing/promotions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to update the promotion");
  return response.json();
}
