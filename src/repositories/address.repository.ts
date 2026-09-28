import { prisma } from "@/lib/db";
import type { CheckoutAddressInput } from "@/validation/checkout.schema";

/**
 * Saved addresses (authenticated users only — STORY-034 later owns full
 * address management; checkout only lists, creates, and reads them).
 */

export function listAddressesByUserId(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function createAddress(userId: string, address: CheckoutAddressInput) {
  const hasAny = (await prisma.address.count({ where: { userId } })) > 0;
  return prisma.address.create({
    data: {
      userId,
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? null,
      city: address.city,
      district: address.district ?? null,
      postalCode: address.postalCode ?? null,
      isDefault: !hasAny,
    },
  });
}

export function findAddressById(id: string) {
  return prisma.address.findUnique({ where: { id } });
}
