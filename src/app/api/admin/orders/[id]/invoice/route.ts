import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { renderOrderInvoicePdf } from "@/services/invoice-pdf.service";
import { getOrderAdminDetail } from "@/services/order-admin.service";

/** Admin-side counterpart of api/orders/[orderNumber]/invoice — reuses the exact same STORY-036 renderOrderInvoicePdf(order: OrderDetail); OrderAdminDetail extends OrderDetail, so no adapter is needed. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await getOrderAdminDetail(session.user.id, id);
    const buffer = await renderOrderInvoicePdf(order);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${order.orderNumber}-invoice.pdf"` },
    });
  } catch (error) {
    return orderAdminErrorResponse(error, "GET /api/admin/orders/[id]/invoice");
  }
}
