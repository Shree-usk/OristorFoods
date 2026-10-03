import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { requirePermission } from "@/services/permission.service";
import { getLowStockThreshold, updateLowStockThreshold } from "@/services/system-settings.service";
import { lowStockThresholdSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    await requirePermission(session.user.id, "SystemSettings", "View");
    const threshold = await getLowStockThreshold();
    return NextResponse.json({ lowStockThreshold: threshold });
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/inventory");
  }
}

export async function PATCH(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = lowStockThresholdSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const updated = await updateLowStockThreshold(session.user.id, parsed.data.lowStockThreshold);
    return NextResponse.json(updated);
  } catch (error) {
    return systemSettingsErrorResponse(error, "PATCH /api/admin/settings/inventory");
  }
}
