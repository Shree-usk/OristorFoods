import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { setVariantImages } from "@/services/product-admin.service";
import { setVariantImagesSchema } from "@/validation/product-admin.schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, variantId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setVariantImagesSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const variant = await setVariantImages(session.user.id, id, variantId, parsed.data.images);
    return NextResponse.json(variant);
  } catch (error) {
    return productAdminErrorResponse(error, "PUT /api/admin/products/[id]/variants/[variantId]/images");
  }
}
