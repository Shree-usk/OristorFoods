import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { syncJobErrorResponse } from "@/lib/api/sync-job-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { retryJob } from "@/services/sync-job.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await retryJob(session.user.id, id));
  } catch (error) {
    return syncJobErrorResponse(error, "POST /api/admin/erp-integration/jobs/[id]/retry");
  }
}
