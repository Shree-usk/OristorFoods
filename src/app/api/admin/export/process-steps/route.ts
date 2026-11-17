import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportContentErrorResponse } from "@/lib/api/export-content-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addProcessStep, listProcessStepsForAdmin } from "@/services/export-content.service";
import { exportProcessStepSchema } from "@/validation/export-content.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listProcessStepsForAdmin(session.user.id));
  } catch (error) {
    return exportContentErrorResponse(error, "GET /api/admin/export/process-steps");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportProcessStepSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const step = await addProcessStep(session.user.id, parsed.data);
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    return exportContentErrorResponse(error, "POST /api/admin/export/process-steps");
  }
}
