import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { popupAdminErrorResponse } from "@/lib/api/popup-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { changePopupStatus } from "@/services/popup.service";
import { updatePopupStatusSchema } from "@/validation/popup.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updatePopupStatusSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const popup = await changePopupStatus(session.user.id, id, parsed.data.status);
    return NextResponse.json(popup);
  } catch (error) {
    return popupAdminErrorResponse(error, "POST /api/admin/marketing/popups/[id]/status");
  }
}
