import type { CouponDiscountType, CustomerGroup } from "@/generated/prisma/client";
import * as adminNoteRepository from "@/repositories/admin-note.repository";
import * as addressRepository from "@/repositories/address.repository";
import * as loginEventRepository from "@/repositories/login-event.repository";
import type { CustomerAdminListFilters } from "@/repositories/user.repository";
import * as userRepository from "@/repositories/user.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { AccountAlreadySuspendedError, AccountNotSuspendedError, CustomerNotFoundError } from "@/services/customer-admin.errors";
import { getOrderListPage } from "@/services/customer-order-history.service";
import { getReferralSummary } from "@/services/customer-referrals-dashboard.service";
import { getRewardsSummary } from "@/services/customer-rewards-dashboard.service";
import { issueCouponToCustomer } from "@/services/coupon.service";
import { requirePermission } from "@/services/permission.service";
import { grantManualPoints } from "@/services/rewards.service";
import { listTicketsForUser } from "@/services/support-ticket.service";

/**
 * The admin-facing Customers console (STORY-048), plus setCustomerGroup
 * (STORY-071, the first function written here). Composes already-shipped
 * dashboard/service functions (rewards, referrals, order history, support
 * tickets, addresses) rather than re-querying their data directly — this
 * file orchestrates and permission-gates, it doesn't own that data.
 */
export async function setCustomerGroup(adminUserId: string, customerId: string, group: CustomerGroup) {
  await requirePermission(adminUserId, "Customers", "Edit");

  const customer = await userRepository.findById(customerId);
  if (!customer) throw new CustomerNotFoundError();

  const updated = await userRepository.updateCustomerGroup(customerId, group);
  await writeAuditLog({
    actorId: adminUserId,
    action: "customer_group_set",
    module: "Customers",
    targetType: "User",
    targetId: customerId,
    metadata: { from: customer.customerGroup, to: group },
  });
  return toCustomerAdminSummary(updated);
}

// ---------------------------------------------------------------------------
// STORY-048. Admin customers console.
// ---------------------------------------------------------------------------

/**
 * STORY-048. Every admin-customer read below goes through this — the raw
 * `User` row (from userRepository.findById/listCustomersForAdmin/etc.)
 * carries `passwordHash`, which must never reach a client response. Also
 * fixes the same gap in setCustomerGroup's return above, which predates
 * this mapper (STORY-071).
 */
function toCustomerAdminSummary(user: {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
  customerGroup: string;
  phone: string | null;
  suspendedReason: string | null;
  suspendedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: user.status,
    customerGroup: user.customerGroup,
    phone: user.phone,
    suspendedReason: user.suspendedReason,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function listCustomersForAdmin(adminUserId: string, filters: CustomerAdminListFilters, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Customers", "View");
  const { customers, total } = await userRepository.listCustomersForAdmin(filters, page, pageSize);
  return { customers: customers.map(toCustomerAdminSummary), total };
}

async function requireCustomerRow(customerId: string) {
  const customer = await userRepository.findById(customerId);
  if (!customer) throw new CustomerNotFoundError();
  return customer;
}

export async function getCustomerAdminDetail(adminUserId: string, customerId: string, page = 1, pageSize = 10) {
  await requirePermission(adminUserId, "Customers", "View");
  const customer = await requireCustomerRow(customerId);

  const [addresses, orders, tickets, loginHistory, rewards, referrals, notes] = await Promise.all([
    addressRepository.listAddressesByUserId(customerId),
    getOrderListPage(customerId, page, pageSize),
    listTicketsForUser(customerId, page, pageSize),
    loginEventRepository.findLoginEventsByUserId(customerId, page, pageSize),
    getRewardsSummary(customerId),
    getReferralSummary(customerId),
    adminNoteRepository.findAdminNotesByCustomerId(customerId),
  ]);

  return { customer: toCustomerAdminSummary(customer), addresses, orders, tickets, loginHistory, rewards, referrals, notes };
}

export async function getLoginHistory(adminUserId: string, customerId: string, page: number, pageSize: number) {
  await requirePermission(adminUserId, "Customers", "View");
  await requireCustomerRow(customerId);
  return loginEventRepository.findLoginEventsByUserId(customerId, page, pageSize);
}

export async function suspendCustomer(adminUserId: string, customerId: string, reason: string) {
  await requirePermission(adminUserId, "Customers", "Edit");
  const customer = await requireCustomerRow(customerId);
  if (customer.status === "Suspended") throw new AccountAlreadySuspendedError();

  const updated = await userRepository.suspendCustomer(customerId, reason, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "customer_suspended", module: "Customers", targetType: "User", targetId: customerId, metadata: { reason } });
  return toCustomerAdminSummary(updated);
}

export async function reactivateCustomer(adminUserId: string, customerId: string) {
  await requirePermission(adminUserId, "Customers", "Edit");
  const customer = await requireCustomerRow(customerId);
  if (customer.status !== "Suspended") throw new AccountNotSuspendedError();

  const updated = await userRepository.reactivateCustomer(customerId);
  await writeAuditLog({ actorId: adminUserId, action: "customer_reactivated", module: "Customers", targetType: "User", targetId: customerId });
  return toCustomerAdminSummary(updated);
}

export async function grantReward(adminUserId: string, customerId: string, points: number, reason: string, expiresAt: Date | null) {
  await requirePermission(adminUserId, "Customers", "Approve");
  await requireCustomerRow(customerId);
  await grantManualPoints(customerId, points, reason, expiresAt);
  await writeAuditLog({ actorId: adminUserId, action: "customer_reward_granted", module: "Customers", targetType: "User", targetId: customerId, metadata: { points, reason, expiresAt } });
}

export interface IssueCouponInput {
  discountType: CouponDiscountType;
  percentOff: number | null;
  amountOff: number | null;
  expiresInDays: number;
  usageLimit: number;
}

export async function issueCoupon(adminUserId: string, customerId: string, input: IssueCouponInput) {
  await requirePermission(adminUserId, "Customers", "Approve");
  await requireCustomerRow(customerId);
  const coupon = await issueCouponToCustomer(customerId, input);
  await writeAuditLog({ actorId: adminUserId, action: "customer_coupon_issued", module: "Customers", targetType: "User", targetId: customerId, metadata: { couponId: coupon.id, code: coupon.code } });
  return coupon;
}

export async function addNote(adminUserId: string, customerId: string, body: string) {
  await requirePermission(adminUserId, "Customers", "Edit");
  await requireCustomerRow(customerId);
  const note = await adminNoteRepository.createAdminNote(customerId, adminUserId, body);
  await writeAuditLog({ actorId: adminUserId, action: "customer_note_added", module: "Customers", targetType: "User", targetId: customerId });
  return note;
}
