import { prisma } from "@/lib/db";

/** STORY-047. The only place RefundRecord is queried/mutated — the ledger of individual refund actions against an order (see schema's own comment on why Payment.status alone isn't enough). */

export function createRefundRecord(orderId: string, amount: string, reason: string, processedById: string) {
  return prisma.refundRecord.create({ data: { orderId, amount, reason, processedById } });
}

export function listRefundRecordsByOrderId(orderId: string) {
  return prisma.refundRecord.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
}

/** Sum of every refund already issued for this order — the remaining-balance guard subtracts this from the order total. */
export async function sumRefundedAmountForOrder(orderId: string): Promise<number> {
  const result = await prisma.refundRecord.aggregate({ where: { orderId }, _sum: { amount: true } });
  return result._sum.amount?.toNumber() ?? 0;
}
