import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { serverErrorResponse, unauthorizedResponse } from "@/lib/api/responses";
import { getDashboardSummary } from "@/services/admin-dashboard.service";

/** STORY-039. Backs both the dashboard page's initial Server Component render (called directly) and the client's refetchInterval polling. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const summary = await getDashboardSummary(session.user.id);
    return NextResponse.json(summary);
  } catch (error) {
    return serverErrorResponse(error, "GET /api/admin/dashboard/summary");
  }
}
