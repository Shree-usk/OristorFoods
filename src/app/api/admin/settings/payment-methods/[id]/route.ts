import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { deletePaymentMethod, updatePaymentMethod } from "@/services/system-settings.service";
import { updatePaymentMethodSchema } from "@/validation/system-settings.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updatePaymentMethodSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updatePaymentMethod(session.user.id, id, parsed.data));
  } catch (error) {
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/payment-methods/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deletePaymentMethod(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return systemSettingsErrorResponse(error, "DELETE /api/admin/settings/payment-methods/[id]");
  }
}
