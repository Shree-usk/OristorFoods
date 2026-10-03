import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { inviteAdminUser, listUsersForAdmin } from "@/services/admin-user-admin.service";
import { inviteAdminUserSchema } from "@/validation/admin-user-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listUsersForAdmin(session.user.id));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "GET /api/admin/users");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = inviteAdminUserSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const user = await inviteAdminUser(session.user.id, parsed.data);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return adminUserAdminErrorResponse(error, "POST /api/admin/users");
  }
}
