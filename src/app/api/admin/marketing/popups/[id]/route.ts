import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { popupAdminErrorResponse } from "@/lib/api/popup-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getPopupAdminDetail, updatePopup } from "@/services/popup.service";
import { popupUpdateSchema } from "@/validation/popup.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const popup = await getPopupAdminDetail(session.user.id, id);
    return NextResponse.json(popup);
  } catch (error) {
    return popupAdminErrorResponse(error, "GET /api/admin/marketing/popups/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = popupUpdateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const popup = await updatePopup(session.user.id, id, parsed.data);
    return NextResponse.json(popup);
  } catch (error) {
    return popupAdminErrorResponse(error, "PATCH /api/admin/marketing/popups/[id]");
  }
}
