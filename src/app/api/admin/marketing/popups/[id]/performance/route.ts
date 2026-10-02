import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { popupAdminErrorResponse } from "@/lib/api/popup-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getPerformanceSummary } from "@/services/popup.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const summary = await getPerformanceSummary(session.user.id, id);
    return NextResponse.json(summary);
  } catch (error) {
    return popupAdminErrorResponse(error, "GET /api/admin/marketing/popups/[id]/performance");
  }
}
