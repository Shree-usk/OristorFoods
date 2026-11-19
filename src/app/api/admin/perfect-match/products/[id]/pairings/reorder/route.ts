import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { perfectMatchAdminErrorResponse } from "@/lib/api/perfect-match-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reorderPerfectMatchPairingsAdmin } from "@/services/perfect-match-admin.service";
import { perfectMatchReorderSchema } from "@/validation/perfect-match-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = perfectMatchReorderSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await reorderPerfectMatchPairingsAdmin(session.user.id, id, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return perfectMatchAdminErrorResponse(error, "PATCH /api/admin/perfect-match/products/[id]/pairings/reorder");
  }
}
