import { prisma } from "@/lib/db";
import * as addressRepository from "@/repositories/address.repository";
import type { AddressFields } from "@/repositories/address.repository";
import { AddressForbiddenError, AddressLimitExceededError, AddressNotFoundError } from "@/services/address.errors";

/**
 * STORY-034. Owns the address book's business rules — the default-billing/
 * default-shipping swap (exactly one of each per user, server-enforced)
 * and the 10-address cap. address.repository.ts is pure CRUD;
 * checkout.service.ts (STORY-025) calls the two checkout-facing wrappers
 * below rather than duplicating this logic.
 */

export const MAX_ADDRESSES_PER_USER = 10;

export function listAddresses(userId: string) {
  return addressRepository.listAddressesByUserId(userId);
}

async function assertOwnership(userId: string, addressId: string) {
  const address = await addressRepository.findAddressById(addressId);
  if (!address) throw new AddressNotFoundError();
  if (address.userId !== userId) throw new AddressForbiddenError();
  return address;
}

export function getAddress(userId: string, addressId: string) {
  return assertOwnership(userId, addressId);
}

export interface CreateAddressOptions {
  setAsDefaultBilling?: boolean;
  setAsDefaultShipping?: boolean;
}

/**
 * The first address a customer ever saves is always both defaults — there
 * is nothing else to fall back to at checkout. After that, a default is
 * only set when explicitly requested, and setting one atomically un-sets
 * whichever address held that default before (never two defaults of the
 * same kind at once).
 */
export async function createAddress(userId: string, fields: AddressFields, options: CreateAddressOptions = {}) {
  const count = await addressRepository.countByUserId(userId);
  if (count >= MAX_ADDRESSES_PER_USER) throw new AddressLimitExceededError(MAX_ADDRESSES_PER_USER);

  const isFirst = count === 0;
  const isDefaultBilling = isFirst || options.setAsDefaultBilling === true;
  const isDefaultShipping = isFirst || options.setAsDefaultShipping === true;

  return prisma.$transaction(async (tx) => {
    const address = await addressRepository.createAddress(userId, fields, { isDefaultBilling, isDefaultShipping }, tx);
    if (isDefaultBilling) await addressRepository.clearDefaultBilling(userId, address.id, tx);
    if (isDefaultShipping) await addressRepository.clearDefaultShipping(userId, address.id, tx);
    return address;
  });
}

export interface UpdateAddressInput extends Partial<AddressFields> {
  setAsDefaultBilling?: boolean;
  setAsDefaultShipping?: boolean;
}

/** Plain field edits and default-swaps are independent — a PATCH may do either, both, or neither. */
export async function updateAddress(userId: string, addressId: string, input: UpdateAddressInput) {
  await assertOwnership(userId, addressId);
  const { setAsDefaultBilling, setAsDefaultShipping, ...fields } = input;

  if (Object.keys(fields).length > 0) {
    await addressRepository.updateAddress(addressId, fields);
  }
  if (setAsDefaultBilling) await setDefaultBilling(userId, addressId);
  if (setAsDefaultShipping) await setDefaultShipping(userId, addressId);

  return addressRepository.findAddressById(addressId);
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await assertOwnership(userId, addressId);
  await addressRepository.deleteAddress(addressId);
}

export async function setDefaultBilling(userId: string, addressId: string) {
  await assertOwnership(userId, addressId);
  return prisma.$transaction(async (tx) => {
    await addressRepository.clearDefaultBilling(userId, addressId, tx);
    return addressRepository.setDefaultBilling(addressId, true, tx);
  });
}

export async function setDefaultShipping(userId: string, addressId: string) {
  await assertOwnership(userId, addressId);
  return prisma.$transaction(async (tx) => {
    await addressRepository.clearDefaultShipping(userId, addressId, tx);
    return addressRepository.setDefaultShipping(addressId, true, tx);
  });
}

/**
 * Checkout's own minimal, Sri-Lanka-shaped save-during-checkout flow
 * (STORY-025). Fills the newer STORY-034 fields with sensible defaults —
 * a checkout-saved address has no label/type/company preference to ask
 * for mid-purchase.
 */
export interface CheckoutAddressFields {
  recipientName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  district?: string;
  postalCode?: string;
}

export function saveAddressFromCheckout(userId: string, address: CheckoutAddressFields) {
  return createAddress(userId, {
    label: "Home",
    type: "Both",
    recipientName: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    district: address.district ?? null,
    postalCode: address.postalCode ?? null,
    country: "LK",
    companyName: null,
    taxId: null,
  });
}
