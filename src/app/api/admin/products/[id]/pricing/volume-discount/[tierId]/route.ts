import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { removeVolumeDiscountTier } from "@/services/product-admin.service";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; tierId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, tierId } = await params;
  try {
    await removeVolumeDiscountTier(session.user.id, id, tierId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/pricing/volume-discount/[tierId]");
  }
}
