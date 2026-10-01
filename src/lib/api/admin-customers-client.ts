/** STORY-048. Fetch wrappers for /api/admin/customers/* — mirrors admin-orders-client.ts's conventions. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type AccountStatusValue = "Active" | "DeactivationRequested" | "Deactivated" | "Suspended";
export type CustomerGroupValue = "Retail" | "Wholesale";
export type CouponDiscountTypeValue = "PercentageOff" | "FixedAmountOff" | "FreeShipping";

export interface CustomerAdminListItem {
  id: string;
  name: string | null;
  email: string | null;
  status: AccountStatusValue;
  customerGroup: CustomerGroupValue;
  createdAt: string;
}

export interface CustomerAdminListFilters {
  page?: number;
  pageSize?: number;
  status?: AccountStatusValue;
  search?: string;
  registeredFrom?: string;
  registeredTo?: string;
}

export interface CustomerAdminListResult {
  customers: CustomerAdminListItem[];
  total: number;
}

export interface OrderHistoryListItem {
  orderNumber: string;
  status: string;
  placedAt: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  thumbnailUrls: string[];
}

export interface TicketSummary {
  id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  orderNumber: string | null;
  createdAt: string;
}

export interface LoginEventItem {
  id: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AddressItem {
  id: string;
  label: string;
  line1: string;
  city: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

export interface AdminNoteItem {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string | null };
}

export interface CustomerAdminDetail {
  customer: CustomerAdminListItem & {
    phone: string | null;
    suspendedReason: string | null;
    suspendedAt: string | null;
  };
  addresses: AddressItem[];
  orders: { orders: OrderHistoryListItem[]; total: number };
  tickets: { tickets: TicketSummary[]; total: number };
  loginHistory: { events: LoginEventItem[]; total: number };
  rewards: { spendable: number; lifetimeAchievement: number; currentTier: { id: string; name: string } | null };
  referrals: { code: string; totalPointsEarned: number };
  notes: AdminNoteItem[];
}

function queryString(filters: CustomerAdminListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.registeredFrom) params.set("registeredFrom", filters.registeredFrom);
  if (filters.registeredTo) params.set("registeredTo", filters.registeredTo);
  return params.toString();
}

export async function fetchCustomersAdmin(filters: CustomerAdminListFilters): Promise<CustomerAdminListResult> {
  const response = await fetch(`/api/admin/customers?${queryString(filters)}`);
  assertOk(response, "Failed to load customers");
  return response.json();
}

export async function fetchCustomerAdminDetail(id: string): Promise<CustomerAdminDetail> {
  const response = await fetch(`/api/admin/customers/${id}`);
  assertOk(response, "Failed to load the customer");
  return response.json();
}

export async function suspendCustomerAdmin(id: string, reason: string): Promise<void> {
  const response = await fetch(`/api/admin/customers/${id}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  await assertOkWithServerMessage(response, "Failed to suspend the customer");
}

export async function reactivateCustomerAdmin(id: string): Promise<void> {
  const response = await fetch(`/api/admin/customers/${id}/reactivate`, { method: "POST" });
  await assertOkWithServerMessage(response, "Failed to reactivate the customer");
}

export async function grantRewardAdmin(id: string, points: number, reason: string, expiresAt: string | null): Promise<void> {
  const response = await fetch(`/api/admin/customers/${id}/rewards/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points, reason, expiresAt: expiresAt ?? undefined }),
  });
  await assertOkWithServerMessage(response, "Failed to grant reward points");
}

export interface IssueCouponPayload {
  discountType: CouponDiscountTypeValue;
  percentOff?: number;
  amountOff?: number;
  expiresInDays: number;
  usageLimit: number;
}

export async function issueCouponAdmin(id: string, payload: IssueCouponPayload): Promise<{ code: string }> {
  const response = await fetch(`/api/admin/customers/${id}/coupons/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await assertOkWithServerMessage(response, "Failed to issue the coupon");
  return response.json();
}

export async function addCustomerNoteAdmin(id: string, body: string): Promise<void> {
  const response = await fetch(`/api/admin/customers/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  await assertOkWithServerMessage(response, "Failed to add the note");
}

export async function setCustomerGroupAdmin(id: string, customerGroup: CustomerGroupValue): Promise<void> {
  const response = await fetch(`/api/admin/customers/${id}/group`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerGroup }),
  });
  await assertOkWithServerMessage(response, "Failed to update the customer's pricing group");
}
