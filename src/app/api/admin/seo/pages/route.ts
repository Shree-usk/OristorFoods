import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { serverErrorResponse, unauthorizedResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { listSeoPagesForAdmin } from "@/services/seo-pages.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const rows = await listSeoPagesForAdmin(session.user.id);
    return NextResponse.json(rows);
  } catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    return serverErrorResponse(error, "GET /api/admin/seo/pages");
  }
}
