import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { categoryErrorResponse } from "@/lib/api/category-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCategoryAdmin, listCategoriesForAdmin } from "@/services/category.service";
import { categoryAdminSchema } from "@/validation/category-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listCategoriesForAdmin(session.user.id));
  } catch (error) {
    return categoryErrorResponse(error, "GET /api/admin/categories");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = categoryAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const category = await createCategoryAdmin(session.user.id, parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return categoryErrorResponse(error, "POST /api/admin/categories");
  }
}
