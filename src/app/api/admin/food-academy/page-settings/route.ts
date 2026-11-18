import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { foodAcademyAdminErrorResponse } from "@/lib/api/food-academy-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getFoodAcademyPageSettingForAdmin, updateFoodAcademyPageSettingForAdmin } from "@/services/food-academy-page-setting.service";
import { foodAcademyPageSettingAdminSchema } from "@/validation/food-academy-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getFoodAcademyPageSettingForAdmin(session.user.id));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "GET /api/admin/food-academy/page-settings");
  }
}

export async function PUT(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = foodAcademyPageSettingAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateFoodAcademyPageSettingForAdmin(session.user.id, parsed.data));
  } catch (error) {
    return foodAcademyAdminErrorResponse(error, "PUT /api/admin/food-academy/page-settings");
  }
}
