import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { upsertVolumeDiscountTier } from "@/services/product-admin.service";
import { upsertVolumeDiscountTierSchema } from "@/validation/product-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = upsertVolumeDiscountTierSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const tier = await upsertVolumeDiscountTier(session.user.id, id, parsed.data.id ?? null, parsed.data);
    return NextResponse.json(tier, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/pricing/volume-discount");
  }
}
