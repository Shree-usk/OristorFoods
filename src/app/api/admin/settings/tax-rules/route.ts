import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { createTaxRateRule, getTaxSettings } from "@/services/system-settings.service";
import { taxRateRuleSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const { rules } = await getTaxSettings(session.user.id);
    return NextResponse.json(rules);
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/tax-rules");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = taxRateRuleSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const rule = await createTaxRateRule(session.user.id, { ...parsed.data, category: parsed.data.category ?? null });
    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    return systemSettingsErrorResponse(error, "POST /api/admin/settings/tax-rules");
  }
}
