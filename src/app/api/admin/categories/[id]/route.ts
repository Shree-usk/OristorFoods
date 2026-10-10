import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { categoryErrorResponse } from "@/lib/api/category-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateCategoryAdmin } from "@/services/category.service";
import { categoryAdminSchema } from "@/validation/category-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = categoryAdminSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateCategoryAdmin(session.user.id, id, parsed.data));
  } catch (error) {
    return categoryErrorResponse(error, "PATCH /api/admin/categories/[id]");
  }
}
