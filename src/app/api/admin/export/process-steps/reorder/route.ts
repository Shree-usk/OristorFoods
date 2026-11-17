import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportContentErrorResponse } from "@/lib/api/export-content-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reorderProcessSteps } from "@/services/export-content.service";
import { exportContentReorderSchema } from "@/validation/export-content.schema";

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportContentReorderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await reorderProcessSteps(session.user.id, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return exportContentErrorResponse(error, "PATCH /api/admin/export/process-steps/reorder");
  }
}
