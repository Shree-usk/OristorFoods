import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { previewBundlePricing } from "@/services/bundle-admin.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const preview = await previewBundlePricing(session.user.id, id);
    return NextResponse.json(preview);
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/products/[id]/bundle/preview");
  }
}
