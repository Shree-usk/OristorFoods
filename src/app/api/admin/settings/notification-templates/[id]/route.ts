import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { NotificationTemplateNotFoundError } from "@/services/notification-template-admin.errors";
import { updateTemplate } from "@/services/notification-template-admin.service";
import { updateNotificationTemplateSchema } from "@/validation/system-settings.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateNotificationTemplateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateTemplate(session.user.id, id, parsed.data));
  } catch (error) {
    if (error instanceof NotificationTemplateNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/notification-templates/[id]");
  }
}
