import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productAdminErrorResponse } from "@/lib/api/product-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkDelete } from "@/services/product-admin.service";
import { bulkDeleteSchema } from "@/validation/product-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkDeleteSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkDelete(session.user.id, parsed.data.ids);
    return NextResponse.json(result);
  } catch (error) {
    return productAdminErrorResponse(error, "POST /api/admin/products/bulk-delete");
  }
}
