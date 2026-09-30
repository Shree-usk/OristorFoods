import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { homepageBuilderErrorResponse } from "@/lib/api/homepage-builder-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { rollbackToPrevious } from "@/services/homepage-builder.service";

/** No [id] segment — always republishes the most-recently-Archived layout (one-level rollback). */
export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const layout = await rollbackToPrevious(session.user.id);
    return NextResponse.json(layout);
  } catch (error) {
    return homepageBuilderErrorResponse(error, "POST /api/admin/homepage-builder/rollback");
  }
}
