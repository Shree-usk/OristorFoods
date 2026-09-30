import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { removeCampaignPrice } from "@/services/product-admin.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; priceId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, priceId } = await params;
  try {
    await removeCampaignPrice(session.user.id, id, priceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/pricing/campaign/[priceId]");
  }
}
