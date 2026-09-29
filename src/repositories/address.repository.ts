import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Saved addresses. STORY-025 (checkout) created this model minimally and
 * only ever listed/created rows via address.service.ts's checkout-facing
 * wrappers; STORY-034 owns full management (update/delete/set-default) and
 * is the only caller of those functions. Pure CRUD only — the
 * default-billing/default-shipping swap and the 10-address cap are
 * business rules and live in address.service.ts, not here.
 */

type Client = Prisma.TransactionClient | typeof prisma;

export function listAddressesByUserId(userId: string, client: Client = prisma) {
  return client.address.findMany({
    where: { userId },
    orderBy: [{ isDefaultShipping: "desc" }, { isDefaultBilling: "desc" }, { updatedAt: "desc" }],
  });
}

export function countByUserId(userId: string, client: Client = prisma) {
  return client.address.count({ where: { userId } });
}

export function findAddressById(id: string, client: Client = prisma) {
  return client.address.findUnique({ where: { id } });
}

export interface AddressFields {
  label: "Home" | "Work" | "Other";
  type: "Shipping" | "Billing" | "Both";
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  district: string | null;
  postalCode: string | null;
  country: string;
  companyName: string | null;
  taxId: string | null;
}

export function createAddress(
  userId: string,
  fields: AddressFields,
  defaults: { isDefaultBilling: boolean; isDefaultShipping: boolean },
  client: Client = prisma,
) {
  return client.address.create({ data: { userId, ...fields, ...defaults } });
}

export function updateAddress(id: string, fields: Partial<AddressFields>, client: Client = prisma) {
  return client.address.update({ where: { id }, data: fields });
}

export function deleteAddress(id: string, client: Client = prisma) {
  return client.address.delete({ where: { id } });
}

/** Un-defaults every OTHER address of this user for the given purpose — the write side of the "exactly one default" invariant. */
export function clearDefaultBilling(userId: string, exceptAddressId: string, client: Client = prisma) {
  return client.address.updateMany({ where: { userId, id: { not: exceptAddressId }, isDefaultBilling: true }, data: { isDefaultBilling: false } });
}

export function clearDefaultShipping(userId: string, exceptAddressId: string, client: Client = prisma) {
  return client.address.updateMany({ where: { userId, id: { not: exceptAddressId }, isDefaultShipping: true }, data: { isDefaultShipping: false } });
}

export function setDefaultBilling(id: string, value: boolean, client: Client = prisma) {
  return client.address.update({ where: { id }, data: { isDefaultBilling: value } });
}

export function setDefaultShipping(id: string, value: boolean, client: Client = prisma) {
  return client.address.update({ where: { id }, data: { isDefaultShipping: value } });
}
