import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { checkoutErrorResponse } from "@/lib/api/checkout-responses";
import { unauthorizedResponse, serverErrorResponse } from "@/lib/api/responses";
import { getOrderDetail } from "@/services/customer-order-history.service";
import { renderOrderInvoicePdf } from "@/services/invoice-pdf.service";

/** STORY-036. Session-only. No invoice/packing-slip PDF generation existed anywhere in the codebase before this route — see docs/architecture-decisions.md. */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  try {
    const order = await getOrderDetail(orderNumber, userId);
    const buffer = await renderOrderInvoicePdf(order);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${order.orderNumber}-invoice.pdf"`,
      },
    });
  } catch (error) {
    // checkoutErrorResponse maps known OrderServiceError codes (403/404);
    // anything else it re-throws, caught here as an unexpected PDF-render
    // or lookup failure.
    try {
      return checkoutErrorResponse(error);
    } catch {
      return serverErrorResponse(error, "GET /api/orders/[orderNumber]/invoice");
    }
  }
}
