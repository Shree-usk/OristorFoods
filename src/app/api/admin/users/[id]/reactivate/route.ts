import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { reactivateUser } from "@/services/admin-user-admin.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await reactivateUser(session.user.id, id));
  } catch (error) {
    return adminUserAdminErrorResponse(error, "POST /api/admin/users/[id]/reactivate");
  }
}
