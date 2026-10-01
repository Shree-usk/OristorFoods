import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { orderAdminErrorResponse } from "@/lib/api/order-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getOrderAdminDetail } from "@/services/order-admin.service";
import { renderOrderPackingSlipPdf } from "@/services/packing-slip-pdf.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await getOrderAdminDetail(session.user.id, id);
    const buffer = await renderOrderPackingSlipPdf(order);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${order.orderNumber}-packing-slip.pdf"` },
    });
  } catch (error) {
    return orderAdminErrorResponse(error, "GET /api/admin/orders/[id]/packing-slip");
  }
}
