import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { createFeatureFlag, listFeatureFlags } from "@/services/system-settings.service";
import { createFeatureFlagSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listFeatureFlags(session.user.id));
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/feature-flags");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createFeatureFlagSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const flag = await createFeatureFlag(session.user.id, { ...parsed.data, description: parsed.data.description ?? null });
    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    return systemSettingsErrorResponse(error, "POST /api/admin/settings/feature-flags");
  }
}
