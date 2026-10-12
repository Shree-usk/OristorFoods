import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { setBundleImages } from "@/services/bundle-admin.service";
import { setBundleImagesSchema } from "@/validation/product-admin.schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setBundleImagesSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const bundle = await setBundleImages(session.user.id, id, parsed.data.images);
    return NextResponse.json(bundle);
  } catch (error) {
    return productAdminErrorResponse(error, "PUT /api/admin/products/[id]/bundle/images");
  }
}
