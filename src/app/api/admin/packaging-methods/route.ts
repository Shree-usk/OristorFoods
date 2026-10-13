import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPackagingMethod, listPackagingMethods } from "@/services/packaging-admin.service";
import { packagingMethodAdminSchema } from "@/validation/packaging-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listPackagingMethods(session.user.id));
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/packaging-methods");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = packagingMethodAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const method = await createPackagingMethod(session.user.id, parsed.data);
    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/packaging-methods");
  }
}
