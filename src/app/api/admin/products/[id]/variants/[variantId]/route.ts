import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteVariant, updateVariant } from "@/services/product-admin.service";
import { productVariantSchema } from "@/validation/product-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, variantId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = productVariantSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const variant = await updateVariant(session.user.id, id, variantId, parsed.data);
    return NextResponse.json(variant);
  } catch (error) {
    return productAdminErrorResponse(error, "PATCH /api/admin/products/[id]/variants/[variantId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, variantId } = await params;
  try {
    await deleteVariant(session.user.id, id, variantId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/variants/[variantId]");
  }
}
