import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPackagingOption, listPackagingOptionsForProduct } from "@/services/packaging-admin.service";
import { productPackagingOptionAdminSchema } from "@/validation/packaging-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await listPackagingOptionsForProduct(session.user.id, id));
  } catch (error) {
    return productAdminErrorResponse(error, "GET /api/admin/products/[id]/packaging/options");
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = productPackagingOptionAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const option = await createPackagingOption(session.user.id, id, parsed.data);
    return NextResponse.json(option, { status: 201 });
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/[id]/packaging/options");
  }
}
