import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** STORY-036. The only place ReturnRequest is queried/mutated. */

export interface ReturnRequestItemSnapshot {
  orderItemId: string;
  productName: string;
  quantity: number;
}

export function createReturnRequest(orderId: string, reason: string, items: ReturnRequestItemSnapshot[]) {
  return prisma.returnRequest.create({
    data: { orderId, reason, items: items as unknown as Prisma.InputJsonValue },
  });
}

export function findReturnRequestsByOrderId(orderId: string) {
  return prisma.returnRequest.findMany({ where: { orderId }, orderBy: { createdAt: "desc" } });
}
