import { z } from "zod";

const orderStatusEnum = z.enum(["PendingConfirmation", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled", "Returned"]);
const paymentStatusEnum = z.enum(["Pending", "Succeeded", "Failed", "Refunded"]);
const returnReasonCodeEnum = z.enum(["Damaged", "WrongItem", "NotAsDescribed", "ChangedMind", "Other"]);

export const listOrdersAdminQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: orderStatusEnum.optional(),
  paymentStatus: paymentStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).optional(),
});

export const changeOrderStatusSchema = z.object({
  status: orderStatusEnum,
});

export const bulkChangeOrderStatusSchema = z.object({
  orderIds: z.array(z.string().trim().min(1)).min(1, "Select at least one order."),
  status: orderStatusEnum,
});

export const refundOrderSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().trim().min(1, "A reason is required so it's recorded."),
});

export const processReturnSchema = z.object({
  items: z
    .array(z.object({ orderItemId: z.string().trim().min(1), productName: z.string().trim().min(1), quantity: z.number().int().positive() }))
    .min(1, "Select at least one item."),
  reasonCode: returnReasonCodeEnum,
  restocked: z.boolean(),
});
