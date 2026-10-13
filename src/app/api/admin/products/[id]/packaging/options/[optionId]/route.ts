import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deletePackagingOption, updatePackagingOption } from "@/services/packaging-admin.service";
import { productPackagingOptionAdminSchema } from "@/validation/packaging-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, optionId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = productPackagingOptionAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const option = await updatePackagingOption(session.user.id, id, optionId, parsed.data);
    return NextResponse.json(option);
  } catch (error) {
    return productAdminErrorResponse(error, "PATCH /api/admin/products/[id]/packaging/options/[optionId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; optionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, optionId } = await params;
  try {
    await deletePackagingOption(session.user.id, id, optionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/packaging/options/[optionId]");
  }
}
