import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createFoodAcademyCategory, listFoodAcademyCategoriesForAdmin } from "@/services/food-academy-admin.service";
import { foodAcademyCategoryAdminSchema } from "@/validation/food-academy-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listFoodAcademyCategoriesForAdmin(session.user.id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/categories");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyCategoryAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const category = await createFoodAcademyCategory(session.user.id, parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "POST /api/admin/food-academy/categories");
  }
}
