import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { previewTemplate } from "@/services/notification-template-admin.service";
import { requirePermission } from "@/services/permission.service";
import { previewTemplateSchema } from "@/validation/system-settings.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = previewTemplateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await requirePermission(session.user.id, "SystemSettings", "View");
    const rendered = previewTemplate(parsed.data.body, parsed.data.sampleVariables ?? {});
    return NextResponse.json({ rendered });
  } catch (error) {
    return systemSettingsErrorResponse(error, "POST /api/admin/settings/notification-templates/preview");
  }
}
