import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { perfectMatchAdminErrorResponse } from "@/lib/api/perfect-match-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPerfectMatchSettingForAdmin, updatePerfectMatchSettingForAdmin } from "@/services/perfect-match-admin.service";
import { perfectMatchSettingAdminSchema } from "@/validation/perfect-match-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getPerfectMatchSettingForAdmin(session.user.id));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "GET /api/admin/perfect-match/settings");
  }
}

export async function PUT(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = perfectMatchSettingAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updatePerfectMatchSettingForAdmin(session.user.id, parsed.data));
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "PUT /api/admin/perfect-match/settings");
  }
}
