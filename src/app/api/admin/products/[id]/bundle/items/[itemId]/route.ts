import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteBundleItem, updateBundleItem } from "@/services/bundle-admin.service";
import { bundleItemSchema } from "@/validation/product-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, itemId } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bundleItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const item = await updateBundleItem(session.user.id, id, itemId, parsed.data);
    return NextResponse.json(item);
  } catch (error) {
    return productAdminErrorResponse(error, "PATCH /api/admin/products/[id]/bundle/items/[itemId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id, itemId } = await params;
  try {
    await deleteBundleItem(session.user.id, id, itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return productAdminErrorResponse(error, "DELETE /api/admin/products/[id]/bundle/items/[itemId]");
  }
}
