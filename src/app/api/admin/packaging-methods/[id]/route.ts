import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updatePackagingMethod } from "@/services/packaging-admin.service";
import { packagingMethodAdminSchema } from "@/validation/packaging-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = packagingMethodAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updatePackagingMethod(session.user.id, id, parsed.data));
  } catch (error) {
    return productAdminErrorResponse(error, "PATCH /api/admin/packaging-methods/[id]");
  }
}
