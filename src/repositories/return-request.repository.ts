import { prisma } from "@/lib/db";
import type { Prisma, ReturnReasonCode } from "@/generated/prisma/client";

/** STORY-036/047. The only place ReturnRequest is queried/mutated. */

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

/** STORY-047. The one open (Requested) return for an order, if any — the admin flow processes this one when it exists. */
export function findRequestedReturnByOrderId(orderId: string) {
  return prisma.returnRequest.findFirst({ where: { orderId, status: "Requested" }, orderBy: { createdAt: "desc" } });
}

export interface ProcessReturnInput {
  processedById: string;
  reasonCode: ReturnReasonCode;
  restocked: boolean;
}

/** Approves and completes an existing customer-submitted request in one step — this story doesn't build a separate Approved-but-not-yet-Completed admin review stage. */
export function completeReturnRequest(id: string, input: ProcessReturnInput) {
  return prisma.returnRequest.update({
    where: { id },
    data: { status: "Completed", processedById: input.processedById, reasonCode: input.reasonCode, restocked: input.restocked, processedAt: new Date() },
  });
}

/** Admin-initiated: no prior customer request existed, so one is created already Completed. */
export function createCompletedReturnRequest(
  orderId: string,
  items: ReturnRequestItemSnapshot[],
  input: ProcessReturnInput,
) {
  return prisma.returnRequest.create({
    data: {
      orderId,
      reason: "Initiated by admin.",
      items: items as unknown as Prisma.InputJsonValue,
      status: "Completed",
      processedById: input.processedById,
      reasonCode: input.reasonCode,
      restocked: input.restocked,
      processedAt: new Date(),
    },
  });
}
