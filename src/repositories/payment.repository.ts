import type { PaymentStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export function createPayment(provider: string, providerReference: string, amount: string, currency: string) {
  return prisma.payment.create({ data: { provider, providerReference, amount, currency } });
}

export function findPaymentByReference(providerReference: string) {
  return prisma.payment.findUnique({ where: { providerReference } });
}

export function updatePaymentStatus(id: string, status: PaymentStatus) {
  return prisma.payment.update({ where: { id }, data: { status } });
}
