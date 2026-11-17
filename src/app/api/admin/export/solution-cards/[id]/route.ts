import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportContentErrorResponse } from "@/lib/api/export-content-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { removeSolutionCard, updateSolutionCard } from "@/services/export-content.service";
import { updateExportSolutionCardSchema } from "@/validation/export-content.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateExportSolutionCardSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const card = await updateSolutionCard(session.user.id, id, parsed.data);
    return NextResponse.json(card);
  } catch (error) {
    return exportContentErrorResponse(error, "PATCH /api/admin/export/solution-cards/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await removeSolutionCard(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return exportContentErrorResponse(error, "DELETE /api/admin/export/solution-cards/[id]");
  }
}
